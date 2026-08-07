import { afterEach, describe, expect, it, vi } from 'vitest'
import { chatForProvider } from '../src/chat'
import { errorResponse, jsonResponse } from './test-utils'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('chatForProvider', () => {
  it('anthropic: extracts joined text content blocks', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        jsonResponse({
          id: 'msg_1',
          type: 'message',
          role: 'assistant',
          model: 'claude-sonnet-5',
          content: [
            { type: 'text', text: 'hello ' },
            { type: 'text', text: 'world' },
          ],
          stop_reason: 'end_turn',
          usage: { input_tokens: 1, output_tokens: 2 },
        }),
      ),
    )
    const result = await chatForProvider(
      'anthropic',
      { apiKey: 'k', model: 'claude-sonnet-5' },
      'sys',
      'hi',
    )
    expect(result).toEqual({ ok: true, content: 'hello world' })
  })

  it('gemini: extracts joined parts text', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          jsonResponse({ candidates: [{ content: { parts: [{ text: 'hi there' }] } }] }),
        ),
    )
    const result = await chatForProvider(
      'gemini',
      { apiKey: 'k', model: 'gemini-2.5-flash' },
      'sys',
      'hi',
    )
    expect(result).toEqual({ ok: true, content: 'hi there' })
  })

  it('openai: extracts message content', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(jsonResponse({ choices: [{ index: 0, message: { content: 'ok' } }] })),
    )
    const result = await chatForProvider(
      'openai',
      { apiKey: 'k', model: 'gpt-4.1-mini' },
      'sys',
      'hi',
    )
    expect(result).toEqual({ ok: true, content: 'ok' })
  })

  it('surfaces an HTTP error as ok:false with a message', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(errorResponse(401, 'bad key')))
    const result = await chatForProvider('anthropic', { apiKey: 'k', model: 'm' }, 'sys', 'hi')
    expect(result.ok).toBe(false)
    expect(result.error).toBeTruthy()
  })

  it('deepseek hits its fixed base URL', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse({ choices: [{ message: { content: 'ok' } }] }))
    vi.stubGlobal('fetch', fetchMock)
    await chatForProvider('deepseek', { apiKey: 'k', model: 'deepseek-chat' }, 'sys', 'hi')
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.deepseek.com/v1/chat/completions',
      expect.anything(),
    )
  })

  it('custom uses the configured base URL', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse({ choices: [{ message: { content: 'ok' } }] }))
    vi.stubGlobal('fetch', fetchMock)
    await chatForProvider(
      'custom',
      { apiKey: 'k', model: 'm', baseUrl: 'https://my-endpoint.example.com/v1' },
      'sys',
      'hi',
    )
    expect(fetchMock).toHaveBeenCalledWith(
      'https://my-endpoint.example.com/v1/chat/completions',
      expect.anything(),
    )
  })

  it('custom rejects without a base URL, without calling fetch', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    const result = await chatForProvider('custom', { apiKey: 'k', model: 'm' }, 'sys', 'hi')
    expect(result).toEqual({ ok: false, error: 'A custom provider requires a Base URL' })
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
