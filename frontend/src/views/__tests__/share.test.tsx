// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { shareLinks } from '../dashboard/ShareMenu';

describe('shareLinks', () => {
  it('encodes text and url for WhatsApp and X/Twitter', () => {
    const l = shareLinks('Bihar 2025 - Election Tracker', 'http://localhost:3080/election/e1?layer=swing');
    expect(l.whatsapp).toBe('https://wa.me/?text=Bihar%202025%20-%20Election%20Tracker%20http%3A%2F%2Flocalhost%3A3080%2Felection%2Fe1%3Flayer%3Dswing');
    expect(l.twitter).toBe('https://twitter.com/intent/tweet?text=Bihar%202025%20-%20Election%20Tracker&url=http%3A%2F%2Flocalhost%3A3080%2Felection%2Fe1%3Flayer%3Dswing');
  });
});
