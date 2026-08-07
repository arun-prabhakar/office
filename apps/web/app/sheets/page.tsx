'use client'

import { useState } from 'react'
import * as XLSX from 'xlsx'

type SheetData = { name: string; rows: (string | number | boolean | null)[][] }

export default function Page() {
  const [sheets, setSheets] = useState<SheetData[]>([])
  const [active, setActive] = useState(0)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [name, setName] = useState('')

  const loadXlsx = async (file: File) => {
    setBusy(true); setErr(''); setName(file.name)
    try {
      const buf = await file.arrayBuffer()
      const wb = XLSX.read(buf, { type: 'array' })
      const data: SheetData[] = wb.SheetNames.map((sheetName) => ({
        name: sheetName,
        rows: XLSX.utils.sheet_to_json(wb.Sheets[sheetName]!, { header: 1, blankrows: false }) as (string | number | boolean | null)[][],
      }))
      setSheets(data)
      setActive(0)
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  const current = sheets[active]

  return (
    <main style={{ maxWidth: 1000, margin: '0 auto', padding: 24 }}>
      <h1>Sheets viewer (web)</h1>
      <p style={{ color: '#666' }}>
        Upload an <code>.xlsx</code> — parsed client-side with SheetJS. Full Univer spreadsheet UI
        + Rust sidecar import/export are the next phase.
      </p>
      <input
        type="file"
        accept=".xlsx"
        disabled={busy}
        onChange={(e) => { const f = e.target.files?.[0]; if (f) void loadXlsx(f) }}
      />
      {busy && <p>parsing…</p>}
      {err && <p style={{ color: 'crimson' }}>{err}</p>}

      {sheets.length > 0 && (
        <>
          <div style={{ display: 'flex', gap: 4, margin: '16px 0 8px', borderBottom: '2px solid #ddd', paddingBottom: 4 }}>
            {sheets.map((s, i) => (
              <button
                key={i}
                onClick={() => setActive(i)}
                style={{
                  padding: '4px 12px',
                  background: i === active ? '#3179f5' : 'transparent',
                  color: i === active ? '#fff' : '#333',
                  border: '1px solid #ddd',
                  borderRadius: '4px 4px 0 0',
                  cursor: 'pointer',
                  fontWeight: 600,
                }}
              >
                {s.name}
              </button>
            ))}
            <span style={{ marginLeft: 'auto', color: '#888', alignSelf: 'center' }}>{name}</span>
          </div>

          {current && (
            <div style={{ overflow: 'auto', maxHeight: '70vh', border: '1px solid #ddd' }}>
              <table style={{ borderCollapse: 'collapse', fontSize: 13, fontFamily: 'system-ui' }}>
                <tbody>
                  {current.rows.slice(0, 500).map((row, i) => (
                    <tr key={i} style={{ background: i === 0 ? '#f0f4f8' : undefined }}>
                      <td style={{ padding: '2px 8px', color: '#999', borderRight: '1px solid #eee', textAlign: 'right', minWidth: 32 }}>
                        {i + 1}
                      </td>
                      {row.map((cell, j) => (
                        <td
                          key={j}
                          style={{
                            padding: '2px 8px',
                            borderRight: '1px solid #eee',
                            borderBottom: '1px solid #eee',
                            whiteSpace: 'nowrap',
                            maxWidth: 300,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}
                        >
                          {cell === null || cell === undefined ? '' : String(cell)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
              {current.rows.length > 500 && (
                <p style={{ color: '#888', padding: 8 }}>… showing first 500 rows of {current.rows.length}</p>
              )}
            </div>
          )}
        </>
      )}
    </main>
  )
}
