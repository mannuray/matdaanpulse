import { BadRequestException, ConflictException, HttpException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

/**
 * Translate Prisma client errors into safe HTTP errors (review E-M1). Messages
 * are generic on purpose: no table, column, constraint or query text.
 * Returns null for anything that is not a mappable Prisma error (→ 500).
 */
export function mapPrismaError(err: unknown): HttpException | null {
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    switch (err.code) {
      case 'P2002':
        return new ConflictException('A record with the same unique value already exists');
      case 'P2025':
        return new NotFoundException('Record not found');
      case 'P2003':
        return new BadRequestException('A referenced record does not exist');
      case 'P2023':
        return new BadRequestException('Malformed identifier');
      default:
        return null;
    }
  }
  if (err instanceof Prisma.PrismaClientValidationError) {
    return new BadRequestException('Invalid request parameters');
  }
  return null;
}

/**
 * body-parser / http-errors style errors (e.g. PayloadTooLargeError from the
 * JSON limit) carry a safe 4xx `status` and `expose: true`; keep that status
 * instead of turning them into 500s.
 */
export function mapExposedHttpError(err: unknown): HttpException | null {
  if (!err || typeof err !== 'object') return null;
  const e = err as { status?: unknown; expose?: unknown; message?: unknown; type?: unknown };
  if (e.expose === true && typeof e.status === 'number' && e.status >= 400 && e.status < 500) {
    const message = e.type === 'entity.too.large' ? 'Request body too large' : String(e.message ?? 'Bad request');
    return new HttpException(message, e.status);
  }
  return null;
}
