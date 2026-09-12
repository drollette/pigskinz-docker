/**
 * Retries a transient failure once after a short delay before giving up.
 * SQLite can throw SQLITE_BUSY under write contention (WAL mode allows
 * concurrent readers with one writer, but a reader can still momentarily
 * lose a race); a second attempt a moment later routinely succeeds where a
 * user-facing page previously had to be manually refreshed to recover.
 * Anything that fails twice in a row is treated as a real error, not flakiness.
 */
export async function withRetry<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    console.error("Retrying after transient failure:", error);
    await new Promise((resolve) => setTimeout(resolve, 250));
    return fn();
  }
}
