import { verifyUser } from './lib/supabase.js';

// =============================================
// 经历要素解析 Prompt
// =============================================
function buildParsePrompt(experience) {
  return `Extract key narrative elements from the following user experience. Be generous — if anything remotely suggests a detail, extract it.

User's experience:
"${experience}"

Extract these 5 elements (return null if truly absent, but try your best to infer):
- who: people/characters involved
- what: what happened / the main action or event
- when: time period (e.g., "last summer", "a Tuesday morning", "when I was 10")
- where: location (e.g., "a coffee shop", "my school", "a mountain trail")
- how: feelings, emotions, outcome, or takeaway

Output ONLY valid JSON, no explanation, no markdown fences:
{ "who": "string or null", "what": "string or null", "when": "string or null", "where": "string or null", "how": "string or null" }`;
}

// =============================================
// AI 调用（轻量，30s 超时）
// =============================================
async function callAI(prompt) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);

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
          { role: 'system', content: 'You are a concise text analyst. Extract structured data from user text. Return ONLY valid JSON.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.2,
        max_tokens: 500
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
    if (err.name === 'AbortError') throw new Error('解析请求超时（30s）');
    throw err;
  }
}

// 安全提取 JSON
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

    const user = await verifyUser(token);
    if (!user) return res.status(401).json({ error: '认证失败，请重新登录' });

    // 解析请求体
    const { experience } = req.body;
    if (!experience || typeof experience !== 'string' || experience.trim().length === 0) {
      return res.status(400).json({ error: '请提供有效的经历文本' });
    }

    // 调用 AI 解析
    const prompt = buildParsePrompt(experience.trim());
    const raw = await callAI(prompt);
    const parsed = parseJSON(raw);

    if (!parsed) {
      // 解析失败，返回全 null 让前端 fallback 到直接生成
      return res.status(200).json({
        success: true,
        elements: { who: null, what: null, when: null, where: null, how: null }
      });
    }

    return res.status(200).json({
      success: true,
      elements: {
        who: parsed.who || null,
        what: parsed.what || null,
        when: parsed.when || null,
        where: parsed.where || null,
        how: parsed.how || null
      }
    });

  } catch (err) {
    console.error('Parse experience error:', err);
    // 解析失败不阻塞，返回全 null
    return res.status(200).json({
      success: true,
      elements: { who: null, what: null, when: null, where: null, how: null },
      error: err.message
    });
  }
}
