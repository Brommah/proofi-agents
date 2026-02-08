/**
 * Audit Log System
 * 
 * FULL TRANSPARENCY — Every operation is logged and can be verified by the user.
 * Logs are encrypted with user's DEK and stored in their vault.
 * 
 * NO BLACK BOX.
 */

import { createHash } from 'crypto';

// ============================================================================
// TYPES
// ============================================================================

export interface AuditEntry {
  id: string;
  timestamp: string;
  action: AuditAction;
  details: Record<string, unknown>;
  hashes: {
    input?: string;   // SHA-256 of input data
    output?: string;  // SHA-256 of output data
  };
  duration_ms?: number;
}

export type AuditAction = 
  | 'token_received'
  | 'token_validated'
  | 'token_rejected'
  | 'dek_unwrapped'
  | 'data_fetched'
  | 'data_decrypted'
  | 'inference_started'
  | 'inference_completed'
  | 'output_encrypted'
  | 'output_stored'
  | 'error';

// ============================================================================
// AUDIT LOG
// ============================================================================

class AuditLog {
  private entries: AuditEntry[] = [];
  private sessionId: string;

  constructor() {
    this.sessionId = `audit_${Date.now()}_${randomId()}`;
  }

  /**
   * Log an action with full details
   */
  log(action: AuditAction, details: Record<string, unknown> = {}, hashes: AuditEntry['hashes'] = {}): AuditEntry {
    const entry: AuditEntry = {
      id: `${this.sessionId}_${this.entries.length}`,
      timestamp: new Date().toISOString(),
      action,
      details,
      hashes,
    };

    this.entries.push(entry);
    
    // Console log for visibility
    console.log(`[AUDIT] ${entry.timestamp} | ${action} |`, JSON.stringify(details));
    
    return entry;
  }

  /**
   * Log with timing
   */
  logWithTiming(action: AuditAction, startTime: number, details: Record<string, unknown> = {}, hashes: AuditEntry['hashes'] = {}): AuditEntry {
    const entry = this.log(action, details, hashes);
    entry.duration_ms = Date.now() - startTime;
    return entry;
  }

  /**
   * Get all entries (for returning to user)
   */
  getEntries(): AuditEntry[] {
    return [...this.entries];
  }

  /**
   * Get summary for user
   */
  getSummary(): {
    sessionId: string;
    totalOperations: number;
    actions: Record<string, number>;
    entries: AuditEntry[];
  } {
    const actions: Record<string, number> = {};
    for (const entry of this.entries) {
      actions[entry.action] = (actions[entry.action] || 0) + 1;
    }

    return {
      sessionId: this.sessionId,
      totalOperations: this.entries.length,
      actions,
      entries: this.entries,
    };
  }

  /**
   * Clear log (for new session)
   */
  clear(): void {
    this.entries = [];
    this.sessionId = `audit_${Date.now()}_${randomId()}`;
  }
}

// ============================================================================
// HASH UTILITIES
// ============================================================================

/**
 * SHA-256 hash of data (for audit trail)
 * User can verify: "the agent saw data with this hash"
 */
export function hashData(data: unknown): string {
  const str = typeof data === 'string' ? data : JSON.stringify(data);
  return createHash('sha256').update(str).digest('hex');
}

/**
 * Generate random ID
 */
function randomId(): string {
  return Math.random().toString(36).substring(2, 10);
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

export const auditLog = new AuditLog();

// ============================================================================
// CONVENIENCE FUNCTIONS
// ============================================================================

export function logTokenReceived(tokenId: string, issuer: string): AuditEntry {
  return auditLog.log('token_received', {
    tokenId,
    issuer,
    note: 'Token received from user, beginning validation',
  });
}

export function logTokenValidated(tokenId: string, scopes: string[], expiresIn: number): AuditEntry {
  return auditLog.log('token_validated', {
    tokenId,
    scopes,
    expiresIn_seconds: Math.round(expiresIn / 1000),
    note: 'Token signature and expiry verified',
  });
}

export function logTokenRejected(reason: string): AuditEntry {
  return auditLog.log('token_rejected', {
    reason,
    note: 'Token rejected, no data accessed',
  });
}

export function logDEKUnwrapped(): AuditEntry {
  return auditLog.log('dek_unwrapped', {
    note: 'DEK successfully unwrapped using agent private key',
  });
}

export function logDataFetched(path: string, ciphertextHash: string): AuditEntry {
  return auditLog.log('data_fetched', {
    path,
    ciphertextHash,
    note: 'Encrypted data fetched from DDC',
  });
}

export function logDataDecrypted(path: string, plaintextHash: string): AuditEntry {
  return auditLog.log('data_decrypted', {
    path,
    plaintextHash,
    note: 'Data decrypted in memory (never stored to disk)',
  });
}

export function logInferenceStarted(model: string, inputHash: string): AuditEntry {
  return auditLog.log('inference_started', {
    model,
    inputHash,
    note: 'Sending data to AI model for analysis',
  });
}

export function logInferenceCompleted(model: string, outputHash: string, tokensUsed: number): AuditEntry {
  return auditLog.log('inference_completed', {
    model,
    outputHash,
    tokensUsed,
    note: 'AI analysis complete, output received',
  });
}

export function logOutputEncrypted(path: string, ciphertextHash: string): AuditEntry {
  return auditLog.log('output_encrypted', {
    path,
    ciphertextHash,
    note: 'Output encrypted with user DEK before storage',
  });
}

export function logOutputStored(path: string): AuditEntry {
  return auditLog.log('output_stored', {
    path,
    note: 'Encrypted output stored in user vault on DDC',
  });
}

export function logError(error: string, context?: Record<string, unknown>): AuditEntry {
  return auditLog.log('error', {
    error,
    ...context,
    note: 'Error occurred during processing',
  });
}
