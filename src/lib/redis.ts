import { createClient, type RedisClientType } from "redis";

let client: RedisClientType | null = null;

export async function getRedis(): Promise<RedisClientType> {
  if (!client) {
    const url = process.env.REDIS_URL;
    if (!url) throw new Error("REDIS_URL not configured");
    client = createClient({ url });
    client.on("error", (err) => console.error("[Redis]", err));
    await client.connect();
  }
  return client;
}

const PREFIX = "co:user:";

export interface UserData {
  seenCards: number[];
  checkinDays: string[];
  checkinStreak: number;
  totalReadings: number;
  credits: number;
  freeReadingsUsed: number;
  createdAt: string;
  updatedAt: string;
}

function defaultUserData(): UserData {
  const now = new Date().toISOString();
  return {
    seenCards: [],
    checkinDays: [],
    checkinStreak: 0,
    totalReadings: 0,
    credits: 3,
    freeReadingsUsed: 0,
    createdAt: now,
    updatedAt: now,
  };
}

export async function getUserData(uid: string): Promise<UserData> {
  const redis = await getRedis();
  const raw = await redis.get(PREFIX + uid);
  if (!raw) return defaultUserData();
  try {
    return { ...defaultUserData(), ...JSON.parse(raw) };
  } catch {
    return defaultUserData();
  }
}

export async function saveUserData(uid: string, data: UserData): Promise<void> {
  const redis = await getRedis();
  data.updatedAt = new Date().toISOString();
  await redis.set(PREFIX + uid, JSON.stringify(data));
}
