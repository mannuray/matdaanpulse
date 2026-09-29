import { describe, it, expect } from 'vitest';
import { labelFor, LABEL_MIN_AREA, LABEL_FONT_PX } from '../components/organisms/useMapRendering';

describe('labelFor (zoom-responsive labels)', () => {
  it('hides labels for small on-screen areas and reveals them as zoom grows', () => {
    const base = LABEL_MIN_AREA / 16; // becomes visible at k = 4
    expect(labelFor('Ahmedabad East', base, 1)).toBeNull();
    expect(labelFor('Ahmedabad East', base, 4)).not.toBeNull();
  });

  it('abbreviates at medium sizes and shows full names when large', () => {
    expect(labelFor('Ahmedabad East', LABEL_MIN_AREA, 1)?.text).toBe('Ahm.');
    expect(labelFor('Ahmedabad East', LABEL_MIN_AREA, 2)?.text).toBe('Ahmedabad East');
  });

  it('scales font inversely with zoom so screen size stays constant', () => {
    expect(labelFor('Agra', LABEL_MIN_AREA, 2)?.fontSize).toBeCloseTo(LABEL_FONT_PX / 2);
    expect(labelFor('Agra', LABEL_MIN_AREA, 8)?.fontSize).toBeCloseTo(LABEL_FONT_PX / 8);
  });
});
