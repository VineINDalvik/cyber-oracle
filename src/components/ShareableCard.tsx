"use client";

import { useEffect, useMemo, useRef, useState, forwardRef, useImperativeHandle } from "react";
import { motion } from "framer-motion";
import { QRCodeSVG } from "qrcode.react";
import type { DrawnResult, GanZhi } from "@/lib/tarot";
import CardFace from "./CardFace";

interface ShareableCardProps {
  result: DrawnResult;
  mode: "daily" | "spread" | "topic" | "dream" | "compat" | string;
  dateStr: string;
  visible: boolean;
  onClose: () => void;
  ganZhi?: GanZhi;
  title?: string;
  subtitle?: string;
  contextText?: string;
  secondaryCard?: { cardId: number; reversed: boolean; name?: string };
  qrHintText?: string;
}

export interface ShareableCardHandle {
  save: () => Promise<void>;
}

const ShareableCard = forwardRef<ShareableCardHandle, ShareableCardProps>(
  function ShareableCard(
    { result, mode, dateStr, visible, onClose, ganZhi, title, subtitle, contextText, secondaryCard, qrHintText },
    ref
  ) {
    const cardRef = useRef<HTMLDivElement>(null);
    const [isSaving, setIsSaving] = useState(false);
    const shareUrl = "https://cyber.vinex.top";
    const [imageUrl, setImageUrl] = useState<string | null>(null);
    const [imageFileName, setImageFileName] = useState<string>("");

    const modeMeta = useMemo(() => {
      switch (mode) {
        case "daily":
          return { icon: "📅", label: "每日签" };
        case "dream":
          return { icon: "🌙", label: "梦境解码" };
        case "topic":
          return { icon: "🎯", label: "主题占卜" };
        case "spread":
          return { icon: "🎴", label: "牌阵占卜" };
        case "compat":
          return { icon: "💞", label: "双人合盘" };
        default:
          return { icon: "🔮", label: "赛博占卜" };
      }
    }, [mode]);

    const textForCard = contextText ?? result.fortune;
    const labelForCard = title ?? result.label;
    const subForCard = subtitle ?? modeMeta.label;
    const qrText = qrHintText ?? "扫码打开 cyber.vinex.top";

    useEffect(() => {
      return () => {
        if (imageUrl) URL.revokeObjectURL(imageUrl);
      };
    }, [imageUrl]);

    const generateImage = async (): Promise<{ blob: Blob; url: string; fileName: string } | null> => {
      if (!cardRef.current) return null;
      const html2canvas = (await import("html2canvas")).default;
      const canvas = await html2canvas(cardRef.current, {
        backgroundColor: "#0a0a0f",
        scale: 2,
        useCORS: true,
      });
      const fileName = `cyber-oracle-${modeMeta.label}-${result.card.name}-${dateStr}.png`;
      const blob: Blob | null = await new Promise((resolve) =>
        canvas.toBlob((b) => resolve(b), "image/png", 1)
      );
      if (!blob) return null;
      const url = URL.createObjectURL(blob);
      setImageUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return url;
      });
      setImageFileName(fileName);
      return { blob, url, fileName };
    };

    const save = async () => {
      if (!cardRef.current || isSaving) return;
      setIsSaving(true);
      try {
        const generated = await generateImage();
        if (!generated) throw new Error("generate_failed");

        // Try download (best on desktop). On iOS/webviews, download may be ignored,
        // so we also keep an in-app preview below for long-press save.
        try {
          const link = document.createElement("a");
          link.download = generated.fileName;
          link.href = generated.url;
          link.click();
        } catch {
          // ignore
        }
      } catch {
        alert("生成失败：请重试，或直接截图。");
      } finally {
        setIsSaving(false);
      }
    };

    const shareImage = async () => {
      if (isSaving) return;
      setIsSaving(true);
      try {
        const generated = imageUrl ? null : await generateImage();
        const url = generated?.url ?? imageUrl;
        const fileName = generated?.fileName ?? imageFileName;
        if (!url) throw new Error("no_image");

        // Share as file if possible
        try {
          const nav = navigator as unknown as {
            canShare?: (data: { files: File[] }) => boolean;
            share?: (data: { title?: string; text?: string; files?: File[]; url?: string }) => Promise<void>;
          };
          if (nav.share) {
            // fetch blob from object url
            const blob = await fetch(url).then((r) => r.blob());
            const file = new File([blob], fileName || "cyber-oracle.png", { type: "image/png" });
            if (!nav.canShare || nav.canShare({ files: [file] })) {
              await nav.share({
                title: "赛博神算子",
                text: `${modeMeta.label} · ${result.card.name}`,
                files: [file],
              });
              return;
            }
          }
        } catch {
          // fall through
        }

        // Fallback: share link
        const text = `${modeMeta.label} · 赛博·${result.card.name} —— ${labelForCard}`;
        if (navigator.share) {
          await navigator.share({ title: "赛博神算子", text, url: shareUrl });
        } else {
          await navigator.clipboard.writeText(`${text} ${shareUrl}`);
          alert("已复制链接到剪贴板（图片可在下方预览长按保存）");
        }
      } catch {
        alert("分享失败：你可以在下方预览里长按保存图片。");
      } finally {
        setIsSaving(false);
      }
    };

    useImperativeHandle(ref, () => ({ save }));

    if (!visible) return null;

    return (
      <motion.div
        className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex flex-col"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      >
        {/* Header */}
        <div
          className="shrink-0 px-4 pt-4 pb-3 flex items-center justify-between border-b border-card-border glass"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="text-foreground/40 text-[10px] font-mono tracking-widest">
            SHARE · {modeMeta.label.toUpperCase()}
          </div>
          <button
            onClick={onClose}
            className="text-foreground/30 text-xs font-mono px-3 py-1.5 rounded-lg glass cursor-pointer"
          >
            关闭
          </button>
        </div>

        {/* Scrollable content */}
        <div
          className="flex-1 overflow-y-auto px-4 py-6"
          style={{ WebkitOverflowScrolling: "touch" }}
          onClick={(e) => e.stopPropagation()}
        >
          <motion.div
            className="flex flex-col items-center max-w-sm w-full mx-auto"
            initial={{ scale: 0.9, y: 20 }}
            animate={{ scale: 1, y: 0 }}
          >
            <div
              ref={cardRef}
              className="w-full rounded-2xl overflow-hidden border border-card-border bg-[#0a0a0f]"
            >
              {/* Card header */}
              <div className="px-6 pt-5 pb-3 bg-gradient-to-b from-[#0a0a0f] to-card-dark">
                <div className="flex items-center justify-between">
                  <div className="text-foreground/20 text-[9px] font-mono tracking-[0.3em]">
                    CYBER ORACLE
                  </div>
                  <div className="text-foreground/40 text-[10px] font-mono">
                    {modeMeta.icon} {subForCard}
                  </div>
                </div>
                <div className="mt-2 text-foreground/80 text-sm font-bold neon-text tracking-wider">
                  {labelForCard}
                </div>
              </div>

              <div className="flex justify-center pt-8 pb-4 bg-gradient-to-b from-card-dark to-surface">
                {secondaryCard ? (
                  <div className="flex items-center gap-6">
                    <CardFace cardId={result.card.id} reversed={result.isReversed} size="md" />
                    <div className="text-neon-gold text-xl font-mono">×</div>
                    <CardFace cardId={secondaryCard.cardId} reversed={secondaryCard.reversed} size="md" />
                  </div>
                ) : (
                  <CardFace
                    cardId={result.card.id}
                    reversed={result.isReversed}
                    size="lg"
                  />
                )}
              </div>

              <div className="px-6 pb-6">
                <div className="border-t border-dashed border-foreground/10 mb-4" />

                <p className="text-foreground/70 text-sm leading-relaxed text-center mb-4">
                  {textForCard}
                </p>

                <div className="flex justify-center mb-4">
                  <div className="stamp text-xs">{result.label}</div>
                </div>

                <div className="flex items-end justify-between">
                  <div className="text-foreground/20 text-[8px] font-mono leading-relaxed">
                    <div>{dateStr}</div>
                    {ganZhi && (
                      <div className="text-neon-gold/30 mt-0.5">{ganZhi.gan}{ganZhi.zhi}日 · {ganZhi.wuxing}</div>
                    )}
                    <div className="text-neon-cyan/30 mt-0.5">
                      赛博·{result.card.name}
                      {result.isReversed ? " ⟲逆位" : " ⬆正位"}
                    </div>
                    {secondaryCard?.name && (
                      <div className="text-neon-purple/25 mt-0.5">
                        赛博·{secondaryCard.name}
                        {secondaryCard.reversed ? " ⟲逆位" : " ⬆正位"}
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col items-center">
                    <div className="p-1.5 rounded-lg bg-white/90 shadow-[0_0_20px_rgba(255,255,255,0.06)]">
                      <QRCodeSVG
                        value={shareUrl}
                        size={48}
                        level="L"
                        bgColor="transparent"
                        fgColor="#0a0a0f"
                      />
                    </div>
                    <div className="text-foreground/15 text-[7px] font-mono mt-1">
                      {qrText}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {imageUrl && (
              <div className="w-full max-w-sm mt-4 p-3 rounded-xl glass border border-card-border">
                <div className="text-foreground/30 text-[10px] font-mono mb-2">
                  已生成图片（长按保存；或在桌面端右键保存）
                </div>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={imageUrl} alt="share-preview" className="w-full rounded-xl border border-foreground/5" />
                <div className="flex items-center justify-between mt-2">
                  <a
                    href={imageUrl}
                    download={imageFileName || "cyber-oracle.png"}
                    className="text-neon-cyan/70 text-[10px] font-mono underline"
                  >
                    下载图片
                  </a>
                  <button
                    className="text-foreground/25 text-[10px] font-mono"
                    onClick={() => setImageUrl((prev) => {
                      if (prev) URL.revokeObjectURL(prev);
                      return null;
                    })}
                  >
                    清除预览
                  </button>
                </div>
              </div>
            )}

            <div className="h-24" />
          </motion.div>
        </div>

        {/* Fixed action bar */}
        <div
          className="shrink-0 px-4 pb-[max(16px,env(safe-area-inset-bottom))] pt-3 bg-black/60 backdrop-blur-md border-t border-card-border"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex gap-3 w-full max-w-sm mx-auto">
            <motion.button
              onClick={save}
              disabled={isSaving}
              className="flex-1 py-3 rounded-xl bg-gradient-to-r from-neon-cyan/20 to-neon-purple/20 border border-neon-cyan/30 text-neon-cyan font-mono text-xs cursor-pointer disabled:opacity-50"
              whileTap={{ scale: 0.98 }}
            >
              {isSaving ? "生成中..." : imageUrl ? "💾 重新生成" : "💾 生成图片"}
            </motion.button>
            <motion.button
              onClick={shareImage}
              className="flex-1 py-3 rounded-xl bg-neon-pink/10 border border-neon-pink/30 text-neon-pink font-mono text-xs cursor-pointer"
              whileTap={{ scale: 0.98 }}
            >
              📤 分享图片
            </motion.button>
          </div>
        </div>
      </motion.div>
    );
  }
);

export default ShareableCard;
