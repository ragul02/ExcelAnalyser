import { Service } from '@angular/core';

/**
 * StatisticsService provides pure statistical functions for analytics.
 * All methods are side-effect free and operate on numeric arrays.
 * 
 * **Validates: Requirements 1.3, 1.4, 1.5, 1.6, 2.4, 2.5, 2.8**
 */
@Service()
export class StatisticsService {
  
  // ============================================================================
  // CORRELATION DETECTION
  // ============================================================================
  
  /**
   * Calculates Pearson correlation coefficient between two numeric arrays.
   * Returns a value between -1 (perfect negative correlation) and 1 (perfect positive correlation).
   * 
   * @param x - First numeric array
   * @param y - Second numeric array
   * @returns Pearson correlation coefficient (-1 to 1)
   */
  pearsonCorrelation(x: number[], y: number[]): number {
    const n = Math.min(x.length, y.length);
    if (n < 2) return 0;
    
    const meanX = this.mean(x.slice(0, n));
    const meanY = this.mean(y.slice(0, n));
    
    let numerator = 0;
    let sumSqX = 0;
    let sumSqY = 0;
    
    for (let i = 0; i < n; i++) {
      const dx = x[i] - meanX;
      const dy = y[i] - meanY;
      numerator += dx * dy;
      sumSqX += dx * dx;
      sumSqY += dy * dy;
    }
    
    const denominator = Math.sqrt(sumSqX * sumSqY);
    return denominator === 0 ? 0 : numerator / denominator;
  }
  
  // ============================================================================
  // OUTLIER DETECTION
  // ============================================================================
  
  /**
   * Detects outliers using the Interquartile Range (IQR) method.
   * Identifies values beyond Q1 - 1.5×IQR or Q3 + 1.5×IQR as outliers.
   * 
   * @param values - Array of numeric values
   * @returns Array of outlier objects with value, index, and z-score
   */
  detectOutliers(values: number[]): { value: number; index: number; zScore: number }[] {
    if (values.length < 4) return [];
    
    const sorted = [...values].sort((a, b) => a - b);
    const q1 = this.percentile(sorted, 25);
    const q3 = this.percentile(sorted, 75);
    const iqr = q3 - q1;
    const lowerBound = q1 - 1.5 * iqr;
    const upperBound = q3 + 1.5 * iqr;
    
    const meanVal = this.mean(values);
    const stdev = this.standardDeviation(values);
    
    return values
      .map((value, index) => ({
        value,
        index,
        zScore: stdev > 0 ? Math.abs((value - meanVal) / stdev) : 0
      }))
      .filter(item => item.value < lowerBound || item.value > upperBound);
  }
  
  // ============================================================================
  // TREND DETECTION
  // ============================================================================
  
  /**
   * Detects trend in numeric time series using linear regression slope.
   * Returns slope value and trend type (increasing/decreasing/stable).
   * 
   * @param values - Array of numeric values in time order
   * @returns Object with slope and trend type
   */
  detectTrend(values: number[]): { slope: number; type: 'increasing' | 'decreasing' | 'stable' } {
    if (values.length < 2) return { slope: 0, type: 'stable' };
    
    const n = values.length;
    const x = Array.from({ length: n }, (_, i) => i);
    const slope = this.linearRegressionSlope(x, values);
    
    // Normalize slope by value range to avoid calling small fluctuations a trend.
    const range = Math.max(...values) - Math.min(...values);
    const normalizedSlope = range > 0 ? slope / range : 0;
    
    if (Math.abs(normalizedSlope) < 0.05) return { slope, type: 'stable' };
    return { slope, type: slope > 0 ? 'increasing' : 'decreasing' };
  }
  
  /**
   * Calculates the slope of a linear regression line.
   * 
   * @param x - Independent variable values
   * @param y - Dependent variable values
   * @returns Slope of the regression line
   */
  linearRegressionSlope(x: number[], y: number[]): number {
    const n = Math.min(x.length, y.length);
    if (n < 2) return 0;
    
    const meanX = this.mean(x.slice(0, n));
    const meanY = this.mean(y.slice(0, n));
    
    let numerator = 0;
    let denominator = 0;
    
    for (let i = 0; i < n; i++) {
      const dx = x[i] - meanX;
      numerator += dx * (y[i] - meanY);
      denominator += dx * dx;
    }
    
    return denominator === 0 ? 0 : numerator / denominator;
  }
  
  // ============================================================================
  // SEASONALITY DETECTION
  // ============================================================================
  
  /**
   * Detects seasonality in time series using autocorrelation.
   * Returns period and strength if seasonal pattern exists (autocorrelation > 0.6).
   * 
   * @param values - Array of numeric values in time order
   * @param maxLag - Maximum lag to test (default: 12)
   * @returns Object with period and strength, or null if no seasonality detected
   */
  detectSeasonality(values: number[], maxLag: number = 12): { period: number; strength: number } | null {
    if (values.length < maxLag * 2) return null;
    
    let maxCorrelation = 0;
    let bestPeriod = 0;
    
    for (let lag = 2; lag <= maxLag; lag++) {
      const correlation = this.autocorrelation(values, lag);
      if (correlation > maxCorrelation) {
        maxCorrelation = correlation;
        bestPeriod = lag;
      }
    }
    
    // Consider seasonal if autocorrelation > 0.6
    return maxCorrelation > 0.6 ? { period: bestPeriod, strength: maxCorrelation } : null;
  }
  
  /**
   * Calculates autocorrelation at a specific lag.
   * 
   * @param values - Array of numeric values
   * @param lag - Lag period to calculate autocorrelation
   * @returns Autocorrelation coefficient
   */
  autocorrelation(values: number[], lag: number): number {
    if (lag >= values.length || lag < 1) return 0;
    
    const n = values.length - lag;
    const meanVal = this.mean(values);
    
    let numerator = 0;
    let denominator = 0;
    
    for (let i = 0; i < n; i++) {
      numerator += (values[i] - meanVal) * (values[i + lag] - meanVal);
    }
    
    for (let i = 0; i < values.length; i++) {
      denominator += (values[i] - meanVal) ** 2;
    }
    
    return denominator === 0 ? 0 : numerator / denominator;
  }
  
  // ============================================================================
  // FORECASTING ALGORITHMS
  // ============================================================================
  
  /**
   * Applies exponential smoothing to a time series.
   * Simple smoothing for data without trend or seasonality.
   * 
   * @param values - Array of numeric values in time order
   * @param alpha - Smoothing parameter (0-1), higher = more weight on recent values
   * @returns Array of smoothed values
   */
  exponentialSmoothing(values: number[], alpha: number): number[] {
    if (values.length === 0) return [];
    if (alpha < 0 || alpha > 1) throw new Error('Alpha must be between 0 and 1');
    
    const smoothed: number[] = [values[0]];
    
    for (let i = 1; i < values.length; i++) {
      smoothed.push(alpha * values[i] + (1 - alpha) * smoothed[i - 1]);
    }
    
    return smoothed;
  }
  
  /**
   * Applies Holt-Winters triple exponential smoothing for forecasting.
   * Handles trend and seasonality in time series data.
   * 
   * @param values - Historical time series values
   * @param alpha - Level smoothing parameter (0-1)
   * @param beta - Trend smoothing parameter (0-1)
   * @param gamma - Seasonal smoothing parameter (0-1)
   * @param period - Seasonal period length
   * @param forecast - Number of future periods to forecast
   * @returns Array containing historical fitted values and forecast values
   */
  holtWinters(
    values: number[],
    alpha: number,
    beta: number,
    gamma: number,
    period: number,
    forecast: number
  ): number[] {
    if (values.length < period * 2) {
      throw new Error(`Insufficient data: need at least ${period * 2} points for period ${period}`);
    }
    
    if (alpha < 0 || alpha > 1 || beta < 0 || beta > 1 || gamma < 0 || gamma > 1) {
      throw new Error('Alpha, beta, and gamma must be between 0 and 1');
    }
    
    const n = values.length;
    const level: number[] = new Array(n);
    const trend: number[] = new Array(n);
    const seasonal: number[] = new Array(n + forecast);
    const fitted: number[] = new Array(n + forecast);
    
    // Initialize level and trend
    level[0] = values[0];
    trend[0] = (values[period] - values[0]) / period;
    
    // Initialize seasonal components
    for (let i = 0; i < period; i++) {
      seasonal[i] = values[i] / level[0];
    }
    
    // Calculate fitted values and update components
    for (let i = 0; i < n; i++) {
      if (i === 0) {
        fitted[i] = level[0] + trend[0] + seasonal[0];
        continue;
      }
      
      const seasonalIndex = i % period;
      const previousLevel = level[i - 1];
      const previousTrend = trend[i - 1];
      
      // Update level
      level[i] = alpha * (values[i] / seasonal[seasonalIndex]) + 
                 (1 - alpha) * (previousLevel + previousTrend);
      
      // Update trend
      trend[i] = beta * (level[i] - previousLevel) + 
                 (1 - beta) * previousTrend;
      
      // Update seasonal
      seasonal[i] = gamma * (values[i] / level[i]) + 
                    (1 - gamma) * seasonal[seasonalIndex];
      
      // Calculate fitted value
      fitted[i] = (level[i] + trend[i]) * seasonal[seasonalIndex];
    }
    
    // Generate forecasts
    const lastLevel = level[n - 1];
    const lastTrend = trend[n - 1];
    
    for (let i = 0; i < forecast; i++) {
      const seasonalIndex = (n + i) % period;
      fitted[n + i] = (lastLevel + (i + 1) * lastTrend) * seasonal[seasonalIndex];
    }
    
    return fitted;
  }
  
  // ============================================================================
  // HELPER METHODS
  // ============================================================================
  
  /**
   * Calculates the arithmetic mean of an array of numbers.
   * 
   * @param values - Array of numeric values
   * @returns Mean value
   */
  mean(values: number[]): number {
    if (values.length === 0) return 0;
    return values.reduce((sum, val) => sum + val, 0) / values.length;
  }
  
  /**
   * Calculates the median of an array of numbers.
   * 
   * @param values - Array of numeric values
   * @returns Median value
   */
  median(values: number[]): number {
    if (values.length === 0) return 0;
    
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    
    return sorted.length % 2 === 0
      ? (sorted[mid - 1] + sorted[mid]) / 2
      : sorted[mid];
  }
  
  /**
   * Calculates the standard deviation of an array of numbers.
   * 
   * @param values - Array of numeric values
   * @returns Standard deviation
   */
  standardDeviation(values: number[]): number {
    if (values.length < 2) return 0;
    
    const meanVal = this.mean(values);
    const squaredDiffs = values.map(val => (val - meanVal) ** 2);
    const variance = this.mean(squaredDiffs);
    
    return Math.sqrt(variance);
  }
  
  /**
   * Calculates a specific percentile of a sorted array.
   * 
   * @param sortedValues - Array of numeric values (must be sorted)
   * @param percentile - Percentile to calculate (0-100)
   * @returns Value at the specified percentile
   */
  percentile(sortedValues: number[], percentile: number): number {
    if (sortedValues.length === 0) return 0;
    if (percentile < 0 || percentile > 100) {
      throw new Error('Percentile must be between 0 and 100');
    }
    
    const index = (percentile / 100) * (sortedValues.length - 1);
    const lower = Math.floor(index);
    const upper = Math.ceil(index);
    const weight = index - lower;
    
    if (lower === upper) return sortedValues[lower];
    
    return sortedValues[lower] * (1 - weight) + sortedValues[upper] * weight;
  }
}
