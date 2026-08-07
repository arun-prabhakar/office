import { parseDocx } from '@prismoffice/docx-engine'

// Returns the full Block[] tree from parseDocx so the client's blocksToPmDoc
// (ported from apps/docs) can build the Tiptap editor content.
export async function POST(req: Request) {
  const form = await req.formData()
  const file = form.get('file')
  if (!(file instanceof File)) return Response.json({ ok: false, error: 'no file' }, { status: 400 })
  const bytes = new Uint8Array(await file.arrayBuffer())
  try {
    const parsed = await parseDocx(bytes)
    return Response.json({ ok: true, name: file.name, blocks: parsed.blocks })
  } catch (e) {
    return Response.json({ ok: false, error: e instanceof Error ? e.message : String(e) }, { status: 500 })
  }
}
