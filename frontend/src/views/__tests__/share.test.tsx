// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { shareLinks, ShareMenu } from '../dashboard/ShareMenu';

describe('shareLinks', () => {
  it('encodes text and url for WhatsApp and X/Twitter', () => {
    const l = shareLinks('Bihar 2025 - MatdaanPulse', 'http://localhost:3080/election/e1?layer=swing');
    expect(l.whatsapp).toBe('https://wa.me/?text=Bihar%202025%20-%20MatdaanPulse%20http%3A%2F%2Flocalhost%3A3080%2Felection%2Fe1%3Flayer%3Dswing');
    expect(l.twitter).toBe('https://twitter.com/intent/tweet?text=Bihar%202025%20-%20MatdaanPulse&url=http%3A%2F%2Flocalhost%3A3080%2Felection%2Fe1%3Flayer%3Dswing');
  });
});

describe('ShareMenu', () => {
  it('builds links from the router location', () => {
    const { container } = render(
      <MemoryRouter initialEntries={['/election/e1?layer=swing']} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <ShareMenu text="T" />
      </MemoryRouter>,
    );
    const hrefs = Array.from(container.querySelectorAll('a')).map(a => a.getAttribute('href')!);
    expect(hrefs).toHaveLength(2);
    hrefs.forEach(h => expect(h).toContain('layer%3Dswing'));
  });
});
