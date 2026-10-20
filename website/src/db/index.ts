import "server-only";
import postgres from "postgres";
import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import * as schema from "./schema";
import { env } from "@/lib/env";

type DB = PostgresJsDatabase<typeof schema>;
const g = globalThis as unknown as { __aurorasDb?: { db: DB; sql: postgres.Sql } };

export function getDb(): DB {
  if (!g.__aurorasDb) {
    const e = env();
    const ssl = e.DATABASE_SSL ?? (e.APP_ENV === "production" ? "require" : "disable");
    const client = postgres(e.DATABASE_URL, { max: e.DATABASE_POOL_MAX, ssl: ssl === "disable" ? false : ssl, idle_timeout: 30, connect_timeout: 10, prepare: true });
    g.__aurorasDb = { db: drizzle(client, { schema }), sql: client };
  }
  return g.__aurorasDb.db;
}
export type Tx = Parameters<Parameters<DB["transaction"]>[0]>[0];
export async function closeDb() { if (g.__aurorasDb) { await g.__aurorasDb.sql.end({ timeout: 5 }); g.__aurorasDb = undefined; } }
export { schema };
