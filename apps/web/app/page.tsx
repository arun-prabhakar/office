'use client'

import { useState, useEffect } from 'react'

type Editor = { href: string; title: string; desc: string; icon: string; ext: string }

const EDITORS: Editor[] = [
  {
    href: '/docs',
    title: 'Docs',
    desc: 'Word processor (.docx) with byte-preserving round-trip',
    icon: '📝',
    ext: '.docx',
  },
  {
    href: '/markdown',
    title: 'Markdown',
    desc: 'Tiptap markdown editor with AI panel',
    icon: '📄',
    ext: '.md',
  },
  {
    href: '/sheets',
    title: 'Sheets',
    desc: 'Spreadsheet viewer (.xlsx)',
    icon: '📊',
    ext: '.xlsx',
  },
  { href: '/pdf', title: 'PDF', desc: 'PDF viewer with page navigation', icon: '📕', ext: '.pdf' },
  {
    href: '/agent-demo',
    title: 'AI Demo',
    desc: 'Tool-calling agent over HTTP',
    icon: '🤖',
    ext: '',
  },
]

export default function Home() {
  const [aiEnabled, setAiEnabled] = useState(true)

  useEffect(() => {
    setAiEnabled(process.env.NEXT_PUBLIC_AI_ENABLED !== 'false')
  }, [])

  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)',
        color: '#fff',
      }}
    >
      <div style={{ maxWidth: 900, margin: '0 auto', padding: '60px 24px' }}>
        <h1 style={{ fontSize: 36, fontWeight: 700, marginBottom: 8 }}>PrismOffice</h1>
        <p style={{ fontSize: 18, color: '#aaa', marginBottom: 40 }}>
          AI-native office suite — web edition
        </p>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))',
            gap: 16,
          }}
        >
          {EDITORS.map((e) => (
            <a
              key={e.href}
              href={e.href}
              style={{
                display: 'block',
                padding: 24,
                borderRadius: 12,
                background: 'rgba(255,255,255,0.08)',
                border: '1px solid rgba(255,255,255,0.12)',
                textDecoration: 'none',
                color: '#fff',
                transition: 'background 0.2s',
              }}
              onMouseEnter={(ev) => (ev.currentTarget.style.background = 'rgba(255,255,255,0.15)')}
              onMouseLeave={(ev) => (ev.currentTarget.style.background = 'rgba(255,255,255,0.08)')}
            >
              <div style={{ fontSize: 32, marginBottom: 8 }}>{e.icon}</div>
              <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 4 }}>
                {e.title} {e.ext && <span style={{ fontSize: 13, color: '#888' }}>{e.ext}</span>}
              </div>
              <div style={{ fontSize: 13, color: '#aaa' }}>{e.desc}</div>
            </a>
          ))}
        </div>

        <div
          style={{
            marginTop: 40,
            padding: 16,
            borderRadius: 8,
            background: 'rgba(255,255,255,0.05)',
            fontSize: 13,
            color: '#888',
          }}
        >
          AI features: {aiEnabled ? '✅ Enabled' : '⛔ Disabled'} — set{' '}
          <code style={{ color: '#6bf' }}>ANTHROPIC_API_KEY</code> server-side for live AI. Source:{' '}
          <a href="https://github.com/arun-prabhakar/office" style={{ color: '#6bf' }}>
            arun-prabhakar/office
          </a>
        </div>
      </div>
    </div>
  )
}
