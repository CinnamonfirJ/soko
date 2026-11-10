import "server-only";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import type { Db } from "./types";

// Hackathon persistence: a JSON file under .data. Swap for Supabase Postgres by replacing
// load/save with table access — callers only use `db()` + `commit()`.
const FILE = path.join(process.cwd(), ".data", "db.json");

const empty = (): Db => ({ users: [], quotes: [], recipients: [], transactions: [], events: [], support: [], otps: [], processedWebhooks: [] });

const g = globalThis as unknown as { __sokoDb?: Db };

export function db(): Db {
  if (!g.__sokoDb) {
    try {
      g.__sokoDb = { ...empty(), ...JSON.parse(fs.readFileSync(FILE, "utf8")) };
    } catch {
      g.__sokoDb = empty();
    }
  }
  return g.__sokoDb!;
}

export function commit() {
  fs.mkdirSync(path.dirname(FILE), { recursive: true });
  const tmp = FILE + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(g.__sokoDb ?? empty(), null, 1));
  fs.renameSync(tmp, FILE);
}

export const uid = (prefix: string) => `${prefix}_${crypto.randomBytes(9).toString("base64url")}`;
export const now = () => new Date().toISOString();

export function reference(): string {
  const a = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = "";
  const b = crypto.randomBytes(8);
  for (let i = 0; i < 8; i++) s += a[b[i] % a.length];
  return `SK-${s.slice(0, 4)}-${s.slice(4)}`;
}
