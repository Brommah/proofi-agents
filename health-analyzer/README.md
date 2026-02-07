# Health Analyzer Agent

A Proofi agent that securely analyzes user health data using capability tokens.

## 🏠 Pure Mode (Local Execution)

**Maximum transparency. Zero trust required.**

Pure Mode lets you run the Health Analyzer entirely on your own machine. Your data never leaves your device, and you get a complete audit trail of every operation.

### Why Local = Maximum Transparency

When you run locally:
- ✅ **Your keys stay on YOUR machine** — decryption happens locally
- ✅ **Raw health data never transmitted** — it's only in your RAM
- ✅ **Full audit log saved locally** — verify every step
- ✅ **Optional local AI** — use Ollama for 100% offline analysis
- ✅ **Open source** — read the code, trust the code

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           PURE MODE ARCHITECTURE                            │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌────────────────┐                                                         │
│  │  Your Device   │                                                         │
│  │  ┌──────────┐  │     ┌─────────────────┐                                │
│  │  │  Wallet  │  │     │       DDC       │                                │
│  │  │  (Key)   │  │     │  (Cere Network) │                                │
│  │  └────┬─────┘  │     │  ┌───────────┐  │                                │
│  │       │        │     │  │ Encrypted │  │                                │
│  │       ▼        │     │  │   Health  │  │                                │
│  │  ┌──────────┐  │     │  │   Data    │  │                                │
│  │  │  Local   │◀═╪═════╪══│  (Blob)   │  │                                │
│  │  │ Decrypt  │  │     │  └───────────┘  │                                │
│  │  └────┬─────┘  │     └─────────────────┘                                │
│  │       │        │                                                         │
│  │       ▼        │                                                         │
│  │  ┌──────────┐  │     ┌─────────────────┐                                │
│  │  │  Local   │──╪────▶│  OpenAI API*    │  * Optional: can use local    │
│  │  │    AI    │  │     │  (if API key)   │    Ollama instead!            │
│  │  └────┬─────┘  │     └─────────────────┘                                │
│  │       │        │                                                         │
│  │       ▼        │                                                         │
│  │  ┌──────────┐  │                                                         │
│  │  │  Local   │  │     Never leaves your device:                          │
│  │  │  Audit   │  │     • Raw health data                                  │
│  │  │   Log    │  │     • Decryption keys                                  │
│  │  └──────────┘  │     • Full operation log                               │
│  │                │                                                         │
│  └────────────────┘                                                         │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Quick Start - Local Mode

```bash
# Interactive mode (recommended for first use)
npm run local

# Or with arguments
npm run local -- --bucket <your-bucket-id> --key ./path/to/wallet.json

# After npm publish, you can also use npx
npx @proofi/health-analyzer-agent
```

### What Stays on Your Machine

| Data | Location | Transmitted? |
|------|----------|--------------|
| Private keys | `./keys/` or your wallet | ❌ Never |
| Raw health data | RAM only | ❌ Never |
| Decrypted JSON | RAM only | ❌ Never |
| Audit log | `./audit-logs/` | ❌ Never |
| Analysis results | Local file | ❌ Never |
| Encrypted blob | DDC → local | ✅ Downloaded |
| AI prompts* | Local → API | ⚠️ Only if using OpenAI |

*For 100% local: use Ollama (see below)

### Using Ollama for True Local AI

For maximum privacy, use a local AI model instead of OpenAI:

```bash
# Install Ollama (https://ollama.ai)
curl -fsSL https://ollama.ai/install.sh | sh

# Pull a model
ollama pull llama2
# or
ollama pull mistral

# Set environment variable (TODO: implement in future version)
export LOCAL_MODEL=ollama:llama2

# Run analysis - no API calls!
npm run local
```

> 🚧 **Note:** Ollama integration is on the roadmap. Currently, if you don't set `OPENAI_API_KEY`, the analyzer uses local rule-based analysis (no external API calls).

### Audit Log Format

Every local run creates a detailed audit log:

```json
{
  "sessionId": "local_1707345600_abc123",
  "startedAt": "2024-02-07T22:00:00.000Z",
  "completedAt": "2024-02-07T22:00:05.000Z",
  "config": {
    "bucketId": "your-bucket-id",
    "outputPath": "./audit-logs",
    "useLocalAI": true
  },
  "dataHash": "sha256:abc123...",
  "resultHash": "sha256:def456...",
  "entries": [
    {
      "id": "local_0",
      "timestamp": "2024-02-07T22:00:01.000Z",
      "action": "data_fetched",
      "details": { "bucketId": "...", "source": "ddc" }
    },
    {
      "id": "local_1",
      "timestamp": "2024-02-07T22:00:02.000Z",
      "action": "data_decrypted",
      "details": { "note": "Decrypting data with user key (local)" }
    }
  ],
  "insights": { ... }
}
```

---

## Overview

This agent demonstrates the Proofi Agent SDK in action:

1. **Receives capability tokens** from users who want their health data analyzed
2. **Fetches encrypted data** from the Cere DDC (Decentralized Data Cloud)
3. **Decrypts using the wrapped DEK** that was included in the token
4. **Analyzes with AI** (OpenAI GPT-4 or rule-based fallback)
5. **Writes insights back** to the user's DDC bucket (if permitted)

## Quick Start

```bash
# Install dependencies
npm install

# Copy environment variables
cp .env.example .env

# Start the server (development mode with hot reload)
npm run dev

# Or build and run production
npm run build
npm start
```

The server runs on **port 3100** by default.

## Endpoints

### GET /status
Health check endpoint.

```bash
curl http://localhost:3100/status
```

Response:
```json
{
  "status": "healthy",
  "service": "health-analyzer-agent",
  "version": "1.0.0",
  "timestamp": "2024-02-07T22:30:00.000Z",
  "uptime": 123.456
}
```

### GET /agent-info
Returns the agent's public key and capabilities. Users need the public key to grant tokens.

```bash
curl http://localhost:3100/agent-info
```

Response:
```json
{
  "name": "Health Analyzer Agent",
  "version": "1.0.0",
  "publicKey": "base64-encoded-x25519-public-key",
  "capabilities": [
    "health-analysis",
    "steps-trends",
    "sleep-quality",
    "mood-patterns",
    "ai-insights"
  ],
  "endpoints": {
    "analyze": "/analyze",
    "status": "/status"
  }
}
```

### POST /analyze
Main analysis endpoint. Receives a capability token and analyzes the user's health data.

```bash
curl -X POST http://localhost:3100/analyze \
  -H "Content-Type: application/json" \
  -d '{
    "token": "base64-encoded-capability-token"
  }'
```

Response:
```json
{
  "success": true,
  "insights": {
    "generatedAt": "2024-02-07T22:30:00.000Z",
    "summary": "Analyzed 3 health categories. Overall trend is positive.",
    "trends": [
      {
        "category": "steps",
        "direction": "improving",
        "description": "Average 9,500 steps/day over the last week (+15% vs previous)",
        "period": "Last 7 days"
      }
    ],
    "recommendations": [
      {
        "priority": "low",
        "category": "exercise",
        "title": "Great activity level!",
        "description": "You're consistently hitting 10,000+ steps...",
        "actionable": true
      }
    ]
  },
  "tokenInfo": {
    "id": "token-uuid",
    "issuer": "did:key:user-did",
    "expiresAt": "2024-02-08T22:30:00.000Z",
    "scopes": ["health/* (read, write)"]
  }
}
```

## How It Works

### Token Flow

```
┌────────────────────────────────────────────────────────────────────┐
│                                                                    │
│  1. User grants token          2. Agent receives token            │
│  ┌──────────┐                  ┌─────────────────┐                │
│  │   User   │ ──────────────▶  │  Health Agent   │                │
│  │  (Vault) │   token with     │   (this code)   │                │
│  └──────────┘   wrapped DEK    └────────┬────────┘                │
│       │                                 │                          │
│       │                                 │ 3. Fetch encrypted data  │
│       ▼                                 ▼                          │
│  ┌──────────┐                  ┌─────────────────┐                │
│  │   DDC    │ ◀──────────────  │  Unwrap DEK &   │                │
│  │ (Cere)   │   encrypted      │    Decrypt      │                │
│  └──────────┘   health data    └────────┬────────┘                │
│                                         │                          │
│                                         │ 4. Analyze & write back │
│                                         ▼                          │
│                                ┌─────────────────┐                │
│                                │   AI Analysis   │                │
│                                │  (OpenAI/Rules) │                │
│                                └─────────────────┘                │
│                                                                    │
└────────────────────────────────────────────────────────────────────┘
```

### Keypair Management

On first run, the agent generates an X25519 keypair:

```
./keys/
  └── agent-keypair.json   # Contains public + private key (base64)
```

**Important:** The `keys/` directory is gitignored. Keep your private key secure!

The public key is exposed via `/agent-info` so users can encrypt the DEK for this agent.

## Configuration

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Server port | `3100` |
| `OPENAI_API_KEY` | OpenAI API key for AI analysis | (uses rule-based if not set) |
| `DDC_ENDPOINT` | Cere DDC endpoint | `https://ddc.cere.network` |
| `LOG_LEVEL` | Logging level | `info` |

## Development

```bash
# Run in development mode with hot reload
npm run dev

# Run tests
npm test

# Type check
npm run build
```

## Health Data Format

The agent expects health data in this format:

```typescript
interface HealthMetrics {
  steps?: {
    date: string;
    count: number;
    distance?: number;
  }[];
  sleep?: {
    date: string;
    duration: number;
    quality?: 'poor' | 'fair' | 'good' | 'excellent';
  }[];
  mood?: {
    date: string;
    score: number; // 1-10
    notes?: string;
  }[];
  // ... more categories
}
```

## Security Considerations

1. **Private Key Protection**: Never expose the agent's private key. It's stored in `keys/agent-keypair.json` with restricted permissions.

2. **Token Validation**: All tokens are validated for:
   - Expiration
   - Scope permissions
   - (Future: Signature verification)

3. **Scoped Access**: The agent can only access paths explicitly granted in the token.

4. **No Data Storage**: The agent processes data in-memory and doesn't persist user health data.

5. **Pure Mode (Local)**: For maximum security, run in Pure Mode where all processing happens on your machine. See the [Pure Mode section](#-pure-mode-local-execution) above.

## Deployment vs Pure Mode

| | Server Mode | Pure Mode |
|---|---|---|
| **Use case** | Automated/API access | Personal verification |
| **Where it runs** | Cloud/server | Your machine |
| **Trust model** | Trust the operator | Trust yourself |
| **Best for** | Apps, integrations | Privacy-first users |
| **Setup** | `npm start` | `npm run local` |

## License

MIT
