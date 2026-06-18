const assert = require("node:assert/strict");
const test = require("node:test");

const { runWithPowerSaveBlocker } = require("../src/core/power-save");
const { retryTransient } = require("../src/core/network-retry");

test("runWithPowerSaveBlocker prevents suspension until the task finishes", async () => {
  const calls = [];
  const blocker = {
    start(type) {
      calls.push(["start", type]);
      return 42;
    },
    stop(id) {
      calls.push(["stop", id]);
      return true;
    },
  };

  const result = await runWithPowerSaveBlocker(blocker, async () => {
    calls.push(["task"]);
    return "done";
  });

  assert.equal(result, "done");
  assert.deepEqual(calls, [
    ["start", "prevent-app-suspension"],
    ["task"],
    ["stop", 42],
  ]);
});

test("runWithPowerSaveBlocker releases the blocker after failure", async () => {
  const stopped = [];
  const blocker = {
    start() {
      return 7;
    },
    stop(id) {
      stopped.push(id);
      return true;
    },
  };

  await assert.rejects(
    runWithPowerSaveBlocker(blocker, async () => {
      throw new Error("terminated");
    }),
    /terminated/
  );
  assert.deepEqual(stopped, [7]);
});

test("retryTransient retries a terminated request up to three times", async () => {
  let attempts = 0;
  const retries = [];

  const result = await retryTransient(
    async () => {
      attempts += 1;
      if (attempts < 4) {
        throw new TypeError("terminated");
      }
      return "downloaded";
    },
    {
      maxRetries: 3,
      sleep: async () => {},
      onRetry: (details) => retries.push(details.retry),
    }
  );

  assert.equal(result, "downloaded");
  assert.equal(attempts, 4);
  assert.deepEqual(retries, [1, 2, 3]);
});

test("retryTransient does not retry permanent GitHub errors", async () => {
  let attempts = 0;
  const error = new Error("Bad credentials");
  error.status = 401;

  await assert.rejects(
    retryTransient(
      async () => {
        attempts += 1;
        throw error;
      },
      { maxRetries: 3, sleep: async () => {} }
    ),
    /Bad credentials/
  );
  assert.equal(attempts, 1);
});
