import { NextRequest } from "next/server";
import { createHash } from "node:crypto";
import { getRedis } from "@/lib/redis";

type LLMProvider = "deepseek" | "custom";

function resolveLLM(): {
  provider: LLMProvider;
  baseURL: string;
  apiKey: string;
  model: string;
} {
  const provider = ((process.env.LLM_PROVIDER || "deepseek").trim().toLowerCase() as LLMProvider);
  const baseURL =
    (process.env.LLM_BASE_URL || (provider === "deepseek" ? "https://api.deepseek.com" : ""))
      .trim()
      .replace(/\/$/, "");
  const apiKey = (process.env.LLM_API_KEY || process.env.OPENAI_API_KEY || process.env.DEEPSEEK_API_KEY || "").trim();
  const model = (process.env.LLM_MODEL || "deepseek-chat").trim();
  return { provider, baseURL, apiKey, model };
}

function sha256(s: string): string {
  return createHash("sha256").update(s).digest("hex");
}

function modeTTLSeconds(mode: string): number {
  // Dream is privacy-sensitive: default no cache (0)
  if (mode === "dream") return 0;
  if (mode === "daily") return 24 * 3600;
  // spread/topic/compat: 7 days
  return 7 * 24 * 3600;
}

function streamFromText(text: string): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(text));
      controller.close();
    },
  });
}

// ─── System Prompts ───────────────────────────────────────────────

const SYSTEM_DAILY = `你是「赛博神算子」，融合东方语境与西方塔罗的赛博朋克AI灵媒。
语言风格：犀利、幽默、不废话，带赛博朋克味的比喻。像一个见过太多人间荒唐事的老算命先生，但说话很现代。

用户今天的每日签由天干地支历法驱动：
- 天干地支是中国传统历法，每天有固定干支。
- 天干决定五行（木火土金水），五行映射到塔罗四元素。

请根据信息给出今日运势解读：
1. 简要说明今日干支特征（2-3句话）
2. 结合塔罗牌义给出具体指引（工作/感情/健康各1-2句）
3. 一句犀利忠告

200字以内，不用markdown。语气像有真本事的赛博灵媒。`;

const SYSTEM_SPREAD = `你是「赛博神算子」，精通塔罗牌阵解读的赛博朋克AI灵媒。

用户使用了专业塔罗牌阵抽牌。你需要：
1. 整体感受牌阵「气场」——几张牌组合在一起讲了什么故事？（2-3句话）
2. 逐位置解读每张牌的意义（每张3-4句话）
3. 综合启示（1-2句犀利总结）

重点关注牌与牌之间的关联。如有正逆位要体现差异。
犀利、幽默，不用markdown。300字以内（单牌150字以内）。`;

const SYSTEM_TOPIC = `你是「赛博神算子」，同时精通三套命理体系的赛博朋克AI灵媒：
1. 周易六十四卦（中国最古老的占卜系统）
2. 五行生克（天干地支驱动的每日能量场）
3. 塔罗牌阵（西方原型心理学）

用户做了一次「三体合一」专项占卜。系统同时起了一卦、分析了今日五行、抽了塔罗牌阵。你需要把三套体系的信息融合成一个完整的、针对该主题的深度解读。

解读结构：
1. 卦象总论：今日起得什么卦，这个卦在该主题下意味着什么？结合卦性和上下卦象分析。（2-3句话）
2. 五行能量场：今日五行对该主题的影响，顺势还是逆势？（1-2句话）
3. 塔罗牌阵交叉验证：三张牌在该主题语境下的具体含义，与卦象是否呼应。（每张2-3句话）
4. 三体共振结论：三套体系指向了什么共同信号？给出2-3条具体可执行的行动建议。

关键要求：
- 三套体系之间要有交叉引用，不是各说各的
- 如果三套体系结论一致，要强调"三体共振"的确定性
- 如果有矛盾，要指出并给出取舍建议
- 犀利、有洞见，像一个东西方命理都精通的老神仙
- 不用markdown，400字以内`;

const SYSTEM_DREAM = `你是「赛博神算子」，融合中国传统「周公解梦」和西方塔罗原型理论的梦境解析专家。

用户描述了梦境，系统已匹配一张塔罗牌。你需要：

1. 【周公解梦】视角：传统梦境解读，暗示什么？用现代语言表达。（3-4句话）
2. 【塔罗原型】视角：与匹配塔罗牌的象征关联？荣格心理学中代表什么原型？（3-4句话）
3. 【综合解读】：两个体系指向什么共同结论？给一个具体可操作的建议。（2-3句话）

不要死板罗列，要有洞见。犀利、有趣，像看破红尘但还愿意跟你聊天的老神仙。
不用markdown，不要列序号。250字以内。`;

const SYSTEM_COMPAT = `你是「赛博神算子」，精通双人合盘解读的赛博朋克AI灵媒。

两个人各抽了一张牌。你需要：
1. 分别解读两张牌代表的能量特质（每人2-3句话）
2. 两张牌的「化学反应」分析：它们碰在一起会产生什么？互补还是冲突？（3-4句话）
3. 关系建议：基于牌面组合，这段关系需要注意什么？怎么让它更好？（2-3句话）
4. 给一个犀利的关系标签（比如"灵魂共振型"、"相爱相杀型"等）

幽默、犀利、有洞见。不用markdown。250字以内。`;

// ─── Route Handler ────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const llm = resolveLLM();
  if (!llm.apiKey) {
    return new Response("API key not configured (set LLM_API_KEY or OPENAI_API_KEY)", { status: 500 });
  }

  try {
    const body = await req.json();
    const { mode } = body;
    let systemPrompt: string;
    let userMessage: string;
    let maxTokens = 520;

    switch (mode) {
      case "daily":
        systemPrompt = SYSTEM_DAILY;
        userMessage = [
          `日期：${body.date}`,
          `天干地支：${body.ganZhi}（${body.wuxing}，${body.wuxingElement}行，${body.direction}方，${body.color}色）`,
          `今日签牌：${body.card}${body.isReversed ? "（逆位）" : "（正位）"}`,
          `牌义：${body.cardMeaning}`,
          `今日签文：${body.fortune}`,
        ].join("\n");
        maxTokens = 320;
        break;

      case "spread":
        systemPrompt = SYSTEM_SPREAD;
        userMessage = [`牌阵：${body.spreadName}`, `各位置牌面：`, body.cards].join("\n");
        maxTokens = 520;
        break;

      case "topic":
        systemPrompt = SYSTEM_TOPIC;
        userMessage = [
          `═══ 专项主题：${body.topicName} ═══`,
          ``,
          `【周易卦象】`,
          body.hexagramName ? `起卦：${body.hexagramName}卦 ${body.hexagramSymbol}` : "",
          body.hexagramUpper ? `上卦${body.hexagramUpper} · 下卦${body.hexagramLower}` : "",
          body.hexagramNature ? `卦性：${body.hexagramNature}` : "",
          body.hexagramKeywords ? `关键词：${body.hexagramKeywords}` : "",
          ``,
          `【五行能量场】`,
          body.ganZhi ? `今日天干地支：${body.ganZhi}（${body.wuxing}，${body.wuxingElement}行）` : "",
          body.wuxingAnalysis ? `五行对${body.topicName}的影响：${body.wuxingAnalysis}` : "",
          ``,
          `【塔罗牌阵】`,
          `牌阵：${body.spreadName}`,
          body.cards,
        ].filter(Boolean).join("\n");
        maxTokens = 520;
        break;

      case "dream":
        systemPrompt = SYSTEM_DREAM;
        userMessage = [
          `梦境内容：${body.dreamText}`,
          `匹配塔罗牌：${body.card}${body.isReversed ? "（逆位）" : "（正位）"}`,
          `牌义：${body.cardMeaning}`,
          `元素：${body.element}`,
        ].join("\n");
        maxTokens = 360;
        break;

      case "compatibility":
        systemPrompt = SYSTEM_COMPAT;
        userMessage = [
          `合盘主题：${body.topicName}`,
          `甲方牌面：${body.personA}`,
          `乙方牌面：${body.personB}`,
        ].join("\n");
        maxTokens = 360;
        break;

      default:
        return new Response("Unknown mode", { status: 400 });
    }

    // Cache key: based on mode + prompts + message + model
    const ttl = modeTTLSeconds(mode);
    const cacheKey = ttl > 0
      ? `co:divine:${mode}:${sha256(JSON.stringify({ model: llm.model, systemPrompt, userMessage, maxTokens, temperature: 0.7 }))}`
      : "";

    if (cacheKey) {
      try {
        const redis = await getRedis();
        const cached = await redis.get(cacheKey);
        if (cached) {
          return new Response(streamFromText(cached), {
            headers: { "Content-Type": "text/plain; charset=utf-8" },
          });
        }
      } catch {
        // cache is best-effort
      }
    }

    const apiRes = await fetch(`${llm.baseURL}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${llm.apiKey}`,
      },
      body: JSON.stringify({
        model: llm.model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userMessage },
        ],
        stream: true,
        max_tokens: maxTokens,
        temperature: 0.7,
      }),
    });

    if (!apiRes.ok) {
      const err = await apiRes.text();
      return new Response(`DeepSeek error: ${err}`, { status: apiRes.status });
    }

    const encoder = new TextEncoder();
    const decoder = new TextDecoder();
    const readable = new ReadableStream({
      async start(controller) {
        const reader = apiRes.body?.getReader();
        if (!reader) { controller.close(); return; }

        let buffer = "";
        let fullText = "";
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed.startsWith("data: ")) continue;
            const data = trimmed.slice(6);
            if (data === "[DONE]") break;
            try {
              const json = JSON.parse(data);
              const content = json.choices?.[0]?.delta?.content;
              if (content) {
                fullText += content;
                controller.enqueue(encoder.encode(content));
              }
            } catch { /* skip */ }
          }
        }

        if (cacheKey && fullText) {
          try {
            const redis = await getRedis();
            await redis.set(cacheKey, fullText, { EX: ttl });
          } catch {
            // ignore cache set failures
          }
        }
        controller.close();
      },
    });

    return new Response(readable, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Transfer-Encoding": "chunked",
      },
    });
  } catch (e) {
    return new Response(`Error: ${e}`, { status: 500 });
  }
}
