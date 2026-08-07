import { parseDocx, saveDocx, type SaveBlock } from '@prismoffice/docx-engine'

// Web docx save (round-trip). The client sends the original .docx bytes back;
// the server re-parses (stateless) and runs `saveDocx`, returning the new .docx.
// This is the byte-round-trip path the Electron editor used — proven here to
// run server-side in Next.js. For an unchanged upload it round-trips the
// original; once the editor sends edited SaveBlocks (new/patched OOXML), the
// same route applies them. (saveDocx needs the live parsed object, hence the
// re-parse rather than holding state across requests.)
export async function POST(req: Request) {
  const form = await req.formData()
  const file = form.get('file')
  if (!(file instanceof File)) {
    return Response.json({ ok: false, error: 'no file field' }, { status: 400 })
  }
  const bytes = new Uint8Array(await file.arrayBuffer())
  try {
    const parsed = await parseDocx(bytes)
    // unchanged round-trip: keep every visible, anchored block at its original anchor
    const finalBlocks: SaveBlock[] = parsed.blocks
      .filter((b) => !b.hidden && b.docxIndex !== null)
      .map((b) => ({ kind: 'original' as const, docxIndex: b.docxIndex as number }))
    // optional edit proof: append a new paragraph (self-contained OOXML) at the end
    const append = String(form.get('append') ?? '').trim()
    if (append) {
      const esc = append
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
      finalBlocks.push({
        kind: 'xml',
        xml: `<w:p><w:r><w:t xml:space="preserve">${esc}</w:t></w:r></w:p>`,
      })
    }
    const out = await saveDocx(parsed, finalBlocks)
    // copy into a fresh ArrayBuffer-backed Uint8Array: jszip returns
    // Uint8Array<ArrayBufferLike>, which the lib's BodyInit rejects on the buffer type.
    return new Response(new Uint8Array(out), {
      headers: {
        'content-type':
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'content-disposition': `attachment; filename="${file.name}"`,
      },
    })
  } catch (e) {
    return Response.json(
      { ok: false, error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    )
  }
}
