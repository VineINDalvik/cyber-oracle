"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { getCollectionStats, dailyCheckin, getCredits, addCredits } from "@/lib/collection";
import type { CollectionData } from "@/lib/collection";

interface CollectionBarProps {
  dateStr: string;
  onNewCardSeen?: () => void;
}

export default function CollectionBar({ dateStr }: CollectionBarProps) {
  const [stats, setStats] = useState<CollectionData | null>(null);
  const [showPanel, setShowPanel] = useState(false);
  const [checkinMsg, setCheckinMsg] = useState<string | null>(null);
  const [credits, setCredits] = useState(0);

  useEffect(() => {
    setStats(getCollectionStats());
    setCredits(getCredits().credits);
  }, []);

  const handleCheckin = async () => {
    const result = await dailyCheckin(dateStr);
    if (result.isNew) {
      if (result.streakReward) {
        await addCredits(1);
        setCredits((c) => c + 1);
        setCheckinMsg(`连续签到 ${result.data.checkinStreak} 天！奖励 1 灵力 ✨`);
      } else {
        setCheckinMsg(`签到成功！连续 ${result.data.checkinStreak} 天 📅`);
      }
      setStats(result.data);
    } else {
      setCheckinMsg("今天已签到 ✓");
    }
    setTimeout(() => setCheckinMsg(null), 2500);
  };

  if (!stats) return null;

  const collected = stats.seenCards.length;
  const total = 22;
  const pct = Math.round((collected / total) * 100);
  const alreadyCheckedIn = stats.checkinDays.includes(dateStr);

  return (
    <>
      {/* Compact bar */}
      <motion.div
        className="w-full max-w-xs mx-auto flex items-center gap-2 px-3 py-2 rounded-xl glass cursor-pointer"
        onClick={() => setShowPanel(!showPanel)}
        whileTap={{ scale: 0.98 }}
        initial={{ y: 10, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.8 }}
      >
        <div className="flex-1">
          <div className="flex items-center justify-between mb-1">
            <span className="text-foreground/30 text-[9px] font-mono">塔罗图鉴 {collected}/{total}</span>
            <span className="text-neon-gold/50 text-[9px] font-mono">⚡{credits} 灵力</span>
          </div>
          <div className="w-full h-1 bg-foreground/5 rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-gradient-to-r from-neon-cyan/50 to-neon-purple/50 rounded-full"
              initial={{ width: 0 }}
              animate={{ width: `${pct}%` }}
              transition={{ duration: 1, delay: 1 }}
            />
          </div>
        </div>
        <span className="text-foreground/15 text-[10px]">{showPanel ? "▲" : "▼"}</span>
      </motion.div>

      {/* Checkin toast */}
      <AnimatePresence>
        {checkinMsg && (
          <motion.div
            className="fixed top-16 left-1/2 z-50 px-4 py-2 rounded-xl glass text-neon-cyan text-xs font-mono"
            style={{ transform: "translateX(-50%)" }}
            initial={{ y: -20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -20, opacity: 0 }}
          >
            {checkinMsg}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Expanded panel */}
      <AnimatePresence>
        {showPanel && (
          <motion.div
            className="w-full max-w-xs mx-auto mt-2 p-4 rounded-xl glass overflow-hidden"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
          >
            {/* Checkin button */}
            <div className="flex items-center justify-between mb-3">
              <div className="text-foreground/30 text-[10px] font-mono">
                连续签到 {stats.checkinStreak} 天
                {stats.checkinStreak > 0 && stats.checkinStreak % 7 !== 0 &&
                  ` · 再签 ${7 - (stats.checkinStreak % 7)} 天得灵力`}
              </div>
              <motion.button
                onClick={(e) => { e.stopPropagation(); handleCheckin(); }}
                disabled={alreadyCheckedIn}
                className={`px-3 py-1 rounded-lg text-[10px] font-mono cursor-pointer ${
                  alreadyCheckedIn
                    ? "bg-foreground/5 text-foreground/20"
                    : "bg-neon-cyan/10 text-neon-cyan border border-neon-cyan/20"
                }`}
                whileTap={{ scale: 0.95 }}
              >
                {alreadyCheckedIn ? "已签到 ✓" : "📅 签到"}
              </motion.button>
            </div>

            {/* Card grid - miniature cards */}
            <div className="grid grid-cols-11 gap-1">
              {Array.from({ length: 22 }, (_, i) => {
                const seen = stats.seenCards.includes(i);
                return (
                  <div
                    key={i}
                    className={`aspect-[2/3] rounded-sm ${
                      seen
                        ? "bg-gradient-to-b from-neon-cyan/20 to-neon-purple/20 border border-neon-cyan/20"
                        : "bg-foreground/3 border border-foreground/5"
                    }`}
                    title={seen ? `#${i}` : "???"}
                  >
                    {seen && (
                      <div className="w-full h-full flex items-center justify-center text-[6px] text-neon-cyan/50 font-mono">
                        {i}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="flex items-center justify-between mt-3">
              <span className="text-foreground/15 text-[9px] font-mono">
                总解读 {stats.totalReadings} 次
              </span>
              <span className="text-foreground/15 text-[9px] font-mono">
                集齐 22 张解锁「赛博命运之眼」
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
