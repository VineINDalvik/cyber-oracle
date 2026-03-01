# Web 与小程序的代码复用方案（减少双端重复修改）

问题本质：现在 **tarot 数据/牌义 + prompt 拼接 + 业务状态机** 在 Web 与小程序各写一份，任何调整都要改两边。

## 1) 今晚 MVP 先用的“最低成本复用”

- **所有 AI 解读都走同一个服务端入口**：`/api/divine`
- 双端只负责：
  - 选择/抽牌（本地）
  - 展示 UI
  - 发起请求拿文本

这样你要改“语气/字数/结构”时，主要改服务端（一次生效两端）。

## 2) 下一步最推荐：抽出一个 shared 包（monorepo）

在仓库根新增 `packages/shared/`（TypeScript），包含：
- `tarot-data`：22 张牌的基础信息、短牌义、元素、关键词
- `spread-types`：牌阵定义
- `payload-builders`：把“抽牌结果”转成结构化 payload

然后：
- Web：直接 import
- 小程序：用构建脚本把 shared 输出成 `cyber-oracle-mp/utils/shared.generated.js`

