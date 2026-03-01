"use client";

import { useRef, useState, forwardRef, useImperativeHandle } from "react";
import { motion } from "framer-motion";
import { QRCodeSVG } from "qrcode.react";
import type { DrawnResult, GanZhi } from "@/lib/tarot";
import CardFace from "./CardFace";

interface ShareableCardProps {
  result: DrawnResult;
  mode: string;
  dateStr: string;
  visible: boolean;
  onClose: () => void;
  ganZhi?: GanZhi;
}

export interface ShareableCardHandle {
  save: () => Promise<void>;
}

const ShareableCard = forwardRef<ShareableCardHandle, ShareableCardProps>(
  function ShareableCard({ result, mode, dateStr, visible, onClose, ganZhi }, ref) {
    const cardRef = useRef<HTMLDivElement>(null);
    const [isSaving, setIsSaving] = useState(false);
    const shareUrl = "https://cyber.vinex.top";

    const modeLabel =
      mode === "daily" ? "每日赛博签" : mode === "draw" ? "赛博抽签" : "赛博解梦";

    const save = async () => {
      if (!cardRef.current || isSaving) return;
      setIsSaving(true);
      try {
        const html2canvas = (await import("html2canvas")).default;
        const canvas = await html2canvas(cardRef.current, {
          backgroundColor: "#0a0a0f",
          scale: 2,
          useCORS: true,
        });
        const fileName = `cyber-oracle-${result.card.name}-${dateStr}.png`;

        // Mobile-first: try share as file (works better than "download" in many webviews).
        const canShareFiles = (() => {
          try {
            const nav = navigator as unknown as { canShare?: Function; share?: Function };
            return !!nav.canShare && !!nav.share;
          } catch {
            return false;
          }
        })();

        const blob: Blob | null = await new Promise((resolve) =>
          canvas.toBlob((b) => resolve(b), "image/png", 1)
        );

        if (blob && canShareFiles) {
          try {
            const file = new File([blob], fileName, { type: "image/png" });
            const nav = navigator as unknown as {
              canShare?: (data: { files: File[] }) => boolean;
              share?: (data: { title?: string; text?: string; files?: File[] }) => Promise<void>;
            };
            if (!nav.canShare || nav.canShare({ files: [file] })) {
              await nav.share?.({
                title: "赛博神算子",
                text: "我抽到了这张牌",
                files: [file],
              });
              return;
            }
          } catch {
            // fall through
          }
        }

        // Desktop / fallback: trigger download if supported.
        try {
          const link = document.createElement("a");
          link.download = fileName;
          link.href = canvas.toDataURL("image/png");
          link.click();
          return;
        } catch {
          // fall through
        }

        // Last resort: open in a new tab so user can long-press save.
        try {
          const dataUrl = canvas.toDataURL("image/png");
          window.open(dataUrl, "_blank");
        } catch {
          // ignore
        }
      } catch {
        alert("保存失败：建议点击后长按图片保存，或直接截图。");
      } finally {
        setIsSaving(false);
      }
    };

    useImperativeHandle(ref, () => ({ save }));

    if (!visible) return null;

    return (
      <motion.div
        className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm overflow-y-auto"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      >
        <div className="min-h-[100dvh] flex items-center justify-center px-4 py-6">
          <motion.div
            className="flex flex-col items-center max-w-sm w-full"
            initial={{ scale: 0.9, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-full flex justify-end mb-2">
              <button onClick={onClose} className="text-foreground/30 text-xs font-mono px-3 py-1.5 rounded-lg glass cursor-pointer">
                关闭
              </button>
            </div>

            {/* The shareable card */}
            <div
              ref={cardRef}
              className="w-full rounded-2xl overflow-hidden border border-card-border bg-[#0a0a0f]"
            >
              {/* Card visual - hero area */}
              <div className="flex justify-center pt-8 pb-4 bg-gradient-to-b from-card-dark to-surface">
                <CardFace
                  cardId={result.card.id}
                  reversed={result.isReversed}
                  size="lg"
                />
              </div>

              {/* Content area */}
              <div className="px-6 pb-6">
                <div className="border-t border-dashed border-foreground/10 mb-4" />

                {/* Fortune text */}
                <p className="text-foreground/70 text-sm leading-relaxed text-center mb-4">
                  {result.fortune}
                </p>

                {/* Label stamp */}
                <div className="flex justify-center mb-4">
                  <div className="stamp text-xs">{result.label}</div>
                </div>

                {/* Footer */}
                <div className="flex items-end justify-between">
                  <div className="text-foreground/20 text-[8px] font-mono leading-relaxed">
                    <div>CYBER ORACLE</div>
                    <div>{modeLabel}</div>
                    <div>{dateStr}</div>
                    {ganZhi && (
                      <div className="text-neon-gold/30 mt-0.5">{ganZhi.gan}{ganZhi.zhi}日 · {ganZhi.wuxing}</div>
                    )}
                    <div className="text-neon-cyan/30 mt-0.5">
                      赛博·{result.card.name}
                      {result.isReversed ? " ⟲逆位" : " ⬆正位"}
                    </div>
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
                      扫码打开 cyber.vinex.top
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex gap-3 mt-4 w-full sticky bottom-4">
              <motion.button
                onClick={save}
                disabled={isSaving}
                className="flex-1 py-3 rounded-xl bg-gradient-to-r from-neon-cyan/20 to-neon-purple/20 border border-neon-cyan/30 text-neon-cyan font-mono text-xs cursor-pointer disabled:opacity-50"
                whileTap={{ scale: 0.98 }}
              >
                {isSaving ? "生成中..." : "💾 保存图片"}
              </motion.button>
              <motion.button
                onClick={() => {
                  const text = `今天的赛博签是「赛博·${result.card.name}」—— ${result.label}`;
                  if (navigator.share) {
                    navigator.share({ title: "赛博神算子", text, url: shareUrl });
                  } else {
                    navigator.clipboard.writeText(`${text} ${shareUrl}`);
                    alert("已复制到剪贴板！");
                  }
                }}
                className="flex-1 py-3 rounded-xl bg-neon-pink/10 border border-neon-pink/30 text-neon-pink font-mono text-xs cursor-pointer"
                whileTap={{ scale: 0.98 }}
              >
                📤 分享
              </motion.button>
            </div>
          </motion.div>
        </div>
      </motion.div>
    );
  }
);

export default ShareableCard;
