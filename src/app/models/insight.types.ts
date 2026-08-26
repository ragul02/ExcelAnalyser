/**
 * Insight Types for Advanced Analytics
 * 
 * Defines all insight-related types and interfaces used throughout
 * the analytics system.
 * 
 * **Validates: Requirements 1.1, 1.2, 1.3, 1.4, 1.5, 1.6**
 */

/**
 * Types of insights that can be detected in datasets
 */
export type InsightType = 
  | 'correlation' 
  | 'outlier' 
  | 'trend' 
  | 'seasonality' 
  | 'distribution'
  | 'sudden_change';

/**
 * Base interface for all insights
 */
export interface Insight {
  id: string;
  type: InsightType;
  title: string;
  description: string;
  confidence: number; // 0-100
  affectedFields: string[];
  metadata: Record<string, unknown>;
  dismissed: boolean;
  timestamp: Date;
}

/**
 * Correlation insight - detects relationships between numeric fields
 */
export interface CorrelationInsight extends Insight {
  type: 'correlation';
  metadata: {
    field1: string;
    field2: string;
    coefficient: number; // -1 to 1
    sampleSize: number;
  };
}

/**
 * Outlier insight - detects anomalous values in numeric fields
 */
export interface OutlierInsight extends Insight {
  type: 'outlier';
  metadata: {
    field: string;
    outlierCount: number;
    outlierIndices: number[];
    method: 'iqr' | 'zscore';
    threshold: number;
  };
}

/**
 * Trend insight - detects directional patterns over time
 */
export interface TrendInsight extends Insight {
  type: 'trend';
  metadata: {
    field: string;
    trendType: 'increasing' | 'decreasing' | 'stable';
    slope: number;
    rSquared?: number;
  };
}

/**
 * Seasonality insight - detects periodic patterns
 */
export interface SeasonalityInsight extends Insight {
  type: 'seasonality';
  metadata: {
    field: string;
    period: number;
    strength: number; // 0-1
    dateField: string;
  };
}

/**
 * Distribution insight - detects unusual distribution patterns
 */
export interface DistributionInsight extends Insight {
  type: 'distribution';
  metadata: {
    field: string;
    distributionType: 'skewed' | 'bimodal' | 'uniform' | 'normal';
    skewness?: number;
  };
}

/**
 * Sudden change insight - detects abrupt changes in time series
 */
export interface SuddenChangeInsight extends Insight {
  type: 'sudden_change';
  metadata: {
    field: string;
    changePoint: number; // Index of the change
    magnitude: number; // Standard deviations from mean
    beforeMean: number;
    afterMean: number;
  };
}
