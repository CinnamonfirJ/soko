"use client";
import { useCallback, useEffect, useState } from "react";

export class ApiError extends Error {
  constructor(message: string, public status: number, public code?: string, public fieldErrors?: Record<string, string>) { super(message); }
}

export async function api<T = unknown>(url: string, init?: RequestInit & { json?: unknown }): Promise<T> {
  const { json, ...rest } = init ?? {};
  let res: Response;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 25_000);
  try {
    res = await fetch(url, { ...rest, signal: ctrl.signal, headers: { ...(json ? { "content-type": "application/json" } : {}), ...(rest.headers ?? {}) }, body: json ? JSON.stringify(json) : rest.body, cache: "no-store" });
  } catch {
    // Network error or timeout. For payment calls the server may still have processed it; callers reuse
    // idempotency keys so a retry can never double-charge.
    throw new ApiError("We couldn't reach SokoBot. Check your connection and try again. Your reference is saved if one was created.", 0, "OFFLINE");
  } finally {
    clearTimeout(timer);
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok || (data as { error?: string }).error) {
    const d = data as { error?: string; code?: string; fieldErrors?: Record<string, string> };
    throw new ApiError(d.error ?? "Something went wrong.", res.status, d.code, d.fieldErrors);
  }
  return data as T;
}

export function useApi<T>(url: string | null, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [loading, setLoading] = useState(!!url);
  const load = useCallback(async () => {
    if (!url) return;
    try { setData(await api<T>(url)); setError(null); } catch (e) { setError(e as ApiError); } finally { setLoading(false); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, ...deps]);
  useEffect(() => { load(); }, [load]);
  return { data, error, loading, reload: load, setData };
}

export const newKey = () => (crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2) + Date.now().toString(36));

// Transfer draft survives sign-in and reloads (sessionStorage only — no sensitive data persisted).
export interface TransferDraft {
  source?: string;
  destination?: string;
  amount?: string;
  fundingMethod?: string;
  recipient?: { displayName: string; nickname?: string; payoutMethod: "MOBILE_MONEY" | "BANK"; provider: string; identifier: string; save?: boolean; savedRecipientId?: string; masked?: string };
  recipientName?: string;
  step?: number;
  idempotencyKey?: string;
  fromAssistant?: boolean;
  channel?: "whatsapp" | "web";
}
const DKEY = "soko_draft";
export const loadDraft = (): TransferDraft => { try { return JSON.parse(sessionStorage.getItem(DKEY) || "{}"); } catch { return {}; } };
export const saveDraft = (d: TransferDraft) => { try { sessionStorage.setItem(DKEY, JSON.stringify(d)); } catch {} };
export const clearDraft = () => { try { sessionStorage.removeItem(DKEY); } catch {} };

export function relTime(iso: string) {
  const s = Math.round((Date.now() - Date.parse(iso)) / 1000);
  if (s < 10) return "just now";
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short" });
}
