/**
 * build a fake SSE response body from raw lines (each already includes "data: " if needed).
 *
 * Each line is emitted as its own SSE event terminated by a blank line (\n\n):
 * the AI SDK reads the body through the standard EventSourceParserStream, which
 * dispatches an event only on a blank-line separator. The single-\n separation
 * the old hand-rolled parser tolerated would be buffered into one malformed
 * event and yield no content.
 */
export function sseStream(lines: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder()
  return new ReadableStream({
    start(controller) {
      for (const line of lines) controller.enqueue(encoder.encode(`${line}\n\n`))
      controller.close()
    },
  })
}

/** 200 streaming response (text/event-stream); the AI SDK providers read the body as SSE. */
export function okResponse(body: ReadableStream<Uint8Array>): Response {
  return new Response(body, { status: 200, headers: { 'content-type': 'text/event-stream' } })
}

export function jsonResponse(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

export function errorResponse(status: number, text: string): Response {
  return new Response(text, { status })
}
