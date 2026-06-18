const TRANSIENT_STATUS_CODES = new Set([408, 429, 500, 502, 503, 504]);
const TRANSIENT_ERROR_CODES = new Set(["ECONNRESET", "ECONNREFUSED", "EPIPE", "ETIMEDOUT", "EAI_AGAIN", "UND_ERR_SOCKET"]);
const TRANSIENT_MESSAGE_PATTERN = /terminated|fetch failed|network|socket|timed?\s*out|connection.*(?:closed|reset)/i;

function isTransientNetworkError(error) {
  if (!error) return false;
  if (TRANSIENT_STATUS_CODES.has(Number(error.status))) return true;
  if (TRANSIENT_ERROR_CODES.has(error.code)) return true;
  if (TRANSIENT_MESSAGE_PATTERN.test(String(error.message || error))) return true;
  return error.cause ? isTransientNetworkError(error.cause) : false;
}

function defaultSleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function retryTransient(task, options = {}) {
  const maxRetries = options.maxRetries ?? 3;
  const sleep = options.sleep || defaultSleep;

  for (let attempt = 0; ; attempt += 1) {
    try {
      return await task();
    } catch (error) {
      if (attempt >= maxRetries || !isTransientNetworkError(error)) {
        throw error;
      }

      const retry = attempt + 1;
      if (typeof options.onRetry === "function") {
        await options.onRetry({ error, retry, maxRetries });
      }
      await sleep(Math.min(2000, 500 * 2 ** attempt));
    }
  }
}

module.exports = { isTransientNetworkError, retryTransient };
