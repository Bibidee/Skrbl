'use client';

/**
 * Client-side embedded-wallet cryptography.
 *
 * A random private key is generated in the browser at signup, then encrypted
 * with a key derived from the user's password (PBKDF2 -> AES-GCM). Only the
 * encrypted blob is ever sent to the server. The plaintext key lives only in
 * memory for the duration of the session and is never logged or persisted.
 */
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import type { PrivateKeyAccount } from 'viem';

export type EncryptedWallet = {
  /** AES-GCM ciphertext of the 0x-prefixed private key, base64. */
  ciphertext: string;
  /** 12-byte AES-GCM IV, base64. */
  iv: string;
  /** 16-byte PBKDF2 salt, base64. */
  salt: string;
  /** PBKDF2 iteration count (stored so we can raise it later without breaking old blobs). */
  iterations: number;
  /** Schema version for forward-compat. */
  v: 1;
};

const PBKDF2_ITERATIONS = 310_000;
const enc = new TextEncoder();
const dec = new TextDecoder();

// Web Crypto's BufferSource typing in recent TS libs rejects the generic
// Uint8Array<ArrayBufferLike>; this narrows it for the subtle-crypto calls.
const bs = (u: Uint8Array): BufferSource => u as unknown as BufferSource;

function toBase64(bytes: ArrayBuffer | Uint8Array): string {
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let bin = '';
  for (const b of arr) bin += String.fromCharCode(b);
  return btoa(bin);
}

function fromBase64(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function deriveAesKey(password: string, salt: Uint8Array, iterations: number): Promise<CryptoKey> {
  const baseKey = await crypto.subtle.importKey(
    'raw',
    bs(enc.encode(password)),
    'PBKDF2',
    false,
    ['deriveKey'],
  );
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: bs(salt), iterations, hash: 'SHA-256' },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

/** Generates a fresh random wallet. Returns the private key and its address. */
export function generateWallet(): { privateKey: `0x${string}`; address: `0x${string}` } {
  const privateKey = generatePrivateKey();
  const account = privateKeyToAccount(privateKey);
  return { privateKey, address: account.address };
}

/** Encrypts a private key with a password-derived AES key. */
export async function encryptPrivateKey(
  privateKey: `0x${string}`,
  password: string,
): Promise<EncryptedWallet> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveAesKey(password, salt, PBKDF2_ITERATIONS);
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: bs(iv) },
    key,
    bs(enc.encode(privateKey)),
  );
  return {
    ciphertext: toBase64(ciphertext),
    iv: toBase64(iv),
    salt: toBase64(salt),
    iterations: PBKDF2_ITERATIONS,
    v: 1,
  };
}

/** Decrypts a private key. Throws if the password is wrong (GCM auth failure). */
export async function decryptPrivateKey(
  blob: EncryptedWallet,
  password: string,
): Promise<`0x${string}`> {
  const salt = fromBase64(blob.salt);
  const iv = fromBase64(blob.iv);
  const key = await deriveAesKey(password, salt, blob.iterations ?? PBKDF2_ITERATIONS);
  let plain: ArrayBuffer;
  try {
    plain = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: bs(iv) },
      key,
      bs(fromBase64(blob.ciphertext)),
    );
  } catch {
    throw new Error('WRONG_PASSWORD');
  }
  const pk = dec.decode(plain);
  if (!/^0x[0-9a-fA-F]{64}$/.test(pk)) throw new Error('CORRUPT_KEY');
  return pk as `0x${string}`;
}

/** Builds a viem account from a decrypted private key (for signing). */
export function accountFromPrivateKey(privateKey: `0x${string}`): PrivateKeyAccount {
  return privateKeyToAccount(privateKey);
}
