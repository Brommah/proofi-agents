/**
 * Types for Health Analyzer Agent
 */

// Re-export audit types for use in local mode
export type { AuditEntry, AuditAction } from './audit.js';

/** Health metrics data structure */
export interface HealthMetrics {
  steps?: StepsData[];
  sleep?: SleepData[];
  mood?: MoodData[];
  heartRate?: HeartRateData[];
  weight?: WeightData[];
  [key: string]: unknown;
}

export interface StepsData {
  date: string;
  count: number;
  distance?: number; // in meters
  duration?: number; // in minutes
}

export interface SleepData {
  date: string;
  duration: number; // in hours
  quality?: 'poor' | 'fair' | 'good' | 'excellent';
  deepSleep?: number; // hours
  remSleep?: number; // hours
  awakenings?: number;
}

export interface MoodData {
  date: string;
  score: number; // 1-10
  notes?: string;
  tags?: string[];
}

export interface HeartRateData {
  date: string;
  resting?: number;
  average?: number;
  max?: number;
  min?: number;
}

export interface WeightData {
  date: string;
  weight: number; // in kg
  bodyFat?: number; // percentage
}

/** AI-generated health insights */
export interface HealthInsights {
  generatedAt: string;
  summary: string;
  trends: TrendInsight[];
  recommendations: Recommendation[];
  alerts?: Alert[];
}

export interface TrendInsight {
  category: 'steps' | 'sleep' | 'mood' | 'heartRate' | 'weight' | 'overall';
  direction: 'improving' | 'stable' | 'declining';
  description: string;
  period: string;
}

export interface Recommendation {
  priority: 'high' | 'medium' | 'low';
  category: string;
  title: string;
  description: string;
  actionable: boolean;
}

export interface Alert {
  severity: 'info' | 'warning' | 'critical';
  message: string;
  metric?: string;
  threshold?: number;
  value?: number;
}

/** Analysis request body */
export interface AnalyzeRequest {
  token: string;
  options?: {
    detailed?: boolean;
    categories?: string[];
  };
}

/** Analysis response */
export interface AnalyzeResponse {
  success: boolean;
  insights?: HealthInsights;
  error?: string;
  tokenInfo?: {
    id: string;
    issuer: string;
    expiresAt: string;
    scopes: string[];
  };
}

/** Agent info response */
export interface AgentInfoResponse {
  name: string;
  version: string;
  publicKey: string;
  capabilities: string[];
  endpoints: {
    analyze: string;
    status: string;
  };
}
