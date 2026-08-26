import { Service, inject, signal, computed, effect } from '@angular/core';
import { InsightDetectorService } from './insight-detector.service';
import { ForecastService } from './forecast.service';
import { RecommendationEngineService } from './recommendation-engine.service';
import { QualityAnalyzerService } from './quality-analyzer.service';
import { CacheService } from './cache.service';
import { TensorFlowService } from './tensorflow.service';
import { Insight } from '../models/insight.types';
import { ForecastResult } from '../models/forecast.types';
import { ChartRecommendation } from '../models/recommendation.types';
import { QualityScore } from '../models/quality.types';
import { StatisticsService } from './statistics.service';
import { AnalyticsWorkerApi } from '../workers/analytics.worker';
import { Remote, wrap } from 'comlink';

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
 * AnalyticsService - Central coordinator for all analytics features
 * 
 * This service orchestrates:
 * - Insight detection and management
 * - Time series forecasting
 * - Chart recommendations
 * - Analytics state management
 * - Cache coordination
 * - Performance optimization
 * 
 * Acts as the main entry point for the UI to access analytics capabilities.
 * 
 * **Validates: Requirements 1.1, 1.2, 2.1, 3.1, 7.1, 7.2, 7.3, 7.8**
 */
@Service()
export class AnalyticsService {
  // Inject dependencies
  private readonly insightDetector = inject(InsightDetectorService);
  private readonly forecastService = inject(ForecastService);
  private readonly recommendationEngine = inject(RecommendationEngineService);
  private readonly qualityAnalyzer = inject(QualityAnalyzerService);
  private readonly cacheService = inject(CacheService);
  private readonly tfService = inject(TensorFlowService);
  private readonly statistics = inject(StatisticsService);
  private worker?: Worker;
  private workerApi?: Remote<AnalyticsWorkerApi>;
  
  // ==========================================================================
  // TASK 7.1: State Management with Signals
  // ==========================================================================
  
  // State signals
  readonly insights = signal<Insight[]>([]);
  readonly isAnalyzing = signal(false);
  readonly analyticsEnabled = signal(true);
  readonly currentForecast = signal<ForecastResult | null>(null);
  readonly recommendations = signal<ChartRecommendation[]>([]);
  readonly qualityScore = signal<QualityScore | null>(null);
  readonly analysisError = signal<string | null>(null);
  
  // Progress tracking
  readonly analysisProgress = signal(0); // 0-100
  readonly analysisStage = signal<string>('');
  
  // Dataset tracking for cache invalidation
  private currentDataHash = signal<string>('');
  
  // Computed signals
  readonly hasInsights = computed(() => this.insights().length > 0);
  
  readonly topInsights = computed(() => 
    this.insights()
      .filter(i => !i.dismissed)
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, 5)
  );
  
  readonly insightsByType = computed(() => {
    const grouped = new Map<string, Insight[]>();
    
    for (const insight of this.insights()) {
      if (!insight.dismissed) {
        const existing = grouped.get(insight.type) || [];
        existing.push(insight);
        grouped.set(insight.type, existing);
      }
    }
    
    return grouped;
  });
  
  readonly hasActiveForecast = computed(() => this.currentForecast() !== null);
  
  readonly hasRecommendations = computed(() => this.recommendations().length > 0);
  
  // Debounce timer for analysis
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly DEBOUNCE_DELAY = 2000; // 2 seconds
  
  // Performance tracking
  private lastAnalysisTime = 0;
  
  constructor() {
    // Auto-cleanup expired caches periodically
    setInterval(() => {
      this.cacheService.cleanupExpiredInsights();
    }, 60000); // Every minute
  }
  
  // ==========================================================================
  // TASK 7.2: Dataset Analysis Orchestration
  // ==========================================================================
  
  /**
   * Analyzes a dataset and detects insights
   * 
   * Features:
   * - Debouncing (2-second delay)
   * - Cache checking
   * - Progress tracking
   * - Error handling
   * - Performance monitoring
   * 
   * **Validates: Requirements 1.1, 7.2, 7.3, 7.8**
   * 
   * @param rows Dataset rows
   * @param columns Column names
   * @param profiles Field profiles with statistics
   * @returns Promise resolving when analysis completes
   */
  async analyzeDataset(
    rows: Row[],
    columns: string[],
    profiles: FieldProfile[]
  ): Promise<void> {
    // Check if analytics is enabled
    if (!this.analyticsEnabled()) {
      console.log('[AnalyticsService] Analytics disabled, skipping analysis');
      return;
    }
    
    // Clear any pending debounce
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }
    
    // Debounce analysis
    return new Promise<void>((resolve) => {
      this.debounceTimer = setTimeout(async () => {
        await this.performAnalysis(rows, columns, profiles);
        resolve();
      }, this.DEBOUNCE_DELAY);
    });
  }
  
  /**
   * Performs the actual analysis (called after debounce)
   */
  private async performAnalysis(
    rows: Row[],
    columns: string[],
    profiles: FieldProfile[]
  ): Promise<void> {
    const startTime = performance.now();
    
    try {
      // Generate dataset hash for caching
      const dataHash = this.cacheService.hashDataset(rows, columns);
      this.currentDataHash.set(dataHash);

      // Quality analysis is deterministic and remains available when insights are cached.
      this.qualityScore.set(this.qualityAnalyzer.analyzeQuality(rows, columns, profiles));
      
      // Check cache first
      const cachedInsights = this.cacheService.getCachedInsights(dataHash);
      if (cachedInsights) {
        console.log('[AnalyticsService] Using cached insights');
        this.insights.set(cachedInsights as Insight[]);
        return;
      }
      
      // Start analysis
      this.isAnalyzing.set(true);
      this.analysisError.set(null);
      this.analysisProgress.set(0);
      this.analysisStage.set('Initializing analysis...');
      
      // Initialize TensorFlow if needed (lazy loading)
      if (!this.tfService.isReady()) {
        this.analysisStage.set('Loading ML models...');
        await this.tfService.initialize();
        this.analysisProgress.set(10);
      }
      
      // Detect insights
      this.analysisStage.set('Detecting patterns and insights...');
      this.analysisProgress.set(30);
      
      // Show progress indicator if taking longer than 500ms
      const progressTimer = setTimeout(() => {
        if (this.isAnalyzing()) {
          console.log('[AnalyticsService] Analysis in progress...');
        }
      }, 500);
      
      // Perform insight detection
      const detectedInsights = rows.length > 10000
        ? await this.detectInsightsWithWorker(rows, profiles)
        : await this.insightDetector.detectInsights(rows, profiles);
      clearTimeout(progressTimer);
      
      this.analysisProgress.set(80);
      this.analysisStage.set('Finalizing results...');
      
      // Cache the results
      this.cacheService.cacheInsights(dataHash, detectedInsights);
      
      // Update state
      this.insights.set(detectedInsights);
      this.analysisProgress.set(100);
      
      // Track performance
      const duration = performance.now() - startTime;
      this.lastAnalysisTime = duration;
      
      console.log(`[AnalyticsService] Analysis completed in ${duration.toFixed(0)}ms, found ${detectedInsights.length} insights`);
      
      // Check performance target (< 5 seconds for 100K rows)
      if (rows.length > 10000 && duration > 5000) {
        console.warn(`[AnalyticsService] Analysis took ${(duration / 1000).toFixed(1)}s for ${rows.length} rows - consider using Web Worker`);
      }
      
    } catch (error) {
      console.error('[AnalyticsService] Analysis failed:', error);
      const errorMessage = error instanceof Error ? error.message : 'Analysis failed';
      this.analysisError.set(errorMessage);
      this.insights.set([]);
    } finally {
      this.isAnalyzing.set(false);
      this.analysisStage.set('');
      this.analysisProgress.set(0);
    }
  }
  
  /**
   * Analyzes dataset immediately without debouncing
   * Useful for user-triggered actions
   * 
   * @param rows Dataset rows
   * @param columns Column names
   * @param profiles Field profiles
   */
  async analyzeDatasetImmediate(
    rows: Row[],
    columns: string[],
    profiles: FieldProfile[]
  ): Promise<void> {
    // Cancel any pending debounced analysis
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
    
    await this.performAnalysis(rows, columns, profiles);
  }

  /**
   * Calculates a correlation matrix in the worker when available.
   */
  async calculateCorrelationMatrix(rows: Row[], fields: string[]): Promise<Record<string, Record<string, number>>> {
    try {
      return await this.getWorkerApi().calculateCorrelationMatrix(rows, fields);
    } catch (error) {
      console.warn('[AnalyticsService] Worker correlation matrix failed; using main thread fallback', error);
      return this.calculateCorrelationMatrixOnMain(rows, fields);
    }
  }

  private async detectInsightsWithWorker(rows: Row[], profiles: FieldProfile[]): Promise<Insight[]> {
    try {
      return await this.getWorkerApi().analyzeDataset(rows, profiles);
    } catch (error) {
      console.warn('[AnalyticsService] Worker insight analysis failed; using main thread fallback', error);
      return this.insightDetector.detectInsights(rows, profiles);
    }
  }

  private async generateForecastWithWorker(
    dateField: string,
    measureField: string,
    rows: Row[],
    periods: number,
  ): Promise<ForecastResult> {
    try {
      return await this.getWorkerApi().generateForecast(dateField, measureField, rows, periods);
    } catch (error) {
      console.warn('[AnalyticsService] Worker forecast failed; using main thread fallback', error);
      return this.forecastService.forecast(dateField, measureField, rows, periods);
    }
  }

  private getWorkerApi(): Remote<AnalyticsWorkerApi> {
    if (this.workerApi) return this.workerApi;
    if (typeof Worker === 'undefined') throw new Error('Web Workers are unavailable in this environment');
    this.worker = new Worker(new URL('../workers/analytics.worker', import.meta.url), { type: 'module' });
    this.workerApi = wrap<AnalyticsWorkerApi>(this.worker);
    return this.workerApi;
  }

  private calculateCorrelationMatrixOnMain(rows: Row[], fields: string[]): Record<string, Record<string, number>> {
    const matrix: Record<string, Record<string, number>> = {};
    for (const firstField of fields) {
      matrix[firstField] = {};
      for (const secondField of fields) {
        matrix[firstField][secondField] = this.statistics.pearsonCorrelation(
          this.numericValues(rows, firstField),
          this.numericValues(rows, secondField),
        );
      }
    }
    return matrix;
  }

  private numericValues(rows: Row[], field: string): number[] {
    return rows
      .map((row) => typeof row[field] === 'number'
        ? row[field] as number
        : Number(String(row[field] ?? '').replace(/[$€£₹,%\s]/g, '')))
      .filter((value) => Number.isFinite(value));
  }
  
  // ==========================================================================
  // TASK 7.3: Forecast and Recommendation Methods
  // ==========================================================================
  
  /**
   * Generates a time series forecast
   * 
   * **Validates: Requirements 2.1**
   * 
   * @param dateField Name of date field
   * @param measureField Name of measure field
   * @param rows Dataset rows
   * @param periods Number of periods to forecast
   * @returns Promise resolving to forecast result
   */
  async generateForecast(
    dateField: string,
    measureField: string,
    rows: Row[],
    periods: number = 10
  ): Promise<ForecastResult> {
    try {
      // Generate cache key
      const cacheKey = `${dateField}_${measureField}_${periods}_${this.currentDataHash()}`;
      
      // Check cache
      const cachedForecast = this.cacheService.getCachedForecast(cacheKey);
      if (cachedForecast) {
        console.log('[AnalyticsService] Using cached forecast');
        const forecast = cachedForecast as ForecastResult;
        this.currentForecast.set(forecast);
        return forecast;
      }
      
      // Generate forecast
      console.log(`[AnalyticsService] Generating ${periods}-period forecast for ${measureField} over ${dateField}`);
      const forecast = periods > 20
        ? await this.generateForecastWithWorker(dateField, measureField, rows, periods)
        : await this.forecastService.forecast(dateField, measureField, rows, periods);
      
      // Cache the forecast
      this.cacheService.cacheForecast(cacheKey, forecast);
      
      // Update state
      this.currentForecast.set(forecast);
      
      return forecast;
    } catch (error) {
      console.error('[AnalyticsService] Forecast generation failed:', error);
      throw error;
    }
  }
  
  /**
   * Gets chart recommendations for field selections
   * 
   * **Validates: Requirements 3.1, 3.2**
   * 
   * @param dimension Selected dimension field
   * @param measure Selected measure field
   * @param secondMeasure Optional second measure
   * @param profiles Field profiles
   * @param rows Optional dataset rows for advanced analysis
   * @returns Array of recommendations
   */
  getRecommendations(
    dimension: string | null,
    measure: string | null,
    secondMeasure: string | null,
    profiles: FieldProfile[],
    rows?: Row[]
  ): ChartRecommendation[] {
    try {
      const recommendations = this.recommendationEngine.getRecommendations(
        dimension,
        measure,
        secondMeasure,
        profiles,
        rows
      );
      
      this.recommendations.set(recommendations);
      
      console.log(`[AnalyticsService] Generated ${recommendations.length} chart recommendations`);
      
      return recommendations;
    } catch (error) {
      console.error('[AnalyticsService] Recommendation generation failed:', error);
      this.recommendations.set([]);
      return [];
    }
  }
  
  /**
   * Dismisses an insight
   * 
   * @param insightId ID of insight to dismiss
   */
  dismissInsight(insightId: string): void {
    const currentInsights = this.insights();
    const updatedInsights = currentInsights.map(insight =>
      insight.id === insightId
        ? { ...insight, dismissed: true }
        : insight
    );
    
    this.insights.set(updatedInsights);
    
    console.log(`[AnalyticsService] Dismissed insight: ${insightId}`);
  }
  
  /**
   * Restores a dismissed insight
   * 
   * @param insightId ID of insight to restore
   */
  restoreInsight(insightId: string): void {
    const currentInsights = this.insights();
    const updatedInsights = currentInsights.map(insight =>
      insight.id === insightId
        ? { ...insight, dismissed: false }
        : insight
    );
    
    this.insights.set(updatedInsights);
    
    console.log(`[AnalyticsService] Restored insight: ${insightId}`);
  }
  
  /**
   * Clears all caches and forces re-analysis
   */
  clearCache(): void {
    this.cacheService.invalidateAllCaches();
    this.currentForecast.set(null);
    console.log('[AnalyticsService] All caches cleared');
  }
  
  /**
   * Invalidates caches when dataset changes
   */
  onDatasetChange(): void {
    const currentHash = this.currentDataHash();
    this.cacheService.invalidateOnDatasetChange(currentHash);
    this.currentForecast.set(null);
    this.insights.set([]);
    this.recommendations.set([]);
    console.log('[AnalyticsService] Dataset changed, caches invalidated');
  }
  
  /**
   * Clears current forecast
   */
  clearForecast(): void {
    this.currentForecast.set(null);
  }
  
  /**
   * Clears all recommendations
   */
  clearRecommendations(): void {
    this.recommendations.set([]);
  }
  
  /**
   * Enables analytics features
   */
  enableAnalytics(): void {
    this.analyticsEnabled.set(true);
    console.log('[AnalyticsService] Analytics enabled');
  }
  
  /**
   * Disables analytics features
   */
  disableAnalytics(): void {
    this.analyticsEnabled.set(false);
    this.isAnalyzing.set(false);
    console.log('[AnalyticsService] Analytics disabled');
  }
  
  /**
   * Gets analytics performance metrics
   */
  getPerformanceMetrics(): {
    lastAnalysisTime: number;
    isAnalyzing: boolean;
    cacheStats: ReturnType<CacheService['getCacheStats']>;
    insightCount: number;
    hasForecast: boolean;
    recommendationCount: number;
  } {
    return {
      lastAnalysisTime: this.lastAnalysisTime,
      isAnalyzing: this.isAnalyzing(),
      cacheStats: this.cacheService.getCacheStats(),
      insightCount: this.insights().length,
      hasForecast: this.hasActiveForecast(),
      recommendationCount: this.recommendations().length
    };
  }
  
  /**
   * Gets insights filtered by type
   * 
   * @param type Insight type to filter by
   * @returns Filtered insights
   */
  getInsightsByType(type: Insight['type']): Insight[] {
    return this.insights().filter(i => i.type === type && !i.dismissed);
  }
  
  /**
   * Gets insight count by confidence level
   */
  getInsightStats(): {
    total: number;
    high: number; // confidence > 80
    medium: number; // confidence 60-80
    low: number; // confidence < 60
    dismissed: number;
  } {
    const allInsights = this.insights();
    
    return {
      total: allInsights.length,
      high: allInsights.filter(i => !i.dismissed && i.confidence > 80).length,
      medium: allInsights.filter(i => !i.dismissed && i.confidence >= 60 && i.confidence <= 80).length,
      low: allInsights.filter(i => !i.dismissed && i.confidence < 60).length,
      dismissed: allInsights.filter(i => i.dismissed).length
    };
  }
  
  /**
   * Checks if dataset should use Web Worker for analysis
   * 
   * @param rowCount Number of rows in dataset
   * @returns True if Web Worker should be used
   */
  shouldUseWorker(rowCount: number): boolean {
    return this.insightDetector.shouldUseWorker(
      Array(rowCount).fill({}) as Row[]
    );
  }
  
  /**
   * Gets memory usage from TensorFlow service
   */
  getMemoryInfo(): ReturnType<TensorFlowService['getMemoryInfo']> {
    return this.tfService.getMemoryInfo();
  }
  
  /**
   * Cleanup method for memory management
   */
  async cleanup(): Promise<void> {
    // Cancel any pending analysis
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
    
    // Clear state
    this.insights.set([]);
    this.currentForecast.set(null);
    this.recommendations.set([]);
    this.isAnalyzing.set(false);
    
    // Clear caches
    this.cacheService.invalidateAllCaches();
    
    // Dispose TensorFlow resources if needed
    if (this.tfService.isReady() && this.tfService.isMemoryExceeded(200)) {
      await this.tfService.dispose();
      console.log('[AnalyticsService] TensorFlow resources disposed due to memory pressure');
    }
    
    console.log('[AnalyticsService] Cleanup completed');
  }
}
