# Proofi Agents

> AI agents that work with your data — not around it.

Proofi Agents are autonomous services that analyze your data through **capability tokens**. Instead of giving agents permanent access to everything, you grant them time-limited, scoped permissions to specific data. They do their job and forget.

## 🔐 The Trust Model

Traditional AI agents require broad access: "Connect your Google account." "Give us API keys." Proofi flips this:

```
┌─────────────────────────────────────────────────────────────────────┐
│                                                                     │
│   YOU (Proofi Vault)                     AGENT                      │
│   ┌────────────────┐                    ┌─────────────────┐        │
│   │                │    1. Grant        │                 │        │
│   │  Your Data     │ ─────────────────▶ │  Capability     │        │
│   │  (encrypted)   │    scoped token    │  Token          │        │
│   │                │                    │                 │        │
│   └────────────────┘                    └────────┬────────┘        │
│          │                                       │                  │
│          │                                       │ 2. Fetch data   │
│          ▼                                       │    (encrypted)  │
│   ┌────────────────┐                            │                  │
│   │                │ ◀───────────────────────────┘                  │
│   │  DDC Storage   │                                               │
│   │  (Cere)        │                    3. Decrypt with            │
│   │                │                       wrapped DEK              │
│   └────────────────┘                                               │
│                                                                     │
│   ✓ Agent only sees what you permit                                │
│   ✓ Access expires automatically                                   │
│   ✓ Agent can't store or share raw data                           │
│   ✓ You revoke access anytime                                     │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

**Key principles:**

1. **Minimal access** — Agents only see paths you explicitly grant
2. **Time-limited** — Tokens expire (hours/days, not forever)
3. **Cryptographic enforcement** — Data stays encrypted; agents get wrapped keys
4. **Stateless** — Agents process in-memory, don't persist your data
5. **Auditable** — Every token grant is logged on-chain

## 📦 Available Agents

| Agent | Description | Status |
|-------|-------------|--------|
| [health-analyzer](./health-analyzer) | Analyzes health data (steps, sleep, mood) and generates AI insights | ✅ Ready |

More agents coming soon: finance analyzer, document summarizer, calendar optimizer.

## 🚀 Running an Agent

Each agent is a standalone service. Quick start:

```bash
# Clone the repo
git clone https://github.com/proofi/agents.git
cd agents/health-analyzer

# Install dependencies
npm install

# Configure (copy and edit .env)
cp .env.example .env

# Run in development
npm run dev

# Or build for production
npm run build
npm start
```

Agents expose REST endpoints. See each agent's README for specifics.

## 🛠 Building Your Own Agent

Want to build a Proofi-compatible agent? Here's the structure:

```
my-agent/
├── README.md           # What it does, how to run
├── SECURITY.md         # Security model & data handling
├── package.json        # Node.js project
├── src/
│   ├── server.ts       # HTTP server (Hono, Express, etc.)
│   ├── crypto.ts       # Token handling, DEK unwrapping
│   └── analyzer.ts     # Your actual logic
├── keys/               # Agent keypair (gitignored!)
│   └── agent-keypair.json
├── .env.example        # Environment template
├── Dockerfile          # Container deployment
└── tests/
    └── *.test.ts
```

### Required Endpoints

Every Proofi agent must implement:

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/status` | GET | Health check (returns `{ status: "healthy" }`) |
| `/agent-info` | GET | Returns agent public key and capabilities |
| `/analyze` (or similar) | POST | Main processing endpoint, receives capability token |

### Agent Keypair

On first run, generate an X25519 keypair:

```typescript
import nacl from 'tweetnacl';
import { encodeBase64 } from 'tweetnacl-util';

const keypair = nacl.box.keyPair();
// Store securely, expose only the public key via /agent-info
```

Users encrypt the DEK (Data Encryption Key) using your public key. Only your agent can unwrap it.

### Token Structure

Capability tokens contain:

```typescript
interface CapabilityToken {
  id: string;                    // Unique token ID
  issuer: string;                // User's DID
  subject: string;               // Agent's public key
  scopes: Scope[];               // What the agent can access
  wrappedDek: string;            // DEK encrypted for this agent
  issuedAt: number;              // Unix timestamp
  expiresAt: number;             // When access ends
  signature?: string;            // (Future: cryptographic proof)
}

interface Scope {
  path: string;                  // e.g., "health/steps/*"
  permissions: ('read' | 'write')[];
}
```

### Security Requirements

Your agent MUST:

- ✅ Validate token expiration before processing
- ✅ Respect scope permissions (only access granted paths)
- ✅ Process data in-memory (no persistent storage of user data)
- ✅ Keep the private key secure (never expose, never log)
- ✅ Return only derived insights, not raw data

See [SECURITY.md](./SECURITY.md) for the full security policy.

## 🧪 Testing

```bash
# Run all tests
npm test

# Run tests for a specific agent
cd health-analyzer && npm test
```

## 📄 License

MIT — see [LICENSE](./LICENSE)

## 🤝 Contributing

We welcome contributions! See [CONTRIBUTING.md](./CONTRIBUTING.md) for guidelines.

## 🔗 Links

- [Proofi Website](https://proofi.com)
- [Proofi Vault](https://vault.proofi.com)
- [Proofi SDK](https://github.com/proofi/sdk)
- [Cere DDC](https://cere.network)

---

Built with 🔐 by the Proofi team
