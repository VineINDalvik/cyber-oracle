"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  SPREAD_TYPES, drawSpread, castTopicFortune, getTodayDateString,
  type SpreadType, type SpreadResult, type Hexagram, type GanZhi,
} from "@/lib/tarot";
import { recordCardSeen, recordReading } from "@/lib/collection";
import CardFace, { CardBack } from "./CardFace";
import ShareableCard from "./ShareableCard";
import PaymentGate from "./PaymentGate";

const TOPICS = [
  { id: "love", icon: "💘", name: "感情运", description: "塔罗 × 周易 × 五行 · 感情全维解读", price: "¥3.99" },
  { id: "career", icon: "💼", name: "事业运", description: "塔罗 × 周易 × 五行 · 事业全维解读", price: "¥3.99" },
  { id: "wealth", icon: "💰", name: "财运", description: "塔罗 × 周易 × 五行 · 财运全维解读", price: "¥3.99" },
  { id: "health", icon: "🏥", name: "健康", description: "塔罗 × 周易 × 五行 · 身心能量分析", price: "¥2.99" },
  { id: "social", icon: "🤝", name: "人际关系", description: "塔罗 × 周易 × 五行 · 社交场域解读", price: "¥2.99" },
];

export default function QuickDraw() {
  const [view, setView] = useState<"menu" | "spread" | "topic">("menu");
  const [phase, setPhase] = useState<"select" | "shuffling" | "revealing" | "revealed">("select");
  const [selectedSpread, setSelectedSpread] = useState<SpreadType | null>(null);
  const [selectedTopic, setSelectedTopic] = useState<typeof TOPICS[0] | null>(null);
  const [spreadResult, setSpreadResult] = useState<SpreadResult | null>(null);
  const [revealedIndices, setRevealedIndices] = useState<Set<number>>(new Set());

  // Topic fortune extras
  const [hexagram, setHexagram] = useState<Hexagram | null>(null);
  const [wuxingAnalysis, setWuxingAnalysis] = useState("");
  const [topicGanZhi, setTopicGanZhi] = useState<GanZhi | null>(null);

  const [showReading, setShowReading] = useState(false);
  const [reading, setReading] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [showPayment, setShowPayment] = useState(false);

  // ─── Spread flow (tarot only) ───────────────────────────────────

  const handleSpreadSelect = (spread: SpreadType) => {
    setSelectedSpread(spread);
    setPhase("shuffling");
    const result = drawSpread(spread);
    setSpreadResult(result);
    result.cards.forEach((c) => recordCardSeen(c.card.id));
    setTimeout(() => setPhase("revealing"), 1500);
  };

  // ─── Topic flow (tarot + 周易 + 五行 三体合一) ──────────────────

  const handleTopicSelect = (topic: typeof TOPICS[0]) => {
    setSelectedTopic(topic);
    setView("topic");
    const timelineSpread = SPREAD_TYPES[1];
    setSelectedSpread(timelineSpread);
    setPhase("shuffling");

    const fortune = castTopicFortune(topic.id, timelineSpread);
    setSpreadResult(fortune.spread);
    setHexagram(fortune.hexagram);
    setWuxingAnalysis(fortune.wuxingAnalysis);
    setTopicGanZhi(fortune.ganZhi);
    fortune.spread.cards.forEach((c) => recordCardSeen(c.card.id));

    setTimeout(() => setPhase("revealing"), 2000);
  };

  const revealCard = (index: number) => {
    if (phase !== "revealing" || revealedIndices.has(index)) return;
    setRevealedIndices((prev) => new Set(prev).add(index));
  };

  useEffect(() => {
    if (!selectedSpread || phase !== "revealing") return;
    if (revealedIndices.size === selectedSpread.cardCount) {
      setTimeout(() => setPhase("revealed"), 600);
    }
  }, [revealedIndices, selectedSpread, phase]);

  const reset = () => {
    setView("menu");
    setPhase("select");
    setSelectedSpread(null);
    setSelectedTopic(null);
    setSpreadResult(null);
    setRevealedIndices(new Set());
    setHexagram(null);
    setWuxingAnalysis("");
    setTopicGanZhi(null);
    setReading("");
    setShowReading(false);
  };

  // ─── AI Reading ─────────────────────────────────────────────────

  const requestReading = () => {
    if (reading) { setShowReading(!showReading); return; }
    setShowPayment(true);
  };

  const doFetchReading = async () => {
    if (!spreadResult || !selectedSpread) return;
    setShowReading(true);
    setIsStreaming(true);
    recordReading();

    const cardsSummary = spreadResult.cards.map((c) => {
      const state = c.isReversed ? "逆位" : "正位";
      return `位置「${c.position.name}」(${c.position.description})：赛博·${c.card.name}（${c.card.cyberName}）— ${state} — 牌义：${c.isReversed ? c.card.reversed : c.card.upright}`;
    }).join("\n");

    try {
      const mode = selectedTopic ? "topic" : "spread";
      const body: Record<string, unknown> = {
        mode,
        spreadName: selectedSpread.name,
        cards: cardsSummary,
      };

      if (selectedTopic) {
        body.topicId = selectedTopic.id;
        body.topicName = selectedTopic.name;
      }
      if (hexagram) {
        body.hexagramName = hexagram.name;
        body.hexagramSymbol = hexagram.symbol;
        body.hexagramNature = hexagram.nature;
        body.hexagramKeywords = hexagram.keywords;
        body.hexagramUpper = hexagram.upper;
        body.hexagramLower = hexagram.lower;
      }
      if (wuxingAnalysis) {
        body.wuxingAnalysis = wuxingAnalysis;
      }
      if (topicGanZhi) {
        body.ganZhi = `${topicGanZhi.gan}${topicGanZhi.zhi}日`;
        body.wuxing = topicGanZhi.wuxing;
        body.wuxingElement = topicGanZhi.wuxingElement;
      }

      const res = await fetch("/api/divine", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
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
      setReading("⚠️ 信号中断");
    } finally {
      setIsStreaming(false);
    }
  };

  const primaryResult = spreadResult?.cards[0];
  const shareResult = primaryResult
    ? { card: primaryResult.card, isReversed: primaryResult.isReversed, fortune: "", label: selectedTopic?.name ?? selectedSpread?.name ?? "" }
    : null;

  return (
    <div className="flex flex-col items-center min-h-[calc(100dvh-64px)] px-4 pt-5 pb-4">
      <AnimatePresence mode="wait">
        {/* ─── Menu ────────────────────────────────────────── */}
        {view === "menu" && phase === "select" && (
          <motion.div
            key="menu"
            className="flex flex-col items-center w-full max-w-sm"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
          >
            <div className="text-foreground/20 text-[10px] font-mono tracking-widest mb-1">TAROT SPREAD</div>
            <h2 className="text-lg font-bold neon-text tracking-wider mb-4">选择牌阵</h2>

            <div className="w-full space-y-2 mb-6">
              {SPREAD_TYPES.map((spread) => (
                <motion.button
                  key={spread.id}
                  onClick={() => { setView("spread"); handleSpreadSelect(spread); }}
                  className="w-full p-3 rounded-xl glass text-left cursor-pointer"
                  whileTap={{ scale: 0.98 }}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-neon-cyan text-sm font-bold">{spread.name}</span>
                    <span className="text-foreground/20 text-[10px] font-mono">{spread.cardCount}张</span>
                  </div>
                  <p className="text-foreground/30 text-xs">{spread.description}</p>
                </motion.button>
              ))}
            </div>

            {/* Topic readings — 三体合一 */}
            <div className="w-full">
              <div className="flex items-center gap-2 mb-3">
                <div className="text-foreground/20 text-[10px] font-mono tracking-widest">FORTUNE READING</div>
                <span className="text-neon-gold/60 text-[8px] font-mono px-1.5 py-0.5 rounded bg-neon-gold/5 border border-neon-gold/15">
                  算命 × 塔罗
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2">
                {TOPICS.map((topic) => (
                  <motion.button
                    key={topic.id}
                    onClick={() => handleTopicSelect(topic)}
                    className="p-3 rounded-xl glass text-left cursor-pointer"
                    whileTap={{ scale: 0.97 }}
                  >
                    <div className="text-xl mb-1">{topic.icon}</div>
                    <div className="text-foreground/70 text-xs font-bold mb-0.5">{topic.name}</div>
                    <div className="text-foreground/20 text-[9px] leading-tight">{topic.description}</div>
                    <div className="text-neon-gold/50 text-[9px] font-mono mt-1">{topic.price}</div>
                  </motion.button>
                ))}
              </div>
            </div>
          </motion.div>
        )}

        {/* ─── Shuffling ───────────────────────────────────── */}
        {phase === "shuffling" && (
          <motion.div
            key="shuffling"
            className="flex flex-col items-center justify-center flex-1"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            {selectedTopic && <div className="text-3xl mb-2">{selectedTopic.icon}</div>}
            <div className="relative w-40 h-60 mb-6">
              {[0, 1, 2, 3, 4].map((i) => (
                <motion.div
                  key={i}
                  className="absolute"
                  style={{ left: "50%", top: "50%", marginLeft: -48, marginTop: -80 }}
                  animate={{
                    x: [0, (i - 2) * 35, 0, (2 - i) * 25, 0],
                    y: [0, -20, 0, -15, 0],
                    rotate: [0, (i - 2) * 12, 0, (2 - i) * 8, 0],
                  }}
                  transition={{ duration: 1.2, ease: "easeInOut", delay: i * 0.04 }}
                >
                  <CardBack size="sm" />
                </motion.div>
              ))}
            </div>
            <p className="text-neon-purple text-xs font-mono animate-pulse">
              {selectedTopic ? `${selectedTopic.name} · 起卦布阵中...` : "混沌洗牌中..."}
            </p>
          </motion.div>
        )}

        {/* ─── Revealing & Revealed ────────────────────────── */}
        {(phase === "revealing" || phase === "revealed") && selectedSpread && spreadResult && (
          <motion.div
            key="revealing"
            className="flex flex-col items-center w-full"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            {/* Header */}
            {selectedTopic ? (
              <div className="text-center mb-2">
                <span className="text-2xl">{selectedTopic.icon}</span>
                <h2 className="text-sm font-bold neon-text tracking-wider">{selectedTopic.name}</h2>
              </div>
            ) : (
              <div className="text-foreground/20 text-[10px] font-mono tracking-widest mb-1">
                {selectedSpread.name.toUpperCase()}
              </div>
            )}

            <p className="text-foreground/30 text-[10px] font-mono mb-3">
              {phase === "revealing" ? `点击翻牌 · ${revealedIndices.size}/${selectedSpread.cardCount}` : "占卜完成"}
            </p>

            {/* ─── Topic: 三体面板 (hexagram + 五行 + tarot) ── */}
            {selectedTopic && hexagram && topicGanZhi && phase === "revealed" && (
              <motion.div
                className="w-full max-w-sm mb-4 space-y-2"
                initial={{ y: -10, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.2 }}
              >
                {/* Hexagram display */}
                <div className="flex gap-2">
                  <div className="flex-1 p-3 rounded-xl glass">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-2xl">{hexagram.symbol}</span>
                      <div>
                        <div className="text-neon-gold text-xs font-bold">{hexagram.name}卦</div>
                        <div className="text-foreground/20 text-[9px] font-mono">{hexagram.upper}上 · {hexagram.lower}下</div>
                      </div>
                    </div>
                    <div className="text-foreground/30 text-[9px] leading-relaxed mt-1">
                      {hexagram.nature} · {hexagram.keywords}
                    </div>
                  </div>
                  <div className="w-24 p-3 rounded-xl glass text-center">
                    <div className="text-neon-cyan/60 text-[9px] font-mono mb-1">{topicGanZhi.gan}{topicGanZhi.zhi}日</div>
                    <div className="text-neon-gold text-sm font-bold">{topicGanZhi.wuxingElement}</div>
                    <div className="text-foreground/20 text-[8px] font-mono">{topicGanZhi.wuxing}</div>
                    <div className="text-foreground/15 text-[8px] font-mono mt-0.5">{topicGanZhi.direction}方 · {topicGanZhi.color}色</div>
                  </div>
                </div>

                {/* 五行 topic analysis */}
                {wuxingAnalysis && (
                  <div className="p-2.5 rounded-lg bg-neon-gold/3 border border-neon-gold/10">
                    <div className="flex items-center gap-1 mb-1">
                      <span className="text-neon-gold/50 text-[9px] font-mono">五行 · {selectedTopic.name}</span>
                    </div>
                    <p className="text-foreground/40 text-[10px] leading-relaxed">{wuxingAnalysis}</p>
                  </div>
                )}

                {/* System label */}
                <div className="flex items-center justify-center gap-3 py-1">
                  <span className="text-[8px] font-mono px-2 py-0.5 rounded bg-neon-gold/5 text-neon-gold/40 border border-neon-gold/10">周易</span>
                  <span className="text-foreground/10 text-[8px]">×</span>
                  <span className="text-[8px] font-mono px-2 py-0.5 rounded bg-neon-cyan/5 text-neon-cyan/40 border border-neon-cyan/10">五行</span>
                  <span className="text-foreground/10 text-[8px]">×</span>
                  <span className="text-[8px] font-mono px-2 py-0.5 rounded bg-neon-purple/5 text-neon-purple/40 border border-neon-purple/10">塔罗</span>
                </div>
              </motion.div>
            )}

            {/* Cards layout */}
            <div className={`flex items-start justify-center gap-4 my-2 ${selectedSpread.cardCount === 1 ? "" : "flex-wrap"}`}>
              {spreadResult.cards.map((drawn, index) => {
                const isRevealed = revealedIndices.has(index);
                const isMulti = selectedSpread.cardCount > 1;
                const dims = isMulti ? { w: 96, h: 160 } : { w: 220, h: 367 };

                return (
                  <motion.div
                    key={index}
                    className="flex flex-col items-center"
                    initial={{ y: 40, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: index * 0.15 }}
                  >
                    <div className="text-neon-cyan/50 text-[10px] font-mono mb-2">{drawn.position.name}</div>
                    <div className="relative cursor-pointer" style={{ perspective: 800, width: dims.w, height: dims.h }} onClick={() => revealCard(index)}>
                      <motion.div className="w-full h-full" style={{ transformStyle: "preserve-3d" }} animate={{ rotateY: isRevealed ? 180 : 0 }} transition={{ duration: 0.6 }}>
                        <div className="absolute inset-0 flex items-center justify-center" style={{ backfaceVisibility: "hidden" }}><CardBack size={isMulti ? "sm" : "lg"} /></div>
                        <div className="absolute inset-0 flex items-center justify-center" style={{ backfaceVisibility: "hidden", transform: "rotateY(180deg)" }}><CardFace cardId={drawn.card.id} reversed={drawn.isReversed} size={isMulti ? "sm" : "lg"} /></div>
                      </motion.div>
                    </div>
                    {isRevealed && (
                      <motion.div className="text-center mt-2" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }}>
                        <div className="text-neon-cyan text-[10px] font-mono">赛博·{drawn.card.name}</div>
                        {drawn.isReversed && <div className="text-neon-pink text-[8px] font-mono">⟲ 逆位</div>}
                      </motion.div>
                    )}
                  </motion.div>
                );
              })}
            </div>

            {/* Actions */}
            {phase === "revealed" && (
              <motion.div className="w-full max-w-sm space-y-3 mt-4" initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.3 }}>
                {!showReading && !reading && (
                  <div className="p-3 rounded-xl bg-gradient-to-r from-neon-cyan/5 to-neon-purple/5 border border-dashed border-neon-cyan/10">
                    <p className="text-foreground/40 text-xs leading-relaxed">
                      {selectedTopic && hexagram
                        ? `${hexagram.name}卦 × ${topicGanZhi?.wuxingElement}行 × 塔罗三牌……三套命理体系的交叉解读即将揭示你的${selectedTopic.name}走向`
                        : `${selectedSpread.name}牌阵已完成。${spreadResult.cards.length}张牌的能量交织中隐藏着什么信号？`}
                    </p>
                  </div>
                )}
                <div className="flex gap-3">
                  <motion.button onClick={requestReading} className="flex-1 py-3 rounded-xl bg-gradient-to-r from-neon-cyan/15 to-neon-purple/15 border border-neon-cyan/20 text-neon-cyan text-xs font-mono cursor-pointer" whileTap={{ scale: 0.98 }}>
                    {reading ? (showReading ? "📖 收起" : "📖 查看") : "🔓 解锁完整解读"}
                  </motion.button>
                  {shareResult && (
                    <motion.button onClick={() => setShowShare(true)} className="py-3 px-4 rounded-xl glass text-foreground/40 text-xs font-mono cursor-pointer" whileTap={{ scale: 0.98 }}>💾</motion.button>
                  )}
                </div>
                <button onClick={reset} className="w-full text-foreground/15 text-xs font-mono cursor-pointer text-center py-1">⟳ 返回</button>
              </motion.div>
            )}

            <AnimatePresence>
              {showReading && (
                <motion.div className="w-full max-w-sm mt-4 p-4 rounded-xl glass" initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}>
                  {reading ? (
                    <div className="text-sm leading-7 text-foreground/70 whitespace-pre-wrap">
                      {reading}
                      {isStreaming && <motion.span className="inline-block w-2 h-4 bg-neon-cyan ml-1 align-middle" animate={{ opacity: [1, 0] }} transition={{ duration: 0.8, repeat: Infinity }} />}
                    </div>
                  ) : (
                    <div className="text-center text-foreground/30 text-xs font-mono animate-pulse">三体融合解读中...</div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>

            <AnimatePresence>
              {showShare && shareResult && (
                <ShareableCard result={shareResult} mode="draw" dateStr={getTodayDateString()} visible={showShare} onClose={() => setShowShare(false)} />
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>

      <PaymentGate
        title={selectedTopic ? `${selectedTopic.name} · 三体解读` : "解锁完整解读"}
        description={selectedTopic ? `周易 × 五行 × 塔罗 三体融合解读` : `${selectedSpread?.name ?? ""} AI 深度解析`}
        price={selectedTopic?.price ?? "¥1.99"}
        visible={showPayment}
        onClose={() => setShowPayment(false)}
        onUnlocked={() => { setShowPayment(false); doFetchReading(); }}
      />
    </div>
  );
}
