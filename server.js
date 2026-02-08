#!/usr/bin/env node
/**
 * Proofi Agents — Local Web Server
 * Serves the dashboard UI and runs agents via API
 */

import express from 'express';
import { readFileSync, existsSync, writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { generateSampleData, parseAppleHealthXML, extractHealthData } from './lib/health-parser.js';
import { isAvailable, listModels } from './lib/ollama.js';
import { run as runCrossSource } from './agents/cross-source-intel.js';
import { run as runTrend } from './agents/trend-predictor.js';
import { run as runBrief } from './agents/weekly-brief.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = 3577;

app.use(express.json({ limit: '50mb' }));
app.use(express.static(join(__dirname, 'public')));

// State
let healthData = null;
let userGoals = ['Better Sleep', 'More Energy'];
let agentResults = {};

// API: Status
app.get('/api/status', async (req, res) => {
  const ollamaReady = await isAvailable();
  const models = ollamaReady ? await listModels() : [];
  res.json({
    ollama: ollamaReady,
    models,
    hasData: !!healthData,
    dataStats: healthData ? Object.fromEntries(
      Object.entries(healthData).map(([k, v]) => [k, v.length])
    ) : null,
    goals: userGoals,
    agents: {
      crossSource: agentResults.crossSource ? 'complete' : 'pending',
      trend: agentResults.trend ? 'complete' : 'pending',
      brief: agentResults.brief ? 'complete' : 'pending'
    }
  });
});

// API: Load sample data
app.post('/api/data/sample', (req, res) => {
  const days = req.body?.days || 90;
  healthData = generateSampleData(days);
  userGoals = req.body?.goals || userGoals;
  agentResults = {};
  const totalRecords = Object.values(healthData).reduce((sum, arr) => sum + arr.length, 0);
  res.json({
    ok: true,
    days,
    totalRecords,
    types: Object.fromEntries(Object.entries(healthData).map(([k, v]) => [k, v.length]))
  });
});

// API: Upload Apple Health XML
app.post('/api/data/upload', (req, res) => {
  try {
    const { xml, goals } = req.body;
    if (!xml) return res.status(400).json({ error: 'No XML data provided' });

    // Write temp file for parser
    const tmpPath = join(__dirname, '.tmp-health-export.xml');
    writeFileSync(tmpPath, xml);
    const { records, workouts } = parseAppleHealthXML(tmpPath);
    healthData = extractHealthData(records, workouts);
    if (goals) userGoals = goals;
    agentResults = {};

    const totalRecords = Object.values(healthData).reduce((sum, arr) => sum + arr.length, 0);
    res.json({
      ok: true,
      totalRecords,
      types: Object.fromEntries(Object.entries(healthData).map(([k, v]) => [k, v.length]))
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// API: Set goals
app.post('/api/goals', (req, res) => {
  userGoals = req.body?.goals || userGoals;
  res.json({ ok: true, goals: userGoals });
});

// API: Run agent
app.post('/api/agent/:name', async (req, res) => {
  if (!healthData) {
    return res.status(400).json({ error: 'No health data loaded. Load sample or upload XML first.' });
  }

  const available = await isAvailable();
  if (!available) {
    return res.status(503).json({ error: 'Ollama is not running. Start with: brew services start ollama' });
  }

  const { name } = req.params;
  const goals = req.body?.goals || userGoals;

  try {
    let result;
    switch (name) {
      case 'cross-source':
        result = await runCrossSource(healthData, goals);
        agentResults.crossSource = result;
        break;
      case 'trend':
        result = await runTrend(healthData, goals);
        agentResults.trend = result;
        break;
      case 'brief':
        result = await runBrief(healthData, goals);
        agentResults.brief = result;
        break;
      default:
        return res.status(404).json({ error: `Unknown agent: ${name}` });
    }
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// API: Get results
app.get('/api/results', (req, res) => {
  res.json(agentResults);
});

// API: Get results for specific agent
app.get('/api/results/:name', (req, res) => {
  const map = { 'cross-source': 'crossSource', trend: 'trend', brief: 'brief' };
  const key = map[req.params.name];
  if (!key || !agentResults[key]) return res.status(404).json({ error: 'No results yet' });
  res.json(agentResults[key]);
});

app.listen(PORT, () => {
  console.log(`\n🔬 PROOFI AGENTS — Local Dashboard`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`🌐 Dashboard:  http://localhost:${PORT}`);
  console.log(`🔒 Processing: 100% LOCAL`);
  console.log(`📡 Data sent:  ZERO BYTES\n`);
});
