import { ImageResponse } from "next/og";
import { NextRequest } from "next/server";
import { readFileSync } from "fs";
import { join } from "path";
import QRCode from "qrcode";

export const runtime = "nodejs";
export const maxDuration = 30;

interface CardData {
  cardId: number;
  cardName: string;
  cyberName: string;
  isReversed: boolean;
  fortune: string;
  label: string;
  mode: string;
  modeLabel: string;
  dateStr: string;
  ganZhi?: string;
  wuxing?: string;
  secondaryCardId?: number;
  secondaryCardName?: string;
  secondaryReversed?: boolean;
}

const FONT_CDNS = [
  "https://cdn.jsdelivr.net/gh/googlefonts/noto-cjk@main/Sans/SubsetOTF/SC",
  "https://raw.githubusercontent.com/googlefonts/noto-cjk/main/Sans/SubsetOTF/SC",
];
let fontRegular: ArrayBuffer | null = null;
let fontBold: ArrayBuffer | null = null;
let qrDataUrl: string | null = null;

async function fetchWithTimeout(url: string, ms = 15000): Promise<ArrayBuffer> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    const r = await fetch(url, { signal: ctrl.signal });
    if (!r.ok) throw new Error(`font ${r.status}`);
    return r.arrayBuffer();
  } finally {
    clearTimeout(t);
  }
}

async function loadFonts() {
  const load = async (name: string): Promise<ArrayBuffer> => {
    for (const base of FONT_CDNS) {
      try { return await fetchWithTimeout(`${base}/${name}`); } catch { continue; }
    }
    throw new Error(`font load failed: ${name}`);
  };
  if (!fontRegular) fontRegular = await load("NotoSansSC-Regular.otf");
  if (!fontBold) fontBold = await load("NotoSansSC-Bold.otf");
  return { regular: fontRegular!, bold: fontBold! };
}

async function getQrDataUrl(): Promise<string> {
  if (qrDataUrl) return qrDataUrl;
  // Data URL PNG so it always renders in next/og ImageResponse.
  qrDataUrl = await QRCode.toDataURL("https://cyber.vinex.top", {
    errorCorrectionLevel: "L",
    margin: 0,
    scale: 6,
    color: { dark: "#0a0a0f", light: "#ffffff" },
  });
  return qrDataUrl;
}

function getCardDataUrl(cardId: number): string {
  const paddedId = String(cardId).padStart(2, "0");
  try {
    const buf = readFileSync(join(process.cwd(), "public", "cards", `${paddedId}.jpg`));
    return `data:image/jpeg;base64,${buf.toString("base64")}`;
  } catch {
    return "";
  }
}

export async function POST(req: NextRequest) {
  try {
    const data: CardData = await req.json();
    const fonts = await loadFonts();
    const qrSrc = await getQrDataUrl();

    const cardImgSrc = getCardDataUrl(data.cardId);
    const secondaryImgSrc = data.secondaryCardId != null ? getCardDataUrl(data.secondaryCardId) : "";
    const isCompat = !!secondaryImgSrc;
    const qrSize = isCompat ? 84 : 96;

    return new ImageResponse(
      (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            width: "100%",
            height: "100%",
            background: "linear-gradient(180deg, #0a0a0f 0%, #111128 50%, #0a0a0f 100%)",
            fontFamily: "NotoSansSC",
            color: "#ffffff",
            // Slightly larger bottom padding to avoid QR clipping on some renders
            padding: "48px 48px 56px",
          }}
        >
          {/* Header */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
            <div style={{ display: "flex", fontSize: 16, letterSpacing: "0.3em", color: "rgba(255,255,255,0.2)" }}>
              CYBER ORACLE
            </div>
            <div style={{ display: "flex", fontSize: 18, color: "rgba(255,255,255,0.4)" }}>
              {data.modeLabel}
            </div>
          </div>

          {/* Card image area */}
          <div style={{ display: "flex", justifyContent: "center", alignItems: "center", marginBottom: 32, gap: 24 }}>
            {isCompat ? (
              <>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                  {cardImgSrc && (
                    <img src={cardImgSrc} width={180} height={300} style={{ borderRadius: 16, border: "2px solid rgba(0,240,255,0.2)", objectFit: "cover" }} />
                  )}
                  <div style={{ display: "flex", fontSize: 14, color: "rgba(0,240,255,0.6)", marginTop: 8 }}>
                    赛博·{data.cardName}{data.isReversed ? " ⟲" : ""}
                  </div>
                </div>
                <div style={{ display: "flex", fontSize: 36, color: "rgba(255,184,0,0.7)" }}>×</div>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                  {secondaryImgSrc && (
                    <img src={secondaryImgSrc} width={180} height={300} style={{ borderRadius: 16, border: "2px solid rgba(168,85,247,0.2)", objectFit: "cover" }} />
                  )}
                  <div style={{ display: "flex", fontSize: 14, color: "rgba(168,85,247,0.6)", marginTop: 8 }}>
                    赛博·{data.secondaryCardName}{data.secondaryReversed ? " ⟲" : ""}
                  </div>
                </div>
              </>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                {cardImgSrc && (
                  <img src={cardImgSrc} width={260} height={433} style={{ borderRadius: 20, border: "2px solid rgba(0,240,255,0.2)", objectFit: "cover" }} />
                )}
              </div>
            )}
          </div>

          {/* Card name + cyber name */}
          {!isCompat && (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginBottom: 24 }}>
              <div style={{ display: "flex", fontSize: 28, fontWeight: 700, color: "rgba(0,240,255,0.8)", letterSpacing: "0.1em" }}>
                赛博·{data.cardName}
              </div>
              <div style={{ display: "flex", fontSize: 16, color: "rgba(0,240,255,0.3)", marginTop: 4 }}>
                [ {data.cyberName} ]{data.isReversed ? " · 逆位" : " · 正位"}
              </div>
            </div>
          )}

          {/* Divider */}
          <div style={{ display: "flex", width: "100%", height: 1, background: "rgba(255,255,255,0.06)", marginBottom: 24 }} />

          {/* Fortune text */}
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 20 }}>
            <div style={{ display: "flex", fontSize: 22, color: "rgba(255,255,255,0.6)", textAlign: "center", lineHeight: 1.8, maxWidth: 500 }}>
              {data.fortune.length > 120 ? data.fortune.slice(0, 120) + "…" : data.fortune}
            </div>
          </div>

          {/* Label stamp */}
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 24 }}>
            <div style={{
              display: "flex",
              fontSize: 18,
              fontWeight: 700,
              color: "rgba(233,69,96,0.9)",
              border: "2px solid rgba(233,69,96,0.4)",
              borderRadius: 8,
              padding: "6px 20px",
              transform: "rotate(-8deg)",
            }}>
              {data.label}
            </div>
          </div>

          {/* Spacer */}
          <div style={{ display: "flex", flex: 1 }} />

          {/* Footer */}
          <div style={{ display: "flex", width: "100%", height: 1, background: "rgba(255,255,255,0.06)", marginBottom: 20 }} />
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <div style={{ display: "flex", fontSize: 14, color: "rgba(255,255,255,0.2)" }}>{data.dateStr}</div>
              {data.ganZhi && (
                <div style={{ display: "flex", fontSize: 14, color: "rgba(255,184,0,0.3)" }}>{data.ganZhi} · {data.wuxing}</div>
              )}
            </div>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
              <div style={{ display: "flex", padding: 8, background: "rgba(255,255,255,0.92)", borderRadius: 14 }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={qrSrc} width={qrSize} height={qrSize} style={{ display: "flex", objectFit: "contain" }} />
              </div>
              <div style={{ display: "flex", fontSize: 14, color: "rgba(0,240,255,0.3)" }}>
                扫码打开 cyber.vinex.top
              </div>
            </div>
          </div>
        </div>
      ),
      {
        width: 600,
        height: isCompat ? 760 : 1000,
        fonts: [
          { name: "NotoSansSC", data: fonts.regular, weight: 400 as const, style: "normal" as const },
          { name: "NotoSansSC", data: fonts.bold, weight: 700 as const, style: "normal" as const },
        ],
      }
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("Share card error:", msg);
    return new Response(`生成失败: ${msg}`, { status: 500 });
  }
}
