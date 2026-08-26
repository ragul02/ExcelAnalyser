/**
 * Recommendation Types for Smart Chart Suggestions
 * 
 * Defines all recommendation-related types and interfaces used throughout
 * the recommendation engine.
 * 
 * **Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8, 3.9, 3.10**
 */

type ChartType = 'bar' | 'line' | 'area' | 'pie' | 'donut' | 'scatter' | 'histogram' | 'heatmap' | 'treemap' | 'box' | 'kpi';
type Aggregation = 'sum' | 'avg' | 'min' | 'max' | 'count' | 'distinct' | 'median';

/**
 * Chart recommendation with confidence and reasoning
 */
export interface ChartRecommendation {
  chartType: ChartType;
  confidence: number; // 0-100
  reasoning: string;
  suggestedConfig: SuggestedConfig;
  category: RecommendationCategory;
  priority: number; // For sorting within same confidence
}

/**
 * Suggested configuration for recommended chart
 */
export interface SuggestedConfig {
  aggregation?: Aggregation;
  sort?: 'none' | 'asc' | 'desc';
  topN?: number;
  filters?: FilterSuggestion[];
  showTrend?: boolean;
  showPercentage?: boolean;
}

/**
 * Filter suggestion
 */
export interface FilterSuggestion {
  field: string;
  operator: 'equals' | 'not_equals' | 'greater_than' | 'less_than' | 'between' | 'in' | 'not_in';
  value: string | number | [number, number];
  reasoning: string;
}

/**
 * Category of recommendation
 */
export type RecommendationCategory = 
  | 'comparison' 
  | 'trend' 
  | 'distribution' 
  | 'relationship' 
  | 'composition';

/**
 * Field characteristics used for recommendations
 */
export interface FieldCharacteristics {
  isNumeric: boolean;
  isDate: boolean;
  isCategorical: boolean;
  isIdentifier: boolean;
  cardinality: number;
  hasNulls: boolean;
  nullPercentage: number;
  distribution?: 'normal' | 'skewed' | 'uniform' | 'bimodal';
}
