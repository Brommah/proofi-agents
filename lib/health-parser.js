/**
 * Apple Health XML Parser
 * Parses Apple Health export XML into structured health data
 */

import { XMLParser } from 'fast-xml-parser';
import { readFileSync } from 'fs';

const HEALTH_TYPES = {
  sleep: [
    'HKCategoryTypeIdentifierSleepAnalysis'
  ],
  heartRate: [
    'HKQuantityTypeIdentifierHeartRate'
  ],
  hrv: [
    'HKQuantityTypeIdentifierHeartRateVariabilitySDNN'
  ],
  steps: [
    'HKQuantityTypeIdentifierStepCount'
  ],
  workouts: [
    'HKWorkoutActivityType'
  ],
  spo2: [
    'HKQuantityTypeIdentifierOxygenSaturation'
  ],
  restingHR: [
    'HKQuantityTypeIdentifierRestingHeartRate'
  ],
  activeEnergy: [
    'HKQuantityTypeIdentifierActiveEnergyBurned'
  ],
  bodyMass: [
    'HKQuantityTypeIdentifierBodyMass'
  ],
  respiratoryRate: [
    'HKQuantityTypeIdentifierRespiratoryRate'
  ]
};

export function parseAppleHealthXML(xmlPath) {
  const xml = readFileSync(xmlPath, 'utf-8');
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '',
    parseAttributeValue: true
  });
  const parsed = parser.parse(xml);
  const records = parsed?.HealthData?.Record || [];
  const workouts = parsed?.HealthData?.Workout || [];

  return { records: Array.isArray(records) ? records : [records], workouts: Array.isArray(workouts) ? workouts : [workouts] };
}

export function extractHealthData(records, workouts) {
  const data = {
    sleep: [],
    heartRate: [],
    hrv: [],
    steps: [],
    spo2: [],
    restingHR: [],
    activeEnergy: [],
    bodyMass: [],
    respiratoryRate: [],
    workouts: []
  };

  for (const r of records) {
    const type = r.type;
    if (!type) continue;

    if (HEALTH_TYPES.sleep.includes(type)) {
      data.sleep.push({
        start: r.startDate,
        end: r.endDate,
        value: r.value,
        source: r.sourceName
      });
    } else if (HEALTH_TYPES.heartRate.includes(type)) {
      data.heartRate.push({
        date: r.startDate,
        bpm: parseFloat(r.value),
        source: r.sourceName
      });
    } else if (HEALTH_TYPES.hrv.includes(type)) {
      data.hrv.push({
        date: r.startDate,
        ms: parseFloat(r.value),
        source: r.sourceName
      });
    } else if (HEALTH_TYPES.spo2.includes(type)) {
      data.spo2.push({
        date: r.startDate,
        pct: parseFloat(r.value) * 100,
        source: r.sourceName
      });
    } else if (HEALTH_TYPES.restingHR.includes(type)) {
      data.restingHR.push({
        date: r.startDate,
        bpm: parseFloat(r.value),
        source: r.sourceName
      });
    } else if (HEALTH_TYPES.steps.includes(type)) {
      data.steps.push({
        date: r.startDate,
        count: parseFloat(r.value),
        source: r.sourceName
      });
    } else if (HEALTH_TYPES.activeEnergy.includes(type)) {
      data.activeEnergy.push({
        date: r.startDate,
        kcal: parseFloat(r.value),
        source: r.sourceName
      });
    } else if (HEALTH_TYPES.bodyMass.includes(type)) {
      data.bodyMass.push({
        date: r.startDate,
        kg: parseFloat(r.value),
        source: r.sourceName
      });
    } else if (HEALTH_TYPES.respiratoryRate.includes(type)) {
      data.respiratoryRate.push({
        date: r.startDate,
        brpm: parseFloat(r.value),
        source: r.sourceName
      });
    }
  }

  for (const w of workouts) {
    if (!w.workoutActivityType) continue;
    data.workouts.push({
      type: w.workoutActivityType?.replace('HKWorkoutActivityType', ''),
      start: w.startDate,
      end: w.endDate,
      duration: parseFloat(w.duration) || 0,
      calories: parseFloat(w.totalEnergyBurned) || 0,
      distance: parseFloat(w.totalDistance) || 0,
      source: w.sourceName
    });
  }

  return data;
}

/**
 * Generate realistic sample data for demos
 */
export function generateSampleData(days = 90) {
  const data = {
    sleep: [],
    heartRate: [],
    hrv: [],
    steps: [],
    spo2: [],
    restingHR: [],
    activeEnergy: [],
    workouts: [],
    bodyMass: [],
    respiratoryRate: []
  };

  const now = new Date();

  for (let d = 0; d < days; d++) {
    const date = new Date(now);
    date.setDate(date.getDate() - d);
    const dateStr = date.toISOString().split('T')[0];

    // Day-of-week patterns (weekends = later bedtime, more sleep)
    const isWeekend = date.getDay() === 0 || date.getDay() === 6;
    const dayVariance = Math.random() * 0.4 - 0.2;

    // Gradual trend: sleep quality declining slightly over time (for trend agent to catch)
    const trendFactor = d > 45 ? 0 : (d - 45) * 0.005;

    // Sleep
    const bedtimeHour = isWeekend ? 23.5 + Math.random() * 1.5 : 22.5 + Math.random() * 1;
    const sleepHours = (isWeekend ? 8.2 : 7.1) + dayVariance + trendFactor;
    const deepPct = 0.15 + Math.random() * 0.1 + trendFactor * 0.5;
    const remPct = 0.2 + Math.random() * 0.08;
    const sleepStart = new Date(date);
    sleepStart.setHours(Math.floor(bedtimeHour), (bedtimeHour % 1) * 60, 0);
    const sleepEnd = new Date(sleepStart.getTime() + sleepHours * 3600000);

    data.sleep.push({
      date: dateStr,
      start: sleepStart.toISOString(),
      end: sleepEnd.toISOString(),
      durationHours: Math.round(sleepHours * 100) / 100,
      deepSleepPct: Math.round(deepPct * 100) / 100,
      remSleepPct: Math.round(remPct * 100) / 100,
      lightSleepPct: Math.round((1 - deepPct - remPct) * 100) / 100,
      bedtimeHour: Math.round(bedtimeHour * 10) / 10,
      source: 'Apple Watch'
    });

    // Did they work out today?
    const workedOut = Math.random() > 0.35;
    const lateWorkout = workedOut && Math.random() > 0.5;
    const workoutHour = lateWorkout ? 19 + Math.random() * 2 : 7 + Math.random() * 3;
    const workoutTypes = ['Running', 'Cycling', 'Strength', 'HIIT', 'Yoga', 'Swimming'];
    const workoutType = workoutTypes[Math.floor(Math.random() * workoutTypes.length)];
    const isIntense = ['Running', 'HIIT', 'Cycling'].includes(workoutType);

    if (workedOut) {
      const workoutDuration = isIntense ? 30 + Math.random() * 40 : 20 + Math.random() * 50;
      const workoutStart = new Date(date);
      workoutStart.setHours(Math.floor(workoutHour), (workoutHour % 1) * 60, 0);
      data.workouts.push({
        date: dateStr,
        type: workoutType,
        start: workoutStart.toISOString(),
        durationMin: Math.round(workoutDuration),
        calories: Math.round(isIntense ? 300 + Math.random() * 400 : 100 + Math.random() * 200),
        hour: Math.round(workoutHour * 10) / 10,
        isLate: lateWorkout,
        isIntense,
        source: 'Apple Watch'
      });
    }

    // Heart Rate — affected by workout, sleep, stress
    const baseHR = 62 + Math.random() * 8;
    const hrImpact = workedOut && isIntense ? 3 : 0;
    const sleepImpact = sleepHours < 7 ? 4 : 0;
    // Generate multiple HR readings per day
    for (let h = 0; h < 8; h++) {
      data.heartRate.push({
        date: dateStr,
        hour: 8 + h * 2,
        bpm: Math.round(baseHR + hrImpact + sleepImpact + (Math.random() * 10 - 5)),
        source: 'Apple Watch'
      });
    }

    // Resting HR
    const restingHR = baseHR - 4 + (sleepHours < 7 ? 3 : 0) + (workedOut && isIntense && lateWorkout ? 4 : 0);
    data.restingHR.push({
      date: dateStr,
      bpm: Math.round(restingHR * 10) / 10,
      source: 'Apple Watch'
    });

    // HRV — inversely correlated with stress, poor sleep, late intense workouts
    const baseHRV = 45 + Math.random() * 20;
    const hrvSleepPenalty = sleepHours < 7 ? -12 : 0;
    const hrvWorkoutPenalty = lateWorkout && isIntense ? -15 : 0;
    const hrvTrend = d > 45 ? 0 : (d - 45) * 0.15; // declining HRV trend
    data.hrv.push({
      date: dateStr,
      ms: Math.round(Math.max(15, baseHRV + hrvSleepPenalty + hrvWorkoutPenalty + hrvTrend)),
      source: 'Apple Watch'
    });

    // SpO2
    const baseSpo2 = 97 + Math.random() * 2;
    const spo2SleepImpact = deepPct < 0.12 ? -1.5 : 0;
    data.spo2.push({
      date: dateStr,
      pct: Math.round((baseSpo2 + spo2SleepImpact) * 10) / 10,
      source: 'Apple Watch'
    });

    // Steps
    data.steps.push({
      date: dateStr,
      count: Math.round(workedOut ? 8000 + Math.random() * 7000 : 4000 + Math.random() * 4000),
      source: 'iPhone'
    });

    // Active energy
    data.activeEnergy.push({
      date: dateStr,
      kcal: Math.round(workedOut ? 400 + Math.random() * 400 : 150 + Math.random() * 200),
      source: 'Apple Watch'
    });

    // Respiratory rate
    data.respiratoryRate.push({
      date: dateStr,
      brpm: Math.round((14 + Math.random() * 4) * 10) / 10,
      source: 'Apple Watch'
    });

    // Body mass (weekly)
    if (d % 7 === 0) {
      data.bodyMass.push({
        date: dateStr,
        kg: Math.round((78 + Math.random() * 2 - d * 0.01) * 10) / 10,
        source: 'Withings Scale'
      });
    }
  }

  return data;
}

/**
 * Compute summary stats for agent consumption
 */
export function computeStats(data) {
  const stats = {};

  if (data.sleep.length) {
    const durations = data.sleep.map(s => s.durationHours);
    const bedtimes = data.sleep.map(s => s.bedtimeHour);
    const deepPcts = data.sleep.map(s => s.deepSleepPct);
    stats.sleep = {
      count: data.sleep.length,
      avgDuration: avg(durations),
      minDuration: Math.min(...durations),
      maxDuration: Math.max(...durations),
      avgBedtime: avg(bedtimes),
      avgDeepPct: avg(deepPcts),
      stdDevDuration: stdDev(durations),
      last7: data.sleep.slice(0, 7),
      last30: data.sleep.slice(0, 30)
    };
  }

  if (data.hrv.length) {
    const vals = data.hrv.map(h => h.ms);
    const last7 = data.hrv.slice(0, 7).map(h => h.ms);
    const prev7 = data.hrv.slice(7, 14).map(h => h.ms);
    stats.hrv = {
      count: data.hrv.length,
      avg: avg(vals),
      min: Math.min(...vals),
      max: Math.max(...vals),
      last7avg: avg(last7),
      prev7avg: avg(prev7),
      weekOverWeekChange: prev7.length ? ((avg(last7) - avg(prev7)) / avg(prev7) * 100) : null,
      trend: linearTrend(vals.slice(0, 30))
    };
  }

  if (data.restingHR.length) {
    const vals = data.restingHR.map(h => h.bpm);
    stats.restingHR = {
      count: data.restingHR.length,
      avg: avg(vals),
      last7avg: avg(vals.slice(0, 7)),
      prev7avg: avg(vals.slice(7, 14)),
      trend: linearTrend(vals.slice(0, 30))
    };
  }

  if (data.workouts.length) {
    const byType = {};
    for (const w of data.workouts) {
      byType[w.type] = (byType[w.type] || 0) + 1;
    }
    const lateIntense = data.workouts.filter(w => w.isLate && w.isIntense);
    stats.workouts = {
      count: data.workouts.length,
      byType,
      avgPerWeek: data.workouts.length / (data.sleep.length / 7),
      lateIntenseCount: lateIntense.length,
      avgCalories: avg(data.workouts.map(w => w.calories)),
      avgDuration: avg(data.workouts.map(w => w.durationMin))
    };
  }

  if (data.spo2.length) {
    const vals = data.spo2.map(s => s.pct);
    stats.spo2 = {
      count: data.spo2.length,
      avg: avg(vals),
      min: Math.min(...vals),
      dipsBelow96: vals.filter(v => v < 96).length
    };
  }

  if (data.steps.length) {
    const vals = data.steps.map(s => s.count);
    stats.steps = {
      avg: Math.round(avg(vals)),
      daysAbove10k: vals.filter(v => v >= 10000).length,
      daysBelow5k: vals.filter(v => v < 5000).length
    };
  }

  return stats;
}

/**
 * Cross-correlate data for the cross-source agent
 */
export function crossCorrelate(data) {
  const correlations = [];
  const days = {};

  // Index everything by date
  for (const s of data.sleep) days[s.date] = { ...days[s.date], sleep: s };
  for (const h of data.hrv) days[h.date] = { ...days[h.date], hrv: h };
  for (const h of data.restingHR) days[h.date] = { ...days[h.date], restingHR: h };
  for (const s of data.spo2) days[s.date] = { ...days[s.date], spo2: s };
  for (const w of data.workouts) {
    if (!days[w.date]) days[w.date] = {};
    days[w.date].workout = w;
  }
  for (const s of data.steps) days[s.date] = { ...days[s.date], steps: s };

  const dates = Object.keys(days).sort().reverse();

  // Late intense workout → next day HRV/sleep impact
  const lateWorkoutDays = [];
  const noLateWorkoutDays = [];
  for (let i = 1; i < dates.length; i++) {
    const prevDay = days[dates[i]];
    const nextDay = days[dates[i - 1]];
    if (!nextDay?.hrv || !nextDay?.sleep) continue;
    if (prevDay?.workout?.isLate && prevDay?.workout?.isIntense) {
      lateWorkoutDays.push({ hrv: nextDay.hrv.ms, sleep: nextDay.sleep.durationHours, deep: nextDay.sleep.deepSleepPct });
    } else {
      noLateWorkoutDays.push({ hrv: nextDay.hrv.ms, sleep: nextDay.sleep.durationHours, deep: nextDay.sleep.deepSleepPct });
    }
  }

  if (lateWorkoutDays.length >= 3 && noLateWorkoutDays.length >= 3) {
    const lateHRV = avg(lateWorkoutDays.map(d => d.hrv));
    const noLateHRV = avg(noLateWorkoutDays.map(d => d.hrv));
    const hrvDrop = ((noLateHRV - lateHRV) / noLateHRV * 100);

    const lateSleep = avg(lateWorkoutDays.map(d => d.sleep));
    const noLateSleep = avg(noLateWorkoutDays.map(d => d.sleep));

    const lateDeep = avg(lateWorkoutDays.map(d => d.deep));
    const noLateDeep = avg(noLateWorkoutDays.map(d => d.deep));

    correlations.push({
      id: 'late_workout_hrv',
      type: 'cross_source',
      sources: ['workouts', 'hrv', 'sleep'],
      finding: `Late intense workouts (after 7pm) correlate with ${hrvDrop.toFixed(0)}% lower HRV the next day`,
      data: {
        lateWorkoutDays: lateWorkoutDays.length,
        normalDays: noLateWorkoutDays.length,
        avgHRVAfterLate: Math.round(lateHRV),
        avgHRVNormal: Math.round(noLateHRV),
        hrvDropPct: Math.round(hrvDrop),
        sleepAfterLate: Math.round(lateSleep * 100) / 100,
        sleepNormal: Math.round(noLateSleep * 100) / 100,
        deepSleepAfterLate: Math.round(lateDeep * 100),
        deepSleepNormal: Math.round(noLateDeep * 100)
      },
      severity: hrvDrop > 15 ? 'high' : hrvDrop > 8 ? 'medium' : 'low'
    });
  }

  // Short sleep → resting HR impact
  const shortSleepDays = [];
  const goodSleepDays = [];
  for (const date of dates) {
    const day = days[date];
    if (!day?.sleep || !day?.restingHR) continue;
    if (day.sleep.durationHours < 7) {
      shortSleepDays.push({ rhr: day.restingHR.bpm, hrv: day.hrv?.ms, sleep: day.sleep.durationHours });
    } else {
      goodSleepDays.push({ rhr: day.restingHR.bpm, hrv: day.hrv?.ms, sleep: day.sleep.durationHours });
    }
  }

  if (shortSleepDays.length >= 3 && goodSleepDays.length >= 3) {
    const shortRHR = avg(shortSleepDays.map(d => d.rhr));
    const goodRHR = avg(goodSleepDays.map(d => d.rhr));
    correlations.push({
      id: 'sleep_rhr',
      type: 'cross_source',
      sources: ['sleep', 'restingHR'],
      finding: `Nights under 7h sleep correlate with resting HR ${(shortRHR - goodRHR).toFixed(1)}bpm higher the next day`,
      data: {
        shortSleepDays: shortSleepDays.length,
        goodSleepDays: goodSleepDays.length,
        avgRHRShort: Math.round(shortRHR * 10) / 10,
        avgRHRGood: Math.round(goodRHR * 10) / 10,
        difference: Math.round((shortRHR - goodRHR) * 10) / 10
      },
      severity: (shortRHR - goodRHR) > 5 ? 'high' : 'medium'
    });
  }

  // SpO2 ↔ deep sleep correlation
  const lowDeepDays = [];
  const goodDeepDays = [];
  for (const date of dates) {
    const day = days[date];
    if (!day?.sleep || !day?.spo2) continue;
    if (day.sleep.deepSleepPct < 0.13) {
      lowDeepDays.push({ spo2: day.spo2.pct, deep: day.sleep.deepSleepPct });
    } else {
      goodDeepDays.push({ spo2: day.spo2.pct, deep: day.sleep.deepSleepPct });
    }
  }

  if (lowDeepDays.length >= 3 && goodDeepDays.length >= 3) {
    const lowDeepSpo2 = avg(lowDeepDays.map(d => d.spo2));
    const goodDeepSpo2 = avg(goodDeepDays.map(d => d.spo2));
    correlations.push({
      id: 'deep_sleep_spo2',
      type: 'cross_source',
      sources: ['sleep', 'spo2'],
      finding: `Low deep sleep nights (<13%) show SpO2 averaging ${lowDeepSpo2.toFixed(1)}% vs ${goodDeepSpo2.toFixed(1)}% on good nights`,
      data: {
        lowDeepDays: lowDeepDays.length,
        goodDeepDays: goodDeepDays.length,
        avgSpo2LowDeep: Math.round(lowDeepSpo2 * 10) / 10,
        avgSpo2GoodDeep: Math.round(goodDeepSpo2 * 10) / 10
      },
      severity: (goodDeepSpo2 - lowDeepSpo2) > 1 ? 'medium' : 'low'
    });
  }

  // Bedtime consistency → sleep quality
  const bedtimes = data.sleep.slice(0, 30).map(s => s.bedtimeHour);
  const bedtimeStdDev = stdDev(bedtimes);
  if (bedtimeStdDev > 0.5) {
    // Split into consistent vs inconsistent weeks
    const weeklyConsistency = [];
    for (let w = 0; w < 4; w++) {
      const weekSleep = data.sleep.slice(w * 7, (w + 1) * 7);
      if (weekSleep.length < 5) continue;
      const weekBedtimes = weekSleep.map(s => s.bedtimeHour);
      const weekDeep = weekSleep.map(s => s.deepSleepPct);
      weeklyConsistency.push({
        bedtimeStdDev: stdDev(weekBedtimes),
        avgDeepPct: avg(weekDeep),
        avgDuration: avg(weekSleep.map(s => s.durationHours))
      });
    }

    if (weeklyConsistency.length >= 2) {
      const sorted = weeklyConsistency.sort((a, b) => a.bedtimeStdDev - b.bedtimeStdDev);
      const consistent = sorted[0];
      const inconsistent = sorted[sorted.length - 1];

      correlations.push({
        id: 'bedtime_consistency',
        type: 'pattern',
        sources: ['sleep'],
        finding: `Weeks with consistent bedtimes show ${Math.round((consistent.avgDeepPct - inconsistent.avgDeepPct) * 100)}% more deep sleep`,
        data: {
          consistentWeekDeep: Math.round(consistent.avgDeepPct * 100),
          inconsistentWeekDeep: Math.round(inconsistent.avgDeepPct * 100),
          bedtimeVariation: Math.round(bedtimeStdDev * 60)
        },
        severity: 'medium'
      });
    }
  }

  // Combined: short sleep + late workout + next day
  const combinedBad = [];
  const combinedGood = [];
  for (let i = 1; i < dates.length; i++) {
    const prevDay = days[dates[i]];
    const nextDay = days[dates[i - 1]];
    if (!prevDay?.sleep || !nextDay?.restingHR || !nextDay?.hrv) continue;
    const hadLateWorkout = prevDay.workout?.isLate && prevDay.workout?.isIntense;
    const shortSleep = prevDay.sleep.durationHours < 7;
    if (hadLateWorkout && shortSleep) {
      combinedBad.push({ rhr: nextDay.restingHR.bpm, hrv: nextDay.hrv.ms });
    } else if (!hadLateWorkout && !shortSleep) {
      combinedGood.push({ rhr: nextDay.restingHR.bpm, hrv: nextDay.hrv.ms });
    }
  }

  if (combinedBad.length >= 2 && combinedGood.length >= 3) {
    correlations.push({
      id: 'compound_stress',
      type: 'cross_source',
      sources: ['sleep', 'workouts', 'hrv', 'restingHR'],
      finding: `Late intense workouts + short sleep (<7h) compound: next-day HRV drops ${Math.round((1 - avg(combinedBad.map(d => d.hrv)) / avg(combinedGood.map(d => d.hrv))) * 100)}% vs baseline`,
      data: {
        badDays: combinedBad.length,
        goodDays: combinedGood.length,
        badDayHRV: Math.round(avg(combinedBad.map(d => d.hrv))),
        goodDayHRV: Math.round(avg(combinedGood.map(d => d.hrv))),
        badDayRHR: Math.round(avg(combinedBad.map(d => d.rhr)) * 10) / 10,
        goodDayRHR: Math.round(avg(combinedGood.map(d => d.rhr)) * 10) / 10
      },
      severity: 'high'
    });
  }

  return correlations;
}

// Helpers
function avg(arr) {
  if (!arr.length) return 0;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function stdDev(arr) {
  if (arr.length < 2) return 0;
  const mean = avg(arr);
  return Math.sqrt(arr.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / arr.length);
}

function linearTrend(arr) {
  if (arr.length < 7) return { slope: 0, direction: 'stable' };
  const n = arr.length;
  let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;
  for (let i = 0; i < n; i++) {
    sumX += i;
    sumY += arr[i];
    sumXY += i * arr[i];
    sumXX += i * i;
  }
  const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
  const direction = slope > 0.1 ? 'increasing' : slope < -0.1 ? 'decreasing' : 'stable';
  return { slope: Math.round(slope * 1000) / 1000, direction };
}
