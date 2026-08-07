'use client'

import { useMemo, useRef, useState } from 'react'
import { AgentLoop, composeSkills, type AgentSkill } from '@genoffice/agent-core'
import { createFetchTransport } from '@/lib/fetch-transport'

// P1 proof: a tool-calling AgentLoop running entirely in the browser over the
// web transport (server only proxies the model call). The `set_title` tool
// executes client-side and mutates component state — exactly how the docs AI
// panel will drive the Tiptap editor.
export default function Page() {
  const [reply, setReply] = useState('')
  const [title, setTitle] = useState('(unset)')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const loopRef = useRef<AgentLoop | null>(null)

  const skill = useMemo<AgentSkill>(
    () =>
      composeSkills('demo', 'You are a brief demo agent running in the browser over HTTP/SSE.', [
        {
          id: 'demo',
          systemPrompt:
            'You have one tool: set_title. When asked to title something, call set_title with a short title, then reply in one short sentence confirming.',
          tools: [
            {
              name: 'set_title',
              description: 'Record a title for the current document.',
              inputSchema: {
                type: 'object',
                properties: { title: { type: 'string', description: 'The title text' } },
                required: ['title'],
              },
            },
          ],
          executeTool: (call) => {
            const t = String((call.input as { title?: unknown }).title ?? '')
            setTitle(t)
            return { output: `title set to "${t}"`, summary: 'set_title' }
          },
        },
      ]),
    [],
  )

  const run = (instruction: string) => {
    setErr('')
    setReply('')
    setBusy(true)
    if (!loopRef.current) {
      loopRef.current = new AgentLoop({
        transport: createFetchTransport(),
        skill,
        events: {
          onText: (t) => setReply(t),
          onDone: () => setBusy(false),
          onError: (e) => {
            setErr(e)
            setBusy(false)
          },
        },
      })
    }
    loopRef.current.run(instruction)
  }

  return (
    <main style={{ maxWidth: 720, margin: '0 auto', padding: 24 }}>
      <h1>Agent-over-web demo (P1)</h1>
      <p style={{ color: '#666' }}>
        A tool-calling <code>AgentLoop</code> runs in the browser; the server only proxies the model
        call (key stays server-side). Set <code>ANTHROPIC_API_KEY</code> to run for real.
      </p>

      <p>
        current title: <strong>{title}</strong>
      </p>

      <div style={{ display: 'flex', gap: 8 }}>
        <button disabled={busy} onClick={() => run('Give this document a title about the ocean.')}>
          “title about the ocean”
        </button>
        <button disabled={busy} onClick={() => run('Set the title to "Quarterly Report".')}>
          “Quarterly Report”
        </button>
      </div>

      <h3>Reply</h3>
      <div style={{ background: '#fff', border: '1px solid #ddd', padding: 12, minHeight: 48 }}>
        {reply || (busy ? '…' : '(no run yet)')}
      </div>
      {err && <p style={{ color: 'crimson' }}>{err}</p>}
    </main>
  )
}
