// Web markdown open: upload a .md file, return its text. Markdown is plain
// text, so no engine is needed (unlike docx) — this is the simplest editor
// round-trip. The /markdown page feeds the text into the Tiptap editor via the
// @tiptap/markdown extension's setContent({contentType:'markdown'}).
export async function POST(req: Request) {
  const form = await req.formData()
  const file = form.get('file')
  if (!(file instanceof File)) {
    return Response.json({ ok: false, error: 'no file field' }, { status: 400 })
  }
  return Response.json({ ok: true, name: file.name, text: await file.text() })
}
