interface Sample {
  at: number;
  ms: number;
}

/** Last `capacity` durations of one route, read as a p95 over a time window. */
export class LatencyReservoir {
  private readonly samples: Sample[] = [];
  private next = 0;
  count = 0;

  constructor(private readonly capacity = 200) {}

  add(nowMs: number, ms: number) {
    const s = { at: nowMs, ms };
    if (this.samples.length < this.capacity) this.samples.push(s);
    else this.samples[this.next] = s;
    this.next = (this.next + 1) % this.capacity;
    this.count++;
  }

  /** Nearest-rank p95 of samples newer than `windowMs`; null when there are none. */
  p95(nowMs: number, windowMs: number): { p95: number; samples: number } | null {
    const ms = this.samples.filter((s) => s.at > nowMs - windowMs).map((s) => s.ms).sort((a, b) => a - b);
    if (ms.length === 0) return null;
    return { p95: ms[Math.ceil(0.95 * ms.length) - 1], samples: ms.length };
  }

  lastAt(): number {
    return this.samples.reduce((m, s) => Math.max(m, s.at), 0);
  }
}
