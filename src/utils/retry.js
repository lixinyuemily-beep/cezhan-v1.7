const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export async function retryAsync(task, options = {}) {
  const retries = Math.max(1, Number(options.retries || 3));
  const delayMs = Math.max(0, Number(options.delayMs || 1200));
  const label = options.label || 'async task';
  let lastError;

  for (let attempt = 1; attempt <= retries; attempt += 1) {
    try {
      const result = await task(attempt);
      if (options.shouldRetryResult?.(result) && attempt < retries) {
        lastError = new Error(`${label} returned retryable empty result`);
      } else {
        return result;
      }
    } catch (error) {
      lastError = error;
      if (attempt >= retries) break;
    }

    console.warn(`${label} failed, retrying (${attempt}/${retries})`, lastError);
    await wait(delayMs * attempt);
  }

  throw lastError;
}
