import { Service, inject } from '@angular/core';
import { StatisticsService } from './statistics.service';
import {
  Insight,
  CorrelationInsight,
  OutlierInsight,
  TrendInsight,
  SeasonalityInsight,
  SuddenChangeInsight
} from '../models/insight.types';

type Row = Record<string, unknown>;
type FieldType = 'String' | 'Category' | 'Integer' | 'Decimal' | 'Currency' | 'Percentage' | 'Date' | 'DateTime' | 'Boolean' | 'Identifier';

interface FieldProfile {
  name: string;
  type: FieldType;
  missing: number;
  missingPct: number;
  unique: number;
  min?: number | string;
  max?: number | string;
  mean?: number;
  median?: number;
  stdev?: number;
  topValues: { value: string; count: number }[];
}

/**
 * InsightDetectorService - Detects patterns, anomalies, and trends in datasets
 * 
 * This service analyzes datasets to automatically discover:
 * - Correlations between numeric fields
 * - Outliers in numeric data
 * - Trends in time series data
 * - Seasonal patterns
 * - Sudden changes in values
 * 
 * For large datasets (>10K rows), operations can be delegated to a Web Worker.
 * 
 * **Validates: Requirements 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 1.9**
 */
@Service()
export class InsightDetectorService {
  private readonly statistics = inject(StatisticsService);
  
  // Performance thresholds
  private readonly LARGE_DATASET_THRESHOLD = 10000;
  private readonly MIN_CORRELATION_THRESHOLD = 0.7;
  private readonly MIN_OUTLIER_COUNT = 5;
  private readonly MIN_SEASONALITY_POINTS = 12;
  private readonly SUDDEN_CHANGE_THRESHOLD = 2; // Standard deviations
  
  /**
   * Main entry point for insight detection
   * Analyzes a dataset and returns ranked insights
   * 
   * @param rows Dataset rows
   * @param profiles Field profiles with statistical summaries
   * @returns Promise resolving to array of insights ranked by confidence
   */
  async detectInsights(
    rows: Row[],
    profiles: FieldProfile[]
  ): Promise<Insight[]> {
    const startTime = performance.now();
    const insights: Insight[] = [];
    
    try {
      // Detect correlations between numeric fields
      const correlations = await this.detectCorrelations(rows, profiles);
      insights.push(...correlations);
      
      // Detect outliers in numeric fields
      const outliers = await this.detectOutliers(rows, profiles);
      insights.push(...outliers);
      
      // Detect trends in time-based numeric fields
      const trends = await this.detectTrends(rows, profiles);
      insights.push(...trends);
      
      // Detect seasonality in time series
      const seasonality = await this.detectSeasonality(rows, profiles);
      insights.push(...seasonality);
      
      // Detect sudden changes
      const changes = await this.detectSuddenChanges(rows, profiles);
      insights.push(...changes);
      
      // Rank insights by confidence and significance
      const rankedInsights = this.rankInsights(insights);
      
      const duration = performance.now() - startTime;
      console.log(`[InsightDetectorService] Analysis completed in ${duration.toFixed(0)}ms, found ${rankedInsights.length} insights`);
      
      return rankedInsights;
    } catch (error) {
      console.error('[InsightDetectorService] Error during insight detection:', error);
      return [];
    }
  }
  
  // ==========================================================================
  // TASK 3.1: Correlation Detection
  // ==========================================================================
  
  /**
   * Detects correlations between pairs of numeric fields
   * Only reports correlations with |coefficient| > 0.7
   * 
   * **Validates: Requirements 1.1, 1.2, 1.3, 1.8**
   * 
   * @param rows Dataset rows
   * @param profiles Field profiles
   * @returns Array of correlation insights
   */
  async detectCorrelations(
    rows: Row[],
    profiles: FieldProfile[]
  ): Promise<CorrelationInsight[]> {
    const insights: CorrelationInsight[] = [];
    
    // Get all numeric fields
    const numericFields = profiles.filter(p => this.isNumericField(p.type));
    
    // Check all pairs of numeric fields
    for (let i = 0; i < numericFields.length; i++) {
      for (let j = i + 1; j < numericFields.length; j++) {
        const field1 = numericFields[i];
        const field2 = numericFields[j];
        
        // Extract numeric values for both fields
        const values1 = this.extractNumericValues(rows, field1.name);
        const values2 = this.extractNumericValues(rows, field2.name);
        
        // Skip if insufficient data
        if (values1.length < 10 || values2.length < 10) {
          continue;
        }
        
        // Calculate correlation
        const coefficient = this.statistics.pearsonCorrelation(values1, values2);
        
        // Only report strong correlations (|r| > 0.7)
        if (Math.abs(coefficient) >= this.MIN_CORRELATION_THRESHOLD) {
          const confidence = Math.min(95, Math.round(Math.abs(coefficient) * 100));
          const direction = coefficient > 0 ? 'positive' : 'negative';
          const strength = Math.abs(coefficient) > 0.9 ? 'very strong' : 'strong';
          
          insights.push({
            id: crypto.randomUUID(),
            type: 'correlation',
            title: `${strength} ${direction} correlation detected`,
            description: `${field1.name} and ${field2.name} show a ${strength} ${direction} correlation (r = ${coefficient.toFixed(3)})`,
            confidence,
            affectedFields: [field1.name, field2.name],
            metadata: {
              field1: field1.name,
              field2: field2.name,
              coefficient,
              sampleSize: values1.length
            },
            dismissed: false,
            timestamp: new Date()
          });
        }
      }
    }
    
    return insights;
  }
  
  // ==========================================================================
  // TASK 3.2: Outlier Detection
  // ==========================================================================
  
  /**
   * Detects outliers in numeric fields using IQR method
   * Only reports fields with at least 5 outliers
   * 
   * **Validates: Requirements 1.4, 1.8**
   * 
   * @param rows Dataset rows
   * @param profiles Field profiles
   * @returns Array of outlier insights
   */
  async detectOutliers(
    rows: Row[],
    profiles: FieldProfile[]
  ): Promise<OutlierInsight[]> {
    const insights: OutlierInsight[] = [];
    
    // Get all numeric fields
    const numericFields = profiles.filter(p => this.isNumericField(p.type));
    
    for (const field of numericFields) {
      // Extract numeric values
      const values = this.extractNumericValues(rows, field.name);
      
      // Skip if insufficient data
      if (values.length < 10) {
        continue;
      }
      
      // Detect outliers using IQR method
      const outliers = this.statistics.detectOutliers(values);
      
      // Only report if we have at least MIN_OUTLIER_COUNT outliers
      if (outliers.length >= this.MIN_OUTLIER_COUNT) {
        const outlierPct = (outliers.length / values.length) * 100;
        const avgZScore = outliers.reduce((sum, o) => sum + o.zScore, 0) / outliers.length;
        
        // Confidence based on z-score magnitude and count
        const confidence = Math.min(95, Math.round(60 + avgZScore * 5));
        
        insights.push({
          id: crypto.randomUUID(),
          type: 'outlier',
          title: `${outliers.length} outliers detected in ${field.name}`,
          description: `${field.name} contains ${outliers.length} outlier values (${outlierPct.toFixed(1)}% of data) using IQR method`,
          confidence,
          affectedFields: [field.name],
          metadata: {
            field: field.name,
            outlierCount: outliers.length,
            outlierIndices: outliers.map(o => o.index),
            method: 'iqr',
            threshold: 1.5
          },
          dismissed: false,
          timestamp: new Date()
        });
      }
    }
    
    return insights;
  }
  
  // ==========================================================================
  // TASK 3.3: Trend and Seasonality Detection
  // ==========================================================================
  
  /**
   * Detects trends in date-based numeric fields
   * Identifies increasing, decreasing, or stable trends
   * 
   * **Validates: Requirements 1.5, 1.8**
   * 
   * @param rows Dataset rows
   * @param profiles Field profiles
   * @returns Array of trend insights
   */
  async detectTrends(
    rows: Row[],
    profiles: FieldProfile[]
  ): Promise<TrendInsight[]> {
    const insights: TrendInsight[] = [];
    
    // Get date fields
    const dateFields = profiles.filter(p => this.isDateField(p.type));
    
    // Get numeric fields
    const numericFields = profiles.filter(p => this.isNumericField(p.type));
    
    // Analyze each combination of date field and numeric field
    for (const dateField of dateFields) {
      for (const numericField of numericFields) {
        // Extract and sort data by date
        const timeSeries = this.extractTimeSeries(rows, dateField.name, numericField.name);
        
        // Skip if insufficient data
        if (timeSeries.length < 3) {
          continue;
        }
        
        // Detect trend
        const values = timeSeries.map(t => t.value);
        const trendInfo = this.statistics.detectTrend(values);
        
        // Skip stable trends
        if (trendInfo.type === 'stable') {
          continue;
        }
        
        // Check for sudden changes (rate exceeds 2 standard deviations)
        const hasSuddenChange = this.detectSuddenChangeInTrend(values);
        
        // Calculate confidence based on trend strength
        const stdev = this.statistics.standardDeviation(values);
        const range = Math.max(...values) - Math.min(...values);
        const normalizedSlope = range > 0 ? Math.abs(trendInfo.slope) / range : 0;
        const confidence = Math.min(90, Math.round(50 + normalizedSlope * 100));
        
        const title = hasSuddenChange
          ? `Sudden ${trendInfo.type} trend detected`
          : `${trendInfo.type.charAt(0).toUpperCase() + trendInfo.type.slice(1)} trend detected`;
        
        const description = hasSuddenChange
          ? `${numericField.name} shows a sudden ${trendInfo.type} trend over ${dateField.name} (rate change exceeds 2 standard deviations)`
          : `${numericField.name} shows a consistent ${trendInfo.type} trend over ${dateField.name}`;
        
        insights.push({
          id: crypto.randomUUID(),
          type: 'trend',
          title,
          description,
          confidence,
          affectedFields: [dateField.name, numericField.name],
          metadata: {
            field: numericField.name,
            trendType: trendInfo.type,
            slope: trendInfo.slope
          },
          dismissed: false,
          timestamp: new Date()
        });
      }
    }
    
    return insights;
  }
  
  /**
   * Detects seasonal patterns in date-based fields
   * Requires at least 12 data points
   * 
   * **Validates: Requirements 1.6, 1.8**
   * 
   * @param rows Dataset rows
   * @param profiles Field profiles
   * @returns Array of seasonality insights
   */
  async detectSeasonality(
    rows: Row[],
    profiles: FieldProfile[]
  ): Promise<SeasonalityInsight[]> {
    const insights: SeasonalityInsight[] = [];
    
    // Get date fields
    const dateFields = profiles.filter(p => this.isDateField(p.type));
    
    // Get numeric fields
    const numericFields = profiles.filter(p => this.isNumericField(p.type));
    
    // Analyze each combination
    for (const dateField of dateFields) {
      for (const numericField of numericFields) {
        // Extract time series
        const timeSeries = this.extractTimeSeries(rows, dateField.name, numericField.name);
        
        // Skip if insufficient data
        if (timeSeries.length < this.MIN_SEASONALITY_POINTS) {
          continue;
        }
        
        // Detect seasonality
        const values = timeSeries.map(t => t.value);
        const seasonalityInfo = this.statistics.detectSeasonality(values);
        
        if (seasonalityInfo) {
          const confidence = Math.round(seasonalityInfo.strength * 100);
          const periodDescription = this.describePeriod(seasonalityInfo.period);
          
          insights.push({
            id: crypto.randomUUID(),
            type: 'seasonality',
            title: `${periodDescription} seasonal pattern detected`,
            description: `${numericField.name} exhibits a ${periodDescription} seasonal pattern over ${dateField.name} (strength: ${(seasonalityInfo.strength * 100).toFixed(0)}%)`,
            confidence,
            affectedFields: [dateField.name, numericField.name],
            metadata: {
              field: numericField.name,
              period: seasonalityInfo.period,
              strength: seasonalityInfo.strength,
              dateField: dateField.name
            },
            dismissed: false,
            timestamp: new Date()
          });
        }
      }
    }
    
    return insights;
  }
  
  /**
   * Detects sudden changes where rate exceeds 2 standard deviations
   * 
   * @param rows Dataset rows
   * @param profiles Field profiles
   * @returns Array of sudden change insights
   */
  async detectSuddenChanges(
    rows: Row[],
    profiles: FieldProfile[]
  ): Promise<SuddenChangeInsight[]> {
    const insights: SuddenChangeInsight[] = [];
    
    // Get numeric fields
    const numericFields = profiles.filter(p => this.isNumericField(p.type));
    
    for (const field of numericFields) {
      const values = this.extractNumericValues(rows, field.name);
      
      if (values.length < 10) {
        continue;
      }
      
      // Calculate differences between consecutive values
      const diffs: number[] = [];
      for (let i = 1; i < values.length; i++) {
        diffs.push(values[i] - values[i - 1]);
      }
      
      const meanDiff = this.statistics.mean(diffs);
      const stdevDiff = this.statistics.standardDeviation(diffs);
      
      // Find sudden changes (>2 standard deviations from mean)
      for (let i = 0; i < diffs.length; i++) {
        const zScore = stdevDiff > 0 ? Math.abs((diffs[i] - meanDiff) / stdevDiff) : 0;
        
        if (zScore > this.SUDDEN_CHANGE_THRESHOLD) {
          const changePoint = i + 1;
          const beforeMean = this.statistics.mean(values.slice(0, changePoint));
          const afterMean = this.statistics.mean(values.slice(changePoint));
          const changePct = ((afterMean - beforeMean) / beforeMean) * 100;
          
          const confidence = Math.min(95, Math.round(50 + zScore * 10));
          
          insights.push({
            id: crypto.randomUUID(),
            type: 'sudden_change',
            title: `Sudden change detected in ${field.name}`,
            description: `${field.name} shows a sudden ${changePct > 0 ? 'increase' : 'decrease'} of ${Math.abs(changePct).toFixed(1)}% at position ${changePoint}`,
            confidence,
            affectedFields: [field.name],
            metadata: {
              field: field.name,
              changePoint,
              magnitude: zScore,
              beforeMean,
              afterMean
            },
            dismissed: false,
            timestamp: new Date()
          });
          
          // Only report the first major change per field
          break;
        }
      }
    }
    
    return insights;
  }
  
  // ==========================================================================
  // TASK 3.4: Insight Ranking and Integration
  // ==========================================================================
  
  /**
   * Ranks insights by confidence score and removes duplicates
   * 
   * **Validates: Requirements 1.2, 1.9**
   * 
   * @param insights Array of insights to rank
   * @returns Ranked and deduplicated insights
   */
  rankInsights(insights: Insight[]): Insight[] {
    // Sort by confidence (descending)
    const ranked = [...insights].sort((a, b) => b.confidence - a.confidence);
    
    // Remove duplicates (same type and affected fields)
    const unique = ranked.filter((insight, index, self) => {
      return index === self.findIndex(i => 
        i.type === insight.type &&
        JSON.stringify(i.affectedFields.sort()) === JSON.stringify(insight.affectedFields.sort())
      );
    });
    
    return unique;
  }
  
  /**
   * Checks if dataset should use Web Worker for analysis
   * 
   * @param rows Dataset rows
   * @returns True if dataset exceeds threshold
   */
  shouldUseWorker(rows: Row[]): boolean {
    return rows.length > this.LARGE_DATASET_THRESHOLD;
  }
  
  // ==========================================================================
  // HELPER METHODS
  // ==========================================================================
  
  /**
   * Checks if a field type is numeric
   */
  private isNumericField(type: FieldType): boolean {
    return type === 'Integer' || type === 'Decimal' || type === 'Currency' || type === 'Percentage';
  }
  
  /**
   * Checks if a field type is a date
   */
  private isDateField(type: FieldType): boolean {
    return type === 'Date' || type === 'DateTime';
  }
  
  /**
   * Extracts numeric values from a field, filtering out nulls and non-numeric values
   */
  private extractNumericValues(rows: Row[], fieldName: string): number[] {
    const values: number[] = [];
    
    for (const row of rows) {
      const value = row[fieldName];
      if (value !== null && value !== undefined && value !== '') {
        const num = typeof value === 'number' ? value : Number(value);
        if (!isNaN(num)) {
          values.push(num);
        }
      }
    }
    
    return values;
  }
  
  /**
   * Extracts time series data (date-value pairs) sorted by date
   */
  private extractTimeSeries(
    rows: Row[],
    dateField: string,
    valueField: string
  ): Array<{ date: Date; value: number }> {
    const series: Array<{ date: Date; value: number }> = [];
    
    for (const row of rows) {
      const dateValue = row[dateField];
      const numValue = row[valueField];
      
      if (dateValue && numValue !== null && numValue !== undefined) {
        const date = dateValue instanceof Date ? dateValue : new Date(String(dateValue));
        const value = typeof numValue === 'number' ? numValue : Number(numValue);
        
        if (!isNaN(date.getTime()) && !isNaN(value)) {
          series.push({ date, value });
        }
      }
    }
    
    // Sort by date
    return series.sort((a, b) => a.date.getTime() - b.date.getTime());
  }
  
  /**
   * Detects if there's a sudden change in trend
   */
  private detectSuddenChangeInTrend(values: number[]): boolean {
    if (values.length < 6) return false;
    
    // Calculate differences
    const diffs: number[] = [];
    for (let i = 1; i < values.length; i++) {
      diffs.push(values[i] - values[i - 1]);
    }
    
    const meanDiff = this.statistics.mean(diffs);
    const stdevDiff = this.statistics.standardDeviation(diffs);
    
    // Check if any change exceeds 2 standard deviations
    for (const diff of diffs) {
      const zScore = stdevDiff > 0 ? Math.abs((diff - meanDiff) / stdevDiff) : 0;
      if (zScore > this.SUDDEN_CHANGE_THRESHOLD) {
        return true;
      }
    }
    
    return false;
  }
  
  /**
   * Converts period number to human-readable description
   */
  private describePeriod(period: number): string {
    const descriptions: Record<number, string> = {
      2: 'bi-period',
      3: 'tri-period',
      4: 'quarterly',
      7: 'weekly',
      12: 'monthly',
      24: 'bi-annual',
      52: 'weekly annual'
    };
    
    return descriptions[period] || `${period}-period`;
  }
}
