/**
 * PROOFI AGENT #3: Personalized Weekly Brief
 *
 * Replaces 4 app dashboards with one Monday morning summary.
 * Synthesizes all health data relative to YOUR goals.
 *
 * Runs 100% locally via Ollama. Data never leaves your machine.
 */

import { chat } from '../lib/ollama.js';
import { computeStats, crossCorrelate } from '../lib/health-parser.js';

const AGENT_META = {
  id: 'proofi-weekly-brief',
  name: 'Weekly Health Brief',
  version: '1.0.0',
  description: 'Your Monday morning health summary — all your data, one brief, your goals',
  icon: '📋',
  requiredData: ['sleep'],
  optionalData: ['hrv', 'restingHR', 'heartRate', 'workouts', 'spo2', 'steps', 'activeEnergy', 'bodyMass'],
  accessDuration: 'recurring-weekly',
  processing: 'local'
};

const SYSTEM_PROMPT = `You are the Proofi Weekly Brief generator. You create a concise, actionable Monday morning health summary.

TONE: Like a great personal trainer who's also a data scientist. Warm but direct. Celebrates wins, flags concerns, always actionable.

RULES:
- Open with the single most important takeaway
- Use specific numbers everywhere — never "your sleep improved", always "you slept 7.4h avg, up 23min from last week"
- Connect every observation to the user's stated goals
- End with exactly ONE focus for the coming week
- Keep it scannable — the user should get the gist in 30 seconds
- Format as JSON with the exact structure requested
- Max 5 bullet points per section. Brevity is king.

You are running 100% locally. This brief was generated without sending a single byte of health data over the internet.`;

export async function run(healthData, userGoals = ['general health optimization']) {
  const startTime = Date.now();

  // Get this week's and last week's data
  const thisWeek = sliceLastNDays(healthData, 7);
  const lastWeek = sliceLastNDays(healthData, 14, 7);
  const thisWeekStats = computeStats(thisWeek);
  const lastWeekStats = computeStats(lastWeek);
  const correlations = crossCorrelate(healthData);

  const prompt = buildBriefPrompt(thisWeek, thisWeekStats, lastWeekStats, correlations, userGoals);

  const response = await chat([
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: prompt }
  ], { temperature: 0.4, json: true });

  let brief;
  try {
    // Try parsing the full response first (common when LLM returns clean JSON)
    brief = JSON.parse(response.trim());
  } catch {
    try {
      // Extract JSON block from markdown code fences or surrounding text
      const cleaned = response.replace(/```json\s*/g, '').replace(/```\s*/g, '');
      const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
      brief = jsonMatch ? JSON.parse(jsonMatch[0]) : { raw: response };
    } catch {
      brief = { raw: response };
    }
  }

  return {
    agent: AGENT_META,
    timestamp: new Date().toISOString(),
    weekOf: getWeekLabel(),
    processingTime: Date.now() - startTime,
    processingLocation: 'local',
    model: 'llama3.2',
    dataSourcesUsed: Object.keys(thisWeekStats),
    brief,
    sovereignty: {
      dataLocation: 'local',
      modelLocation: 'local',
      networkCalls: 0,
      thirdPartyAccess: false
    }
  };
}

function buildBriefPrompt(thisWeek, thisStats, lastStats, correlations, goals) {
  let prompt = `Generate the weekly health brief for ${getWeekLabel()}.

User goals: ${goals.join(', ')}

## This Week vs Last Week:
`;

  if (thisStats.sleep && lastStats.sleep) {
    const durChange = thisStats.sleep.avgDuration - lastStats.sleep.avgDuration;
    const deepChange = thisStats.sleep.avgDeepPct - lastStats.sleep.avgDeepPct;
    prompt += `
### Sleep
- This week: ${thisStats.sleep.avgDuration.toFixed(1)}h avg (${durChange >= 0 ? '+' : ''}${(durChange * 60).toFixed(0)}min vs last week)
- Deep sleep: ${(thisStats.sleep.avgDeepPct * 100).toFixed(0)}% (${deepChange >= 0 ? '+' : ''}${(deepChange * 100).toFixed(1)}% vs last week)
- Avg bedtime: ${formatHour(thisStats.sleep.avgBedtime)} (last week: ${formatHour(lastStats.sleep.avgBedtime)})
- Consistency (stddev): ${(thisStats.sleep.stdDevDuration * 60).toFixed(0)}min (last week: ${(lastStats.sleep.stdDevDuration * 60).toFixed(0)}min)
- Night by night: ${thisWeek.sleep.map(s => `${s.date?.split('-').slice(1).join('/')}: ${s.durationHours.toFixed(1)}h`).join(', ')}
`;
  }

  if (thisStats.hrv && lastStats.hrv) {
    prompt += `
### HRV
- This week avg: ${thisStats.hrv.avg.toFixed(0)}ms (last week: ${lastStats.hrv.avg.toFixed(0)}ms, ${thisStats.hrv.weekOverWeekChange?.toFixed(1) || 'N/A'}% change)
- Range: ${thisStats.hrv.min}-${thisStats.hrv.max}ms
`;
  }

  if (thisStats.restingHR && lastStats.restingHR) {
    const rhrChange = thisStats.restingHR.avg - lastStats.restingHR.avg;
    prompt += `
### Resting Heart Rate
- This week: ${thisStats.restingHR.avg.toFixed(1)}bpm (${rhrChange >= 0 ? '+' : ''}${rhrChange.toFixed(1)} vs last week)
`;
  }

  if (thisStats.workouts && lastStats.workouts) {
    prompt += `
### Workouts
- This week: ${thisStats.workouts.count} sessions (last week: ${lastStats.workouts.count})
- Types: ${Object.entries(thisStats.workouts.byType).map(([k, v]) => `${k}: ${v}`).join(', ')}
- Late intense workouts: ${thisStats.workouts.lateIntenseCount}
- Avg calories: ${thisStats.workouts.avgCalories.toFixed(0)} kcal/session
`;
  }

  if (thisStats.spo2) {
    prompt += `
### Blood Oxygen
- Avg: ${thisStats.spo2.avg.toFixed(1)}% | Min: ${thisStats.spo2.min.toFixed(1)}% | Dips <96%: ${thisStats.spo2.dipsBelow96}
`;
  }

  if (thisStats.steps) {
    prompt += `
### Activity
- Daily steps avg: ${thisStats.steps.avg.toLocaleString()}
- Days 10K+: ${thisStats.steps.daysAbove10k} | Days <5K: ${thisStats.steps.daysBelow5k}
`;
  }

  if (correlations.length) {
    prompt += `
### Cross-Source Patterns Detected:
${correlations.slice(0, 3).map(c => `- [${c.severity}] ${c.finding}`).join('\n')}
`;
  }

  prompt += `

## Instructions:
Generate a weekly health brief as JSON:
{
  "greeting": "Personalized one-liner setting the tone (e.g., 'Solid week — your sleep is trending up and it shows')",
  "top_insight": {
    "title": "The #1 thing to know",
    "detail": "Specific, data-backed explanation",
    "emoji": "single relevant emoji"
  },
  "wins": [
    "Things that improved or went well this week (max 3, specific numbers)"
  ],
  "watch_out": [
    "Things that need attention (max 2, with why it matters)"
  ],
  "goal_progress": [
    {
      "goal": "User goal",
      "status": "on_track|needs_attention|improving",
      "detail": "Progress update with numbers"
    }
  ],
  "scores": {
    "sleep_score": 0-100,
    "recovery_score": 0-100,
    "activity_score": 0-100,
    "weekly_score": 0-100
  },
  "focus_this_week": {
    "what": "Single specific thing to focus on",
    "why": "Why this matters most right now",
    "how": "Concrete steps to do it"
  },
  "shareable_summary": "A 2-sentence summary suitable for sharing (no private data, just the vibe)"
}

Make it feel like a personal trainer who actually looked at your data — not a generic dashboard.`;

  return prompt;
}

function sliceLastNDays(data, n, offset = 0) {
  const sliced = {};
  const now = new Date();
  const start = new Date(now);
  start.setDate(start.getDate() - n - offset);
  const end = new Date(now);
  end.setDate(end.getDate() - offset);

  for (const [key, records] of Object.entries(data)) {
    sliced[key] = records.filter(r => {
      const d = new Date(r.date || r.start);
      return d >= start && d < end;
    });
  }
  return sliced;
}

function getWeekLabel() {
  const now = new Date();
  const weekStart = new Date(now);
  weekStart.setDate(weekStart.getDate() - weekStart.getDay() + 1);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 6);
  return `${weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} — ${weekEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
}

function formatHour(h) {
  const hours = Math.floor(h);
  const mins = Math.round((h - hours) * 60);
  return `${hours}:${mins.toString().padStart(2, '0')}`;
}

export { AGENT_META };
