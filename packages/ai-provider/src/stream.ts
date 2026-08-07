import { streamText } from 'ai'
import type { AgentMessage, AgentToolCall, AgentToolDef } from '@genoffice/agent-core'
import { modelFor, toolsFor } from './models'
import { toCoreMessages } from './messages'
import type { AiProviderConfig, AiProviderId } from './types'
import { createStreamWatchdog, type StreamWatchdog } from './watchdog'

/**
 * Thrown when a provider reports an out-of-credits / billing condition, so the
 * apps can surface the localized "top up" message (errorCode 'credits'). With
 * direct vendor APIs this is inferred from the error shape/message rather than
 * a fixed notice string. The exact
 * vendor error strings still need validation against real APIs (P4).
 */
export class AiCreditsError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'AiCreditsError'
  }
}

export interface StreamCallbacks {
  onDelta: (text: string) => void
  onToolCall: (call: AgentToolCall) => void
  /** normalized stop reason of the turn ('max_tokens' = cut off by the token limit) */
  onStopReason?: (reason: string) => void
  /** a stream part arrived (used to re-arm the IPC silence watchdog) */
  onActivity?: () => void
  signal: AbortSignal
}

// Phrases that indicate a billing/credits failure rather than a transient rate
// limit. Deliberately narrow: a generic 429/rate-limit is a throttle, not an
// out-of-credits state, and must not trigger the "top up" UX. These cover the
// common shapes from OpenAI, Anthropic, Google and DeepSeek; the exact mapping
// still needs validation against real vendor responses.
const CREDIT_TERMS = [
  'credit',
  'credits',
  'billing',
  'credit balance',
  'balance is too low',
  'insufficient_quota',
  'insufficient quota',
  'quota exceeded',
  'exceeded your current quota',
  'resource_exhausted',
  'exhausted',
  'insufficient credit',
  'plan_limit',
]

function isCreditsError(e: unknown): boolean {
  if (!(e instanceof Error)) return false
  const msg = `${e.name}: ${e.message}`.toLowerCase()
  return CREDIT_TERMS.some((t) => msg.includes(t))
}

function errorMessage(e: unknown): string {
  if (e instanceof Error) return e.message || e.name
  return String(e)
}

/**
 * Route a single streaming, tool-calling-capable model turn by provider id.
 *
 * One call = one model turn. The agent loop (agent-core/loop.ts) owns multi-step
 * iteration, tool execution, and the maxTurns cap, so this is single-turn
 * (no `stopWhen`): `streamText` returns tool calls without running them (the
 * tools have no `execute`), and the loop drives the next turn.
 *
 * Replaces the former per-provider fetch+SSE parsers (~900 lines) with one
 * `streamText` + `fullStream` consumer. The provider packages handle the vendor
 * protocol; we translate stream parts into the existing `StreamCallbacks`.
 */
export async function streamForProvider(
  provider: AiProviderId,
  config: AiProviderConfig,
  system: string,
  messages: AgentMessage[],
  tools: AgentToolDef[],
  maxTokens: number,
  cb: StreamCallbacks,
): Promise<void> {
  const wd = createStreamWatchdog(cb.signal)
  return wd.guard(() => streamTurn(provider, config, system, messages, tools, maxTokens, cb, wd))
}

async function streamTurn(
  provider: AiProviderId,
  config: AiProviderConfig,
  system: string,
  messages: AgentMessage[],
  tools: AgentToolDef[],
  maxTokens: number,
  cb: StreamCallbacks,
  wd: StreamWatchdog,
): Promise<void> {
  // modelFor throws synchronously for a base-URL-less custom provider, before
  // any network call — matching the old "rejects without a base URL, without
  // calling fetch" contract.
  const model = modelFor(provider, config)
  const baseOptions = {
    model,
    system,
    messages: toCoreMessages(messages),
    maxOutputTokens: maxTokens,
    abortSignal: wd.signal,
  }
  // Two branches (not a conditional spread) so the call typechecks under
  // exactOptionalPropertyTypes (enabled by the app tsconfigs that consume this).
  const result =
    tools.length > 0 ? streamText({ ...baseOptions, tools: toolsFor(tools) }) : streamText(baseOptions)

  // Tool calls are buffered to end-of-turn so a `length` finish (max_tokens)
  // can mark the last (cut-off) call as truncated before it is emitted, and so
  // the stop reason is reported after every tool call — matching the prior
  // emission order the apps' renderers already depend on.
  const collectedToolCalls: AgentToolCall[] = []
  let finishReason: string | undefined
  let emittedContent = false

  try {
    for await (const part of result.fullStream) {
      wd.touch()
      cb.onActivity?.()
      switch (part.type) {
        case 'text-delta':
          if (part.text) {
            emittedContent = true
            cb.onDelta(part.text)
          }
          break
        case 'tool-call':
          emittedContent = true
          collectedToolCalls.push({
            id: part.toolCallId,
            name: part.toolName,
            input: (part.input as Record<string, unknown> | undefined) ?? {},
          })
          break
        case 'finish':
          finishReason = part.finishReason
          break
        case 'error':
          throw part.error
        // 'step-start' | 'step-end' | 'tool-input-start' | 'tool-input-delta'
        // | 'reasoning' | 'file' | …: not needed for the single-turn contract.
        default:
          break
      }
    }
  } catch (e) {
    const err = e instanceof Error ? e : new Error(errorMessage(e))
    if (isCreditsError(err)) throw new AiCreditsError(err.message)
    throw err
  }

  // A `length` finish (output token limit) may have cut off the last tool
  // call's arguments; flag it so the loop asks the model to split the call.
  const isMaxTokens = finishReason === 'length'
  const lastTool = collectedToolCalls.at(-1)
  if (isMaxTokens && lastTool) lastTool.truncated = true
  for (const call of collectedToolCalls) cb.onToolCall(call)

  // A turn with no content AND no finish framing is a gateway/model soft
  // failure, not a genuine empty closing turn (which still carries finishReason
  // and must succeed). Surfaces as an error so the UI doesn't show an empty
  // "successful" turn with no diagnostics.
  if (!emittedContent && collectedToolCalls.length === 0 && !finishReason) {
    throw new Error('The model returned no content (empty stream)')
  }

  if (finishReason) cb.onStopReason?.(isMaxTokens ? 'max_tokens' : finishReason)
}
