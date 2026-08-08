'use client'

import { useEditor, EditorContent } from '@tiptap/react'
import { useState, useRef, useCallback } from 'react'
import { editorExtensions } from '@/lib/docx-editor/extensions'
import { blocksToPmDoc, pmDocToSavePlan, type PmNode } from '@/lib/docx-editor/convert'
import type { Block } from '@prismoffice/docx-engine'

export default function Page() {
  const editor = useEditor({
    extensions: editorExtensions,
    content: '',
    editorProps: { attributes: { style: 'outline: none; min-height: 400px' } },
  })
  const [name, setName] = useState('untitled.docx')
  const [file, setFile] = useState<File | null>(null)
  const [originalBlocks, setOriginalBlocks] = useState<Block[] | null>(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const fileRef = useRef<File | null>(null)

  const open = async (f: File) => {
    setBusy(true)
    setErr('')
    fileRef.current = f
    setFile(f)
    setName(f.name)
    const form = new FormData()
    form.append('file', f)
    try {
      const res = await fetch('/api/docs/open', { method: 'POST', body: form })
      const j = (await res.json()) as { ok: boolean; blocks?: Block[]; error?: string }
      if (j.ok && j.blocks) {
        setOriginalBlocks(j.blocks)
        const pmDoc = blocksToPmDoc(j.blocks)
        editor?.commands.setContent(pmDoc as unknown as Record<string, unknown>)
      } else setErr(j.error ?? 'parse failed')
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  const save = async () => {
    if (!fileRef.current || !editor || !originalBlocks) return
    setBusy(true)
    setErr('')
    try {
      const pmDoc = editor.getJSON() as unknown as PmNode
      const plan = pmDocToSavePlan(pmDoc, originalBlocks)
      const finalBlocks = (plan as unknown as { finalBlocks: unknown[] }).finalBlocks
      const form = new FormData()
      form.append('file', fileRef.current)
      form.append('finalBlocks', JSON.stringify(finalBlocks ?? []))
      const res = await fetch('/api/docs/save', { method: 'POST', body: form })
      if (!res.ok) {
        const j = await res.json().catch(() => null)
        throw new Error(j?.error ?? `HTTP ${res.status}`)
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = name
      a.click()
      URL.revokeObjectURL(url)
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  const btn = useCallback(
    (label: string, cmd: () => void, active?: boolean, html = false) => (
      <button
        type="button"
        onMouseDown={(e) => {
          e.preventDefault()
          cmd()
        }}
        style={{
          minWidth: 32,
          height: 32,
          padding: '0 6px',
          cursor: 'pointer',
          border: '1px solid #ccc',
          borderRadius: 4,
          background: active ? '#e0e7ff' : '#fff',
          fontWeight: 600,
          fontSize: 13,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
        {...(html ? { dangerouslySetInnerHTML: { __html: label } } : { children: label })}
      />
    ),
    [],
  )

  return (
    <div style={{ minHeight: '100vh', background: '#f0f0f0' }}>
      {/* Top bar */}
      <header
        style={{
          background: '#1a1a2e',
          color: '#fff',
          padding: '8px 24px',
          display: 'flex',
          alignItems: 'center',
          gap: 16,
        }}
      >
        <a href="/" style={{ color: '#aaa', textDecoration: 'none', fontSize: 14 }}>
          ← Home
        </a>
        <strong style={{ fontSize: 16 }}>PrismOffice Docs</strong>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          style={{
            flex: 1,
            padding: '4px 8px',
            borderRadius: 4,
            border: 'none',
            background: '#2a2a4e',
            color: '#fff',
          }}
        />
        <input
          type="file"
          accept=".docx"
          disabled={busy}
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) void open(f)
          }}
          style={{ display: 'none' }}
          id="file-input"
        />
        <label
          htmlFor="file-input"
          style={{
            padding: '4px 12px',
            background: '#3a3a6e',
            borderRadius: 4,
            cursor: 'pointer',
            fontSize: 14,
          }}
        >
          Open
        </label>
        <button
          onClick={save}
          disabled={busy || !file}
          style={{
            padding: '4px 16px',
            background: '#4a4aae',
            color: '#fff',
            border: 'none',
            borderRadius: 4,
            cursor: 'pointer',
            fontSize: 14,
          }}
        >
          {busy ? '…' : 'Save .docx'}
        </button>
      </header>

      {/* Formatting toolbar */}
      {editor && (
        <div
          style={{
            background: '#fff',
            borderBottom: '1px solid #ddd',
            padding: '6px 24px',
            display: 'flex',
            gap: 4,
            flexWrap: 'wrap',
            alignItems: 'center',
          }}
        >
          {btn('B', () => editor.chain().focus().toggleBold().run(), editor.isActive('bold'))}
          {btn(
            '<i>I</i>',
            () => editor.chain().focus().toggleItalic().run(),
            editor.isActive('italic'),
            true,
          )}
          {btn(
            '<u>U</u>',
            () => editor.chain().focus().toggleUnderline().run(),
            editor.isActive('underline'),
            true,
          )}
          {btn(
            '<s>S</s>',
            () => editor.chain().focus().toggleStrike().run(),
            editor.isActive('strike'),
            true,
          )}
          <span style={{ width: 1, height: 24, background: '#ddd', margin: '0 4px' }} />
          {btn(
            'H1',
            () => editor.chain().focus().toggleHeading({ level: 1 }).run(),
            editor.isActive('heading', { level: 1 }),
          )}
          {btn(
            'H2',
            () => editor.chain().focus().toggleHeading({ level: 2 }).run(),
            editor.isActive('heading', { level: 2 }),
          )}
          {btn(
            'H3',
            () => editor.chain().focus().toggleHeading({ level: 3 }).run(),
            editor.isActive('heading', { level: 3 }),
          )}
          <span style={{ width: 1, height: 24, background: '#ddd', margin: '0 4px' }} />
          {btn(
            '•',
            () => editor.chain().focus().toggleBulletList().run(),
            editor.isActive('bulletList'),
          )}
          {btn(
            '1.',
            () => editor.chain().focus().toggleOrderedList().run(),
            editor.isActive('orderedList'),
          )}
          {btn(
            '☑',
            () => editor.chain().focus().toggleTaskList?.().run?.(),
            editor.isActive('taskList'),
          )}
          {btn(
            '❝',
            () => editor.chain().focus().toggleBlockquote().run(),
            editor.isActive('blockquote'),
          )}
          {btn(
            '</>',
            () => editor.chain().focus().toggleCodeBlock().run(),
            editor.isActive('codeBlock'),
          )}
          <span style={{ width: 1, height: 24, background: '#ddd', margin: '0 4px' }} />
          {btn(
            'H',
            () => editor.chain().focus().toggleMark('highlight').run(),
            editor.isActive('highlight'),
          )}
          {btn(
            '🔗',
            () => {
              const url = window.prompt('Link URL:')
              if (url) editor.chain().focus().setLink({ href: url }).run()
            },
            editor.isActive('link'),
          )}
          {btn('⊞', () =>
            editor
              .chain()
              .focus()
              .insertContent(
                '<table><tr><td></td><td></td></tr><tr><td></td><td></td></tr></table>',
              )
              .run(),
          )}
          <span style={{ width: 1, height: 24, background: '#ddd', margin: '0 4px' }} />
          {btn('⤺', () => editor.chain().focus().undo().run())}
          {btn('⤻', () => editor.chain().focus().redo().run())}
        </div>
      )}

      {/* Status */}
      {err && (
        <div style={{ background: '#fee', color: '#c00', padding: '8px 24px', fontSize: 14 }}>
          {err}
        </div>
      )}

      {/* Editor */}
      <div
        style={{
          maxWidth: 820,
          margin: '24px auto',
          background: '#fff',
          boxShadow: '0 1px 4px rgba(0,0,0,0.1)',
          minHeight: '70vh',
        }}
      >
        <div
          style={{
            padding: '40px 60px',
            fontSize: '11pt',
            lineHeight: 1.6,
            fontFamily: 'Calibri, Arial, sans-serif',
          }}
        >
          <EditorContent editor={editor} />
        </div>
      </div>
    </div>
  )
}
