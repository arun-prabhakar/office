import type {
  AgentStreamCallbacks,
  AgentStreamHandle,
  AgentStreamRequest,
  AgentTransport,
} from '@prismoffice/agent-core'
import type { AiStreamChunk } from '@prismoffice/ai-provider'

/**
 * AgentTransport over HTTP/SSE for the webapp. Posts one model turn
 * ({ system, messages, tools }) to a Next.js route that runs `streamForProvider`
 * server-side, then reads the NDJSON chunk stream back and translates it into
 * the AgentStreamCallbacks the AgentLoop expects — the same callback shape the
 * Electron `createIpcTransport` produced, so agent-core's loop is unchanged.
 */
export function createFetchTransport(api = '/api/agent/stream'): AgentTransport {
  return {
    stream(request: AgentStreamRequest, cb: AgentStreamCallbacks): AgentStreamHandle {
      const controller = new AbortController()
      void (async () => {
        try {
          const res = await fetch(api, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
              system: request.system,
              messages: request.messages,
              tools: request.tools,
            }),
            signal: controller.signal,
          })
          if (!res.ok || !res.body) {
            cb.onError(`Agent HTTP ${res.status}`)
            return
          }
          const reader = res.body.getReader()
          const decoder = new TextDecoder()
          let buffer = ''
          for (;;) {
            const { done, value } = await reader.read()
            if (done) break
            buffer += decoder.decode(value, { stream: true })
            const lines = buffer.split('\n')
            buffer = lines.pop() ?? ''
            for (const line of lines) {
              const trimmed = line.trim()
              if (!trimmed) continue
              const chunk = JSON.parse(trimmed) as AiStreamChunk
              switch (chunk.type) {
                case 'delta':
                  cb.onDelta(chunk.text ?? '')
                  break
                case 'tool-call':
                  if (chunk.toolCall) cb.onToolCall(chunk.toolCall)
                  break
                case 'done':
                  if (chunk.stopReason) cb.onStopReason?.(chunk.stopReason)
                  cb.onDone()
                  return
                case 'error':
                  cb.onError(chunk.error ?? 'agent error')
                  return
                default:
                  break
              }
            }
          }
          cb.onDone()
        } catch (e) {
          if (controller.signal.aborted) return
          cb.onError(e instanceof Error ? e.message : String(e))
        }
      })()
      return { cancel: () => controller.abort() }
    },
  }
}
