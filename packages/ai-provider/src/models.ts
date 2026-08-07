import { jsonSchema, tool, type LanguageModel, type ToolSet } from 'ai'
import { createAnthropic } from '@ai-sdk/anthropic'
import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { createOpenAI } from '@ai-sdk/openai'
import type { AgentToolDef } from '@prismoffice/agent-core'
import type { AiProviderConfig, AiProviderId } from './types'

/**
 * Resolve an AI SDK `LanguageModel` for a provider id + config.
 *
 * `apiKey`/`baseUrl` come from the per-provider settings (the apps own that
 * policy; nothing is hardcoded here). deepseek and custom are OpenAI-compatible,
 * so they reuse `createOpenAI` with a custom `baseURL`. The `name` option keeps
 * their telemetry/distinct from the real OpenAI provider.
 */
export function modelFor(provider: AiProviderId, config: AiProviderConfig): LanguageModel {
  switch (provider) {
    case 'anthropic':
      return createAnthropic({ apiKey: config.apiKey })(config.model)
    case 'gemini':
      return createGoogleGenerativeAI({ apiKey: config.apiKey })(config.model)
    case 'openai':
      // .chat() forces the Chat Completions sub-API (/chat/completions). The
      // provider's callable default targets the newer Responses API (/responses),
      // which DeepSeek/custom and other OpenAI-compatible endpoints do not support.
      return createOpenAI({ apiKey: config.apiKey }).chat(config.model)
    case 'deepseek':
      return createOpenAI({
        apiKey: config.apiKey,
        baseURL: 'https://api.deepseek.com/v1',
        name: 'deepseek',
      }).chat(config.model)
    case 'custom': {
      if (!config.baseUrl) throw new Error('A custom provider requires a Base URL')
      return createOpenAI({ apiKey: config.apiKey, baseURL: config.baseUrl, name: 'custom' }).chat(
        config.model,
      )
    }
    default:
      throw new Error(`Unknown provider: ${provider}`)
  }
}

/**
 * Build the AI SDK `tools` record from the agent-core tool definitions.
 *
 * Tools are passed WITHOUT an `execute` function, so the AI SDK surfaces tool
 * calls in the stream but never runs them — the agent loop (agent-core/loop.ts)
 * owns execution and the side-channel ToolDisplay/mutation reporting. Without
 * `stopWhen`, `streamText` is single-turn, matching the one-turn-per-call
 * contract the loop expects.
 *
 * `inputSchema` is a raw JSON Schema on our side; `jsonSchema()` wraps it for
 * the SDK (no Zod dependency needed).
 */
export function toolsFor(tools: readonly AgentToolDef[]): ToolSet {
  const out: ToolSet = {}
  for (const t of tools) {
    out[t.name] = tool({
      description: t.description,
      inputSchema: jsonSchema(t.inputSchema),
    })
  }
  return out
}
