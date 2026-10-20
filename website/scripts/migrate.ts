// Applies database migrations (drizzle/*.sql) in order, inside transactions. Safe to run on every deploy.
// Usage: DATABASE_URL=... npm run db:migrate
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import path from "node:path";

const url = process.env.DATABASE_URL;
if (!url) { console.error("DATABASE_URL is not set"); process.exit(2); }
const ssl = process.env.DATABASE_SSL ?? (process.env.APP_ENV === "production" ? "require" : "disable");
const sql = postgres(url, { max: 1, ssl: ssl === "disable" ? false : (ssl as "require" | "prefer"), onnotice: () => {} });
migrate(drizzle(sql), { migrationsFolder: path.join(__dirname, "..", "drizzle") })
  .then(() => { console.log("Migrations applied."); return sql.end(); })
  .catch(async (e) => { console.error("Migration failed:", e.message); await sql.end(); process.exit(1); });
