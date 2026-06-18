import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// =============================================
// Category Mapping Prompt
// =============================================
function buildMapPrompt(decomposition) {
  const decStr = JSON.stringify(decomposition, null, 2);
  return `You are an IELTS Speaking Part 2 topic expert.

## Story decomposition:
${decStr}

## Available categories:
Person, Experience, Achievement, Challenge, Skill, Learning, Decision, Future Plan, Interesting Event, Proud Moment

## Task:
Analyze the story decomposition and determine which IELTS Part 2 categories this story can naturally answer. For each matched category, explain briefly why and suggest a specific angle.

## Output format (JSON ONLY):
{
  "mapped_categories": [
    {
      "category": "Experience",
      "confidence": "high",
      "reason": "Brief English explanation (20-40 words) of how this story fits this category",
      "angle": "Specific angle to take when answering (English, 20-30 words)"
    }
  ]
}

## Rules:
- Only include categories that GENUINELY fit — confidence must be "high" or "medium"
- Do NOT force categories. If only 2-3 fit, that's fine and actually preferred.
- Minimum 1 category, maximum 7
- Each category appears at most once
- Return valid JSON only. No explanations. No markdown fences.`;
}

// =============================================
// AI 调用封装
// =============================================
async function callAI(prompt, { temperature = 0.2, max_tokens = 1500 } = {}) {
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
          { role: 'system', content: 'You are an IELTS Speaking Part 2 topic expert. Return only the requested JSON output — no explanations, no preamble.' },
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
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) return res.status(401).json({ error: '未提供认证 token' });

    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) return res.status(401).json({ error: '认证失败，请重新登录' });

    const { decomposition, story_id } = req.body;
    if (!decomposition) {
      return res.status(400).json({ error: '请提供故事拆解数据' });
    }

    const prompt = buildMapPrompt(decomposition);
    const aiRaw = await callAI(prompt);
    const data = parseJSON(aiRaw);

    if (!data || !data.mapped_categories || data.mapped_categories.length === 0) {
      return res.status(500).json({ error: '类别映射失败，请重试' });
    }

    // 记录到 histories
    const { error: dbError } = await supabase.from('histories').insert({
      user_id: user.id,
      experience: decomposition.summary || '',
      selected_topics: data.mapped_categories.map(c => c.category),
      results_json: data.mapped_categories,
      generation_type: 'map_categories',
      story_id: story_id || null
    });
    if (dbError) console.error('DB log error:', dbError);

    return res.status(200).json({
      success: true,
      categories: data.mapped_categories
    });

  } catch (err) {
    console.error('Map categories error:', err);
    const msg = err.message || '映射失败，请稍后重试';
    return res.status(500).json({ error: msg });
  }
}
