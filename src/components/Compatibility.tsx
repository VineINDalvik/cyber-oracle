"use client";

import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { drawSpread, SPREAD_TYPES, MAJOR_ARCANA, type SpreadResult } from "@/lib/tarot";
import { recordCardSeen, recordReading } from "@/lib/collection";
import CardFace, { CardBack } from "./CardFace";
import ShareableCard from "./ShareableCard";
import PaymentGate from "./PaymentGate";

const COMPAT_TOPICS = [
  { id: "love", icon: "💘", name: "感情合盘", description: "两个人之间的化学反应" },
  { id: "friend", icon: "🤝", name: "友谊合盘", description: "你和 TA 的灵魂契合度" },
  { id: "work", icon: "💼", name: "事业合盘", description: "你们适合一起共事吗" },
];

type Phase = "topic" | "a-draw" | "a-done" | "code-input" | "b-draw" | "b-done" | "result";

export default function Compatibility() {
  const [phase, setPhase] = useState<Phase>("topic");
  const [topic, setTopic] = useState<typeof COMPAT_TOPICS[0] | null>(null);

  // Player A
  const [aResult, setAResult] = useState<SpreadResult | null>(null);
  const [aRevealed, setARevealed] = useState<Set<number>>(new Set());
  const [shareCode, setShareCode] = useState("");

  // Player B (code entry or direct draw)
  const [codeInput, setCodeInput] = useState("");
  const [bResult, setBResult] = useState<SpreadResult | null>(null);
  const [bRevealed, setBRevealed] = useState<Set<number>>(new Set());

  // AI reading
  const [reading, setReading] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [showPayment, setShowPayment] = useState(false);
  const [joining, setJoining] = useState(false);
  const [showShare, setShowShare] = useState(false);

  const spread = useMemo(() => SPREAD_TYPES[0], []); // single card for compatibility

  // Deep link: open in compat mode with ?mode=compat&code=XXXX
  useEffect(() => {
    try {
      const url = new URL(window.location.href);
      const code = (url.searchParams.get("code") || "").toUpperCase();
      if (code) {
        setShareCode(code);
        setCodeInput(code);
        setPhase("code-input");
      }
    } catch {}
  }, []);

  // ─── Actions ────────────────────────────────────────────────────

  const selectTopic = (t: typeof COMPAT_TOPICS[0]) => {
    setTopic(t);
    setPhase("a-draw");
  };

  const drawForA = () => {
    const result = drawSpread(spread, Date.now());
    setAResult(result);
    result.cards.forEach((c) => recordCardSeen(c.card.id));
  };

  const revealA = (i: number) => {
    if (aRevealed.has(i)) return;
    setARevealed(new Set(aRevealed).add(i));
    setTimeout(async () => {
      setPhase("a-done");
      if (!topic || !aResult) return;
      try {
        const card = aResult.cards[0];
        const res = await fetch("/api/compat/session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            topicId: topic.id,
            topicName: topic.name,
            aCardId: card.card.id,
            aIsReversed: card.isReversed,
          }),
        });
        if (res.ok) {
          const json = await res.json();
          setShareCode(String(json.code || "").toUpperCase());
        }
      } catch {
        // ignore
      }
    }, 600);
  };

  const drawForB = () => {
    const result = drawSpread(spread, Date.now() + 9999);
    setBResult(result);
    result.cards.forEach((c) => recordCardSeen(c.card.id));
  };

  const revealB = (i: number) => {
    if (bRevealed.has(i)) return;
    setBRevealed(new Set(bRevealed).add(i));
    setTimeout(async () => {
      setPhase("b-done");
      if (!shareCode || !bResult) return;
      setJoining(true);
      try {
        const card = bResult.cards[0];
        await fetch(`/api/compat/session/${encodeURIComponent(shareCode)}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ bCardId: card.card.id, bIsReversed: card.isReversed }),
        });
      } catch {
        // ignore
      } finally {
        setJoining(false);
      }
    }, 600);
  };

  const handleCodeSubmit = () => {
    if (codeInput.length < 3) return;
    const code = codeInput.toUpperCase();
    setShareCode(code);

    // Built-in mock to preview UI quickly
    if (code === "DEMO") {
      const t = COMPAT_TOPICS[0];
      setTopic(t);
      const aCard = MAJOR_ARCANA[6]; // Lovers-ish vibe
      setAResult({ cards: [{ card: aCard, isReversed: false, position: spread.positions[0] }] });
      setARevealed(new Set([0]));
      setPhase("b-draw");
      return;
    }

    fetch(`/api/compat/session/${encodeURIComponent(code)}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("not found"))))
      .then((s) => {
        const t = COMPAT_TOPICS.find((x) => x.id === s.topicId) || COMPAT_TOPICS[0];
        setTopic({ ...t, name: s.topicName || t.name });
        const card = MAJOR_ARCANA[(s.a?.cardId ?? 0) % 22];
        setAResult({ cards: [{ card, isReversed: !!s.a?.isReversed, position: spread.positions[0] }] });
        setARevealed(new Set([0]));
        setPhase("b-draw");
      })
      .catch(() => {
        // keep UI as-is
      });
  };

  const requestReading = () => {
    setShowPayment(true);
  };

  const doFetchReading = async () => {
    if (!aResult || !bResult || !topic) return;
    setPhase("result");
    setIsStreaming(true);
    recordReading();

    const aCard = aResult.cards[0];
    const bCard = bResult.cards[0];

    try {
      const res = await fetch("/api/divine", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "compatibility",
          topicName: topic.name,
          personA: `赛博·${aCard.card.name}（${aCard.card.cyberName}）${aCard.isReversed ? "逆位" : "正位"} — ${aCard.isReversed ? aCard.card.reversed : aCard.card.upright}`,
          personB: `赛博·${bCard.card.name}（${bCard.card.cyberName}）${bCard.isReversed ? "逆位" : "正位"} — ${bCard.isReversed ? bCard.card.reversed : bCard.card.upright}`,
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
      setReading("⚠️ 信号中断");
    } finally {
      setIsStreaming(false);
    }
  };

  const reset = () => {
    setPhase("topic");
    setTopic(null);
    setAResult(null);
    setARevealed(new Set());
    setBResult(null);
    setBRevealed(new Set());
    setShareCode("");
    setCodeInput("");
    setReading("");
    setIsStreaming(false);
    setJoining(false);
  };

  // ─── Render ─────────────────────────────────────────────────────

  return (
    <div className="flex flex-col items-center min-h-[calc(100dvh-64px)] px-4 pt-5 pb-4">
      <AnimatePresence mode="wait">
        {/* Code input */}
        {phase === "code-input" && (
          <motion.div
            key="code-input"
            className="flex flex-col items-center w-full max-w-sm"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
          >
            <div className="text-foreground/20 text-[10px] font-mono tracking-widest mb-1">
              COMPATIBILITY
            </div>
            <h2 className="text-lg font-bold neon-text-purple tracking-wider mb-2">输入口令</h2>
            <p className="text-foreground/30 text-xs mb-2">对方发给你的链接/口令，有效期 24 小时</p>
            <p className="text-foreground/20 text-[10px] font-mono mb-6">想先看界面？输入 <span className="text-neon-gold/80">DEMO</span></p>

            <div className="w-full">
              <div className="flex gap-2">
                <input
                  value={codeInput}
                  onChange={(e) => setCodeInput(e.target.value.toUpperCase())}
                  placeholder="例如 8C2KQ1AB"
                  className="flex-1 px-3 py-2 rounded-lg glass text-sm text-foreground/70 placeholder:text-foreground/15 outline-none font-mono tracking-widest text-center"
                  maxLength={16}
                />
                <motion.button
                  onClick={handleCodeSubmit}
                  disabled={codeInput.length < 3}
                  className="px-4 py-2 rounded-lg bg-neon-purple/10 border border-neon-purple/20 text-neon-purple text-xs font-mono cursor-pointer disabled:opacity-30"
                  whileTap={{ scale: 0.95 }}
                >
                  进入
                </motion.button>
              </div>
            </div>

            <button onClick={reset} className="text-foreground/15 text-xs font-mono cursor-pointer mt-6">
              ⟵ 返回
            </button>
          </motion.div>
        )}

        {/* Topic selection */}
        {phase === "topic" && (
          <motion.div
            key="topic"
            className="flex flex-col items-center w-full max-w-sm"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
          >
            <div className="text-foreground/20 text-[10px] font-mono tracking-widest mb-1">
              COMPATIBILITY
            </div>
            <h2 className="text-lg font-bold neon-text-purple tracking-wider mb-1">合盘占卜</h2>
            <p className="text-foreground/30 text-xs mb-6">两个人各抽一张牌，看命运如何交织</p>

            <div className="w-full space-y-3 mb-6">
              {COMPAT_TOPICS.map((t) => (
                <motion.button
                  key={t.id}
                  onClick={() => selectTopic(t)}
                  className="w-full p-4 rounded-xl glass text-left cursor-pointer"
                  whileTap={{ scale: 0.98 }}
                >
                  <span className="text-xl mr-2">{t.icon}</span>
                  <span className="text-foreground/70 text-sm font-bold">{t.name}</span>
                  <p className="text-foreground/30 text-xs mt-1">{t.description}</p>
                </motion.button>
              ))}
            </div>

            {/* Code entry */}
            <div className="w-full">
              <div className="flex items-center gap-2 mb-2">
                <div className="flex-1 h-px bg-foreground/5" />
                <span className="text-foreground/15 text-[10px] font-mono">有口令？</span>
                <div className="flex-1 h-px bg-foreground/5" />
              </div>
              <motion.button
                onClick={() => setPhase("code-input")}
                className="w-full py-3 rounded-xl glass text-foreground/40 text-xs font-mono cursor-pointer"
                whileTap={{ scale: 0.98 }}
              >
                输入口令 / 打开链接
              </motion.button>
            </div>
          </motion.div>
        )}

        {/* Player A draw */}
        {phase === "a-draw" && topic && (
          <motion.div
            key="a-draw"
            className="flex flex-col items-center w-full max-w-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <span className="text-3xl mb-2">{topic.icon}</span>
            <h2 className="text-sm font-bold neon-text-purple mb-1">{topic.name}</h2>
            <p className="text-foreground/30 text-xs mb-6">你先抽一张，然后让对方也来抽</p>

            <div className="mb-4">
              {!aResult ? (
                <motion.div onClick={drawForA} className="cursor-pointer" whileTap={{ scale: 0.95 }}>
                  <CardBack size="lg" />
                  <p className="text-neon-cyan/40 text-xs font-mono text-center mt-3 animate-pulse">
                    点击抽牌
                  </p>
                </motion.div>
              ) : (
                <div
                  className="relative cursor-pointer"
                  style={{ perspective: 800, width: 220, height: 367 }}
                  onClick={() => revealA(0)}
                >
                  <motion.div
                    className="w-full h-full"
                    style={{ transformStyle: "preserve-3d" }}
                    animate={{ rotateY: aRevealed.has(0) ? 180 : 0 }}
                    transition={{ duration: 0.6 }}
                  >
                    <div className="absolute inset-0" style={{ backfaceVisibility: "hidden" }}>
                      <CardBack size="lg" />
                    </div>
                    <div className="absolute inset-0" style={{ backfaceVisibility: "hidden", transform: "rotateY(180deg)" }}>
                      <CardFace cardId={aResult.cards[0].card.id} reversed={aResult.cards[0].isReversed} size="lg" />
                    </div>
                  </motion.div>
                </div>
              )}
            </div>

            <button onClick={reset} className="text-foreground/15 text-xs font-mono cursor-pointer mt-2">
              ⟵ 返回
            </button>
          </motion.div>
        )}

        {/* Player A done — share link */}
        {phase === "a-done" && aResult && topic && (
          <motion.div
            key="a-done"
            className="flex flex-col items-center w-full max-w-sm"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <div className="mb-4">
              <CardFace cardId={aResult.cards[0].card.id} reversed={aResult.cards[0].isReversed} size="md" />
            </div>
            <p className="text-neon-cyan text-xs font-mono mb-1">你抽到了：赛博·{aResult.cards[0].card.name}</p>

            <div className="w-full p-4 rounded-xl glass mt-4 mb-4">
              <p className="text-foreground/40 text-xs mb-2 text-center">把链接发给对方，让 TA 来抽自己的牌</p>
              <div className="text-foreground/70 text-[10px] font-mono break-all text-center">
                {shareCode ? `https://cyber.vinex.top/?mode=compat&code=${shareCode}` : "生成链接中..."}
              </div>
              <div className="flex gap-2 mt-3">
                <motion.button
                  onClick={async () => {
                    if (!shareCode) return;
                    const link = `https://cyber.vinex.top/?mode=compat&code=${shareCode}`;
                    await navigator.clipboard.writeText(link);
                  }}
                  className="flex-1 py-3 rounded-xl bg-neon-cyan/10 border border-neon-cyan/20 text-neon-cyan text-xs font-mono cursor-pointer disabled:opacity-40"
                  whileTap={{ scale: 0.98 }}
                  disabled={!shareCode}
                >
                  复制链接
                </motion.button>
                <motion.button
                  onClick={() => setPhase("b-draw")}
                  className="flex-1 py-3 rounded-xl glass text-foreground/40 text-xs font-mono cursor-pointer"
                  whileTap={{ scale: 0.98 }}
                >
                  同机继续
                </motion.button>
              </div>
              <div className="text-foreground/15 text-[9px] font-mono text-center mt-2">有效期 24 小时</div>
            </div>

            {/* Or draw for B directly */}
            <div className="flex items-center gap-2 w-full mb-3">
              <div className="flex-1 h-px bg-foreground/5" />
              <span className="text-foreground/15 text-[10px] font-mono">或</span>
              <div className="flex-1 h-px bg-foreground/5" />
            </div>

            <motion.button
              onClick={() => setPhase("b-draw")}
              className="w-full py-3 rounded-xl bg-neon-purple/10 border border-neon-purple/20 text-neon-purple text-sm font-mono cursor-pointer"
              whileTap={{ scale: 0.98 }}
            >
              🎴 直接帮对方抽（两人面对面）
            </motion.button>

            <button onClick={reset} className="text-foreground/15 text-xs font-mono cursor-pointer mt-3">
              ⟳ 重来
            </button>
          </motion.div>
        )}

        {/* Player B draw */}
        {phase === "b-draw" && (
          <motion.div
            key="b-draw"
            className="flex flex-col items-center w-full max-w-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <h2 className="text-sm font-bold neon-text mb-4">对方的回合</h2>

            {/* Show A's card small */}
            {aResult && (
              <div className="flex items-center gap-2 mb-4 px-3 py-2 rounded-lg glass">
                <div className="w-8 h-13">
                  <CardFace cardId={aResult.cards[0].card.id} reversed={aResult.cards[0].isReversed} size="sm" />
                </div>
                <div className="text-foreground/30 text-[10px] font-mono">
                  甲方：赛博·{aResult.cards[0].card.name}
                </div>
              </div>
            )}

            <div className="mb-4">
              {!bResult ? (
                <motion.div onClick={drawForB} className="cursor-pointer" whileTap={{ scale: 0.95 }}>
                  <CardBack size="lg" />
                  <p className="text-neon-purple/40 text-xs font-mono text-center mt-3 animate-pulse">
                    点击抽牌
                  </p>
                </motion.div>
              ) : (
                <div
                  className="relative cursor-pointer"
                  style={{ perspective: 800, width: 220, height: 367 }}
                  onClick={() => revealB(0)}
                >
                  <motion.div
                    className="w-full h-full"
                    style={{ transformStyle: "preserve-3d" }}
                    animate={{ rotateY: bRevealed.has(0) ? 180 : 0 }}
                    transition={{ duration: 0.6 }}
                  >
                    <div className="absolute inset-0" style={{ backfaceVisibility: "hidden" }}>
                      <CardBack size="lg" />
                    </div>
                    <div className="absolute inset-0" style={{ backfaceVisibility: "hidden", transform: "rotateY(180deg)" }}>
                      <CardFace cardId={bResult.cards[0].card.id} reversed={bResult.cards[0].isReversed} size="lg" />
                    </div>
                  </motion.div>
                </div>
              )}
            </div>

            <button onClick={reset} className="text-foreground/15 text-xs font-mono cursor-pointer mt-2">
              ⟵ 返回
            </button>
          </motion.div>
        )}

        {/* Both done — request reading */}
        {phase === "b-done" && aResult && bResult && topic && (
          <motion.div
            key="b-done"
            className="flex flex-col items-center w-full max-w-sm"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <span className="text-2xl mb-2">{topic.icon}</span>
            <h2 className="text-sm font-bold neon-text-purple mb-4">{topic.name}结果</h2>

            {/* Two cards side by side */}
            <div className="flex items-center gap-6 mb-4">
              <div className="text-center">
                <div className="text-foreground/20 text-[9px] font-mono mb-1">甲方</div>
                <CardFace cardId={aResult.cards[0].card.id} reversed={aResult.cards[0].isReversed} size="sm" />
                <div className="text-neon-cyan text-[9px] font-mono mt-1">赛博·{aResult.cards[0].card.name}</div>
              </div>

              <motion.div
                className="text-2xl text-neon-gold"
                animate={{ scale: [1, 1.2, 1] }}
                transition={{ duration: 2, repeat: Infinity }}
              >
                ×
              </motion.div>

              <div className="text-center">
                <div className="text-foreground/20 text-[9px] font-mono mb-1">乙方</div>
                <CardFace cardId={bResult.cards[0].card.id} reversed={bResult.cards[0].isReversed} size="sm" />
                <div className="text-neon-purple text-[9px] font-mono mt-1">赛博·{bResult.cards[0].card.name}</div>
              </div>
            </div>

            <motion.button
              onClick={requestReading}
              className="w-full py-4 rounded-xl bg-gradient-to-r from-neon-cyan/15 to-neon-purple/15 border border-neon-cyan/20 text-neon-cyan text-sm font-mono cursor-pointer mb-3"
              whileTap={{ scale: 0.98 }}
            >
              📖 查看合盘解读
            </motion.button>

            <motion.button
              onClick={() => setShowShare(true)}
              className="w-full py-3 rounded-xl glass text-foreground/40 text-xs font-mono cursor-pointer mb-3"
              whileTap={{ scale: 0.98 }}
            >
              💾 生成合盘分享图
            </motion.button>

            <button onClick={reset} className="text-foreground/15 text-xs font-mono cursor-pointer">
              ⟳ 重来
            </button>
          </motion.div>
        )}

        {/* Result */}
        {phase === "result" && aResult && bResult && topic && (
          <motion.div
            key="result"
            className="flex flex-col items-center w-full max-w-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            <span className="text-2xl mb-1">{topic.icon}</span>
            <h2 className="text-sm font-bold neon-text-purple mb-4">{topic.name}解读</h2>

            <div className="flex items-center gap-4 mb-4">
              <CardFace cardId={aResult.cards[0].card.id} reversed={aResult.cards[0].isReversed} size="sm" />
              <span className="text-neon-gold text-lg">×</span>
              <CardFace cardId={bResult.cards[0].card.id} reversed={bResult.cards[0].isReversed} size="sm" />
            </div>

            <div className="w-full p-4 rounded-xl glass">
              {reading ? (
                <div className="text-sm leading-7 text-foreground/70 whitespace-pre-wrap">
                  {reading}
                  {isStreaming && (
                    <motion.span className="inline-block w-2 h-4 bg-neon-purple ml-1 align-middle"
                      animate={{ opacity: [1, 0] }} transition={{ duration: 0.8, repeat: Infinity }} />
                  )}
                </div>
              ) : (
                <div className="text-center text-foreground/30 text-xs font-mono animate-pulse">
                  合盘解读生成中...
                </div>
              )}
            </div>

            <button onClick={reset} className="text-foreground/15 text-xs font-mono cursor-pointer mt-4">
              ⟳ 重新合盘
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Payment Gate */}
      <PaymentGate
        title={`${topic?.name ?? "合盘"}解读`}
        description="两张牌的命运交织，AI 深度解析"
        price=""
        visible={showPayment}
        onClose={() => setShowPayment(false)}
        onUnlocked={() => { setShowPayment(false); doFetchReading(); }}
      />

      <AnimatePresence>
        {showShare && aResult && bResult && topic && (
          <ShareableCard
            result={{
              card: aResult.cards[0].card,
              isReversed: aResult.cards[0].isReversed,
              fortune: `合盘主题：${topic.name}\n甲方：赛博·${aResult.cards[0].card.name}${aResult.cards[0].isReversed ? "（逆位）" : "（正位）"}\n乙方：赛博·${bResult.cards[0].card.name}${bResult.cards[0].isReversed ? "（逆位）" : "（正位）"}`,
              label: "双人合盘",
            }}
            secondaryCard={{
              cardId: bResult.cards[0].card.id,
              reversed: bResult.cards[0].isReversed,
              name: bResult.cards[0].card.name,
            }}
            mode="compat"
            title="双人合盘"
            subtitle={topic.name}
            dateStr={new Date().toISOString().slice(0, 10)}
            visible={showShare}
            onClose={() => setShowShare(false)}
            qrHintText="扫码和我一起合盘"
          />
        )}
      </AnimatePresence>
    </div>
  );
}
