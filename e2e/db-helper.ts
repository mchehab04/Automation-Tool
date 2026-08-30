// Playwright's test-file loader runs test files as CJS, but Prisma 7's
// generated client (`@/generated/prisma/client`) is ESM-only — it uses
// `import.meta` internally — so importing `@/lib/db` directly from a test
// file fails with "Cannot use 'import.meta' outside a module". Not fixing
// this by adding `"type": "module"` to the root package.json — that's a
// deliberate choice this project already made (report 08) since nothing else
// needs it. Raw `pg` queries sidestep the generated client entirely for the
// handful of read/cleanup operations these tests need.
import "dotenv/config";
import { setDefaultResultOrder } from "node:dns";
import { Pool } from "pg";

setDefaultResultOrder("ipv4first");

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

export async function deleteLeadsByEmail(email: string) {
  await pool.query('DELETE FROM "Lead" WHERE "email" = $1', [email]);
}

export async function deleteLeadsByPhone(phone: string) {
  await pool.query('DELETE FROM "Lead" WHERE "phone" = $1', [phone]);
}

export async function deleteCatalogItemsByDescriptionPrefix(prefix: string) {
  await pool.query('DELETE FROM "ServiceCatalogItem" WHERE "description" LIKE $1', [`${prefix}%`]);
}

export async function getLeadByEmail(email: string) {
  const res = await pool.query('SELECT * FROM "Lead" WHERE "email" = $1 LIMIT 1', [email]);
  return res.rows[0] ?? null;
}

export async function getBusinessAddress(businessId: string): Promise<string | null> {
  const res = await pool.query('SELECT "address" FROM "Business" WHERE "id" = $1', [businessId]);
  return res.rows[0]?.address ?? null;
}

export async function getCatalogItemByDescription(description: string) {
  const res = await pool.query(
    'SELECT * FROM "ServiceCatalogItem" WHERE "description" = $1 LIMIT 1',
    [description],
  );
  return res.rows[0] ?? null;
}

export async function closeDbPool() {
  await pool.end();
}
