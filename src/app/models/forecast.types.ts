/**
 * Forecast Types for Time Series Analysis
 * 
 * Defines all forecast-related types and interfaces used throughout
 * the forecasting system.
 * 
 * **Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8**
 */

/**
 * Time series data structure
 */
export interface TimeSeries {
  dates: Date[];
  values: number[];
  frequency: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly' | 'unknown';
}

/**
 * Single forecast point with confidence intervals
 */
export interface ForecastPoint {
  date: Date;
  value: number;
  lowerBound80: number;
  upperBound80: number;
  lowerBound95: number;
  upperBound95: number;
}

/**
 * Forecast accuracy metrics
 */
export interface ForecastAccuracy {
  rmse?: number;  // Root Mean Square Error
  mae?: number;   // Mean Absolute Error
  mape?: number;  // Mean Absolute Percentage Error
}

/**
 * Complete forecast result
 */
export interface ForecastResult {
  predictions: ForecastPoint[];
  accuracy: ForecastAccuracy;
  method: 'exponential_smoothing' | 'holt_winters' | 'arima';
  parameters: Record<string, number>;
  patternInfo: {
    hasTrend: boolean;
    trendType?: TrendType;
    hasSeasonality: boolean;
    seasonalPeriod?: number;
    seasonalStrength?: number;
  };
}

/**
 * Trend types detected in time series
 */
export type TrendType = 'none' | 'linear' | 'exponential' | 'logarithmic';

/**
 * Seasonality information
 */
export interface SeasonalityInfo {
  exists: boolean;
  period: number;
  strength: number;
}

/**
 * Error thrown when forecast validation fails
 */
export class ForecastError extends Error {
  constructor(
    message: string,
    public code: ForecastErrorCode,
    public userMessage: string
  ) {
    super(message);
    this.name = 'ForecastError';
  }
}

/**
 * Forecast error codes
 */
export type ForecastErrorCode =
  | 'INSUFFICIENT_DATA'
  | 'INVALID_TIME_SERIES'
  | 'INVALID_PARAMETERS'
  | 'COMPUTATION_FAILED';
