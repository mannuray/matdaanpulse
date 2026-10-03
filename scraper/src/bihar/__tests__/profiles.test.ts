import { describe, it, expect } from 'vitest';
import { readEntity, readImageInfo, stripHtml } from '../profiles';

describe('readEntity', () => {
  it('reads image, birth date, sex and the English Wikipedia link', () => {
    const e = { claims: {
      P18: [{ mainsnak: { datavalue: { value: 'Tejaswi Yadav 2023.jpg' } } }],
      P569: [{ mainsnak: { datavalue: { value: { time: '+1988-11-09T00:00:00Z' } } } }],
      P21: [{ mainsnak: { datavalue: { value: { id: 'Q6581097' } } } }],
    }, sitelinks: { enwiki: { title: 'Tejashwi Yadav' } } };
    expect(readEntity(e)).toEqual({ image: 'Tejaswi Yadav 2023.jpg', dob: '1988-11-09', gender: 'M', enwiki: 'https://en.wikipedia.org/wiki/Tejashwi_Yadav' });
  });
  it('tolerates missing claims and year-only dates', () => {
    expect(readEntity({ claims: { P569: [{ mainsnak: { datavalue: { value: { time: '+1951-00-00T00:00:00Z' } } } }] } }))
      .toEqual({ image: null, dob: null, gender: null, enwiki: null });
  });
});

describe('readImageInfo', () => {
  const page = { imageinfo: [{ thumburl: 'https://upload.wikimedia.org/x.jpg', descriptionurl: 'https://commons.wikimedia.org/wiki/File:X.jpg',
    extmetadata: { LicenseShortName: { value: 'CC BY-SA 4.0' }, Artist: { value: '<a href="//commons.wikimedia.org/wiki/User:A">A. Photographer</a>' } } }] };
  it('reads the thumbnail and the credit, stripping HTML from the author', () => {
    expect(readImageInfo(page)).toEqual({ thumbUrl: 'https://upload.wikimedia.org/x.jpg', credit: { source_url: 'https://commons.wikimedia.org/wiki/File:X.jpg', author: 'A. Photographer', licence: 'CC BY-SA 4.0' } });
  });
  it('refuses an image without a licence', () => {
    const p = JSON.parse(JSON.stringify(page)); delete p.imageinfo[0].extmetadata.LicenseShortName;
    expect(readImageInfo(p)).toBeNull();
  });
});

describe('stripHtml', () => {
  it('removes tags and entities', () => { expect(stripHtml('<b>Govt&nbsp;of Bihar</b> &amp; IPRD')).toBe('Govt of Bihar & IPRD'); });
});
