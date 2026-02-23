"use client";

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

  return (
    <div className="relative min-h-dvh max-w-lg mx-auto pb-16">
      <ParticleBackground />

      <header className="sticky top-0 z-30 glass border-b border-card-border">
        <div className="flex items-center justify-center h-12">
          <h1 className="text-sm font-bold neon-text tracking-[0.2em] font-mono">
            赛博神算子
          </h1>
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
