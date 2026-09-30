/** Per-minute buckets in a ring: O(1) add, O(window) read, bounded memory. */
export class RollingCounter {
  private readonly counts: number[];
  private readonly minutes: number[];

  constructor(private readonly size = 60) {
    this.counts = new Array(size).fill(0);
    this.minutes = new Array(size).fill(-1);
  }

  add(nowMs: number, n = 1) {
    const minute = Math.floor(nowMs / 60_000);
    const i = minute % this.size;
    if (this.minutes[i] !== minute) {
      this.minutes[i] = minute; // slot last used `size` minutes ago (or never): roll over
      this.counts[i] = 0;
    }
    this.counts[i] += n;
  }

  /** Sum over the current minute and the `windowMinutes - 1` before it. */
  sum(nowMs: number, windowMinutes: number): number {
    const minute = Math.floor(nowMs / 60_000);
    const w = Math.min(windowMinutes, this.size);
    let total = 0;
    for (let i = 0; i < this.size; i++) {
      const m = this.minutes[i];
      if (m > minute - w && m <= minute) total += this.counts[i];
    }
    return total;
  }
}
