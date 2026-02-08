/**
 * PROOFI AGENT #1: Cross-Source Health Intel
 *
 * The agent that proves data sovereignty matters.
 * Correlates across sleep, HR, HRV, workouts, SpO2 — something
 * no single wearable app can do because they only see their own silo.
 *
 * Runs 100% locally via Ollama. Data never leaves your machine.
 */

import { chat } from '../lib/ollama.js';
import { computeStats, crossCorrelate } from '../lib/health-parser.js';

const AGENT_META = {
  id: 'proofi-cross-source-intel',
  name: 'Cross-Source Health Intel',
  version: '1.0.0',
  description: 'Finds hidden patterns across your health data that no single app can see',
  icon: '🔬',
  requiredData: ['sleep', 'heartRate|restingHR', 'hrv'],
  optionalData: ['workouts', 'spo2', 'steps', 'activeEnergy'],
  accessDuration: '24h',
  processing: 'local'
};

const SYSTEM_PROMPT = `You are a health data analyst for Proofi, a sovereign health intelligence platform. You analyze CROSS-SOURCE health data to find insights that no single wearable app can provide.

RULES:
- Be specific with numbers. Never say "your HRV is low" — say "your HRV averaged 32ms this week, down 18% from last week's 39ms"
- Always explain WHY something matters, not just what the data shows
- Every insight must reference at least 2 data sources — that's the whole point
- Give actionable recommendations, not vague advice
- Use a direct, confident tone. No hedging.
- Format output as JSON with the exact structure requested
- Do NOT include medical disclaimers in every insight — one disclaimer at the end is enough
- Severity: "high" = needs attention now, "medium" = worth adjusting, "low" = interesting pattern

You are running 100% locally on the user's machine. Their data never left their device. This is sovereign AI.`;

export async function run(healthData, userGoals = []) {
  const startTime = Date.now();
  const stats = computeStats(healthData);
  const correlations = crossCorrelate(healthData);

  // Build the analysis prompt with real data
  const dataContext = buildDataContext(stats, correlations, userGoals);

  const response = await chat([
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: dataContext }
  ], { temperature: 0.3, json: true });

  let insights;
  try {
    insights = JSON.parse(response.trim());
  } catch {
    try {
      const cleaned = response.replace(/```json\s*/g, '').replace(/```\s*/g, '');
      const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
      insights = jsonMatch ? JSON.parse(jsonMatch[0]) : { raw: response };
    } catch {
      insights = { raw: response };
    }
  }

  return {
    agent: AGENT_META,
    timestamp: new Date().toISOString(),
    processingTime: Date.now() - startTime,
    processingLocation: 'local',
    model: 'llama3.2',
    dataSourcesUsed: Object.keys(stats),
    recordsAnalyzed: Object.values(healthData).reduce((sum, arr) => sum + arr.length, 0),
    correlationsFound: correlations.length,
    preComputedCorrelations: correlations,
    insights,
    sovereignty: {
      dataLocation: 'local',
      modelLocation: 'local',
      networkCalls: 0,
      thirdPartyAccess: false
    }
  };
}

function buildDataContext(stats, correlations, userGoals) {
  let prompt = `Analyze this cross-source health data and produce insights. The user's goals: ${userGoals.length ? userGoals.join(', ') : 'general health optimization'}.

## Pre-computed correlations from statistical analysis:
${correlations.map(c => `- [${c.severity.toUpperCase()}] ${c.finding} (sources: ${c.sources.join(' + ')}, data: ${JSON.stringify(c.data)})`).join('\n')}

## Summary Statistics:
`;

  if (stats.sleep) {
    prompt += `
### Sleep (${stats.sleep.count} nights)
- Avg duration: ${stats.sleep.avgDuration.toFixed(1)}h (std dev: ${stats.sleep.stdDevDuration.toFixed(2)}h)
- Avg bedtime: ${formatHour(stats.sleep.avgBedtime)}
- Avg deep sleep: ${(stats.sleep.avgDeepPct * 100).toFixed(1)}%
- Range: ${stats.sleep.minDuration.toFixed(1)}h — ${stats.sleep.maxDuration.toFixed(1)}h
- Last 7 nights: ${stats.sleep.last7.map(s => `${s.durationHours.toFixed(1)}h`).join(', ')}
`;
  }

  if (stats.hrv) {
    prompt += `
### HRV (${stats.hrv.count} readings)
- Overall avg: ${stats.hrv.avg.toFixed(0)}ms
- Last 7d avg: ${stats.hrv.last7avg.toFixed(0)}ms vs prev 7d: ${stats.hrv.prev7avg.toFixed(0)}ms (${stats.hrv.weekOverWeekChange?.toFixed(1) || 'N/A'}% change)
- 30-day trend: ${stats.hrv.trend.direction} (slope: ${stats.hrv.trend.slope})
- Range: ${stats.hrv.min}ms — ${stats.hrv.max}ms
`;
  }

  if (stats.restingHR) {
    prompt += `
### Resting Heart Rate (${stats.restingHR.count} readings)
- Overall avg: ${stats.restingHR.avg.toFixed(1)}bpm
- Last 7d: ${stats.restingHR.last7avg.toFixed(1)}bpm vs prev 7d: ${stats.restingHR.prev7avg.toFixed(1)}bpm
- 30-day trend: ${stats.restingHR.trend.direction}
`;
  }

  if (stats.workouts) {
    prompt += `
### Workouts (${stats.workouts.count} sessions)
- Avg per week: ${stats.workouts.avgPerWeek.toFixed(1)}
- Types: ${Object.entries(stats.workouts.byType).map(([k, v]) => `${k}: ${v}`).join(', ')}
- Late intense workouts (after 7pm): ${stats.workouts.lateIntenseCount}
- Avg calories: ${stats.workouts.avgCalories.toFixed(0)} kcal
- Avg duration: ${stats.workouts.avgDuration.toFixed(0)} min
`;
  }

  if (stats.spo2) {
    prompt += `
### Blood Oxygen (${stats.spo2.count} readings)
- Avg: ${stats.spo2.avg.toFixed(1)}%
- Min: ${stats.spo2.min.toFixed(1)}%
- Dips below 96%: ${stats.spo2.dipsBelow96} occurrences
`;
  }

  if (stats.steps) {
    prompt += `
### Steps
- Daily avg: ${stats.steps.avg.toLocaleString()}
- Days above 10K: ${stats.steps.daysAbove10k}
- Days below 5K: ${stats.steps.daysBelow5k}
`;
  }

  prompt += `

## Instructions:
Produce a JSON response with exactly this structure:
{
  "headline": "One-sentence summary of the most important finding",
  "insights": [
    {
      "title": "Short title",
      "finding": "What the data shows — be specific with numbers",
      "why_it_matters": "Why this is important for health",
      "action": "Specific, actionable recommendation",
      "sources": ["data types used"],
      "severity": "high|medium|low",
      "shareable": "A tweet-length version of this insight for sharing"
    }
  ],
  "scores": {
    "sleep": 0-100,
    "recovery": 0-100,
    "activity": 0-100,
    "overall": 0-100
  },
  "top_recommendation": "The single most impactful change this person could make"
}

Generate 4-6 insights, ranked by severity. Focus on CROSS-SOURCE findings — patterns that require multiple data types to detect. This is what makes Proofi different from any single app.`;

  return prompt;
}

function formatHour(h) {
  const hours = Math.floor(h);
  const mins = Math.round((h - hours) * 60);
  return `${hours}:${mins.toString().padStart(2, '0')}`;
}

export { AGENT_META };
