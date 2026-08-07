// Web markdown save: receive the editor's markdown text, return it as a .md
// download. Plain text — no Uint8Array/engine concerns.
export async function POST(req: Request) {
  const form = await req.formData()
  const text = String(form.get('text') ?? '')
  const name = String(form.get('name') ?? 'untitled.md') || 'untitled.md'
  return new Response(text, {
    headers: {
      'content-type': 'text/markdown; charset=utf-8',
      'content-disposition': `attachment; filename="${name.replace(/[^a-z0-9._-]/gi, '_')}"`,
    },
  })
}
