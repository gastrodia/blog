import { expect, test } from "bun:test";
import { isTransientApiError, retryTransient } from "../src/lib/retry";

async function captureRejection(promise: Promise<unknown>): Promise<unknown> {
  try {
    await promise;
    return undefined;
  } catch (error) {
    return error;
  }
}

test("retries 429 responses with exponential backoff", async () => {
  const error = Object.assign(new Error("quota"), { status: 429 });
  const delays: number[] = [];
  let attempts = 0;

  const result = await retryTransient(
    async () => {
      attempts++;
      if (attempts < 3) throw error;
      return "ok";
    },
    {
      maxRetries: 5,
      baseDelayMs: 1_000,
      maxDelayMs: 60_000,
      random: () => 0,
      sleep: async delayMs => {
        delays.push(delayMs);
      },
    }
  );

  expect(result).toBe("ok");
  expect(attempts).toBe(3);
  expect(delays).toEqual([1_000, 2_000]);
});

test("does not retry non-transient client errors", async () => {
  const error = Object.assign(new Error("bad request"), { status: 400 });
  let attempts = 0;

  const received = await captureRejection(
    retryTransient(async () => {
      attempts++;
      throw error;
    })
  );

  expect(received).toBe(error);
  expect(attempts).toBe(1);
  expect(isTransientApiError(error)).toBe(false);
});

test("preserves the original error after retry exhaustion", async () => {
  const error = Object.assign(new Error("unavailable"), { status: 503 });
  let attempts = 0;

  const received = await captureRejection(
    retryTransient(
      async () => {
        attempts++;
        throw error;
      },
      {
        maxRetries: 2,
        sleep: async () => {},
        random: () => 0,
      }
    )
  );

  expect(received).toBe(error);
  expect(attempts).toBe(3);
  expect(isTransientApiError({ status: 408 })).toBe(true);
  expect(isTransientApiError({ status: 429 })).toBe(true);
  expect(isTransientApiError({ status: 500 })).toBe(true);
});

test("caps jittered backoff at the configured maximum", async () => {
  const error = Object.assign(new Error("quota"), { status: 429 });
  const delays: number[] = [];
  let attempts = 0;

  await retryTransient(
    async () => {
      attempts++;
      if (attempts === 1) throw error;
      return "ok";
    },
    {
      baseDelayMs: 60_000,
      maxDelayMs: 60_000,
      random: () => 1,
      sleep: async delayMs => {
        delays.push(delayMs);
      },
    }
  );

  expect(delays).toEqual([60_000]);
});

test("allows transient errors to override the calculated delay", async () => {
  const error = Object.assign(new Error("quota"), { status: 429 });
  const delays: number[] = [];
  let attempts = 0;

  await retryTransient(
    async () => {
      attempts++;
      if (attempts === 1) throw error;
      return "ok";
    },
    {
      maxDelayMs: 65_000,
      random: () => 0,
      getDelayMs: (receivedError, _retryNumber, calculatedDelayMs) =>
        (receivedError as { status?: number }).status === 429
          ? 65_000
          : calculatedDelayMs,
      sleep: async delayMs => {
        delays.push(delayMs);
      },
    }
  );

  expect(delays).toEqual([65_000]);
});
