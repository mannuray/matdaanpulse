import { prismaLogConfig } from './prisma.service';

describe('prismaLogConfig', () => {
  it('enables query events only when LOG_LEVEL=debug', () => {
    expect(prismaLogConfig('debug')).toContainEqual({ emit: 'event', level: 'query' });
    expect(prismaLogConfig('info')).not.toContainEqual({ emit: 'event', level: 'query' });
    expect(prismaLogConfig(undefined)).not.toContainEqual({ emit: 'event', level: 'query' });
  });
});
