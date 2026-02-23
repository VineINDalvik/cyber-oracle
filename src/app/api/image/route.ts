import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { cardName, cyberName, meaning, element, question } = body;

  const falKey = process.env.FAL_KEY;
  if (!falKey) {
    return NextResponse.json({ url: null, error: "Image API not configured" }, { status: 200 });
  }

  const prompt = buildPrompt(cardName, cyberName, meaning, element, question);

  try {
    const response = await fetch("https://queue.fal.run/fal-ai/flux/schnell", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Key ${falKey}`,
      },
      body: JSON.stringify({
        prompt,
        image_size: {
          width: 768,
          height: 1024,
        },
        num_inference_steps: 4,
        num_images: 1,
        enable_safety_checker: false,
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      console.error("Fal API error:", err);
      return NextResponse.json({ url: null });
    }

    const data = await response.json();

    if (data.request_id) {
      const resultUrl = await pollForResult(data.request_id, falKey);
      return NextResponse.json({ url: resultUrl });
    }

    const imageUrl = data.images?.[0]?.url;
    return NextResponse.json({ url: imageUrl ?? null });
  } catch (err) {
    console.error("Image generation error:", err);
    return NextResponse.json({ url: null });
  }
}

async function pollForResult(requestId: string, apiKey: string): Promise<string | null> {
  const maxAttempts = 30;
  for (let i = 0; i < maxAttempts; i++) {
    await new Promise((r) => setTimeout(r, 2000));

    try {
      const res = await fetch(`https://queue.fal.run/fal-ai/flux/schnell/requests/${requestId}/status`, {
        headers: { Authorization: `Key ${apiKey}` },
      });
      const status = await res.json();

      if (status.status === "COMPLETED") {
        const resultRes = await fetch(`https://queue.fal.run/fal-ai/flux/schnell/requests/${requestId}`, {
          headers: { Authorization: `Key ${apiKey}` },
        });
        const result = await resultRes.json();
        return result.images?.[0]?.url ?? null;
      }

      if (status.status === "FAILED") return null;
    } catch {
      continue;
    }
  }
  return null;
}

function buildPrompt(
  cardName: string,
  cyberName: string,
  meaning: string,
  element: string,
  question: string
): string {
  const elementMap: Record<string, string> = {
    火: "fiery reds and oranges, flames, energy streams",
    水: "deep blues and teals, water ripples, digital rain",
    风: "ethereal whites and cyans, wind trails, data streams",
    土: "earthy golds and greens, crystalline structures, circuit boards",
  };

  const elementVisual = elementMap[element] || "neon lights and holographic effects";

  return `A cyberpunk tarot card illustration, vertical composition 3:4 ratio.

Title: "${cardName}" / "${cyberName}"

Visual concept: A mystical figure embodying the archetype of ${meaning}, set in a neon-lit cyberpunk cityscape. The figure is surrounded by ${elementVisual}. Chinese calligraphy and I-Ching hexagram symbols float as holographic projections. The scene subtly references the question: "${question}".

Style: Dark atmospheric background (#0a0a0f), neon cyan (#00f0ff) and purple (#bf00ff) accent lighting, holographic elements, mystical symbols blended with circuit patterns, tarot card border with ornate cyber-gothic frame. High detail, cinematic lighting, digital art, trending on ArtStation.

The card should feel like a fusion of ancient Eastern mysticism and futuristic technology. No text on the card itself.`;
}
