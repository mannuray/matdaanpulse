import { ElectionsService } from './elections.service';

describe('ElectionsService.parseManifest', () => {
  const svc = new ElectionsService({} as any);

  it('parses JSON text into an object', () => {
    expect(svc.parseManifest('{"a":[1,2]}')).toEqual({ a: [1, 2] });
  });

  it('returns null for absent, empty, bad or non-object values without throwing', () => {
    for (const v of [null, undefined, '', '{not json', '"str"', '5', 'null']) expect(svc.parseManifest(v)).toBeNull();
  });
});
