"use client";

import { useCallback, useEffect, useMemo, useRef, useState, forwardRef, useImperativeHandle } from "react";
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
    const [generating, setGenerating] = useState(false);
    const [previewSrc, setPreviewSrc] = useState<string | null>(null);
    const shareUrl = "https://cyber.vinex.top";

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

    const closePreview = useCallback(() => {
      setPreviewSrc((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });
    }, []);

    useEffect(() => {
      return () => {
        if (previewSrc) URL.revokeObjectURL(previewSrc);
      };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const handleSave = useCallback(async () => {
      const el = cardRef.current;
      if (!el || generating) return;

      setGenerating(true);
      try {
        const isMobile = /iPhone|iPad|Android|Mobile/i.test(navigator.userAgent);
        const { default: html2canvas } = await import("html2canvas");
        const canvas = await html2canvas(el, {
          scale: isMobile ? 2 : 3,
          backgroundColor: "#0a0a0f",
          useCORS: true,
        });

        const blob: Blob = await new Promise((resolve, reject) => {
          canvas.toBlob((b) => {
            if (b) resolve(b);
            else reject(new Error("toBlob failed"));
          }, "image/png");
        });
        const url = URL.createObjectURL(blob);
        const fileName = `cyber-oracle-${modeMeta.label}-${result.card.name}-${dateStr}.png`;

        if (isMobile) {
          setPreviewSrc(url);
        } else {
          const link = document.createElement("a");
          link.download = fileName;
          link.href = url;
          link.click();
          setTimeout(() => URL.revokeObjectURL(url), 5000);
        }
      } catch (err) {
        console.error("ShareableCard generate failed:", err);
        alert("生成失败，请直接截图保存");
      } finally {
        setGenerating(false);
      }
    }, [generating, modeMeta.label, result.card.name, dateStr]);

    const handleShare = useCallback(async () => {
      const el = cardRef.current;
      if (!el || generating) return;

      setGenerating(true);
      try {
        const { default: html2canvas } = await import("html2canvas");
        const canvas = await html2canvas(el, {
          scale: 2,
          backgroundColor: "#0a0a0f",
          useCORS: true,
        });
        const blob: Blob = await new Promise((resolve, reject) => {
          canvas.toBlob((b) => {
            if (b) resolve(b);
            else reject(new Error("toBlob failed"));
          }, "image/png");
        });
        const fileName = `cyber-oracle-${modeMeta.label}-${result.card.name}-${dateStr}.png`;
        const file = new File([blob], fileName, { type: "image/png" });

        const nav = navigator as unknown as {
          canShare?: (data: { files: File[] }) => boolean;
          share?: (data: { title?: string; text?: string; files?: File[]; url?: string }) => Promise<void>;
        };
        if (nav.share && (!nav.canShare || nav.canShare({ files: [file] }))) {
          await nav.share({
            title: "赛博神算子",
            text: `${modeMeta.label} · ${result.card.name}`,
            files: [file],
          });
        } else if (navigator.share) {
          const text = `${modeMeta.label} · 赛博·${result.card.name} —— ${labelForCard}`;
          await navigator.share({ title: "赛博神算子", text, url: shareUrl });
        } else {
          const text = `${modeMeta.label} · 赛博·${result.card.name} —— ${labelForCard} ${shareUrl}`;
          await navigator.clipboard.writeText(text);
          alert("已复制链接到剪贴板");
        }
      } catch {
        // user cancelled or share failed
      } finally {
        setGenerating(false);
      }
    }, [generating, modeMeta.label, result.card.name, dateStr, labelForCard, shareUrl]);

    useImperativeHandle(ref, () => ({ save: handleSave }));

    if (!visible) return null;

    return (
      <>
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
            <button
              onClick={onClose}
              className="flex items-center gap-1.5 text-neon-cyan/70 text-xs font-mono px-3 py-1.5 rounded-lg glass cursor-pointer"
            >
              ⟵ 返回
            </button>
            <div className="text-foreground/30 text-[10px] font-mono tracking-widest">
              {modeMeta.icon} {modeMeta.label}
            </div>
          </div>

          {/* Scrollable card content */}
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
                onClick={handleSave}
                disabled={generating}
                className="flex-1 py-3 rounded-xl bg-gradient-to-r from-neon-cyan/20 to-neon-purple/20 border border-neon-cyan/30 text-neon-cyan font-mono text-xs cursor-pointer disabled:opacity-50"
                whileTap={{ scale: 0.98 }}
              >
                {generating ? "⏳ 生成中..." : "💾 保存图片"}
              </motion.button>
              <motion.button
                onClick={handleShare}
                disabled={generating}
                className="flex-1 py-3 rounded-xl bg-neon-pink/10 border border-neon-pink/30 text-neon-pink font-mono text-xs cursor-pointer disabled:opacity-50"
                whileTap={{ scale: 0.98 }}
              >
                📤 分享
              </motion.button>
            </div>
          </div>
        </motion.div>

        {/* Mobile full-screen image preview for long-press save */}
        {previewSrc && (
          <div
            className="fixed inset-0 z-[60] bg-black/95 flex flex-col items-center justify-center"
            onClick={closePreview}
          >
            <p className="text-foreground/50 text-xs font-mono mb-4">
              长按图片保存到相册
            </p>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={previewSrc}
              alt="分享卡片"
              className="max-w-[90vw] max-h-[75vh] rounded-xl border border-card-border"
            />
            <button
              onClick={closePreview}
              className="mt-6 px-6 py-2.5 rounded-xl glass text-foreground/40 text-xs font-mono cursor-pointer"
            >
              关闭预览
            </button>
          </div>
        )}
      </>
    );
  }
);

export default ShareableCard;
