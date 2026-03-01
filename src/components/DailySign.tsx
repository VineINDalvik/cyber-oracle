"use client";

import { useState, useMemo, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { getDailySign, getTodayDateString } from "@/lib/tarot";
import { recordCardSeen, recordReading, dailyCheckin, syncToServer } from "@/lib/collection";
import CardFace, { CardBack } from "./CardFace";
import ShareableCard from "./ShareableCard";
import PaymentGate from "./PaymentGate";
import CollectionBar from "./CollectionBar";
import { getOrCreateDeviceId, getProfile, setProfile, profileSeedString, type UserProfile } from "@/lib/device-profile";

export default function DailySign() {
  const dateStr = getTodayDateString();
  const [profileVersion, setProfileVersion] = useState(0);
  const [picked, setPicked] = useState(false);
  const [pickedIndex, setPickedIndex] = useState<number | null>(null);
  const seed = useMemo(() => {
    const deviceId = getOrCreateDeviceId();
    const p = getProfile();
    return profileSeedString(deviceId, dateStr, p);
  }, [dateStr, profileVersion]);
  const result = useMemo(() => getDailySign(dateStr, seed), [dateStr, seed]);
  const { ganZhi: gz } = result;

  const [showReading, setShowReading] = useState(false);
  const [reading, setReading] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [showPayment, setShowPayment] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [editingProfile, setEditingProfile] = useState<UserProfile>(() => getProfile());

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(`co_daily_picked_${dateStr}`);
      if (raw) {
        const n = Number(window.localStorage.getItem(`co_daily_pick_${dateStr}`));
        if (Number.isFinite(n)) setPickedIndex(n);
        setPicked(true);
      }
    } catch {}
  }, [dateStr]);

  useEffect(() => {
    syncToServer().then(() => {
      recordCardSeen(result.card.id);
      dailyCheckin(dateStr);
    });
  }, [result.card.id, dateStr]);

  const requestReading = () => {
    if (reading) { setShowReading(!showReading); return; }
    setShowPayment(true);
  };

  const openHiddenProfile = () => {
    setEditingProfile(getProfile());
    setShowProfile(true);
  };

  const doFetchReading = async () => {
    setShowReading(true);
    setIsStreaming(true);
    recordReading();

    try {
      const res = await fetch("/api/divine", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "daily",
          card: `赛博·${result.card.name}（${result.card.cyberName}）`,
          cardMeaning: result.isReversed ? result.card.reversed : result.card.upright,
          isReversed: result.isReversed,
          fortune: result.fortune,
          date: dateStr,
          ganZhi: `${gz.gan}${gz.zhi}日`,
          wuxing: gz.wuxing,
          wuxingElement: gz.wuxingElement,
          direction: gz.direction,
          color: gz.color,
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
  };

  const weekday = ["日", "一", "二", "三", "四", "五", "六"][new Date().getDay()];

  return (
    <div className="flex flex-col items-center min-h-[calc(100dvh-64px)] px-5 pt-5 pb-4">
      {/* Date & GanZhi header */}
      <motion.div
        className="text-center mb-4"
        initial={{ y: -10, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
      >
        <div className="text-foreground/20 text-[10px] font-mono tracking-widest mb-1">
          TODAY&apos;S CYBER SIGN
        </div>
        <div className="text-foreground/50 text-xs font-mono mb-2">
          {dateStr} · 周{weekday}
        </div>
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg glass">
          <span className="text-neon-gold text-sm font-bold">{gz.gan}{gz.zhi}日</span>
          <span className="text-foreground/20 text-[10px]">·</span>
          <span className="text-neon-cyan/60 text-[10px] font-mono">{gz.wuxing}</span>
          <span className="text-foreground/20 text-[10px]">·</span>
          <span className="text-foreground/30 text-[10px] font-mono">
            {gz.wuxingElement}行 · {gz.direction}方 · {gz.color}色
          </span>
        </div>
      </motion.div>

      {/* Card */}
      <motion.div
        className="mb-5"
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 200, damping: 20, delay: 0.1 }}
      >
        {picked ? (
          <CardFace cardId={result.card.id} reversed={result.isReversed} size="lg" />
        ) : (
          <div className="flex flex-col items-center">
            <div className="flex gap-2">
              {Array.from({ length: 5 }, (_, i) => (
                <motion.button
                  key={i}
                  onClick={() => {
                    setPicked(true);
                    setPickedIndex(i);
                    try {
                      window.localStorage.setItem(`co_daily_picked_${dateStr}`, "1");
                      window.localStorage.setItem(`co_daily_pick_${dateStr}`, String(i));
                    } catch {}
                  }}
                  className="cursor-pointer"
                  whileTap={{ scale: 0.96 }}
                  aria-label={`pick-${i}`}
                >
                  <CardBack size="sm" />
                </motion.button>
              ))}
            </div>
            <div className="text-foreground/30 text-[10px] font-mono mt-3">
              选一张，看看今天你的签
            </div>
          </div>
        )}
      </motion.div>

      {/* Fortune text (free) */}
      <motion.p
        className="text-center max-w-xs text-foreground/70 text-sm leading-relaxed mb-3"
        initial={{ y: 10, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.3 }}
      >
        {result.fortune}
      </motion.p>

      {/* Label (free) */}
      <motion.div
        className="mb-4"
        initial={{ scale: 0, rotate: -20 }}
        animate={{ scale: 1, rotate: -12 }}
        transition={{ type: "spring", stiffness: 300, damping: 15, delay: 0.5 }}
      >
        <div className="stamp text-xs">{result.label}</div>
      </motion.div>

      {/* Derivation */}
      <motion.div
        className="text-center text-foreground/15 text-[9px] font-mono mb-4 max-w-xs leading-relaxed"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.7 }}
      >
        {gz.gan}{gz.zhi}日 → {gz.wuxing}（{gz.wuxingElement}行）→ 塔罗{result.card.element}元素 → 赛博·{result.card.name}
      </motion.div>

      {/* Teaser for paid reading */}
      {!reading && picked && (
        <motion.div
          className="w-full max-w-xs p-3 rounded-xl bg-gradient-to-r from-neon-cyan/5 to-neon-purple/5 border border-dashed border-neon-cyan/10 mb-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
        >
          <p className="text-foreground/30 text-xs leading-relaxed text-center">
            今日{gz.gan}{gz.zhi}，{gz.wuxing}之气与赛博·{result.card.name}的深层共振尚未完全解码...
          </p>
        </motion.div>
      )}

      {/* Buttons */}
      <motion.div
        className="flex gap-3 w-full max-w-xs mb-5"
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.6 }}
      >
        <motion.button
          onClick={() => {
            if (!picked) return;
            requestReading();
          }}
          onContextMenu={(e) => {
            e.preventDefault();
            openHiddenProfile();
          }}
          className="flex-1 py-3 rounded-xl bg-gradient-to-r from-neon-cyan/15 to-neon-purple/15 border border-neon-cyan/20 text-neon-cyan text-xs font-mono cursor-pointer"
          whileTap={{ scale: 0.98 }}
        >
          {picked ? (reading ? (showReading ? "📖 收起" : "📖 查看") : "📖 完整解读") : "先选牌"}
        </motion.button>
        <motion.button
          onClick={() => (picked ? setShowShare(true) : null)}
          className="py-3 px-4 rounded-xl glass text-foreground/40 text-xs font-mono cursor-pointer"
          whileTap={{ scale: 0.98 }}
        >
          💾
        </motion.button>
      </motion.div>

      {/* Reading */}
      <AnimatePresence>
        {showReading && (
          <motion.div
            className="w-full max-w-xs mb-5 p-4 rounded-xl glass"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
          >
            {reading ? (
              <div className="text-sm leading-7 text-foreground/70 whitespace-pre-wrap">
                {reading}
                {isStreaming && (
                  <motion.span className="inline-block w-2 h-4 bg-neon-cyan ml-1 align-middle"
                    animate={{ opacity: [1, 0] }} transition={{ duration: 0.8, repeat: Infinity }} />
                )}
              </div>
            ) : (
              <div className="text-center text-foreground/30 text-xs font-mono animate-pulse">
                正在连接赛博矩阵...
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Collection bar */}
      <CollectionBar dateStr={dateStr} />

      {/* Payment gate */}
      <PaymentGate
        title="每日签完整解读"
        description={`${gz.gan}${gz.zhi}日 × 赛博·${result.card.name} 深度解析`}
        price=""
        visible={showPayment}
        onClose={() => setShowPayment(false)}
        onUnlocked={() => { setShowPayment(false); doFetchReading(); }}
      />

      {/* Hidden profile/settings (right-click the button) */}
      <AnimatePresence>
        {showProfile && (
          <motion.div
            className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowProfile(false)}
          >
            <motion.div
              className="w-full max-w-lg rounded-t-3xl overflow-hidden bg-surface border border-card-border"
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="px-6 pt-5 pb-4 border-b border-foreground/5">
                <div className="text-sm font-bold neon-text text-center">隐藏个性化设置</div>
                <div className="text-[10px] text-foreground/30 font-mono text-center mt-1">
                  不填也能用；填了会影响“你今天抽到哪张牌”
                </div>
              </div>

              <div className="px-6 py-5 space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <div className="text-foreground/30 text-[10px] font-mono">睡眠</div>
                    <select
                      value={editingProfile.sleep ?? ""}
                      onChange={(e) => setEditingProfile((p) => ({ ...p, sleep: (e.target.value || undefined) as any }))}
                      className="w-full px-3 py-2 rounded-lg glass text-foreground/70 text-xs font-mono outline-none"
                    >
                      <option value="">不设置</option>
                      <option value="good">睡得好</option>
                      <option value="ok">一般</option>
                      <option value="bad">没睡好</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <div className="text-foreground/30 text-[10px] font-mono">压力</div>
                    <select
                      value={editingProfile.stress ?? ""}
                      onChange={(e) => setEditingProfile((p) => ({ ...p, stress: (e.target.value || undefined) as any }))}
                      className="w-full px-3 py-2 rounded-lg glass text-foreground/70 text-xs font-mono outline-none"
                    >
                      <option value="">不设置</option>
                      <option value="low">低</option>
                      <option value="mid">中</option>
                      <option value="high">高</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <div className="text-foreground/30 text-[10px] font-mono">出生日期（可选）</div>
                    <input
                      value={editingProfile.birthDate ?? ""}
                      onChange={(e) => setEditingProfile((p) => ({ ...p, birthDate: e.target.value || undefined }))}
                      placeholder="YYYY-MM-DD"
                      className="w-full px-3 py-2 rounded-lg glass text-foreground/70 text-xs font-mono outline-none placeholder:text-foreground/15"
                    />
                  </div>
                  <div className="space-y-1">
                    <div className="text-foreground/30 text-[10px] font-mono">出生时辰（可选）</div>
                    <input
                      value={editingProfile.birthTime ?? ""}
                      onChange={(e) => setEditingProfile((p) => ({ ...p, birthTime: e.target.value || undefined }))}
                      placeholder="例如 23:30 / 子时"
                      className="w-full px-3 py-2 rounded-lg glass text-foreground/70 text-xs font-mono outline-none placeholder:text-foreground/15"
                    />
                  </div>
                </div>

                <div className="flex gap-3 pt-1">
                  <button
                    onClick={() => {
                      setProfile(editingProfile);
                      setProfileVersion((v) => v + 1);
                      setPicked(false);
                      setPickedIndex(null);
                      try {
                        window.localStorage.removeItem(`co_daily_picked_${dateStr}`);
                        window.localStorage.removeItem(`co_daily_pick_${dateStr}`);
                      } catch {}
                      setShowProfile(false);
                    }}
                    className="flex-1 py-3 rounded-xl bg-gradient-to-r from-neon-cyan/20 to-neon-purple/20 border border-neon-cyan/30 text-neon-cyan text-xs font-mono cursor-pointer"
                  >
                    保存并重新抽牌
                  </button>
                  <button
                    onClick={() => {
                      setProfile({});
                      setProfileVersion((v) => v + 1);
                      setPicked(false);
                      setPickedIndex(null);
                      try {
                        window.localStorage.removeItem(`co_daily_picked_${dateStr}`);
                        window.localStorage.removeItem(`co_daily_pick_${dateStr}`);
                      } catch {}
                      setShowProfile(false);
                    }}
                    className="px-4 py-3 rounded-xl glass text-foreground/30 text-xs font-mono cursor-pointer"
                  >
                    清空
                  </button>
                </div>

                <div className="text-center text-foreground/10 text-[9px] font-mono">
                  入口是“右键点击完整解读按钮”。这是刻意隐藏的。
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Share overlay */}
      <AnimatePresence>
        {showShare && (
          <ShareableCard result={result} mode="daily" dateStr={dateStr} visible={showShare} onClose={() => setShowShare(false)} ganZhi={gz} />
        )}
      </AnimatePresence>
    </div>
  );
}
