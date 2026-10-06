import { describe, it, expect } from 'vitest';
import { applyOcrFixes, mergeOcr, ocrLayout, ocrNormalise } from '../ocr';

describe('ocrLayout', () => {
  it('rebuilds a page as pdftotext -layout would: one line per row, tokens at their column', () => {
    const page = [
      '0.0871 0.0616 CONSTITUENCY :', '0.0872 0.2608 58- KANUBARI (ST)',
      '0.1424 0.0780 1. NOMINATION FILED', '0.1417 0.4312 3', '0.1417 0.9055 3',
    ].join('\n');
    // columns: x × width (6, 26 / 8, 43, 91)
    const row2 = ' '.repeat(8) + '1. NOMINATION FILED'.padEnd(43 - 8) + '3'.padEnd(91 - 43) + '3';
    expect(ocrLayout([page], 100)).toBe(`${' '.repeat(6)}CONSTITUENCY :${' '.repeat(6)}58- KANUBARI (ST)\n${row2}\n\f`);
  });
  it('keeps two tokens apart even when the second starts inside the first', () => {
    expect(ocrLayout(['0.1 0.0 ABCDEFGHIJ\n0.1 0.05 KL'], 100)).toBe('ABCDEFGHIJ KL\n\f');
  });
});

describe('ocrNormalise', () => {
  it('fixes the systematic misreads', () => {
    expect(ocrNormalise('        Il. ELECTORS\n 9.VOTES POLLED FOR \'NOTA\' (INGLUDING POSTAL)   138\n 7.TOTALVALID VOTES POLLED  7009'))
      .toBe('        II. ELECTORS\n 9.VOTES POLLED FOR \'NOTA\' (INCLUDING POSTAL)   138\n 7.TOTAL VALID VOTES POLLED  7009');
  });
  it('reads a blank number as 0 where the scan leaves it empty (unopposed seats, faint zeros)', () => {
    expect(ocrNormalise('              5. TOTAL\n        WINNER              INC                                Pema Khandu\n        MARGIN'))
      .toBe('              5. TOTAL   0\n        WINNER              INC                                Pema Khandu   0\n        MARGIN   0');
    expect(ocrNormalise('              2 PEMA KHANDU                              M 34           ST              INC          Hand\n       TURNOUT                                                      TOTAL:'))
      .toBe('              2 PEMA KHANDU                              M 34           ST              INC          Hand   0   0   0   0.00\n       TURNOUT                                                      TOTAL:   0   0   0   0.00');
  });
  it('leaves a row with some numbers alone (a misread to fix by hand)', () => {
    const row = '              3 DORJEE KHANDU                            M 51            ST            BJP          Lotus               391                          4';
    expect(ocrNormalise(row)).toBe(row);
  });
});

describe('applyOcrFixes', () => {
  it('replaces each sourced misread once, and refuses a fix that matches nothing or more than once', () => {
    expect(applyOcrFixes('A 391  4\nB', [{ find: 'A 391  4', replace: 'A 391 0 391 4.17', note: 'p72' }])).toBe('A 391 0 391 4.17\nB');
    expect(() => applyOcrFixes('A\nB', [{ find: 'C', replace: 'D', note: 'x' }])).toThrow(/OCR fix matches 0 times: C/);
    expect(() => applyOcrFixes('A A', [{ find: 'A', replace: 'D', note: 'x' }])).toThrow(/OCR fix matches 2 times: A/);
  });
});

describe('ocrNormalise, Detailed Results rows with a blank postal column', () => {
  it('infers postal = total - general when only those two figures and the percentage are printed', () => {
    expect(ocrNormalise('              3 DORJEE KHANDU                            M 51            ST            BJP          Lotus               391     400        5.02'))
      .toBe('              3 DORJEE KHANDU                            M 51            ST            BJP          Lotus               391   9   400        5.02');
    expect(ocrNormalise('            3 None of the Above                                                       NOTAR          NOTA                40      40   0.41'))
      .toBe('            3 None of the Above                                                       NOTA          NOTA                40   0   40   0.41');
  });
  it('a row printing only zeros is a row of zeros (an unopposed seat)', () => {
    expect(ocrNormalise('              2 NABAM TUKI                               M 47           ST              INC         Hand                    0'))
      .toBe('              2 NABAM TUKI                               M 47           ST              INC         Hand   0   0   0   0.00');
  });
  it('a TURNOUT row printing only zeros is a row of zeros', () => {
    expect(ocrNormalise('       TURNOUT                                                      TOTAL:                    0          0'))
      .toBe('       TURNOUT                                                      TOTAL:   0   0   0   0.00');
  });
  it('reads l as I in a roman section number ("Ill. VOTERS", "lI(A). POLLING")', () => {
    expect(ocrNormalise('        Ill. VOTERS\n        lII(A). POLLING PERCENTAGE   0.00\n        Il. ELECTORS')).toBe('        III. VOTERS\n        III(A). POLLING PERCENTAGE   0.00\n        II. ELECTORS');
  });
});

describe('mergeOcr', () => {
  it('adds the second pass\'s tokens that the first pass missed, never a duplicate', () => {
    const full = '0.7347 0.0780 9.VOTES POLLED FOR NOTA\n0.7700 0.8900 446';
    const right = '0.7331 0.8931 56\n0.7702 0.8905 446';
    expect(mergeOcr(full, right)).toBe('0.7347 0.0780 9.VOTES POLLED FOR NOTA\n0.7700 0.8900 446\n0.7331 0.8931 56');
  });
  it('treats a token inside another token\'s width as a duplicate ("6021 70 6091" read as one token, then "70")', () => {
    expect(mergeOcr('0.30 0.60 6021 70 6091', '0.30 0.65 70\n0.30 0.85 36.04')).toBe('0.30 0.60 6021 70 6091\n0.30 0.85 36.04');
  });
  it('takes only numbers from the second pass (it is for missed figures, not for cut-off words)', () => {
    expect(mergeOcr('0.10 0.30 PERFORMANCE OF POLITICAL PARTIES', '0.10 0.62 TICAL PARTIES\n0.20 0.80 30.97%')).toBe('0.10 0.30 PERFORMANCE OF POLITICAL PARTIES\n0.20 0.80 30.97%');
  });
  it('puts back the space after a seat number in a Detailed Results header ("19.NYAPIN")', () => {
    expect(ocrNormalise('     Constituency                 19.NYAPIN (ST)        TOTAL ELECTORS:   11795')).toBe('     Constituency                 19. NYAPIN (ST)        TOTAL ELECTORS:   11795');
  });
  it('maps Cyrillic look-alikes back to Latin letters and digits ("З ТОКО" → "3 TOKO")', () => {
    expect(ocrNormalise('              З ТОКО SHEETAL      F    33   ST   PPA   Maize   414   4   418   1.23')).toBe('              3 TOKO SHEETAL      F    33   ST   PPA   Maize   414   4   418   1.23');
    expect(ocrNormalise('КAMTHOK')).toBe('KAMTHOK');
  });
  it('leaves a numbered party-list row alone (only summary labels get a 0)', () => {
    const row = '                        2.            INC                        Indian National Congress';
    expect(ocrNormalise(row)).toBe(row);
  });
});
