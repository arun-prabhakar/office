import { describe, expect, it } from 'vitest'
import type { AgentMessage } from '@prismoffice/agent-core'
import { toCoreMessages } from '../src/messages'

const IMAGE = { base64: 'aGVsbG8=', mime: 'image/png' }

describe('toCoreMessages: user images', () => {
  it('upgrades to a text + image parts array when images are present', () => {
    const msgs = toCoreMessages([{ role: 'user', text: 'look at this', images: [IMAGE] }])
    expect((msgs[0] as { content: unknown }).content).toEqual([
      { type: 'text', text: 'look at this' },
      { type: 'image', image: expect.any(Uint8Array), mediaType: 'image/png' },
    ])
  })

  it('omits the text part when text is empty', () => {
    const msgs = toCoreMessages([{ role: 'user', text: '', images: [IMAGE] }])
    const content = (msgs[0] as { content: unknown[] }).content
    expect(content).toHaveLength(1)
    expect((content[0] as { type: string }).type).toBe('image')
  })

  it('keeps plain string content when no images', () => {
    const msgs = toCoreMessages([{ role: 'user', text: 'hi' } as AgentMessage])
    expect((msgs[0] as { content: unknown }).content).toBe('hi')
  })
})

describe('toCoreMessages: assistant turns', () => {
  it('maps text + tool calls to text and tool-call parts', () => {
    const msgs = toCoreMessages([
      {
        role: 'assistant',
        text: 'ok',
        toolCalls: [{ id: 't1', name: 'do_thing', input: { a: 1 } }],
      },
    ])
    expect((msgs[0] as { content: unknown }).content).toEqual([
      { type: 'text', text: 'ok' },
      { type: 'tool-call', toolCallId: 't1', toolName: 'do_thing', input: { a: 1 } },
    ])
  })

  it('an assistant turn with no text and no tools still gets a placeholder part', () => {
    const msgs = toCoreMessages([{ role: 'assistant', text: '' } as AgentMessage])
    expect((msgs[0] as { content: unknown }).content).toEqual([
      { type: 'text', text: '(no content)' },
    ])
  })
})

describe('toCoreMessages: tool results', () => {
  it('becomes tool-result parts; output wraps as text or error-text by isError', () => {
    const msgs = toCoreMessages([
      {
        role: 'tool',
        results: [
          { id: 't1', name: 'do_thing', output: 'done' },
          { id: 't2', name: 'do_thing', output: 'boom', isError: true },
        ],
      },
    ])
    expect((msgs[0] as { content: unknown }).content).toEqual([
      {
        type: 'tool-result',
        toolCallId: 't1',
        toolName: 'do_thing',
        output: { type: 'text', value: 'done' },
      },
      {
        type: 'tool-result',
        toolCallId: 't2',
        toolName: 'do_thing',
        output: { type: 'error-text', value: 'boom' },
      },
    ])
  })
})
