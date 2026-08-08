'use client'

import { useState } from 'react'

type SlideShape = {
  type: string
  text?: string
  left: number
  top: number
  width: number
  height: number
}
type Slide = { index: number; shapes: SlideShape[] }
type ParseResult = {
  ok: boolean
  name?: string
  slideCount?: number
  slides?: Slide[]
  error?: string
}

const EMU_TO_PX = 1 / 9525 // 1 EMU ≈ 0.000105px at 96 DPI (914400 EMU = 1 inch = 96px)

export default function Page() {
  const [result, setResult] = useState<ParseResult | null>(null)
  const [busy, setBusy] = useState(false)
  const [current, setCurrent] = useState(0)

  const loadFile = async (file: File) => {
    setBusy(true)
    setResult(null)
    setCurrent(0)
    const form = new FormData()
    form.append('file', file)
    try {
      const res = await fetch('/api/slides/open', { method: 'POST', body: form })
      setResult((await res.json()) as ParseResult)
    } catch (e) {
      setResult({ ok: false, error: e instanceof Error ? e.message : String(e) })
    } finally {
      setBusy(false)
    }
  }

  const slides = result?.slides ?? []
  const slide = slides[current]

  return (
    <div style={{ minHeight: '100vh', background: '#1a1a2e', color: '#fff' }}>
      <header
        style={{
          padding: '8px 24px',
          display: 'flex',
          alignItems: 'center',
          gap: 16,
          borderBottom: '1px solid #333',
        }}
      >
        <a href="/" style={{ color: '#aaa', textDecoration: 'none', fontSize: 14 }}>
          ← Home
        </a>
        <strong>PrismOffice Slides</strong>
        <input
          type="file"
          accept=".pptx"
          disabled={busy}
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) void loadFile(f)
          }}
          style={{ color: '#aaa', fontSize: 13 }}
        />
        {result?.ok && slides.length > 0 && (
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
            <button
              onClick={() => setCurrent(Math.max(0, current - 1))}
              disabled={current <= 0}
              style={navBtn}
            >
              ←
            </button>
            <span style={{ fontSize: 14, color: '#aaa' }}>
              {current + 1} / {slides.length}
            </span>
            <button
              onClick={() => setCurrent(Math.min(slides.length - 1, current + 1))}
              disabled={current >= slides.length - 1}
              style={navBtn}
            >
              →
            </button>
          </div>
        )}
      </header>

      {busy && <p style={{ padding: 24 }}>parsing…</p>}
      {result?.error && <p style={{ padding: 24, color: '#f66' }}>{result.error}</p>}
      {result?.ok && slides.length === 0 && (
        <p style={{ padding: 24, color: '#aaa' }}>No slides found.</p>
      )}

      {slide && (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 24 }}>
          <div
            style={{
              width: 960,
              height: 540,
              background: '#fff',
              color: '#111',
              borderRadius: 8,
              position: 'relative',
              overflow: 'hidden',
              boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
            }}
          >
            {slide.shapes.map((shape, i) => (
              <div
                key={i}
                style={{
                  position: 'absolute',
                  left: shape.left * EMU_TO_PX,
                  top: shape.top * EMU_TO_PX,
                  width: shape.width * EMU_TO_PX,
                  height: shape.height * EMU_TO_PX,
                  padding: '4px 8px',
                  fontSize: Math.max(8, Math.min((shape.width * EMU_TO_PX) / 12, 22)),
                  overflow: 'hidden',
                  whiteSpace: 'pre-wrap',
                  ...(shape.type === 'picture'
                    ? { background: '#eee', border: '1px dashed #ccc' }
                    : {}),
                }}
              >
                {shape.type === 'picture' ? '🖼️' : (shape.text ?? '')}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

const navBtn: React.CSSProperties = {
  background: '#333',
  color: '#fff',
  border: '1px solid #555',
  borderRadius: 4,
  padding: '4px 12px',
  cursor: 'pointer',
  fontSize: 14,
}
