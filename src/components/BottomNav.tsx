"use client";

import { motion } from "framer-motion";
import { useOracle, type Mode } from "@/lib/oracle-context";

const TABS: { id: Mode; label: string; icon: string }[] = [
  { id: "daily", label: "每日签", icon: "📅" },
  { id: "draw", label: "占卜", icon: "🃏" },
  { id: "compat", label: "合盘", icon: "💞" },
  { id: "dream", label: "解梦", icon: "🌙" },
];

export default function BottomNav() {
  const { mode, setMode } = useOracle();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40">
      <div className="max-w-lg mx-auto glass border-t border-card-border">
        <div className="flex items-center justify-around h-16">
          {TABS.map((tab) => {
            const isActive = mode === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setMode(tab.id)}
                className="relative flex flex-col items-center gap-0.5 px-4 py-2 cursor-pointer"
              >
                <span className="text-lg">{tab.icon}</span>
                <span
                  className={`text-[10px] font-mono transition-colors ${
                    isActive ? "text-neon-cyan" : "text-foreground/25"
                  }`}
                >
                  {tab.label}
                </span>
                {isActive && (
                  <motion.div
                    className="absolute -top-px left-2 right-2 h-0.5 bg-neon-cyan rounded-full"
                    layoutId="nav-indicator"
                    transition={{ type: "spring", stiffness: 400, damping: 30 }}
                  />
                )}
              </button>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
