"use client";

import Image from "next/image";

interface CardFaceProps {
  cardId: number;
  reversed?: boolean;
  size?: "sm" | "md" | "lg";
  className?: string;
}

const CARD_NAMES: Record<number, { zh: string; cyber: string }> = {
  0: { zh: "愚者", cyber: "数据漫游者" },
  1: { zh: "魔术师", cyber: "代码织者" },
  2: { zh: "女祭司", cyber: "暗网先知" },
  3: { zh: "女皇", cyber: "矩阵之母" },
  4: { zh: "皇帝", cyber: "防火墙主宰" },
  5: { zh: "教皇", cyber: "协议守护者" },
  6: { zh: "恋人", cyber: "量子纠缠" },
  7: { zh: "战车", cyber: "光速飞驰" },
  8: { zh: "力量", cyber: "算力觉醒" },
  9: { zh: "隐者", cyber: "离线修行者" },
  10: { zh: "命运之轮", cyber: "随机数生成器" },
  11: { zh: "正义", cyber: "智能合约" },
  12: { zh: "倒吊人", cyber: "系统挂起" },
  13: { zh: "死神", cyber: "格式化" },
  14: { zh: "节制", cyber: "负载均衡" },
  15: { zh: "恶魔", cyber: "病毒入侵" },
  16: { zh: "高塔", cyber: "系统崩溃" },
  17: { zh: "星辰", cyber: "卫星信号" },
  18: { zh: "月亮", cyber: "暗物质" },
  19: { zh: "太阳", cyber: "核聚变" },
  20: { zh: "审判", cyber: "终极审计" },
  21: { zh: "世界", cyber: "全球网络" },
};

const SIZE_MAP = {
  sm: { w: 96, h: 160, imgW: 96, imgH: 160 },
  md: { w: 160, h: 267, imgW: 160, imgH: 267 },
  lg: { w: 220, h: 367, imgW: 220, imgH: 367 },
};

export default function CardFace({ cardId, reversed = false, size = "md", className = "" }: CardFaceProps) {
  const names = CARD_NAMES[cardId];
  const dims = SIZE_MAP[size];
  if (!names) return null;

  const paddedId = String(cardId).padStart(2, "0");
  const imageSrc = `/cards/${paddedId}.jpg`;

  return (
    <div
      className={`relative rounded-xl overflow-hidden select-none ${className}`}
      style={{ width: dims.w, height: dims.h }}
    >
      {/* Card image */}
      <Image
        src={imageSrc}
        alt={`赛博·${names.zh}`}
        width={dims.imgW}
        height={dims.imgH}
        className="w-full h-full object-cover"
        priority={size === "lg"}
      />

      {/* Cyberpunk overlay gradient */}
      <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a0fcc] via-transparent to-[#0a0a0f44] pointer-events-none" />

      {/* Neon border */}
      <div
        className="absolute inset-0 rounded-xl pointer-events-none"
        style={{
          border: "1px solid rgba(0, 240, 255, 0.25)",
          boxShadow: "inset 0 0 20px rgba(0, 240, 255, 0.05), 0 0 10px rgba(0, 240, 255, 0.1)",
        }}
      />

      {/* Card name overlay at bottom */}
      <div className="absolute bottom-0 left-0 right-0 px-2 pb-2 pt-6 bg-gradient-to-t from-[#0a0a0f] to-transparent">
        <div className="text-center">
          <div
            className="font-bold tracking-wider neon-text"
            style={{ fontSize: size === "sm" ? 9 : size === "md" ? 11 : 13 }}
          >
            赛博·{names.zh}
          </div>
          {size !== "sm" && (
            <div
              className="font-mono text-neon-cyan/40 mt-0.5"
              style={{ fontSize: size === "md" ? 8 : 9 }}
            >
              [ {names.cyber} ]
            </div>
          )}
        </div>
      </div>

      {/* Reversed badge - text stays readable, just adds a badge */}
      {reversed && (
        <div className="absolute top-2 right-2 px-1.5 py-0.5 rounded bg-neon-pink/80 text-white font-mono"
          style={{ fontSize: size === "sm" ? 7 : 9 }}
        >
          ⟲ 逆位
        </div>
      )}
    </div>
  );
}

export function CardBack({ size = "md", className = "" }: { size?: "sm" | "md" | "lg"; className?: string }) {
  const dims = SIZE_MAP[size];

  return (
    <div
      className={`relative rounded-xl overflow-hidden select-none ${className}`}
      style={{ width: dims.w, height: dims.h }}
    >
      <div className="absolute inset-0 bg-gradient-to-br from-[#1a1a2e] via-[#16213e] to-[#1a1a2e]" />

      {/* Cross-hatch pattern */}
      <div
        className="absolute inset-0 opacity-[0.06]"
        style={{
          backgroundImage: "repeating-linear-gradient(45deg, #00f0ff 0, #00f0ff 1px, transparent 0, transparent 50%)",
          backgroundSize: "10px 10px",
        }}
      />

      {/* Borders */}
      <div className="absolute inset-0 rounded-xl border border-[#00f0ff22]" />
      <div
        className="absolute rounded-lg"
        style={{ inset: size === "sm" ? 4 : 8, border: "1px solid #00f0ff15" }}
      />

      {/* Central trigram */}
      <div className="absolute inset-0 flex items-center justify-center">
        <svg viewBox="0 0 60 60" width={size === "sm" ? 30 : 50} height={size === "sm" ? 30 : 50} className="opacity-20">
          <line x1="15" y1="15" x2="45" y2="15" stroke="#00f0ff" strokeWidth="3" />
          <line x1="15" y1="22" x2="28" y2="22" stroke="#00f0ff" strokeWidth="3" />
          <line x1="32" y1="22" x2="45" y2="22" stroke="#00f0ff" strokeWidth="3" />
          <line x1="15" y1="30" x2="45" y2="30" stroke="#00f0ff" strokeWidth="3" />
          <line x1="15" y1="38" x2="28" y2="38" stroke="#00f0ff" strokeWidth="3" />
          <line x1="32" y1="38" x2="45" y2="38" stroke="#00f0ff" strokeWidth="3" />
          <line x1="15" y1="45" x2="45" y2="45" stroke="#00f0ff" strokeWidth="3" />
        </svg>
      </div>

      {/* Shimmer */}
      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-[#00f0ff08] to-transparent animate-shimmer" />
    </div>
  );
}
