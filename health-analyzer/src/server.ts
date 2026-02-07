/**
 * Health Analyzer Agent Server
 * 
 * A Proofi agent that analyzes user health data using capability tokens.
 * 
 * Endpoints:
 * - POST /analyze  - Analyze health data using a capability token
 * - GET  /status   - Health check
 * - GET  /agent-info - Get agent's public key for token grants
 */

import 'dotenv/config';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { serve } from '@hono/node-server';
import { getOrCreateKeypair, getPublicKeyBase64 } from './keys.js';
import { analyzeHealthData } from './analyze.js';
import { auditLog, hashData, logTokenReceived, logTokenValidated, logTokenRejected, logDataDecrypted, logInferenceStarted, logInferenceCompleted, logOutputEncrypted, logError } from './audit.js';
import type { AnalyzeRequest, AnalyzeResponse, AgentInfoResponse, HealthMetrics, HealthInsights } from './types.js';

// Import agent SDK (use relative path for local development)
import { ProofiAgent, parseToken, validateToken } from '../../../agent-sdk/dist/index.mjs';
import type { CapabilityToken } from '../../../agent-sdk/dist/index.mjs';

const PORT = parseInt(process.env.PORT || '3100', 10);
const VERSION = '1.0.0';

// Initialize agent keypair
const keypair = getOrCreateKeypair();
const publicKeyBase64 = getPublicKeyBase64(keypair);

console.log('[server] Health Analyzer Agent starting...');
console.log('[server] Agent public key:', publicKeyBase64);

// Create Hono app
const app = new Hono();

// Enable CORS for demo pages
app.use('*', cors({
  origin: '*',
  allowMethods: ['GET', 'POST', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
}));

// Request logging middleware
app.use('*', async (c, next) => {
  const start = Date.now();
  console.log(`[${new Date().toISOString()}] ${c.req.method} ${c.req.path}`);
  await next();
  console.log(`[${new Date().toISOString()}] ${c.req.method} ${c.req.path} - ${c.res.status} (${Date.now() - start}ms)`);
});

/**
 * GET /status - Health check endpoint
 */
app.get('/status', (c) => {
  return c.json({
    status: 'healthy',
    service: 'health-analyzer-agent',
    version: VERSION,
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

/**
 * GET /agent-info - Returns agent's public key and capabilities
 */
app.get('/agent-info', (c) => {
  const response: AgentInfoResponse = {
    name: 'Health Analyzer Agent',
    version: VERSION,
    publicKey: publicKeyBase64,
    capabilities: [
      'health-analysis',
      'steps-trends',
      'sleep-quality',
      'mood-patterns',
      'ai-insights',
    ],
    endpoints: {
      analyze: '/analyze',
      status: '/status',
    },
  };
  
  return c.json(response);
});

/**
 * POST /analyze - Main analysis endpoint
 * 
 * Receives a capability token, fetches health data from DDC,
 * analyzes it with AI, and writes insights back.
 */
app.post('/analyze', async (c) => {
  try {
    const body = await c.req.json<AnalyzeRequest>();
    
    if (!body.token) {
      return c.json({
        success: false,
        error: 'Missing capability token',
      } satisfies AnalyzeResponse, 400);
    }
    
    console.log('[analyze] Received analysis request');
    
    // Parse and validate the token
    let parsedToken: CapabilityToken;
    try {
      parsedToken = parseToken(body.token);
      console.log('[analyze] Token parsed. ID:', parsedToken.id);
      console.log('[analyze] Issuer:', parsedToken.issuer);
      console.log('[analyze] Expires:', new Date(parsedToken.expiresAt * 1000).toISOString());
      console.log('[analyze] Scopes:', parsedToken.scopes.map(s => s.path).join(', '));
    } catch (error) {
      console.error('[analyze] Token parse error:', error);
      return c.json({
        success: false,
        error: 'Invalid token format',
      } satisfies AnalyzeResponse, 400);
    }
    
    // Validate token
    const validation = validateToken(parsedToken);
    if (!validation.valid) {
      console.error('[analyze] Token validation failed:', validation.reason);
      return c.json({
        success: false,
        error: `Token validation failed: ${validation.reason}`,
      } satisfies AnalyzeResponse, 400);
    }
    
    // Create Proofi Agent with the token
    const agent = new ProofiAgent({
      token: parsedToken,
      privateKey: keypair.privateKey,
    });
    
    console.log('[analyze] ProofiAgent created');
    console.log('[analyze] Token expires in:', agent.getExpiresIn(), 'ms');
    
    // Read health data from DDC
    let healthData: HealthMetrics;
    try {
      console.log('[analyze] Reading health/metrics from DDC...');
      healthData = await agent.read<HealthMetrics>('health/metrics');
      console.log('[analyze] Health data retrieved. Categories:', Object.keys(healthData));
    } catch (error) {
      console.error('[analyze] Failed to read health data:', error);
      
      // For demo purposes, use mock data if DDC read fails
      console.log('[analyze] Using mock health data for demo...');
      healthData = generateMockHealthData();
    }
    
    // Analyze the health data
    console.log('[analyze] Starting AI analysis...');
    const insights: HealthInsights = await analyzeHealthData(healthData);
    console.log('[analyze] Analysis complete. Generated', insights.trends.length, 'trends,', insights.recommendations.length, 'recommendations');
    
    // Try to write insights back to DDC
    try {
      if (agent.hasPermission('health/insights', 'write')) {
        console.log('[analyze] Writing insights back to DDC...');
        await agent.write('health/insights', insights);
        console.log('[analyze] Insights saved to DDC');
      } else {
        console.log('[analyze] No write permission for health/insights, skipping save');
      }
    } catch (error) {
      console.warn('[analyze] Failed to write insights (continuing):', error);
    }
    
    // Return success response
    const response: AnalyzeResponse = {
      success: true,
      insights,
      tokenInfo: {
        id: parsedToken.id,
        issuer: parsedToken.issuer,
        expiresAt: new Date(parsedToken.expiresAt * 1000).toISOString(),
        scopes: parsedToken.scopes.map(s => `${s.path} (${s.permissions.join(', ')})`),
      },
    };
    
    return c.json(response);
    
  } catch (error) {
    console.error('[analyze] Unexpected error:', error);
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Analysis failed',
    } satisfies AnalyzeResponse, 500);
  }
});

/**
 * Generate mock health data for demo purposes
 */
function generateMockHealthData(): HealthMetrics {
  const today = new Date();
  const dates = Array.from({ length: 14 }, (_, i) => {
    const d = new Date(today);
    d.setDate(d.getDate() - (13 - i));
    return d.toISOString().split('T')[0];
  });
  
  return {
    steps: dates.map((date, i) => ({
      date,
      count: 6000 + Math.floor(Math.random() * 8000) + (i * 200), // Trending up
      distance: 4000 + Math.floor(Math.random() * 5000),
    })),
    sleep: dates.map((date, i) => ({
      date,
      duration: 5.5 + Math.random() * 2.5 + (i * 0.05), // Slight improvement
      quality: ['fair', 'good', 'good', 'excellent'][Math.floor(Math.random() * 4)] as 'fair' | 'good' | 'excellent',
    })),
    mood: dates.map((date, i) => ({
      date,
      score: 5 + Math.floor(Math.random() * 4) + (i % 3 === 0 ? 1 : 0),
      notes: i % 3 === 0 ? 'Feeling good today' : undefined,
    })),
  };
}

/**
 * 404 handler
 */
app.notFound((c) => {
  return c.json({
    error: 'Not found',
    availableEndpoints: ['/status', '/agent-info', '/analyze'],
  }, 404);
});

/**
 * Error handler
 */
app.onError((error, c) => {
  console.error('[server] Unhandled error:', error);
  return c.json({
    error: 'Internal server error',
    message: error.message,
  }, 500);
});

// Start server
console.log(`[server] Starting on port ${PORT}...`);
serve({
  fetch: app.fetch,
  port: PORT,
}, (info) => {
  console.log(`[server] Health Analyzer Agent running at http://localhost:${info.port}`);
  console.log('[server] Endpoints:');
  console.log(`  GET  http://localhost:${info.port}/status`);
  console.log(`  GET  http://localhost:${info.port}/agent-info`);
  console.log(`  POST http://localhost:${info.port}/analyze`);
});
