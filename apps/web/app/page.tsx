'use client'

import { useChat } from '@ai-sdk/react'
import { DefaultChatTransport } from 'ai'

const transport = new DefaultChatTransport({ api: '/api/ai/stream' })

export default function Page() {
  const { messages, sendMessage, status, error } = useChat({ transport })

  return (
    <main style={{ maxWidth: 720, margin: '0 auto', padding: 24 }}>
      <h1>GenOffice web — AI proof (P0)</h1>
      <p style={{ color: '#666' }}>
        Server-side AI proxy + AI SDK streaming, end-to-end. Set <code>ANTHROPIC_API_KEY</code> to
        talk to a real model.
      </p>

      <ul style={{ listStyle: 'none', padding: 0 }}>
        {messages.map((m) => (
          <li
            key={m.id}
            style={{ margin: '8px 0', display: 'flex', gap: 8 }}
            data-role={m.role}
          >
            <strong style={{ minWidth: 64 }}>{m.role}:</strong>
            <span>
              {m.parts.map((p, i) =>
                p.type === 'text' ? <span key={i}>{p.text}</span> : null,
              )}
            </span>
          </li>
        ))}
      </ul>

      <form
        onSubmit={(e) => {
          e.preventDefault()
          const form = new FormData(e.currentTarget)
          const text = String(form.get('text') ?? '')
          if (text.trim()) sendMessage({ text })
          e.currentTarget.reset()
        }}
        style={{ display: 'flex', gap: 8, marginTop: 16 }}
      >
        <input
          name="text"
          placeholder="Ask the AI…"
          style={{ flex: 1, padding: 8 }}
          autoComplete="off"
        />
        <button type="submit" disabled={status !== 'ready'} style={{ padding: '8px 16px' }}>
          Send
        </button>
      </form>

      {error && <p style={{ color: 'crimson' }}>{error.message}</p>}
      <p style={{ color: '#999' }}>status: {status}</p>
    </main>
  )
}
