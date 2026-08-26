import { TestBed } from '@angular/core/testing';
import { StatisticsService } from './statistics.service';

describe('StatisticsService', () => {
  let service: StatisticsService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(StatisticsService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  // ============================================================================
  // CORRELATION TESTS
  // ============================================================================

  describe('pearsonCorrelation', () => {
    it('should return 1 for perfectly correlated data', () => {
      const x = [1, 2, 3, 4, 5];
      const y = [2, 4, 6, 8, 10];
      expect(service.pearsonCorrelation(x, y)).toBeCloseTo(1, 5);
    });

    it('should return -1 for perfectly negatively correlated data', () => {
      const x = [1, 2, 3, 4, 5];
      const y = [10, 8, 6, 4, 2];
      expect(service.pearsonCorrelation(x, y)).toBeCloseTo(-1, 5);
    });

    it('should return 0 for uncorrelated data', () => {
      const x = [1, 2, 3, 4, 5];
      const y = [5, 2, 8, 1, 9];
      const correlation = service.pearsonCorrelation(x, y);
      expect(Math.abs(correlation)).toBeLessThan(0.5);
    });

    it('should handle arrays of different lengths by using shorter length', () => {
      const x = [1, 2, 3, 4, 5];
      const y = [2, 4, 6];
      expect(() => service.pearsonCorrelation(x, y)).not.toThrow();
      expect(service.pearsonCorrelation(x, y)).toBeCloseTo(1, 5);
    });

    it('should return 0 for empty arrays', () => {
      expect(service.pearsonCorrelation([], [])).toBe(0);
    });

    it('should return 0 for single-element arrays', () => {
      expect(service.pearsonCorrelation([1], [2])).toBe(0);
    });

    it('should return 0 when standard deviation is zero', () => {
      const x = [1, 1, 1, 1];
      const y = [2, 3, 4, 5];
      expect(service.pearsonCorrelation(x, y)).toBe(0);
    });
  });

  // ============================================================================
  // OUTLIER DETECTION TESTS
  // ============================================================================

  describe('detectOutliers', () => {
    it('should identify outliers using IQR method', () => {
      const values = [1, 2, 2, 3, 3, 3, 4, 4, 100];
      const outliers = service.detectOutliers(values);
      expect(outliers.length).toBe(1);
      expect(outliers[0].value).toBe(100);
      expect(outliers[0].index).toBe(8);
    });

    it('should return empty array when no outliers present', () => {
      const values = [1, 2, 3, 4, 5];
      const outliers = service.detectOutliers(values);
      expect(outliers.length).toBe(0);
    });

    it('should handle multiple outliers', () => {
      const values = [1, 2, 3, 4, 5, 100, 200];
      const outliers = service.detectOutliers(values);
      expect(outliers.length).toBeGreaterThan(0);
    });

    it('should calculate z-scores for outliers', () => {
      const values = [1, 2, 3, 4, 5, 100];
      const outliers = service.detectOutliers(values);
      expect(outliers[0].zScore).toBeGreaterThan(0);
    });

    it('should return empty array for very small datasets', () => {
      expect(service.detectOutliers([1, 2])).toEqual([]);
      expect(service.detectOutliers([1, 2, 3])).toEqual([]);
    });
  });

  // ============================================================================
  // TREND DETECTION TESTS
  // ============================================================================

  describe('detectTrend', () => {
    it('should detect increasing trend', () => {
      const values = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
      const trend = service.detectTrend(values);
      expect(trend.type).toBe('increasing');
      expect(trend.slope).toBeGreaterThan(0);
    });

    it('should detect decreasing trend', () => {
      const values = [10, 9, 8, 7, 6, 5, 4, 3, 2, 1];
      const trend = service.detectTrend(values);
      expect(trend.type).toBe('decreasing');
      expect(trend.slope).toBeLessThan(0);
    });

    it('should detect stable trend', () => {
      const values = [5, 5.1, 4.9, 5, 5.05, 4.95];
      const trend = service.detectTrend(values);
      expect(trend.type).toBe('stable');
    });

    it('should handle single value', () => {
      const trend = service.detectTrend([5]);
      expect(trend.type).toBe('stable');
      expect(trend.slope).toBe(0);
    });

    it('should handle empty array', () => {
      const trend = service.detectTrend([]);
      expect(trend.type).toBe('stable');
      expect(trend.slope).toBe(0);
    });
  });

  describe('linearRegressionSlope', () => {
    it('should calculate correct slope for linear data', () => {
      const x = [1, 2, 3, 4, 5];
      const y = [2, 4, 6, 8, 10];
      const slope = service.linearRegressionSlope(x, y);
      expect(slope).toBeCloseTo(2, 5);
    });

    it('should return 0 for horizontal line', () => {
      const x = [1, 2, 3, 4, 5];
      const y = [5, 5, 5, 5, 5];
      const slope = service.linearRegressionSlope(x, y);
      expect(slope).toBeCloseTo(0, 5);
    });

    it('should handle single point', () => {
      expect(service.linearRegressionSlope([1], [2])).toBe(0);
    });
  });

  // ============================================================================
  // SEASONALITY DETECTION TESTS
  // ============================================================================

  describe('detectSeasonality', () => {
    it('should detect strong seasonal pattern', () => {
      // Create data with clear period-3 seasonality
      const values = [1, 5, 3, 1, 5, 3, 1, 5, 3, 1, 5, 3, 1, 5, 3, 1, 5, 3, 1, 5, 3, 1, 5, 3];
      const seasonality = service.detectSeasonality(values, 12);
      expect(seasonality).not.toBeNull();
      if (seasonality) {
        expect(seasonality.period).toBeGreaterThan(0);
        expect(seasonality.strength).toBeGreaterThan(0.6);
      }
    });

    it('should return null for non-seasonal data', () => {
      const values = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15];
      const seasonality = service.detectSeasonality(values, 12);
      expect(seasonality).toBeNull();
    });

    it('should return null for insufficient data', () => {
      const values = [1, 2, 3, 4, 5];
      const seasonality = service.detectSeasonality(values, 12);
      expect(seasonality).toBeNull();
    });
  });

  describe('autocorrelation', () => {
    it('should return high correlation for periodic data', () => {
      const values = [1, 2, 1, 2, 1, 2, 1, 2];
      const correlation = service.autocorrelation(values, 2);
      expect(correlation).toBeGreaterThan(0.5);
    });

    it('should return 0 for lag >= array length', () => {
      const values = [1, 2, 3, 4, 5];
      expect(service.autocorrelation(values, 5)).toBe(0);
      expect(service.autocorrelation(values, 10)).toBe(0);
    });

    it('should return 0 for lag < 1', () => {
      const values = [1, 2, 3, 4, 5];
      expect(service.autocorrelation(values, 0)).toBe(0);
      expect(service.autocorrelation(values, -1)).toBe(0);
    });
  });

  // ============================================================================
  // FORECASTING ALGORITHM TESTS
  // ============================================================================

  describe('exponentialSmoothing', () => {
    it('should smooth data with alpha = 0.5', () => {
      const values = [10, 12, 15, 13, 14];
      const smoothed = service.exponentialSmoothing(values, 0.5);
      expect(smoothed.length).toBe(values.length);
      expect(smoothed[0]).toBe(10);
      expect(smoothed[1]).toBeCloseTo(11, 1);
    });

    it('should return original values when alpha = 1', () => {
      const values = [10, 12, 15, 13, 14];
      const smoothed = service.exponentialSmoothing(values, 1);
      expect(smoothed).toEqual(values);
    });

    it('should return first value repeated when alpha = 0', () => {
      const values = [10, 12, 15, 13, 14];
      const smoothed = service.exponentialSmoothing(values, 0);
      expect(smoothed.every(v => v === 10)).toBe(true);
    });

    it('should throw error for alpha out of range', () => {
      expect(() => service.exponentialSmoothing([1, 2, 3], -0.1)).toThrow();
      expect(() => service.exponentialSmoothing([1, 2, 3], 1.5)).toThrow();
    });

    it('should return empty array for empty input', () => {
      expect(service.exponentialSmoothing([], 0.5)).toEqual([]);
    });
  });

  describe('holtWinters', () => {
    it('should forecast with trend and seasonality', () => {
      // Create data with trend and seasonality
      const values = [10, 12, 11, 13, 15, 14, 16, 18, 17, 19, 21, 20];
      const period = 3;
      const forecast = 3;
      const result = service.holtWinters(values, 0.3, 0.1, 0.2, period, forecast);
      
      expect(result.length).toBe(values.length + forecast);
      expect(result.slice(-forecast).every(v => Number.isFinite(v))).toBe(true);
    });

    it('should throw error for insufficient data', () => {
      const values = [1, 2, 3, 4, 5];
      expect(() => service.holtWinters(values, 0.3, 0.1, 0.2, 4, 2)).toThrow();
    });

    it('should throw error for invalid parameters', () => {
      const values = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
      expect(() => service.holtWinters(values, 1.5, 0.1, 0.2, 3, 2)).toThrow();
      expect(() => service.holtWinters(values, 0.3, -0.1, 0.2, 3, 2)).toThrow();
      expect(() => service.holtWinters(values, 0.3, 0.1, 2, 3, 2)).toThrow();
    });
  });

  // ============================================================================
  // HELPER METHOD TESTS
  // ============================================================================

  describe('mean', () => {
    it('should calculate correct mean', () => {
      expect(service.mean([1, 2, 3, 4, 5])).toBe(3);
      expect(service.mean([10, 20, 30])).toBe(20);
    });

    it('should return 0 for empty array', () => {
      expect(service.mean([])).toBe(0);
    });

    it('should handle negative numbers', () => {
      expect(service.mean([-5, 0, 5])).toBe(0);
    });
  });

  describe('median', () => {
    it('should calculate median for odd-length array', () => {
      expect(service.median([1, 2, 3, 4, 5])).toBe(3);
    });

    it('should calculate median for even-length array', () => {
      expect(service.median([1, 2, 3, 4])).toBe(2.5);
    });

    it('should return 0 for empty array', () => {
      expect(service.median([])).toBe(0);
    });

    it('should handle unsorted input', () => {
      expect(service.median([5, 1, 3, 2, 4])).toBe(3);
    });
  });

  describe('standardDeviation', () => {
    it('should calculate correct standard deviation', () => {
      const values = [2, 4, 4, 4, 5, 5, 7, 9];
      const stdev = service.standardDeviation(values);
      expect(stdev).toBeCloseTo(2, 0);
    });

    it('should return 0 for single value', () => {
      expect(service.standardDeviation([5])).toBe(0);
    });

    it('should return 0 for identical values', () => {
      expect(service.standardDeviation([5, 5, 5, 5])).toBe(0);
    });

    it('should return 0 for empty array', () => {
      expect(service.standardDeviation([])).toBe(0);
    });
  });

  describe('percentile', () => {
    it('should calculate 25th percentile (Q1)', () => {
      const sorted = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
      expect(service.percentile(sorted, 25)).toBeCloseTo(3.25, 1);
    });

    it('should calculate 50th percentile (median)', () => {
      const sorted = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
      expect(service.percentile(sorted, 50)).toBe(5.5);
    });

    it('should calculate 75th percentile (Q3)', () => {
      const sorted = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
      expect(service.percentile(sorted, 75)).toBeCloseTo(7.75, 1);
    });

    it('should return first value for 0th percentile', () => {
      const sorted = [1, 2, 3, 4, 5];
      expect(service.percentile(sorted, 0)).toBe(1);
    });

    it('should return last value for 100th percentile', () => {
      const sorted = [1, 2, 3, 4, 5];
      expect(service.percentile(sorted, 100)).toBe(5);
    });

    it('should throw error for percentile out of range', () => {
      expect(() => service.percentile([1, 2, 3], -1)).toThrow();
      expect(() => service.percentile([1, 2, 3], 101)).toThrow();
    });

    it('should return 0 for empty array', () => {
      expect(service.percentile([], 50)).toBe(0);
    });
  });
});
