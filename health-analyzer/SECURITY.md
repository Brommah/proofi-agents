# Security & Trust Model

## NO BLACK BOX

This agent is designed for **full transparency**. You can:
1. Read all source code
2. Verify every operation via audit logs
3. See exactly what data was accessed
4. Prove what was sent to AI models
5. Confirm outputs were encrypted with YOUR key

---

## Data Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│                          YOUR DEVICE                                 │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │ Proofi Extension                                               │  │
│  │ • Your keys stay HERE                                         │  │
│  │ • You encrypt data BEFORE it leaves                           │  │
│  │ • You grant tokens with specific scopes                       │  │
│  └───────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ Encrypted data + Token
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│                          CERE DDC                                    │
│                                                                      │
│  • Stores ONLY encrypted blobs                                      │
│  • Cannot read your data (no keys)                                  │
│  • Zero-knowledge storage                                           │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ Token grants access
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│                     HEALTH ANALYZER AGENT                            │
│                                                                      │
│  What the agent CAN do:                                             │
│  ✓ Validate your token                                              │
│  ✓ Unwrap the DEK (using its private key)                           │
│  ✓ Fetch encrypted data from DDC                                    │
│  ✓ Decrypt data IN MEMORY ONLY                                      │
│  ✓ Send to AI model for analysis                                    │
│  ✓ Encrypt output with YOUR DEK                                     │
│  ✓ Store encrypted output in YOUR vault                             │
│  ✓ Log every operation for YOUR audit                               │
│                                                                      │
│  What the agent CANNOT do:                                          │
│  ✗ Access data outside token scope                                  │
│  ✗ Store your plaintext data anywhere                               │
│  ✗ Read data after token expires                                    │
│  ✗ Share your DEK with anyone                                       │
│  ✗ Hide what it did (full audit log)                                │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Encryption Details

| Data | Encryption | Key Holder |
|------|------------|------------|
| Your health metrics | AES-256-GCM | YOU (via extension) |
| Data in transit | TLS 1.3 | Standard |
| Wrapped DEK in token | X25519 + XSalsa20-Poly1305 | Agent can unwrap |
| Agent's insights output | AES-256-GCM | YOU (re-encrypted) |
| Audit log | AES-256-GCM | YOU (stored in vault) |

**Key point:** The agent uses YOUR DEK to encrypt outputs. Only YOU can read the results.

---

## Audit Log

Every operation is logged with:

```json
{
  "id": "audit_1707339123_abc12345_0",
  "timestamp": "2024-02-07T22:32:03.123Z",
  "action": "data_decrypted",
  "details": {
    "path": "health/metrics",
    "plaintextHash": "sha256:a3b2c1d4...",
    "note": "Data decrypted in memory (never stored to disk)"
  }
}
```

**Hash verification:** You can verify the `plaintextHash` matches your original data:
```javascript
const hash = sha256(JSON.stringify(yourData));
// Compare with audit log
```

---

## Trust Assumptions

### You must trust:

1. **This source code** — It's open source, you can audit it
2. **Your browser's crypto** — Web Crypto API (standard, audited)
3. **The AI model** — OpenAI/Claude sees your data during inference

### You don't need to trust:

1. **Cere DDC** — They only see ciphertext
2. **The agent operator** — They can't see your data without a valid token
3. **Network providers** — TLS encrypts in transit

---

## Threat Model

| Threat | Mitigation |
|--------|------------|
| Agent stores plaintext | Audit log shows all disk writes (there are none) |
| Agent shares your DEK | DEK only exists in memory during request |
| Agent accesses other data | Token scope enforced, audit logged |
| DDC breach | They only have ciphertext, useless without DEK |
| Token theft | Tokens expire, you can revoke anytime |
| AI model logs data | Use local models or trusted providers |

---

## Verify Yourself

### 1. Check the code
```bash
git clone https://github.com/proofi/agents
# Read every line of health-analyzer/src/
```

### 2. Run locally
```bash
cd health-analyzer
npm install
npm run dev
# Agent runs on YOUR machine
```

### 3. Monitor requests
```bash
# Watch network traffic
mitmproxy
# See exactly what goes to OpenAI
```

### 4. Verify audit log
```javascript
// After analysis, check the audit log
const audit = response.audit;
audit.entries.forEach(entry => {
  console.log(entry.action, entry.details);
});
```

---

## Future: Verifiable Execution

For even stronger guarantees, we're exploring:

1. **TEE (Trusted Execution Environment)** — Run in SGX/TrustZone
2. **Local-first agents** — Run entirely on your device
3. **ZK proofs** — Cryptographic proof of correct execution
4. **Homomorphic encryption** — Analyze encrypted data without decryption

---

## Questions?

- **Code:** [github.com/proofi/agents](https://github.com/proofi/agents)
- **Security issues:** security@proofi.io
- **Discussion:** [discord.gg/proofi](https://discord.gg/proofi)

---

*"If you can't audit it, don't trust it."*
