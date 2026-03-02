"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  SPREAD_TYPES, castTopicFortune, generateBriefReading, getTodayDateString, drawOneCard,
  type SpreadType, type SpreadResult, type Hexagram, type GanZhi, type TopicFortune,
} from "@/lib/tarot";
import { recordCardSeen, recordReading } from "@/lib/collection";
import CardFace, { CardBack } from "./CardFace";
import ShareableCard from "./ShareableCard";
import PaymentGate from "./PaymentGate";

const TOPICS = [
  { id: "love", icon: "💘", name: "感情运", description: "塔罗 × 周易 × 五行 · 感情全维解读" },
  { id: "career", icon: "💼", name: "事业运", description: "塔罗 × 周易 × 五行 · 事业全维解读" },
  { id: "wealth", icon: "💰", name: "财运", description: "塔罗 × 周易 × 五行 · 财运全维解读" },
  { id: "health", icon: "🏥", name: "健康", description: "塔罗 × 周易 × 五行 · 身心能量分析" },
  { id: "social", icon: "🤝", name: "人际关系", description: "塔罗 × 周易 × 五行 · 社交场域解读" },
  {
    id: "open",
    icon: "🧩",
    name: "自由提问",
    description: "写下你今天最想问的一句话 · 三体合一给你一个可执行的答案",
    requiresQuestion: true,
  },
];

export default function QuickDraw() {
  const [view, setView] = useState<"menu" | "spread" | "topic" | "topicQuestion">("menu");
  const [phase, setPhase] = useState<"select" | "shuffling" | "table" | "revealed">("select");
  const [selectedSpread, setSelectedSpread] = useState<SpreadType | null>(null);
  const [selectedTopic, setSelectedTopic] = useState<typeof TOPICS[0] | null>(null);
  const [spreadResult, setSpreadResult] = useState<SpreadResult | null>(null);
  const [pickIndex, setPickIndex] = useState(0);
  const [tableCards, setTableCards] = useState<Array<{ id: string; rot: number; y: number; x: number }>>([]);
  const [removedIds, setRemovedIds] = useState<Set<string>>(new Set());
  const [hoverId, setHoverId] = useState<string | null>(null);
  const shuffleCountRef = useRef(0);
  const sessionSeedRef = useRef<number>(Date.now());
  const [topicQuestion, setTopicQuestion] = useState("");

  // Topic fortune extras
  const [hexagram, setHexagram] = useState<Hexagram | null>(null);
  const [wuxingAnalysis, setWuxingAnalysis] = useState("");
  const [topicGanZhi, setTopicGanZhi] = useState<GanZhi | null>(null);
  const [topicFortune, setTopicFortune] = useState<TopicFortune | null>(null);
  const [briefReading, setBriefReading] = useState("");

  const [showReading, setShowReading] = useState(false);
  const [reading, setReading] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [showPayment, setShowPayment] = useState(false);

  const currentPos = useMemo(() => {
    if (!selectedSpread) return null;
    return selectedSpread.positions[Math.min(pickIndex, selectedSpread.positions.length - 1)];
  }, [selectedSpread, pickIndex]);

  const makeTableCards = (salt: number) => {
    const base = sessionSeedRef.current + salt * 97 + shuffleCountRef.current * 131;
    const mk = (i: number) => {
      const n = (base + i * 997) % 1000;
      const rot = ((n % 13) - 6) * 2.2;
      const x = ((n % 7) - 3) * 4;
      const y = ((Math.floor(n / 7) % 5) - 2) * 3;
      return { id: `t${salt}_${i}_${base}`, rot, x, y };
    };
    return Array.from({ length: 7 }, (_, i) => mk(i));
  };

  const startTable = () => {
    shuffleCountRef.current = 0;
    setRemovedIds(new Set());
    setHoverId(null);
    setPickIndex(0);
    setSpreadResult(null);
    setTableCards(makeTableCards(1));
    setPhase("shuffling");
    setTimeout(() => setPhase("table"), 900);
  };

  const reshuffleTable = () => {
    if (pickIndex > 0) return;
    shuffleCountRef.current += 1;
    setRemovedIds(new Set());
    setHoverId(null);
    setTableCards(makeTableCards(1 + shuffleCountRef.current));
  };

  const refillTableIfNeeded = () => {
    const remaining = tableCards.filter((c) => !removedIds.has(c.id)).length;
    if (remaining >= 2) return;
    shuffleCountRef.current += 1;
    setRemovedIds(new Set());
    setHoverId(null);
    setTableCards(makeTableCards(1 + shuffleCountRef.current));
  };

  const pickFromTable = (tableId: string) => {
    if (!selectedSpread) return;
    if (phase !== "table") return;
    if (removedIds.has(tableId)) return;
    if (pickIndex >= selectedSpread.cardCount) return;

    const usedIds = spreadResult?.cards.map((c) => c.card.id) ?? [];
    const pos = selectedSpread.positions[pickIndex];
    const seedStr = [
      `qd:${sessionSeedRef.current}`,
      `view:${view}`,
      selectedTopic ? `topic:${selectedTopic.id}` : "",
      selectedTopic ? `q:${topicQuestion.trim().slice(0, 80)}` : "",
      `sh:${shuffleCountRef.current}`,
      `pick:${pickIndex}`,
      `table:${tableId}`,
    ].filter(Boolean).join("|");

    const drawn = drawOneCard(seedStr, usedIds);
    recordCardSeen(drawn.card.id);

    const nextCards = [...(spreadResult?.cards ?? [])];
    nextCards.push({ card: drawn.card, isReversed: drawn.isReversed, position: pos });
    const nextResult: SpreadResult = { cards: nextCards };
    setSpreadResult(nextResult);

    if (selectedTopic && topicFortune) {
      const merged: TopicFortune = { ...topicFortune, spread: nextResult };
      setTopicFortune(merged);
      setBriefReading(generateBriefReading(merged, selectedTopic.name));
    }

    setRemovedIds((prev) => {
      const n = new Set(prev);
      n.add(tableId);
      return n;
    });
    setPickIndex((i) => i + 1);

    setTimeout(() => {
      // When finished, move to revealed stage.
      const nextPick = pickIndex + 1;
      if (nextPick >= selectedSpread.cardCount) setPhase("revealed");
      else refillTableIfNeeded();
    }, 250);
  };

  // ─── Spread flow (tarot only) ───────────────────────────────────

  const handleSpreadSelect = (spread: SpreadType) => {
    sessionSeedRef.current = Date.now();
    setSelectedTopic(null);
    setSelectedSpread(spread);
    setView("spread");
    setHexagram(null);
    setWuxingAnalysis("");
    setTopicGanZhi(null);
    setTopicFortune(null);
    setBriefReading("");
    setTopicQuestion("");
    startTable();
  };

  // ─── Topic flow (tarot + 周易 + 五行 三体合一) ──────────────────

  const startTopicFortune = (topic: typeof TOPICS[0]) => {
    sessionSeedRef.current = Date.now();
    setSelectedTopic(topic);
    setView("topic");
    const timelineSpread = SPREAD_TYPES[1];
    setSelectedSpread(timelineSpread);
    setPhase("shuffling");

    const fortune = castTopicFortune(topic.id, timelineSpread, sessionSeedRef.current);
    setTopicFortune(fortune);
    setHexagram(fortune.hexagram);
    setWuxingAnalysis(fortune.wuxingAnalysis);
    setTopicGanZhi(fortune.ganZhi);
    // tarot cards are picked by user on table
    setRemovedIds(new Set());
    setHoverId(null);
    setPickIndex(0);
    setSpreadResult(null);
    setTableCards(makeTableCards(1));
    setTimeout(() => setPhase("table"), 900);
  };

  const handleTopicSelect = (topic: typeof TOPICS[0]) => {
    setSelectedTopic(topic);
    setTopicQuestion("");

    // Only "open scenario" uses custom question step.
    if ((topic as any).requiresQuestion) {
      setView("topicQuestion");
      setPhase("select");
      return;
    }

    // Other 5 topics: no question step (one-tap start)
    startTopicFortune(topic);
  };

  const reset = () => {
    setView("menu");
    setPhase("select");
    setSelectedSpread(null);
    setSelectedTopic(null);
    setSpreadResult(null);
    setPickIndex(0);
    setTableCards([]);
    setRemovedIds(new Set());
    setHoverId(null);
    setHexagram(null);
    setWuxingAnalysis("");
    setTopicGanZhi(null);
    setTopicFortune(null);
    setBriefReading("");
    setTopicQuestion("");
    setReading("");
    setShowReading(false);
  };

  const backFromResult = () => {
    if (selectedTopic) {
      setView("topicQuestion");
      setPhase("select");
      setReading("");
      setShowReading(false);
      setSpreadResult(null);
      setPickIndex(0);
      setRemovedIds(new Set());
      setHoverId(null);
      setTableCards([]);
      return;
    }
    reset();
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
        if (topicQuestion.trim()) body.question = topicQuestion.trim();
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
    ? {
        card: primaryResult.card,
        isReversed: primaryResult.isReversed,
        fortune: selectedTopic
          ? [
              topicQuestion.trim() ? `你的问题：${topicQuestion.trim()}` : "",
              briefReading || `主题：${selectedTopic.name}`,
            ].filter(Boolean).join("\n")
          : `牌阵「${selectedSpread?.name ?? ""}」已揭示关键牌：赛博·${primaryResult.card.name}`,
        label: selectedTopic ? "主题占卜" : "牌阵占卜",
      }
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
                  主题占卜
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
                    <div className="text-neon-cyan/40 text-[9px] font-mono mt-1">
                      {(topic as any).requiresQuestion ? "写下问题 →" : "免费起卦 →"}
                    </div>
                  </motion.button>
                ))}
              </div>
            </div>
          </motion.div>
        )}

        {/* ─── Topic question ─────────────────────────────── */}
        {view === "topicQuestion" && selectedTopic && phase === "select" && (
          <motion.div
            key="topicQuestion"
            className="flex flex-col items-center w-full max-w-sm"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
          >
            <div className="text-foreground/20 text-[10px] font-mono tracking-widest mb-1">FORTUNE READING</div>
            <div className="text-3xl mb-1">{selectedTopic.icon}</div>
            <h2 className="text-lg font-bold neon-text tracking-wider mb-2">{selectedTopic.name}</h2>
            <p className="text-foreground/30 text-xs mb-4 text-center">
              一句话问清楚，解读会更准。
            </p>

            <textarea
              value={topicQuestion}
              onChange={(e) => setTopicQuestion(e.target.value)}
              placeholder="例如：我该不该离职？这段关系还有必要继续吗？我现在该怎么破局？"
              className="w-full min-h-24 px-4 py-3 rounded-xl glass text-foreground/70 text-sm outline-none placeholder:text-foreground/15"
              maxLength={120}
            />
            <div className="w-full text-right text-foreground/15 text-[10px] font-mono mt-1">
              {topicQuestion.length}/120
            </div>

            <motion.button
              onClick={() => {
                if (topicQuestion.trim().length < 3) return;
                startTopicFortune(selectedTopic);
              }}
              disabled={topicQuestion.trim().length < 3}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-neon-cyan/15 to-neon-purple/15 border border-neon-cyan/20 text-neon-cyan text-sm font-mono cursor-pointer mt-4 disabled:opacity-40"
              whileTap={{ scale: 0.98 }}
            >
              🔀 开始洗牌
            </motion.button>

            <button onClick={reset} className="w-full text-foreground/15 text-xs font-mono cursor-pointer text-center py-3">
              ⟵ 返回
            </button>
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
            <button onClick={reset} className="text-foreground/15 text-xs font-mono cursor-pointer mt-6">
              ⟵ 返回
            </button>
          </motion.div>
        )}

        {/* ─── Table pick (game-like) + Revealed ───────────────────── */}
        {(phase === "table" || phase === "revealed") && selectedSpread && (
          <motion.div
            key="table"
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
              {phase === "table"
                ? `点选桌面上的一张牌 · 牌位「${currentPos?.name ?? ""}」 · ${pickIndex}/${selectedSpread.cardCount}`
                : "占卜完成"}
            </p>

            {phase === "table" && pickIndex === 0 && (
              <motion.button
                onClick={reshuffleTable}
                className="mb-2 px-3 py-1.5 rounded-lg glass text-foreground/40 text-[10px] font-mono cursor-pointer"
                whileTap={{ scale: 0.98 }}
              >
                🔀 洗牌
              </motion.button>
            )}

            {selectedTopic && topicQuestion.trim() && (
              <div className="w-full max-w-sm mb-2 px-3 py-2 rounded-xl bg-neon-purple/5 border border-neon-purple/10 text-foreground/45 text-[10px] leading-relaxed">
                <span className="text-foreground/20 font-mono">你的问题：</span>{topicQuestion.trim()}
              </div>
            )}

            {/* ─── Topic: 三体面板 (hexagram + 五行) ── */}
            {selectedTopic && hexagram && topicGanZhi && (
              <motion.div
                className="w-full max-w-sm mb-4 space-y-2"
                initial={{ y: -10, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.2 }}
              >
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

                {wuxingAnalysis && (
                  <div className="p-2.5 rounded-lg bg-neon-gold/3 border border-neon-gold/10">
                    <div className="flex items-center gap-1 mb-1">
                      <span className="text-neon-gold/50 text-[9px] font-mono">五行 · {selectedTopic.name}</span>
                    </div>
                    <p className="text-foreground/40 text-[10px] leading-relaxed">{wuxingAnalysis}</p>
                  </div>
                )}

                <div className="flex items-center justify-center gap-3 py-1">
                  <span className="text-[8px] font-mono px-2 py-0.5 rounded bg-neon-gold/5 text-neon-gold/40 border border-neon-gold/10">周易</span>
                  <span className="text-foreground/10 text-[8px]">×</span>
                  <span className="text-[8px] font-mono px-2 py-0.5 rounded bg-neon-cyan/5 text-neon-cyan/40 border border-neon-cyan/10">五行</span>
                  <span className="text-foreground/10 text-[8px]">×</span>
                  <span className="text-[8px] font-mono px-2 py-0.5 rounded bg-neon-purple/5 text-neon-purple/40 border border-neon-purple/10">塔罗</span>
                </div>
              </motion.div>
            )}

            {/* Picked by positions */}
            <div className="w-full max-w-sm mb-4">
              <div className="grid grid-cols-3 gap-2">
                {selectedSpread.positions.map((pos, i) => {
                  const picked = spreadResult?.cards?.[i];
                  const isActive = phase === "table" && i === pickIndex;
                  return (
                    <div key={i} className={`rounded-xl glass p-2 ${isActive ? "border border-neon-cyan/20" : "border border-transparent"}`}>
                      <div className={`text-[9px] font-mono mb-1 ${isActive ? "text-neon-cyan/60" : "text-foreground/20"}`}>
                        {pos.name}
                      </div>
                      {picked ? (
                        <div className="flex items-center gap-2">
                          <div className="w-10">
                            <CardFace cardId={picked.card.id} reversed={picked.isReversed} size="sm" />
                          </div>
                          <div className="text-[9px] leading-tight text-foreground/50">
                            赛博·{picked.card.name}{picked.isReversed ? "（逆）" : ""}
                          </div>
                        </div>
                      ) : (
                        <div className="text-foreground/15 text-[9px] font-mono py-4 text-center">
                          {isActive ? "点选一张" : "未选择"}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Table: 7 card backs */}
            {phase === "table" && (
              <>
                <div className="w-full max-w-sm grid grid-cols-4 gap-2">
                  {tableCards.map((c) => {
                    const removed = removedIds.has(c.id);
                    const active = hoverId === c.id;
                    return (
                      <motion.button
                        key={c.id}
                        onClick={() => pickFromTable(c.id)}
                        onMouseEnter={() => setHoverId(c.id)}
                        onMouseLeave={() => setHoverId(null)}
                        className="relative"
                        style={{ opacity: removed ? 0 : 1, pointerEvents: removed ? "none" : "auto" }}
                        whileTap={{ scale: 0.96 }}
                        animate={{
                          rotate: c.rot,
                          x: c.x,
                          y: c.y,
                          boxShadow:
                            active && !removed
                              ? "0 0 0 1px rgba(0,240,255,0.25), 0 0 40px rgba(0,240,255,0.12)"
                              : "0 0 0 1px rgba(255,255,255,0.03)",
                        }}
                        transition={{ type: "spring", stiffness: 260, damping: 18 }}
                      >
                        <CardBack size="sm" />
                        {active && (
                          <div className="absolute -top-1 -right-1 text-[9px] font-mono text-neon-cyan/80">✦</div>
                        )}
                      </motion.button>
                    );
                  })}
                </div>
                <button onClick={reset} className="text-foreground/15 text-xs font-mono cursor-pointer mt-4">
                  ⟵ 返回
                </button>
              </>
            )}

            {/* Actions */}
            {phase === "revealed" && spreadResult && (
              <motion.div className="w-full max-w-sm space-y-3 mt-4" initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.3 }}>

                {/* ─── Topic: 免费简读（直接展示） ─── */}
                {selectedTopic && briefReading && (
                  <div className="p-4 rounded-xl glass">
                    <div className="flex items-center gap-2 mb-3">
                      <span className="text-neon-cyan/60 text-[9px] font-mono px-2 py-0.5 rounded bg-neon-cyan/5 border border-neon-cyan/10">简读</span>
                      <span className="text-foreground/20 text-[9px] font-mono">FREE</span>
                    </div>
                    <div className="text-sm leading-7 text-foreground/60 whitespace-pre-wrap">{briefReading}</div>
                  </div>
                )}

                {/* ─── Topic: 付费深度解读引导 ─── */}
                {selectedTopic && !reading && (
                  <div className="p-3 rounded-xl bg-gradient-to-r from-neon-gold/5 to-neon-purple/5 border border-dashed border-neon-gold/15">
                    <p className="text-foreground/40 text-xs leading-relaxed text-center mb-2">
                      以上是三体基础解读。想知道{hexagram?.name}卦 × {topicGanZhi?.wuxingElement}行 × 塔罗牌的<span className="text-neon-gold/70">交叉共振分析</span>、<span className="text-neon-gold/70">具体行动建议</span>和<span className="text-neon-gold/70">时机判断</span>吗？
                    </p>
                    <motion.button
                      onClick={requestReading}
                      className="w-full py-3 rounded-xl bg-gradient-to-r from-neon-gold/15 to-neon-purple/15 border border-neon-gold/20 text-neon-gold text-xs font-mono cursor-pointer"
                      whileTap={{ scale: 0.98 }}
                    >
                      🔮 查看 AI 深度解读
                    </motion.button>
                  </div>
                )}

                {/* ─── Spread (非 topic): 保持原逻辑 ─── */}
                {!selectedTopic && !showReading && !reading && (
                  <div className="p-3 rounded-xl bg-gradient-to-r from-neon-cyan/5 to-neon-purple/5 border border-dashed border-neon-cyan/10">
                    <p className="text-foreground/40 text-xs leading-relaxed">
                      {selectedSpread.name}牌阵已完成。{spreadResult.cards.length}张牌的能量交织中隐藏着什么信号？
                    </p>
                  </div>
                )}
                {!selectedTopic && (
                  <div className="flex gap-3">
                    <motion.button onClick={requestReading} className="flex-1 py-3 rounded-xl bg-gradient-to-r from-neon-cyan/15 to-neon-purple/15 border border-neon-cyan/20 text-neon-cyan text-xs font-mono cursor-pointer" whileTap={{ scale: 0.98 }}>
                      {reading ? (showReading ? "📖 收起" : "📖 查看") : "📖 查看完整解读"}
                    </motion.button>
                    {shareResult && (
                      <motion.button onClick={() => setShowShare(true)} className="py-3 px-4 rounded-xl glass text-foreground/40 text-xs font-mono cursor-pointer" whileTap={{ scale: 0.98 }}>💾</motion.button>
                    )}
                  </div>
                )}

                {/* ─── Topic: AI 深度解读已解锁后的按钮 ─── */}
                {selectedTopic && reading && (
                  <div className="flex gap-3">
                    <motion.button onClick={() => setShowReading(!showReading)} className="flex-1 py-3 rounded-xl bg-gradient-to-r from-neon-gold/15 to-neon-purple/15 border border-neon-gold/20 text-neon-gold text-xs font-mono cursor-pointer" whileTap={{ scale: 0.98 }}>
                      {showReading ? "📖 收起深度解读" : "📖 查看深度解读"}
                    </motion.button>
                    {shareResult && (
                      <motion.button onClick={() => setShowShare(true)} className="py-3 px-4 rounded-xl glass text-foreground/40 text-xs font-mono cursor-pointer" whileTap={{ scale: 0.98 }}>💾</motion.button>
                    )}
                  </div>
                )}

                <button onClick={backFromResult} className="w-full text-foreground/15 text-xs font-mono cursor-pointer text-center py-1">⟳ 返回</button>
              </motion.div>
            )}

            {/* AI 深度解读 */}
            <AnimatePresence>
              {showReading && (
                <motion.div className="w-full max-w-sm mt-4 p-4 rounded-xl glass" initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}>
                  {selectedTopic && (
                    <div className="flex items-center gap-2 mb-3">
                      <span className="text-neon-gold/60 text-[9px] font-mono px-2 py-0.5 rounded bg-neon-gold/5 border border-neon-gold/10">AI 深度解读</span>
                      <span className="text-foreground/15 text-[9px] font-mono">三体融合</span>
                    </div>
                  )}
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
                <ShareableCard
                  result={shareResult}
                  mode={selectedTopic ? "topic" : "spread"}
                  title={selectedTopic ? `${selectedTopic.name} · 主题占卜` : `${selectedSpread?.name ?? "牌阵"} · 牌阵占卜`}
                  subtitle={selectedTopic ? "周易 × 五行 × 塔罗" : "塔罗牌阵"}
                  contextText={shareResult.fortune}
                  dateStr={getTodayDateString()}
                  visible={showShare}
                  onClose={() => setShowShare(false)}
                  qrHintText={selectedTopic ? "扫码做一次主题占卜" : "扫码抽你的牌阵"}
                />
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>

      <PaymentGate
        title={selectedTopic ? `${selectedTopic.name} · 三体解读` : "完整解读"}
        description={selectedTopic ? `周易 × 五行 × 塔罗 三体融合解读` : `${selectedSpread?.name ?? ""} AI 深度解析`}
        price=""
        visible={showPayment}
        onClose={() => setShowPayment(false)}
        onUnlocked={() => { setShowPayment(false); doFetchReading(); }}
      />
    </div>
  );
}
