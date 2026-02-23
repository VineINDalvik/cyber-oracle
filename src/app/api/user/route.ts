import { NextRequest, NextResponse } from "next/server";
import { getUserData, saveUserData } from "@/lib/redis";

function getUid(req: NextRequest): string | null {
  return req.headers.get("x-user-id");
}

// GET /api/user — 获取用户数据
export async function GET(req: NextRequest) {
  const uid = getUid(req);
  if (!uid) return NextResponse.json({ error: "missing x-user-id" }, { status: 400 });
  const data = await getUserData(uid);
  return NextResponse.json(data);
}

// POST /api/user — 批量操作
// body: { action: "checkin"|"use-credit"|"add-credits"|"card-seen"|"reading", ... }
export async function POST(req: NextRequest) {
  const uid = getUid(req);
  if (!uid) return NextResponse.json({ error: "missing x-user-id" }, { status: 400 });

  const body = await req.json();
  const { action } = body;
  const data = await getUserData(uid);

  switch (action) {
    case "checkin": {
      const dateStr: string = body.date;
      if (data.checkinDays.includes(dateStr)) {
        return NextResponse.json({ data, isNew: false, streakReward: false });
      }
      data.checkinDays.push(dateStr);
      const yesterday = new Date(dateStr);
      yesterday.setDate(yesterday.getDate() - 1);
      const yStr = yesterday.toISOString().slice(0, 10);
      data.checkinStreak = data.checkinDays.includes(yStr) ? data.checkinStreak + 1 : 1;
      const streakReward = data.checkinStreak > 0 && data.checkinStreak % 7 === 0;
      if (streakReward) data.credits += 2;
      await saveUserData(uid, data);
      return NextResponse.json({ data, isNew: true, streakReward });
    }

    case "use-credit": {
      if (data.credits <= 0) {
        return NextResponse.json({ success: false, remaining: 0 });
      }
      data.credits -= 1;
      data.freeReadingsUsed += 1;
      await saveUserData(uid, data);
      return NextResponse.json({ success: true, remaining: data.credits });
    }

    case "add-credits": {
      const amount: number = body.amount ?? 0;
      data.credits += amount;
      await saveUserData(uid, data);
      return NextResponse.json({ credits: data.credits });
    }

    case "card-seen": {
      const cardId: number = body.cardId;
      if (!data.seenCards.includes(cardId)) {
        data.seenCards.push(cardId);
      }
      await saveUserData(uid, data);
      return NextResponse.json({ seenCards: data.seenCards });
    }

    case "reading": {
      data.totalReadings += 1;
      await saveUserData(uid, data);
      return NextResponse.json({ totalReadings: data.totalReadings });
    }

    case "sync": {
      // Full sync from client — merge seen cards, take max credits
      const clientData = body.data;
      if (clientData) {
        if (Array.isArray(clientData.seenCards)) {
          const merged = new Set([...data.seenCards, ...clientData.seenCards]);
          data.seenCards = [...merged];
        }
        data.credits = Math.max(data.credits, clientData.credits ?? 0);
        data.totalReadings = Math.max(data.totalReadings, clientData.totalReadings ?? 0);
        data.freeReadingsUsed = Math.max(data.freeReadingsUsed, clientData.freeReadingsUsed ?? 0);
      }
      await saveUserData(uid, data);
      return NextResponse.json(data);
    }

    default:
      return NextResponse.json({ error: `unknown action: ${action}` }, { status: 400 });
  }
}
