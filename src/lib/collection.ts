// ─── Device ID (anonymous fingerprint) ──────────────────────────
const DEVICE_ID_KEY = "cyber-oracle-device-id";

function generateDeviceId(): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let id = "co_";
  for (let i = 0; i < 16; i++) {
    id += chars[Math.floor(Math.random() * chars.length)];
  }
  return id;
}

export function getDeviceId(): string {
  if (typeof window === "undefined") return "server";
  let id = localStorage.getItem(DEVICE_ID_KEY);
  if (!id) {
    id = generateDeviceId();
    localStorage.setItem(DEVICE_ID_KEY, id);
  }
  return id;
}

// ─── Types ──────────────────────────────────────────────────────

export interface CollectionData {
  seenCards: number[];
  checkinDays: string[];
  checkinStreak: number;
  totalReadings: number;
  rareCardSeen: boolean;
}

export interface CreditsData {
  credits: number;
  freeReadingsUsed: number;
}

// ─── Local Cache (fallback) ─────────────────────────────────────

const STORAGE_KEY = "cyber-oracle-collection";
const CREDITS_KEY = "cyber-oracle-credits";

function defaultCollection(): CollectionData {
  return { seenCards: [], checkinDays: [], checkinStreak: 0, totalReadings: 0, rareCardSeen: false };
}

function getLocalCollection(): CollectionData {
  if (typeof window === "undefined") return defaultCollection();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : defaultCollection();
  } catch { return defaultCollection(); }
}

function saveLocalCollection(data: CollectionData) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

function getLocalCredits(): CreditsData {
  if (typeof window === "undefined") return { credits: 3, freeReadingsUsed: 0 };
  try {
    const raw = localStorage.getItem(CREDITS_KEY);
    return raw ? JSON.parse(raw) : { credits: 3, freeReadingsUsed: 0 };
  } catch { return { credits: 3, freeReadingsUsed: 0 }; }
}

function saveLocalCredits(data: CreditsData) {
  if (typeof window === "undefined") return;
  localStorage.setItem(CREDITS_KEY, JSON.stringify(data));
}

// ─── API Helper ─────────────────────────────────────────────────

async function apiCall(action: string, extra: Record<string, unknown> = {}): Promise<Record<string, unknown> | null> {
  try {
    const res = await fetch("/api/user", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-user-id": getDeviceId(),
      },
      body: JSON.stringify({ action, ...extra }),
    });
    if (res.ok) return await res.json();
  } catch { /* fall through to local */ }
  return null;
}

async function apiFetch(): Promise<Record<string, unknown> | null> {
  try {
    const res = await fetch("/api/user", {
      headers: { "x-user-id": getDeviceId() },
    });
    if (res.ok) return await res.json();
  } catch { /* fall through */ }
  return null;
}

// ─── Sync: merge local → server on first load ───────────────────

let synced = false;

export async function syncToServer(): Promise<void> {
  if (synced || typeof window === "undefined") return;
  synced = true;

  const local = getLocalCollection();
  const credits = getLocalCredits();

  const result = await apiCall("sync", {
    data: {
      seenCards: local.seenCards,
      credits: credits.credits,
      totalReadings: local.totalReadings,
      freeReadingsUsed: credits.freeReadingsUsed,
    },
  });

  if (result) {
    // Update local cache with merged server data
    const merged: CollectionData = {
      seenCards: (result.seenCards as number[]) ?? local.seenCards,
      checkinDays: (result.checkinDays as string[]) ?? local.checkinDays,
      checkinStreak: (result.checkinStreak as number) ?? local.checkinStreak,
      totalReadings: (result.totalReadings as number) ?? local.totalReadings,
      rareCardSeen: local.rareCardSeen,
    };
    saveLocalCollection(merged);
    saveLocalCredits({
      credits: (result.credits as number) ?? credits.credits,
      freeReadingsUsed: (result.freeReadingsUsed as number) ?? credits.freeReadingsUsed,
    });
  }
}

// ─── Public API (server-first, local fallback) ──────────────────

export async function recordCardSeen(cardId: number): Promise<CollectionData> {
  const local = getLocalCollection();
  if (!local.seenCards.includes(cardId)) {
    local.seenCards.push(cardId);
  }
  saveLocalCollection(local);

  apiCall("card-seen", { cardId }).catch(() => {});
  return local;
}

export async function recordReading(): Promise<CollectionData> {
  const local = getLocalCollection();
  local.totalReadings += 1;
  saveLocalCollection(local);

  apiCall("reading").catch(() => {});
  return local;
}

export function getCollectionStats(): CollectionData {
  return getLocalCollection();
}

export async function dailyCheckin(dateStr: string): Promise<{ data: CollectionData; isNew: boolean; streakReward: boolean }> {
  const local = getLocalCollection();

  if (local.checkinDays.includes(dateStr)) {
    return { data: local, isNew: false, streakReward: false };
  }

  // Try server first
  const result = await apiCall("checkin", { date: dateStr });

  if (result) {
    const serverData = result.data as Record<string, unknown>;
    const updated: CollectionData = {
      seenCards: (serverData.seenCards as number[]) ?? local.seenCards,
      checkinDays: (serverData.checkinDays as string[]) ?? [...local.checkinDays, dateStr],
      checkinStreak: (serverData.checkinStreak as number) ?? local.checkinStreak + 1,
      totalReadings: (serverData.totalReadings as number) ?? local.totalReadings,
      rareCardSeen: local.rareCardSeen,
    };
    saveLocalCollection(updated);

    if ((serverData.credits as number) !== undefined) {
      saveLocalCredits({
        credits: serverData.credits as number,
        freeReadingsUsed: (serverData.freeReadingsUsed as number) ?? 0,
      });
    }

    return {
      data: updated,
      isNew: result.isNew as boolean,
      streakReward: result.streakReward as boolean,
    };
  }

  // Fallback: local only
  local.checkinDays.push(dateStr);
  const yesterday = new Date(dateStr);
  yesterday.setDate(yesterday.getDate() - 1);
  const yStr = yesterday.toISOString().slice(0, 10);
  local.checkinStreak = local.checkinDays.includes(yStr) ? local.checkinStreak + 1 : 1;
  const streakReward = local.checkinStreak > 0 && local.checkinStreak % 7 === 0;
  saveLocalCollection(local);
  return { data: local, isNew: true, streakReward };
}

// ─── Credits (server-first) ─────────────────────────────────────

export function getCredits(): CreditsData {
  return getLocalCredits();
}

export async function useCredit(): Promise<{ success: boolean; remaining: number }> {
  const local = getLocalCredits();

  const result = await apiCall("use-credit");
  if (result) {
    const remaining = result.remaining as number;
    local.credits = remaining;
    local.freeReadingsUsed += 1;
    saveLocalCredits(local);
    return { success: result.success as boolean, remaining };
  }

  // Fallback
  if (local.credits <= 0) return { success: false, remaining: 0 };
  local.credits -= 1;
  local.freeReadingsUsed += 1;
  saveLocalCredits(local);
  return { success: true, remaining: local.credits };
}

export async function addCredits(amount: number): Promise<CreditsData> {
  const local = getLocalCredits();

  const result = await apiCall("add-credits", { amount });
  if (result) {
    local.credits = result.credits as number;
    saveLocalCredits(local);
    return local;
  }

  // Fallback
  local.credits += amount;
  saveLocalCredits(local);
  return local;
}

// ─── Full refresh from server ───────────────────────────────────

export async function refreshFromServer(): Promise<CollectionData & CreditsData> {
  const result = await apiFetch();
  const local = getLocalCollection();
  const credits = getLocalCredits();

  if (result) {
    const merged: CollectionData = {
      seenCards: (result.seenCards as number[]) ?? local.seenCards,
      checkinDays: (result.checkinDays as string[]) ?? local.checkinDays,
      checkinStreak: (result.checkinStreak as number) ?? local.checkinStreak,
      totalReadings: (result.totalReadings as number) ?? local.totalReadings,
      rareCardSeen: local.rareCardSeen,
    };
    const mergedCredits: CreditsData = {
      credits: (result.credits as number) ?? credits.credits,
      freeReadingsUsed: (result.freeReadingsUsed as number) ?? credits.freeReadingsUsed,
    };
    saveLocalCollection(merged);
    saveLocalCredits(mergedCredits);
    return { ...merged, ...mergedCredits };
  }

  return { ...local, ...credits };
}

// ─── Compatibility Code Encoding ────────────────────────────────

export interface CompatDrawData {
  topic: string;
  cards: { id: number; reversed: boolean }[];
}

export function encodeCompatCode(data: CompatDrawData): string {
  const json = JSON.stringify(data);
  if (typeof window !== "undefined") {
    return btoa(unescape(encodeURIComponent(json)))
      .replace(/[+/=]/g, (c) => ({ "+": "-", "/": "_", "=": "" })[c] || c)
      .slice(0, 20);
  }
  return Buffer.from(json).toString("base64url").slice(0, 20);
}

export function decodeCompatCode(code: string): CompatDrawData | null {
  try {
    const padded = code.replace(/-/g, "+").replace(/_/g, "/");
    const remainder = padded.length % 4;
    const base64 = padded + "=".repeat(remainder ? 4 - remainder : 0);
    if (typeof window !== "undefined") {
      const json = decodeURIComponent(escape(atob(base64)));
      return JSON.parse(json);
    }
    return JSON.parse(Buffer.from(base64, "base64").toString("utf-8"));
  } catch {
    return null;
  }
}
