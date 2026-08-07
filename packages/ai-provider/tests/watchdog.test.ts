import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AgentToolCall } from '@genoffice/agent-core'
import { streamForProvider } from '../src/stream'
import {
  AI_CONNECT_TIMEOUT_MS,
  AiTimeoutError,
  createStreamWatchdog,
} from '../src/watchdog'
import { okResponse, sseStream } from './test-utils'

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

/** promise that rejects when the given signal aborts (models a fetch/body read) */
function abortable(signal: AbortSignal): Promise<never> {
  return new Promise((_, reject) => {
    if (signal.aborted) reject(new Error('aborted'))
    signal.addEventListener('abort', () => reject(new Error('aborted')), { once: true })
  })
}

describe('createStreamWatchdog', () => {
  it('aborts and reports AiTimeoutError when nothing arrives within the connect timeout', async () => {
    const wd = createStreamWatchdog(undefined, 1_000, 5_000)
    const run = wd.guard(() => abortable(wd.signal))
    const result = expect(run).rejects.toBeInstanceOf(AiTimeoutError)
    await vi.advanceTimersByTimeAsync(1_000)
    await result
  })

  it('touch() switches to the idle timeout and re-arms it on every call', async () => {
    const wd = createStreamWatchdog(undefined, 1_000, 2_000)
    const run = wd.guard(() => abortable(wd.signal))
    const result = expect(run).rejects.toBeInstanceOf(AiTimeoutError)
    await vi.advanceTimersByTimeAsync(900)
    wd.touch() // data arrived: idle timeout from now on
    await vi.advanceTimersByTimeAsync(1_900)
    expect(wd.signal.aborted).toBe(false)
    wd.touch()
    await vi.advanceTimersByTimeAsync(1_900)
    expect(wd.signal.aborted).toBe(false)
    await vi.advanceTimersByTimeAsync(100)
    expect(wd.signal.aborted).toBe(true)
    await result
  })

  it('a caller abort propagates and keeps the original error (not AiTimeoutError)', async () => {
    const parent = new AbortController()
    const wd = createStreamWatchdog(parent.signal, 1_000, 1_000)
    const run = wd.guard(() => abortable(wd.signal))
    parent.abort()
    await expect(run).rejects.toThrow('aborted')
  })

  it('an already-aborted caller signal aborts immediately', () => {
    const parent = new AbortController()
    parent.abort()
    const wd = createStreamWatchdog(parent.signal)
    expect(wd.signal.aborted).toBe(true)
  })

  it('success resolves and disposes the timer (no abort after completion)', async () => {
    const wd = createStreamWatchdog(undefined, 1_000, 1_000)
    await expect(wd.guard(() => Promise.resolve('ok'))).resolves.toBe('ok')
    await vi.advanceTimersByTimeAsync(10_000)
    expect(wd.signal.aborted).toBe(false)
  })

  it('non-timeout errors pass through unchanged', async () => {
    const wd = createStreamWatchdog(undefined, 1_000, 1_000)
    await expect(wd.guard(() => Promise.reject(new Error('boom')))).rejects.toThrow('boom')
  })
})

describe('streamForProvider watchdog wiring', () => {
  // The watchdog's connect/idle timeout LOGIC is covered by the unit tests
  // above. These tests confirm streamForProvider wires the caller signal and
  // the onActivity keepalive into that watchdog. They use real timers: the
  // AI SDK's streamText async machinery does not cooperate with vitest fake
  // timers (an abort scheduled on a faked timer never propagates through the
  // SDK's promise chain), so timeout-driven paths are asserted at the watchdog
  // unit level, not re-driven end-to-end here.
  beforeEach(() => {
    vi.useRealTimers()
  })

  const collector = () => {
    const deltas: string[] = []
    return {
      deltas,
      cb: {
        signal: new AbortController().signal,
        onDelta: (text: string) => deltas.push(text),
        onToolCall: (_call: AgentToolCall) => {},
      },
    }
  }

  it('propagates a caller abort (the signal is wired into the watchdog + streamText)', async () => {
    const ctrl = new AbortController()
    // a fetch that never resolves on its own; only rejects once aborted
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation((_url: string, init: RequestInit) => abortable(init.signal!)),
    )
    const { cb } = collector()
    const run = streamForProvider(
      'anthropic',
      { apiKey: 'k', model: 'claude-sonnet-5' },
      'system',
      [{ role: 'user', text: 'hi' }],
      [],
      100,
      { ...cb, signal: ctrl.signal },
    )
    queueMicrotask(() => ctrl.abort())
    await expect(run).rejects.toThrow()
  })

  it('fires onActivity as stream parts arrive and emits deltas', async () => {
    const body = sseStream([
      'data: {"type":"message_start","message":{"id":"msg_1","type":"message","role":"assistant","model":"m","content":[],"stop_reason":null,"usage":{"input_tokens":1,"output_tokens":1}}}',
      'data: {"type":"content_block_start","index":0,"content_block":{"type":"text","text":""}}',
      'data: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"hi"}}',
      'data: {"type":"content_block_stop","index":0}',
      'data: {"type":"message_delta","delta":{"stop_reason":"end_turn"},"usage":{"output_tokens":1}}',
      'data: {"type":"message_stop"}',
    ])
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(okResponse(body)))
    const onActivity = vi.fn()
    const { deltas, cb } = collector()
    await streamForProvider(
      'anthropic',
      { apiKey: 'k', model: 'claude-sonnet-5' },
      'system',
      [{ role: 'user', text: 'hi' }],
      [],
      100,
      { ...cb, onActivity },
    )
    expect(deltas).toEqual(['hi'])
    expect(onActivity).toHaveBeenCalled()
  })
})
