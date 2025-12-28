import { cookies } from 'next/headers';
import crypto from 'crypto';

function getEncryptionKey(): string {
  const key = process.env.SESSION_ENCRYPTION_KEY;

  if (!key) {
    throw new Error('SESSION_ENCRYPTION_KEY environment variable is required');
  }

  // Validate key length: must be 64-char hex string (32 bytes)
  if (!/^[a-fA-F0-9]{64}$/.test(key)) {
    throw new Error('SESSION_ENCRYPTION_KEY must be a 64-character hex string (32 bytes)');
  }

  return key;
}

const ALGORITHM = 'aes-256-gcm';

interface SessionData {
  userId: string;
  githubId: number;
  githubLogin: string;
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
}

function encrypt(data: string): string {
  const iv = crypto.randomBytes(16);
  const key = Buffer.from(getEncryptionKey(), 'hex');
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(data, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  const authTag = cipher.getAuthTag();

  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
}

function decrypt(encryptedData: string): string {
  const [ivHex, authTagHex, encrypted] = encryptedData.split(':');
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');
  const key = Buffer.from(getEncryptionKey(), 'hex');

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}

export async function setSession(data: SessionData): Promise<void> {
  const cookieStore = await cookies();
  const encrypted = encrypt(JSON.stringify(data));

  cookieStore.set('session', encrypted, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7, // 7 days
  });
}

export async function getSession(): Promise<SessionData | null> {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get('session');

  if (!sessionCookie) return null;

  try {
    return JSON.parse(decrypt(sessionCookie.value));
  } catch {
    return null;
  }
}

export async function clearSession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete('session');
}
