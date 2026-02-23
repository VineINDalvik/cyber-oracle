"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { getCredits, useCredit, addCredits } from "@/lib/collection";

interface PaymentGateProps {
  title: string;
  description: string;
  price: string;
  visible: boolean;
  onClose: () => void;
  onUnlocked: () => void;
}

export default function PaymentGate({ title, description, price, visible, onClose, onUnlocked }: PaymentGateProps) {
  const [credits, setCredits] = useState(0);
  const [showSuccess, setShowSuccess] = useState(false);

  useEffect(() => {
    if (visible) setCredits(getCredits().credits);
  }, [visible]);

  const handleUseCredit = () => {
    const result = useCredit();
    if (result.success) {
      setShowSuccess(true);
      setTimeout(() => {
        setShowSuccess(false);
        onUnlocked();
      }, 800);
    }
  };

  const handleSimulatePay = () => {
    addCredits(10);
    setCredits(getCredits().credits + 10);
    setShowSuccess(true);
    setTimeout(() => {
      setShowSuccess(false);
      onUnlocked();
    }, 800);
  };

  if (!visible) return null;

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-sm"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      >
        <motion.div
          className="w-full max-w-lg rounded-t-3xl overflow-hidden"
          initial={{ y: "100%" }}
          animate={{ y: 0 }}
          exit={{ y: "100%" }}
          transition={{ type: "spring", damping: 25, stiffness: 300 }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Gradient header */}
          <div className="relative px-6 pt-6 pb-4 bg-gradient-to-b from-neon-cyan/10 via-surface to-surface">
            <div className="w-10 h-1 bg-foreground/10 rounded-full mx-auto mb-4" />
            <h3 className="text-lg font-bold neon-text text-center">{title}</h3>
            <p className="text-foreground/40 text-xs text-center mt-1">{description}</p>
          </div>

          <div className="bg-surface px-6 pb-8 space-y-3">
            {/* Success state */}
            {showSuccess ? (
              <motion.div
                className="py-8 text-center"
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
              >
                <div className="text-4xl mb-2">✨</div>
                <p className="text-neon-cyan font-mono text-sm">已解锁</p>
              </motion.div>
            ) : (
              <>
                {/* Credit balance */}
                <div className="flex items-center justify-between p-3 rounded-xl glass">
                  <span className="text-foreground/40 text-xs font-mono">灵力余额</span>
                  <span className="text-neon-gold font-bold font-mono">{credits} 灵力</span>
                </div>

                {/* Use credit */}
                {credits > 0 ? (
                  <motion.button
                    onClick={handleUseCredit}
                    className="w-full py-4 rounded-xl bg-gradient-to-r from-neon-cyan/20 to-neon-purple/20 border border-neon-cyan/30 text-neon-cyan font-mono text-sm cursor-pointer"
                    whileTap={{ scale: 0.98 }}
                  >
                    ⚡ 消耗 1 灵力解锁 <span className="text-foreground/30">（剩余 {credits}）</span>
                  </motion.button>
                ) : (
                  <div className="text-center py-2 text-foreground/20 text-xs font-mono">
                    灵力不足
                  </div>
                )}

                {/* Divider */}
                <div className="flex items-center gap-3 py-1">
                  <div className="flex-1 h-px bg-foreground/5" />
                  <span className="text-foreground/15 text-[10px] font-mono">或</span>
                  <div className="flex-1 h-px bg-foreground/5" />
                </div>

                {/* Payment options */}
                <div className="space-y-2">
                  <motion.button
                    onClick={handleSimulatePay}
                    className="w-full py-4 rounded-xl bg-[#07c160]/10 border border-[#07c160]/30 flex items-center justify-center gap-2 cursor-pointer"
                    whileTap={{ scale: 0.98 }}
                  >
                    <span className="text-[#07c160] text-xl">💚</span>
                    <span className="text-[#07c160] font-mono text-sm">微信支付 {price}</span>
                  </motion.button>

                  <motion.button
                    onClick={handleSimulatePay}
                    className="w-full py-4 rounded-xl bg-[#1677ff]/10 border border-[#1677ff]/30 flex items-center justify-center gap-2 cursor-pointer"
                    whileTap={{ scale: 0.98 }}
                  >
                    <span className="text-[#1677ff] text-xl">💙</span>
                    <span className="text-[#1677ff] font-mono text-sm">支付宝 {price}</span>
                  </motion.button>
                </div>

                {/* Pricing tiers */}
                <div className="pt-2">
                  <p className="text-foreground/15 text-[10px] font-mono text-center mb-2">灵力套餐</p>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { amount: 10, price: "¥9.9", tag: "" },
                      { amount: 30, price: "¥19.9", tag: "热门" },
                      { amount: 100, price: "¥49.9", tag: "超值" },
                    ].map((tier) => (
                      <motion.button
                        key={tier.amount}
                        onClick={() => { addCredits(tier.amount); setCredits((c) => c + tier.amount); }}
                        className="relative py-3 rounded-lg glass text-center cursor-pointer"
                        whileTap={{ scale: 0.95 }}
                      >
                        {tier.tag && (
                          <span className="absolute -top-1.5 right-1 text-[7px] px-1.5 py-0.5 rounded bg-neon-pink/80 text-white font-mono">
                            {tier.tag}
                          </span>
                        )}
                        <div className="text-neon-gold font-bold text-sm font-mono">{tier.amount}</div>
                        <div className="text-foreground/30 text-[10px] font-mono">灵力</div>
                        <div className="text-neon-cyan/50 text-[10px] font-mono mt-0.5">{tier.price}</div>
                      </motion.button>
                    ))}
                  </div>
                </div>

                {/* Fine print */}
                <p className="text-foreground/10 text-[9px] font-mono text-center pt-2">
                  新用户赠送 3 灵力 · 7日签到送 1 灵力 · 支付即表示同意服务条款
                </p>
              </>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
