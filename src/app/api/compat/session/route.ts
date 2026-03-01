import { NextRequest } from "next/server";
import { randomBytes } from "node:crypto";
import { getRedis } from "@/lib/redis";

function makeCode(): string {
  // 8 chars, url-safe, uppercase for readability
  const raw = randomBytes(6).toString("base64url").toUpperCase();
  return raw.slice(0, 8);
}

interface CreateBody {
  topicId: string;
  topicName: string;
  aCardId: number;
  aIsReversed: boolean;
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as Partial<CreateBody>;
    if (!body?.topicId || !body?.topicName) {
      return new Response("Missing topic", { status: 400 });
    }
    if (typeof body.aCardId !== "number" || typeof body.aIsReversed !== "boolean") {
      return new Response("Missing A card", { status: 400 });
    }

    const code = makeCode();
    const now = Date.now();
    const expiresInSec = 24 * 3600;
    const session = {
      code,
      topicId: String(body.topicId),
      topicName: String(body.topicName),
      a: { cardId: body.aCardId, isReversed: body.aIsReversed },
      b: null,
      createdAt: new Date(now).toISOString(),
      expiresAt: new Date(now + expiresInSec * 1000).toISOString(),
      status: "waiting",
    };

    const redis = await getRedis();
    await redis.set(`co:compat:${code}`, JSON.stringify(session), { EX: expiresInSec });

    return Response.json({ code, expiresInSec });
  } catch (e) {
    return new Response(`Error: ${e}`, { status: 500 });
  }
}

