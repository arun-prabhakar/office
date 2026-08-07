'use client'

import { useEditor, EditorContent } from '@tiptap/react'
import { useState, useRef } from 'react'
import { editorExtensions } from '@/lib/docx-editor/extensions'
import { blocksToPmDoc, pmDocToSavePlan, type PmNode } from '@/lib/docx-editor/convert'
import type { Block } from '@prismoffice/docx-engine'

export default function Page() {
  const editor = useEditor({ extensions: editorExtensions, content: '' })
  const [name, setName] = useState('untitled.docx')
  const [file, setFile] = useState<File | null>(null)
  const [originalBlocks, setOriginalBlocks] = useState<Block[] | null>(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const fileRef = useRef<File | null>(null)

  const open = async (f: File) => {
    setBusy(true); setErr('')
    fileRef.current = f; setFile(f); setName(f.name)
    const form = new FormData(); form.append('file', f)
    try {
      const res = await fetch('/api/docs/open', { method: 'POST', body: form })
      const j = (await res.json()) as { ok: boolean; blocks?: Block[]; error?: string }
      if (j.ok && j.blocks) {
        setOriginalBlocks(j.blocks)
        const pmDoc = blocksToPmDoc(j.blocks)
        editor?.commands.setContent(pmDoc as unknown as Record<string, unknown>)
      } else setErr(j.error ?? 'parse failed')
    } catch (e) { setErr(e instanceof Error ? e.message : String(e)) }
    finally { setBusy(false) }
  }

  const save = async () => {
    if (!fileRef.current || !editor || !originalBlocks) return
    setBusy(true); setErr('')
    try {
      const pmDoc = editor.getJSON() as unknown as PmNode
      const plan = pmDocToSavePlan(pmDoc, originalBlocks)
      const finalBlocks = (plan as unknown as { finalBlocks: unknown[] }).finalBlocks
      const form = new FormData()
      form.append('file', fileRef.current)
      form.append('finalBlocks', JSON.stringify(finalBlocks ?? []))
      const res = await fetch('/api/docs/save', { method: 'POST', body: form })
      if (!res.ok) { const j = await res.json().catch(() => null); throw new Error(j?.error ?? `HTTP ${res.status}`) }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a'); a.href = url; a.download = name; a.click()
      URL.revokeObjectURL(url)
    } catch (e) { setErr(e instanceof Error ? e.message : String(e)) }
    finally { setBusy(false) }
  }

  return (
    <main style={{ maxWidth: 820, margin: '0 auto', padding: 24 }}>
      <h1>Docs editor (web) — PrismOffice</h1>
      <p style={{ color: '#666' }}>
        Full Tiptap block editor with byte-preserving docx round-trip (ported from the desktop editor).
      </p>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12 }}>
        <input type="file" accept=".docx" disabled={busy} onChange={(e) => { const f = e.target.files?.[0]; if (f) void open(f) }} />
        <input value={name} onChange={(e) => setName(e.target.value)} style={{ flex: 1, padding: 4 }} />
        <button onClick={save} disabled={busy || !file} style={{ padding: '4px 12px' }}>Save .docx</button>
      </div>
      {busy && <p>working…</p>}
      {err && <p style={{ color: 'crimson' }}>{err}</p>}
      <div style={{ background: '#fff', border: '1px solid #ddd', padding: '16px 24px', minHeight: 500, lineHeight: 1.6 }}>
        <EditorContent editor={editor} />
      </div>
    </main>
  )
}
