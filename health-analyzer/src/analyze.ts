/**
 * Health Analysis Logic
 * 
 * Uses AI (OpenAI/Claude) to analyze health data and generate insights.
 * Falls back to rule-based analysis if no AI API key is available.
 */

import OpenAI from 'openai';
import type { HealthMetrics, HealthInsights, TrendInsight, Recommendation, Alert } from './types.js';

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

/**
 * Main analysis function
 */
export async function analyzeHealthData(metrics: HealthMetrics): Promise<HealthInsights> {
  console.log('[analyze] Starting health data analysis...');
  console.log('[analyze] Data categories:', Object.keys(metrics).filter(k => metrics[k]));
  
  // Try AI analysis first, fall back to rule-based
  if (OPENAI_API_KEY && OPENAI_API_KEY.startsWith('sk-')) {
    try {
      console.log('[analyze] Using OpenAI for analysis');
      return await analyzeWithOpenAI(metrics);
    } catch (error) {
      console.warn('[analyze] OpenAI analysis failed, using rule-based:', error);
    }
  } else {
    console.log('[analyze] No OpenAI API key, using rule-based analysis');
  }
  
  return analyzeWithRules(metrics);
}

/**
 * AI-powered analysis using OpenAI
 */
async function analyzeWithOpenAI(metrics: HealthMetrics): Promise<HealthInsights> {
  const openai = new OpenAI({ apiKey: OPENAI_API_KEY });
  
  const prompt = `Analyze the following health data and provide insights in JSON format.

Health Data:
${JSON.stringify(metrics, null, 2)}

Provide a response in this exact JSON format:
{
  "summary": "A 2-3 sentence overview of the person's health trends",
  "trends": [
    {
      "category": "steps|sleep|mood|heartRate|weight|overall",
      "direction": "improving|stable|declining",
      "description": "What the trend shows",
      "period": "timeframe analyzed"
    }
  ],
  "recommendations": [
    {
      "priority": "high|medium|low",
      "category": "exercise|sleep|stress|nutrition|general",
      "title": "Short recommendation title",
      "description": "Detailed recommendation",
      "actionable": true
    }
  ],
  "alerts": [
    {
      "severity": "info|warning|critical",
      "message": "Alert message if any concerning patterns"
    }
  ]
}

Be encouraging and constructive. Focus on actionable insights.`;

  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      { 
        role: 'system', 
        content: 'You are a health data analyst. Analyze health metrics and provide constructive, actionable insights. Always respond with valid JSON only.' 
      },
      { role: 'user', content: prompt }
    ],
    response_format: { type: 'json_object' },
    temperature: 0.7,
    max_tokens: 1500,
  });

  const content = response.choices[0]?.message?.content;
  if (!content) {
    throw new Error('Empty response from OpenAI');
  }

  const aiInsights = JSON.parse(content);
  
  return {
    generatedAt: new Date().toISOString(),
    summary: aiInsights.summary || 'Analysis complete.',
    trends: aiInsights.trends || [],
    recommendations: aiInsights.recommendations || [],
    alerts: aiInsights.alerts || [],
  };
}

/**
 * Rule-based analysis fallback
 */
function analyzeWithRules(metrics: HealthMetrics): HealthInsights {
  const trends: TrendInsight[] = [];
  const recommendations: Recommendation[] = [];
  const alerts: Alert[] = [];
  
  // Analyze steps
  if (metrics.steps && metrics.steps.length > 0) {
    const stepsAnalysis = analyzeSteps(metrics.steps);
    trends.push(...stepsAnalysis.trends);
    recommendations.push(...stepsAnalysis.recommendations);
    alerts.push(...stepsAnalysis.alerts);
  }
  
  // Analyze sleep
  if (metrics.sleep && metrics.sleep.length > 0) {
    const sleepAnalysis = analyzeSleep(metrics.sleep);
    trends.push(...sleepAnalysis.trends);
    recommendations.push(...sleepAnalysis.recommendations);
    alerts.push(...sleepAnalysis.alerts);
  }
  
  // Analyze mood
  if (metrics.mood && metrics.mood.length > 0) {
    const moodAnalysis = analyzeMood(metrics.mood);
    trends.push(...moodAnalysis.trends);
    recommendations.push(...moodAnalysis.recommendations);
  }
  
  // Generate summary
  const summary = generateSummary(trends, metrics);
  
  return {
    generatedAt: new Date().toISOString(),
    summary,
    trends,
    recommendations,
    alerts: alerts.length > 0 ? alerts : undefined,
  };
}

/**
 * Analyze step count data
 */
function analyzeSteps(steps: HealthMetrics['steps']) {
  if (!steps || steps.length === 0) {
    return { trends: [], recommendations: [], alerts: [] };
  }
  
  const trends: TrendInsight[] = [];
  const recommendations: Recommendation[] = [];
  const alerts: Alert[] = [];
  
  const avgSteps = steps.reduce((sum, d) => sum + d.count, 0) / steps.length;
  const recentSteps = steps.slice(-7);
  const recentAvg = recentSteps.reduce((sum, d) => sum + d.count, 0) / recentSteps.length;
  
  // Determine trend
  const olderSteps = steps.slice(0, -7);
  const olderAvg = olderSteps.length > 0 
    ? olderSteps.reduce((sum, d) => sum + d.count, 0) / olderSteps.length 
    : recentAvg;
  
  const change = ((recentAvg - olderAvg) / olderAvg) * 100;
  
  let direction: 'improving' | 'stable' | 'declining' = 'stable';
  if (change > 10) direction = 'improving';
  if (change < -10) direction = 'declining';
  
  trends.push({
    category: 'steps',
    direction,
    description: `Average ${Math.round(recentAvg).toLocaleString()} steps/day over the last week (${change > 0 ? '+' : ''}${change.toFixed(1)}% vs previous)`,
    period: 'Last 7 days',
  });
  
  // Recommendations based on step count
  if (avgSteps < 5000) {
    recommendations.push({
      priority: 'high',
      category: 'exercise',
      title: 'Increase daily movement',
      description: 'Your step count is below the recommended 7,000-10,000 daily steps. Try taking short walks during breaks or using stairs instead of elevators.',
      actionable: true,
    });
  } else if (avgSteps >= 10000) {
    recommendations.push({
      priority: 'low',
      category: 'exercise',
      title: 'Great activity level!',
      description: 'You\'re consistently hitting 10,000+ steps. Consider adding strength training to complement your cardio.',
      actionable: true,
    });
  }
  
  // Check for sedentary days
  const sedentaryDays = steps.filter(d => d.count < 2000).length;
  if (sedentaryDays > 2) {
    alerts.push({
      severity: 'warning',
      message: `${sedentaryDays} very sedentary days detected (<2,000 steps)`,
      metric: 'steps',
      threshold: 2000,
    });
  }
  
  return { trends, recommendations, alerts };
}

/**
 * Analyze sleep data
 */
function analyzeSleep(sleep: HealthMetrics['sleep']) {
  if (!sleep || sleep.length === 0) {
    return { trends: [], recommendations: [], alerts: [] };
  }
  
  const trends: TrendInsight[] = [];
  const recommendations: Recommendation[] = [];
  const alerts: Alert[] = [];
  
  const avgDuration = sleep.reduce((sum, d) => sum + d.duration, 0) / sleep.length;
  const recentSleep = sleep.slice(-7);
  const recentAvg = recentSleep.reduce((sum, d) => sum + d.duration, 0) / recentSleep.length;
  
  // Trend analysis
  const olderSleep = sleep.slice(0, -7);
  const olderAvg = olderSleep.length > 0
    ? olderSleep.reduce((sum, d) => sum + d.duration, 0) / olderSleep.length
    : recentAvg;
  
  const change = ((recentAvg - olderAvg) / olderAvg) * 100;
  
  let direction: 'improving' | 'stable' | 'declining' = 'stable';
  if (change > 5 && recentAvg >= 7) direction = 'improving';
  if (change < -5 || (recentAvg < 6 && change < 0)) direction = 'declining';
  
  trends.push({
    category: 'sleep',
    direction,
    description: `Averaging ${recentAvg.toFixed(1)} hours of sleep recently`,
    period: 'Last 7 days',
  });
  
  // Recommendations
  if (avgDuration < 6) {
    recommendations.push({
      priority: 'high',
      category: 'sleep',
      title: 'Prioritize sleep duration',
      description: 'You\'re averaging less than 6 hours of sleep. Adults need 7-9 hours for optimal health. Try setting a consistent bedtime and limiting screen time before bed.',
      actionable: true,
    });
    alerts.push({
      severity: 'warning',
      message: 'Sleep duration consistently below recommended 7 hours',
      metric: 'sleep',
      threshold: 7,
      value: avgDuration,
    });
  } else if (avgDuration >= 7 && avgDuration <= 9) {
    recommendations.push({
      priority: 'low',
      category: 'sleep',
      title: 'Good sleep duration',
      description: 'You\'re getting a healthy amount of sleep. Focus on consistency and sleep quality for even better rest.',
      actionable: true,
    });
  }
  
  return { trends, recommendations, alerts };
}

/**
 * Analyze mood data
 */
function analyzeMood(mood: HealthMetrics['mood']) {
  if (!mood || mood.length === 0) {
    return { trends: [], recommendations: [] };
  }
  
  const trends: TrendInsight[] = [];
  const recommendations: Recommendation[] = [];
  
  const avgMood = mood.reduce((sum, d) => sum + d.score, 0) / mood.length;
  const recentMood = mood.slice(-7);
  const recentAvg = recentMood.reduce((sum, d) => sum + d.score, 0) / recentMood.length;
  
  const olderMood = mood.slice(0, -7);
  const olderAvg = olderMood.length > 0
    ? olderMood.reduce((sum, d) => sum + d.score, 0) / olderMood.length
    : recentAvg;
  
  let direction: 'improving' | 'stable' | 'declining' = 'stable';
  if (recentAvg > olderAvg + 0.5) direction = 'improving';
  if (recentAvg < olderAvg - 0.5) direction = 'declining';
  
  trends.push({
    category: 'mood',
    direction,
    description: `Average mood score of ${recentAvg.toFixed(1)}/10 over the last week`,
    period: 'Last 7 days',
  });
  
  if (avgMood < 5) {
    recommendations.push({
      priority: 'medium',
      category: 'stress',
      title: 'Consider stress management',
      description: 'Your mood scores suggest you might be experiencing stress. Consider practices like mindfulness, regular exercise, or talking to a professional.',
      actionable: true,
    });
  }
  
  return { trends, recommendations };
}

/**
 * Generate overall summary
 */
function generateSummary(trends: TrendInsight[], metrics: HealthMetrics): string {
  const categories = Object.keys(metrics).filter(k => metrics[k] && (metrics[k] as unknown[]).length > 0);
  
  const improving = trends.filter(t => t.direction === 'improving').length;
  const declining = trends.filter(t => t.direction === 'declining').length;
  
  let overallTrend = 'stable';
  if (improving > declining) overallTrend = 'positive';
  if (declining > improving) overallTrend = 'shows room for improvement';
  
  const parts = [
    `Analyzed ${categories.length} health categories.`,
    `Overall trend is ${overallTrend}.`,
  ];
  
  if (improving > 0) {
    parts.push(`${improving} area${improving > 1 ? 's' : ''} showing improvement.`);
  }
  
  return parts.join(' ');
}
