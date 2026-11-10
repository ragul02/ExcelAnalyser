import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { TensorFlowService } from './tensorflow.service';
import * as tf from '@tensorflow/tfjs';

// Mock TensorFlow.js
vi.mock('@tensorflow/tfjs', () => ({
  setBackend: vi.fn(),
  ready: vi.fn(),
  memory: vi.fn(),
  disposeVariables: vi.fn(),
  tidy: vi.fn((fn) => fn()),
  engine: vi.fn(() => ({
    startScope: vi.fn(),
    endScope: vi.fn()
  }))
}));

describe('TensorFlowService', () => {
  let service: TensorFlowService;
  
  beforeEach(() => {
    service = new TensorFlowService();
    vi.clearAllMocks();
  });
  
  afterEach(() => {
    vi.clearAllMocks();
  });
  
  describe('initialization', () => {
    it('should initialize with WebGL backend when available', async () => {
      // Mock successful WebGL initialization
      vi.mocked(tf.setBackend).mockResolvedValue(true);
      vi.mocked(tf.ready).mockResolvedValue();
      
      const result = await service.initialize();
      
      expect(result).toBe(true);
      expect(service.isInitialized()).toBe(true);
      expect(service.backend()).toBe('webgl');
      expect(tf.setBackend).toHaveBeenCalledWith('webgl');
    });
    
    it('should fallback to CPU when WebGL fails', async () => {
      // Mock WebGL failure, CPU success
      vi.mocked(tf.setBackend)
        .mockRejectedValueOnce(new Error('WebGL not available'))
        .mockResolvedValueOnce(true);
      vi.mocked(tf.ready).mockResolvedValue();
      
      const result = await service.initialize();
      
      expect(result).toBe(true);
      expect(service.isInitialized()).toBe(true);
      expect(service.backend()).toBe('cpu');
      expect(tf.setBackend).toHaveBeenCalledWith('webgl');
      expect(tf.setBackend).toHaveBeenCalledWith('cpu');
    });
    
    it('should fallback to WASM when WebGL and CPU fail', async () => {
      // Mock WebGL and CPU failure, WASM success
      vi.mocked(tf.setBackend)
        .mockRejectedValueOnce(new Error('WebGL not available'))
        .mockRejectedValueOnce(new Error('CPU not available'))
        .mockResolvedValueOnce(true);
      vi.mocked(tf.ready).mockResolvedValue();
      
      const result = await service.initialize();
      
      expect(result).toBe(true);
      expect(service.isInitialized()).toBe(true);
      expect(service.backend()).toBe('wasm');
    });
    
    it('should return false when all backends fail', async () => {
      // Mock all backends failing
      vi.mocked(tf.setBackend).mockRejectedValue(new Error('Backend not available'));
      
      const result = await service.initialize();
      
      expect(result).toBe(false);
      expect(service.isInitialized()).toBe(false);
      expect(service.initializationError()).toBeTruthy();
    });
    
    it('should be idempotent - multiple calls should not reinitialize', async () => {
      vi.mocked(tf.setBackend).mockResolvedValue(true);
      vi.mocked(tf.ready).mockResolvedValue();
      
      await service.initialize();
      await service.initialize();
      await service.initialize();
      
      // Should only call setBackend once (first initialization)
      expect(tf.setBackend).toHaveBeenCalledTimes(1);
    });
    
    it('should set isInitializing flag during initialization', async () => {
      vi.mocked(tf.setBackend).mockImplementation(() => {
        expect(service.isInitializing()).toBe(true);
        return Promise.resolve(true);
      });
      vi.mocked(tf.ready).mockResolvedValue();
      
      await service.initialize();
      
      expect(service.isInitializing()).toBe(false);
    });
  });
  
  describe('disposal', () => {
    it('should dispose TensorFlow resources', async () => {
      // Initialize first
      vi.mocked(tf.setBackend).mockResolvedValue(true);
      vi.mocked(tf.ready).mockResolvedValue();
      vi.mocked(tf.memory).mockReturnValue({ numTensors: 0, numBytes: 0, numDataBuffers: 0, reasons: [] });
      
      await service.initialize();
      await service.dispose();
      
      expect(tf.disposeVariables).toHaveBeenCalled();
      expect(service.isInitialized()).toBe(false);
      expect(service.backend()).toBe(null);
    });
    
    it('should handle disposal when not initialized', async () => {
      await service.dispose();
      
      expect(tf.disposeVariables).not.toHaveBeenCalled();
      expect(service.isInitialized()).toBe(false);
    });
    
    it('should handle disposal errors gracefully', async () => {
      vi.mocked(tf.setBackend).mockResolvedValue(true);
      vi.mocked(tf.ready).mockResolvedValue();
      vi.mocked(tf.memory).mockReturnValue({ numTensors: 0, numBytes: 0, numDataBuffers: 0, reasons: [] });
      vi.mocked(tf.disposeVariables).mockImplementation(() => {
        throw new Error('Disposal error');
      });
      
      await service.initialize();
      await service.dispose();
      
      // Should still reset state even if disposal fails
      expect(service.isInitialized()).toBe(false);
    });
  });
  
  describe('memory management', () => {
    it('should return memory information when initialized', async () => {
      vi.mocked(tf.setBackend).mockResolvedValue(true);
      vi.mocked(tf.ready).mockResolvedValue();
      vi.mocked(tf.memory).mockReturnValue({
        numTensors: 10,
        numBytes: 1024000,
        numDataBuffers: 5,
        reasons: [],
      });
      
      await service.initialize();
      const memInfo = service.getMemoryInfo();
      
      expect(memInfo.numTensors).toBe(10);
      expect(memInfo.numBytes).toBe(1024000);
      expect(memInfo.numDataBuffers).toBe(5);
    });
    
    it('should return zero memory when not initialized', () => {
      const memInfo = service.getMemoryInfo();
      
      expect(memInfo.numTensors).toBe(0);
      expect(memInfo.numBytes).toBe(0);
    });
    
    it('should detect memory exceeded threshold', async () => {
      vi.mocked(tf.setBackend).mockResolvedValue(true);
      vi.mocked(tf.ready).mockResolvedValue();
      
      await service.initialize();
      
      // Test below threshold (150MB default)
      vi.mocked(tf.memory).mockReturnValue({
        numTensors: 10,
        numBytes: 100 * 1024 * 1024, // 100 MB
        numDataBuffers: 10,
        reasons: [],
      });
      expect(service.isMemoryExceeded()).toBe(false);
      
      // Test above threshold
      vi.mocked(tf.memory).mockReturnValue({
        numTensors: 100,
        numBytes: 200 * 1024 * 1024, // 200 MB
        numDataBuffers: 100,
        reasons: [],
      });
      expect(service.isMemoryExceeded()).toBe(true);
    });
    
    it('should support custom memory threshold', async () => {
      vi.mocked(tf.setBackend).mockResolvedValue(true);
      vi.mocked(tf.ready).mockResolvedValue();
      vi.mocked(tf.memory).mockReturnValue({
        numTensors: 10,
        numBytes: 100 * 1024 * 1024, // 100 MB
        numDataBuffers: 10,
        reasons: [],
      });
      
      await service.initialize();
      
      expect(service.isMemoryExceeded(50)).toBe(true);
      expect(service.isMemoryExceeded(150)).toBe(false);
    });
    
    it('should handle memory info errors gracefully', async () => {
      vi.mocked(tf.setBackend).mockResolvedValue(true);
      vi.mocked(tf.ready).mockResolvedValue();
      vi.mocked(tf.memory).mockImplementation(() => {
        throw new Error('Memory error');
      });
      
      await service.initialize();
      const memInfo = service.getMemoryInfo();
      
      expect(memInfo.unreliable).toBe(true);
      expect(memInfo.numTensors).toBe(0);
    });
  });
  
  describe('runInference', () => {
    it('should execute operations within tidy scope', async () => {
      vi.mocked(tf.setBackend).mockResolvedValue(true);
      vi.mocked(tf.ready).mockResolvedValue();
      vi.mocked(tf.tidy).mockImplementation((fn) => typeof fn === 'function' ? fn() as any : undefined as any);
      
      await service.initialize();
      
      const operation = vi.fn(() => 42);
      const result = await service.runInference(operation);
      
      expect(result).toBe(42);
      expect(tf.tidy).toHaveBeenCalled();
      expect(operation).toHaveBeenCalled();
    });
    
    it('should throw error when not initialized', async () => {
      const operation = () => 42;
      
      await expect(service.runInference(operation)).rejects.toThrow(
        'TensorFlow.js not initialized'
      );
    });
    
    it('should propagate operation errors', async () => {
      vi.mocked(tf.setBackend).mockResolvedValue(true);
      vi.mocked(tf.ready).mockResolvedValue();
      vi.mocked(tf.tidy).mockImplementation((fn) => typeof fn === 'function' ? fn() as any : undefined as any);
      
      await service.initialize();
      
      const operation = () => {
        throw new Error('Operation failed');
      };
      
      await expect(service.runInference(operation)).rejects.toThrow('Operation failed');
    });
    
    it('should support async operations', async () => {
      vi.mocked(tf.setBackend).mockResolvedValue(true);
      vi.mocked(tf.ready).mockResolvedValue();
      vi.mocked(tf.tidy).mockImplementation((fn) => typeof fn === 'function' ? fn() as any : undefined as any);
      
      await service.initialize();
      
      const operation = async () => {
        await new Promise(resolve => setTimeout(resolve, 10));
        return 'async result';
      };
      
      const result = await service.runInference(operation);
      expect(result).toBe('async result');
    });
  });
  
  describe('cleanupOrphanedTensors', () => {
    it('should clean up orphaned tensors', async () => {
      vi.mocked(tf.setBackend).mockResolvedValue(true);
      vi.mocked(tf.ready).mockResolvedValue();
      
      const mockEngine = {
        startScope: vi.fn(),
        endScope: vi.fn()
      };
      vi.mocked(tf.engine).mockReturnValue(mockEngine as any);
      
      // Mock memory showing tensors before and after cleanup
      vi.mocked(tf.memory)
        .mockReturnValueOnce({ numTensors: 10, numBytes: 1000, numDataBuffers: 10, reasons: [] })
        .mockReturnValueOnce({ numTensors: 5, numBytes: 500, numDataBuffers: 5, reasons: [] });
      
      await service.initialize();
      const cleaned = service.cleanupOrphanedTensors();
      
      expect(cleaned).toBe(5);
      expect(mockEngine.startScope).toHaveBeenCalled();
      expect(mockEngine.endScope).toHaveBeenCalled();
    });
    
    it('should return 0 when not initialized', () => {
      const cleaned = service.cleanupOrphanedTensors();
      expect(cleaned).toBe(0);
    });
    
    it('should handle cleanup errors gracefully', async () => {
      vi.mocked(tf.setBackend).mockResolvedValue(true);
      vi.mocked(tf.ready).mockResolvedValue();
      vi.mocked(tf.engine).mockImplementation(() => {
        throw new Error('Engine error');
      });
      
      await service.initialize();
      const cleaned = service.cleanupOrphanedTensors();
      
      expect(cleaned).toBe(0);
    });
  });
  
  describe('getBackendInfo', () => {
    it('should return backend information when initialized', async () => {
      vi.mocked(tf.setBackend).mockResolvedValue(true);
      vi.mocked(tf.ready).mockResolvedValue();
      
      await service.initialize();
      const info = service.getBackendInfo();
      
      expect(info.backend).toBe('webgl');
      expect(info.isWebGLAvailable).toBe(true);
      expect(info.isInitialized).toBe(true);
      expect(info.hasError).toBe(false);
      expect(info.errorMessage).toBe(null);
    });
    
    it('should return error information when initialization fails', async () => {
      vi.mocked(tf.setBackend).mockRejectedValue(new Error('All backends failed'));
      
      await service.initialize();
      const info = service.getBackendInfo();
      
      expect(info.backend).toBe(null);
      expect(info.isWebGLAvailable).toBe(false);
      expect(info.isInitialized).toBe(false);
      expect(info.hasError).toBe(true);
      expect(info.errorMessage).toBeTruthy();
    });
  });
  
  describe('reinitialize', () => {
    it('should reinitialize with default sequence', async () => {
      vi.mocked(tf.setBackend).mockResolvedValue(true);
      vi.mocked(tf.ready).mockResolvedValue();
      vi.mocked(tf.memory).mockReturnValue({ numTensors: 0, numBytes: 0, numDataBuffers: 0, reasons: [] });
      
      await service.initialize();
      const result = await service.reinitialize();
      
      expect(result).toBe(true);
      expect(tf.disposeVariables).toHaveBeenCalled();
    });
    
    it('should reinitialize with specific backend', async () => {
      vi.mocked(tf.setBackend).mockResolvedValue(true);
      vi.mocked(tf.ready).mockResolvedValue();
      vi.mocked(tf.memory).mockReturnValue({ numTensors: 0, numBytes: 0, numDataBuffers: 0, reasons: [] });
      
      await service.initialize();
      vi.clearAllMocks();
      
      const result = await service.reinitialize('cpu');
      
      expect(result).toBe(true);
      expect(service.backend()).toBe('cpu');
      expect(tf.setBackend).toHaveBeenCalledWith('cpu');
      expect(tf.setBackend).toHaveBeenCalledTimes(1);
    });
    
    it('should handle reinitialization failure', async () => {
      vi.mocked(tf.setBackend).mockResolvedValue(true);
      vi.mocked(tf.ready).mockResolvedValue();
      vi.mocked(tf.memory).mockReturnValue({ numTensors: 0, numBytes: 0, numDataBuffers: 0, reasons: [] });
      
      await service.initialize();
      
      // Mock failure on reinit
      vi.mocked(tf.setBackend).mockRejectedValue(new Error('Backend failed'));
      
      const result = await service.reinitialize('webgl');
      
      expect(result).toBe(false);
      expect(service.initializationError()).toBeTruthy();
    });
  });
  
  describe('isReady', () => {
    it('should return true when initialized with backend', async () => {
      vi.mocked(tf.setBackend).mockResolvedValue(true);
      vi.mocked(tf.ready).mockResolvedValue();
      
      await service.initialize();
      
      expect(service.isReady()).toBe(true);
    });
    
    it('should return false when not initialized', () => {
      expect(service.isReady()).toBe(false);
    });
    
    it('should return false when initialization failed', async () => {
      vi.mocked(tf.setBackend).mockRejectedValue(new Error('Failed'));
      
      await service.initialize();
      
      expect(service.isReady()).toBe(false);
    });
  });
  
  describe('concurrent initialization', () => {
    it('should handle concurrent initialization calls', async () => {
      vi.mocked(tf.setBackend).mockImplementation(() => {
        return new Promise(resolve => setTimeout(() => resolve(true), 100));
      });
      vi.mocked(tf.ready).mockResolvedValue();
      
      // Call initialize multiple times concurrently
      const results = await Promise.all([
        service.initialize(),
        service.initialize(),
        service.initialize()
      ]);
      
      // All should succeed
      results.forEach(result => expect(result).toBe(true));
      
      // But backend should only be set once
      expect(tf.setBackend).toHaveBeenCalledTimes(1);
    });
  });
});
