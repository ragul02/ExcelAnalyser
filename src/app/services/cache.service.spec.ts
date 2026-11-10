import { TestBed } from '@angular/core/testing';
import { CacheService } from './cache.service';

describe('CacheService', () => {
  let service: CacheService;
  
  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(CacheService);
  });
  
  afterEach(() => {
    // Clean up after each test
    service.invalidateAllCaches();
  });
  
  it('should be created', () => {
    expect(service).toBeTruthy();
  });
  
  describe('hashDataset', () => {
    it('should generate consistent hash for same dataset', () => {
      const rows = [
        { name: 'Alice', age: 30 },
        { name: 'Bob', age: 25 }
      ];
      const columns = ['name', 'age'];
      
      const hash1 = service.hashDataset(rows, columns);
      const hash2 = service.hashDataset(rows, columns);
      
      expect(hash1).toBe(hash2);
      expect(hash1).toBeTruthy();
    });
    
    it('should generate different hash for different datasets', () => {
      const rows1 = [{ name: 'Alice', age: 30 }];
      const rows2 = [{ name: 'Bob', age: 25 }];
      const columns = ['name', 'age'];
      
      const hash1 = service.hashDataset(rows1, columns);
      const hash2 = service.hashDataset(rows2, columns);
      
      expect(hash1).not.toBe(hash2);
    });
    
    it('should handle empty dataset', () => {
      const hash = service.hashDataset([], []);
      expect(hash).toBeTruthy();
    });
    
    it('should include changes after the first 100 rows', () => {
      const largeDataset = Array.from({ length: 200 }, (_, i) => ({ 
        id: i, 
        value: Math.random() 
      }));
      const columns = ['id', 'value'];
      
      const hash = service.hashDataset(largeDataset, columns);
      const changed = structuredClone(largeDataset);
      changed[199].value = -1;
      expect(service.hashDataset(changed, columns)).not.toBe(hash);
    });
    
    it('should generate different hash when column order differs', () => {
      const rows = [{ name: 'Alice', age: 30 }];
      const columns1 = ['name', 'age'];
      const columns2 = ['age', 'name'];
      
      const hash1 = service.hashDataset(rows, columns1);
      const hash2 = service.hashDataset(rows, columns2);
      
      expect(hash1).not.toBe(hash2);
      expect(columns1).toEqual(['name', 'age']);
    });
  });
  
  describe('insight caching', () => {
    it('should cache and retrieve insights', () => {
      const dataHash = 'test-hash-123';
      const insights = [
        { type: 'correlation', confidence: 85 },
        { type: 'outlier', confidence: 92 }
      ];
      
      service.cacheInsights(dataHash, insights);
      const cached = service.getCachedInsights(dataHash);
      
      expect(cached).toEqual(insights);
    });
    
    it('should return null for non-existent cache', () => {
      const cached = service.getCachedInsights('non-existent');
      expect(cached).toBeNull();
    });
    
    it('should expire insights after TTL (5 minutes)', () => {
      const dataHash = 'test-hash-123';
      const insights = [{ type: 'correlation' }];
      
      service.cacheInsights(dataHash, insights);
      
      // Manually expire cache by manipulating time
      const cacheEntry = (service as any).insightCache.get(dataHash);
      cacheEntry.timestamp = Date.now() - (6 * 60 * 1000); // 6 minutes ago
      
      const cached = service.getCachedInsights(dataHash);
      expect(cached).toBeNull();
    });
    
    it('should not expire insights before TTL', () => {
      const dataHash = 'test-hash-123';
      const insights = [{ type: 'correlation' }];
      
      service.cacheInsights(dataHash, insights);
      
      // Set timestamp to 4 minutes ago (within 5-minute TTL)
      const cacheEntry = (service as any).insightCache.get(dataHash);
      cacheEntry.timestamp = Date.now() - (4 * 60 * 1000);
      
      const cached = service.getCachedInsights(dataHash);
      expect(cached).toEqual(insights);
    });
  });
  
  describe('forecast caching', () => {
    it('should cache and retrieve forecasts', () => {
      const cacheKey = 'forecast-sales-2024';
      const forecast = {
        predictions: [100, 110, 120],
        accuracy: 0.95
      };
      
      service.cacheForecast(cacheKey, forecast);
      const cached = service.getCachedForecast(cacheKey);
      
      expect(cached).toEqual(forecast);
    });
    
    it('should return null for non-existent forecast', () => {
      const cached = service.getCachedForecast('non-existent');
      expect(cached).toBeNull();
    });
    
    it('should not expire forecasts automatically', () => {
      const cacheKey = 'forecast-test';
      const forecast = { predictions: [1, 2, 3] };
      
      service.cacheForecast(cacheKey, forecast);
      
      // Set old timestamp (forecasts use key-based invalidation, no TTL)
      const cacheEntry = (service as any).forecastCache.get(cacheKey);
      cacheEntry.timestamp = Date.now() - (10 * 60 * 1000); // 10 minutes ago
      
      const cached = service.getCachedForecast(cacheKey);
      expect(cached).toEqual(forecast); // Should still be cached
    });
    
    it('should invalidate specific forecast', () => {
      const cacheKey1 = 'forecast-1';
      const cacheKey2 = 'forecast-2';
      const forecast1 = { predictions: [1, 2, 3] };
      const forecast2 = { predictions: [4, 5, 6] };
      
      service.cacheForecast(cacheKey1, forecast1);
      service.cacheForecast(cacheKey2, forecast2);
      
      service.invalidateForecast(cacheKey1);
      
      expect(service.getCachedForecast(cacheKey1)).toBeNull();
      expect(service.getCachedForecast(cacheKey2)).toEqual(forecast2);
    });
    
    it('should invalidate all forecasts', () => {
      service.cacheForecast('forecast-1', { predictions: [1] });
      service.cacheForecast('forecast-2', { predictions: [2] });
      
      service.invalidateAllForecasts();
      
      expect(service.getCachedForecast('forecast-1')).toBeNull();
      expect(service.getCachedForecast('forecast-2')).toBeNull();
    });
  });
  
  describe('cache invalidation', () => {
    it('should invalidate all caches', () => {
      service.cacheInsights('hash-1', [{ type: 'test' }]);
      service.cacheForecast('forecast-1', { predictions: [1] });
      
      service.invalidateAllCaches();
      
      expect(service.getCachedInsights('hash-1')).toBeNull();
      expect(service.getCachedForecast('forecast-1')).toBeNull();
    });
    
    it('should invalidate specific dataset on change', () => {
      const dataHash = 'hash-123';
      service.cacheInsights(dataHash, [{ type: 'test' }]);
      service.cacheForecast('forecast-1', { predictions: [1] });
      
      service.invalidateOnDatasetChange(dataHash);
      
      expect(service.getCachedInsights(dataHash)).toBeNull();
      expect(service.getCachedForecast('forecast-1')).toBeNull();
    });
    
    it('should invalidate all caches when no hash provided', () => {
      service.cacheInsights('hash-1', [{ type: 'test1' }]);
      service.cacheInsights('hash-2', [{ type: 'test2' }]);
      service.cacheForecast('forecast-1', { predictions: [1] });
      
      service.invalidateOnDatasetChange();
      
      expect(service.getCachedInsights('hash-1')).toBeNull();
      expect(service.getCachedInsights('hash-2')).toBeNull();
      expect(service.getCachedForecast('forecast-1')).toBeNull();
    });
  });
  
  describe('cache statistics', () => {
    it('should return empty stats for empty cache', () => {
      const stats = service.getCacheStats();
      
      expect(stats.insightCacheSize).toBe(0);
      expect(stats.forecastCacheSize).toBe(0);
      expect(stats.totalEntries).toBe(0);
    });
    
    it('should return correct cache sizes', () => {
      service.cacheInsights('hash-1', [{ type: 'test1' }]);
      service.cacheInsights('hash-2', [{ type: 'test2' }]);
      service.cacheForecast('forecast-1', { predictions: [1] });
      
      const stats = service.getCacheStats();
      
      expect(stats.insightCacheSize).toBe(2);
      expect(stats.forecastCacheSize).toBe(1);
      expect(stats.totalEntries).toBe(3);
    });
  });
  
  describe('cleanup expired insights', () => {
    it('should remove expired insight entries', () => {
      service.cacheInsights('hash-1', [{ type: 'test1' }]);
      service.cacheInsights('hash-2', [{ type: 'test2' }]);
      
      // Expire first entry
      const cache = (service as any).insightCache;
      const entry1 = cache.get('hash-1');
      entry1.timestamp = Date.now() - (6 * 60 * 1000); // 6 minutes ago
      
      service.cleanupExpiredInsights();
      
      expect(service.getCachedInsights('hash-1')).toBeNull();
      expect(service.getCachedInsights('hash-2')).toBeTruthy();
    });
    
    it('should keep non-expired entries during cleanup', () => {
      service.cacheInsights('hash-1', [{ type: 'test1' }]);
      service.cacheInsights('hash-2', [{ type: 'test2' }]);
      
      service.cleanupExpiredInsights();
      
      expect(service.getCachedInsights('hash-1')).toBeTruthy();
      expect(service.getCachedInsights('hash-2')).toBeTruthy();
    });
  });
  
  describe('edge cases', () => {
    it('should handle multiple cache operations on same key', () => {
      const dataHash = 'hash-123';
      const insights1 = [{ type: 'correlation', confidence: 80 }];
      const insights2 = [{ type: 'outlier', confidence: 90 }];
      
      service.cacheInsights(dataHash, insights1);
      service.cacheInsights(dataHash, insights2);
      
      const cached = service.getCachedInsights(dataHash);
      expect(cached).toEqual(insights2); // Should get latest
    });
    
    it('should handle caching of empty arrays', () => {
      service.cacheInsights('hash-empty', []);
      const cached = service.getCachedInsights('hash-empty');
      
      expect(cached).toEqual([]);
    });
    
    it('should handle special characters in cache keys', () => {
      const specialKey = 'forecast-key-with-special!@#$%^&*()';
      const forecast = { predictions: [1, 2, 3] };
      
      service.cacheForecast(specialKey, forecast);
      const cached = service.getCachedForecast(specialKey);
      
      expect(cached).toEqual(forecast);
    });
  });
});
