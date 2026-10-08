/**
 * Create or update a SUPER_ADMIN user from environment variables.
 *
 *   ADMIN_EMAIL=you@example.com ADMIN_PASSWORD='long-password' npm run create-admin
 *
 * Reads backend/.env if present. Idempotent: re-running updates the password,
 * and promotes the user to SUPER_ADMIN if it already exists.
 */
import * as path from 'path';
import { config as loadEnv } from 'dotenv';
import * as bcrypt from 'bcrypt';
import { PrismaClient } from '@prisma/client';

loadEnv({ path: path.resolve(__dirname, '..', '.env') });

const MIN_PASSWORD_LENGTH = 8; // must match LoginDto's MinLength
const MAX_PASSWORD_BYTES = 72; // must match LoginDto's PasswordMaxLength (bcrypt's input limit)

async function main() {
  const email = process.env.ADMIN_EMAIL?.trim(); // stored as-is: login matches email exactly
  const password = process.env.ADMIN_PASSWORD;
  const name = process.env.ADMIN_NAME?.trim() || 'Administrator';

  if (!email || !password) {
    throw new Error('ADMIN_EMAIL and ADMIN_PASSWORD must be set');
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error(`ADMIN_EMAIL is not a valid email: ${email}`);
  }
  if (password.length < MIN_PASSWORD_LENGTH) {
    throw new Error(`ADMIN_PASSWORD must be at least ${MIN_PASSWORD_LENGTH} characters`);
  }
  if (password.length > MAX_PASSWORD_BYTES || Buffer.byteLength(password, 'utf8') > MAX_PASSWORD_BYTES) {
    // bcrypt ignores everything past 72 bytes, and LoginDto refuses longer passwords.
    throw new Error(`ADMIN_PASSWORD must be at most ${MAX_PASSWORD_BYTES} characters / bytes`);
  }

  const prisma = new PrismaClient();
  try {
    const password_hash = await bcrypt.hash(password, 10);
    const existing = await prisma.users.findUnique({ where: { email } });
    const user = await prisma.users.upsert({
      where: { email },
      update: { password_hash, role: 'SUPER_ADMIN' },
      create: { email, password_hash, name, role: 'SUPER_ADMIN' },
      select: { id: true, email: true, role: true },
    });
    console.log(`${existing ? 'Updated' : 'Created'} ${user.role} ${user.email} (${user.id})`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(`create-admin failed: ${(err as Error).message}`);
  process.exit(1);
});
