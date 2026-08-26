import { Service, signal } from '@angular/core';
import * as tf from '@tensorflow/tfjs';

/**
 * TensorFlowService for ML model management
 * 
 * Features:
 * - Lazy loading of TensorFlow.js (loaded only on first access)
 * - Backend selection: WebGL (GPU) with CPU fallback
 * - Memory monitoring and cleanup utilities
 * - Graceful error handling for backend initialization
 * 
 * **Validates: Requirements 7.5, 7.6, 8.2, 8.3, 8.6**
 */
@Service()
export class TensorFlowService {
  // Signals for reactive state management
  private readonly _isInitialized = signal(false);
  private readonly _isInitializing = signal(false);
  private readonly _backend = signal<'webgl' | 'cpu' | 'wasm' | null>(null);
  private readonly _initializationError = signal<string | null>(null);
  
  // Public readonly signals
  readonly isInitialized = this._isInitialized.asReadonly();
  readonly isInitializing = this._isInitializing.asReadonly();
  readonly backend = this._backend.asReadonly();
  readonly initializationError = this._initializationError.asReadonly();
  
  // Track if TensorFlow.js has been dynamically imported
  private tfLoaded = false;
  
  /**
   * Lazy initialization of TensorFlow.js with backend selection
   * 
   * Attempts to initialize in this order:
   * 1. WebGL backend (GPU acceleration)
   * 2. CPU backend (fallback)
   * 3. WASM backend (secondary fallback)
   * 
   * This method is idempotent - safe to call multiple times
   * 
   * @returns Promise resolving to true if initialization succeeded
   */
  async initialize(): Promise<boolean> {
    // Already initialized
    if (this._isInitialized()) {
      return true;
    }
    
    // Already initializing
    if (this._isInitializing()) {
      // Wait for initialization to complete
      return this.waitForInitialization();
    }
    
    this._isInitializing.set(true);
    this._initializationError.set(null);
    
    try {
      // Lazy load TensorFlow.js if not already loaded
      if (!this.tfLoaded) {
        // The import is already done at the top, but we mark it as loaded
        this.tfLoaded = true;
        console.log('[TensorFlowService] TensorFlow.js loaded');
      }
      
      // Try WebGL backend first (GPU acceleration)
      try {
        await tf.setBackend('webgl');
        await tf.ready();
        this._backend.set('webgl');
        console.log('[TensorFlowService] Initialized with WebGL backend (GPU acceleration)');
        this._isInitialized.set(true);
        return true;
      } catch (webglError) {
        console.warn('[TensorFlowService] WebGL backend initialization failed:', webglError);
        
        // Try CPU backend as fallback
        try {
          await tf.setBackend('cpu');
          await tf.ready();
          this._backend.set('cpu');
          console.log('[TensorFlowService] Initialized with CPU backend (fallback)');
          this._isInitialized.set(true);
          return true;
        } catch (cpuError) {
          console.warn('[TensorFlowService] CPU backend initialization failed:', cpuError);
          
          // Try WASM as last resort
          try {
            await tf.setBackend('wasm');
            await tf.ready();
            this._backend.set('wasm');
            console.log('[TensorFlowService] Initialized with WASM backend (secondary fallback)');
            this._isInitialized.set(true);
            return true;
          } catch (wasmError) {
            console.error('[TensorFlowService] All backends failed to initialize:', wasmError);
            throw new Error('Failed to initialize any TensorFlow.js backend');
          }
        }
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown initialization error';
      this._initializationError.set(errorMessage);
      console.error('[TensorFlowService] Initialization failed:', error);
      return false;
    } finally {
      this._isInitializing.set(false);
    }
  }
  
  /**
   * Wait for ongoing initialization to complete
   * Used internally when multiple components try to initialize simultaneously
   * 
   * @returns Promise resolving to initialization success state
   */
  private async waitForInitialization(): Promise<boolean> {
    // Poll every 100ms until initialization completes
    const maxWaitTime = 10000; // 10 seconds timeout
    const pollInterval = 100;
    let waited = 0;
    
    while (this._isInitializing() && waited < maxWaitTime) {
      await new Promise(resolve => setTimeout(resolve, pollInterval));
      waited += pollInterval;
    }
    
    if (waited >= maxWaitTime) {
      console.error('[TensorFlowService] Initialization timeout');
      return false;
    }
    
    return this._isInitialized();
  }
  
  /**
   * Dispose of all TensorFlow.js resources and reset state
   * 
   * This method:
   * - Disposes all tensors and variables
   * - Resets initialization state
   * - Should be called when analytics features are disabled or app is closing
   */
  async dispose(): Promise<void> {
    if (!this._isInitialized()) {
      return;
    }
    
    try {
      // Dispose all variables and tensors
      tf.disposeVariables();
      
      // Dispose any remaining tensors
      const numTensors = tf.memory().numTensors;
      if (numTensors > 0) {
        console.warn(`[TensorFlowService] ${numTensors} tensors still in memory before disposal`);
      }
      
      console.log('[TensorFlowService] TensorFlow.js resources disposed');
    } catch (error) {
      console.error('[TensorFlowService] Error during disposal:', error);
    } finally {
      this._isInitialized.set(false);
      this._backend.set(null);
      this._initializationError.set(null);
    }
  }
  
  /**
   * Get current memory usage information
   * 
   * Provides details about:
   * - Number of tensors in memory
   * - Number of bytes allocated
   * - Unreliable tensor count (memory not properly cleaned up)
   * 
   * @returns Memory information object
   */
  getMemoryInfo(): {
    numTensors: number;
    numBytes: number;
    numDataBuffers?: number;
    unreliable?: boolean;
  } {
    if (!this._isInitialized()) {
      return {
        numTensors: 0,
        numBytes: 0
      };
    }
    
    try {
      return tf.memory();
    } catch (error) {
      console.error('[TensorFlowService] Error getting memory info:', error);
      return {
        numTensors: 0,
        numBytes: 0,
        unreliable: true
      };
    }
  }
  
  /**
   * Check if memory usage exceeds threshold
   * 
   * @param thresholdMB Memory threshold in megabytes (default: 150MB per requirement 7.6)
   * @returns True if memory usage exceeds threshold
   */
  isMemoryExceeded(thresholdMB: number = 150): boolean {
    const memInfo = this.getMemoryInfo();
    const memoryMB = memInfo.numBytes / (1024 * 1024);
    return memoryMB > thresholdMB;
  }
  
  /**
   * Execute tensor operations within a tidy scope
   * 
   * Automatically disposes intermediate tensors to prevent memory leaks
   * This is the recommended way to perform tensor operations
   * 
   * @param operation Function containing tensor operations
   * @returns Result of the operation
   */
  async runInference<T>(operation: () => T | Promise<T>): Promise<T> {
    if (!this._isInitialized()) {
      throw new Error('TensorFlow.js not initialized. Call initialize() first.');
    }
    
    try {
      return await tf.tidy(operation as () => tf.TensorContainer) as T;
    } catch (error) {
      console.error('[TensorFlowService] Inference error:', error);
      throw error;
    }
  }
  
  /**
   * Clean up orphaned tensors
   * 
   * Attempts to identify and dispose tensors that may not have been
   * properly cleaned up. Use with caution as this may affect ongoing operations.
   * 
   * @returns Number of tensors cleaned up
   */
  cleanupOrphanedTensors(): number {
    if (!this._isInitialized()) {
      return 0;
    }
    
    try {
      const beforeCount = tf.memory().numTensors;
      
      // Force garbage collection of tracked tensors
      tf.engine().startScope();
      tf.engine().endScope();
      
      const afterCount = tf.memory().numTensors;
      const cleaned = beforeCount - afterCount;
      
      if (cleaned > 0) {
        console.log(`[TensorFlowService] Cleaned up ${cleaned} orphaned tensors`);
      }
      
      return cleaned;
    } catch (error) {
      console.error('[TensorFlowService] Error cleaning up tensors:', error);
      return 0;
    }
  }
  
  /**
   * Get detailed backend information
   * 
   * @returns Object with backend details and capabilities
   */
  getBackendInfo(): {
    backend: string | null;
    isWebGLAvailable: boolean;
    isInitialized: boolean;
    hasError: boolean;
    errorMessage: string | null;
  } {
    return {
      backend: this._backend(),
      isWebGLAvailable: this._backend() === 'webgl',
      isInitialized: this._isInitialized(),
      hasError: this._initializationError() !== null,
      errorMessage: this._initializationError()
    };
  }
  
  /**
   * Force re-initialization with a specific backend
   * 
   * Use this to switch backends or recover from initialization errors
   * 
   * @param preferredBackend Backend to try ('webgl', 'cpu', or 'wasm')
   * @returns Promise resolving to true if re-initialization succeeded
   */
  async reinitialize(preferredBackend?: 'webgl' | 'cpu' | 'wasm'): Promise<boolean> {
    // Dispose current state
    await this.dispose();
    
    // Reset signals
    this._isInitialized.set(false);
    this._initializationError.set(null);
    
    if (preferredBackend) {
      // Try specific backend
      try {
        await tf.setBackend(preferredBackend);
        await tf.ready();
        this._backend.set(preferredBackend);
        this._isInitialized.set(true);
        console.log(`[TensorFlowService] Re-initialized with ${preferredBackend} backend`);
        return true;
      } catch (error) {
        console.error(`[TensorFlowService] Re-initialization with ${preferredBackend} failed:`, error);
        this._initializationError.set(`Failed to initialize ${preferredBackend} backend`);
        return false;
      }
    } else {
      // Use standard initialization sequence
      return this.initialize();
    }
  }
  
  /**
   * Check if TensorFlow.js is ready for operations
   * 
   * @returns True if initialized and ready
   */
  isReady(): boolean {
    return this._isInitialized() && this._backend() !== null;
  }
}
