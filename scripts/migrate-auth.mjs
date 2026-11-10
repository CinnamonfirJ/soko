// Creates/updates the Better Auth tables (user, session, account, verification + phone-number fields)
// in Neon Postgres. Uses the direct (unpooled) connection, as recommended for migrations.
//   npm run db:migrate
import { betterAuth } from "better-auth";
import { phoneNumber } from "better-auth/plugins";
import { getMigrations } from "better-auth/db/migration";
import pg from "pg";
import { authPluginOptions } from "../lib/auth-options.mjs";

for (const f of [".env", ".env.local"]) { try { process.loadEnvFile(f); } catch {} }
const url = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
if (!url) { console.error("DATABASE_URL_UNPOOLED / DATABASE_URL not set. Run `neon env pull`."); process.exit(1); }

const db = new pg.Pool({ connectionString: url.replace(/sslmode=(require|prefer|verify-ca)\b/, "sslmode=verify-full"), max: 1 });
const config = {
  database: db,
  secret: process.env.BETTER_AUTH_SECRET || "migration-only",
  basePath: "/api/identity",
  plugins: [phoneNumber({ ...authPluginOptions, sendOTP: async () => {} })],
};
betterAuth(config);

const { toBeCreated, toBeAdded, runMigrations } = await getMigrations(config);
console.log("Tables to create:", toBeCreated.map((t) => t.table).join(", ") || "none");
console.log("Columns to add:", toBeAdded.map((t) => `${t.table}(${Object.keys(t.fields).join(", ")})`).join("; ") || "none");
await runMigrations();
const { rows } = await db.query(
  "select table_name from information_schema.tables where table_schema = 'public' and table_name in ('user','session','account','verification') order by 1",
);
console.log("Auth tables present:", rows.map((r) => r.table_name).join(", "));
await db.end();
