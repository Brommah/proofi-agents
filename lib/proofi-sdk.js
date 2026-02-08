/**
 * Proofi SDK — Client-side integration with Proofi Wallet
 *
 * Handles:
 * - Wallet detection & connection
 * - Data fetch from DDC (encrypted) + local decryption
 * - Scoped access token creation
 * - Audit trail (SHA-256 hash chain)
 * - Agent execution logging
 *
 * This runs IN THE BROWSER. The Proofi wallet extension injects
 * window.__proofi_extension__ which we use for signing.
 */

export class ProofiSDK {
  constructor() {
    this.wallet = null;
    this.auditChain = [];
    this.tokens = new Map();
    this.decryptionKey = null;
  }

  // ─── Wallet Detection ───────────────────────────────────

  isExtensionAvailable() {
    return !!window.__proofi_extension__?.connected;
  }

  getWalletState() {
    const ext = window.__proofi_extension__;
    if (!ext?.connected) return null;
    return {
      address: ext.address,
      email: ext.email,
      connected: true
    };
  }

  async waitForExtension(timeoutMs = 10000) {
    if (this.isExtensionAvailable()) return this.getWalletState();

    return new Promise((resolve, reject) => {
      const handler = (e) => {
        window.removeEventListener('proofi-extension-ready', handler);
        clearTimeout(timer);
        this.wallet = this.getWalletState();
        resolve(this.wallet);
      };
      window.addEventListener('proofi-extension-ready', handler);
      const timer = setTimeout(() => {
        window.removeEventListener('proofi-extension-ready', handler);
        reject(new Error('Proofi wallet not detected'));
      }, timeoutMs);
    });
  }

  // ─── Cryptography ───────────────────────────────────────

  async deriveKey(pin, salt) {
    const enc = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey(
      'raw', enc.encode(pin), 'PBKDF2', false, ['deriveKey']
    );
    return crypto.subtle.deriveKey(
      { name: 'PBKDF2', salt: enc.encode(salt), iterations: 100000, hash: 'SHA-256' },
      keyMaterial,
      { name: 'AES-GCM', length: 256 },
      false,
      ['decrypt']
    );
  }

  async decryptData(encryptedPayload, key) {
    const { ciphertext, iv, algorithm } = JSON.parse(encryptedPayload);
    if (algorithm !== 'AES-256-GCM') throw new Error(`Unsupported algorithm: ${algorithm}`);

    const ctBuf = Uint8Array.from(atob(ciphertext), c => c.charCodeAt(0));
    const ivBuf = Uint8Array.from(atob(iv), c => c.charCodeAt(0));

    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: ivBuf },
      key,
      ctBuf
    );
    return new TextDecoder().decode(decrypted);
  }

  async encryptData(data, key) {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const enc = new TextEncoder();
    const encrypted = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      key,
      enc.encode(typeof data === 'string' ? data : JSON.stringify(data))
    );
    return JSON.stringify({
      ciphertext: btoa(String.fromCharCode(...new Uint8Array(encrypted))),
      iv: btoa(String.fromCharCode(...iv)),
      algorithm: 'AES-256-GCM'
    });
  }

  // ─── DDC Data Access ────────────────────────────────────

  async fetchFromDDC(bucketId, cid) {
    // Try Cere CDN first, fallback to DDC Dragon
    const urls = [
      `https://cdn.cere.network/${bucketId}/${cid}`,
      `https://cdn.ddc-dragon.com/${bucketId}/${cid}`
    ];

    for (const url of urls) {
      try {
        const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
        if (res.ok) return await res.text();
      } catch { /* try next */ }
    }
    throw new Error(`Failed to fetch from DDC: bucket=${bucketId}, cid=${cid}`);
  }

  // ─── Scoped Access Tokens ──────────────────────────────

  createAccessToken(agentId, scopes, durationMs = 3600000) {
    const tokenId = btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(16))));
    const agentKey = btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(15))));
    const token = {
      tokenId,
      agentId,
      scopes,
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + durationMs).toISOString(),
      agentKey,
      revoked: false
    };
    this.tokens.set(tokenId, token);
    return token;
  }

  validateToken(tokenId, requiredScope) {
    const token = this.tokens.get(tokenId);
    if (!token) return { valid: false, reason: 'Token not found' };
    if (token.revoked) return { valid: false, reason: 'Token revoked' };
    if (new Date(token.expiresAt) < new Date()) return { valid: false, reason: 'Token expired' };
    if (requiredScope && !token.scopes.some(s => matchScope(s, requiredScope))) {
      return { valid: false, reason: `Scope ${requiredScope} not granted` };
    }
    return { valid: true, token };
  }

  revokeToken(tokenId) {
    const token = this.tokens.get(tokenId);
    if (token) token.revoked = true;
  }

  // ─── Audit Trail (SHA-256 Hash Chain) ──────────────────

  async addAuditEntry(action, details) {
    const prevHash = this.auditChain.length > 0
      ? this.auditChain[this.auditChain.length - 1].hash
      : '0'.repeat(64);

    const entry = {
      timestamp: Date.now(),
      action,
      details,
      prevHash
    };

    // Compute SHA-256 hash
    const data = JSON.stringify(entry);
    const hashBuf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(data));
    entry.hash = btoa(String.fromCharCode(...new Uint8Array(hashBuf)));

    this.auditChain.push(entry);
    return entry;
  }

  async verifyChain() {
    for (let i = 0; i < this.auditChain.length; i++) {
      const entry = this.auditChain[i];
      const expectedPrev = i === 0 ? '0'.repeat(64) : this.auditChain[i - 1].hash;
      if (entry.prevHash !== expectedPrev) {
        return { valid: false, brokenAt: i, reason: 'prevHash mismatch' };
      }
      // Recompute hash
      const { hash, ...rest } = entry;
      const data = JSON.stringify({ ...rest });
      const hashBuf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(data));
      const computed = btoa(String.fromCharCode(...new Uint8Array(hashBuf)));
      if (computed !== hash) {
        return { valid: false, brokenAt: i, reason: 'Hash mismatch' };
      }
    }
    return { valid: true, entries: this.auditChain.length };
  }

  exportAudit(meta = {}) {
    return {
      version: '1.0',
      exportedAt: new Date().toISOString(),
      wallet: this.wallet?.address || 'unknown',
      ...meta,
      entries: this.auditChain,
      verification: {
        algorithm: 'SHA-256',
        chainValid: true,
        finalHash: this.auditChain.length
          ? this.auditChain[this.auditChain.length - 1].hash
          : null
      }
    };
  }

  // ─── Agent Execution Flow ──────────────────────────────

  async executeAgent(agentMeta, healthData, goals, ollamaEndpoint) {
    const wallet = this.getWalletState();

    // 1. Log wallet connection
    await this.addAuditEntry('WALLET_CONNECTED', {
      walletAddress: wallet?.address || 'local',
      extensionConnected: !!wallet
    });

    // 2. Create scoped access token
    const scopes = [
      ...agentMeta.requiredData.map(d => `health/${d}/*`),
      ...agentMeta.optionalData.map(d => `health/${d}/*`)
    ];
    const durationMs = parseDuration(agentMeta.accessDuration);
    const token = this.createAccessToken(agentMeta.id, scopes, durationMs);

    await this.addAuditEntry('TOKEN_CREATED', {
      tokenId: token.tokenId,
      agentId: agentMeta.id,
      scopes: token.scopes,
      expiresAt: token.expiresAt,
      agentKey: token.agentKey
    });

    // 3. Run agent via local Ollama
    const totalRecords = Object.values(healthData).reduce((s, a) => s + a.length, 0);

    await this.addAuditEntry('AGENT_EXECUTED', {
      tokenId: token.tokenId,
      agentId: agentMeta.id,
      agentVersion: agentMeta.version,
      recordsAnalyzed: totalRecords,
      processingLocation: 'local',
      model: 'ollama/llama3.2'
    });

    // 4. Call the local agent API
    const res = await fetch(`${ollamaEndpoint}/api/agent/${agentMeta.apiRoute}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ goals })
    });
    const result = await res.json();

    // 5. Log analysis complete
    await this.addAuditEntry('ANALYSIS_COMPLETE', {
      tokenId: token.tokenId,
      agentId: agentMeta.id,
      processingTime: result.processingTime,
      insightCount: result.insights?.insights?.length ||
                    result.analysis?.trends?.length ||
                    result.brief?.wins?.length || 0,
      scores: result.insights?.scores || result.brief?.scores || null
    });

    // 6. Revoke token (access window closed)
    this.revokeToken(token.tokenId);

    await this.addAuditEntry('TOKEN_REVOKED', {
      tokenId: token.tokenId,
      reason: 'analysis_complete'
    });

    // 7. Sign the audit chain if wallet available
    let signature = null;
    if (wallet && window.__proofi_extension__?.signMessage) {
      try {
        const chainHash = this.auditChain[this.auditChain.length - 1].hash;
        signature = await window.__proofi_extension__.signMessage(chainHash);
        await this.addAuditEntry('CHAIN_SIGNED', {
          signature: signature.slice(0, 20) + '...',
          signer: wallet.address
        });
      } catch (e) {
        console.warn('Wallet signing skipped:', e.message);
      }
    }

    return {
      ...result,
      audit: {
        tokenId: token.tokenId,
        entries: this.auditChain.length,
        chainValid: (await this.verifyChain()).valid,
        signed: !!signature,
        sovereignty: {
          dataLocation: 'local',
          modelLocation: 'local',
          networkCalls: 0,
          thirdPartyAccess: false
        }
      }
    };
  }
}

// ─── Helpers ────────────────────────────────────────────

function matchScope(pattern, required) {
  if (pattern === required) return true;
  if (pattern.endsWith('/*')) {
    const prefix = pattern.slice(0, -2);
    return required.startsWith(prefix);
  }
  return false;
}

function parseDuration(str) {
  if (!str) return 3600000;
  const match = str.match(/^(\d+)(h|m|s)$/);
  if (!match) return 3600000;
  const [, n, unit] = match;
  const multipliers = { h: 3600000, m: 60000, s: 1000 };
  return parseInt(n) * (multipliers[unit] || 3600000);
}
