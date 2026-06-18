import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// =============================================
// Answer Generation Prompt
// =============================================
function buildAnswerPrompt(decomposition, category, angle) {
  const decStr = JSON.stringify(decomposition, null, 2);
  return `You are an expert IELTS speaking coach specializing in Part 2 answer generation.

## Story decomposition:
${decStr}

## Target category: ${category}
${angle ? `\n## Suggested angle: ${angle}` : ''}

## Task:
Generate a complete IELTS Part 2 speaking answer using this story for the "${category}" category. The answer should feel like a real person telling a real story — NOT a memorized script.

## CRITICAL STRUCTURE:

**1. INTRO (~30-40 words)**
- Casual, natural opening that connects the story to "${category}"
- DO NOT start with "The topic I want to talk about is..." or "I'd like to describe..."
- Use: "To be honest...", "Well, this actually reminds me of...", "You know, I've been thinking about..."
- Set the scene briefly and naturally

**2. PAST (~50-70 words total)**
- **Description**: What HAPPENED in the past. Use past tense. Sensory details (what you saw, heard, felt). Include at least one specific believable detail (a name, a quote, an exact moment).
- **Feeling**: How you FELT at the time. Use emotion words naturally. "I remember feeling...", "Honestly, I was so..."

**3. PRESENT (~50-70 words total)**
- **Description**: What's happening NOW related to this. How has it influenced your current life? What changed?
- **Feeling**: How you feel NOW looking back. Show growth or perspective change. Different from past_feeling.

**4. FUTURE (~40-60 words total)**
- **Description**: Plans, goals, or hopes for the future related to this. What do you want to do?
- **Feeling**: How you ANTICIPATE you'll feel. Excitement, confidence, curiosity.

**5. OUTRO (~20-30 words)**
- Casual closing reflection. NOT "In conclusion" or "To sum up"
- "So yeah...", "And honestly, I think...", "I guess that's pretty much it..."

## LANGUAGE RULES:
- Contractions: "I'm", "don't", "didn't", "it's", "that's", "there's", "can't", "wasn't"
- Fillers naturally: "like", "you know", "honestly", "actually", "I mean", "I guess", "right?"
- Short, conversational sentences. NOT academic writing.
- Include dialogue where natural.
- Target: Band 6.5-7.0 level, ~2 minutes speaking pace (~200-270 words total)

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
    "description": "Plans/goals (20-35 words)",
    "feeling": "Anticipated feelings (20-25 words)"
  },
  "outro": "Outro paragraph (20-30 words)"
}

Return JSON only. No explanations. No markdown fences.`;
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
          { role: 'system', content: 'You are an expert IELTS speaking coach. Return only the requested JSON output — no explanations, no apologies, no preamble. Write in natural, conversational English.' },
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

function parseJSON(raw) {
  try {
    const match = raw.match(/\{[\s\S]*\}/);
    if (match) return JSON.parse(match[0]);
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function countWords(str) {
  return str ? str.split(/\s+/).filter(Boolean).length : 0;
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

    const { decomposition, category, angle, story_id } = req.body;
    if (!decomposition || !category) {
      return res.status(400).json({ error: '请提供故事拆解数据和目标类别' });
    }

    const prompt = buildAnswerPrompt(decomposition, category, angle);
    const aiRaw = await callAI(prompt);
    const answer = parseJSON(aiRaw);

    if (!answer || !answer.intro || !answer.past || !answer.present || !answer.future) {
      return res.status(500).json({ error: '答案生成失败，请重试' });
    }

    // 计算词数
    const fullText = [
      answer.intro,
      answer.past?.description, answer.past?.feeling,
      answer.present?.description, answer.present?.feeling,
      answer.future?.description, answer.future?.feeling,
      answer.outro
    ].filter(Boolean).join(' ');
    const wordCount = countWords(fullText);

    const result = {
      intro: answer.intro || '',
      past: { description: answer.past?.description || '', feeling: answer.past?.feeling || '' },
      present: { description: answer.present?.description || '', feeling: answer.present?.feeling || '' },
      future: { description: answer.future?.description || '', feeling: answer.future?.feeling || '' },
      outro: answer.outro || '',
      word_count: wordCount
    };

    // 记录到 histories
    const { error: dbError } = await supabase.from('histories').insert({
      user_id: user.id,
      experience: decomposition.summary || '',
      selected_topics: [category],
      results_json: result,
      generation_type: 'generate_answer',
      story_id: story_id || null
    });
    if (dbError) console.error('DB log error:', dbError);

    return res.status(200).json({ success: true, answer: result });

  } catch (err) {
    console.error('Generate answer error:', err);
    const msg = err.message || '生成失败，请稍后重试';
    return res.status(500).json({ error: msg });
  }
}
