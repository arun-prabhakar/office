'use client'

import { useState, useRef, useCallback } from 'react'

export default function Page() {
  const [numPages, setNumPages] = useState(0)
  const [pageNum, setPageNum] = useState(1)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [name, setName] = useState('')
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const pdfDocRef = useRef<{ numPages: number; getPage: (n: number) => Promise<unknown> } | null>(null)

  const renderPage = useCallback(async (n: number) => {
    const pdf = pdfDocRef.current
    const canvas = canvasRef.current
    if (!pdf || !canvas) return
    const page = (await pdf.getPage(n)) as {
      getViewport: (opts: { scale: number }) => { width: number; height: number }
      render: (opts: { canvasContext: CanvasRenderingContext2D; viewport: { width: number; height: number } }) => { promise: Promise<void> }
    }
    const ctx = canvas.getContext('2d')!
    const viewport = page.getViewport({ scale: 1.5 })
    canvas.width = viewport.width
    canvas.height = viewport.height
    await page.render({ canvasContext: ctx, viewport }).promise
  }, [])

  const loadPdf = async (file: File) => {
    setBusy(true); setErr(''); setName(file.name)
    try {
      const pdfjs = await import('pdfjs-dist')
      pdfjs.GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`
      const data = new Uint8Array(await file.arrayBuffer())
      const pdf = await pdfjs.getDocument({ data }).promise
      pdfDocRef.current = pdf as typeof pdfDocRef.current
      setNumPages(pdf.numPages)
      setPageNum(1)
      await renderPage(1)
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  const go = async (delta: number) => {
    const n = Math.min(Math.max(1, pageNum + delta), numPages)
    if (n === pageNum) return
    setPageNum(n)
    await renderPage(n)
  }

  return (
    <main style={{ maxWidth: 820, margin: '0 auto', padding: 24 }}>
      <h1>PDF viewer (web)</h1>
      <p style={{ color: '#666' }}>
        Upload a PDF — rendered client-side with pdf.js. No server round-trip needed for viewing.
      </p>
      <input
        type="file"
        accept=".pdf"
        disabled={busy}
        onChange={(e) => { const f = e.target.files?.[0]; if (f) void loadPdf(f) }}
      />
      {busy && <p>loading…</p>}
      {err && <p style={{ color: 'crimson' }}>{err}</p>}
      {numPages > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '16px 0' }}>
          <button onClick={() => go(-1)} disabled={pageNum <= 1}>← Prev</button>
          <span>{pageNum} / {numPages}</span>
          <button onClick={() => go(1)} disabled={pageNum >= numPages}>Next →</button>
          <span style={{ color: '#888', marginLeft: 'auto' }}>{name}</span>
        </div>
      )}
      <canvas ref={canvasRef} style={{ border: '1px solid #ddd', maxWidth: '100%' }} />
    </main>
  )
}
