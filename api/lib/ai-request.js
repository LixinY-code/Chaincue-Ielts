const DEFAULT_AI_BASE_URL = 'https://api.uiuihao.com/v1';
const RETRYABLE_STATUS = new Set([500, 502, 503, 504]);

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function trimError(text) {
  return (text || '').replace(/\s+/g, ' ').trim().substring(0, 160);
}

export async function callChatCompletion({
  messages,
  temperature = 0.3,
  max_tokens = 2000,
  timeoutMs = 60000,
  timeoutMessage = 'AI 请求超时',
  retries = 2
}) {
  if (!process.env.UIUI_API_KEY) {
    throw new Error('缺少 UIUI_API_KEY 环境变量');
  }

  const baseUrl = (process.env.UIUI_BASE_URL || process.env.AI_BASE_URL || DEFAULT_AI_BASE_URL).replace(/\/$/, '');
  const chatCompletionsUrl = `${baseUrl}/chat/completions`;
  let lastError;

  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const res = await fetch(chatCompletionsUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.UIUI_API_KEY}`
        },
        body: JSON.stringify({
          model: process.env.UIUI_MODEL || 'gpt-4o-mini',
          messages,
          temperature,
          max_tokens
        }),
        signal: controller.signal
      });

      clearTimeout(timeout);

      if (!res.ok) {
        const errMsg = trimError(await res.text().catch(() => ''));
        if (res.status === 401) throw new Error('AI API Key 无效');
        if (res.status === 429) throw new Error('AI 请求太频繁，请稍后再试');

        lastError = new Error(`AI API 返回 ${res.status}: ${errMsg}`);
        if (RETRYABLE_STATUS.has(res.status) && attempt < retries) {
          console.warn(`AI API temporary error ${res.status}, retrying attempt ${attempt + 2}/${retries + 1}`);
          await sleep(700 * (attempt + 1));
          continue;
        }
        throw lastError;
      }

      const data = await res.json();
      const content = data.choices?.[0]?.message?.content?.trim();
      if (!content) throw new Error('AI 返回内容为空');
      return content;
    } catch (err) {
      clearTimeout(timeout);
      if (err.name === 'AbortError') throw new Error(timeoutMessage);
      lastError = err;
      if (attempt < retries && /fetch failed|ECONNRESET|ETIMEDOUT|ENOTFOUND/i.test(err.message || '')) {
        console.warn(`AI API network error, retrying attempt ${attempt + 2}/${retries + 1}`);
        await sleep(700 * (attempt + 1));
        continue;
      }
      throw err;
    }
  }

  throw lastError || new Error('AI 请求失败');
}
