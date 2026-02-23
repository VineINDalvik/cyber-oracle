#!/bin/bash
# Cyber Oracle — 一键提交 & 部署
# 用法: ./deploy.sh [commit message]
# 示例: ./deploy.sh "fix: 修复翻牌动画"
#       ./deploy.sh              (自动生成时间戳消息)

set -e

cd "$(dirname "$0")"

MSG="${1:-"deploy: $(date '+%Y-%m-%d %H:%M:%S')"}"

echo "══════════════════════════════════════"
echo "  🔮 Cyber Oracle Deploy"
echo "══════════════════════════════════════"

# 1. Git commit & push
echo ""
echo "▸ Git add & commit..."
git add -A
if git diff --cached --quiet; then
  echo "  ✓ 没有变更，跳过 commit"
else
  git commit -m "$MSG"
  echo "  ✓ Committed: $MSG"
fi

echo "▸ Git push..."
git push origin main
echo "  ✓ Pushed to GitHub"

# 2. Vercel 自动部署（GitHub 集成会自动触发）
echo ""
echo "▸ Vercel 已连接 GitHub，push 后自动部署"
echo "  → https://cyber-oracle-nine.vercel.app"
echo ""

# 3. 同步小程序代码（从 web 端同步关键文件到 mp）
MP_DIR="../cyber-oracle-mp"
if [ -d "$MP_DIR" ]; then
  echo "▸ 检测到小程序目录，提醒同步"
  echo "  ⚠ 如有 tarot.ts 改动，记得同步 $MP_DIR/utils/tarot.js"
fi

echo ""
echo "══════════════════════════════════════"
echo "  ✅ Done!"
echo "══════════════════════════════════════"
