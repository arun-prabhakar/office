import { generateText } from 'ai'
import { modelFor } from './models'
import { toCoreMessages } from './messages'
import type { AiChatResponse, AiProviderConfig, AiProviderId } from './types'
import { AI_CHAT_RESPONSE_TIMEOUT_MS, createStreamWatchdog } from './watchdog'

function errorMessage(e: unknown): string {
  if (e instanceof Error) return e.message || e.name
  return String(e)
}

/**
 * Route a one-shot (non-streaming, non-tool-calling) chat call by provider id.
 *
 * Replaces the former per-provider fetch+SSE handlers with a single AI SDK
 * `generateText` call; the provider packages handle the vendor protocol. Errors
 * (HTTP, auth, parse) come back as JS Errors whose `.message` is surfaced
 * verbatim — callers no longer see provider-prefixed strings like "Claude HTTP
 * 401" (the AI SDK error already names the provider and status).
 */
export async function chatForProvider(
  provider: AiProviderId,
  config: AiProviderConfig,
  system: string,
  user: string,
  signal?: AbortSignal,
): Promise<AiChatResponse> {
  // non-streaming: the server generates the full answer before the headers
  // arrive, so the connect phase gets the long budget; the body read then gets
  // the idle budget.
  const wd = createStreamWatchdog(signal, AI_CHAT_RESPONSE_TIMEOUT_MS)
  return wd.guard(async () => {
    try {
      const model = modelFor(provider, config)
      const result = await generateText({
        model,
        system,
        messages: toCoreMessages([{ role: 'user', text: user }]),
      })
      const content = result.text
      if (!content) return { ok: false, error: 'AI returned an empty response' }
      return { ok: true, content }
    } catch (e) {
      // modelFor throws synchronously for a base-URL-less custom provider before
      // any network call; generateText throws provider/network errors. Both land here.
      return { ok: false, error: errorMessage(e) }
    }
  })
}
