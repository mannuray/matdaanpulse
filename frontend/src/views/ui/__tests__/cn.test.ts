import { describe, it, expect } from 'vitest';
import { cn } from '../cn';

describe('cn', () => {
  it('joins truthy classes and lets later Tailwind classes win', () => {
    const hidden = false as boolean;
    expect(cn('px-2 text-muted', hidden && 'hidden', 'px-4')).toBe('text-muted px-4');
  });
});
