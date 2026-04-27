import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

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
1. Split the user's experience into 1-3 core events/stories
2. Match each event to 2-5 topics from the list above (based on ENGLISH meaning, not just Chinese translation)
3. For each matched topic, write a SHORT reason (30-50 words in English) explaining how the experience naturally connects to this topic

## Output format (JSON ONLY — no explanation, no markdown code block):
{
  "groups": [
    {
      "event_summary": "One Chinese sentence summarizing this story",
      "topics": [
        {
          "cn": "Chinese topic name",
          "en": "English topic description",
          "short_reason": "30-50 word English explanation of how this experience connects to this topic"
        }
      ]
    }
  ]
}

## Rules:
- Group topics that share the SAME core story together
- Only match topics that genuinely fit — don't force it
- If a topic doesn't fit any event, simply don't include it
- Return valid JSON only, nothing else
- Keep short_reason in English, concise and specific`;
}

// =============================================
// Phase 2: 脚本生成 Prompt
// =============================================
function buildPhase2Prompt(experience, group) {
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

## OUTPUT FORMAT — READ CAREFULLY:

You must produce ONE shared main body paragraph (~150-170 words), then for EACH topic provide a unique opening (~40-50 words), an enhancement paragraph that tweaks the angle (~40-50 words), and a unique ending (~40-50 words).

Each topic's full script = opening + shared_body + enhancement + ending ≈ 250-320 words total.

## CRITICAL RULES:

### 1. Shared Main Body (~150-170 words):
- Tell the core story from the experience above
- Short, natural sentences. Use "like", "you know", "honestly", "actually", "I mean", "I guess", "right?"
- Contractions: "I'm", "don't", "didn't", "it's", "that's", "there's", "can't", "wasn't"
- Sensory + emotion details. One believable detail (name, quote, moment). Include dialogue if possible.
- This paragraph is the SAME foundation for all topics — do NOT change it per topic.

### 2. Per-Topic Custom Parts:

**Opening** (~40-50 words each):
- Start casually, NOT "The topic I want to talk about is..."
- Each topic must have a COMPLETELY DIFFERENT opening that specifically addresses THAT topic's angle
- Examples: "To be honest...", "Honestly, this reminds me of...", "I guess what I really want to share is..."

**Enhancement** (~40-50 words each):
- Add 2-3 sentences that TWEAK the story angle to fit THIS specific topic
- This is NOT a repeat of the main body — it's NEW content that bridges the shared story to the topic
- Include a "侧重点" note in Chinese explaining what to emphasize when speaking

**Ending** (~40-50 words each):
- Casual reflection, NOT "In conclusion"
- Each topic gets its own unique ending

### 3. TOTAL WORD COUNT:
- Shared body: ~150-170 words
- Per topic (opening + enhancement + ending): ~120-150 words
- Full script per topic ≈ 250-320 words (this is CORRECT for IELTS Part 2 at normal speed)

## Output format (JSON ONLY):
{
  "shared_body": "The shared main body paragraph (150-170 words, same for all topics)",
  "topics": [
    {
      "cn": "Chinese topic name (exact match)",
      "opening": "Opening paragraph for this topic (40-50 words)",
      "enhancement": "Angle-tweak paragraph for this topic (40-50 words)",
      "enhancement_note": "侧重点说明（中文，说明讲的时候强调什么）",
      "ending": "Ending paragraph for this topic (40-50 words)"
    }
  ]
}

EVERY topic in the list MUST be included. Do NOT skip any.
Return JSON only. No explanations. No markdown fences.`;
}

// =============================================
// 兜底 Prompt（Phase 1 完全失败时）
// =============================================
function buildFallbackPrompt(experience, topics) {
  return `Write a COMPLETE natural, colloquial IELTS Part 2 speaking script (200–250 words) based on this experience:

"${experience}"

Topics covered: ${topics.slice(0, 3).map(t => t.cn).join(', ')}

⚠️ WORD COUNT REQUIREMENT: Your script MUST be 200–250 words. Under 200 words will be REJECTED.

IMPORTANT: FULL script with ALL three parts:
- Opening (~40 words): Start casual — NOT "The topic I want to talk about is..."
- Main Body (~130 words): Short sentences, "like", "you know", "honestly", "actually". Contractions. Sensory details. One believable detail. Include dialogue if possible.
- Ending (~40 words): Casual reflection — NOT "In conclusion"

Write only the script in English. No JSON. No explanations. 200–250 words.`;
}

// =============================================
// AI 调用封装
// =============================================
async function callAI(prompt, { temperature = 0.75, max_tokens = 4000 } = {}) {
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
  const raw = await callAI(prompt, { temperature: 0.3, max_tokens: 2000 });

  const data = parseJSON(raw);
  if (data && data.groups && data.groups.length > 0) {
    return data.groups.map(g => ({
      summary: g.event_summary || '提取的经历',
      text: experience,
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
// Phase 2: 逐组生成脚本
// =============================================
async function phase2GenerateScripts(experience, group) {
  const prompt = buildPhase2Prompt(experience, group);
  const raw = await callAI(prompt, { temperature: 0.75, max_tokens: 8000 });

  const data = parseJSON(raw);

  if (data && data.shared_body && data.topics && data.topics.length > 0) {
    const topicMap = {};
    data.topics.forEach(t => { topicMap[t.cn] = t; });

    const topicScripts = group.topics.map(t => {
      const matched = topicMap[t.cn];
      if (matched) {
        return {
          ...t,
          opening: matched.opening || '',
          shared_body: data.shared_body,
          enhancement: matched.enhancement || '',
          enhancement_note: matched.enhancement_note || '',
          ending: matched.ending || ''
        };
      } else {
        return { ...t, script: generateQuickFallback(t, experience) };
      }
    });

    return { ...group, topics: topicScripts };
  }

  // 解析失败兜底
  return {
    ...group,
    topics: group.topics.map(t => ({
      ...t,
      script: generateQuickFallback(t, experience)
    }))
  };
}

// =============================================
// 兜底生成（Phase 1 完全失败）
// =============================================
async function generateFallbackGroup(experience, topics) {
  const prompt = buildFallbackPrompt(experience, topics);
  const script = await callAI(prompt, { temperature: 0.75, max_tokens: 1000 });

  return [{
    summary: '基于你的经历生成',
    text: experience.substring(0, 100),
    topics: topics.slice(0, Math.min(3, topics.length)).map(t => ({
      cn: t.cn,
      en: t.en,
      reason: '从你的经历出发',
      script: (script && script.length > 50) ? script : generateQuickFallback(t, experience)
    }))
  }];
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

    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) return res.status(401).json({ error: '认证失败，请重新登录' });

    // 解析请求体
    const { experience, topics } = req.body;
    if (!experience || !topics || !Array.isArray(topics) || topics.length === 0) {
      return res.status(400).json({ error: '请提供有效的经历和题目' });
    }

    // ── 阶段一：分组 ──
    const groups = await phase1Grouping(experience, topics);

    let results;
    if (groups.length === 0) {
      // 兜底
      results = await generateFallbackGroup(experience, topics);
    } else {
      // ── 阶段二：逐组生成 ──
      results = [];
      for (const group of groups) {
        try {
          const withScripts = await phase2GenerateScripts(experience, group);
          results.push(withScripts);
        } catch (err) {
          console.error('Phase 2 error for group:', group.summary, err);
          results.push({
            ...group,
            topics: group.topics.map(t => ({
              ...t,
              script: generateQuickFallback(t, experience)
            }))
          });
        }
      }
    }

    // 存入数据库
    const { error: dbError } = await supabase.from('histories').insert({
      user_id: user.id,
      experience,
      selected_topics: topics,
      results_json: results
    });

    if (dbError) {
      console.error('DB save error:', dbError);
      // 仍然返回结果，只是没存档
    }

    return res.status(200).json({ success: true, groups: results });

  } catch (err) {
    console.error('Generate error:', err);
    const msg = err.message || '生成失败，请稍后重试';
    return res.status(500).json({ error: msg });
  }
}
