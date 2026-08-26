# Design Document: Advanced Analytics (Requirements 1-4)

## Overview

This design document specifies the architecture for implementing the first phase of Advanced Analytics capabilities in the Data Visualization Studio application. This phase covers:

1. **AI-Powered Insights Detection** - Automatic pattern, anomaly, and trend discovery
2. **Time Series Forecasting** - Future value prediction with confidence intervals
3. **Smart Chart Recommendations** - Intelligent visualization type suggestions
4. **Advanced Data Quality Scoring** - Comprehensive dataset quality assessment

The implementation uses Angular 22's modern features (signals, `@Service` decorator, `inject()` function) and integrates TensorFlow.js for client-side machine learning. All computation happens offline without backend dependencies, using Web Workers to maintain UI responsiveness.

### Design Principles

- **Offline-First**: All ML models and algorithms run client-side
- **Non-Blocking**: Heavy computation executes in Web Workers
- **Reactive**: Uses Angular signals for state management
- **Type-Safe**: Full TypeScript strict mode compliance
- **Performance**: Targets sub-5-second analysis for 100K rows
- **Seamless Integration**: Extends existing App component architecture

## Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      App Component                          │
│  (existing: data loading, chart building, dashboard)        │
└───────────────┬─────────────────────────────────────────────┘
                │
                │ inject()
                ▼
┌─────────────────────────────────────────────────────────────┐
│                  AnalyticsService                           │
│  (coordinates all analytics features, manages state)        │
└───┬───────┬──────────┬──────────┬─────────────────────────┘
    │       │          │          │
    │       │          │          │ inject()
    ▼       ▼          ▼          ▼
┌─────┐ ┌────────┐ ┌────────┐ ┌──────────┐
│Insight│ │Forecast│ │Recomm- │ │Quality   │
│Detector│ │Service │ │endation│ │Analyzer  │
│       │ │        │ │Engine  │ │          │
└───┬───┘ └───┬────┘ └───┬────┘ └────┬─────┘
    │         │          │           │
    │         │          │           │
    ▼         ▼          ▼           ▼
┌─────────────────────────────────────────────────────────────┐
│                  StatisticsService                          │
│  (pure statistical functions: correlation, outliers, etc)   │
└─────────────────────────────────────────────────────────────┘
    │
    │ uses
    ▼
┌─────────────────────────────────────────────────────────────┐
│                  TensorFlowService                          │
│  (TensorFlow.js model loading and inference)               │
└─────────────────────────────────────────────────────────────┘
    │
    │ delegates to
    ▼
┌─────────────────────────────────────────────────────────────┐
│                    Web Worker                               │
│  (heavy computation: large dataset analysis, forecasting)   │
└─────────────────────────────────────────────────────────────┘
```

### Layer Responsibilities

**Presentation Layer (Components)**
- `App` component: Existing component, integrates analytics UI
- New "Insights" tab: Displays discovered insights
- Enhanced chart view: Shows recommendations and narratives
- Quality indicator: Displays data quality score and details

**Service Layer**
- `AnalyticsService`: Orchestrates analytics features, manages state
- `InsightDetectorService`: Pattern and anomaly detection logic
- `ForecastService`: Time series forecasting algorithms
- `RecommendationEngineService`: Chart type and configuration suggestions
- `QualityAnalyzerService`: Data quality assessment and scoring

**Infrastructure Layer**
- `StatisticsService`: Pure statistical functions (reusable utilities)
- `TensorFlowService`: TF.js model lifecycle management
- `AnalyticsWorker`: Web Worker for heavy computation
- `CacheService`: Results caching for performance

## Components and Interfaces

### Core Services

#### AnalyticsService

**Purpose**: Central coordinator for all analytics features, manages lifecycle and state.

```typescript
@Service()
export class AnalyticsService {
  private insightDetector = inject(InsightDetectorService);
  private forecastService = inject(ForecastService);
  private recommendationEngine = inject(RecommendationEngineService);
  private qualityAnalyzer = inject(QualityAnalyzerService);
  
  // State signals
  readonly insights = signal<Insight[]>([]);
  readonly isAnalyzing = signal(false);
  readonly analyticsEnabled = signal(true);
  readonly currentForecast = signal<ForecastResult | null>(null);
  readonly recommendations = signal<ChartRecommendation[]>([]);
  readonly qualityScore = signal<QualityScore | null>(null);
  
  // Computed state
  readonly hasInsights = computed(() => this.insights().length > 0);
  readonly topInsights = computed(() => 
    this.insights()
      .filter(i => !i.dismissed)
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, 5)
  );
  
  // Public API
  analyzeDataset(rows: Row[], columns: string[], profiles: FieldProfile[]): Promise<void>;
  generateForecast(dateField: string, measureField: string, rows: Row[], periods: number): Promise<ForecastResult>;
  getRecommendations(dimension: string, measure: string, profiles: FieldProfile[]): ChartRecommendation[];
  dismissInsight(insightId: string): void;
  clearCache(): void;
}
```

#### InsightDetectorService

**Purpose**: Detects patterns, anomalies, correlations, and trends in datasets.

```typescript
@Service()
export class InsightDetectorService {
  private statistics = inject(StatisticsService);
  private worker?: Worker;
  
  async detectInsights(
    rows: Row[], 
    profiles: FieldProfile[]
  ): Promise<Insight[]> {
    const insights: Insight[] = [];
    
    // Detect correlations
    insights.push(...await this.detectCorrelations(rows, profiles));
    
    // Detect outliers
    insights.push(...await this.detectOutliers(rows, profiles));
    
    // Detect trends
    insights.push(...await this.detectTrends(rows, profiles));
    
    // Detect seasonality
    insights.push(...await this.detectSeasonality(rows, profiles));
    
    // Rank by confidence and significance
    return this.rankInsights(insights);
  }
  
  private async detectCorrelations(rows: Row[], profiles: FieldProfile[]): Promise<Insight[]>;
  private async detectOutliers(rows: Row[], profiles: FieldProfile[]): Promise<Insight[]>;
  private async detectTrends(rows: Row[], profiles: FieldProfile[]): Promise<Insight[]>;
  private async detectSeasonality(rows: Row[], profiles: FieldProfile[]): Promise<Insight[]>;
  private rankInsights(insights: Insight[]): Insight[];
}
```

#### ForecastService

**Purpose**: Generates time series forecasts with confidence intervals.

```typescript
@Service()
export class ForecastService {
  private statistics = inject(StatisticsService);
  private tfService = inject(TensorFlowService);
  
  async forecast(
    dateField: string,
    measureField: string,
    rows: Row[],
    periods: number
  ): Promise<ForecastResult> {
    // Validate time series
    const timeSeries = this.prepareTimeSeries(rows, dateField, measureField);
    if (!this.isValidTimeSeries(timeSeries)) {
      throw new Error('Invalid time series: requires minimum 10 data points');
    }
    
    // Detect patterns
    const trend = this.detectTrend(timeSeries);
    const seasonality = this.detectSeasonality(timeSeries);
    
    // Generate forecast using exponential smoothing
    const forecast = await this.exponentialSmoothing(
      timeSeries, 
      periods, 
      trend, 
      seasonality
    );
    
    return forecast;
  }
  
  private prepareTimeSeries(rows: Row[], dateField: string, measureField: string): TimeSeries;
  private isValidTimeSeries(timeSeries: TimeSeries): boolean;
  private detectTrend(timeSeries: TimeSeries): TrendType;
  private detectSeasonality(timeSeries: TimeSeries): SeasonalityInfo;
  private exponentialSmoothing(
    timeSeries: TimeSeries, 
    periods: number, 
    trend: TrendType, 
    seasonality: SeasonalityInfo
  ): Promise<ForecastResult>;
}
```

#### RecommendationEngineService

**Purpose**: Suggests optimal chart types and configurations based on field characteristics.

```typescript
@Service()
export class RecommendationEngineService {
  private statistics = inject(StatisticsService);
  
  getRecommendations(
    dimension: string | null,
    measure: string | null,
    secondMeasure: string | null,
    profiles: FieldProfile[]
  ): ChartRecommendation[] {
    const recommendations: ChartRecommendation[] = [];
    
    const dimProfile = profiles.find(p => p.name === dimension);
    const measureProfile = profiles.find(p => p.name === measure);
    const secondProfile = profiles.find(p => p.name === secondMeasure);
    
    // Rule-based recommendation system
    if (dimProfile && measureProfile) {
      // Date dimension -> line chart
      if (this.isDateField(dimProfile)) {
        recommendations.push({
          chartType: 'line',
          confidence: 95,
          reasoning: 'Line charts effectively show trends over time',
          suggestedConfig: { aggregation: 'sum', sort: 'none' }
        });
      }
      
      // Low cardinality categorical -> pie/donut
      if (this.isCategorical(dimProfile) && dimProfile.unique >= 2 && dimProfile.unique <= 8) {
        recommendations.push({
          chartType: 'donut',
          confidence: 85,
          reasoning: 'Donut charts work well for comparing parts of a whole with few categories',
          suggestedConfig: { aggregation: 'sum', sort: 'desc' }
        });
      }
      
      // Medium cardinality categorical -> bar
      if (this.isCategorical(dimProfile) && dimProfile.unique > 8 && dimProfile.unique <= 20) {
        recommendations.push({
          chartType: 'bar',
          confidence: 90,
          reasoning: 'Bar charts clearly compare values across categories',
          suggestedConfig: { aggregation: 'sum', sort: 'desc', topN: 10 }
        });
      }
    }
    
    // Two numeric measures -> scatter
    if (measureProfile && secondProfile && this.isNumeric(measureProfile) && this.isNumeric(secondProfile)) {
      const correlation = this.calculateCorrelation(measureProfile, secondProfile);
      if (Math.abs(correlation) > 0.3) {
        recommendations.push({
          chartType: 'scatter',
          confidence: 80 + Math.abs(correlation) * 20,
          reasoning: `Scatter plot reveals ${correlation > 0 ? 'positive' : 'negative'} correlation between variables`,
          suggestedConfig: { aggregation: 'count' }
        });
      }
    }
    
    // Single numeric measure -> histogram
    if (measureProfile && !dimProfile && this.isNumeric(measureProfile)) {
      recommendations.push({
        chartType: 'histogram',
        confidence: 75,
        reasoning: 'Histogram displays the distribution of numeric values',
        suggestedConfig: { aggregation: 'count' }
      });
    }
    
    return recommendations.sort((a, b) => b.confidence - a.confidence);
  }
  
  private isDateField(profile: FieldProfile): boolean;
  private isCategorical(profile: FieldProfile): boolean;
  private isNumeric(profile: FieldProfile): boolean;
  private calculateCorrelation(profile1: FieldProfile, profile2: FieldProfile): number;
}
```

#### QualityAnalyzerService

**Purpose**: Assesses data quality across multiple dimensions and provides actionable suggestions.

```typescript
@Service()
export class QualityAnalyzerService {
  private statistics = inject(StatisticsService);
  
  analyzeQuality(
    rows: Row[], 
    columns: string[], 
    profiles: FieldProfile[]
  ): QualityScore {
    // Calculate component scores
    const completeness = this.assessCompleteness(profiles, rows.length);
    const consistency = this.assessConsistency(rows, profiles);
    const accuracy = this.assessAccuracy(rows, profiles);
    const uniqueness = this.assessUniqueness(rows, profiles);
    
    // Calculate weighted overall score
    const overallScore = Math.round(
      completeness.score * 0.3 +
      consistency.score * 0.25 +
      accuracy.score * 0.25 +
      uniqueness.score * 0.2
    );
    
    // Generate prioritized suggestions
    const suggestions = this.generateSuggestions(
      completeness, 
      consistency, 
      accuracy, 
      uniqueness
    );
    
    return {
      overall: overallScore,
      components: {
        completeness: completeness.score,
        consistency: consistency.score,
        accuracy: accuracy.score,
        uniqueness: uniqueness.score
      },
      suggestions: suggestions.sort((a, b) => b.impact - a.impact),
      issues: this.categorizeIssues(suggestions)
    };
  }
  
  private assessCompleteness(profiles: FieldProfile[], totalRows: number): QualityComponent {
    const missingCellsTotal = profiles.reduce((sum, p) => sum + p.missing, 0);
    const totalCells = totalRows * profiles.length;
    const missingPct = totalCells > 0 ? (missingCellsTotal / totalCells) * 100 : 0;
    
    return {
      score: Math.max(0, 100 - missingPct),
      details: `${missingPct.toFixed(1)}% of cells are missing values`,
      fieldIssues: profiles
        .filter(p => p.missingPct > 10)
        .map(p => ({ field: p.name, severity: p.missingPct > 30 ? 'critical' : 'moderate' }))
    };
  }
  
  private assessConsistency(rows: Row[], profiles: FieldProfile[]): QualityComponent;
  private assessAccuracy(rows: Row[], profiles: FieldProfile[]): QualityComponent;
  private assessUniqueness(rows: Row[], profiles: FieldProfile[]): QualityComponent;
  private generateSuggestions(
    completeness: QualityComponent,
    consistency: QualityComponent,
    accuracy: QualityComponent,
    uniqueness: QualityComponent
  ): QualitySuggestion[];
  private categorizeIssues(suggestions: QualitySuggestion[]): QualityIssues;
}
```

#### StatisticsService

**Purpose**: Provides pure statistical functions used across analytics services.

```typescript
@Service()
export class StatisticsService {
  // Correlation
  pearsonCorrelation(x: number[], y: number[]): number {
    const n = Math.min(x.length, y.length);
    if (n < 2) return 0;
    
    const meanX = this.mean(x);
    const meanY = this.mean(y);
    
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
  
  // Outlier detection using IQR method
  detectOutliers(values: number[]): { value: number; index: number; zScore: number }[] {
    const sorted = [...values].sort((a, b) => a - b);
    const q1 = this.percentile(sorted, 25);
    const q3 = this.percentile(sorted, 75);
    const iqr = q3 - q1;
    const lowerBound = q1 - 1.5 * iqr;
    const upperBound = q3 + 1.5 * iqr;
    
    const mean = this.mean(values);
    const stdev = this.standardDeviation(values);
    
    return values
      .map((value, index) => ({
        value,
        index,
        zScore: stdev > 0 ? Math.abs((value - mean) / stdev) : 0
      }))
      .filter(item => item.value < lowerBound || item.value > upperBound);
  }
  
  // Trend detection
  detectTrend(values: number[]): { slope: number; type: 'increasing' | 'decreasing' | 'stable' } {
    if (values.length < 2) return { slope: 0, type: 'stable' };
    
    const n = values.length;
    const x = Array.from({ length: n }, (_, i) => i);
    const slope = this.linearRegressionSlope(x, values);
    
    // Normalize slope by value range for comparison
    const range = Math.max(...values) - Math.min(...values);
    const normalizedSlope = range > 0 ? slope / range : 0;
    
    if (Math.abs(normalizedSlope) < 0.01) return { slope, type: 'stable' };
    return { slope, type: slope > 0 ? 'increasing' : 'decreasing' };
  }
  
  // Seasonality detection (simple autocorrelation)
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
  
  // Helper methods
  mean(values: number[]): number;
  median(values: number[]): number;
  standardDeviation(values: number[]): number;
  percentile(sortedValues: number[], percentile: number): number;
  linearRegressionSlope(x: number[], y: number[]): number;
  autocorrelation(values: number[], lag: number): number;
  exponentialSmoothing(values: number[], alpha: number): number[];
  holtWinters(values: number[], alpha: number, beta: number, gamma: number, period: number, forecast: number): number[];
}
```

#### TensorFlowService

**Purpose**: Manages TensorFlow.js lifecycle and provides ML capabilities.

```typescript
@Service()
export class TensorFlowService {
  private modelLoaded = signal(false);
  private backend = signal<'webgl' | 'cpu'>('cpu');
  
  async initialize(): Promise<void> {
    // Try WebGL backend first
    try {
      await tf.setBackend('webgl');
      await tf.ready();
      this.backend.set('webgl');
    } catch {
      // Fallback to CPU
      await tf.setBackend('cpu');
      await tf.ready();
      this.backend.set('cpu');
    }
    
    this.modelLoaded.set(true);
  }
  
  async dispose(): Promise<void> {
    tf.disposeVariables();
    this.modelLoaded.set(false);
  }
  
  // Utility for tensor operations
  async runInference<T>(operation: () => Promise<T>): Promise<T> {
    return tf.tidy(() => operation());
  }
  
  // Check available memory
  getMemoryInfo(): { numTensors: number; numBytes: number } {
    return tf.memory();
  }
}
```

### Web Worker Integration

**Purpose**: Offload heavy computation to prevent UI blocking.

```typescript
// analytics.worker.ts
import { expose } from 'comlink';

class AnalyticsWorker {
  async analyzeDataset(rows: Row[], profiles: FieldProfile[]): Promise<Insight[]> {
    // Heavy insight detection logic runs here
    return [];
  }
  
  async generateForecast(timeSeries: TimeSeries, periods: number): Promise<ForecastResult> {
    // Heavy forecasting computation
    return {} as ForecastResult;
  }
  
  async calculateCorrelationMatrix(data: number[][]): Promise<number[][]> {
    // Matrix computation
    return [];
  }
}

expose(new AnalyticsWorker());
```

## Data Models

### Core Types

```typescript
// Insight types
type InsightType = 
  | 'correlation' 
  | 'outlier' 
  | 'trend' 
  | 'seasonality' 
  | 'distribution'
  | 'sudden_change';

interface Insight {
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

interface CorrelationInsight extends Insight {
  type: 'correlation';
  metadata: {
    field1: string;
    field2: string;
    coefficient: number; // -1 to 1
    sampleSize: number;
  };
}

interface OutlierInsight extends Insight {
  type: 'outlier';
  metadata: {
    field: string;
    outlierCount: number;
    outlierIndices: number[];
    method: 'iqr' | 'zscore';
    threshold: number;
  };
}

interface TrendInsight extends Insight {
  type: 'trend';
  metadata: {
    field: string;
    trendType: 'increasing' | 'decreasing' | 'stable';
    slope: number;
    rSquared: number;
  };
}

interface SeasonalityInsight extends Insight {
  type: 'seasonality';
  metadata: {
    field: string;
    period: number;
    strength: number; // 0-1
    dateField: string;
  };
}

// Forecast types
interface ForecastResult {
  predictions: ForecastPoint[];
  accuracy: ForecastAccuracy;
  method: 'exponential_smoothing' | 'holt_winters' | 'arima';
  parameters: Record<string, number>;
}

interface ForecastPoint {
  date: Date;
  value: number;
  lowerBound80: number;
  upperBound80: number;
  lowerBound95: number;
  upperBound95: number;
}

interface ForecastAccuracy {
  rmse?: number; // Root Mean Square Error
  mae?: number;  // Mean Absolute Error
  mape?: number; // Mean Absolute Percentage Error
}

interface TimeSeries {
  dates: Date[];
  values: number[];
  frequency: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly';
}

type TrendType = 'none' | 'linear' | 'exponential' | 'logarithmic';

interface SeasonalityInfo {
  exists: boolean;
  period: number;
  strength: number;
}

// Recommendation types
interface ChartRecommendation {
  chartType: ChartType;
  confidence: number; // 0-100
  reasoning: string;
  suggestedConfig: Partial<ChartDefinition>;
}

// Quality types
interface QualityScore {
  overall: number; // 0-100
  components: {
    completeness: number;
    consistency: number;
    accuracy: number;
    uniqueness: number;
  };
  suggestions: QualitySuggestion[];
  issues: QualityIssues;
}

interface QualityComponent {
  score: number;
  details: string;
  fieldIssues: { field: string; severity: 'critical' | 'moderate' | 'minor' }[];
}

interface QualitySuggestion {
  id: string;
  category: 'completeness' | 'consistency' | 'accuracy' | 'uniqueness';
  severity: 'critical' | 'moderate' | 'minor';
  impact: number; // Expected score improvement
  description: string;
  action: string; // Actionable recommendation
  affectedFields: string[];
}

interface QualityIssues {
  critical: QualitySuggestion[];
  moderate: QualitySuggestion[];
  minor: QualitySuggestion[];
}

// Settings types
interface AnalyticsSettings {
  autoDetectInsights: boolean;
  insightSensitivity: 'low' | 'medium' | 'high';
  autoGenerateNarrative: boolean;
  narrativeVerbosity: 'concise' | 'normal' | 'detailed';
  showConfidenceIntervals: boolean;
  defaultForecastPeriods: number;
}
```

## Error Handling

### Error Strategy

All analytics services follow a consistent error handling pattern:

1. **Graceful Degradation**: Errors never crash the app or block core features
2. **User-Friendly Messages**: Technical errors are translated to actionable messages
3. **Logging**: Errors are logged to console for debugging
4. **Fallbacks**: Services provide default values when operations fail

### Error Types

```typescript
class AnalyticsError extends Error {
  constructor(
    message: string,
    public code: AnalyticsErrorCode,
    public userMessage: string,
    public recoverable: boolean = true
  ) {
    super(message);
    this.name = 'AnalyticsError';
  }
}

type AnalyticsErrorCode =
  | 'INSUFFICIENT_DATA'
  | 'INVALID_TIME_SERIES'
  | 'MODEL_LOAD_FAILED'
  | 'COMPUTATION_TIMEOUT'
  | 'MEMORY_EXCEEDED'
  | 'INVALID_FIELD_TYPE'
  | 'WORKER_UNAVAILABLE';

// Error handling example
async analyzeDataset(rows: Row[]): Promise<Insight[]> {
  try {
    if (rows.length < 10) {
      throw new AnalyticsError(
        'Dataset too small',
        'INSUFFICIENT_DATA',
        'Insights require at least 10 rows of data',
        true
      );
    }
    
    return await this.performAnalysis(rows);
  } catch (error) {
    if (error instanceof AnalyticsError) {
      this.handleAnalyticsError(error);
    } else {
      console.error('Unexpected error in analyzeDataset:', error);
      this.notificationService.show('Analysis failed. Please try again.');
    }
    return []; // Return empty array to allow app to continue
  }
}

private handleAnalyticsError(error: AnalyticsError): void {
  console.warn(`Analytics error [${error.code}]:`, error.message);
  
  if (!error.recoverable) {
    this.analyticsEnabled.set(false);
  }
  
  this.notificationService.show(error.userMessage);
}
```

## Testing Strategy

### Unit Testing

**Focus**: Individual service methods, pure functions, statistical algorithms

**Approach**: Example-based unit tests for specific cases and edge conditions

**Coverage Areas**:
- Statistical calculations (correlation, outliers, trends)
- Data validation and preprocessing
- Configuration parsing and validation
- Error handling and edge cases
- Type guards and utility functions

**Example Test Structure**:

```typescript
describe('StatisticsService', () => {
  let service: StatisticsService;
  
  beforeEach(() => {
    service = new StatisticsService();
  });
  
  describe('pearsonCorrelation', () => {
    it('should return 1 for perfectly correlated data', () => {
      const x = [1, 2, 3, 4, 5];
      const y = [2, 4, 6, 8, 10];
      expect(service.pearsonCorrelation(x, y)).toBeCloseTo(1, 2);
    });
    
    it('should return -1 for perfectly negatively correlated data', () => {
      const x = [1, 2, 3, 4, 5];
      const y = [10, 8, 6, 4, 2];
      expect(service.pearsonCorrelation(x, y)).toBeCloseTo(-1, 2);
    });
    
    it('should return 0 for uncorrelated data', () => {
      const x = [1, 2, 3, 4, 5];
      const y = [5, 2, 8, 1, 9];
      const correlation = service.pearsonCorrelation(x, y);
      expect(Math.abs(correlation)).toBeLessThan(0.3);
    });
    
    it('should handle arrays of different lengths', () => {
      const x = [1, 2, 3, 4, 5];
      const y = [2, 4, 6];
      expect(() => service.pearsonCorrelation(x, y)).not.toThrow();
    });
    
    it('should return 0 for empty or single-element arrays', () => {
      expect(service.pearsonCorrelation([], [])).toBe(0);
      expect(service.pearsonCorrelation([1], [2])).toBe(0);
    });
  });
  
  describe('detectOutliers', () => {
    it('should identify outliers using IQR method', () => {
      const values = [1, 2, 2, 3, 3, 3, 4, 4, 100]; // 100 is clear outlier
      const outliers = service.detectOutliers(values);
      expect(outliers.length).toBe(1);
      expect(outliers[0].value).toBe(100);
    });
    
    it('should return empty array when no outliers present', () => {
      const values = [1, 2, 3, 4, 5];
      const outliers = service.detectOutliers(values);
      expect(outliers.length).toBe(0);
    });
  });
});

describe('InsightDetectorService', () => {
  let service: InsightDetectorService;
  let statisticsService: StatisticsService;
  
  beforeEach(() => {
    statisticsService = new StatisticsService();
    service = new InsightDetectorService(statisticsService);
  });
  
  describe('detectCorrelations', () => {
    it('should detect strong positive correlation', async () => {
      const rows = [
        { revenue: 100, marketing: 10 },
        { revenue: 200, marketing: 20 },
        { revenue: 300, marketing: 30 },
      ];
      const profiles = [
        { name: 'revenue', type: 'Integer' as FieldType },
        { name: 'marketing', type: 'Integer' as FieldType },
      ];
      
      const insights = await service.detectCorrelations(rows, profiles);
      expect(insights.length).toBeGreaterThan(0);
      expect(insights[0].type).toBe('correlation');
    });
  });
});
```

### Integration Testing

**Focus**: Service interactions, data flow between components, Web Worker communication

**Example Tests**:
- AnalyticsService coordinating multiple services
- Forecast generation with real datasets
- Quality analysis with edge cases (empty datasets, all nulls, etc.)
- Worker communication and error handling

### Performance Testing

**Requirements** (from specifications):
- Insight detection: < 5 seconds for 100K rows
- Forecasting: < 3 seconds for 10K time points
- Quality analysis: < 2 seconds for any dataset size
- ML model initial load: < 2 seconds
- Memory footprint: < 150 MB for ML models

**Testing Approach**:
- Synthetic datasets at scale boundaries
- Performance measurement utilities
- Memory profiling during operations
- Browser DevTools Performance tab analysis

## Performance Optimization

### Caching Strategy

```typescript
@Service()
export class CacheService {
  private insightCache = new Map<string, { insights: Insight[]; timestamp: number }>();
  private forecastCache = new Map<string, { forecast: ForecastResult; timestamp: number }>();
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes
  
  getCachedInsights(dataHash: string): Insight[] | null {
    const cached = this.insightCache.get(dataHash);
    if (!cached) return null;
    
    if (Date.now() - cached.timestamp > this.CACHE_TTL) {
      this.insightCache.delete(dataHash);
      return null;
    }
    
    return cached.insights;
  }
  
  cacheInsights(dataHash: string, insights: Insight[]): void {
    this.insightCache.set(dataHash, { insights, timestamp: Date.now() });
  }
  
  invalidateCache(): void {
    this.insightCache.clear();
    this.forecastCache.clear();
  }
  
  // Generate hash of dataset for cache key
  hashDataset(rows: Row[], columns: string[]): string {
    const sample = rows.slice(0, 100); // Sample first 100 rows for performance
    return this.simpleHash(JSON.stringify({ columns, sample }));
  }
  
  private simpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return hash.toString(36);
  }
}
```

### Debouncing and Throttling

```typescript
// In AnalyticsService
private analyzeDebounced = this.debounce(
  (rows: Row[], columns: string[], profiles: FieldProfile[]) => {
    this.performAnalysis(rows, columns, profiles);
  },
  2000 // 2 second debounce as per requirements
);

private debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: ReturnType<typeof setTimeout> | null = null;
  
  return (...args: Parameters<T>) => {
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}
```

### Lazy Loading

```typescript
// TensorFlow.js models loaded only when first accessed
@Service()
export class TensorFlowService {
  private initialized = false;
  
  async ensureInitialized(): Promise<void> {
    if (this.initialized) return;
    
    // Lazy load TF.js
    await import('@tensorflow/tfjs');
    await this.initialize();
    this.initialized = true;
  }
}
```

### Web Worker Strategy

**When to Use Worker**:
- Dataset > 10,000 rows
- Forecast periods > 20
- Complex correlation matrix (> 20 fields)

**When to Use Main Thread**:
- Dataset < 10,000 rows
- Simple operations (< 100ms expected)
- Operations requiring DOM access

```typescript
@Service()
export class AnalyticsService {
  private useWorker(rowCount: number): boolean {
    return rowCount > 10000;
  }
  
  async analyzeDataset(
    rows: Row[], 
    columns: string[], 
    profiles: FieldProfile[]
  ): Promise<void> {
    if (this.useWorker(rows.length)) {
      return this.analyzeInWorker(rows, profiles);
    } else {
      return this.analyzeInMainThread(rows, profiles);
    }
  }
}
```

## UI Integration

### New "Insights" Tab

Add to existing tab bar in `app.html`:

```html
<div class="tabs">
  <button [class.active]="selectedTab === 'data'" (click)="selectedTab = 'data'">Preview</button>
  <button [class.active]="selectedTab === 'profile'" (click)="selectedTab = 'profile'">Profile</button>
  <button [class.active]="selectedTab === 'insights'" (click)="selectedTab = 'insights'">Insights</button>
  <button [class.active]="selectedTab === 'chart'" (click)="selectedTab = 'chart'">Chart</button>
  <button [class.active]="selectedTab === 'dashboard'" (click)="selectedTab = 'dashboard'">Dashboard</button>
  <button [class.active]="selectedTab === 'export'" (click)="selectedTab = 'export'">Export</button>
</div>
```

### Insights Tab Content

```html
@if (rows().length && selectedTab === 'insights') {
  <div class="insights-view">
    <section class="explainer">
      <h2>AI-Powered Insights</h2>
      <p>
        Automatically discovered patterns, correlations, and anomalies in your data.
        Click any insight to visualize it in a chart.
      </p>
    </section>
    
    @if (analytics.isAnalyzing()) {
      <div class="analyzing-indicator">
        <span class="spinner"></span>
        <p>Analyzing dataset...</p>
      </div>
    }
    
    <div class="insights-grid">
      @for (insight of analytics.topInsights(); track insight.id) {
        <article 
          class="insight-card" 
          [attr.data-confidence]="insight.confidence >= 80 ? 'high' : insight.confidence >= 60 ? 'medium' : 'low'"
          (click)="visualizeInsight(insight)"
        >
          <header>
            <div>
              <span class="insight-type-badge">{{ insight.type }}</span>
              <span class="confidence-badge">{{ insight.confidence }}%</span>
            </div>
            <button 
              type="button" 
              class="dismiss-btn"
              (click)="analytics.dismissInsight(insight.id); $event.stopPropagation()"
              aria-label="Dismiss insight"
            >
              ×
            </button>
          </header>
          <h3>{{ insight.title }}</h3>
          <p>{{ insight.description }}</p>
          <footer>
            <span>Fields: {{ insight.affectedFields.join(', ') }}</span>
          </footer>
        </article>
      }
      
      @if (analytics.topInsights().length === 0 && !analytics.isAnalyzing()) {
        <div class="empty-state">
          <p>No significant insights detected in this dataset.</p>
          <button (click)="analytics.analyzeDataset(rows(), columns(), profiles())">
            Reanalyze
          </button>
        </div>
      }
    </div>
  </div>
}
```

### Enhanced Chart View with Recommendations

Add to right pane after chart type selection:

```html
<!-- In right pane after chart type select -->
@if (analytics.recommendations().length > 0) {
  <div class="recommendations-box">
    <h3>Smart Recommendations</h3>
    @for (rec of analytics.recommendations().slice(0, 3); track $index) {
      <button 
        type="button"
        class="recommendation-item"
        (click)="applyRecommendation(rec)"
      >
        <div class="rec-header">
          <strong>{{ rec.chartType | titlecase }}</strong>
          <span class="confidence">{{ rec.confidence }}%</span>
        </div>
        <p>{{ rec.reasoning }}</p>
      </button>
    }
  </div>
}
```

### Quality Score in Status Bar

Enhanced status bar:

```html
<section class="status" [class.busy]="busy">
  <span>{{ busy ? 'Processing file...' : notification }}</span>
  @if (rows().length) {
    <span>{{ rows().length | number }} rows</span>
    <span>{{ columns().length | number }} columns</span>
    <button 
      type="button"
      class="quality-score"
      [class.warning]="analytics.qualityScore()?.overall < 70"
      (click)="showQualityDetails()"
    >
      Quality {{ analytics.qualityScore()?.overall ?? 100 }}%
    </button>
  }
</section>
```

### Quality Details Modal

```typescript
// In App component
showQualityDetails(): void {
  const quality = this.analytics.qualityScore();
  if (!quality) return;
  
  // Modal implementation (simplified - use existing modal pattern if available)
  const message = `
Data Quality Report

Overall Score: ${quality.overall}/100

Components:
- Completeness: ${quality.components.completeness}/100
- Consistency: ${quality.components.consistency}/100
- Accuracy: ${quality.components.accuracy}/100
- Uniqueness: ${quality.components.uniqueness}/100

Top Issues:
${quality.issues.critical.map(s => `❗ ${s.description}`).join('\n')}
${quality.issues.moderate.map(s => `⚠️ ${s.description}`).join('\n')}
  `.trim();
  
  alert(message); // Replace with proper modal
}
```

### Forecast Visualization

Add forecast button in chart view when applicable:

```html
<!-- Add to chart-stage section -->
@if (canForecast()) {
  <button 
    class="forecast-btn"
    (click)="generateForecast()"
    [disabled]="analytics.isAnalyzing()"
  >
    {{ analytics.currentForecast() ? 'Update Forecast' : 'Generate Forecast' }}
  </button>
}
```

Update chart template to show forecast:

```html
<!-- In chartTemplate, after historical data rendering -->
@if (forecastData() && def.type === 'line') {
  <!-- Separator line -->
  <line 
    [attr.x1]="pointX(historicalCount())" 
    y1="60" 
    [attr.x2]="pointX(historicalCount())"
    y2="340" 
    stroke="#94a3b8" 
    stroke-width="2"
    stroke-dasharray="5,5"
  />
  
  <!-- Confidence interval areas -->
  <path 
    [attr.d]="confidenceAreaPath(forecastData(), '95')"
    fill="#bfdbfe"
    opacity="0.3"
  />
  <path 
    [attr.d]="confidenceAreaPath(forecastData(), '80')"
    fill="#93c5fd"
    opacity="0.4"
  />
  
  <!-- Forecast line -->
  <path 
    [attr.d]="forecastLinePath(forecastData())"
    fill="none"
    stroke="#2563eb"
    stroke-width="3"
    stroke-dasharray="8,4"
  />
  
  <!-- Forecast points -->
  @for (point of forecastData().predictions; track $index) {
    <circle 
      [attr.cx]="pointX(historicalCount() + $index)"
      [attr.cy]="pointY(point.value)"
      r="4"
      fill="#2563eb"
    >
      <title>
        {{ point.date | date }}
        Forecast: {{ format(point.value) }}
        80% CI: [{{ format(point.lowerBound80) }}, {{ format(point.upperBound80) }}]
        95% CI: [{{ format(point.lowerBound95) }}, {{ format(point.upperBound95) }}]
      </title>
    </circle>
  }
  
  <!-- Legend -->
  <g transform="translate(750, 20)">
    <line x1="0" y1="0" x2="30" y2="0" stroke="#2563eb" stroke-width="3" />
    <text x="35" y="4" class="legend">Historical</text>
    
    <line x1="0" y1="20" x2="30" y2="20" stroke="#2563eb" stroke-width="3" stroke-dasharray="8,4" />
    <text x="35" y="24" class="legend">Forecast</text>
    
    <rect x="0" y="35" width="30" height="10" fill="#93c5fd" opacity="0.4" />
    <text x="35" y="44" class="legend">80% CI</text>
    
    <rect x="0" y="55" width="30" height="10" fill="#bfdbfe" opacity="0.3" />
    <text x="35" y="64" class="legend">95% CI</text>
  </g>
}
```

## App Component Integration

Update `App` component to integrate analytics:

```typescript
export class App {
  // ... existing properties ...
  
  // Inject analytics service
  private analytics = inject(AnalyticsService);
  
  // Add insights tab to selectedTab type
  selectedTab: 'data' | 'profile' | 'insights' | 'chart' | 'dashboard' | 'export' = 'data';
  
  // Expose analytics state
  readonly analyticsInsights = this.analytics.topInsights;
  readonly analyticsRecommendations = this.analytics.recommendations;
  readonly qualityScore = this.analytics.qualityScore;
  
  // Trigger analysis when data changes
  async loadSheet(name: string): Promise<void> {
    // ... existing loadSheet code ...
    
    // Trigger analytics after data loads
    if (this.analytics.analyticsEnabled()) {
      await this.analytics.analyzeDataset(
        this.rows(),
        this.columns(),
        this.profiles()
      );
    }
  }
  
  // Apply recommendation
  applyRecommendation(rec: ChartRecommendation): void {
    this.chart.type = rec.chartType;
    Object.assign(this.chart, rec.suggestedConfig);
    this.refreshChart();
  }
  
  // Visualize insight
  visualizeInsight(insight: Insight): void {
    // Navigate to chart tab
    this.selectedTab = 'chart';
    
    // Configure chart based on insight type
    if (insight.type === 'correlation') {
      const meta = insight.metadata as CorrelationInsight['metadata'];
      this.chart.type = 'scatter';
      this.chart.measure = meta.field1;
      this.chart.secondMeasure = meta.field2;
      this.chart.title = `Correlation: ${meta.field1} vs ${meta.field2}`;
    } else if (insight.type === 'outlier') {
      const meta = insight.metadata as OutlierInsight['metadata'];
      this.chart.type = 'scatter';
      this.chart.dimension = '';
      this.chart.measure = meta.field;
      this.chart.title = `Outliers in ${meta.field}`;
      // Could highlight outlier points in visualization
    } else if (insight.type === 'trend') {
      const meta = insight.metadata as TrendInsight['metadata'];
      this.chart.type = 'line';
      this.chart.measure = meta.field;
      this.chart.title = `${meta.trendType} trend in ${meta.field}`;
    }
    
    this.refreshChart();
  }
  
  // Forecast generation
  canForecast(): boolean {
    const dimProfile = this.profiles().find(p => p.name === this.chart.dimension);
    const hasDateDimension = dimProfile?.type === 'Date' || dimProfile?.type === 'DateTime';
    const hasMeasure = !!this.chart.measure;
    return hasDateDimension && hasMeasure && this.rows().length >= 10;
  }
  
  async generateForecast(): Promise<void> {
    if (!this.canForecast()) return;
    
    try {
      const forecast = await this.analytics.generateForecast(
        this.chart.dimension,
        this.chart.measure,
        this.rows(),
        10 // Default 10 periods
      );
      
      this.notification = `Forecast generated: ${forecast.method} (RMSE: ${forecast.accuracy.rmse?.toFixed(2) ?? 'N/A'})`;
    } catch (error) {
      this.notification = 'Forecasting failed: ' + (error instanceof Error ? error.message : 'Unknown error');
    }
  }
}
```

## Styling Guidelines

All new UI elements should follow the existing application's design system:

- Use existing CSS variables for colors
- Match existing card layouts for insight cards
- Follow existing button styles for actions
- Use existing typography scale
- Maintain existing spacing patterns

Example styles for new components:

```scss
// insights-view
.insights-view {
  padding: 2rem;
}

.insights-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 1.5rem;
  margin-top: 1.5rem;
}

.insight-card {
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  padding: 1.5rem;
  cursor: pointer;
  transition: all 0.2s;
  
  &:hover {
    border-color: #3b82f6;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  }
  
  &[data-confidence="high"] {
    border-left: 4px solid #10b981;
  }
  
  &[data-confidence="medium"] {
    border-left: 4px solid #f59e0b;
  }
  
  &[data-confidence="low"] {
    border-left: 4px solid #ef4444;
  }
  
  header {
    display: flex;
    justify-content: space-between;
    align-items: start;
    margin-bottom: 0.75rem;
  }
  
  h3 {
    font-size: 1.125rem;
    font-weight: 600;
    margin: 0 0 0.5rem 0;
  }
  
  p {
    color: #64748b;
    font-size: 0.875rem;
    line-height: 1.5;
  }
  
  footer {
    margin-top: 1rem;
    padding-top: 1rem;
    border-top: 1px solid #f1f5f9;
    
    span {
      font-size: 0.75rem;
      color: #94a3b8;
    }
  }
}

.insight-type-badge {
  display: inline-block;
  padding: 0.25rem 0.5rem;
  background: #f1f5f9;
  color: #475569;
  font-size: 0.75rem;
  font-weight: 500;
  text-transform: uppercase;
  border-radius: 4px;
  margin-right: 0.5rem;
}

.confidence-badge {
  display: inline-block;
  padding: 0.25rem 0.5rem;
  background: #dbeafe;
  color: #1e40af;
  font-size: 0.75rem;
  font-weight: 600;
  border-radius: 4px;
}

.dismiss-btn {
  background: transparent;
  border: none;
  color: #94a3b8;
  font-size: 1.5rem;
  cursor: pointer;
  padding: 0;
  width: 24px;
  height: 24px;
  line-height: 1;
  
  &:hover {
    color: #475569;
  }
}

.recommendations-box {
  margin-top: 1.5rem;
  padding: 1rem;
  background: #f8fafc;
  border-radius: 8px;
  
  h3 {
    font-size: 0.875rem;
    font-weight: 600;
    text-transform: uppercase;
    color: #64748b;
    margin: 0 0 0.75rem 0;
  }
}

.recommendation-item {
  display: block;
  width: 100%;
  text-align: left;
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  padding: 0.75rem;
  margin-bottom: 0.5rem;
  cursor: pointer;
  transition: all 0.2s;
  
  &:hover {
    border-color: #3b82f6;
    background: #f8fafc;
  }
  
  .rec-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 0.25rem;
    
    strong {
      color: #0f172a;
    }
    
    .confidence {
      font-size: 0.75rem;
      color: #3b82f6;
      font-weight: 600;
    }
  }
  
  p {
    font-size: 0.8125rem;
    color: #64748b;
    margin: 0;
    line-height: 1.4;
  }
}

.quality-score {
  background: transparent;
  border: none;
  color: inherit;
  cursor: pointer;
  font: inherit;
  padding: 0;
  
  &:hover {
    text-decoration: underline;
  }
  
  &.warning {
    color: #f59e0b;
    font-weight: 600;
  }
}

.analyzing-indicator {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 3rem;
  
  .spinner {
    display: inline-block;
    width: 24px;
    height: 24px;
    border: 3px solid #e2e8f0;
    border-top-color: #3b82f6;
    border-radius: 50%;
    animation: spin 1s linear infinite;
    margin-right: 0.75rem;
  }
  
  p {
    color: #64748b;
    margin: 0;
  }
}

@keyframes spin {
  to { transform: rotate(360deg); }
}
```

## Dependencies

### Required npm Packages

```json
{
  "dependencies": {
    "@tensorflow/tfjs": "^4.15.0",
    "comlink": "^4.4.1"
  },
  "devDependencies": {
    "@types/tensorflow__tfjs": "^4.15.0"
  }
}
```

### Installation

```bash
npm install @tensorflow/tfjs@^4.15.0 comlink@^4.4.1
npm install --save-dev @types/tensorflow__tfjs@^4.15.0
```

## Deployment Considerations

### Build Configuration

Update `angular.json` to handle Web Workers:

```json
{
  "projects": {
    "ExcelAnalyser": {
      "architect": {
        "build": {
          "options": {
            "webWorkerTsConfig": "tsconfig.worker.json"
          }
        }
      }
    }
  }
}
```

Create `tsconfig.worker.json`:

```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "outDir": "./out-tsc/worker",
    "lib": ["es2018", "webworker"],
    "types": []
  },
  "include": ["src/**/*.worker.ts"]
}
```

### Bundle Size Considerations

TensorFlow.js is large (~500KB gzipped). Mitigations:

1. **Lazy Loading**: Load TF.js only when analytics features first accessed
2. **Tree Shaking**: Import only required TF.js modules
3. **CDN Option**: Consider loading from CDN for web deployment
4. **Code Splitting**: Analytics services in separate chunk

Expected bundle impact:
- Base TF.js: ~500KB gzipped
- Analytics services: ~50KB gzipped
- Total addition: ~550KB gzipped

### Electron Packaging

TensorFlow.js works in Electron with no special configuration. Native Node.js TensorFlow binding (`@tensorflow/tfjs-node`) is NOT required since we're using the WebGL/CPU backend in renderer process.

## Future Enhancements

This design focuses on Requirements 1-4. Future phases will add:

- **Requirement 5**: Automated Narrative Generation
- **Requirement 6**: Analytics UI Integration (partially covered)
- **Requirement 7**: Performance and Resource Management (partially covered)
- **Requirement 8**: Offline-First ML Model Management
- **Requirement 9**: Feature Tier Management
- **Requirement 10**: Analytics Export and Sharing
- **Requirement 11**: User Preferences and Settings
- **Requirement 12**: Error Handling (partially covered)
- **Requirement 13**: Insight Visualization (partially covered)
- **Requirement 14**: Forecast Visualization (covered)
- **Requirement 15**: Analytics Documentation and Help

## Notes

### Why No Property-Based Testing

Property-based testing (PBT) is not appropriate for this feature because:

1. **External Service Integration**: Analytics relies on TensorFlow.js (external library) and statistical algorithms where behavior is deterministic for given inputs but not universal across all possible inputs
2. **Statistical Nature**: Many operations (correlation, outliers, forecasting) have specific expected outputs for specific inputs, making example-based tests more suitable
3. **Performance Testing**: The critical properties to test are performance characteristics (timing, memory) which are better suited to benchmark tests than PBT
4. **Complex State**: Analytics involves significant internal state management and caching that doesn't lend itself well to universal properties
5. **UI Integration**: Much of this feature is UI integration work, which is better tested with snapshot tests and interaction tests

Instead, we use:
- **Unit tests** for statistical functions with known inputs/outputs
- **Integration tests** for service coordination and data flow
- **Performance tests** for meeting timing and memory requirements
- **Snapshot tests** for UI components

### Statistical Algorithm Selection

**Correlation**: Pearson correlation coefficient
- Simple, fast, well-understood
- Appropriate for linear relationships
- O(n) complexity

**Outlier Detection**: Interquartile Range (IQR) method
- Robust to distribution assumptions
- Commonly understood by analysts
- Faster than iterative methods
- Complements z-score for validation

**Trend Detection**: Linear regression slope
- Simple, interpretable
- Fast computation
- Normalized by value range for comparison

**Seasonality**: Autocorrelation
- Detects periodic patterns
- Configurable lag periods
- Computationally efficient

**Forecasting**: Exponential Smoothing (Holt-Winters)
- Handles trend and seasonality
- No training required
- Fast predictions
- Well-suited for business data
- Simpler than ARIMA with comparable accuracy for many use cases

### TensorFlow.js Usage

In this initial implementation, TensorFlow.js is included for future ML enhancements but core algorithms use pure TypeScript implementations:

**Current Phase (Requirements 1-4)**:
- Statistical functions: Pure TypeScript
- Pattern detection: Rule-based algorithms
- Forecasting: Holt-Winters in TypeScript
- No neural networks required

**Future Phases**:
- Advanced pattern recognition: Neural networks
- Anomaly detection: Autoencoder models
- Natural language generation: Transformer models (if local LLM becomes feasible)

This approach keeps initial bundle size reasonable while providing upgrade path.

### Integration with Existing Code

The design minimally modifies existing `App` component:
- Adds `analytics` service injection
- Adds "insights" to tab type
- Adds helper methods for visualization
- No changes to existing data flow or chart logic
- Analytics is opt-in feature that degrades gracefully

Existing features remain unchanged:
- Data loading and profiling
- Chart building
- Dashboard
- Export functionality

Analytics enhances but doesn't replace existing capabilities.
