import "server-only";
import { Pool } from "pg";

// Lakebase Postgres on Neon. The app runs as a long-lived Node server (`next start`), so node-postgres with a
// reused pool over the pooled connection string (`DATABASE_URL`, `-pooler` host) is the recommended driver.
// Migrations use DATABASE_URL_UNPOOLED (see scripts/migrate-auth.mjs).
const g = globalThis as unknown as { __sokoPool?: Pool };

export function pool(): Pool {
  if (!g.__sokoPool) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) throw new Error("DATABASE_URL is not set. Run `neon env pull`.");
    // Neon requires TLS. Pin pg's current (secure) meaning of sslmode=require explicitly.
    const url = connectionString.replace(/sslmode=(require|prefer|verify-ca)\b/, "sslmode=verify-full");
    g.__sokoPool = new Pool({ connectionString: url, max: 10, idleTimeoutMillis: 30_000 });
  }
  return g.__sokoPool;
}
