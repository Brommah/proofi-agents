/**
 * PROOFI AGENT #2: Trend Predictor
 *
 * Detects longitudinal patterns and predicts issues before they
 * become problems. Uses 30-90 days of data to find trends that
 * daily snapshots miss.
 *
 * Runs 100% locally via Ollama. Data never leaves your machine.
 */

import { chat } from '../lib/ollama.js';
import { computeStats } from '../lib/health-parser.js';

const AGENT_META = {
  id: 'proofi-trend-predictor',
  name: 'Trend Predictor',
  version: '1.0.0',
  description: 'Detects slow-moving health trends and predicts issues before they surface',
  icon: '📈',
  requiredData: ['sleep'],
  optionalData: ['hrv', 'restingHR', 'workouts', 'spo2', 'bodyMass', 'steps'],
  minimumDays: 30,
  accessDuration: '1h',
  processing: 'local'
};

const SYSTEM_PROMPT = `You are a longitudinal health trend analyst for Proofi. You analyze 30-90 days of health data to detect slow-moving trends that daily snapshots miss.

Your specialty: PREDICTION. You don't just say "your sleep is declining" — you project forward and warn about what happens if the trend continues.

RULES:
- Always quantify trends with specific numbers and timeframes
- Compare time periods: last 7 days vs previous 7, last 30 vs previous 30
- Identify inflection points — when did a trend start?
- Project forward: "At this rate, in 2 weeks..."
- Distinguish between noise (random variance) and signal (real trends)
- Reference specific dates/periods when you can
- Format output as JSON with the exact structure requested
- Be direct. No hedging. If the data shows a clear trend, say so.

You are running 100% locally. Sovereign AI — no data leaves this machine.`;

export async function run(healthData, userGoals = []) {
  const startTime = Date.now();
  const trends = computeTrends(healthData);
  const stats = computeStats(healthData);

  const prompt = buildPrompt(trends, stats, userGoals);

  const response = await chat([
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: prompt }
  ], { temperature: 0.3, json: true });

  let analysis;
  try {
    analysis = JSON.parse(response.trim());
  } catch {
    try {
      const cleaned = response.replace(/```json\s*/g, '').replace(/```\s*/g, '');
      const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
      analysis = jsonMatch ? JSON.parse(jsonMatch[0]) : { raw: response };
    } catch {
      analysis = { raw: response };
    }
  }

  return {
    agent: AGENT_META,
    timestamp: new Date().toISOString(),
    processingTime: Date.now() - startTime,
    processingLocation: 'local',
    model: 'llama3.2',
    dataSourcesUsed: Object.keys(trends),
    daysAnalyzed: healthData.sleep?.length || 0,
    preComputedTrends: trends,
    analysis,
    sovereignty: {
      dataLocation: 'local',
      modelLocation: 'local',
      networkCalls: 0,
      thirdPartyAccess: false
    }
  };
}

function computeTrends(data) {
  const trends = {};

  if (data.sleep?.length >= 14) {
    const sorted = [...data.sleep].sort((a, b) => new Date(a.date) - new Date(b.date));

    // Weekly aggregates
    const weeks = chunkByWeek(sorted);
    const weeklyAvgs = weeks.map(w => ({
      weekStart: w[0].date,
      avgDuration: avg(w.map(s => s.durationHours)),
      avgDeep: avg(w.map(s => s.deepSleepPct)),
      avgBedtime: avg(w.map(s => s.bedtimeHour)),
      consistency: stdDev(w.map(s => s.bedtimeHour))
    }));

    // Find inflection points
    const durations = sorted.map(s => s.durationHours);
    const movingAvg7 = movingAverage(durations, 7);
    const movingAvg14 = movingAverage(durations, 14);

    // Detect when decline started
    let declineStart = null;
    for (let i = movingAvg14.length - 1; i > 0; i--) {
      if (movingAvg14[i] > movingAvg14[i - 1] + 0.05) {
        declineStart = sorted[i]?.date;
        break;
      }
    }

    trends.sleep = {
      weeklyAvgs,
      last7avg: avg(sorted.slice(-7).map(s => s.durationHours)),
      prev7avg: avg(sorted.slice(-14, -7).map(s => s.durationHours)),
      first14avg: avg(sorted.slice(0, 14).map(s => s.durationHours)),
      last14avg: avg(sorted.slice(-14).map(s => s.durationHours)),
      overallSlope: linearSlope(durations),
      deepSleepSlope: linearSlope(sorted.map(s => s.deepSleepPct)),
      bedtimeSlope: linearSlope(sorted.map(s => s.bedtimeHour)),
      declineStartDate: declineStart,
      daysTracked: sorted.length
    };
  }

  if (data.hrv?.length >= 14) {
    const sorted = [...data.hrv].sort((a, b) => new Date(a.date) - new Date(b.date));
    const vals = sorted.map(h => h.ms);
    const weeks = chunkByWeek(sorted);

    trends.hrv = {
      weeklyAvgs: weeks.map(w => ({
        weekStart: w[0].date,
        avg: avg(w.map(h => h.ms)),
        min: Math.min(...w.map(h => h.ms)),
        max: Math.max(...w.map(h => h.ms))
      })),
      overallSlope: linearSlope(vals),
      last7avg: avg(vals.slice(-7)),
      first14avg: avg(vals.slice(0, 14)),
      last14avg: avg(vals.slice(-14)),
      volatility: stdDev(vals.slice(-14)) / avg(vals.slice(-14)),
      daysTracked: sorted.length
    };
  }

  if (data.restingHR?.length >= 14) {
    const sorted = [...data.restingHR].sort((a, b) => new Date(a.date) - new Date(b.date));
    const vals = sorted.map(h => h.bpm);

    trends.restingHR = {
      overallSlope: linearSlope(vals),
      last7avg: avg(vals.slice(-7)),
      first14avg: avg(vals.slice(0, 14)),
      last14avg: avg(vals.slice(-14)),
      daysTracked: sorted.length
    };
  }

  if (data.workouts?.length >= 7) {
    const sorted = [...data.workouts].sort((a, b) => new Date(a.date) - new Date(b.date));
    const weeks = chunkByWeek(sorted);

    trends.workouts = {
      weeklyFrequency: weeks.map(w => ({
        weekStart: w[0].date,
        count: w.length,
        avgCalories: avg(w.map(x => x.calories)),
        types: [...new Set(w.map(x => x.type))]
      })),
      frequencySlope: linearSlope(weeks.map(w => w.length)),
      daysTracked: sorted.length
    };
  }

  if (data.bodyMass?.length >= 4) {
    const sorted = [...data.bodyMass].sort((a, b) => new Date(a.date) - new Date(b.date));
    const vals = sorted.map(b => b.kg);

    trends.bodyMass = {
      readings: sorted.map(b => ({ date: b.date, kg: b.kg })),
      slope: linearSlope(vals),
      first: vals[0],
      last: vals[vals.length - 1],
      change: vals[vals.length - 1] - vals[0],
      daysTracked: sorted.length
    };
  }

  return trends;
}

function buildPrompt(trends, stats, userGoals) {
  let prompt = `Analyze these longitudinal health trends and predict what happens next. User goals: ${userGoals.length ? userGoals.join(', ') : 'general health optimization'}.

## Trend Data:
`;

  if (trends.sleep) {
    const s = trends.sleep;
    prompt += `
### Sleep Trends (${s.daysTracked} days)
- Duration slope: ${s.overallSlope > 0 ? '+' : ''}${(s.overallSlope * 7).toFixed(2)}h/week
- Deep sleep slope: ${s.deepSleepSlope > 0 ? '+' : ''}${(s.deepSleepSlope * 7 * 100).toFixed(1)}%/week
- Bedtime drift: ${s.bedtimeSlope > 0 ? '+' : ''}${(s.bedtimeSlope * 7 * 60).toFixed(0)} min/week
- First 14d avg: ${s.first14avg.toFixed(2)}h → Last 14d avg: ${s.last14avg.toFixed(2)}h
- Last 7d: ${s.last7avg.toFixed(2)}h vs prev 7d: ${s.prev7avg.toFixed(2)}h
${s.declineStartDate ? `- Decline inflection point detected: ~${s.declineStartDate}` : ''}
- Weekly breakdown: ${s.weeklyAvgs.map(w => `${w.weekStart}: ${w.avgDuration.toFixed(1)}h (deep: ${(w.avgDeep * 100).toFixed(0)}%, bedtime consistency: ±${(w.consistency * 60).toFixed(0)}min)`).join(' | ')}
`;
  }

  if (trends.hrv) {
    const h = trends.hrv;
    prompt += `
### HRV Trends (${h.daysTracked} days)
- Slope: ${h.overallSlope > 0 ? '+' : ''}${(h.overallSlope * 7).toFixed(1)}ms/week
- First 14d avg: ${h.first14avg.toFixed(0)}ms → Last 14d avg: ${h.last14avg.toFixed(0)}ms
- Last 7d: ${h.last7avg.toFixed(0)}ms
- Volatility (14d): ${(h.volatility * 100).toFixed(1)}%
- Weekly: ${h.weeklyAvgs.map(w => `${w.weekStart}: ${w.avg.toFixed(0)}ms (${w.min}-${w.max})`).join(' | ')}
`;
  }

  if (trends.restingHR) {
    const r = trends.restingHR;
    prompt += `
### Resting HR Trends (${r.daysTracked} days)
- Slope: ${r.overallSlope > 0 ? '+' : ''}${(r.overallSlope * 7).toFixed(1)}bpm/week
- First 14d: ${r.first14avg.toFixed(1)}bpm → Last 14d: ${r.last14avg.toFixed(1)}bpm
- Last 7d: ${r.last7avg.toFixed(1)}bpm
`;
  }

  if (trends.workouts) {
    const w = trends.workouts;
    prompt += `
### Workout Trends
- Frequency slope: ${w.frequencySlope > 0 ? '+' : ''}${w.frequencySlope.toFixed(2)} sessions/week change
- Weekly: ${w.weeklyFrequency.map(wk => `${wk.weekStart}: ${wk.count} sessions (${wk.types.join(', ')})`).join(' | ')}
`;
  }

  if (trends.bodyMass) {
    const b = trends.bodyMass;
    prompt += `
### Body Mass Trends
- ${b.first.toFixed(1)}kg → ${b.last.toFixed(1)}kg (${b.change > 0 ? '+' : ''}${b.change.toFixed(1)}kg)
- Slope: ${b.slope > 0 ? '+' : ''}${(b.slope * 7).toFixed(2)}kg/week
`;
  }

  prompt += `

## Instructions:
Produce a JSON response with this structure:
{
  "headline": "Most important trend prediction in one sentence",
  "trends": [
    {
      "metric": "What's trending",
      "direction": "improving|declining|stable|volatile",
      "magnitude": "Quantified change over the period",
      "inflection_point": "When did this trend start (date or 'N/A')",
      "projection": "If this continues for 2 more weeks, what happens",
      "risk_level": "high|medium|low",
      "recommendation": "Specific action to take"
    }
  ],
  "predictions": [
    {
      "timeframe": "2 weeks|1 month",
      "prediction": "What will likely happen",
      "confidence": "high|medium|low",
      "based_on": "Which data supports this"
    }
  ],
  "bright_spots": ["Things that are going well"],
  "weekly_focus": "The single thing to focus on this week"
}

Generate 3-5 trends and 2-3 predictions. Be specific with projections — use numbers, not vague statements.`;

  return prompt;
}

// Helpers
function chunkByWeek(sorted) {
  const weeks = [];
  let current = [];
  let currentWeekStart = null;

  for (const item of sorted) {
    const d = new Date(item.date || item.start);
    const weekStart = new Date(d);
    weekStart.setDate(weekStart.getDate() - weekStart.getDay());
    const weekKey = weekStart.toISOString().split('T')[0];

    if (weekKey !== currentWeekStart && current.length) {
      weeks.push(current);
      current = [];
    }
    currentWeekStart = weekKey;
    current.push(item);
  }
  if (current.length) weeks.push(current);
  return weeks;
}

function movingAverage(arr, window) {
  const result = [];
  for (let i = window - 1; i < arr.length; i++) {
    const slice = arr.slice(i - window + 1, i + 1);
    result.push(avg(slice));
  }
  return result;
}

function linearSlope(arr) {
  if (arr.length < 2) return 0;
  const n = arr.length;
  let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;
  for (let i = 0; i < n; i++) {
    sumX += i; sumY += arr[i]; sumXY += i * arr[i]; sumXX += i * i;
  }
  return (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
}

function avg(arr) {
  return arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
}

function stdDev(arr) {
  if (arr.length < 2) return 0;
  const mean = avg(arr);
  return Math.sqrt(arr.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / arr.length);
}

export { AGENT_META };
