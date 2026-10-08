import { electionIdOf, redactUrl } from './logging.middleware';

describe('access log helpers', () => {
  it('picks the election id out of a public /elections/:id path, lower-cased', () => {
    const id = 'B2C3D4E5-F6A7-8901-BCDE-F12345678901';
    expect(electionIdOf(`/api/v1/elections/${id}/live`)).toBe(id.toLowerCase());
    expect(electionIdOf(`/api/v1/elections/${id.toLowerCase()}`)).toBe(id.toLowerCase());
    expect(electionIdOf(`/api/v1/elections/${id.toLowerCase()}?v=3`)).toBe(id.toLowerCase());
    expect(electionIdOf('/api/v1/elections/not-a-uuid/live')).toBeUndefined();
    expect(electionIdOf('/api/v1/parties')).toBeUndefined();
  });

  it('masks credential-like query params', () => {
    expect(redactUrl('/x?token=abc&v=2&api_key=k')).toBe('/x?token=[REDACTED]&v=2&api_key=[REDACTED]');
  });
});
