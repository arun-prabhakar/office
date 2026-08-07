'use client'

import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { Markdown } from '@tiptap/markdown'
import { useRef, useState } from 'react'
import { AgentLoop, composeSkills, type AgentSkill } from '@prismoffice/agent-core'
import { createFetchTransport } from '@/lib/fetch-transport'

export default function Page() {
  const editor = useEditor({
    extensions: [StarterKit, Markdown],
    content: '# New document\n\nStart writing…',
  })
  const [name, setName] = useState('untitled.md')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  // AI panel state
  const [reply, setReply] = useState('')
  const [aiBusy, setAiBusy] = useState(false)
  const [activity, setActivity] = useState('')
  const loopRef = useRef<AgentLoop | null>(null)

  const open = async (file: File) => {
    setBusy(true)
    setErr('')
    const form = new FormData()
    form.append('file', file)
    try {
      const res = await fetch('/api/md/open', { method: 'POST', body: form })
      const j = (await res.json()) as { ok: boolean; name?: string; text?: string; error?: string }
      if (j.ok && j.text !== undefined) {
        setName(j.name ?? file.name)
        editor?.commands.setContent(j.text, { contentType: 'markdown' })
      } else {
        setErr(j.error ?? 'open failed')
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  const save = async () => {
    setErr('')
    const md = editor?.getMarkdown() ?? ''
    const form = new FormData()
    form.append('text', md)
    form.append('name', name)
    const res = await fetch('/api/md/save', { method: 'POST', body: form })
    if (!res.ok) {
      setErr(`save HTTP ${res.status}`)
      return
    }
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = name
    a.click()
    URL.revokeObjectURL(url)
  }

  const runAi = (instruction: string) => {
    if (!editor) return
    setReply('')
    setActivity('')
    setAiBusy(true)
    if (!loopRef.current) {
      const skill: AgentSkill = composeSkills(
        'markdown-web',
        'You help the user write and edit a markdown document in the browser.',
        [
          {
            id: 'md',
            systemPrompt:
              'You can append a section to the document via append_section(heading, body). Use it whenever the user asks you to add or write content; then reply in one short sentence confirming.',
            tools: [
              {
                name: 'append_section',
                description: 'Append a section (a heading and its body paragraphs) to the document.',
                inputSchema: {
                  type: 'object',
                  properties: {
                    heading: { type: 'string', description: 'Section heading (no leading ##)' },
                    body: { type: 'string', description: 'Section body in markdown' },
                  },
                  required: ['heading', 'body'],
                },
              },
            ],
            executeTool: (call) => {
              const input = call.input as { heading?: string; body?: string }
              const cur = editor.getMarkdown()
              editor.commands.setContent(
                `${cur}\n\n## ${input.heading ?? ''}\n\n${input.body ?? ''}\n`,
                { contentType: 'markdown' },
              )
              return { output: `appended section "${input.heading ?? ''}"`, summary: 'append_section' }
            },
          },
        ],
      )
      loopRef.current = new AgentLoop({
        transport: createFetchTransport(),
        skill,
        events: {
          onText: (t) => setReply(t),
          onToolExecuted: (e) => setActivity(e.execution.output),
          onDone: () => setAiBusy(false),
          onError: (e) => {
            setErr(e)
            setAiBusy(false)
          },
        },
      })
    }
    loopRef.current.run(instruction)
  }

  const btn = (label: string, onClick: () => void, active?: boolean) => (
    <button
      type="button"
      onClick={onClick}
      style={{
        fontWeight: 600,
        padding: '4px 8px',
        background: active ? '#e0e7ff' : 'transparent',
        border: '1px solid #ddd',
        borderRadius: 4,
        cursor: 'pointer',
      }}
      dangerouslySetInnerHTML={{ __html: label }}
    />
  )

  return (
    <main style={{ maxWidth: 820, margin: '0 auto', padding: 24 }}>
      <h1>Markdown editor (web)</h1>
      <p style={{ color: '#666' }}>
        Tiptap editor + AI panel in the browser. Load/save .md via the server; the AI appends
        sections through a tool (over the FetchTransport / agent loop).
      </p>

      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
        <input
          type="file"
          accept=".md,.markdown,.txt"
          disabled={busy}
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) void open(f)
          }}
        />
        <input value={name} onChange={(e) => setName(e.target.value)} style={{ flex: 1, padding: 4 }} />
        <button type="button" onClick={save} style={{ padding: '4px 12px' }}>
          Save .md
        </button>
      </div>

      {editor && (
        <div style={{ display: 'flex', gap: 4, marginBottom: 8 }}>
          {btn('B', () => editor.chain().focus().toggleBold().run(), editor.isActive('bold'))}
          {btn('<i>I</i>', () => editor.chain().focus().toggleItalic().run(), editor.isActive('italic'))}
          {btn('H1', () => editor.chain().focus().toggleHeading({ level: 1 }).run(), editor.isActive('heading', { level: 1 }))}
          {btn('H2', () => editor.chain().focus().toggleHeading({ level: 2 }).run(), editor.isActive('heading', { level: 2 }))}
          {btn('•', () => editor.chain().focus().toggleBulletList().run(), editor.isActive('bulletList'))}
          {btn('1.', () => editor.chain().focus().toggleOrderedList().run(), editor.isActive('orderedList'))}
          {btn('&ldquo;&rdquo;', () => editor.chain().focus().toggleBlockquote().run(), editor.isActive('blockquote'))}
          {btn('&lt;/&gt;', () => editor.chain().focus().toggleCodeBlock().run(), editor.isActive('codeBlock'))}
        </div>
      )}

      <div
        style={{
          background: '#fff',
          border: '1px solid #ddd',
          padding: '16px 24px',
          minHeight: 320,
          lineHeight: 1.6,
        }}
      >
        <EditorContent editor={editor} />
      </div>

      {busy && <p>loading…</p>}
      {err && <p style={{ color: 'crimson' }}>{err}</p>}

      {/* AI panel */}
      <section
        style={{
          marginTop: 24,
          padding: 16,
          background: '#f6f7f9',
          border: '1px solid #e0e0e0',
          borderRadius: 8,
        }}
      >
        <h3 style={{ marginTop: 0 }}>AI</h3>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            const form = new FormData(e.currentTarget)
            const text = String(form.get('prompt') ?? '')
            if (text.trim()) runAi(text.trim())
            e.currentTarget.reset()
          }}
          style={{ display: 'flex', gap: 8 }}
        >
          <input
            name="prompt"
            placeholder='e.g. "Add a section about coffee brewing methods"'
            style={{ flex: 1, padding: 8 }}
            autoComplete="off"
          />
          <button type="submit" disabled={aiBusy} style={{ padding: '8px 16px' }}>
            {aiBusy ? '…' : 'Send'}
          </button>
        </form>
        {activity && <p style={{ color: '#555', fontStyle: 'italic' }}>↳ {activity}</p>}
        {reply && <p style={{ background: '#fff', padding: 8, borderRadius: 4 }}>{reply}</p>}
        <p style={{ color: '#999', fontSize: 12 }}>
          Set <code>ANTHROPIC_API_KEY</code> server-side for live AI; the agent calls{' '}
          <code>append_section</code> which edits the document above.
        </p>
      </section>
    </main>
  )
}
