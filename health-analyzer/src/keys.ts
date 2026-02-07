/**
 * Agent Keypair Management
 * 
 * Generates and manages the agent's X25519 keypair used for:
 * - Receiving encrypted DEKs from users
 * - Decrypting user data
 */

import fs from 'fs';
import path from 'path';
import nacl from 'tweetnacl';
import naclUtil from 'tweetnacl-util';

const { encodeBase64, decodeBase64 } = naclUtil;

/** Keypair structure stored on disk */
interface StoredKeypair {
  publicKey: string;  // Base64 encoded
  privateKey: string; // Base64 encoded
  createdAt: string;
  algorithm: string;
}

/** Keypair in memory */
export interface AgentKeypair {
  publicKey: Uint8Array;
  privateKey: Uint8Array;
}

const KEYS_DIR = path.join(process.cwd(), 'keys');
const KEYPAIR_FILE = path.join(KEYS_DIR, 'agent-keypair.json');

/**
 * Ensure keys directory exists
 */
function ensureKeysDir(): void {
  if (!fs.existsSync(KEYS_DIR)) {
    fs.mkdirSync(KEYS_DIR, { recursive: true });
    console.log('[keys] Created keys directory:', KEYS_DIR);
  }
}

/**
 * Generate a new X25519 keypair
 */
export function generateKeypair(): AgentKeypair {
  const keypair = nacl.box.keyPair();
  return {
    publicKey: keypair.publicKey,
    privateKey: keypair.secretKey,
  };
}

/**
 * Save keypair to disk
 */
function saveKeypair(keypair: AgentKeypair): void {
  ensureKeysDir();
  
  const stored: StoredKeypair = {
    publicKey: encodeBase64(keypair.publicKey),
    privateKey: encodeBase64(keypair.privateKey),
    createdAt: new Date().toISOString(),
    algorithm: 'X25519',
  };
  
  fs.writeFileSync(KEYPAIR_FILE, JSON.stringify(stored, null, 2));
  
  // Set restrictive permissions (owner read/write only)
  try {
    fs.chmodSync(KEYPAIR_FILE, 0o600);
  } catch {
    // chmod may not work on Windows
  }
  
  console.log('[keys] Saved new keypair to:', KEYPAIR_FILE);
}

/**
 * Load keypair from disk
 */
function loadKeypair(): AgentKeypair | null {
  if (!fs.existsSync(KEYPAIR_FILE)) {
    return null;
  }
  
  try {
    const content = fs.readFileSync(KEYPAIR_FILE, 'utf-8');
    const stored: StoredKeypair = JSON.parse(content);
    
    return {
      publicKey: decodeBase64(stored.publicKey),
      privateKey: decodeBase64(stored.privateKey),
    };
  } catch (error) {
    console.error('[keys] Failed to load keypair:', error);
    return null;
  }
}

/**
 * Get or create agent keypair
 * 
 * On first run, generates a new keypair and saves it.
 * On subsequent runs, loads the existing keypair.
 */
export function getOrCreateKeypair(): AgentKeypair {
  let keypair = loadKeypair();
  
  if (keypair) {
    console.log('[keys] Loaded existing keypair');
    return keypair;
  }
  
  console.log('[keys] Generating new X25519 keypair...');
  keypair = generateKeypair();
  saveKeypair(keypair);
  
  return keypair;
}

/**
 * Get public key as base64 string
 */
export function getPublicKeyBase64(keypair: AgentKeypair): string {
  return encodeBase64(keypair.publicKey);
}

/**
 * Get private key as base64 string
 */
export function getPrivateKeyBase64(keypair: AgentKeypair): string {
  return encodeBase64(keypair.privateKey);
}

/**
 * Delete keypair (for testing/reset)
 */
export function deleteKeypair(): boolean {
  if (fs.existsSync(KEYPAIR_FILE)) {
    fs.unlinkSync(KEYPAIR_FILE);
    console.log('[keys] Deleted keypair');
    return true;
  }
  return false;
}
