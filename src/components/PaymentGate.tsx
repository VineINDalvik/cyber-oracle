"use client";

import { useEffect } from "react";

interface PaymentGateProps {
  title: string;
  description: string;
  price: string;
  visible: boolean;
  onClose: () => void;
  onUnlocked: () => void;
}

export default function PaymentGate({ title, description, price, visible, onClose, onUnlocked }: PaymentGateProps) {
  useEffect(() => {
    // MVP: 暂时移除付费/灵力解锁，直接放行
    if (!visible) return;
    Promise.resolve().then(() => {
      try {
        onUnlocked();
      } catch {
        onClose();
      }
    });
  }, [visible]);
  // 不渲染任何付费 UI
  return null;
}
