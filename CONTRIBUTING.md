# Contributing to Proofi Agents

Thanks for your interest in contributing! Proofi Agents are a critical part of the trust infrastructure, so we take security and quality seriously.

## 🚀 Quick Start

1. Fork the repo
2. Create a feature branch (`git checkout -b feature/my-agent`)
3. Make your changes
4. Run tests (`npm test`)
5. Submit a PR

## 📁 Repository Structure

```
agents/
├── README.md           # This file
├── LICENSE             # MIT
├── CONTRIBUTING.md     # You're reading it
├── SECURITY.md         # Security policy
├── .github/
│   ├── workflows/      # CI/CD
│   └── ISSUE_TEMPLATE/ # Issue templates
└── [agent-name]/       # Individual agents
    ├── README.md
    ├── SECURITY.md
    ├── package.json
    ├── src/
    └── tests/
```

## 🎨 Code Style

We use TypeScript with strict settings. Follow these conventions:

### TypeScript

- Use `strict: true` in tsconfig
- Prefer `interface` over `type` for object shapes
- Use explicit return types on public functions
- No `any` unless absolutely necessary (and commented why)

```typescript
// ✅ Good
interface AnalysisResult {
  summary: string;
  insights: Insight[];
}

async function analyze(token: CapabilityToken): Promise<AnalysisResult> {
  // ...
}

// ❌ Avoid
async function analyze(token: any) {
  // ...
}
```

### Formatting

- 2 spaces for indentation
- Single quotes for strings
- Semicolons required
- Trailing commas in multiline

We recommend using Prettier with the default config.

### File Naming

- `kebab-case` for files: `token-validator.ts`
- `PascalCase` for classes: `TokenValidator`
- `camelCase` for functions and variables

### Imports

```typescript
// 1. Node built-ins
import { readFile } from 'fs/promises';

// 2. External packages
import { Hono } from 'hono';
import nacl from 'tweetnacl';

// 3. Internal modules
import { validateToken } from './crypto.js';
import type { CapabilityToken } from './types.js';
```

## 🆕 Adding a New Agent

### 1. Create the Directory Structure

```bash
mkdir my-agent
cd my-agent
npm init -y
```

Required files:

```
my-agent/
├── README.md           # Required: what it does, how to run
├── SECURITY.md         # Required: security model
├── package.json
├── tsconfig.json
├── .env.example
├── .gitignore
├── Dockerfile
├── src/
│   ├── server.ts       # HTTP server with required endpoints
│   ├── crypto.ts       # Token + DEK handling
│   ├── analyzer.ts     # Your logic
│   └── types.ts        # TypeScript interfaces
└── tests/
    └── analyzer.test.ts
```

### 2. Implement Required Endpoints

Every agent MUST expose:

```typescript
// GET /status
app.get('/status', (c) => {
  return c.json({
    status: 'healthy',
    service: 'my-agent',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// GET /agent-info
app.get('/agent-info', (c) => {
  return c.json({
    name: 'My Agent',
    version: '1.0.0',
    publicKey: getPublicKey(), // Base64 X25519 public key
    capabilities: ['my-capability'],
    endpoints: {
      analyze: '/analyze',
      status: '/status',
    },
  });
});

// POST /analyze (or your main endpoint)
app.post('/analyze', async (c) => {
  const { token } = await c.req.json();
  // Validate token, fetch data, analyze, return insights
});
```

### 3. Handle Tokens Securely

```typescript
import nacl from 'tweetnacl';
import { decodeBase64, encodeUTF8 } from 'tweetnacl-util';

function unwrapDek(wrappedDek: string, senderPublicKey: string): Uint8Array {
  const keypair = loadKeypair(); // Your agent's keypair
  const message = decodeBase64(wrappedDek);
  const nonce = message.slice(0, nacl.box.nonceLength);
  const ciphertext = message.slice(nacl.box.nonceLength);
  
  const dek = nacl.box.open(
    ciphertext,
    nonce,
    decodeBase64(senderPublicKey),
    keypair.secretKey
  );
  
  if (!dek) throw new Error('Failed to unwrap DEK');
  return dek;
}
```

### 4. Write Tests

```typescript
import { describe, it, expect } from 'vitest';
import { analyze } from '../src/analyzer';

describe('Analyzer', () => {
  it('should generate insights from health data', async () => {
    const data = {
      steps: [{ date: '2024-02-01', count: 10000 }],
    };
    
    const result = await analyze(data);
    
    expect(result.insights).toBeDefined();
    expect(result.insights.length).toBeGreaterThan(0);
  });
});
```

### 5. Document Security

Create a `SECURITY.md` in your agent directory covering:

- What data the agent accesses
- How data is processed (in-memory only)
- What is returned (insights, not raw data)
- What is NOT stored or logged

### 6. Submit a PR

- Ensure all tests pass
- Ensure lint passes
- Fill out the PR template
- Request review

## 🔒 Security Requirements

**All agents MUST:**

| Requirement | Description |
|-------------|-------------|
| Token validation | Check expiration, scopes before any data access |
| Scope enforcement | Only access paths explicitly granted |
| Memory-only processing | Never persist user data to disk/database |
| Private key security | Never log, expose, or transmit private key |
| Insight-only output | Return derived insights, not raw data |
| No external transmission | Don't send user data to third parties |

**Security review:** All new agents undergo security review before merge.

## 🧪 Testing Guidelines

### Unit Tests

Test your business logic in isolation:

```typescript
describe('analyzeSleepData', () => {
  it('detects poor sleep patterns', () => { /* ... */ });
  it('handles missing data gracefully', () => { /* ... */ });
});
```

### Integration Tests

Test the full flow with mock tokens:

```typescript
describe('POST /analyze', () => {
  it('returns insights for valid token', async () => { /* ... */ });
  it('rejects expired token', async () => { /* ... */ });
  it('rejects out-of-scope access', async () => { /* ... */ });
});
```

### Running Tests

```bash
# All tests
npm test

# Watch mode
npm run test:watch

# Coverage
npm run test:coverage
```

## 📝 Commit Messages

Use conventional commits:

```
feat(health-analyzer): add sleep quality detection
fix(crypto): handle malformed token gracefully
docs: update contributing guidelines
test: add edge case for expired tokens
chore: update dependencies
```

## 🐛 Reporting Issues

Use the issue templates:

- **Bug Report**: Something isn't working
- **Feature Request**: Suggest an improvement
- **Security Issue**: See [SECURITY.md](./SECURITY.md) for responsible disclosure

## 💬 Questions?

- Open a discussion on GitHub
- Join our Discord (link in README)
- Email: agents@proofi.com

---

Thanks for contributing to a more privacy-respecting AI ecosystem! 🔐
