"use client";

import { useState, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { dreamDraw, getTodayDateString } from "@/lib/tarot";
import type { DrawnResult } from "@/lib/tarot";
import { recordCardSeen, recordReading } from "@/lib/collection";
import CardFace from "./CardFace";
import ShareableCard from "./ShareableCard";
import PaymentGate from "./PaymentGate";

const DREAM_HINTS = [
  "我梦到自己在飞…",
  "梦见大水淹没了城市…",
  "梦到蛇缠绕在手臂上…",
  "梦见考试但什么都不会…",
  "梦到已故的亲人…",
  "梦见在黑暗中寻找出口…",
  "梦到掉牙了…",
  "梦见自己在追赶什么…",
];

export default function DreamDecode() {
  const [dream, setDream] = useState("");
  const [phase, setPhase] = useState<"input" | "analyzing" | "result">("input");
  const [result, setResult] = useState<DrawnResult | null>(null);
  const [reading, setReading] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [showPayment, setShowPayment] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const [hintIndex] = useState(() => Math.floor(Math.random() * DREAM_HINTS.length));

  const startAnalysis = useCallback(() => {
    if (!dream.trim() || dream.trim().length < 4) return;
    setPhase("analyzing");
    const drawnResult = dreamDraw(dream);
    setResult(drawnResult);
    recordCardSeen(drawnResult.card.id);
    setTimeout(() => setPhase("result"), 1200);
  }, [dream]);

  const requestReading = () => {
    setShowPayment(true);
  };

  const doFetchReading = useCallback(async () => {
    if (!result) return;
    setIsStreaming(true);
    recordReading();

    try {
      const res = await fetch("/api/divine", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "dream",
          dreamText: dream,
          card: `赛博·${result.card.name}（${result.card.cyberName}）`,
          cardMeaning: result.isReversed ? result.card.reversed : result.card.upright,
          isReversed: result.isReversed,
          element: result.card.element,
        }),
      });

      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      let text = "";
      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          text += decoder.decode(value, { stream: true });
          setReading(text);
        }
      }
    } catch {
      setReading("⚠️ 信号中断，请稍后再试");
    } finally {
      setIsStreaming(false);
    }
  }, [dream, result]);

  const reset = () => {
    setDream("");
    setPhase("input");
    setResult(null);
    setReading("");
    setIsStreaming(false);
  };

  return (
    <div className="flex flex-col items-center min-h-[calc(100dvh-64px)] px-4 pt-5 pb-4">
      <AnimatePresence mode="wait">
        {/* Input */}
        {phase === "input" && (
          <motion.div
            key="input"
            className="flex flex-col items-center w-full max-w-sm"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
          >
            <div className="text-foreground/20 text-[10px] font-mono tracking-widest mb-1">
              DREAM DECODER
            </div>
            <h2 className="text-lg font-bold neon-text-purple tracking-wider mb-1">梦境解码</h2>
            <p className="text-foreground/30 text-xs mb-6">
              周公解梦 × 赛博塔罗，双重视角解析
            </p>

            <div className="w-full rounded-xl glass p-4 mb-4">
              <textarea
                ref={textareaRef}
                value={dream}
                onChange={(e) => setDream(e.target.value)}
                className="w-full bg-transparent text-sm text-foreground/80 resize-none outline-none min-h-[120px] placeholder:text-foreground/15 leading-relaxed"
                placeholder={DREAM_HINTS[hintIndex]}
                maxLength={500}
              />
              <div className="flex items-center justify-between mt-2">
                <span className="text-foreground/15 text-[10px] font-mono">{dream.length}/500</span>
              </div>
            </div>

            <motion.button
              onClick={startAnalysis}
              disabled={dream.trim().length < 4}
              className="w-full py-4 rounded-xl bg-gradient-to-r from-neon-purple/20 to-neon-pink/20 border border-neon-purple/30 text-neon-purple font-mono text-sm disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
              whileTap={{ scale: 0.98 }}
            >
              🔮 解析梦境
            </motion.button>
          </motion.div>
        )}

        {/* Analyzing */}
        {phase === "analyzing" && (
          <motion.div
            key="analyzing"
            className="flex flex-col items-center justify-center flex-1"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="w-20 h-20 rounded-full border border-neon-purple/30"
              animate={{
                scale: [1, 1.3, 1],
                borderColor: ["rgba(168,85,247,0.3)", "rgba(236,72,153,0.5)", "rgba(168,85,247,0.3)"],
                boxShadow: ["0 0 20px rgba(168,85,247,0.1)", "0 0 60px rgba(236,72,153,0.3)", "0 0 20px rgba(168,85,247,0.1)"],
              }}
              transition={{ duration: 2, repeat: Infinity }}
            />
            <p className="text-neon-purple/60 text-xs font-mono mt-4 animate-pulse">
              正在解析梦境信号...
            </p>
          </motion.div>
        )}

        {/* Result */}
        {phase === "result" && result && (
          <motion.div
            key="result"
            className="flex flex-col items-center w-full max-w-sm"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <div className="text-foreground/20 text-[10px] font-mono tracking-widest mb-1">
              DREAM MATCHED
            </div>
            <h2 className="text-sm font-bold neon-text-purple tracking-wider mb-4">
              你的梦境对应：赛博·{result.card.name}
            </h2>

            <motion.div
              className="mb-4"
              initial={{ scale: 0.5, rotate: -15, opacity: 0 }}
              animate={{ scale: 1, rotate: 0, opacity: 1 }}
              transition={{ type: "spring", stiffness: 200, damping: 15 }}
            >
              <CardFace cardId={result.card.id} reversed={result.isReversed} size="md" />
            </motion.div>

            {/* Dream excerpt */}
            <div className="w-full px-3 py-2 mb-4 rounded-lg bg-neon-purple/5 border border-neon-purple/10">
              <p className="text-foreground/30 text-[10px] font-mono mb-1">你的梦境：</p>
              <p className="text-foreground/50 text-xs leading-relaxed line-clamp-3">{dream}</p>
            </div>

            {/* Teaser or reading */}
            {!reading ? (
              <>
                <div className="w-full p-3 rounded-xl bg-gradient-to-r from-neon-purple/5 to-neon-pink/5 border border-dashed border-neon-purple/10 mb-4">
                  <p className="text-foreground/30 text-xs leading-relaxed text-center">
                    赛博·{result.card.name}与你的梦境产生了共振，周公解梦 × 塔罗原型的双重解析即将揭示...
                  </p>
                </div>
                <motion.button
                  onClick={requestReading}
                  className="w-full py-4 rounded-xl bg-gradient-to-r from-neon-purple/15 to-neon-pink/15 border border-neon-purple/20 text-neon-purple text-sm font-mono cursor-pointer mb-3"
                  whileTap={{ scale: 0.98 }}
                >
                  📖 查看梦境解读
                </motion.button>
              </>
            ) : (
              <div className="w-full rounded-xl glass p-4 mb-4">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-neon-cyan text-[10px] font-mono">周公 × 塔罗 双重解析</span>
                </div>
                <div className="text-sm leading-7 text-foreground/70 whitespace-pre-wrap">
                  {reading}
                  {isStreaming && (
                    <motion.span className="inline-block w-2 h-4 bg-neon-purple ml-1 align-middle"
                      animate={{ opacity: [1, 0] }} transition={{ duration: 0.8, repeat: Infinity }} />
                  )}
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-3 w-full">
              <button onClick={reset} className="flex-1 py-3 rounded-xl glass text-foreground/40 text-xs font-mono cursor-pointer">
                ⟳ 解析新梦境
              </button>
              <button onClick={() => setShowShare(true)} className="flex-1 py-3 rounded-xl bg-gradient-to-r from-neon-purple/15 to-neon-pink/15 border border-neon-purple/20 text-neon-purple text-xs font-mono cursor-pointer">
                💾 保存
              </button>
            </div>

            <AnimatePresence>
              {showShare && (
                <ShareableCard
                  result={{
                    ...result,
                    fortune: `梦境摘录：${dream.trim().slice(0, 72)}${dream.trim().length > 72 ? "…" : ""}`,
                    label: "梦境解码",
                  }}
                  mode="dream"
                  title="梦境解码"
                  subtitle="周公 × 塔罗"
                  dateStr={getTodayDateString()}
                  visible={showShare}
                  onClose={() => setShowShare(false)}
                  qrHintText="扫码体验梦境解码"
                />
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Payment gate */}
      <PaymentGate
        title="梦境解码"
        description="周公解梦 × 塔罗原型 双重解析"
        price=""
        visible={showPayment}
        onClose={() => setShowPayment(false)}
        onUnlocked={() => { setShowPayment(false); doFetchReading(); }}
      />
    </div>
  );
}
