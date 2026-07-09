import { describe, it, expect } from 'vitest'
import { SseFrameParser, readSseFrames } from './sse'

const frame = (event: string, data: string) => `event: ${event}\ndata: ${data}\n\n`

describe('SseFrameParser', () => {
  it('parses a single complete frame', () => {
    const p = new SseFrameParser()
    expect(p.push(frame('step', '{"event":"step"}'))).toEqual([
      { event: 'step', data: '{"event":"step"}' },
    ])
  })

  it('parses multiple frames delivered in one chunk', () => {
    const p = new SseFrameParser()
    const frames = p.push(frame('step', '{"a":1}') + frame('done', '{"b":2}'))
    expect(frames).toEqual([
      { event: 'step', data: '{"a":1}' },
      { event: 'done', data: '{"b":2}' },
    ])
  })

  it('reassembles a frame split across chunks', () => {
    const p = new SseFrameParser()
    const whole = frame('chunk', '{"text":"Dear "}')
    const mid = Math.floor(whole.length / 2)
    expect(p.push(whole.slice(0, mid))).toEqual([])
    expect(p.push(whole.slice(mid))).toEqual([
      { event: 'chunk', data: '{"text":"Dear "}' },
    ])
  })

  it('tolerates CRLF line endings', () => {
    const p = new SseFrameParser()
    const frames = p.push('event: done\r\ndata: {"event":"done"}\r\n\r\n')
    expect(frames).toEqual([{ event: 'done', data: '{"event":"done"}' }])
  })

  it('tolerates a CRLF split across the chunk boundary', () => {
    const p = new SseFrameParser()
    // The \r and \n of the terminating blank line arrive in separate chunks.
    expect(p.push('event: done\r\ndata: {}\r')).toEqual([])
    expect(p.push('\n\r\n')).toEqual([{ event: 'done', data: '{}' }])
  })

  it('holds a partial trailing frame until its terminator arrives', () => {
    const p = new SseFrameParser()
    expect(p.push('event: done\ndata: {"event":"done"}')).toEqual([])
    expect(p.push('\n\n')).toEqual([{ event: 'done', data: '{"event":"done"}' }])
  })
})

function sseResponse(chunks: string[]): Response {
  const encoder = new TextEncoder()
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(encoder.encode(chunk))
      controller.close()
    },
  })
  return new Response(stream)
}

describe('readSseFrames', () => {
  it('yields frames from a streamed Response body', async () => {
    const res = sseResponse([
      frame('step', '{"event":"step"}'),
      frame('chunk', '{"event":"chunk"}') + frame('done', '{"event":"done"}'),
    ])
    const out = []
    for await (const f of readSseFrames(res)) out.push(f)
    expect(out).toEqual([
      { event: 'step', data: '{"event":"step"}' },
      { event: 'chunk', data: '{"event":"chunk"}' },
      { event: 'done', data: '{"event":"done"}' },
    ])
  })

  it('reassembles frames across arbitrary byte chunk boundaries', async () => {
    const whole = frame('done', '{"event":"done","ref":"abc"}')
    const res = sseResponse(whole.split('')) // one character per chunk
    const out = []
    for await (const f of readSseFrames(res)) out.push(f)
    expect(out).toEqual([{ event: 'done', data: '{"event":"done","ref":"abc"}' }])
  })
})
