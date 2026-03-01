import { NextRequest } from "next/server";
import { getRedis } from "@/lib/redis";

function key(code: string) {
  return `co:compat:${code.toUpperCase()}`;
}

export async function GET(_req: NextRequest, ctx: { params: Promise<{ code: string }> }) {
  try {
    const { code } = await ctx.params;
    const redis = await getRedis();
    const raw = await redis.get(key(code));
    if (!raw) return new Response("Not found", { status: 404 });
    return new Response(raw, { headers: { "Content-Type": "application/json; charset=utf-8" } });
  } catch (e) {
    return new Response(`Error: ${e}`, { status: 500 });
  }
}

interface JoinBody {
  bCardId: number;
  bIsReversed: boolean;
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ code: string }> }) {
  try {
    const { code } = await ctx.params;
    const body = (await req.json()) as Partial<JoinBody>;
    if (typeof body.bCardId !== "number" || typeof body.bIsReversed !== "boolean") {
      return new Response("Missing B card", { status: 400 });
    }
    const redis = await getRedis();
    const raw = await redis.get(key(code));
    if (!raw) return new Response("Not found", { status: 404 });
    const session = JSON.parse(raw) as any;
    session.b = { cardId: body.bCardId, isReversed: body.bIsReversed };
    session.status = "ready";
    session.joinedAt = new Date().toISOString();
    // Keep original TTL; re-set without changing expiration if possible
    const ttl = await redis.ttl(key(code));
    await redis.set(key(code), JSON.stringify(session), { EX: ttl > 0 ? ttl : 24 * 3600 });
    return new Response(JSON.stringify(session), { headers: { "Content-Type": "application/json; charset=utf-8" } });
  } catch (e) {
    return new Response(`Error: ${e}`, { status: 500 });
  }
}

