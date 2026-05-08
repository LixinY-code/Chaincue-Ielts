import { verifyUser } from './lib/supabase.js';

// =============================================
// Phase 1: 分组 Prompt
// =============================================
function buildPhase1Prompt(experience, topics) {
  const topicList = topics.map((t, i) => `${i + 1}. ${t.cn} — ${t.en}`).join('\n');
  return `You are an IELTS Part 2 topic matching expert.

## User's experience:
${experience}

## Available topics (${topics.length}):
${topicList}

## Task:
1. Analyze the user's experience and split it into 1-5 core events/stories
2. Match each event to topics that can share the SAME story (2-10 topics per group, MAX 10 topics per group)
3. Topics that DON'T fit any shared group should be listed as "solo" topics (one topic per group)
4. For each matched topic, write a SHORT reason (20-40 words) explaining the connection

## Output format (JSON ONLY):
{
  "groups": [
    {
      "type": "shared",
      "event_summary": "One Chinese sentence summarizing this story",
      "topics": [
        { "cn": "...", "en": "...", "short_reason": "..." }
      ]
    },
    {
      "type": "solo",
      "event_summary": "Which part of the experience fits this topic",
      "topics": [
        { "cn": "...", "en": "...", "short_reason": "..." }
      ]
    }
  ]
}

## Rules:
- Group topics sharing the SAME core story together (type: "shared"), MAX 10 topics per group
- If a shared group would exceed 10 topics, split it into multiple groups
- Topics that can't share should be solo (type: "solo", 1 topic each)
- Every topic from the list MUST appear in exactly one group
- Return valid JSON only, nothing else`;
}

// =============================================
// Phase 2a: 共享组脚本生成 Prompt
// =============================================
function buildSharedGroupPrompt(experience, group) {
  const topicList = group.topics.map((t, i) =>
    `${i + 1}. ${t.cn} — ${t.en}\n   Reason: ${t.reason}`
  ).join('\n');
  return `You are an IELTS speaking expert. The user has one shared experience that can chain multiple Part 2 topics.

## Original experience:
${experience}

## Story angle:
${group.summary}

## Topics to chain (${group.topics.length}):
${topicList}

## OUTPUT FORMAT:

Produce ONE shared main body paragraph (100-150 words), then for EACH topic provide:
- opening (40-50 words): casual, unique per topic
- enhancement (40-50 words): tweak the angle for this topic, include a Chinese 侧重点 note
- ending (40-50 words): casual reflection, unique per topic

Each topic's full script = opening + shared_body + enhancement + ending ≈ 220-290 words.

## CRITICAL RULES:

### Shared Main Body (100-150 words):
- Tell the core story. Short, natural sentences. Use "like", "you know", "honestly", "actually", "I mean", "right?"
- Contractions: "I'm", "don't", "didn't", "it's", "that's", "there's", "can't", "wasn't"
- Sensory + emotion details. One believable detail (name, quote, moment).
- This paragraph is the SAME for all topics.

### Per-Topic Parts:
- **Opening**: Start casual, NOT "The topic I want to talk about is..."
- **Enhancement**: NEW content bridging shared story to THIS topic. Include enhancement_note in Chinese.
- **Ending**: Casual reflection, NOT "In conclusion"

## Output format (JSON ONLY):
{
  "shared_body": "The shared main body paragraph (100-150 words)",
  "topics": [
    {
      "cn": "Chinese topic name (exact match)",
      "opening": "...",
      "enhancement": "...",
      "enhancement_note": "侧重点说明（中文）",
      "ending": "..."
    }
  ]
}

EVERY topic MUST be included. Do NOT skip any.
Return JSON only. No explanations. No markdown fences.`;
}

// =============================================
// Phase 2b: 独立组脚本生成 Prompt
// =============================================
function buildSoloPrompt(experience, topic) {
  return `You are an IELTS speaking expert. Write a complete Part 2 speaking script for ONE topic based on the user's experience.

## Original experience:
${experience}

## Topic to cover:
${topic.cn} — ${topic.en}

## Connection:
${topic.reason}

## OUTPUT REQUIREMENTS:
Write a COMPLETE natural, colloquial IELTS Part 2 speaking script (180-250 words).

Structure:
- Opening (~40 words): Start casual — NOT "The topic I want to talk about is..."
- Main Body (~100-130 words): Short sentences, "like", "you know", "honestly", "actually". Contractions. Sensory details. One believable detail.
- Ending (~40 words): Casual reflection — NOT "In conclusion"

⚠️ WORD COUNT: 180-250 words. Under 180 words will be REJECTED.

Write only the script in English. No JSON. No explanations.`;
}

// =============================================
// AI 调用封装
// =============================================
async function callAI(prompt, { temperature = 0.2, max_tokens = 4000 } = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 120000);

  try {
    const res = await fetch('https://sg.uiuiapi.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.UIUI_API_KEY}`
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: 'You are an IELTS speaking expert. Return only the requested output — no explanations, no apologies, no preamble. Write in natural, conversational English.' },
          { role: 'user', content: prompt }
        ],
        temperature,
        max_tokens
      }),
      signal: controller.signal
    });

    clearTimeout(timeout);

    if (!res.ok) {
      let errMsg = '';
      try { errMsg = await res.text(); } catch {}
      if (res.status === 401) throw new Error('AI API Key 无效');
      if (res.status === 429) throw new Error('AI 请求太频繁，请稍后再试');
      throw new Error(`AI API 返回 ${res.status}: ${errMsg.substring(0, 100)}`);
    }

    const data = await res.json();
    const content = data.choices?.[0]?.message?.content?.trim();
    if (!content) throw new Error('AI 返回内容为空');
    return content;
  } catch (err) {
    clearTimeout(timeout);
    if (err.name === 'AbortError') throw new Error('AI 请求超时（120s）');
    throw err;
  }
}

// 从 AI 返回中提取 JSON
function parseJSON(raw) {
  try {
    const match = raw.match(/\{[\s\S]*\}/);
    if (match) return JSON.parse(match[0]);
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

// 快速兜底脚本
function generateQuickFallback(topic, experience) {
  return `To be honest, ${topic.cn.toLowerCase()} is something that really means a lot to me. ${experience.substring(0, 200)} And you know, I think looking back on it now, it was honestly one of those moments that changed the way I see things. So yeah, that's my story, and I'd say it's something I'll carry with me for a long time. I guess that's why it still matters to me even now.`;
}

// =============================================
// Phase 1: 分组
// =============================================
async function phase1Grouping(experience, topics) {
  const prompt = buildPhase1Prompt(experience, topics);
  const raw = await callAI(prompt, { temperature: 0.2, max_tokens: 2000 });

  const data = parseJSON(raw);
  if (data && data.groups && data.groups.length > 0) {
    return data.groups.map(g => ({
      type: g.type === 'solo' ? 'solo' : 'shared',
      summary: g.event_summary || '提取的经历',
      topics: (g.topics || []).map(t => ({
        cn: t.cn || '',
        en: t.en || '',
        reason: t.short_reason || '与你的经历相关'
      }))
    }));
  }
  return [];
}

// =============================================
// Phase 2a: 共享组 — 生成共享段 + 各题差异化部分
// =============================================
async function generateSharedGroup(experience, group) {
  const prompt = buildSharedGroupPrompt(experience, group);
  const raw = await callAI(prompt, { temperature: 0.2, max_tokens: 6000 });
  const data = parseJSON(raw);

  if (data && data.shared_body && data.topics && data.topics.length > 0) {
    const topicMap = {};
    data.topics.forEach(t => { topicMap[t.cn] = t; });

    const topicScripts = group.topics.map(t => {
      const matched = topicMap[t.cn];
      if (matched) {
        return {
          cn: t.cn,
          en: t.en,
          reason: t.reason,
          opening: matched.opening || '',
          shared_body: data.shared_body,
          enhancement: matched.enhancement || '',
          enhancement_note: matched.enhancement_note || '',
          ending: matched.ending || ''
        };
      } else {
        return {
          cn: t.cn, en: t.en, reason: t.reason,
          full_script: generateQuickFallback(t, experience)
        };
      }
    });

    return {
      summary: group.summary,
      shared_body: data.shared_body,
      topics: topicScripts
    };
  }

  // 解析失败兜底：每题独立稿
  return {
    summary: group.summary,
    shared_body: null,
    topics: group.topics.map(t => ({
      cn: t.cn, en: t.en, reason: t.reason,
      full_script: generateQuickFallback(t, experience)
    }))
  };
}

// =============================================
// Phase 2b: 独立组 — 生成完整稿
// =============================================
async function generateSoloGroup(experience, topic) {
  try {
    const prompt = buildSoloPrompt(experience, topic);
    const script = await callAI(prompt, { temperature: 0.2, max_tokens: 1000 });

    if (script && script.length > 80) {
      return {
        summary: topic.reason || topic.cn,
        shared_body: null,
        topics: [{
          cn: topic.cn,
          en: topic.en,
          reason: topic.reason,
          full_script: script
        }]
      };
    }
  } catch (err) {
    console.error('Solo generation error for', topic.cn, err);
  }

  return {
    summary: topic.reason || topic.cn,
    shared_body: null,
    topics: [{
      cn: topic.cn, en: topic.en, reason: topic.reason,
      full_script: generateQuickFallback(topic, experience)
    }]
  };
}

// =============================================
// 兜底生成（Phase 1 完全失败）
// =============================================
async function generateFallback(experience, topics) {
  return Promise.all(topics.map(async topic => {
    try {
      const prompt = buildSoloPrompt(experience, topic);
      const script = await callAI(prompt, { temperature: 0.2, max_tokens: 1000 });
      if (script && script.length > 80) {
        return { summary: topic.cn, shared_body: null, topics: [{ cn: topic.cn, en: topic.en, reason: '从你的经历出发', full_script: script }] };
      }
    } catch {}
    return { summary: topic.cn, shared_body: null, topics: [{ cn: topic.cn, en: topic.en, reason: '从你的经历出发', full_script: generateQuickFallback(topic, experience) }] };
  }));
}

// =============================================
// 主入口
// =============================================
export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // 验证用户身份
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) return res.status(401).json({ error: '未提供认证 token' });

    const user = await verifyUser(token);
    if (!user) return res.status(401).json({ error: '认证失败，请重新登录' });

    // 解析请求体
    const { experience, topics } = req.body;
    if (!experience || !topics || !Array.isArray(topics) || topics.length === 0) {
      return res.status(400).json({ error: '请提供有效的经历和题目' });
    }

    // ── 阶段一：分组 ──
    const groups = await phase1Grouping(experience, topics);

    let results;
    if (groups.length === 0) {
      // 兜底：每题单独生成
      results = await generateFallback(experience, topics);
    } else {
      // ── 阶段二：并行生成 ──
      const sharedGroups = groups.filter(g => g.type === 'shared' && g.topics.length >= 2);
      const soloTopics = groups.filter(g => g.type === 'solo').flatMap(g => g.topics);

      const resultsPromises = [
        ...sharedGroups.map(g => generateSharedGroup(experience, g)),
        ...soloTopics.map(t => generateSoloGroup(experience, t))
      ];

      results = await Promise.all(resultsPromises);
    }

    return res.status(200).json({ success: true, groups: results });

  } catch (err) {
    console.error('Generate error:', err);
    const msg = err.message || '生成失败，请稍后重试';
    return res.status(500).json({ error: msg });
  }
}
