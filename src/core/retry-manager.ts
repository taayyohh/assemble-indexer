import type {
  RetryOptions,
  CircuitBreakerState,
  AsyncRetryFunction,
  BackoffOptions,
  Logger
} from '../types';

export class RetryManager {
  private readonly options: RetryOptions;
  private readonly circuitBreakerStates = new Map<string, CircuitBreakerState>();
  private readonly circuitBreakerThreshold: number;
  private readonly circuitBreakerTimeout: number;
  private readonly logger: Logger;

  constructor(
    options: RetryOptions,
    circuitBreakerThreshold: number = 5,
    circuitBreakerTimeout: number = 60000, // 1 minute
    logger: Logger
  ) {
    this.options = options;
    this.circuitBreakerThreshold = circuitBreakerThreshold;
    this.circuitBreakerTimeout = circuitBreakerTimeout;
    this.logger = logger;
  }

  async executeWithRetry<T>(
    fn: AsyncRetryFunction<T>,
    context: string,
    chainId?: number
  ): Promise<T> {
    const circuitKey = `${context}${chainId ? `-${chainId}` : ''}`;

    if (this.isCircuitBreakerOpen(circuitKey)) {
      const state = this.circuitBreakerStates.get(circuitKey)!;
      const timeUntilReset = state.nextAttemptTime!.getTime() - Date.now();
      
      this.logger.warn(`Circuit breaker is open for ${context}`, {
        context,
        chainId,
        timeUntilResetMs: timeUntilReset
      });

      throw new Error(`Circuit breaker is open for ${context}. Try again in ${Math.ceil(timeUntilReset / 1000)}s`);
    }

    let lastError: Error;
    
    for (let attempt = 0; attempt <= this.options.maxRetries; attempt++) {
      try {
        if (attempt > 0) {
          const delay = this.calculateBackoff(attempt, {
            factor: 2,
            jitter: this.options.jitter,
            maxDelay: this.options.maxDelay
          });
          
          this.logger.debug(`Retrying ${context} (attempt ${attempt}/${this.options.maxRetries})`, {
            context,
            chainId,
            attempt,
            delayMs: delay
          });
          
          await this.sleep(delay);
        }

        const result = await fn();
        this.resetCircuitBreaker(circuitKey);
        
        if (attempt > 0) {
          this.logger.info(`Successfully retried ${context} after ${attempt} attempts`, {
            context,
            chainId,
            attempts: attempt
          });
        }
        
        return result;
        
      } catch (error) {
        lastError = error as Error;
        
        this.logger.warn(`Attempt ${attempt + 1} failed for ${context}`, {
          context,
          chainId,
          attempt: attempt + 1,
          error: lastError.message,
          retryable: this.isRetryableError(lastError)
        });

        if (!this.isRetryableError(lastError)) {
          this.recordCircuitBreakerFailure(circuitKey);
          throw lastError;
        }

        if (attempt === this.options.maxRetries) {
          this.recordCircuitBreakerFailure(circuitKey);
          break;
        }
      }
    }

    this.logger.error(`All retry attempts exhausted for ${context}`, {
      context,
      chainId,
      maxRetries: this.options.maxRetries,
      finalError: lastError!.message
    });

    throw lastError!;
  }

  private calculateBackoff(attempt: number, options: BackoffOptions): number {
    const exponentialDelay = this.options.baseDelay * Math.pow(options.factor, attempt - 1);
    let delay = Math.min(exponentialDelay, options.maxDelay);
    
    if (options.jitter) {
      const jitterAmount = delay * 0.25;
      const jitter = (Math.random() - 0.5) * 2 * jitterAmount;
      delay = Math.max(0, delay + jitter);
    }
    
    return Math.floor(delay);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private isRetryableError(error: Error): boolean {
    const retryableMessages = [
      'ETIMEDOUT',
      'ECONNRESET',
      'ENOTFOUND',
      'ECONNREFUSED',
      'socket hang up',
      'timeout',
      'rate limit',
      'too many requests',
      'service unavailable',
      'internal server error',
      'bad gateway',
      'gateway timeout'
    ];

    const message = error.message.toLowerCase();
    return retryableMessages.some(retryable => message.includes(retryable));
  }

  private isCircuitBreakerOpen(circuitKey: string): boolean {
    const state = this.circuitBreakerStates.get(circuitKey);
    
    if (!state || !state.isOpen) {
      return false;
    }

    if (state.nextAttemptTime && Date.now() >= state.nextAttemptTime.getTime()) {
      state.isOpen = false;
      state.nextAttemptTime = undefined;
      this.logger.info(`Circuit breaker entering half-open state`, { circuitKey });
      return false;
    }

    return true;
  }

  private recordCircuitBreakerFailure(circuitKey: string): void {
    const state = this.circuitBreakerStates.get(circuitKey) || {
      isOpen: false,
      failureCount: 0
    };

    state.failureCount++;
    state.lastFailureTime = new Date();

    if (state.failureCount >= this.circuitBreakerThreshold) {
      state.isOpen = true;
      state.nextAttemptTime = new Date(Date.now() + this.circuitBreakerTimeout);
      
      this.logger.error(`Circuit breaker opened`, {
        circuitKey,
        failureCount: state.failureCount,
        threshold: this.circuitBreakerThreshold,
        nextAttemptTime: state.nextAttemptTime
      });
    }

    this.circuitBreakerStates.set(circuitKey, state);
  }

  private resetCircuitBreaker(circuitKey: string): void {
    const state = this.circuitBreakerStates.get(circuitKey);
    
    if (state && (state.failureCount > 0 || state.isOpen)) {
      this.logger.info(`Circuit breaker reset`, {
        circuitKey,
        previousFailureCount: state.failureCount
      });
      
      this.circuitBreakerStates.set(circuitKey, {
        isOpen: false,
        failureCount: 0
      });
    }
  }

  getCircuitBreakerStatus(): Map<string, CircuitBreakerState> {
    return new Map(this.circuitBreakerStates);
  }

  resetCircuitBreakerManually(circuitKey: string): void {
    this.circuitBreakerStates.delete(circuitKey);
    this.logger.info(`Circuit breaker manually reset`, { circuitKey });
  }
} 