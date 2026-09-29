/**
 * PURE UTILITY: text/event-stream frame parser (SOLID: SRP)
 * Incremental parser for Server-Sent Events delivered over fetch().
 * Feed it decoded text chunks in arrival order; it returns every complete
 * frame and buffers any partial frame until the next chunk arrives.
 */

export interface SseFrame {
  event: string;
  data: string;
  id?: string;
}

export class SseParser {
  private buffer = '';
  private event = '';
  private dataLines: string[] = [];
  private id: string | undefined;

  push(chunk: string): SseFrame[] {
    this.buffer += chunk;
    const frames: SseFrame[] = [];

    // Process only complete lines; a trailing '\r' may be the first half of '\r\n'.
    let match: RegExpExecArray | null;
    const lineBreak = /\r\n|\r(?!$)|\n/g;
    let start = 0;
    while ((match = lineBreak.exec(this.buffer)) !== null) {
      const line = this.buffer.slice(start, match.index);
      start = match.index + match[0].length;
      const frame = this.processLine(line);
      if (frame) frames.push(frame);
    }
    this.buffer = this.buffer.slice(start);
    return frames;
  }

  private processLine(line: string): SseFrame | null {
    if (line === '') return this.dispatch();
    if (line.startsWith(':')) return null; // comment / keep-alive

    const colon = line.indexOf(':');
    const field = colon === -1 ? line : line.slice(0, colon);
    let value = colon === -1 ? '' : line.slice(colon + 1);
    if (value.startsWith(' ')) value = value.slice(1);

    switch (field) {
      case 'event':
        this.event = value;
        break;
      case 'data':
        this.dataLines.push(value);
        break;
      case 'id':
        this.id = value;
        break;
      default:
        break; // 'retry' and unknown fields are ignored
    }
    return null;
  }

  private dispatch(): SseFrame | null {
    if (this.dataLines.length === 0) {
      this.event = '';
      return null;
    }
    const frame: SseFrame = {
      event: this.event || 'message',
      data: this.dataLines.join('\n'),
      ...(this.id !== undefined ? { id: this.id } : {}),
    };
    this.event = '';
    this.dataLines = [];
    return frame;
  }
}
