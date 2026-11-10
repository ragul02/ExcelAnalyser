import { Service } from '@angular/core';

/**
 * CacheService for performance optimization
 * 
 * Provides caching for:
 * - Insights with 5-minute TTL
 * - Forecasts with key-based invalidation
 * - Dataset hashing for cache keys
 * 
 * **Validates: Requirements 7.3, 7.8**
 */
@Service()
export class CacheService {
  private insightCache = new Map<string, { insights: unknown[]; timestamp: number }>();
  private forecastCache = new Map<string, { forecast: unknown; timestamp: number }>();
  
  private readonly INSIGHT_CACHE_TTL = 5 * 60 * 1000; // 5 minutes
  // Forecasts use key-based invalidation, no TTL
  
  /**
   * Get cached insights for a dataset
   * @param dataHash Hash of the dataset
   * @returns Cached insights or null if not found/expired
   */
  getCachedInsights(dataHash: string): unknown[] | null {
    const cached = this.insightCache.get(dataHash);
    if (!cached) return null;
    
    // Check if cache has expired (5-minute TTL)
    if (Date.now() - cached.timestamp > this.INSIGHT_CACHE_TTL) {
      this.insightCache.delete(dataHash);
      return null;
    }
    
    return cached.insights;
  }
  
  /**
   * Cache insights for a dataset
   * @param dataHash Hash of the dataset
   * @param insights Insights to cache
   */
  cacheInsights(dataHash: string, insights: unknown[]): void {
    this.insightCache.set(dataHash, { 
      insights, 
      timestamp: Date.now() 
    });
  }
  
  /**
   * Get cached forecast for a specific key
   * @param cacheKey Unique key identifying the forecast configuration
   * @returns Cached forecast or null if not found
   */
  getCachedForecast(cacheKey: string): unknown | null {
    const cached = this.forecastCache.get(cacheKey);
    if (!cached) return null;
    
    return cached.forecast;
  }
  
  /**
   * Cache forecast with key-based invalidation
   * @param cacheKey Unique key identifying the forecast configuration
   * @param forecast Forecast result to cache
   */
  cacheForecast(cacheKey: string, forecast: unknown): void {
    this.forecastCache.set(cacheKey, { 
      forecast, 
      timestamp: Date.now() 
    });
  }
  
  /**
   * Invalidate a specific forecast cache entry
   * @param cacheKey Key of the forecast to invalidate
   */
  invalidateForecast(cacheKey: string): void {
    this.forecastCache.delete(cacheKey);
  }
  
  /**
   * Invalidate all forecast caches
   */
  invalidateAllForecasts(): void {
    this.forecastCache.clear();
  }
  
  /**
   * Invalidate all caches (insights and forecasts)
   */
  invalidateAllCaches(): void {
    this.insightCache.clear();
    this.forecastCache.clear();
  }
  
  /**
   * Invalidate caches when dataset changes
   * This should be called whenever the dataset is modified
   * @param dataHash Optional specific dataset hash to invalidate
   */
  invalidateOnDatasetChange(dataHash?: string): void {
    if (dataHash) {
      // Invalidate specific dataset's insights
      this.insightCache.delete(dataHash);
      
      // Invalidate all forecasts related to this dataset
      // Since forecasts are dataset-specific, clear all forecasts when data changes
      this.forecastCache.clear();
    } else {
      // Invalidate everything if no specific hash provided
      this.invalidateAllCaches();
    }
  }
  
  /**
   * Fingerprint the complete dataset and ordered schema for cache identity.
   * @param rows Dataset rows
   * @param columns Column names
   * @returns Hash string for cache key
   */
  hashDataset(rows: unknown[], columns: string[]): string {
    const canonicalize = (value: unknown): string => {
      if (value instanceof Date) return JSON.stringify(value.toISOString());
      if (Array.isArray(value)) return `[${value.map(canonicalize).join(',')}]`;
      if (value && typeof value === 'object') {
        const record = value as Record<string, unknown>;
        return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${canonicalize(record[key])}`).join(',')}}`;
      }
      if (typeof value === 'number' && !Number.isFinite(value)) return JSON.stringify(String(value));
      return JSON.stringify(value) ?? 'undefined';
    };

    const input = canonicalize({ columns, rows });
    // Two independent 32-bit streams reduce accidental collisions while keeping
    // the API synchronous for existing cache callers. This is not a security hash.
    let first = 0x811c9dc5;
    let second = 0x9e3779b9;
    for (let index = 0; index < input.length; index++) {
      const code = input.charCodeAt(index);
      first = Math.imul(first ^ code, 0x01000193);
      second = Math.imul(second ^ code, 0x85ebca6b);
    }
    return `${(first >>> 0).toString(36)}${(second >>> 0).toString(36)}`;
  }
  
  /**
   * Get cache statistics for monitoring
   * @returns Object with cache size and memory usage info
   */
  getCacheStats(): {
    insightCacheSize: number;
    forecastCacheSize: number;
    totalEntries: number;
  } {
    return {
      insightCacheSize: this.insightCache.size,
      forecastCacheSize: this.forecastCache.size,
      totalEntries: this.insightCache.size + this.forecastCache.size
    };
  }
  
  /**
   * Clean up expired insight cache entries
   * Should be called periodically for memory management
   */
  cleanupExpiredInsights(): void {
    const now = Date.now();
    const keysToDelete: string[] = [];
    
    this.insightCache.forEach((value, key) => {
      if (now - value.timestamp > this.INSIGHT_CACHE_TTL) {
        keysToDelete.push(key);
      }
    });
    
    keysToDelete.forEach(key => this.insightCache.delete(key));
  }
}
