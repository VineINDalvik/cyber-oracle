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
    const shareUrl = typeof window !== "undefined" ? window.location.origin : "";

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
        const link = document.createElement("a");
        link.download = `cyber-oracle-${result.card.name}-${dateStr}.png`;
        link.href = canvas.toDataURL("image/png");
        link.click();
      } catch {
        alert("保存失败，请尝试长按截图");
      } finally {
        setIsSaving(false);
      }
    };

    useImperativeHandle(ref, () => ({ save }));

    if (!visible) return null;

    return (
      <motion.div
        className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-black/80 backdrop-blur-sm"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      >
        <motion.div
          className="flex flex-col items-center max-w-sm w-full"
          initial={{ scale: 0.9, y: 20 }}
          animate={{ scale: 1, y: 0 }}
          onClick={(e) => e.stopPropagation()}
        >
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
                  <div className="p-1.5 bg-white rounded-md">
                    <QRCodeSVG
                      value={shareUrl || "https://cyber.vinex.top"}
                      size={48}
                      level="L"
                    />
                  </div>
                  <div className="text-foreground/15 text-[7px] font-mono mt-1">
                    扫码抽你的签
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex gap-3 mt-4 w-full">
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
      </motion.div>
    );
  }
);

export default ShareableCard;
