# CacheService Usage Guide

## Overview

The `CacheService` provides performance optimization through intelligent caching with TTL (Time-To-Live) for insights and key-based invalidation for forecasts.

## Features

### 1. Insight Caching (5-minute TTL)
- Automatically expires after 5 minutes
- Based on dataset hash for efficient lookup
- Suitable for analytical insights that don't change frequently

### 2. Forecast Caching (Key-based invalidation)
- No automatic expiration
- Manual invalidation when dataset changes
- Keyed by forecast parameters for precise cache management

### 3. Dataset Hashing
- Uses first 100 rows for performance
- Generates consistent, deterministic hashes
- Efficient for large datasets

## Usage Examples

### Basic Insight Caching

```typescript
import { inject } from '@angular/core';
import { CacheService } from './services/cache.service';

export class AnalyticsService {
  private cache = inject(CacheService);
  
  async analyzeDataset(rows: any[], columns: string[]) {
    // Generate hash from dataset
    const dataHash = this.cache.hashDataset(rows, columns);
    
    // Try to get cached insights
    const cached = this.cache.getCachedInsights(dataHash);
    if (cached) {
      console.log('Using cached insights');
      return cached;
    }
    
    // Compute insights if not cached
    const insights = await this.computeInsights(rows, columns);
    
    // Cache the results
    this.cache.cacheInsights(dataHash, insights);
    
    return insights;
  }
}
```

### Forecast Caching

```typescript
export class ForecastService {
  private cache = inject(CacheService);
  
  async generateForecast(
    dateField: string,
    measureField: string,
    rows: any[],
    periods: number
  ) {
    // Create unique cache key
    const cacheKey = `forecast-${dateField}-${measureField}-${periods}`;
    
    // Check cache
    const cached = this.cache.getCachedForecast(cacheKey);
    if (cached) {
      return cached;
    }
    
    // Generate forecast
    const forecast = await this.computeForecast(dateField, measureField, rows, periods);
    
    // Cache result
    this.cache.cacheForecast(cacheKey, forecast);
    
    return forecast;
  }
}
```

### Handling Dataset Changes

```typescript
export class DataService {
  private cache = inject(CacheService);
  
  updateDataset(newRows: any[], columns: string[]) {
    // Generate hash for the modified dataset
    const dataHash = this.cache.hashDataset(newRows, columns);
    
    // Invalidate caches for this dataset
    this.cache.invalidateOnDatasetChange(dataHash);
    
    // Or invalidate all caches if dataset is completely new
    this.cache.invalidateOnDatasetChange();
  }
  
  clearAllData() {
    // Clear everything when switching datasets
    this.cache.invalidateAllCaches();
  }
}
```

### Manual Cache Management

```typescript
export class CacheManagementService {
  private cache = inject(CacheService);
  
  // Periodic cleanup of expired insights
  setupPeriodicCleanup() {
    setInterval(() => {
      this.cache.cleanupExpiredInsights();
    }, 5 * 60 * 1000); // Every 5 minutes
  }
  
  // Monitor cache usage
  logCacheStats() {
    const stats = this.cache.getCacheStats();
    console.log('Cache Statistics:', {
      insights: stats.insightCacheSize,
      forecasts: stats.forecastCacheSize,
      total: stats.totalEntries
    });
  }
  
  // Invalidate specific forecast
  invalidateSpecificForecast(dateField: string, measureField: string) {
    const cacheKey = `forecast-${dateField}-${measureField}`;
    this.cache.invalidateForecast(cacheKey);
  }
}
```

## Cache Key Strategies

### For Insights
- Use `hashDataset(rows, columns)` to generate keys
- Automatically considers dataset size, structure, and content
- Same data = same hash = cache hit

### For Forecasts
- Create descriptive keys: `forecast-${field1}-${field2}-${params}`
- Include all parameters that affect the forecast
- Example: `forecast-date-sales-30periods-exponential`

## Performance Considerations

1. **Hash Generation**: Uses only first 100 rows, O(100) complexity
2. **Cache Lookup**: O(1) Map-based retrieval
3. **Memory**: Map-based storage, consider cleanup for long-running sessions
4. **TTL Check**: Only performed on cache read, no background timers

## Best Practices

1. **Always hash datasets** before caching insights
2. **Create consistent cache keys** for forecasts
3. **Invalidate on data changes** to prevent stale results
4. **Use cleanup periodically** for long-running applications
5. **Monitor cache stats** to prevent unbounded growth

## Cache Invalidation Patterns

### Pattern 1: On Data Load
```typescript
onNewDatasetLoaded(rows: any[], columns: string[]) {
  this.cache.invalidateAllCaches();
  // Fresh start for new dataset
}
```

### Pattern 2: On Data Modification
```typescript
onDatasetModified(rows: any[], columns: string[]) {
  const hash = this.cache.hashDataset(rows, columns);
  this.cache.invalidateOnDatasetChange(hash);
  // Invalidate only affected caches
}
```

### Pattern 3: On User Action
```typescript
onUserRefreshRequest() {
  this.cache.invalidateAllForecasts();
  // Keep insights but refresh forecasts
}
```

## Requirements Coverage

- **Requirement 7.3**: Cache for insights with 5-minute TTL ✓
- **Requirement 7.8**: Cache for forecasts with key-based invalidation ✓
- **Requirement 7.8**: hashDataset method using first 100 rows ✓
- **Requirement 7.8**: Cache invalidation on dataset changes ✓
