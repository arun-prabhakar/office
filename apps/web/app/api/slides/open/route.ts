import { openPptx, type SlideElement, type TextElement } from '@prismoffice/pptx-engine'

type SlideShape = {
  type: string
  text?: string
  left: number
  top: number
  width: number
  height: number
}
type Slide = { index: number; shapes: SlideShape[] }

function extractText(el: TextElement): string {
  const paras = el.text?.paragraphs ?? []
  return paras
    .map((p) => p.runs.map((r) => r.text ?? '').join(''))
    .join('\n')
    .trim()
}

function elementToShape(el: SlideElement): SlideShape | null {
  const t = el.transform
  const base = {
    left: t.offset.x,
    top: t.offset.y,
    width: t.offset.cx,
    height: t.offset.cy,
  }
  if (el.type === 'text' || el.type === 'shape') {
    return { type: 'text', text: extractText(el), ...base }
  }
  if (el.type === 'table') {
    const cells = el.rows
      .flat()
      .map(
        (c) =>
          c.text?.paragraphs?.map((p) => p.runs.map((r) => r.text ?? '').join('')).join('\n') ?? '',
      )
    return { type: 'table', text: cells.filter(Boolean).join(' | '), ...base }
  }
  if (el.type === 'picture') return { type: 'picture', ...base }
  return { type: el.type, ...base }
}

export async function POST(req: Request) {
  const form = await req.formData()
  const file = form.get('file')
  if (!(file instanceof File))
    return Response.json({ ok: false, error: 'no file' }, { status: 400 })
  const bytes = new Uint8Array(await file.arrayBuffer())
  try {
    const { deck } = await openPptx(bytes)
    const slides: Slide[] = deck.slides.map((slide, i) => ({
      index: i,
      shapes: slide.elements
        .map(elementToShape)
        .filter((s): s is SlideShape => s !== null && !!(s.text || s.type === 'picture')),
    }))
    return Response.json({ ok: true, name: file.name, slideCount: slides.length, slides })
  } catch (e) {
    return Response.json(
      { ok: false, error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    )
  }
}
