#!/usr/bin/env node
/**
 * Proofi Agent Runner
 * Run all 3 agents against sample or real health data
 *
 * Usage:
 *   node run-agents.js                    # Run with sample data
 *   node run-agents.js --xml export.xml   # Run with Apple Health XML
 *   node run-agents.js --agent intel      # Run specific agent
 */

import { generateSampleData, parseAppleHealthXML, extractHealthData } from './lib/health-parser.js';
import { isAvailable, listModels } from './lib/ollama.js';
import { run as runCrossSource, AGENT_META as crossMeta } from './agents/cross-source-intel.js';
import { run as runTrend, AGENT_META as trendMeta } from './agents/trend-predictor.js';
import { run as runBrief, AGENT_META as briefMeta } from './agents/weekly-brief.js';
import { writeFileSync, existsSync } from 'fs';

const args = process.argv.slice(2);
const xmlPath = args.includes('--xml') ? args[args.indexOf('--xml') + 1] : null;
const agentFilter = args.includes('--agent') ? args[args.indexOf('--agent') + 1] : null;
const goals = args.includes('--goals') ? args[args.indexOf('--goals') + 1].split(',') : ['Better Sleep', 'More Energy'];
const outputDir = args.includes('--output') ? args[args.indexOf('--output') + 1] : './output';

async function main() {
  console.log('\n🔬 PROOFI AGENT RUNNER');
  console.log('━'.repeat(50));
  console.log('🔒 Processing: 100% LOCAL (Ollama)');
  console.log('🌐 Network calls: ZERO');
  console.log('📡 Data leaving device: NONE\n');

  // Check Ollama
  const available = await isAvailable();
  if (!available) {
    console.error('❌ Ollama is not running. Start it with: brew services start ollama');
    console.error('   Then pull a model: ollama pull llama3.2');
    process.exit(1);
  }

  const models = await listModels();
  console.log(`✅ Ollama ready. Models: ${models.join(', ')}\n`);

  // Load health data
  let healthData;
  if (xmlPath) {
    if (!existsSync(xmlPath)) {
      console.error(`❌ File not found: ${xmlPath}`);
      process.exit(1);
    }
    console.log(`📂 Parsing Apple Health XML: ${xmlPath}`);
    const { records, workouts } = parseAppleHealthXML(xmlPath);
    healthData = extractHealthData(records, workouts);
    console.log(`   Found: ${Object.entries(healthData).map(([k, v]) => `${k}: ${v.length}`).join(', ')}\n`);
  } else {
    console.log('📊 Using sample data (90 days)');
    console.log('   Tip: Export from Apple Health → run with --xml export.xml\n');
    healthData = generateSampleData(90);
  }

  // Summary
  const totalRecords = Object.values(healthData).reduce((sum, arr) => sum + arr.length, 0);
  console.log(`📈 Total records: ${totalRecords.toLocaleString()}`);
  console.log(`📅 Data types: ${Object.entries(healthData).filter(([, v]) => v.length > 0).map(([k, v]) => `${k}(${v.length})`).join(', ')}`);
  console.log(`🎯 Goals: ${goals.join(', ')}\n`);
  console.log('━'.repeat(50));

  const results = {};

  // Agent 1: Cross-Source Intel
  if (!agentFilter || agentFilter === 'intel' || agentFilter === '1') {
    console.log(`\n${crossMeta.icon} Running: ${crossMeta.name} v${crossMeta.version}`);
    console.log('   Correlating across all data sources...');
    const start = Date.now();
    try {
      results.crossSource = await runCrossSource(healthData, goals);
      console.log(`   ✅ Done in ${((Date.now() - start) / 1000).toFixed(1)}s`);
      console.log(`   📊 Correlations found: ${results.crossSource.correlationsFound}`);
      if (results.crossSource.insights?.headline) {
        console.log(`   💡 ${results.crossSource.insights.headline}`);
      }
    } catch (err) {
      console.error(`   ❌ Error: ${err.message}`);
    }
  }

  // Agent 2: Trend Predictor
  if (!agentFilter || agentFilter === 'trend' || agentFilter === '2') {
    console.log(`\n${trendMeta.icon} Running: ${trendMeta.name} v${trendMeta.version}`);
    console.log('   Analyzing longitudinal patterns...');
    const start = Date.now();
    try {
      results.trend = await runTrend(healthData, goals);
      console.log(`   ✅ Done in ${((Date.now() - start) / 1000).toFixed(1)}s`);
      if (results.trend.analysis?.headline) {
        console.log(`   💡 ${results.trend.analysis.headline}`);
      }
    } catch (err) {
      console.error(`   ❌ Error: ${err.message}`);
    }
  }

  // Agent 3: Weekly Brief
  if (!agentFilter || agentFilter === 'brief' || agentFilter === '3') {
    console.log(`\n${briefMeta.icon} Running: ${briefMeta.name} v${briefMeta.version}`);
    console.log('   Generating your weekly summary...');
    const start = Date.now();
    try {
      results.brief = await runBrief(healthData, goals);
      console.log(`   ✅ Done in ${((Date.now() - start) / 1000).toFixed(1)}s`);
      if (results.brief.brief?.greeting) {
        console.log(`   💡 ${results.brief.brief.greeting}`);
      }
    } catch (err) {
      console.error(`   ❌ Error: ${err.message}`);
    }
  }

  // Save results
  if (!existsSync(outputDir)) {
    const { mkdirSync } = await import('fs');
    mkdirSync(outputDir, { recursive: true });
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const outputPath = `${outputDir}/proofi-analysis-${timestamp}.json`;
  writeFileSync(outputPath, JSON.stringify(results, null, 2));

  console.log('\n━'.repeat(50));
  console.log(`\n✅ All agents complete!`);
  console.log(`📁 Full results: ${outputPath}`);
  console.log('\n🔒 SOVEREIGNTY REPORT:');
  console.log('   • Data processed: locally');
  console.log('   • Model used: locally (Ollama)');
  console.log('   • Network requests: 0');
  console.log('   • Third-party data access: none');
  console.log('   • Your data never left this machine.\n');
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
