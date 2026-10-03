export interface Credit { source_url: string; author: string | null; licence: string }
export interface Profile { key: string; wikidata: string; date_of_birth: string | null; gender: 'M' | 'F' | 'O' | null; wikipedia_url: string | null; photo_url: string | null; credit: Credit | null }

type Any = Record<string, any>;
const first = (claims: Any, p: string) => claims?.[p]?.[0]?.mainsnak?.datavalue?.value;
const SEX: Record<string, 'M' | 'F' | 'O'> = { Q6581097: 'M', Q6581072: 'F', Q1097630: 'O', Q48270: 'O' };

export const stripHtml = (s: string) => s.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/\s+/g, ' ').trim();

export function readEntity(entity: unknown) {
  const e = entity as Any;
  const birth = first(e.claims, 'P569') as { time?: string; precision?: number } | undefined;
  // precision 11 = day; a year- or month-precise value (9/10) is stored as -01-01 and must not read as a birth date.
  const time = birth && (birth.precision === undefined || birth.precision >= 11) ? birth.time : undefined;
  const m = time ? /^\+(\d{4})-(\d{2})-(\d{2})T/.exec(time) : null;
  const dob = m && m[2] !== '00' && m[3] !== '00' ? `${m[1]}-${m[2]}-${m[3]}` : null;
  const title: string | undefined = e.sitelinks?.enwiki?.title;
  return {
    image: (first(e.claims, 'P18') as string | undefined) ?? null,
    dob,
    gender: SEX[first(e.claims, 'P21')?.id as string] ?? null,
    enwiki: title ? `https://en.wikipedia.org/wiki/${encodeURIComponent(title.replace(/ /g, '_'))}` : null,
  };
}

export function readImageInfo(page: unknown): { thumbUrl: string; credit: Credit } | null {
  const ii = (page as Any)?.imageinfo?.[0];
  const licence = ii?.extmetadata?.LicenseShortName?.value as string | undefined;
  if (!ii?.thumburl || !ii?.descriptionurl || !licence) return null;
  const artist = ii.extmetadata?.Artist?.value as string | undefined;
  return { thumbUrl: ii.thumburl, credit: { source_url: ii.descriptionurl, author: artist ? stripHtml(artist) || null : null, licence: stripHtml(licence) } };
}
