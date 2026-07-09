/**
 * `text/event-stream` frame parser for the backend's POST-SSE routes.
 *
 * The backend emits exactly `event: <name>\ndata: <json>\n\n` per frame
 * (06-api-contract.md). Native `EventSource` can't be used — those routes are
 * POST — so we read the `fetch` Response body ourselves. This module is the
 * transport layer only: it hands back raw `{ event, data }` frames; typing and
 * JSON parsing live in api.ts.
 *
 * `SseFrameParser` is a pure incremental parser (string in, completed frames
 * out) so it is unit-testable with literal chunks. `readSseFrames` adapts it to
 * a streamed Response body. Deliberately minimal: the backend guarantees
 * well-formed frames terminated by a blank line, so there is no malformed-frame
 * recovery, buffering cap, or reconnect logic here (a dropped connection ends
 * the iterable; the caller decides what to do).
 */

export interface SseFrame {
  event: string
  data: string
}

export class SseFrameParser {
  private buffer = ''

  /** Feed one text chunk; return every frame it completed (possibly none). */
  push(chunk: string): SseFrame[] {
    // Re-normalize the whole buffer each push so a CRLF split across a chunk
    // boundary (a trailing "\r" then a leading "\n") still collapses to "\n".
    this.buffer = (this.buffer + chunk).replace(/\r\n/g, '\n')
    const frames: SseFrame[] = []
    let sep = this.buffer.indexOf('\n\n')
    while (sep !== -1) {
      const raw = this.buffer.slice(0, sep)
      this.buffer = this.buffer.slice(sep + 2)
      const frame = parseFrame(raw)
      if (frame) frames.push(frame)
      sep = this.buffer.indexOf('\n\n')
    }
    return frames
  }
}

function parseFrame(raw: string): SseFrame | null {
  let event = ''
  let data = ''
  for (const line of raw.split('\n')) {
    if (line.startsWith('event:')) event = line.slice(6).trim()
    else if (line.startsWith('data:')) data = line.slice(5).trim()
  }
  return event ? { event, data } : null
}

/** Async-iterate the frames of a streamed `text/event-stream` Response body. */
export async function* readSseFrames(response: Response): AsyncIterable<SseFrame> {
  const reader = response.body!.getReader()
  const decoder = new TextDecoder()
  const parser = new SseFrameParser()
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    for (const frame of parser.push(decoder.decode(value, { stream: true }))) {
      yield frame
    }
  }
}
