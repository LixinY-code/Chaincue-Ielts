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
// Phase 2: 脚本生成 Prompt — 过去/现在/未来结构
// =============================================
function buildPhase2Prompt(experience, group) {
  const topicList = group.topics.map((t, i) =>
    `${i + 1}. ${t.cn} — ${t.en}\n   Reason: ${t.reason}`
  ).join('\n');
  return `You are an expert IELTS speaking coach specializing in Part 2 "story weaving" — chaining one personal experience across multiple topics using a Past → Present → Future structure.

## Original experience:
${experience}

## Story angle:
${group.summary}

## Topics to chain (${group.topics.length}):
${topicList}

## CRITICAL STRUCTURE — READ CAREFULLY:

You must produce ONE shared story skeleton using the structure below. Then for EACH topic, provide a unique "angle tweak" paragraph.

### THE SHARED SKELETON (used for ALL topics):

The skeleton has 5 parts:

**1. INTRO (~30-40 words)**
- A casual, natural opening that introduces the topic
- DO NOT start with "The topic I want to talk about is..."
- Use expressions like: "To be honest...", "I'd like to share...", "This actually reminds me of..."
- Set the scene briefly and naturally

**2. PAST (~50-70 words total)**
Split into two parts:
- **Description (past_description)**: Tell what HAPPENED in the past. Short, natural sentences. Use past tense. Include sensory details (what you saw, heard, felt physically). Include at least one believable specific detail (a name, a quote, an exact moment). Include dialogue if natural.
- **Feeling (past_feeling)**: How you FELT about it at the time. Use emotion words naturally. "I remember feeling...", "I was so...", "Honestly, it made me..."

**3. PRESENT (~50-70 words total)**
Split into two parts:
- **Description (present_description)**: What's happening NOW related to this experience. Are you still doing it? How has it influenced your current life? What changed because of it?
- **Feeling (present_feeling)**: How you feel about it NOW, looking back from the present. Different from past_feeling — show growth, perspective change, or continued appreciation.

**4. FUTURE (~40-60 words total)**
Split into two parts:
- **Description (future_description)**: What you PLAN to do or hope will happen in the future related to this. Goals, wishes, intentions.
- **Feeling (future_feeling)**: How you ANTICIPATE you'll feel. Excitement, confidence, curiosity, etc.

**5. OUTRO (~20-30 words)**
- A casual closing reflection, NOT "In conclusion" or "To sum up"
- Wrap up naturally: "So yeah...", "And honestly...", "I think that's..."

### PER-TOPIC CUSTOM PARTS:

**Angle Intro Note** (Chinese, ~15 words): Explain how to slightly adjust the INTRO when speaking for this specific topic — what angle to emphasize.

**Angle Tweak** (~30-40 words each):
- 2-3 NEW sentences that bridge the shared story to THIS specific topic
- This is NOT a repeat — it's unique content that shifts the story's focus

**Angle Outro Note** (Chinese, ~15 words): Explain what to emphasize in the OUTRO for this specific topic.

## LANGUAGE RULES:
- Use contractions: "I'm", "don't", "didn't", "it's", "that's", "there's", "can't", "wasn't"
- Use fillers naturally: "like", "you know", "honestly", "actually", "I mean", "I guess", "right?"
- Short, conversational sentences. NOT academic writing.
- Include dialogue where natural.

## WORD COUNT GUIDELINES:
- Intro: ~30-40 words
- Past (description + feeling): ~50-70 words
- Present (description + feeling): ~50-70 words
- Future (description + feeling): ~40-60 words
- Outro: ~20-30 words
- TOTAL skeleton: ~190-270 words (good for IELTS Part 2 at normal speaking pace)

## Output format (JSON ONLY):
{
  "intro": "Intro paragraph (30-40 words)",
  "past": {
    "description": "What happened (30-40 words)",
    "feeling": "How you felt (20-30 words)"
  },
  "present": {
    "description": "What's happening now (30-40 words)",
    "feeling": "How you feel now (20-30 words)"
  },
  "future": {
    "description": "What you plan to do (20-35 words)",
    "feeling": "How you anticipate feeling (20-25 words)"
  },
  "outro": "Outro paragraph (20-30 words)",
  "topics": [
    {
      "cn": "Chinese topic name (exact match)",
      "angle_intro_note": "开头角度说明（中文15字左右）",
      "angle_tweak": "Bridge paragraph for this topic (30-40 words)",
      "angle_outro_note": "结尾角度说明（中文15字左右）"
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
  const topicNames = topics.slice(0, 3).map(t => t.cn).join(', ');
  return `Write a COMPLETE natural, colloquial IELTS Part 2 speaking script (200–280 words) based on this experience:

"${experience}"

Topics covered: ${topicNames}

## CRITICAL STRUCTURE — You MUST follow this Past → Present → Future format:

1. **INTRO** (~30 words): Casual opening. NOT "The topic I want to talk about is..."
2. **PAST** (~60 words): What HAPPENED. Use past tense. Include sensory details and one specific detail.
3. **PRESENT** (~60 words): What's happening NOW related to this. How has it influenced your current life?
4. **FUTURE** (~40 words): What you PLAN to do. Goals and hopes.
5. **OUTRO** (~25 words): Casual closing reflection. NOT "In conclusion"

⚠️ WORD COUNT: 200–280 words. Under 200 will be REJECTED.

Use contractions, fillers ("like", "you know", "honestly"), short conversational sentences.
Write only the script in English. No JSON. No explanations.`;
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
          { role: 'system', content: 'You are an IELTS speaking expert who specializes in "story weaving" — structuring personal experiences across Past, Present, and Future for Part 2. Return only the requested output — no explanations, no apologies, no preamble. Write in natural, conversational English.' },
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

// 快速兜底脚本（过去/现在/未来结构）
function generateQuickFallback(topic, experience) {
  return `To be honest, when I think about ${topic.cn.toLowerCase()}, it really takes me back. ${experience.substring(0, 150)}

Looking back at it now, I feel like it was one of those moments that shaped who I am today. I still think about it quite often, and honestly, it's changed the way I see things.

And for the future, I'd really like to... well, I guess I just want to keep that feeling alive, you know? So yeah, that's pretty much my story.`;
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
// Phase 2: 逐组生成脚本（过去/现在/未来结构）
// =============================================
async function phase2GenerateScripts(experience, group) {
  const prompt = buildPhase2Prompt(experience, group);
  const raw = await callAI(prompt, { temperature: 0.75, max_tokens: 8000 });

  const data = parseJSON(raw);

  if (data && data.past && data.present && data.future && data.topics && data.topics.length > 0) {
    // 构建新的骨架结构
    const skeleton = {
      intro: data.intro || '',
      past: {
        description: data.past.description || '',
        feeling: data.past.feeling || ''
      },
      present: {
        description: data.present.description || '',
        feeling: data.present.feeling || ''
      },
      future: {
        description: data.future.description || '',
        feeling: data.future.feeling || ''
      },
      outro: data.outro || ''
    };

    // 匹配每个题目的角度调整
    const topicMap = {};
    data.topics.forEach(t => { topicMap[t.cn] = t; });

    const topicScripts = group.topics.map(t => {
      const matched = topicMap[t.cn];
      if (matched) {
        return {
          ...t,
          skeleton,
          angle_intro_note: matched.angle_intro_note || '',
          angle_tweak: matched.angle_tweak || '',
          angle_outro_note: matched.angle_outro_note || ''
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
      // ── 阶段二：逐组生成（过去/现在/未来结构） ──
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
