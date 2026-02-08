/**
 * Crypto utilities for capability token decryption
 * Ported from real-demo.html
 */

import nacl from 'tweetnacl';
import naclUtil from 'tweetnacl-util';

export interface WrappedDEK {
  ciphertext: string;
  ephemeralPublicKey: string;
  nonce: string;
}

export interface CapabilityToken {
  v: number;
  id: string;
  iss: string;
  sub: string;
  iat: number;
  exp: number;
  scopes: Array<{ path: string; permissions: string[] }>;
  bucketId: string;
  resources: string[];
  cdnUrl: string;
  wrappedDEK: WrappedDEK;
  sig: string;
  sigAlg: string;
}

/**
 * Unwrap DEK using agent's X25519 private key
 */
export function unwrapDEK(wrappedDEK: WrappedDEK, recipientPrivateKey: Uint8Array): Uint8Array {
  const ciphertext = naclUtil.decodeBase64(wrappedDEK.ciphertext);
  const ephemeralPubKey = naclUtil.decodeBase64(wrappedDEK.ephemeralPublicKey);
  const nonce = naclUtil.decodeBase64(wrappedDEK.nonce);
  
  const dek = nacl.box.open(ciphertext, nonce, ephemeralPubKey, recipientPrivateKey);
  
  if (!dek) {
    throw new Error('DEK unwrapping failed - invalid key or corrupted data');
  }
  
  return dek;
}

/**
 * Decrypt AES-256-GCM encrypted data
 */
export async function decryptAES(
  ciphertextB64: string, 
  ivB64: string, 
  key: Uint8Array
): Promise<string> {
  const ciphertext = naclUtil.decodeBase64(ciphertextB64);
  const iv = naclUtil.decodeBase64(ivB64);
  
  // Use Node.js crypto for AES-GCM
  const crypto = await import('crypto');
  
  // AES-GCM: last 16 bytes are the auth tag
  const authTag = ciphertext.slice(-16);
  const encryptedData = ciphertext.slice(0, -16);
  
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);
  
  const decrypted = Buffer.concat([
    decipher.update(encryptedData),
    decipher.final()
  ]);
  
  return decrypted.toString('utf-8');
}

/**
 * Verify Ed25519 signature on token
 */
export function verifyTokenSignature(token: CapabilityToken, issuerPublicKey: Uint8Array): boolean {
  const payload = { ...token };
  delete (payload as any).sig;
  delete (payload as any).sigAlg;
  
  const message = JSON.stringify(payload);
  const signature = naclUtil.decodeBase64(token.sig);
  const messageBytes = new TextEncoder().encode(message);
  
  return nacl.sign.detached.verify(messageBytes, signature, issuerPublicKey);
}

/**
 * Check if token is expired
 */
export function isTokenExpired(token: CapabilityToken): boolean {
  const now = Math.floor(Date.now() / 1000);
  return token.exp < now;
}

/**
 * Check if token grants access to a scope
 */
export function hasScope(token: CapabilityToken, requiredPath: string, permission: string = 'read'): boolean {
  return token.scopes.some(scope => 
    scope.path.includes(requiredPath) && scope.permissions.includes(permission)
  );
}
