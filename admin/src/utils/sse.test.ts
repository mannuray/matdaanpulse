import { describe, it, expect } from 'vitest';
import { SseParser } from './sse';

describe('SseParser', () => {
  it('parses a complete named event', () => {
    const p = new SseParser();
    expect(p.push('event: enrichment-progress\ndata: {"total":3}\n\n')).toEqual([
      { event: 'enrichment-progress', data: '{"total":3}' },
    ]);
  });

  it('reassembles frames split across arbitrary chunk boundaries', () => {
    const raw = 'event: enrichment-progress\ndata: {"total":10,"completed":4}\n\nevent: ping\ndata: {}\n\n';
    for (let split = 1; split < raw.length; split++) {
      const p = new SseParser();
      const frames = [...p.push(raw.slice(0, split)), ...p.push(raw.slice(split))];
      expect(frames).toEqual([
        { event: 'enrichment-progress', data: '{"total":10,"completed":4}' },
        { event: 'ping', data: '{}' },
      ]);
    }
  });

  it('handles one character per chunk and CRLF line endings', () => {
    const p = new SseParser();
    const frames = 'event: a\r\ndata: x\r\n\r\n'.split('').flatMap((c) => p.push(c));
    expect(frames).toEqual([{ event: 'a', data: 'x' }]);
  });

  it('joins multi-line data with newlines', () => {
    const p = new SseParser();
    expect(p.push('data: line1\ndata: line2\ndata:line3\n\n')).toEqual([
      { event: 'message', data: 'line1\nline2\nline3' },
    ]);
  });

  it('ignores comments and emits nothing for an incomplete frame', () => {
    const p = new SseParser();
    expect(p.push(': keep-alive\n\nevent: x\ndata: partial')).toEqual([]);
    expect(p.push('\n\n')).toEqual([{ event: 'x', data: 'partial' }]);
  });

  it('lets callers filter out ping events', () => {
    const p = new SseParser();
    const frames = p.push('event: ping\ndata: \n\nevent: enrichment-progress\ndata: {"completed":1}\n\n');
    const progress = frames.filter((f) => f.event === 'enrichment-progress').map((f) => JSON.parse(f.data));
    expect(progress).toEqual([{ completed: 1 }]);
  });
});
