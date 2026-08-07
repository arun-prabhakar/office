'use client'

import { useState } from 'react'

type DocRun = { text: string; bold?: boolean; italic?: boolean; underline?: boolean; strike?: boolean; color?: string }
type ContentBlock =
  | { type: 'paragraph' | 'heading' | 'listItem'; runs: DocRun[]; level?: number }
  | { type: 'image' | 'table' | 'passthrough'; text: string }

type OpenResult = {
  ok: boolean
  name?: string
  blockCount?: number
  content?: ContentBlock[]
  error?: string
}

function Run({ r }: { r: DocRun }) {
  let el: React.ReactNode = r.text
  if (r.strike) el = <s>{el}</s>
  if (r.underline) el = <u>{el}</u>
  if (r.italic) el = <em>{el}</em>
  if (r.bold) el = <strong>{el}</strong>
  return <span style={r.color ? { color: `#${r.color}` } : undefined}>{el}</span>
}

export default function Page() {
  const [result, setResult] = useState<OpenResult | null>(null)
  const [busy, setBusy] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [append, setAppend] = useState('')

  const open = async (f: File) => {
    setBusy(true)
    setResult(null)
    setSaveError('')
    const form = new FormData()
    form.append('file', f)
    try {
      const res = await fetch('/api/docs/open', { method: 'POST', body: form })
      setResult((await res.json()) as OpenResult)
    } catch (e) {
      setResult({ ok: false, error: e instanceof Error ? e.message : String(e) })
    } finally {
      setBusy(false)
    }
  }

  const saveRoundTrip = async () => {
    if (!file) return
    setSaving(true)
    setSaveError('')
    try {
      const form = new FormData()
      form.append('file', file)
      if (append.trim()) form.append('append', append.trim())
      const res = await fetch('/api/docs/save', { method: 'POST', body: form })
      if (!res.ok) {
        const j = (await res.json().catch(() => null)) as { error?: string } | null
        throw new Error(j?.error ?? `HTTP ${res.status}`)
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = file.name.replace(/\.docx$/i, '') + '.roundtrip.docx'
      a.click()
      URL.revokeObjectURL(url)
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : String(e))
    } finally {
      setSaving(false)
    }
  }

  return (
    <main style={{ maxWidth: 820, margin: '0 auto', padding: 24 }}>
      <h1>Docs (web) — formatted .docx viewer</h1>
      <p style={{ color: '#666' }}>
        Upload a <code>.docx</code>; the server parses it and renders content with formatting
        (bold/italic/underline/strike/color). Byte-round-trip save + append run server-side.
      </p>

      <input
        type="file"
        accept=".docx"
        disabled={busy}
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) {
            setFile(f)
            void open(f)
          }
        }}
      />

      {busy && <p>parsing…</p>}
      {result?.error && <p style={{ color: 'crimson' }}>{result.error}</p>}

      {result?.ok && (
        <>
          <p style={{ color: '#888' }}>
            {result.name} — {result.blockCount} blocks
          </p>

          <article
            style={{
              background: '#fff',
              border: '1px solid #ddd',
              padding: '24px 32px',
              marginTop: 16,
              lineHeight: 1.6,
            }}
          >
            {(result.content ?? []).map((b, i) => {
              if (b.type === 'heading') {
                const lvl = Math.min(Math.max(b.level ?? 2, 1), 6)
                const Tag = (`h${lvl}` as 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6')
                return (
                  <Tag key={i}>{b.runs.map((r, j) => <Run key={j} r={r} />)}</Tag>
                )
              }
              if (b.type === 'listItem')
                return (
                  <div key={i} style={{ paddingLeft: 16 }}>
                    • {b.runs.map((r, j) => <Run key={j} r={r} />)}
                  </div>
                )
              if (b.type === 'paragraph')
                return (
                  <p key={i}>
                    {b.runs.length ? b.runs.map((r, j) => <Run key={j} r={r} />) : '\u00a0'}
                  </p>
                )
              return (
                <p key={i} style={{ color: '#888', fontStyle: 'italic' }}>
                  [{b.type}] {'text' in b ? b.text : ''}
                </p>
              )
            })}
          </article>

          {file && (
            <div style={{ marginTop: 16 }}>
              <label style={{ display: 'block', marginBottom: 8, color: '#666' }}>
                Append a paragraph (edit proof — spliced via saveDocx):
              </label>
              <input
                value={append}
                onChange={(e) => setAppend(e.target.value)}
                placeholder="new paragraph text…"
                style={{ width: '100%', padding: 8, marginBottom: 8 }}
              />
              <button disabled={saving} onClick={saveRoundTrip}>
                {saving ? 'saving…' : 'Download .docx'}
              </button>
              {saveError && <p style={{ color: 'crimson' }}>{saveError}</p>}
            </div>
          )}
        </>
      )}
    </main>
  )
}
