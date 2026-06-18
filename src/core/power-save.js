async function runWithPowerSaveBlocker(powerSaveBlocker, task) {
  const blockerId = powerSaveBlocker.start("prevent-app-suspension");
  try {
    return await task();
  } finally {
    try {
      if (typeof powerSaveBlocker.isStarted !== "function" || powerSaveBlocker.isStarted(blockerId)) {
        powerSaveBlocker.stop(blockerId);
      }
    } catch {
      // Releasing the OS hint must not hide the result of the sync operation.
    }
  }
}

module.exports = { runWithPowerSaveBlocker };
