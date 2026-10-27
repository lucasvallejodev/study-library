/** Runs once when the server starts: apply migrations, sync the index with library/, resume jobs. */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { migrateDatabase, getDb, reindexLibrary } = await import("@study/core/db");
  const { recoverJobs } = await import("./lib/jobs");
  try {
    await migrateDatabase();
    const { indexed, removed } = await reindexLibrary(getDb());
    console.log(`[study-library] DB ready; indexed ${indexed.length} documents${removed.length ? `, removed ${removed.length}` : ""}`);
    await recoverJobs();
  } catch (e) {
    console.error("[study-library] startup failed:", e);
  }
}
