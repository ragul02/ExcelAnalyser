import { Service, inject } from '@angular/core';
import { StatisticsService } from './statistics.service';
import {
  ChartRecommendation,
  FieldCharacteristics,
  FilterSuggestion,
  SuggestedConfig
} from '../models/recommendation.types';

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
 * RecommendationEngineService - Suggests optimal chart types and configurations
 * 
 * This service provides intelligent chart recommendations based on:
 * - Field types and characteristics
 * - Data cardinality and distribution
 * - Statistical relationships between fields
 * - Visualization best practices
 * 
 * Returns top 3 recommendations with confidence scores and reasoning.
 * 
 * **Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8, 3.9, 3.10**
 */
@Service()
export class RecommendationEngineService {
  private readonly statistics = inject(StatisticsService);
  
  // Cardinality thresholds for chart type selection
  private readonly LOW_CARDINALITY_MAX = 8;
  private readonly MEDIUM_CARDINALITY_MAX = 20;
  private readonly HIGH_CARDINALITY_MIN = 21;
  
  // Correlation threshold for scatter plot recommendations
  private readonly MIN_CORRELATION_FOR_SCATTER = 0.3;
  
  // Outlier threshold for filter suggestions
  private readonly MIN_OUTLIERS_FOR_FILTER = 5;
  
  // ==========================================================================
  // TASK 5.1: Service Skeleton and Helper Methods
  // ==========================================================================
  
  /**
   * Main entry point for getting chart recommendations
   * 
   * **Validates: Requirements 3.1, 3.2**
   * 
   * @param dimension Selected dimension field (X-axis, categories)
   * @param measure Selected measure field (Y-axis, values)
   * @param secondMeasure Optional second measure for dual-axis or scatter
   * @param profiles Field profiles with statistical summaries
   * @param rows Optional dataset rows for advanced analysis
   * @returns Array of top 3 recommendations sorted by confidence
   */
  getRecommendations(
    dimension: string | null,
    measure: string | null,
    secondMeasure: string | null,
    profiles: FieldProfile[],
    rows?: Row[]
  ): ChartRecommendation[] {
    const recommendations: ChartRecommendation[] = [];
    
    // Get field profiles
    const dimProfile = dimension ? profiles.find(p => p.name === dimension) : null;
    const measureProfile = measure ? profiles.find(p => p.name === measure) : null;
    const secondProfile = secondMeasure ? profiles.find(p => p.name === secondMeasure) : null;
    
    // Analyze field characteristics
    const dimChar = dimProfile ? this.analyzeFieldCharacteristics(dimProfile) : null;
    const measureChar = measureProfile ? this.analyzeFieldCharacteristics(measureProfile) : null;
    const secondChar = secondProfile ? this.analyzeFieldCharacteristics(secondProfile) : null;
    
    // Generate recommendations based on field combinations
    if (dimProfile && measureProfile) {
      recommendations.push(...this.recommendForDimensionMeasure(
        dimProfile, 
        measureProfile, 
        dimChar!, 
        measureChar!,
        rows
      ));
    }
    
    if (measureProfile && secondProfile && !dimProfile) {
      recommendations.push(...this.recommendForTwoMeasures(
        measureProfile,
        secondProfile,
        measureChar!,
        secondChar!,
        rows
      ));
    }
    
    if (measureProfile && !dimProfile && !secondProfile) {
      recommendations.push(...this.recommendForSingleMeasure(
        measureProfile,
        measureChar!
      ));
    }
    
    // Sort by confidence (descending) and return top 3
    return recommendations
      .sort((a, b) => {
        // First sort by confidence
        if (b.confidence !== a.confidence) {
          return b.confidence - a.confidence;
        }
        // Then by priority
        return b.priority - a.priority;
      })
      .slice(0, 3);
  }
  
  /**
   * Analyzes field characteristics for recommendation logic
   * 
   * @param profile Field profile
   * @returns Field characteristics
   */
  private analyzeFieldCharacteristics(profile: FieldProfile): FieldCharacteristics {
    return {
      isNumeric: this.isNumeric(profile),
      isDate: this.isDateField(profile),
      isCategorical: this.isCategorical(profile),
      isIdentifier: profile.type === 'Identifier',
      cardinality: profile.unique,
      hasNulls: profile.missing > 0,
      nullPercentage: profile.missingPct
    };
  }
  
  /**
   * Checks if a field is numeric
   */
  isNumeric(profile: FieldProfile): boolean {
    return profile.type === 'Integer' || 
           profile.type === 'Decimal' || 
           profile.type === 'Currency' || 
           profile.type === 'Percentage';
  }
  
  /**
   * Checks if a field is a date
   */
  isDateField(profile: FieldProfile): boolean {
    return profile.type === 'Date' || profile.type === 'DateTime';
  }
  
  /**
   * Checks if a field is categorical
   */
  isCategorical(profile: FieldProfile): boolean {
    return profile.type === 'Category' || 
           profile.type === 'String' || 
           profile.type === 'Boolean';
  }
  
  // ==========================================================================
  // TASK 5.2: Chart Type Recommendation Rules
  // ==========================================================================
  
  /**
   * Recommends charts for dimension-measure combinations
   * 
   * **Validates: Requirements 3.3, 3.4, 3.5, 3.6, 3.7**
   * 
   * @param dimProfile Dimension field profile
   * @param measureProfile Measure field profile
   * @param dimChar Dimension characteristics
   * @param measureChar Measure characteristics
   * @param rows Optional dataset rows
   * @returns Array of recommendations
   */
  private recommendForDimensionMeasure(
    dimProfile: FieldProfile,
    measureProfile: FieldProfile,
    dimChar: FieldCharacteristics,
    measureChar: FieldCharacteristics,
    rows?: Row[]
  ): ChartRecommendation[] {
    const recommendations: ChartRecommendation[] = [];
    
    // Rule 1: Date dimension → Line chart (Requirement 3.4)
    if (dimChar.isDate && dimProfile.unique >= 3) {
      recommendations.push({
        chartType: 'line',
        confidence: 95,
        reasoning: 'Line charts effectively show trends over time and are ideal for temporal data analysis',
        suggestedConfig: {
          aggregation: this.suggestAggregation(measureProfile),
          sort: 'none', // Keep chronological order
          showTrend: true
        },
        category: 'trend',
        priority: 10
      });
      
      // Also suggest area chart for time series
      recommendations.push({
        chartType: 'area',
        confidence: 85,
        reasoning: 'Area charts emphasize magnitude of change over time and show cumulative effects',
        suggestedConfig: {
          aggregation: this.suggestAggregation(measureProfile),
          sort: 'none'
        },
        category: 'trend',
        priority: 8
      });
    }
    
    // Rule 2: Low cardinality categorical → Pie/Donut (Requirement 3.6)
    if (dimChar.isCategorical && 
        dimProfile.unique >= 2 && 
        dimProfile.unique <= this.LOW_CARDINALITY_MAX) {
      recommendations.push({
        chartType: 'donut',
        confidence: 85,
        reasoning: `Donut charts work well for comparing parts of a whole with ${dimProfile.unique} categories`,
        suggestedConfig: {
          aggregation: 'sum',
          sort: 'desc',
          showPercentage: true
        },
        category: 'composition',
        priority: 9
      });
      
      recommendations.push({
        chartType: 'pie',
        confidence: 80,
        reasoning: `Pie charts clearly show proportional relationships among ${dimProfile.unique} categories`,
        suggestedConfig: {
          aggregation: 'sum',
          sort: 'desc',
          showPercentage: true
        },
        category: 'composition',
        priority: 7
      });
    }
    
    // Rule 3: Medium cardinality categorical → Bar chart (Requirement 3.3)
    if (dimChar.isCategorical && 
        dimProfile.unique > this.LOW_CARDINALITY_MAX && 
        dimProfile.unique <= this.MEDIUM_CARDINALITY_MAX) {
      recommendations.push({
        chartType: 'bar',
        confidence: 90,
        reasoning: `Bar charts clearly compare values across ${dimProfile.unique} categories`,
        suggestedConfig: {
          aggregation: this.suggestAggregation(measureProfile),
          sort: 'desc',
          topN: 10
        },
        category: 'comparison',
        priority: 10
      });
    }
    
    // Rule 4: High cardinality categorical → Bar chart with topN (Requirement 3.3)
    if (dimChar.isCategorical && dimProfile.unique > this.MEDIUM_CARDINALITY_MAX) {
      recommendations.push({
        chartType: 'bar',
        confidence: 85,
        reasoning: `Bar chart with top 15 items to focus on most significant categories (${dimProfile.unique} total)`,
        suggestedConfig: {
          aggregation: this.suggestAggregation(measureProfile),
          sort: 'desc',
          topN: 15
        },
        category: 'comparison',
        priority: 9
      });
      
      // Also suggest treemap for hierarchical view
      recommendations.push({
        chartType: 'treemap',
        confidence: 75,
        reasoning: 'Treemap efficiently visualizes hierarchical data with many categories',
        suggestedConfig: {
          aggregation: this.suggestAggregation(measureProfile),
          sort: 'desc'
        },
        category: 'composition',
        priority: 6
      });
    }
    
    return recommendations;
  }
  
  /**
   * Recommends charts for two numeric measures
   * 
   * **Validates: Requirements 3.5**
   * 
   * @param measure1Profile First measure profile
   * @param measure2Profile Second measure profile
   * @param measure1Char First measure characteristics
   * @param measure2Char Second measure characteristics
   * @param rows Optional dataset rows for correlation
   * @returns Array of recommendations
   */
  private recommendForTwoMeasures(
    measure1Profile: FieldProfile,
    measure2Profile: FieldProfile,
    measure1Char: FieldCharacteristics,
    measure2Char: FieldCharacteristics,
    rows?: Row[]
  ): ChartRecommendation[] {
    const recommendations: ChartRecommendation[] = [];
    
    // Check if both are numeric
    if (measure1Char.isNumeric && measure2Char.isNumeric) {
      let correlation = 0;
      
      // Calculate correlation if rows provided
      if (rows && rows.length > 0) {
        const values1 = this.extractNumericValues(rows, measure1Profile.name);
        const values2 = this.extractNumericValues(rows, measure2Profile.name);
        
        if (values1.length >= 10 && values2.length >= 10) {
          correlation = this.statistics.pearsonCorrelation(values1, values2);
        }
      }
      
      // Rule: Scatter plot for correlated measures (Requirement 3.5)
      if (Math.abs(correlation) > this.MIN_CORRELATION_FOR_SCATTER) {
        const direction = correlation > 0 ? 'positive' : 'negative';
        const strength = Math.abs(correlation) > 0.7 ? 'strong' : 'moderate';
        
        recommendations.push({
          chartType: 'scatter',
          confidence: 80 + Math.abs(correlation) * 20,
          reasoning: `Scatter plot reveals ${strength} ${direction} correlation (r=${correlation.toFixed(2)}) between ${measure1Profile.name} and ${measure2Profile.name}`,
          suggestedConfig: {
            aggregation: 'count'
          },
          category: 'relationship',
          priority: 10
        });
      } else {
        // Even without strong correlation, scatter can show relationships
        recommendations.push({
          chartType: 'scatter',
          confidence: 70,
          reasoning: `Scatter plot helps identify relationships and patterns between ${measure1Profile.name} and ${measure2Profile.name}`,
          suggestedConfig: {
            aggregation: 'count'
          },
          category: 'relationship',
          priority: 8
        });
      }
    }
    
    return recommendations;
  }
  
  /**
   * Recommends charts for single numeric measure
   * 
   * **Validates: Requirements 3.7**
   * 
   * @param measureProfile Measure field profile
   * @param measureChar Measure characteristics
   * @returns Array of recommendations
   */
  private recommendForSingleMeasure(
    measureProfile: FieldProfile,
    measureChar: FieldCharacteristics
  ): ChartRecommendation[] {
    const recommendations: ChartRecommendation[] = [];
    
    // Rule: Histogram for numeric distribution (Requirement 3.7)
    if (measureChar.isNumeric) {
      recommendations.push({
        chartType: 'histogram',
        confidence: 85,
        reasoning: `Histogram displays the distribution of ${measureProfile.name} values and reveals patterns like skewness and outliers`,
        suggestedConfig: {
          aggregation: 'count'
        },
        category: 'distribution',
        priority: 10
      });
      
      // Also suggest box plot for distribution analysis
      recommendations.push({
        chartType: 'box',
        confidence: 75,
        reasoning: `Box plot shows distribution statistics including median, quartiles, and outliers for ${measureProfile.name}`,
        suggestedConfig: {
          aggregation: 'count'
        },
        category: 'distribution',
        priority: 8
      });
      
      // KPI card for single value
      recommendations.push({
        chartType: 'kpi',
        confidence: 70,
        reasoning: `KPI card prominently displays the ${this.suggestAggregation(measureProfile)} of ${measureProfile.name}`,
        suggestedConfig: {
          aggregation: this.suggestAggregation(measureProfile)
        },
        category: 'comparison',
        priority: 6
      });
    }
    
    return recommendations;
  }
  
  // ==========================================================================
  // TASK 5.3: Aggregation and Filter Suggestions
  // ==========================================================================
  
  /**
   * Suggests optimal aggregation function based on field semantics
   * 
   * **Validates: Requirements 3.8**
   * 
   * @param profile Field profile
   * @returns Suggested aggregation
   */
  suggestAggregation(profile: FieldProfile): 'sum' | 'avg' | 'count' | 'min' | 'max' | 'median' {
    // Currency and revenue-like fields → sum
    if (profile.type === 'Currency' || 
        profile.name.toLowerCase().includes('revenue') ||
        profile.name.toLowerCase().includes('sales') ||
        profile.name.toLowerCase().includes('total') ||
        profile.name.toLowerCase().includes('amount')) {
      return 'sum';
    }
    
    // Percentage and rate fields → average
    if (profile.type === 'Percentage' ||
        profile.name.toLowerCase().includes('rate') ||
        profile.name.toLowerCase().includes('percent') ||
        profile.name.toLowerCase().includes('ratio')) {
      return 'avg';
    }
    
    // Count-like fields → sum
    if (profile.name.toLowerCase().includes('count') ||
        profile.name.toLowerCase().includes('quantity') ||
        profile.name.toLowerCase().includes('number')) {
      return 'sum';
    }
    
    // Score or rating fields → average
    if (profile.name.toLowerCase().includes('score') ||
        profile.name.toLowerCase().includes('rating')) {
      return 'avg';
    }
    
    // Default for numeric fields
    if (this.isNumeric(profile)) {
      // If high variance, sum might be more meaningful
      if (profile.stdev && profile.mean && profile.stdev / profile.mean > 1) {
        return 'sum';
      }
      return 'avg';
    }
    
    // Default fallback
    return 'count';
  }
  
  /**
   * Suggests useful filters based on data analysis
   * 
   * **Validates: Requirements 3.9**
   * 
   * @param profiles Field profiles
   * @param rows Dataset rows
   * @returns Array of filter suggestions
   */
  suggestFilters(
    profiles: FieldProfile[],
    rows: Row[]
  ): FilterSuggestion[] {
    const suggestions: FilterSuggestion[] = [];
    
    if (!rows || rows.length === 0) {
      return suggestions;
    }
    
    // Analyze each numeric field for outliers
    const numericFields = profiles.filter(p => this.isNumeric(p));
    
    for (const field of numericFields) {
      const values = this.extractNumericValues(rows, field.name);
      
      if (values.length < 10) {
        continue;
      }
      
      // Detect outliers
      const outliers = this.statistics.detectOutliers(values);
      
      // Suggest filter if significant outliers found
      if (outliers.length >= this.MIN_OUTLIERS_FOR_FILTER) {
        const sorted = [...values].sort((a, b) => a - b);
        const q1 = this.statistics.percentile(sorted, 25);
        const q3 = this.statistics.percentile(sorted, 75);
        const iqr = q3 - q1;
        const lowerBound = q1 - 1.5 * iqr;
        const upperBound = q3 + 1.5 * iqr;
        
        suggestions.push({
          field: field.name,
          operator: 'between',
          value: [lowerBound, upperBound],
          reasoning: `Filter out ${outliers.length} outliers in ${field.name} to focus on typical values`
        });
      }
    }
    
    // Suggest filters for fields with nulls
    const fieldsWithNulls = profiles.filter(p => p.missingPct > 10);
    
    for (const field of fieldsWithNulls) {
      suggestions.push({
        field: field.name,
        operator: 'not_equals',
        value: 'null',
        reasoning: `Exclude ${field.missingPct.toFixed(0)}% missing values in ${field.name} for cleaner analysis`
      });
    }
    
    // Suggest top-N filter for high cardinality categorical fields
    const highCardinalityFields = profiles.filter(p => 
      this.isCategorical(p) && 
      p.unique > this.MEDIUM_CARDINALITY_MAX
    );
    
    for (const field of highCardinalityFields) {
      const topValues = field.topValues.slice(0, 10).map(tv => tv.value);
      
      suggestions.push({
        field: field.name,
        operator: 'in',
        value: topValues.join(', '),
        reasoning: `Focus on top 10 values in ${field.name} (${field.unique} unique values total)`
      });
    }
    
    // Return top 5 suggestions
    return suggestions.slice(0, 5);
  }
  
  /**
   * Generates complete recommendation with reasoning
   * 
   * **Validates: Requirements 3.10**
   * 
   * This method is already implemented through the individual recommendation
   * methods which all include reasoning explanations.
   */
  
  // ==========================================================================
  // HELPER METHODS
  // ==========================================================================
  
  /**
   * Extracts numeric values from a field
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
   * Calculates confidence score based on data characteristics
   */
  private calculateConfidence(
    baseConfidence: number,
    profile: FieldProfile,
    char: FieldCharacteristics
  ): number {
    let confidence = baseConfidence;
    
    // Reduce confidence if high null percentage
    if (char.nullPercentage > 20) {
      confidence -= 10;
    }
    
    // Reduce confidence if very low cardinality
    if (char.cardinality < 3) {
      confidence -= 5;
    }
    
    // Ensure confidence stays in valid range
    return Math.max(0, Math.min(100, confidence));
  }
  
  /**
   * Formats field name for display
   */
  private formatFieldName(name: string): string {
    return name
      .replace(/_/g, ' ')
      .replace(/([A-Z])/g, ' $1')
      .trim()
      .toLowerCase()
      .replace(/^\w/, c => c.toUpperCase());
  }
}
