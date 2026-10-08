import { createHash } from 'crypto';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { FeedbackService, DEV_FEEDBACK_IP_SALT, USER_AGENT_MAX } from './feedback.service';
import { FeedbackController } from './feedback.controller';
import { CreateFeedbackDto } from './dto/feedback.dto';
import { FeedbackNotFoundException } from '../../common/exceptions';
import { Paginated } from '../../common/paginated';

const ROW = {
  id: 'f1',
  kind: 'bug',
  message: 'Map does not load',
  email: null,
  page: '/elections/x',
  status: 'new',
  created_at: new Date('2026-10-01T10:00:00Z'),
};

function make(env: Record<string, string | undefined> = { FEEDBACK_IP_SALT: 'test-salt' }) {
  const prisma: any = {
    feedback: {
      create: jest.fn(async () => ({ id: 'f1' })),
      count: jest.fn(async () => 1),
      findMany: jest.fn(async () => [ROW]),
      findUnique: jest.fn(async ({ where }: any) => (where.id === 'f1' ? { id: 'f1', status: 'new' } : null)),
      update: jest.fn(async ({ data }: any) => ({ ...ROW, ...data })),
    },
  };
  const config: any = { get: (k: string) => env[k] };
  const audit = { log: jest.fn(async () => undefined) };
  return { svc: new FeedbackService(prisma, config, audit as any), prisma, audit };
}

/** DTO as the global ValidationPipe produces it (transform + whitelist). */
function dto(body: Record<string, unknown>) {
  const out = plainToInstance(CreateFeedbackDto, body);
  return { out, errors: validateSync(out, { whitelist: true, forbidNonWhitelisted: true }) };
}

describe('CreateFeedbackDto', () => {
  it('trims the message and treats an empty email/page as absent', () => {
    const { out, errors } = dto({ kind: 'bug', message: '  hello there  ', email: '', page: '  ', website: '' });
    expect(errors).toEqual([]);
    expect(out.message).toBe('hello there');
    expect(out.email).toBeUndefined();
    expect(out.page).toBeUndefined();
  });

  it.each([
    ['an unknown kind', 'kind', { kind: 'spam', message: 'hello there' }],
    ['a message under 5 chars after trimming', 'message', { kind: 'bug', message: '   hi   ' }],
    ['a message over 2000 chars', 'message', { kind: 'bug', message: 'x'.repeat(2001) }],
    ['an invalid email', 'email', { kind: 'bug', message: 'hello there', email: 'not-an-email' }],
    ['a page over 500 chars', 'page', { kind: 'bug', message: 'hello there', page: '/' + 'p'.repeat(500) }],
    ['an unknown field', 'extra', { kind: 'bug', message: 'hello there', extra: 1 }],
  ])('rejects %s (%s)', (_label, field, body) => {
    expect(dto(body).errors.map((e) => e.property)).toContain(field);
  });
});

describe('FeedbackService.submit', () => {
  it('stores the feedback with a salted sha256 of the IP, never the raw IP', async () => {
    const { svc, prisma } = make({ FEEDBACK_IP_SALT: 'pepper' });
    await expect(
      svc.submit({ kind: 'bug', message: 'Map does not load', page: '/x' }, { ip: '198.51.100.7', userAgent: 'UA' }),
    ).resolves.toEqual({ ok: true });
    const { data } = prisma.feedback.create.mock.calls[0][0];
    expect(data.ip_hash).toBe(createHash('sha256').update('pepper198.51.100.7').digest('hex'));
    expect(JSON.stringify(data)).not.toContain('198.51.100.7');
    expect(data).toMatchObject({ kind: 'bug', message: 'Map does not load', email: null, page: '/x', user_agent: 'UA' });
  });

  it('falls back to the dev salt when FEEDBACK_IP_SALT is unset', async () => {
    const { svc } = make({});
    expect(svc.hashIp('10.0.0.1')).toBe(createHash('sha256').update(DEV_FEEDBACK_IP_SALT + '10.0.0.1').digest('hex'));
    expect(svc.hashIp(undefined)).toBeNull();
  });

  it('stores an empty-string email as null', async () => {
    const { svc, prisma } = make();
    await svc.submit({ kind: 'other', message: 'hello there', email: '' }, {});
    expect(prisma.feedback.create.mock.calls[0][0].data.email).toBeNull();
  });

  it('truncates the user agent', async () => {
    const { svc, prisma } = make();
    await svc.submit({ kind: 'other', message: 'hello there' }, { userAgent: 'u'.repeat(1000) });
    expect(prisma.feedback.create.mock.calls[0][0].data.user_agent).toHaveLength(USER_AGENT_MAX);
  });

  it('a filled honeypot answers ok but stores nothing', async () => {
    const { svc, prisma } = make();
    await expect(svc.submit({ kind: 'bug', message: 'buy now', website: 'http://spam' }, { ip: '1.2.3.4' })).resolves.toEqual({ ok: true });
    expect(prisma.feedback.create).not.toHaveBeenCalled();
  });

  it('a whitespace-only honeypot counts as empty', async () => {
    const { svc, prisma } = make();
    await svc.submit({ kind: 'bug', message: 'hello there', website: '  ' }, {});
    expect(prisma.feedback.create).toHaveBeenCalled();
  });
});

describe('FeedbackService admin', () => {
  it('lists newest first as a Paginated of camelCase items', async () => {
    const { svc, prisma } = make();
    const out = await svc.list(2, 10, 'new');
    expect(out).toBeInstanceOf(Paginated);
    expect(out.meta).toEqual({ page: 2, limit: 10, total: 1 });
    expect(out.data[0]).toEqual({
      id: 'f1', kind: 'bug', message: 'Map does not load', email: null, page: '/elections/x', status: 'new', createdAt: ROW.created_at,
    });
    expect(prisma.feedback.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { status: 'new' }, orderBy: { created_at: 'desc' }, skip: 10, take: 10 }),
    );
  });

  it('lists every status when none is given', async () => {
    const { svc, prisma } = make();
    await svc.list(1, 50);
    expect(prisma.feedback.count).toHaveBeenCalledWith({ where: {} });
  });

  it('updates the status and returns the item', async () => {
    const { svc } = make();
    await expect(svc.updateStatus('f1', 'resolved')).resolves.toMatchObject({ id: 'f1', status: 'resolved' });
  });

  it('404s for an unknown id', async () => {
    const { svc, prisma } = make();
    await expect(svc.updateStatus('nope', 'read')).rejects.toBeInstanceOf(FeedbackNotFoundException);
    expect(prisma.feedback.update).not.toHaveBeenCalled();
  });
});

describe('FeedbackController', () => {
  it('passes req.ip and the user agent to the service', async () => {
    const service = { submit: jest.fn(async () => ({ ok: true })) };
    const body = { kind: 'bug', message: 'hello there' } as CreateFeedbackDto;
    await new FeedbackController(service as any).create(body, { ip: '203.0.113.5', headers: { 'user-agent': 'UA' } } as any);
    expect(service.submit).toHaveBeenCalledWith(body, { ip: '203.0.113.5', userAgent: 'UA' });
  });
});

describe('FeedbackService.updateStatus audit (U2)', () => {
  it('writes FEEDBACK_UPDATE with the old and new status', async () => {
    const { svc, audit } = make();
    await svc.updateStatus('f1', 'resolved', 'u1');
    expect(audit.log).toHaveBeenCalledWith({ userId: 'u1', action: 'FEEDBACK_UPDATE', entityType: 'feedback', entityId: 'f1', oldValue: { status: 'new' }, newValue: { status: 'resolved' } });
  });
});
