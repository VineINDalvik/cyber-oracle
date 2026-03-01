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
  const baseSeed = useMemo(() => {
    const deviceId = getOrCreateDeviceId();
    const p = getProfile();
    return profileSeedString(deviceId, dateStr, p);
  }, [dateStr, profileVersion]);
  const seed = useMemo(() => `${baseSeed}|pick=${pickedIndex ?? 0}`, [baseSeed, pickedIndex]);
  const result = useMemo(() => getDailySign(dateStr, seed), [dateStr, seed]);
  const { ganZhi: gz } = result;

  const [showReading, setShowReading] = useState(false);
  const [reading, setReading] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [showPayment, setShowPayment] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [editingProfile, setEditingProfile] = useState<UserProfile>(() => getProfile());
  const profile = useMemo(() => getProfile(), [profileVersion]);

  const weatherLabel = useMemo(() => {
    const w = (profile as any).weather as string | undefined;
    switch (w) {
      case "sunny": return "晴";
      case "cloudy": return "阴";
      case "rain": return "雨";
      case "snow": return "雪";
      case "wind": return "风";
      case "fog": return "雾";
      case "hot": return "热";
      case "cold": return "冷";
      default: return "";
    }
  }, [profile]);

  const moodLabel = useMemo(() => {
    const m = (profile as any).mood as string | undefined;
    switch (m) {
      case "low": return "低落";
      case "mid": return "一般";
      case "high": return "很棒";
      default: return "";
    }
  }, [profile]);

  const dailyCalendar = useMemo(() => {
    const hash = (s: string) => {
      let h = 2166136261;
      for (let i = 0; i < s.length; i++) {
        h ^= s.charCodeAt(i);
        h = Math.imul(h, 16777619);
      }
      return (h >>> 0);
    };
    const rng = hash(seed);
    const yiPool = ["沟通协商", "整理收纳", "做计划", "轻运动", "读书学习", "断舍离", "写作记录", "早睡修复", "复盘总结", "散步晒太阳", "社交破冰", "补水养生"];
    const jiPool = ["冲动决策", "硬刚对抗", "熬夜透支", "过度消费", "情绪化发言", "拖延逃避", "过量咖啡", "无意义内耗"];
    const pick = (arr: string[], n: number, offset: number) => {
      const out: string[] = [];
      const used = new Set<number>();
      for (let i = 0; i < n; i++) {
        const idx = (rng + offset + i * 97) % arr.length;
        let j = idx;
        while (used.has(j)) j = (j + 1) % arr.length;
        used.add(j);
        out.push(arr[j]);
      }
      return out;
    };
    const yi = pick(yiPool, 3, 11);
    const ji = pick(jiPool, 2, 37);
    const adviceBase = gz.wuxingElement === "水" ? "适合回收、沉淀、慢一点" :
      gz.wuxingElement === "火" ? "适合启动、推进、把话说开" :
      gz.wuxingElement === "金" ? "适合断舍离、做取舍、立规矩" :
      gz.wuxingElement === "木" ? "适合学习成长、建立链接" : "适合稳住节奏、做基础建设";
    const moodHint = moodLabel ? `心情${moodLabel}时：先稳住，再出手。` : "";
    const weatherHint = weatherLabel ? `天气${weatherLabel}：按环境调节节奏。` : "";
    const advice = [adviceBase, moodHint, weatherHint].filter(Boolean).join(" ");
    return { yi, ji, advice };
  }, [seed, gz.wuxingElement, moodLabel, weatherLabel]);

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

        <div className="flex items-center justify-center gap-2 mt-3">
          <motion.button
            onClick={() => openHiddenProfile()}
            className="px-3 py-1.5 rounded-lg glass text-foreground/40 text-[10px] font-mono cursor-pointer"
            whileTap={{ scale: 0.98 }}
          >
            ⚙️ 个性化参数
          </motion.button>
          <div className="text-foreground/15 text-[9px] font-mono">
            生辰/心情会影响你抽到的牌
          </div>
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
              选一张，看看今天你的签（选哪张真的会影响结果）
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
        {picked ? result.fortune : " "}
      </motion.p>

      {/* Label (free) */}
      <motion.div
        className="mb-4"
        initial={{ scale: 0, rotate: -20 }}
        animate={{ scale: 1, rotate: -12 }}
        transition={{ type: "spring", stiffness: 300, damping: 15, delay: 0.5 }}
      >
        <div className="stamp text-xs">{picked ? result.label : " "}</div>
      </motion.div>

      {/* Daily calendar: 宜/忌 + 建议（本地生成，不额外消耗 token） */}
      {picked && (
        <motion.div
          className="w-full max-w-xs mb-4 p-3 rounded-xl glass"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.55 }}
        >
          <div className="flex items-center justify-between mb-2">
            <div className="text-foreground/30 text-[10px] font-mono">今日宜忌</div>
            <div className="text-foreground/15 text-[10px] font-mono">
              {weatherLabel ? `天气${weatherLabel}` : ""}
              {weatherLabel && moodLabel ? " · " : ""}
              {moodLabel ? `心情${moodLabel}` : ""}
            </div>
          </div>
          <div className="flex flex-wrap gap-2 mb-2">
            <span className="text-neon-cyan/60 text-[9px] font-mono px-2 py-0.5 rounded bg-neon-cyan/5 border border-neon-cyan/10">宜</span>
            {dailyCalendar.yi.map((t) => (
              <span key={t} className="text-foreground/35 text-[9px] font-mono px-2 py-0.5 rounded bg-foreground/5 border border-foreground/10">
                {t}
              </span>
            ))}
          </div>
          <div className="flex flex-wrap gap-2 mb-3">
            <span className="text-neon-pink/60 text-[9px] font-mono px-2 py-0.5 rounded bg-neon-pink/5 border border-neon-pink/10">忌</span>
            {dailyCalendar.ji.map((t) => (
              <span key={t} className="text-foreground/35 text-[9px] font-mono px-2 py-0.5 rounded bg-foreground/5 border border-foreground/10">
                {t}
              </span>
            ))}
          </div>
          <div className="text-foreground/45 text-[10px] leading-relaxed">
            <span className="text-foreground/25 font-mono">建议：</span>{dailyCalendar.advice}
          </div>
        </motion.div>
      )}

      {/* Derivation */}
      <motion.div
        className="text-center text-foreground/15 text-[9px] font-mono mb-4 max-w-xs leading-relaxed"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.7 }}
      >
        {gz.gan}{gz.zhi}日 → {gz.wuxing}（{gz.wuxingElement}行）→ 塔罗{result.card.element}元素 → {picked ? `赛博·${result.card.name}` : "等待你选牌"}
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

      {/* Profile/settings */}
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
                <div className="text-sm font-bold neon-text text-center">个性化参数</div>
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
                  <div className="text-foreground/30 text-[10px] font-mono">心情</div>
                  <select
                    value={editingProfile.mood ?? ""}
                    onChange={(e) => setEditingProfile((p) => ({ ...p, mood: (e.target.value || undefined) as any }))}
                    className="w-full px-3 py-2 rounded-lg glass text-foreground/70 text-xs font-mono outline-none"
                  >
                    <option value="">不设置</option>
                    <option value="low">低落</option>
                    <option value="mid">一般</option>
                    <option value="high">很棒</option>
                  </select>
                  </div>
                  <div className="space-y-1">
                    <div className="text-foreground/30 text-[10px] font-mono">天气</div>
                    <select
                      value={editingProfile.weather ?? ""}
                      onChange={(e) => setEditingProfile((p) => ({ ...p, weather: (e.target.value || undefined) as any }))}
                      className="w-full px-3 py-2 rounded-lg glass text-foreground/70 text-xs font-mono outline-none"
                    >
                      <option value="">不设置</option>
                      <option value="sunny">晴</option>
                      <option value="cloudy">阴</option>
                      <option value="rain">雨</option>
                      <option value="snow">雪</option>
                      <option value="wind">风</option>
                      <option value="fog">雾</option>
                      <option value="hot">热</option>
                      <option value="cold">冷</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <div className="text-foreground/30 text-[10px] font-mono">生辰（年月日）</div>
                    <input
                      value={editingProfile.birthDate ?? ""}
                      onChange={(e) => setEditingProfile((p) => ({ ...p, birthDate: e.target.value || undefined }))}
                      placeholder="YYYY-MM-DD"
                      className="w-full px-3 py-2 rounded-lg glass text-foreground/70 text-xs font-mono outline-none placeholder:text-foreground/15"
                    />
                  </div>
                  <div className="space-y-1">
                    <div className="text-foreground/30 text-[10px] font-mono">时辰</div>
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
                  参数只用于本机“个性化抽签”，不会上传隐私信息。
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Share overlay */}
      <AnimatePresence>
        {showShare && (
          <ShareableCard
            result={{
              ...result,
              fortune: [
                result.fortune,
                "",
                `宜：${dailyCalendar.yi.join("、")}`,
                `忌：${dailyCalendar.ji.join("、")}`,
                `建议：${dailyCalendar.advice}`,
              ].join("\n"),
              label: "每日签",
            }}
            mode="daily"
            title="每日签"
            subtitle="你的今日赛博日历"
            contextText={[
              result.fortune,
              "",
              `宜：${dailyCalendar.yi.join("、")}`,
              `忌：${dailyCalendar.ji.join("、")}`,
              `建议：${dailyCalendar.advice}`,
            ].join("\n")}
            dateStr={dateStr}
            visible={showShare}
            onClose={() => setShowShare(false)}
            ganZhi={gz}
            qrHintText="扫码抽你的每日签"
          />
        )}
      </AnimatePresence>
    </div>
  );
}
