export type SleepQuality = "good" | "ok" | "bad";
export type StressLevel = "low" | "mid" | "high";
export type MoodLevel = "low" | "mid" | "high";
export type WeatherType = "sunny" | "cloudy" | "rain" | "snow" | "wind" | "fog" | "hot" | "cold";

export interface UserProfile {
  sleep?: SleepQuality;
  stress?: StressLevel;
  mood?: MoodLevel;
  weather?: WeatherType;
  birthDate?: string; // YYYY-MM-DD
  birthTime?: string; // HH:mm or 时辰文本
}

const DEVICE_ID_KEY = "co_device_id";
const PROFILE_KEY = "co_profile_v1";

function safeGet(key: string): string | null {
  try {
    if (typeof window === "undefined") return null;
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSet(key: string, value: string): void {
  try {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(key, value);
  } catch {
    // ignore
  }
}

function makeFallbackId(): string {
  return `co_${Math.random().toString(36).slice(2)}_${Date.now().toString(36)}`;
}

export function getOrCreateDeviceId(): string {
  const existing = safeGet(DEVICE_ID_KEY);
  if (existing) return existing;
  const id = (typeof crypto !== "undefined" && "randomUUID" in crypto && typeof crypto.randomUUID === "function")
    ? crypto.randomUUID()
    : makeFallbackId();
  safeSet(DEVICE_ID_KEY, id);
  return id;
}

export function getProfile(): UserProfile {
  const raw = safeGet(PROFILE_KEY);
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as UserProfile;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

export function setProfile(p: UserProfile): void {
  safeSet(PROFILE_KEY, JSON.stringify(p ?? {}));
}

export function profileSeedString(deviceId: string, dateStr: string, profile: UserProfile): string {
  const parts = [
    `d=${deviceId}`,
    `date=${dateStr}`,
    profile.sleep ? `sleep=${profile.sleep}` : "",
    profile.stress ? `stress=${profile.stress}` : "",
    profile.mood ? `mood=${profile.mood}` : "",
    profile.weather ? `weather=${profile.weather}` : "",
    profile.birthDate ? `birth=${profile.birthDate}` : "",
    profile.birthTime ? `time=${profile.birthTime}` : "",
  ].filter(Boolean);
  return parts.join("|");
}

