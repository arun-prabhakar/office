import { streamForProvider, type AiStreamChunk } from '@genoffice/ai-provider'
import type { AgentMessage, AgentToolDef } from '@genoffice/agent-core'

// Web agent route: one streamed model turn, proxied server-side so the vendor
// API key never reaches the browser. This is a thin adapter over the migrated
// `streamForProvider` (packages/ai-provider) — the exact same code path the
// Electron main process used, now serving a browser AgentLoop.
//
// The browser runs agent-core's AgentLoop (tool execution touches the editor
// state, which lives in the browser, as in the Electron renderer). This route
// only streams one model turn per request: the loop calls it repeatedly across
// turns. Emits one AiStreamChunk per line (NDJSON).
const encoder = new TextEncoder()

export async function POST(req: Request) {
  const { system, messages, tools, maxTokens } = (await req.json()) as {
    system: string
    messages: AgentMessage[]
    tools: AgentToolDef[]
    maxTokens?: number
  }

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const emit = (chunk: AiStreamChunk) =>
        controller.enqueue(encoder.encode(JSON.stringify(chunk) + '\n'))
      let stopReason: string | undefined
      try {
        await streamForProvider(
          'anthropic',
          {
            apiKey: process.env.ANTHROPIC_API_KEY ?? '',
            model: process.env.AI_MODEL ?? 'claude-sonnet-4-5',
          },
          system,
          messages,
          tools,
          maxTokens ?? 8192,
          {
            onDelta: (text) => emit({ requestId: '', type: 'delta', text }),
            onToolCall: (toolCall) => emit({ requestId: '', type: 'tool-call', toolCall }),
            onStopReason: (reason) => {
              stopReason = reason
            },
            signal: req.signal,
          },
        )
        emit({ requestId: '', type: 'done', stopReason })
      } catch (e) {
        emit({
          requestId: '',
          type: 'error',
          error: e instanceof Error ? e.message : String(e),
        })
      } finally {
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      'content-type': 'application/x-ndjson; charset=utf-8',
      'cache-control': 'no-cache, no-transform',
    },
  })
}
