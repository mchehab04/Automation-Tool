import { closeDbPool } from "./db-helper";

// db-helper's pg Pool is a module-level singleton, shared by every spec file
// that imports it within a worker process — closed exactly once here, after
// the whole run, rather than per-file (which would close it out from under
// whichever spec file runs later in the same worker).
export default async function globalTeardown() {
  await closeDbPool();
}
