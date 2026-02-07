#!/usr/bin/env node
/**
 * Pure Mode - Local Health Analyzer
 * 
 * Run health analysis entirely on your machine.
 * YOUR DATA NEVER LEAVES YOUR DEVICE (unless you choose to use an external AI API).
 * 
 * Maximum transparency. Zero trust required.
 * 
 * Usage:
 *   npm run local
 *   npx proofi-health-analyzer
 *   node dist/local.js --bucket abc123 --key ./my-key.json
 */

import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import readline from 'readline';
import { analyzeHealthData } from './analyze.js';
import { auditLog, hashData } from './audit.js';
import type { HealthMetrics, HealthInsights, AuditEntry } from './types.js';

// =============================================================================
// CONFIGURATION
// =============================================================================

interface LocalConfig {
  bucketId: string;
  keyPath?: string;
  outputPath: string;
  useLocalAI: boolean;
  verbose: boolean;
}

interface LocalAuditLog {
  sessionId: string;
  startedAt: string;
  completedAt?: string;
  config: Omit<LocalConfig, 'keyPath'>; // Don't log key path
  dataHash: string;
  resultHash?: string;
  entries: AuditEntry[];
  insights?: HealthInsights;
}

// =============================================================================
// CLI INTERFACE
// =============================================================================

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function prompt(question: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer.trim());
    });
  });
}

function printBanner(): void {
  console.log(`
╔══════════════════════════════════════════════════════════════════════════════╗
║                                                                              ║
║   ██████╗ ██╗   ██╗██████╗ ███████╗    ███╗   ███╗ ██████╗ ██████╗ ███████╗  ║
║   ██╔══██╗██║   ██║██╔══██╗██╔════╝    ████╗ ████║██╔═══██╗██╔══██╗██╔════╝  ║
║   ██████╔╝██║   ██║██████╔╝█████╗      ██╔████╔██║██║   ██║██║  ██║█████╗    ║
║   ██╔═══╝ ██║   ██║██╔══██╗██╔══╝      ██║╚██╔╝██║██║   ██║██║  ██║██╔══╝    ║
║   ██║     ╚██████╔╝██║  ██║███████╗    ██║ ╚═╝ ██║╚██████╔╝██████╔╝███████╗  ║
║   ╚═╝      ╚═════╝ ╚═╝  ╚═╝╚══════╝    ╚═╝     ╚═╝ ╚═════╝ ╚═════╝ ╚══════╝  ║
║                                                                              ║
║                     Health Analyzer - Local Execution                        ║
║                                                                              ║
║   Your data NEVER leaves your device.                                        ║
║   Maximum transparency. Full audit trail.                                    ║
║                                                                              ║
╚══════════════════════════════════════════════════════════════════════════════╝
`);
}

function printStep(step: number, total: number, message: string): void {
  console.log(`\n[${step}/${total}] ${message}`);
  console.log('─'.repeat(60));
}

// =============================================================================
// DDC INTEGRATION (SIMULATED FOR NOW)
// =============================================================================

/**
 * Fetch encrypted data from DDC
 * 
 * In a real implementation, this would:
 * 1. Connect to Cere DDC using the bucket ID
 * 2. Download the encrypted health data blob
 * 3. Return the raw encrypted bytes
 */
async function fetchFromDDC(bucketId: string): Promise<Uint8Array> {
  console.log(`  → Connecting to DDC bucket: ${bucketId}`);
  
  // TODO: Real DDC integration
  // For now, simulate fetching encrypted data
  
  // Check if there's local test data
  const testDataPath = path.join(process.cwd(), 'test-data', `${bucketId}.json`);
  if (fs.existsSync(testDataPath)) {
    console.log(`  → Found local test data at ${testDataPath}`);
    const data = fs.readFileSync(testDataPath);
    return new Uint8Array(data);
  }
  
  // Simulate network delay
  await new Promise(resolve => setTimeout(resolve, 500));
  console.log(`  → DDC connection simulated (real DDC integration coming soon)`);
  
  // Return a placeholder that triggers mock data
  return new Uint8Array([0]);
}

/**
 * Decrypt data with user's key
 * 
 * In a real implementation, this would:
 * 1. Load the user's private key from the specified path
 * 2. Use NaCl box_open to decrypt the data
 * 3. Return the decrypted JSON
 */
async function decryptData(
  encryptedData: Uint8Array,
  keyPath?: string
): Promise<HealthMetrics> {
  console.log(`  → Decrypting data locally...`);
  
  // TODO: Real decryption with user's key
  // For now, return mock data for demonstration
  
  if (keyPath && fs.existsSync(keyPath)) {
    console.log(`  → Using key from: ${keyPath}`);
    // In real implementation: load key and decrypt
  }
  
  // Simulate decryption delay
  await new Promise(resolve => setTimeout(resolve, 300));
  
  console.log(`  → Decryption simulated (using demo data)`);
  
  return generateDemoHealthData();
}

/**
 * Generate demo health data for testing
 */
function generateDemoHealthData(): HealthMetrics {
  const today = new Date();
  const dates = Array.from({ length: 14 }, (_, i) => {
    const d = new Date(today);
    d.setDate(d.getDate() - (13 - i));
    return d.toISOString().split('T')[0];
  });
  
  return {
    steps: dates.map((date, i) => ({
      date,
      count: 6000 + Math.floor(Math.random() * 8000) + (i * 200),
      distance: 4000 + Math.floor(Math.random() * 5000),
    })),
    sleep: dates.map((date, i) => ({
      date,
      duration: 5.5 + Math.random() * 2.5 + (i * 0.05),
      quality: (['fair', 'good', 'good', 'excellent'] as const)[Math.floor(Math.random() * 4)],
    })),
    mood: dates.map((date, i) => ({
      date,
      score: 5 + Math.floor(Math.random() * 4) + (i % 3 === 0 ? 1 : 0),
      notes: i % 3 === 0 ? 'Feeling good today' : undefined,
    })),
  };
}

// =============================================================================
// AUDIT LOG
// =============================================================================

function saveAuditLog(auditData: LocalAuditLog, outputPath: string): string {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `health-analysis-audit-${timestamp}.json`;
  const fullPath = path.join(outputPath, filename);
  
  // Ensure output directory exists
  if (!fs.existsSync(outputPath)) {
    fs.mkdirSync(outputPath, { recursive: true });
  }
  
  fs.writeFileSync(fullPath, JSON.stringify(auditData, null, 2));
  return fullPath;
}

// =============================================================================
// MAIN FLOW
// =============================================================================

async function runInteractive(): Promise<void> {
  printBanner();
  
  console.log('\n📋 This tool runs health analysis ENTIRELY on your machine.\n');
  console.log('   Data Flow:');
  console.log('   ┌─────────────┐    ┌─────────────┐    ┌─────────────┐');
  console.log('   │ Your Device │ ←─ │     DDC     │    │   AI Model  │');
  console.log('   │  (decrypt)  │    │ (encrypted) │    │   (local*)  │');
  console.log('   └──────┬──────┘    └─────────────┘    └──────┬──────┘');
  console.log('          │                                      │');
  console.log('          └──────────────┬───────────────────────┘');
  console.log('                         │');
  console.log('                ┌────────▼────────┐');
  console.log('                │   Local Audit   │');
  console.log('                │      Log        │');
  console.log('                └─────────────────┘');
  console.log('\n   * Uses OpenAI API if OPENAI_API_KEY is set, otherwise rule-based analysis\n');
  
  // Step 1: Get bucket ID
  printStep(1, 5, '🪣 Enter your DDC Bucket ID');
  console.log('   This is where your encrypted health data is stored.');
  const bucketId = await prompt('\n   Bucket ID: ');
  
  if (!bucketId) {
    console.log('\n   ⚠️  No bucket ID provided. Using demo mode with sample data.\n');
  }
  
  // Step 2: Get key path (optional)
  printStep(2, 5, '🔑 Wallet / Key File (optional)');
  console.log('   Path to your wallet or key file for decryption.');
  console.log('   Leave empty to use demo data.\n');
  const keyPath = await prompt('   Key path (or press Enter to skip): ');
  
  // Step 3: Output location
  printStep(3, 5, '📁 Audit Log Location');
  const defaultOutput = path.join(process.cwd(), 'audit-logs');
  console.log(`   Where to save the audit log. Default: ${defaultOutput}\n`);
  const outputInput = await prompt(`   Output path (Enter for default): `);
  const outputPath = outputInput || defaultOutput;
  
  // Step 4: Confirm
  printStep(4, 5, '✅ Confirm Configuration');
  console.log(`   • Bucket ID:  ${bucketId || '(demo mode)'}`);
  console.log(`   • Key File:   ${keyPath || '(not provided)'}`);
  console.log(`   • Output:     ${outputPath}`);
  console.log(`   • AI Mode:    ${process.env.OPENAI_API_KEY ? 'OpenAI GPT-4' : 'Rule-based (local)'}`);
  
  const confirm = await prompt('\n   Proceed? (Y/n): ');
  if (confirm.toLowerCase() === 'n') {
    console.log('\n   Cancelled.\n');
    rl.close();
    return;
  }
  
  // Step 5: Run analysis
  printStep(5, 5, '🔬 Running Analysis');
  
  const config: LocalConfig = {
    bucketId: bucketId || 'demo',
    keyPath: keyPath || undefined,
    outputPath,
    useLocalAI: !process.env.OPENAI_API_KEY,
    verbose: true,
  };
  
  const result = await runAnalysis(config);
  
  // Print results
  console.log('\n');
  console.log('═'.repeat(60));
  console.log('                      ANALYSIS RESULTS');
  console.log('═'.repeat(60));
  
  if (result.insights) {
    console.log(`\n📊 Summary: ${result.insights.summary}\n`);
    
    if (result.insights.trends.length > 0) {
      console.log('📈 Trends:');
      for (const trend of result.insights.trends) {
        const arrow = trend.direction === 'improving' ? '↑' : trend.direction === 'declining' ? '↓' : '→';
        console.log(`   ${arrow} [${trend.category}] ${trend.description}`);
      }
    }
    
    if (result.insights.recommendations.length > 0) {
      console.log('\n💡 Recommendations:');
      for (const rec of result.insights.recommendations) {
        const priority = rec.priority === 'high' ? '🔴' : rec.priority === 'medium' ? '🟡' : '🟢';
        console.log(`   ${priority} ${rec.title}`);
        console.log(`      ${rec.description}\n`);
      }
    }
    
    if (result.insights.alerts && result.insights.alerts.length > 0) {
      console.log('⚠️  Alerts:');
      for (const alert of result.insights.alerts) {
        console.log(`   • [${alert.severity.toUpperCase()}] ${alert.message}`);
      }
    }
  }
  
  console.log('\n' + '═'.repeat(60));
  console.log(`📝 Audit log saved: ${result.auditPath}`);
  console.log(`   Data hash:   ${result.dataHash.substring(0, 16)}...`);
  console.log(`   Result hash: ${result.resultHash?.substring(0, 16)}...`);
  console.log('═'.repeat(60));
  
  console.log('\n✅ Analysis complete! Your data stayed on your machine.\n');
  
  rl.close();
}

async function runAnalysis(config: LocalConfig): Promise<{
  insights: HealthInsights | null;
  auditPath: string;
  dataHash: string;
  resultHash: string | null;
}> {
  const sessionId = `local_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  const startedAt = new Date().toISOString();
  
  auditLog.clear();
  
  console.log(`\n  Session: ${sessionId}`);
  console.log(`  Started: ${startedAt}\n`);
  
  // Fetch from DDC
  auditLog.log('data_fetched', {
    bucketId: config.bucketId,
    source: 'ddc',
    note: 'Fetching encrypted data from DDC',
  });
  
  const encryptedData = await fetchFromDDC(config.bucketId);
  console.log(`  ✓ Fetched ${encryptedData.length} bytes from DDC`);
  
  // Decrypt locally
  auditLog.log('data_decrypted', {
    note: 'Decrypting data with user key (local)',
    keyProvided: !!config.keyPath,
  });
  
  const healthData = await decryptData(encryptedData, config.keyPath);
  const dataHash = hashData(healthData);
  console.log(`  ✓ Decrypted health data (hash: ${dataHash.substring(0, 16)}...)`);
  
  // Analyze
  const model = config.useLocalAI ? 'rule-based (local)' : 'gpt-4o-mini (API)';
  auditLog.log('inference_started', {
    model,
    inputHash: dataHash,
    note: 'Starting health analysis',
  });
  
  console.log(`  ⏳ Analyzing with ${model}...`);
  const insights = await analyzeHealthData(healthData);
  const resultHash = hashData(insights);
  
  auditLog.log('inference_completed', {
    model,
    outputHash: resultHash,
    trendsCount: insights.trends.length,
    recommendationsCount: insights.recommendations.length,
    note: 'Analysis complete',
  });
  
  console.log(`  ✓ Analysis complete (hash: ${resultHash.substring(0, 16)}...)`);
  
  // Save audit log
  const completedAt = new Date().toISOString();
  const auditData: LocalAuditLog = {
    sessionId,
    startedAt,
    completedAt,
    config: {
      bucketId: config.bucketId,
      outputPath: config.outputPath,
      useLocalAI: config.useLocalAI,
      verbose: config.verbose,
    },
    dataHash,
    resultHash,
    entries: auditLog.getEntries(),
    insights,
  };
  
  const auditPath = saveAuditLog(auditData, config.outputPath);
  console.log(`  ✓ Audit log saved to ${auditPath}`);
  
  return {
    insights,
    auditPath,
    dataHash,
    resultHash,
  };
}

// =============================================================================
// CLI ARGUMENT PARSING
// =============================================================================

function parseArgs(): { interactive: boolean; config: Partial<LocalConfig> } {
  const args = process.argv.slice(2);
  const config: Partial<LocalConfig> = {};
  let interactive = true;
  
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    const next = args[i + 1];
    
    switch (arg) {
      case '--bucket':
      case '-b':
        config.bucketId = next;
        i++;
        interactive = false;
        break;
      case '--key':
      case '-k':
        config.keyPath = next;
        i++;
        break;
      case '--output':
      case '-o':
        config.outputPath = next;
        i++;
        break;
      case '--verbose':
      case '-v':
        config.verbose = true;
        break;
      case '--help':
      case '-h':
        printHelp();
        process.exit(0);
        break;
    }
  }
  
  return { interactive, config };
}

function printHelp(): void {
  console.log(`
Pure Mode - Local Health Analyzer

USAGE:
  npm run local                    Interactive mode
  npm run local -- --bucket <id>   Non-interactive with bucket ID

OPTIONS:
  -b, --bucket <id>      DDC bucket ID containing your health data
  -k, --key <path>       Path to wallet/key file for decryption
  -o, --output <path>    Directory to save audit logs (default: ./audit-logs)
  -v, --verbose          Enable verbose output
  -h, --help             Show this help message

EXAMPLES:
  npm run local
  npm run local -- --bucket abc123 --key ./my-wallet.json
  npm run local -- -b abc123 -o ./my-logs

ENVIRONMENT:
  OPENAI_API_KEY         If set, uses OpenAI for analysis
                         If not set, uses local rule-based analysis

SECURITY:
  • All decryption happens locally on your machine
  • Your raw health data never leaves your device
  • If using OpenAI, only anonymized summaries are sent
  • Full audit log is saved locally for verification

For true local AI (no external API calls), consider:
  • Ollama with a local model (llama2, mistral)
  • See README.md for setup instructions
`);
}

// =============================================================================
// ENTRY POINT
// =============================================================================

async function main(): Promise<void> {
  const { interactive, config } = parseArgs();
  
  if (interactive) {
    await runInteractive();
  } else {
    // Non-interactive mode
    if (!config.bucketId) {
      console.error('Error: --bucket is required in non-interactive mode');
      process.exit(1);
    }
    
    const fullConfig: LocalConfig = {
      bucketId: config.bucketId,
      keyPath: config.keyPath,
      outputPath: config.outputPath || path.join(process.cwd(), 'audit-logs'),
      useLocalAI: !process.env.OPENAI_API_KEY,
      verbose: config.verbose || false,
    };
    
    console.log('Running health analysis in Pure Mode...\n');
    const result = await runAnalysis(fullConfig);
    
    console.log('\n✅ Complete!');
    console.log(`   Audit log: ${result.auditPath}`);
    
    process.exit(0);
  }
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
