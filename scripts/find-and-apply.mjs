// Find which regional pooler hosts this project, then apply the schema there.
import pg from "pg";
import { readFileSync } from "node:fs";

const { Client } = pg;
const REF = "uxkntatyddbflsxpwjof";
const PASSWORD = process.env.PGPASSWORD;
const sql = readFileSync(new URL("../supabase/schema.sql", import.meta.url), "utf8");

const REGIONS = [
  "us-east-1", "us-east-2", "us-west-1", "us-west-2",
  "ap-south-1", "ap-southeast-1", "ap-southeast-2",
  "ap-northeast-1", "ap-northeast-2",
  "eu-central-1", "eu-west-1", "eu-west-2", "eu-west-3",
  "sa-east-1", "ca-central-1",
];
const PREFIXES = ["aws-0", "aws-1"];

async function tryConnect(host) {
  const client = new Client({
    host,
    port: 5432,
    user: `postgres.${REF}`,
    password: PASSWORD,
    database: "postgres",
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 8000,
    query_timeout: 20000,
  });
  await client.connect();
  return client;
}

for (const prefix of PREFIXES) {
  for (const region of REGIONS) {
    const host = `${prefix}-${region}.pooler.supabase.com`;
    let client;
    try {
      client = await tryConnect(host);
    } catch (e) {
      const msg = (e.message || "").toLowerCase();
      if (msg.includes("tenant") || e.code === "ENOTFOUND" || e.code === "ETIMEDOUT" || e.code === "ECONNREFUSED") {
        continue; // wrong region / unreachable — keep looking
      }
      console.error(`! ${host}: ${e.code || ""} ${e.message}`);
      continue;
    }
    // Found the project's region.
    try {
      await client.query(sql);
      const r = await client.query("select code, name from public.classes order by created_at");
      console.log(`REGION=${region} PREFIX=${prefix}`);
      console.log("SCHEMA APPLIED ✓  classes:", JSON.stringify(r.rows));
      await client.end();
      process.exit(0);
    } catch (e) {
      console.error(`Found region ${region} but apply failed:`, e.code || "", e.message);
      await client.end().catch(() => {});
      process.exit(1);
    }
  }
}
console.error("Could not locate the project in any known region pooler.");
process.exit(2);
