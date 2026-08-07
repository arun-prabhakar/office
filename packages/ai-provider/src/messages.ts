import type { CoreMessage } from 'ai'
import type { AgentMessage } from '@prismoffice/agent-core'

/** Decode a raw base64 string (no data: prefix) to bytes, for AI SDK image parts. */
function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return bytes
}

/**
 * Convert the agent-core message history to AI SDK `CoreMessage[]`.
 *
 * The system prompt is NOT included here — it is passed separately to
 * `streamText`/`generateText` via the `system` option, so each provider places
 * it correctly (Anthropic `system` param vs. an OpenAI `system` message, etc.).
 *
 * Replaces the three former per-provider shapers (anthropicMessages /
 * geminiContents / openAiMessages). Invariants carried over:
 *  - plain-text user turns stay a string (only upgraded to a parts array when
 *    images are attached), matching the old Anthropic/OpenAI behavior;
 *  - an assistant turn with neither text nor tool calls still gets a non-empty
 *    placeholder part so providers never receive an empty assistant content
 *    block (which poisons follow-up turns — see loop.ts finishTurn).
 */
export function toCoreMessages(messages: readonly AgentMessage[]): CoreMessage[] {
  const out: CoreMessage[] = []
  for (const m of messages) {
    if (m.role === 'user') {
      if (!m.images?.length) {
        out.push({ role: 'user', content: m.text })
      } else {
        const parts: NonNullable<Extract<CoreMessage, { role: 'user' }>['content']> = []
        if (m.text) parts.push({ type: 'text', text: m.text })
        for (const img of m.images) {
          parts.push({ type: 'image', image: base64ToBytes(img.base64), mediaType: img.mime })
        }
        out.push({ role: 'user', content: parts })
      }
    } else if (m.role === 'assistant') {
      const parts: NonNullable<Extract<CoreMessage, { role: 'assistant' }>['content']> = []
      if (m.text) parts.push({ type: 'text', text: m.text })
      for (const call of m.toolCalls ?? []) {
        parts.push({ type: 'tool-call', toolCallId: call.id, toolName: call.name, input: call.input })
      }
      if (parts.length === 0) parts.push({ type: 'text', text: '(no content)' })
      out.push({ role: 'assistant', content: parts })
    } else {
      const parts: NonNullable<Extract<CoreMessage, { role: 'tool' }>['content']> = m.results.map(
        (r) => ({
          type: 'tool-result',
          toolCallId: r.id,
          toolName: r.name,
          output: r.isError
            ? { type: 'error-text', value: r.output }
            : { type: 'text', value: r.output },
        }),
      )
      out.push({ role: 'tool', content: parts })
    }
  }
  return out
}
