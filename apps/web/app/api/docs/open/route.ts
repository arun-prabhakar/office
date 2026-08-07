import { parseDocx } from '@genoffice/docx-engine'

export type DocContentBlock =
  | { type: 'paragraph' | 'heading' | 'listItem'; text: string; level?: number }
  | { type: 'image' | 'table' | 'passthrough'; text: string }

// Web docx open: upload a .docx, parse it server-side with the docx-engine,
// return a lightweight content view (block text) the /docs page renders
// read-only. Proves the engine runs in the Next.js server runtime and exposes
// the document content for the (later) editor.
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
        return {
          type: b.type,
          text: (b.runs ?? []).map((r) => r.text).join(''),
          ...(b.level !== undefined ? { level: b.level } : {}),
        }
      }
      return { type: b.type, text: b.previewText ?? b.label ?? `[${b.type}]` }
    })
    return Response.json({
      ok: true,
      name: file.name,
      blockCount: parsed.blocks.length,
      content,
    })
  } catch (e) {
    return Response.json(
      { ok: false, error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    )
  }
}
