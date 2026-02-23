const STORAGE_KEY = "cyber-oracle-collection";
const CREDITS_KEY = "cyber-oracle-credits";
const CHECKIN_KEY = "cyber-oracle-checkin";

export interface CollectionData {
  seenCards: number[];        // card IDs seen
  checkinDays: string[];      // date strings of check-ins
  checkinStreak: number;      // current consecutive streak
  totalReadings: number;
  rareCardSeen: boolean;
}

export interface CreditsData {
  credits: number;
  freeReadingsUsed: number;   // track free trial readings
}

function getCollection(): CollectionData {
  if (typeof window === "undefined") return defaultCollection();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : defaultCollection();
  } catch { return defaultCollection(); }
}

function defaultCollection(): CollectionData {
  return { seenCards: [], checkinDays: [], checkinStreak: 0, totalReadings: 0, rareCardSeen: false };
}

function saveCollection(data: CollectionData) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

export function recordCardSeen(cardId: number): CollectionData {
  const data = getCollection();
  if (!data.seenCards.includes(cardId)) {
    data.seenCards.push(cardId);
  }
  saveCollection(data);
  return data;
}

export function recordReading(): CollectionData {
  const data = getCollection();
  data.totalReadings += 1;
  saveCollection(data);
  return data;
}

export function getCollectionStats(): CollectionData {
  return getCollection();
}

export function dailyCheckin(dateStr: string): { data: CollectionData; isNew: boolean; streakReward: boolean } {
  const data = getCollection();
  if (data.checkinDays.includes(dateStr)) {
    return { data, isNew: false, streakReward: false };
  }

  data.checkinDays.push(dateStr);

  const yesterday = new Date(dateStr);
  yesterday.setDate(yesterday.getDate() - 1);
  const yStr = yesterday.toISOString().slice(0, 10);
  data.checkinStreak = data.checkinDays.includes(yStr) ? data.checkinStreak + 1 : 1;

  const streakReward = data.checkinStreak > 0 && data.checkinStreak % 7 === 0;

  saveCollection(data);
  return { data, isNew: true, streakReward };
}

// ─── Credits ──────────────────────────────────────────────────────

export function getCredits(): CreditsData {
  if (typeof window === "undefined") return { credits: 3, freeReadingsUsed: 0 };
  try {
    const raw = localStorage.getItem(CREDITS_KEY);
    return raw ? JSON.parse(raw) : { credits: 3, freeReadingsUsed: 0 };
  } catch { return { credits: 3, freeReadingsUsed: 0 }; }
}

export function useCredit(): { success: boolean; remaining: number } {
  const data = getCredits();
  if (data.credits <= 0) return { success: false, remaining: 0 };
  data.credits -= 1;
  data.freeReadingsUsed += 1;
  if (typeof window !== "undefined") {
    localStorage.setItem(CREDITS_KEY, JSON.stringify(data));
  }
  return { success: true, remaining: data.credits };
}

export function addCredits(amount: number): CreditsData {
  const data = getCredits();
  data.credits += amount;
  if (typeof window !== "undefined") {
    localStorage.setItem(CREDITS_KEY, JSON.stringify(data));
  }
  return data;
}

// ─── Compatibility Code Encoding ──────────────────────────────────
// Encode draw result into a shareable 8-char code (no backend needed)

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
