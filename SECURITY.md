# Security Policy

## 🔐 The Proofi Agent Security Model

Proofi Agents operate on a **zero-trust, capability-based** security model. This document outlines the security requirements, threat model, and responsible disclosure process.

## Core Principles

### 1. Minimal Access

Agents receive only the data they need, for only as long as they need it.

```
❌ Traditional: "Give me access to your entire Google account"
✅ Proofi: "Give me read access to health/steps/* for 24 hours"
```

### 2. Cryptographic Enforcement

Access control isn't just policy — it's cryptography:

- User data is **encrypted at rest** in DDC
- Agent receives a **wrapped DEK** (Data Encryption Key)
- DEK is encrypted with the agent's public key
- Only the intended agent can unwrap and decrypt

### 3. Stateless Processing

Agents process data in-memory and return insights. They do NOT:

- Store user data on disk
- Cache data between requests
- Log raw data values
- Transmit data to third parties

### 4. Time-Limited Tokens

Every capability token has an expiration. Typical lifetimes:

| Use Case | Typical TTL |
|----------|-------------|
| One-time analysis | 1 hour |
| Daily health check | 24 hours |
| Ongoing monitoring | 7 days (with refresh) |

## Threat Model

### What We Protect Against

| Threat | Mitigation |
|--------|------------|
| Unauthorized data access | Scoped tokens, cryptographic enforcement |
| Token replay | Expiration, (future: nonces) |
| Agent key compromise | Key rotation, limited scope per token |
| Data exfiltration | Memory-only processing, output validation |
| Man-in-the-middle | TLS everywhere, signed tokens (future) |

### Trust Boundaries

```
┌─────────────────────────────────────────────────────────────┐
│ USER CONTROL (Trusted)                                      │
│ ┌─────────────┐    ┌─────────────┐    ┌─────────────┐      │
│ │ Proofi App  │    │   Vault     │    │ Token Grant │      │
│ └─────────────┘    └─────────────┘    └─────────────┘      │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼ Token (with wrapped DEK)
┌─────────────────────────────────────────────────────────────┐
│ AGENT BOUNDARY (Semi-trusted)                               │
│ ┌─────────────┐    ┌─────────────┐    ┌─────────────┐      │
│ │ Validate    │ →  │  Decrypt    │ →  │  Analyze    │      │
│ │ Token       │    │  Data       │    │  (in-mem)   │      │
│ └─────────────┘    └─────────────┘    └─────────────┘      │
│                                              │              │
│                                              ▼              │
│                                       ┌─────────────┐      │
│                                       │  Return     │      │
│                                       │  Insights   │      │
│                                       └─────────────┘      │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼ Insights only (no raw data)
┌─────────────────────────────────────────────────────────────┐
│ USER RECEIVES                                               │
└─────────────────────────────────────────────────────────────┘
```

## Agent Security Requirements

### MUST Implement

1. **Token Validation**
   ```typescript
   function validateToken(token: CapabilityToken): void {
     if (Date.now() > token.expiresAt) {
       throw new Error('Token expired');
     }
     if (token.subject !== getAgentPublicKey()) {
       throw new Error('Token not issued for this agent');
     }
   }
   ```

2. **Scope Enforcement**
   ```typescript
   function checkScope(token: CapabilityToken, path: string, permission: 'read' | 'write'): boolean {
     return token.scopes.some(scope => 
       matchPath(scope.path, path) && scope.permissions.includes(permission)
     );
   }
   ```

3. **Private Key Protection**
   - Store in `keys/` directory (gitignored)
   - Set file permissions to `600`
   - Never log the private key
   - Never include in error messages

4. **No Raw Data Logging**
   ```typescript
   // ❌ NEVER
   console.log('User data:', userData);
   
   // ✅ OK
   console.log('Processing', Object.keys(userData).length, 'categories');
   ```

### MUST NOT Do

- ❌ Store user data on disk
- ❌ Send user data to external services (except DDC write-back if scoped)
- ❌ Cache data between requests
- ❌ Log personally identifiable information
- ❌ Expose raw data in responses (only insights)

## Key Management

### Agent Keypair

```
keys/
└── agent-keypair.json    # { publicKey: "...", secretKey: "..." }
```

- Generated on first run if not exists
- File permissions: `chmod 600 keys/agent-keypair.json`
- **Never commit to git**
- Back up securely for production

### Key Rotation

If you suspect key compromise:

1. Generate new keypair
2. Update `/agent-info` endpoint
3. Notify users to re-grant tokens
4. Securely delete old key

## Deployment Security

### Environment Variables

```bash
# .env (never commit!)
OPENAI_API_KEY=sk-...
AGENT_SECRET_KEY=base64...
```

### Docker

```dockerfile
# Don't run as root
USER node

# Don't include keys in image
COPY --chown=node:node . .
# Keys mounted at runtime via secrets
```

### Production Checklist

- [ ] TLS enabled (HTTPS only)
- [ ] Keys stored in secrets manager (not env vars)
- [ ] Rate limiting enabled
- [ ] Logging excludes sensitive data
- [ ] Health checks configured
- [ ] Monitoring/alerting set up

## Reporting Security Issues

### ⚠️ DO NOT open a public GitHub issue for security vulnerabilities.

### Responsible Disclosure

1. **Email**: security@proofi.com
2. **Subject**: `[SECURITY] Brief description`
3. **Include**:
   - Description of the vulnerability
   - Steps to reproduce
   - Potential impact
   - Suggested fix (if any)

### What to Expect

| Timeline | Action |
|----------|--------|
| 24 hours | Acknowledgment of report |
| 7 days | Initial assessment |
| 30 days | Fix developed (for valid issues) |
| 90 days | Public disclosure (coordinated) |

### Bug Bounty

We're working on a formal bug bounty program. In the meantime, we acknowledge all valid security reports and credit researchers (with permission) in our security advisories.

## Security Audits

- [ ] Internal code review (continuous)
- [ ] External audit (planned for Q2 2024)
- [ ] Penetration testing (planned)

## Changelog

| Date | Change |
|------|--------|
| 2024-02-07 | Initial security policy |

---

Security is a journey, not a destination. If you have suggestions for improving this policy, please open an issue or email security@proofi.com.
