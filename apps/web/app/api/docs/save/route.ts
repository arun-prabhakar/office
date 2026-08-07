import { parseDocx, saveDocx, type SaveBlock } from '@prismoffice/docx-engine'

// Accepts the original file + finalBlocks (from pmDocToSavePlan on the client).
// Re-parses (stateless) + applies via saveDocx → byte-preserving .docx.
export async function POST(req: Request) {
  const form = await req.formData()
  const file = form.get('file')
  if (!(file instanceof File)) return Response.json({ ok: false, error: 'no file' }, { status: 400 })
  const finalBlocksJson = String(form.get('finalBlocks') ?? '')
  const bytes = new Uint8Array(await file.arrayBuffer())
  try {
    const parsed = await parseDocx(bytes)
    let finalBlocks: SaveBlock[]
    if (finalBlocksJson) {
      finalBlocks = JSON.parse(finalBlocksJson) as SaveBlock[]
    } else {
      // unchanged round-trip fallback
      finalBlocks = parsed.blocks
        .filter((b) => !b.hidden && b.docxIndex !== null)
        .map((b) => ({ kind: 'original' as const, docxIndex: b.docxIndex as number }))
    }
    const out = await saveDocx(parsed, finalBlocks)
    return new Response(new Uint8Array(out), {
      headers: {
        'content-type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'content-disposition': `attachment; filename="${file.name}"`,
      },
    })
  } catch (e) {
    return Response.json({ ok: false, error: e instanceof Error ? e.message : String(e) }, { status: 500 })
  }
}
