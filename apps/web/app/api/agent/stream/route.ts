import { streamForProvider, type AiStreamChunk } from '@prismoffice/ai-provider'
import type { AgentMessage, AgentToolDef } from '@prismoffice/agent-core'

const encoder = new TextEncoder()

export async function POST(req: Request) {
  if (process.env.NEXT_PUBLIC_AI_ENABLED === 'false')
    return Response.json({ error: 'AI features are disabled' }, { status: 503 })
  const { system, messages, tools, maxTokens } = (await req.json()) as {
    system: string; messages: AgentMessage[]; tools: AgentToolDef[]; maxTokens?: number
  }
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const emit = (chunk: AiStreamChunk) => controller.enqueue(encoder.encode(JSON.stringify(chunk) + '\n'))
      let stopReason: string | undefined
      try {
        await streamForProvider('anthropic', { apiKey: process.env.ANTHROPIC_API_KEY ?? '', model: process.env.AI_MODEL ?? 'claude-sonnet-4-5' }, system, messages, tools, maxTokens ?? 8192, {
          onDelta: (text) => emit({ requestId: '', type: 'delta', text }),
          onToolCall: (toolCall) => emit({ requestId: '', type: 'tool-call', toolCall }),
          onStopReason: (reason) => { stopReason = reason },
          signal: req.signal,
        })
        emit({ requestId: '', type: 'done', stopReason })
      } catch (e) {
        emit({ requestId: '', type: 'error', error: e instanceof Error ? e.message : String(e) })
      } finally { controller.close() }
    },
  })
  return new Response(stream, { headers: { 'content-type': 'application/x-ndjson; charset=utf-8', 'cache-control': 'no-cache, no-transform' } })
}
