export interface RetryOptions {
  maxRetries?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  random?: () => number;
  sleep?: (delayMs: number) => Promise<void>;
  getDelayMs?: (
    error: unknown,
    retryNumber: number,
    calculatedDelayMs: number
  ) => number;
  onRetry?: (error: unknown, retryNumber: number, delayMs: number) => void;
}

const defaultSleep = (delayMs: number) =>
  new Promise<void>(resolve => setTimeout(resolve, delayMs));

export function isTransientApiError(error: unknown): boolean {
  if (!error || typeof error !== "object" || !("status" in error)) {
    return false;
  }

  const status = Number(error.status);
  return status === 408 || status === 429 || (status >= 500 && status < 600);
}

export async function retryTransient<T>(
  operation: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const {
    maxRetries = 5,
    baseDelayMs = 1_000,
    maxDelayMs = 60_000,
    random = Math.random,
    sleep = defaultSleep,
    getDelayMs,
    onRetry,
  } = options;

  for (let attempt = 0; ; attempt++) {
    try {
      return await operation();
    } catch (error) {
      if (!isTransientApiError(error) || attempt >= maxRetries) {
        throw error;
      }

      const exponentialDelay = Math.min(maxDelayMs, baseDelayMs * 2 ** attempt);
      const calculatedDelayMs = Math.min(
        maxDelayMs,
        Math.round(exponentialDelay * (1 + random() * 0.25))
      );
      const retryNumber = attempt + 1;
      const delayMs = Math.min(
        maxDelayMs,
        Math.max(
          0,
          Math.round(
            getDelayMs?.(error, retryNumber, calculatedDelayMs) ??
              calculatedDelayMs
          )
        )
      );

      onRetry?.(error, retryNumber, delayMs);
      await sleep(delayMs);
    }
  }
}
