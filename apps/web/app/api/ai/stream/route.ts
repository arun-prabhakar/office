import { streamText, convertToModelMessages, type UIMessage } from 'ai'
import { createAnthropic } from '@ai-sdk/anthropic'

const anthropic = createAnthropic({ apiKey: process.env.ANTHROPIC_API_KEY ?? '' })

export async function POST(req: Request) {
  if (process.env.NEXT_PUBLIC_AI_ENABLED === 'false')
    return Response.json({ error: 'AI features are disabled' }, { status: 503 })
  const { messages } = (await req.json()) as { messages: UIMessage[] }
  const result = streamText({
    model: anthropic(process.env.AI_MODEL ?? 'claude-sonnet-4-5'),
    system: 'You are a helpful assistant inside PrismOffice on the web.',
    messages: convertToModelMessages(messages),
  })
  return result.toUIMessageStreamResponse()
}
