import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// =============================================
// Story Decomposition Prompt
// =============================================
function buildDecomposePrompt(rawText) {
  return `You are a story analysis expert for IELTS Speaking Part 2 preparation.

## User's personal story:
${rawText}

## Task:
Analyze this personal story and decompose it into a structured format. Be generous — infer if anything is implied by the context. Keep descriptions concise but specific.

## Output format (JSON ONLY — no explanation, no markdown fences):
{
  "summary": "One-sentence summary in Chinese of the entire story",
  "past": "What happened in the past — key events, actions, details (English, 30-50 words)",
  "present": "Current situation related to this story — ongoing impact, changes (English, 20-40 words)",
  "future": "Future plans, hopes, or intentions related to this story (English, 20-40 words)",
  "people": ["Person 1 — role/relationship", "Person 2 — role/relationship"],
  "places": ["Place 1", "Place 2"],
  "challenges": ["Challenge 1 description", "Challenge 2 description"],
  "decisions": ["Decision 1 description"],
  "achievements": ["Achievement 1 description"],
  "skills": ["Skill 1 name/description"],
  "emotions": ["Emotion 1", "Emotion 2"],
  "lessons": ["Lesson 1", "Lesson 2"]
}

## Rules:
- All array fields: 1-5 string items each. Empty array [] if truly nothing fits.
- summary: Chinese, 1 sentence.
- past, present, future: English prose, NOT bullet points.
- people/places/challenges/decisions/achievements/skills/emotions/lessons: English strings.
- Return valid JSON only. Nothing else.`;
}

// =============================================
// AI 调用封装
// =============================================
async function callAI(prompt, { temperature = 0.3, max_tokens = 2000 } = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 60000);

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
          { role: 'system', content: 'You are a story analysis expert for IELTS Speaking Part 2. Return only the requested JSON output — no explanations, no apologies, no preamble.' },
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
    if (err.name === 'AbortError') throw new Error('AI 请求超时（60s）');
    throw err;
  }
}

function parseJSON(raw) {
  try {
    const match = raw.match(/\{[\s\S]*\}/);
    if (match) return JSON.parse(match[0]);
    return JSON.parse(raw);
  } catch {
    return null;
  }
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
    const { raw_text } = req.body;
    if (!raw_text || raw_text.trim().length < 10) {
      return res.status(400).json({ error: '请提供至少 10 个字的故事描述' });
    }

    // 调用 AI 拆解故事
    const prompt = buildDecomposePrompt(raw_text.trim());
    const aiRaw = await callAI(prompt);
    const decomposition = parseJSON(aiRaw);

    if (!decomposition || !decomposition.summary) {
      return res.status(500).json({ error: '故事拆解失败，请尝试更详细地描述你的经历' });
    }

    // 确保所有字段存在
    const result = {
      summary: decomposition.summary || '',
      past: decomposition.past || '',
      present: decomposition.present || '',
      future: decomposition.future || '',
      people: decomposition.people || [],
      places: decomposition.places || [],
      challenges: decomposition.challenges || [],
      decisions: decomposition.decisions || [],
      achievements: decomposition.achievements || [],
      skills: decomposition.skills || [],
      emotions: decomposition.emotions || [],
      lessons: decomposition.lessons || []
    };

    // 记录到 histories
    const { error: dbError } = await supabase.from('histories').insert({
      user_id: user.id,
      experience: raw_text.trim(),
      selected_topics: [],
      results_json: result,
      generation_type: 'decompose'
    });
    if (dbError) console.error('DB log error:', dbError);

    return res.status(200).json({ success: true, decomposition: result });

  } catch (err) {
    console.error('Decompose error:', err);
    const msg = err.message || '拆解失败，请稍后重试';
    return res.status(500).json({ error: msg });
  }
}
