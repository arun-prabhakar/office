import { parseDocx } from '@prismoffice/docx-engine'

export type DocRun = { text: string; bold?: boolean; italic?: boolean; underline?: boolean; strike?: boolean; color?: string }
export type DocContentBlock =
  | { type: 'paragraph' | 'heading' | 'listItem'; runs: DocRun[]; level?: number }
  | { type: 'image' | 'table' | 'passthrough'; text: string }

// Web docx open: upload a .docx, parse server-side, return a formatted content
// view (runs with character marks) the /docs page renders faithfully. Proves the
// docx-engine runs in the Next.js server and exposes rich content for the editor.
export async function POST(req: Request) {
  const form = await req.formData()
  const file = form.get('file')
  if (!(file instanceof File)) {
    return Response.json({ ok: false, error: 'no file field' }, { status: 400 })
  }
  const bytes = new Uint8Array(await file.arrayBuffer())
  try {
    const parsed = await parseDocx(bytes)
    const visible = parsed.blocks.filter((b) => !b.hidden)
    const content: DocContentBlock[] = visible.map((b) => {
      if (b.type === 'paragraph' || b.type === 'heading' || b.type === 'listItem') {
        const runs: DocRun[] = (b.runs ?? []).map((r) => ({
          text: r.text,
          ...(r.bold ? { bold: true } : {}),
          ...(r.italic ? { italic: true } : {}),
          ...(r.underline ? { underline: true } : {}),
          ...(r.strike ? { strike: true } : {}),
          ...(r.color ? { color: r.color } : {}),
        }))
        return { type: b.type, runs, ...(b.level !== undefined ? { level: b.level } : {}) }
      }
      return { type: b.type, text: b.previewText ?? b.label ?? `[${b.type}]` }
    })
    return Response.json({ ok: true, name: file.name, blockCount: parsed.blocks.length, content })
  } catch (e) {
    return Response.json(
      { ok: false, error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    )
  }
}
