"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { OracleProvider, useOracle } from "@/lib/oracle-context";
import ParticleBackground from "@/components/ParticleBackground";
import BottomNav from "@/components/BottomNav";
import DailySign from "@/components/DailySign";
import QuickDraw from "@/components/QuickDraw";
import Compatibility from "@/components/Compatibility";
import DreamDecode from "@/components/DreamDecode";

function OracleApp() {
  const { mode } = useOracle();
  const [showTip, setShowTip] = useState(false);

  return (
    <div className="relative min-h-dvh max-w-lg mx-auto pb-16">
      <ParticleBackground />

      <header className="sticky top-0 z-30 glass border-b border-card-border">
        <div className="flex items-center justify-center h-12 relative">
          <h1 className="text-sm font-bold neon-text tracking-[0.2em] font-mono">
            赛博神算子
          </h1>
          <button
            onClick={() => setShowTip(true)}
            className="absolute right-3 top-1/2 -translate-y-1/2 px-3 py-1.5 rounded-lg glass text-foreground/50 text-[10px] font-mono cursor-pointer hover:bg-white/[0.04]"
          >
            ☕ 赞赏
          </button>
        </div>
      </header>

      <main className="relative z-10">
        <AnimatePresence mode="wait">
          {mode === "daily" && (
            <motion.div key="daily" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} transition={{ duration: 0.3 }}>
              <DailySign />
            </motion.div>
          )}
          {mode === "draw" && (
            <motion.div key="draw" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} transition={{ duration: 0.3 }}>
              <QuickDraw />
            </motion.div>
          )}
          {mode === "compat" && (
            <motion.div key="compat" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} transition={{ duration: 0.3 }}>
              <Compatibility />
            </motion.div>
          )}
          {mode === "dream" && (
            <motion.div key="dream" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} transition={{ duration: 0.3 }}>
              <DreamDecode />
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      <BottomNav />

      <AnimatePresence>
        {showTip && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-black/80 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowTip(false)}
          >
            <motion.div
              className="w-full max-w-sm rounded-2xl glass border border-card-border p-5"
              initial={{ scale: 0.96, y: 12, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.96, y: 12, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-3">
                <div className="text-sm font-bold neon-text">赞赏支持</div>
                <button
                  onClick={() => setShowTip(false)}
                  className="text-foreground/30 text-xs font-mono"
                >
                  关闭
                </button>
              </div>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/images/tip-qrcode.jpg"
                alt="赞赏二维码"
                className="w-56 h-56 mx-auto rounded-xl object-cover object-center"
              />
              <div className="text-center text-foreground/30 text-[10px] font-mono mt-3">
                微信里长按识别二维码 · 电脑端用微信扫码
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function Page() {
  return (
    <OracleProvider>
      <OracleApp />
    </OracleProvider>
  );
}
