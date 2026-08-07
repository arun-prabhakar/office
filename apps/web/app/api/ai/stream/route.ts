import { streamText, convertToModelMessages, type UIMessage } from 'ai'
import { createAnthropic } from '@ai-sdk/anthropic'

// The vendor key lives on the server only — it is never shipped to the browser.
// This is the keystone of the web migration: the Electron main-process AI calls
// (packages/ai-provider) become Next.js route handlers here, so model API keys
// stay server-side.
const anthropic = createAnthropic({
  apiKey: process.env.ANTHROPIC_API_KEY ?? '',
})

export async function POST(req: Request) {
  const { messages } = (await req.json()) as { messages: UIMessage[] }

  const result = streamText({
    model: anthropic(process.env.AI_MODEL ?? 'claude-sonnet-4-5'),
    system: 'You are a helpful assistant inside GenOffice on the web.',
    messages: convertToModelMessages(messages),
  })

  return result.toUIMessageStreamResponse()
}
