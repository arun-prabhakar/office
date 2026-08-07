import { afterEach, describe, expect, it, vi } from 'vitest'
import type { AgentToolCall } from '@prismoffice/agent-core'
import { AiCreditsError, streamForProvider } from '../src/stream'
import { okResponse, sseStream } from './test-utils'

afterEach(() => {
  vi.unstubAllGlobals()
})

function collector() {
  const deltas: string[] = []
  const toolCalls: AgentToolCall[] = []
  const stopReasons: string[] = []
  return {
    deltas,
    toolCalls,
    stopReasons,
    cb: {
      signal: new AbortController().signal,
      onDelta: (text: string) => deltas.push(text),
      onToolCall: (call: AgentToolCall) => toolCalls.push(call),
      onStopReason: (reason: string) => stopReasons.push(reason),
    },
  }
}

// The AI SDK's streamText rejects an empty messages array, so every turn below
// carries one user message — matching real use (the agent loop always pushes
// the user message before the first turn).
const ONE_USER = [{ role: 'user', text: 'hi' }] as const

// Protocol-complete Anthropic SSE building blocks; the AI SDK parser expects
// the message envelope (message_start) and a content_block_start before deltas.
const MSG_START =
  'data: {"type":"message_start","message":{"id":"msg_1","type":"message","role":"assistant","model":"m","content":[],"stop_reason":null,"stop_sequence":null,"usage":{"input_tokens":1,"output_tokens":1}}}'
const TEXT_BLOCK_START =
  'data: {"type":"content_block_start","index":0,"content_block":{"type":"text","text":""}}'
const TEXT_BLOCK_STOP = 'data: {"type":"content_block_stop","index":0}'
const STOP = (reason: string) =>
  `data: {"type":"message_delta","delta":{"stop_reason":"${reason}"},"usage":{"output_tokens":1}}`
const MSG_STOP = 'data: {"type":"message_stop"}'

describe('streamForProvider: anthropic', () => {
  it('emits text deltas and a normalized stop reason', async () => {
    const body = sseStream([
      MSG_START,
      TEXT_BLOCK_START,
      'data: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"hello "}}',
      'data: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"world"}}',
      TEXT_BLOCK_STOP,
      STOP('end_turn'),
      MSG_STOP,
    ])
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(okResponse(body)))
    const { deltas, stopReasons, cb } = collector()
    await streamForProvider(
      'anthropic',
      { apiKey: 'k', model: 'claude-sonnet-5' },
      'sys',
      [...ONE_USER],
      [],
      100,
      cb,
    )
    expect(deltas.join('')).toBe('hello world')
    expect(stopReasons).toEqual(['stop'])
  })

  it('emits a completed tool call (parsed input)', async () => {
    const body = sseStream([
      MSG_START,
      'data: {"type":"content_block_start","index":0,"content_block":{"type":"tool_use","id":"t1","name":"do_thing"}}',
      'data: {"type":"content_block_delta","index":0,"delta":{"type":"input_json_delta","partial_json":"{\\"a\\":1}"}}',
      'data: {"type":"content_block_stop","index":0}',
      STOP('end_turn'),
      MSG_STOP,
    ])
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(okResponse(body)))
    const { toolCalls, cb } = collector()
    await streamForProvider('anthropic', { apiKey: 'k', model: 'm' }, 'sys', [...ONE_USER], [], 100, cb)
    expect(toolCalls).toEqual([{ id: 't1', name: 'do_thing', input: { a: 1 } }])
  })

  it('max_tokens marks the last tool call truncated and reports max_tokens', async () => {
    const body = sseStream([
      MSG_START,
      'data: {"type":"content_block_start","index":0,"content_block":{"type":"tool_use","id":"t1","name":"gen"}}',
      'data: {"type":"content_block_delta","index":0,"delta":{"type":"input_json_delta","partial_json":"{\\"x\\": \\"trunc"}}',
      'data: {"type":"content_block_stop","index":0}',
      STOP('max_tokens'),
      MSG_STOP,
    ])
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(okResponse(body)))
    const { toolCalls, stopReasons, cb } = collector()
    await streamForProvider('anthropic', { apiKey: 'k', model: 'm' }, 'sys', [...ONE_USER], [], 100, cb)
    expect(stopReasons).toEqual(['max_tokens'])
    expect(toolCalls[0]!.truncated).toBe(true)
  })

  it('a genuine empty closing turn (stop, no content) succeeds', async () => {
    const body = sseStream([MSG_START, STOP('end_turn'), MSG_STOP])
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(okResponse(body)))
    const { cb } = collector()
    await expect(
      streamForProvider('anthropic', { apiKey: 'k', model: 'm' }, 'sys', [...ONE_USER], [], 100, cb),
    ).resolves.toBeUndefined()
  })

  it('throws on a non-ok HTTP response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('bad key', { status: 401 })))
    const { cb } = collector()
    await expect(
      streamForProvider('anthropic', { apiKey: 'k', model: 'm' }, 'sys', [...ONE_USER], [], 100, cb),
    ).rejects.toThrow()
  })

  it('detects a credits-exhausted error and throws AiCreditsError', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            type: 'error',
            error: { type: 'invalid_request_error', message: 'Your credit balance is too low.' },
          }),
          { status: 400, headers: { 'content-type': 'application/json' } },
        ),
      ),
    )
    const { cb } = collector()
    await expect(
      streamForProvider('anthropic', { apiKey: 'k', model: 'm' }, 'sys', [...ONE_USER], [], 100, cb),
    ).rejects.toBeInstanceOf(AiCreditsError)
  })
})

describe('streamForProvider: openai-compatible', () => {
  it('emits text and reassembles a fragmented tool call', async () => {
    const body = sseStream([
      'data: {"choices":[{"index":0,"delta":{"content":"partial "}}]}',
      'data: {"choices":[{"index":0,"delta":{"tool_calls":[{"index":0,"id":"c1","function":{"name":"replace"}}]}}]}',
      'data: {"choices":[{"index":0,"delta":{"tool_calls":[{"index":0,"function":{"arguments":"{\\"x\\":1}"}}]}}]}',
      'data: {"choices":[{"index":0,"delta":{},"finish_reason":"tool_calls"}]}',
      'data: [DONE]',
    ])
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(okResponse(body)))
    const { deltas, toolCalls, cb } = collector()
    await streamForProvider(
      'openai',
      { apiKey: 'k', model: 'gpt-4.1-mini' },
      'sys',
      [...ONE_USER],
      [],
      100,
      cb,
    )
    expect(deltas.join('')).toBe('partial ')
    expect(toolCalls).toEqual([{ id: 'c1', name: 'replace', input: { x: 1 } }])
  })

  it("finish_reason 'length' normalizes to max_tokens and truncates the tool call", async () => {
    const body = sseStream([
      'data: {"choices":[{"index":0,"delta":{"tool_calls":[{"index":0,"id":"c1","function":{"name":"replace","arguments":"{\\"x\\":1}"}}]}}]}',
      'data: {"choices":[{"index":0,"delta":{},"finish_reason":"length"}]}',
      'data: [DONE]',
    ])
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(okResponse(body)))
    const { toolCalls, stopReasons, cb } = collector()
    await streamForProvider('openai', { apiKey: 'k', model: 'm' }, 'sys', [...ONE_USER], [], 100, cb)
    expect(stopReasons).toEqual(['max_tokens'])
    expect(toolCalls[0]!.truncated).toBe(true)
  })

  it('routes deepseek to its fixed base URL (chat completions, not responses)', async () => {
    const fetchMock = vi.fn().mockResolvedValue(okResponse(sseStream(['data: [DONE]'])))
    vi.stubGlobal('fetch', fetchMock)
    const { cb } = collector()
    await streamForProvider(
      'deepseek',
      { apiKey: 'k', model: 'deepseek-chat' },
      'sys',
      [...ONE_USER],
      [],
      100,
      cb,
    ).catch(() => {})
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.deepseek.com/v1/chat/completions',
      expect.anything(),
    )
  })

  it('uses the configured base URL for the custom provider', async () => {
    const fetchMock = vi.fn().mockResolvedValue(okResponse(sseStream(['data: [DONE]'])))
    vi.stubGlobal('fetch', fetchMock)
    const { cb } = collector()
    await streamForProvider(
      'custom',
      { apiKey: 'k', model: 'm', baseUrl: 'https://my-endpoint.example.com/v1' },
      'sys',
      [...ONE_USER],
      [],
      100,
      cb,
    ).catch(() => {})
    expect(fetchMock).toHaveBeenCalledWith(
      'https://my-endpoint.example.com/v1/chat/completions',
      expect.anything(),
    )
  })

  it('rejects the custom provider without a base URL, without ever calling fetch', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    const { cb } = collector()
    await expect(
      streamForProvider('custom', { apiKey: 'k', model: 'm' }, 'sys', [...ONE_USER], [], 100, cb),
    ).rejects.toThrow(/Base URL/)
    expect(fetchMock).not.toHaveBeenCalled()
  })
})

describe('streamForProvider: gemini', () => {
  it('emits text and a whole (non-partial) function call', async () => {
    const body = sseStream([
      'data: {"candidates":[{"content":{"parts":[{"text":"hi there"}]}}]}',
      'data: {"candidates":[{"content":{"parts":[{"functionCall":{"name":"set_cell","args":{"a1":"42"}}}]}}]}',
      'data: {"candidates":[{"finishReason":"STOP"}]}',
    ])
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(okResponse(body)))
    const { deltas, toolCalls, cb } = collector()
    await streamForProvider(
      'gemini',
      { apiKey: 'k', model: 'gemini-2.5-flash' },
      'sys',
      [...ONE_USER],
      [],
      100,
      cb,
    )
    expect(deltas.join('')).toBe('hi there')
    expect(toolCalls[0]).toMatchObject({ name: 'set_cell', input: { a1: '42' } })
  })
})

it('rejects an unknown provider id', async () => {
  const { cb } = collector()
  await expect(
    streamForProvider('unknown' as never, { apiKey: 'k', model: 'm' }, 'sys', [...ONE_USER], [], 100, cb),
  ).rejects.toThrow(/Unknown provider/)
})
