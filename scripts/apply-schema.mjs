// One-off: apply supabase/schema.sql to the Postgres DB. Connection comes from
// PG* env vars so the same script works for the direct host or the IPv4 pooler.
import pg from "pg";
import { readFileSync } from "node:fs";

const { Client } = pg;
const file = process.env.SQL_FILE || "../supabase/schema.sql";
const sql = readFileSync(new URL(file, import.meta.url), "utf8");

const client = new Client({
  host: process.env.PGHOST,
  port: Number(process.env.PGPORT || 5432),
  user: process.env.PGUSER,
  password: process.env.PGPASSWORD,
  database: process.env.PGDATABASE || "postgres",
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 15000,
});

try {
  await client.connect();
  await client.query(sql);
  console.log(`SQL APPLIED ✓  (${file})`);
} catch (e) {
  console.error("CONNECT/APPLY FAILED:", e.code || "", e.message);
  process.exitCode = 1;
} finally {
  await client.end().catch(() => {});
}
