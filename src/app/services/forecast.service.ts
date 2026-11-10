import { Service, inject } from '@angular/core';
import { StatisticsService } from './statistics.service';
import {
  TimeSeries,
  ForecastPoint,
  ForecastResult,
  ForecastAccuracy,
  ForecastError,
  TrendType,
  SeasonalityInfo
} from '../models/forecast.types';

type Row = Record<string, unknown>;

/**
 * ForecastService - Generates time series forecasts with confidence intervals
 * 
 * This service provides time series forecasting capabilities:
 * - Time series validation and preprocessing
 * - Pattern detection (trend and seasonality)
 * - Exponential smoothing and Holt-Winters forecasting
 * - Confidence interval calculation
 * - Forecast accuracy metrics (RMSE, MAE, MAPE)
 * 
 * **Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8, 2.9**
 */
@Service()
export class ForecastService {
  private readonly statistics = inject(StatisticsService);
  
  // Configuration constants
  private readonly MIN_DATA_POINTS = 10;
  private readonly DEFAULT_FORECAST_PERIODS = 10;
  private readonly MIN_SEASONALITY_POINTS = 12;
  
  // Smoothing parameters
  private readonly DEFAULT_ALPHA = 0.3; // Level smoothing
  private readonly DEFAULT_BETA = 0.1;  // Trend smoothing
  private readonly DEFAULT_GAMMA = 0.1; // Seasonal smoothing
  
  // ==========================================================================
  // TASK 4.1: Time Series Validation
  // ==========================================================================
  
  /**
   * Main entry point for generating forecasts
   * 
   * **Validates: Requirements 2.1, 2.2, 2.3, 2.6, 2.8**
   * 
   * @param dateField Name of the date field
   * @param measureField Name of the numeric measure field
   * @param rows Dataset rows
   * @param periods Number of periods to forecast (default: 10)
   * @returns Promise resolving to forecast result
   */
  async forecast(
    dateField: string,
    measureField: string,
    rows: Row[],
    periods: number = this.DEFAULT_FORECAST_PERIODS
  ): Promise<ForecastResult> {
    try {
      // Validate parameters
      if (periods <= 0 || periods > 100) {
        throw new ForecastError(
          'Invalid forecast periods',
          'INVALID_PARAMETERS',
          'Forecast periods must be between 1 and 100'
        );
      }
      
      // Prepare time series data
      const timeSeries = this.prepareTimeSeries(rows, dateField, measureField);
      
      // Validate time series
      if (!this.isValidTimeSeries(timeSeries)) {
        throw new ForecastError(
          'Invalid time series data',
          'INVALID_TIME_SERIES',
          `Requires at least ${this.MIN_DATA_POINTS} valid data points for forecasting`
        );
      }
      
      // Detect patterns
      const trendType = this.detectTrend(timeSeries);
      const seasonalityInfo = this.detectSeasonality(timeSeries);
      
      // Generate forecast based on detected patterns
      let result: ForecastResult;
      
      if (seasonalityInfo.exists && timeSeries.values.length >= seasonalityInfo.period * 2) {
        // Use Holt-Winters for seasonal data
        result = await this.holtWintersForecast(timeSeries, periods, seasonalityInfo);
      } else {
        // Use exponential smoothing for non-seasonal data
        result = await this.exponentialSmoothingForecast(timeSeries, periods, trendType);
      }

      result.frequency = timeSeries.frequency;
      result.duplicatePeriodsAggregated = timeSeries.duplicatePeriods;
      result.missingPeriodsEstimated = timeSeries.missingPeriods;
      
      // Add pattern information
      result.patternInfo = {
        hasTrend: trendType !== 'none',
        trendType,
        hasSeasonality: seasonalityInfo.exists,
        seasonalPeriod: seasonalityInfo.exists ? seasonalityInfo.period : undefined,
        seasonalStrength: seasonalityInfo.exists ? seasonalityInfo.strength : undefined
      };
      
      console.log(`[ForecastService] Generated ${periods}-period forecast using ${result.method}`);
      
      return result;
    } catch (error) {
      if (error instanceof ForecastError) {
        console.error(`[ForecastService] ${error.userMessage}`);
        throw error;
      }
      console.error('[ForecastService] Unexpected error during forecasting:', error);
      throw new ForecastError(
        'Forecasting failed',
        'COMPUTATION_FAILED',
        'Unable to generate forecast. Please check your data and try again.'
      );
    }
  }
  
  /**
   * Prepares time series data from rows
   * Extracts date-value pairs and sorts by date
   * 
   * **Validates: Requirements 2.1, 2.9**
   * 
   * @param rows Dataset rows
   * @param dateField Name of date field
   * @param measureField Name of measure field
   * @returns TimeSeries object
   */
  prepareTimeSeries(
    rows: Row[],
    dateField: string,
    measureField: string
  ): TimeSeries {
    const valuesByDate = new Map<number, number>();
    let validPairCount = 0;
    
    // Extract valid date-value pairs
    for (const row of rows) {
      const dateValue = row[dateField];
      const measureValue = row[measureField];
      
      if (dateValue && measureValue !== null && measureValue !== undefined) {
        // Parse date
        const date = dateValue instanceof Date 
          ? dateValue 
          : new Date(String(dateValue));
        
        // Parse numeric value
        const value = typeof measureValue === 'number'
          ? measureValue
          : Number(String(measureValue).replace(/[$€£₹,%\s]/g, ''));
        
        // Only include valid pairs
        if (!isNaN(date.getTime()) && !isNaN(value)) {
          const timestamp = date.getTime();
          valuesByDate.set(timestamp, (valuesByDate.get(timestamp) ?? 0) + value);
          validPairCount++;
        }
      }
    }
    
    // Sum repeated timestamps into one period for additive measures.
    const pairs = [...valuesByDate.entries()]
      .sort(([first], [second]) => first - second)
      .map(([timestamp, value]) => ({ date: new Date(timestamp), value }));
    
    // Detect frequency
    const dates = pairs.map((pair) => pair.date);
    const frequency = this.detectFrequency(dates);
    const intervals = dates.slice(1).map((date, index) => date.getTime() - dates[index].getTime());
    const typicalInterval = intervals.length ? this.statistics.median(intervals) : 0;
    const missingPeriods = typicalInterval
      ? intervals.reduce((total, interval) => total + Math.max(0, Math.round(interval / typicalInterval) - 1), 0)
      : 0;
    
    return {
      dates: pairs.map(p => p.date),
      values: pairs.map(p => p.value),
      frequency,
      duplicatePeriods: validPairCount - pairs.length,
      missingPeriods,
    };
  }
  
  /**
   * Validates if time series has sufficient data for forecasting
   * 
   * **Validates: Requirements 2.1, 2.9**
   * 
   * @param timeSeries Time series to validate
   * @returns True if valid, false otherwise
   */
  isValidTimeSeries(timeSeries: TimeSeries): boolean {
    // Check minimum data points
    if (timeSeries.values.length < this.MIN_DATA_POINTS) {
      return false;
    }
    
    // Check for at least some non-zero values
    const nonZeroCount = timeSeries.values.filter(v => v !== 0).length;
    if (nonZeroCount === 0) {
      return false;
    }
    
    // Check for excessive missing data (all same value indicates problem)
    const uniqueValues = new Set(timeSeries.values);
    if (uniqueValues.size === 1) {
      return false;
    }
    
    return true;
  }
  
  // ==========================================================================
  // TASK 4.2: Pattern Detection
  // ==========================================================================
  
  /**
   * Detects trend pattern in time series
   * 
   * **Validates: Requirements 2.4**
   * 
   * @param timeSeries Time series data
   * @returns Detected trend type
   */
  detectTrend(timeSeries: TimeSeries): TrendType {
    const values = timeSeries.values;
    
    if (values.length < 3) {
      return 'none';
    }
    
    // Use statistical service to detect trend
    const trendInfo = this.statistics.detectTrend(values);
    
    // If stable, no trend
    if (trendInfo.type === 'stable') {
      return 'none';
    }
    
    // Check if exponential or logarithmic by comparing linear vs log fit
    // For simplicity, we'll use linear for now
    // A more sophisticated implementation could fit multiple models and compare R²
    return 'linear';
  }
  
  /**
   * Detects seasonality in time series
   * 
   * **Validates: Requirements 2.5**
   * 
   * @param timeSeries Time series data
   * @returns Seasonality information
   */
  detectSeasonality(timeSeries: TimeSeries): SeasonalityInfo {
    const values = timeSeries.values;
    
    // Need minimum points for seasonality detection
    if (values.length < this.MIN_SEASONALITY_POINTS) {
      return { exists: false, period: 0, strength: 0 };
    }
    
    // Determine max lag based on frequency
    const maxLag = this.getMaxLagForFrequency(timeSeries.frequency, values.length);
    
    // Use statistical service to detect seasonality
    const seasonalityInfo = this.statistics.detectSeasonality(values, maxLag);
    
    if (seasonalityInfo) {
      return {
        exists: true,
        period: seasonalityInfo.period,
        strength: seasonalityInfo.strength
      };
    }
    
    return { exists: false, period: 0, strength: 0 };
  }
  
  // ==========================================================================
  // TASK 4.3: Exponential Smoothing Forecasting
  // ==========================================================================
  
  /**
   * Generates forecast using exponential smoothing
   * Suitable for data without strong seasonality
   * 
   * **Validates: Requirements 2.2, 2.3, 2.6, 2.8**
   * 
   * @param timeSeries Historical time series
   * @param periods Number of periods to forecast
   * @param trendType Detected trend type
   * @returns Forecast result with confidence intervals
   */
  async exponentialSmoothingForecast(
    timeSeries: TimeSeries,
    periods: number,
    trendType: TrendType
  ): Promise<ForecastResult> {
    const values = timeSeries.values;
    const dates = timeSeries.dates;
    
    // Apply simple exponential smoothing
    const smoothed = this.statistics.exponentialSmoothing(values, this.DEFAULT_ALPHA);
    
    // Calculate residuals for confidence intervals
    const residuals = values.map((val, i) => val - smoothed[i]);
    const residualStdev = this.statistics.standardDeviation(residuals);
    
    // Get last date and calculate date increment
    const lastDate = dates[dates.length - 1];
    const dateIncrement = this.calculateDateIncrement(dates, timeSeries.frequency);
    
    // Generate forecast points
    const predictions: ForecastPoint[] = [];
    const lastSmoothed = smoothed[smoothed.length - 1];
    
    // Calculate trend component if exists
    let trendSlope = 0;
    if (trendType !== 'none') {
      const x = Array.from({ length: values.length }, (_, i) => i);
      trendSlope = this.statistics.linearRegressionSlope(x, values);
    }
    
    for (let i = 1; i <= periods; i++) {
      const forecastValue = lastSmoothed + (trendSlope * i);
      
      // Calculate confidence intervals
      // Standard error increases with forecast horizon
      const standardError = residualStdev * Math.sqrt(1 + (i * 0.1));
      
      // 80% confidence (1.28 standard deviations)
      const margin80 = 1.28 * standardError;
      // 95% confidence (1.96 standard deviations)
      const margin95 = 1.96 * standardError;
      
      // Calculate next date
      const forecastDate = this.nextForecastDate(lastDate, timeSeries.frequency, dateIncrement);
      
      predictions.push({
        date: forecastDate,
        value: forecastValue,
        lowerBound80: forecastValue - margin80,
        upperBound80: forecastValue + margin80,
        lowerBound95: forecastValue - margin95,
        upperBound95: forecastValue + margin95
      });
      lastDate.setTime(forecastDate.getTime());
    }
    
    // Calculate accuracy metrics on historical data
    const accuracy = this.calculateAccuracy(values, smoothed);
    
    return {
      predictions,
      accuracy,
      method: 'exponential_smoothing',
      parameters: {
        alpha: this.DEFAULT_ALPHA,
        trendSlope
      },
      patternInfo: {
        hasTrend: trendType !== 'none',
        trendType,
        hasSeasonality: false
      }
    };
  }
  
  /**
   * Generates forecast using Holt-Winters triple exponential smoothing
   * Suitable for data with trend and seasonality
   * 
   * **Validates: Requirements 2.2, 2.3, 2.6, 2.8**
   * 
   * @param timeSeries Historical time series
   * @param periods Number of periods to forecast
   * @param seasonalityInfo Detected seasonality information
   * @returns Forecast result with confidence intervals
   */
  async holtWintersForecast(
    timeSeries: TimeSeries,
    periods: number,
    seasonalityInfo: SeasonalityInfo
  ): Promise<ForecastResult> {
    const values = timeSeries.values;
    const dates = timeSeries.dates;
    const period = seasonalityInfo.period;
    
    // Apply Holt-Winters
    const fitted = this.statistics.holtWinters(
      values,
      this.DEFAULT_ALPHA,
      this.DEFAULT_BETA,
      this.DEFAULT_GAMMA,
      period,
      periods
    );
    
    // Extract historical fit and forecast
    const historicalFit = fitted.slice(0, values.length);
    const forecastValues = fitted.slice(values.length);
    
    // Calculate residuals for confidence intervals
    const residuals = values.map((val, i) => val - historicalFit[i]);
    const residualStdev = this.statistics.standardDeviation(residuals);
    
    // Get last date and calculate date increment
    const lastDate = dates[dates.length - 1];
    const dateIncrement = this.calculateDateIncrement(dates, timeSeries.frequency);
    
    // Generate forecast points with confidence intervals
    const predictions: ForecastPoint[] = [];
    
    for (let i = 0; i < periods; i++) {
      const forecastValue = forecastValues[i];
      
      // Calculate confidence intervals
      // Standard error increases with forecast horizon
      const standardError = residualStdev * Math.sqrt(1 + (i * 0.15));
      
      // 80% confidence (1.28 standard deviations)
      const margin80 = 1.28 * standardError;
      // 95% confidence (1.96 standard deviations)
      const margin95 = 1.96 * standardError;
      
      // Calculate next date
      const forecastDate = this.nextForecastDate(lastDate, timeSeries.frequency, dateIncrement);
      
      predictions.push({
        date: forecastDate,
        value: forecastValue,
        lowerBound80: forecastValue - margin80,
        upperBound80: forecastValue + margin80,
        lowerBound95: forecastValue - margin95,
        upperBound95: forecastValue + margin95
      });
      lastDate.setTime(forecastDate.getTime());
    }
    
    // Calculate accuracy metrics on historical data
    const accuracy = this.calculateAccuracy(values, historicalFit);
    
    return {
      predictions,
      accuracy,
      method: 'holt_winters',
      parameters: {
        alpha: this.DEFAULT_ALPHA,
        beta: this.DEFAULT_BETA,
        gamma: this.DEFAULT_GAMMA,
        period
      },
      patternInfo: {
        hasTrend: true,
        trendType: 'linear',
        hasSeasonality: true,
        seasonalPeriod: period,
        seasonalStrength: seasonalityInfo.strength
      }
    };
  }
  
  // ==========================================================================
  // TASK 4.4: Forecast Accuracy Metrics
  // ==========================================================================
  
  /**
   * Calculates forecast accuracy metrics
   * 
   * **Validates: Requirements 2.7**
   * 
   * @param actual Actual values
   * @param predicted Predicted values
   * @returns Accuracy metrics (RMSE, MAE, MAPE)
   */
  calculateAccuracy(actual: number[], predicted: number[]): ForecastAccuracy {
    const n = Math.min(actual.length, predicted.length);
    
    if (n === 0) {
      return {};
    }
    
    let sumSquaredError = 0;
    let sumAbsoluteError = 0;
    let sumPercentageError = 0;
    let validMapeCount = 0;
    
    for (let i = 0; i < n; i++) {
      const error = actual[i] - predicted[i];
      
      // Root Mean Square Error
      sumSquaredError += error * error;
      
      // Mean Absolute Error
      sumAbsoluteError += Math.abs(error);
      
      // Mean Absolute Percentage Error (skip if actual is zero)
      if (actual[i] !== 0) {
        sumPercentageError += Math.abs(error / actual[i]);
        validMapeCount++;
      }
    }
    
    const rmse = Math.sqrt(sumSquaredError / n);
    const mae = sumAbsoluteError / n;
    const mape = validMapeCount > 0 ? (sumPercentageError / validMapeCount) * 100 : undefined;
    
    return { rmse, mae, mape };
  }
  
  // ==========================================================================
  // HELPER METHODS
  // ==========================================================================
  
  /**
   * Detects the frequency of time series data
   */
  private detectFrequency(dates: Date[]): TimeSeries['frequency'] {
    if (dates.length < 2) {
      return 'unknown';
    }
    
    const differences = dates.slice(1).map((date, index) => date.getTime() - dates[index].getTime());
    const avgDiffMs = this.statistics.median(differences);
    const avgDiffDays = avgDiffMs / (1000 * 60 * 60 * 24);
    
    // Classify frequency
    if (avgDiffDays < 2) return 'daily';
    if (avgDiffDays < 10) return 'weekly';
    if (avgDiffDays < 45) return 'monthly';
    if (avgDiffDays < 120) return 'quarterly';
    return 'yearly';
  }
  
  /**
   * Calculates the date increment in milliseconds
   */
  private calculateDateIncrement(dates: Date[], frequency: TimeSeries['frequency']): number {
    if (dates.length < 2) {
      // Default increments by frequency
      const defaults: Record<TimeSeries['frequency'], number> = {
        daily: 1000 * 60 * 60 * 24,
        weekly: 1000 * 60 * 60 * 24 * 7,
        monthly: 1000 * 60 * 60 * 24 * 30,
        quarterly: 1000 * 60 * 60 * 24 * 90,
        yearly: 1000 * 60 * 60 * 24 * 365,
        unknown: 1000 * 60 * 60 * 24
      };
      return defaults[frequency];
    }
    
    // Calculate average increment from actual data
    const differences = dates.slice(1).map((date, index) => date.getTime() - dates[index].getTime());
    return this.statistics.median(differences);
  }

  private nextForecastDate(date: Date, frequency: TimeSeries['frequency'], fallbackIncrement: number): Date {
    const year = date.getUTCFullYear();
    const month = date.getUTCMonth();
    const day = date.getUTCDate();
    const monthOffset = frequency === 'monthly' ? 1 : frequency === 'quarterly' ? 3 : frequency === 'yearly' ? 12 : 0;
    if (monthOffset) {
      const targetMonth = month + monthOffset;
      const targetYear = year + Math.floor(targetMonth / 12);
      const normalizedMonth = targetMonth % 12;
      const lastDay = new Date(Date.UTC(targetYear, normalizedMonth + 1, 0)).getUTCDate();
      return new Date(Date.UTC(targetYear, normalizedMonth, Math.min(day, lastDay), date.getUTCHours(), date.getUTCMinutes(), date.getUTCSeconds()));
    }
    if (frequency === 'daily') return new Date(Date.UTC(year, month, day + 1, date.getUTCHours(), date.getUTCMinutes(), date.getUTCSeconds()));
    if (frequency === 'weekly') return new Date(Date.UTC(year, month, day + 7, date.getUTCHours(), date.getUTCMinutes(), date.getUTCSeconds()));
    return new Date(date.getTime() + fallbackIncrement);
  }
  
  /**
   * Gets maximum lag for seasonality detection based on frequency
   */
  private getMaxLagForFrequency(frequency: TimeSeries['frequency'], dataLength: number): number {
    const maxLags: Record<TimeSeries['frequency'], number> = {
      daily: 7,      // Weekly pattern
      weekly: 52,    // Yearly pattern
      monthly: 12,   // Yearly pattern
      quarterly: 4,  // Yearly pattern
      yearly: 5,     // Multi-year pattern
      unknown: 12
    };
    
    const suggestedLag = maxLags[frequency];
    
    // Don't exceed half the data length
    return Math.min(suggestedLag, Math.floor(dataLength / 2));
  }
  
  /**
   * Validates forecast parameters
   */
  validateParameters(periods: number, timeSeries: TimeSeries): void {
    if (periods <= 0) {
      throw new ForecastError(
        'Invalid periods',
        'INVALID_PARAMETERS',
        'Number of forecast periods must be positive'
      );
    }
    
    if (!this.isValidTimeSeries(timeSeries)) {
      throw new ForecastError(
        'Invalid time series',
        'INVALID_TIME_SERIES',
        `Time series must contain at least ${this.MIN_DATA_POINTS} valid data points`
      );
    }
  }
}
