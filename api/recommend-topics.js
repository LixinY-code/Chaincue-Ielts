import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// =============================================
// 完整的 IELTS Part 2 题库
// =============================================
const IELTS_TOPICS = [
  { cn: "重要决定", en: "Describe an important decision that you made" },
  { cn: "电子产品故障", en: "Describe a problem with technology you have encountered" },
  { cn: "当地新闻", en: "Describe a piece of local news that people are interested in" },
  { cn: "名人广告", en: "Describe a piece of advertisement which is about a famous person" },
  { cn: "有趣的邻居", en: "Describe an interesting neighbor" },
  { cn: "得到想要的物品", en: "Describe something you received for free" },
  { cn: "户外活动", en: "Describe an outdoor activity you enjoyed" },
  { cn: "改变的规则", en: "Describe a rule that you think is important" },
  { cn: "忙碌的时光", en: "Describe a time when you were very busy" },
  { cn: "传统节目", en: "Describe a traditional festival in your country" },
  { cn: "想住的房间", en: "Describe a room that you would like to live in" },
  { cn: "开心购物", en: "Describe something you bought that you were happy with" },
  { cn: "河边湖泊", en: "Describe a river or lake you have visited" },
  { cn: "美丽城市", en: "Describe a beautiful city you have visited" },
  { cn: "积极改变", en: "Describe a positive change you made in your life" },
  { cn: "重要河流", en: "Describe an important river in your country" },
  { cn: "收到不寻常礼物", en: "Describe an unusual gift you received" },
  { cn: "理想工作", en: "Describe your dream job" },
  { cn: "节约时间", en: "Describe an occasion when you saved time" },
  { cn: "别人做的好事", en: "Describe a time when someone did something good for you" },
  { cn: "朋友的好品质", en: "Describe a good quality of a friend" },
  { cn: "喜欢的天气", en: "Describe your favorite weather" },
  { cn: "搬新家", en: "Describe a time when you moved to a new home or school" },
  { cn: "学到新技能", en: "Describe a skill you learned that you think is useful" },
  { cn: "想认识的人", en: "Describe a person you would like to meet" },
  { cn: "好服务", en: "Describe a time when you received good service" },
  { cn: "不喜欢的广告", en: "Describe an advertisement you don't like" },
  { cn: "公共设施", en: "Describe a public facility that has recently opened" },
  { cn: "重要的信", en: "Describe an important letter or email you received" },
  { cn: "喜欢的节目", en: "Describe a TV program you enjoy watching" },
  { cn: "听到的音乐", en: "Describe a piece of music you heard recently" },
  { cn: "建房子", en: "Describe a house or apartment you would like to live in" },
  { cn: "喜欢的书", en: "Describe a book you enjoyed reading" },
  { cn: "迷路经历", en: "Describe an occasion when you got lost" },
  { cn: "糟糕的服务", en: "Describe a time when you received bad service at a restaurant or shop" },
  { cn: "有趣的老人", en: "Describe an interesting old person you know" },
  { cn: "健康活动", en: "Describe an activity you do to stay healthy" },
  { cn: "好建议", en: "Describe a piece of good advice you received" },
  { cn: "难做的决定", en: "Describe a difficult decision you had to make" },
  { cn: "重要的植物", en: "Describe an important plant in your country" },
  { cn: "体育赛事", en: "Describe a sports event you have watched or participated in" },
  { cn: "想重来的旅行", en: "Describe a trip you would like to take again" },
  { cn: "童年玩具", en: "Describe a toy you liked in your childhood" },
  { cn: "开心照片", en: "Describe a photograph that makes you happy" },
  { cn: "第二语言", en: "Describe a language you would like to learn (other than English)" },
  { cn: "传统食物", en: "Describe a traditional food from your country" },
  { cn: "帮助陌生人", en: "Describe a time when you helped a stranger" },
  { cn: "安静的地方", en: "Describe a quiet place you like to go" },
  { cn: "重要家事", en: "Describe an important event in your family" },
  { cn: "学校规则", en: "Describe a school rule you think is important" },
  { cn: "社交媒体", en: "Describe a social media website or app you often use" },
  { cn: "成功小事", en: "Describe a small success you had" },
  { cn: "不感兴趣的项目", en: "Describe a project or homework you didn't enjoy" },
  { cn: "特别的蛋糕", en: "Describe a special cake you received or made" },
  { cn: "想见的名人", en: "Describe a famous person you would like to meet" },
  { cn: "拥挤的地方", en: "Describe a crowded place you have been to" },
  { cn: "丢东西", en: "Describe a time when you lost something important" },
  { cn: "有趣的地方", en: "Describe an interesting place you have visited" },
  { cn: "演讲经历", en: "Describe a speech you gave or listened to" },
  { cn: "大噪音", en: "Describe a time when you were in a very noisy place" }
];

// =============================================
// 推荐题目 Prompt
// =============================================
function buildRecommendPrompt(decomposition) {
  const topicsList = IELTS_TOPICS.map((t, i) => `${i}. ${t.cn} — ${t.en}`).join('\n');
  const decStr = JSON.stringify(decomposition, null, 2);

  return `You are an IELTS Speaking Part 2 expert. A student has shared a personal story, and you need to recommend which IELTS Part 2 topics from our question bank this story can naturally answer.

## Story Decomposition:
${decStr}

## Full IELTS Part 2 Question Bank (${IELTS_TOPICS.length} topics):
${topicsList}

## Task:
From the question bank above, select 5-10 topics that this story can naturally answer. For each selected topic, provide:
1. The topic index number (from the list above)
2. A confidence score (high / medium)
3. A brief reason why this story fits
4. A suggested angle — how to specifically adapt this story for that exact question

## Important Rules:
- ONLY select topics where the story GENUINELY fits — do NOT force matches
- Prefer quality over quantity: 5 strong matches > 10 weak ones
- High confidence = story naturally fits the question without stretching
- Medium confidence = story can work with some creative angle adaptation
- Consider ALL dimensions of the story: people, places, challenges, decisions, achievements, skills, emotions, lessons, past/present/future
- The angle should be SPECIFIC to the question, not generic

## Output format (JSON ONLY):
{
  "recommendations": [
    {
      "topic_index": 0,
      "topic_cn": "重要决定",
      "topic_en": "Describe an important decision that you made",
      "confidence": "high",
      "reason": "Brief explanation of why this story fits (15-25 words)",
      "angle": "Specific approach to answer this question using the story (15-25 words)"
    }
  ]
}

Return valid JSON only. No explanations. No markdown fences.`;
}

// =============================================
// AI 调用
// =============================================
async function callAI(prompt, { temperature = 0.2, max_tokens = 2000 } = {}) {
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
          { role: 'system', content: 'You are an IELTS Speaking Part 2 expert. Return only the requested JSON output — no explanations, no preamble.' },
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

    const { decomposition } = req.body;
    if (!decomposition) {
      return res.status(400).json({ error: '请提供故事拆解数据' });
    }

    const prompt = buildRecommendPrompt(decomposition);
    const aiRaw = await callAI(prompt);
    const data = parseJSON(aiRaw);

    if (!data || !data.recommendations || data.recommendations.length === 0) {
      return res.status(500).json({ error: '推荐失败，请重试' });
    }

    // 验证并补全题目信息
    const recommendations = data.recommendations.map(rec => {
      const topic = IELTS_TOPICS[rec.topic_index];
      if (topic) {
        return {
          topic_index: rec.topic_index,
          topic_cn: rec.topic_cn || topic.cn,
          topic_en: rec.topic_en || topic.en,
          confidence: rec.confidence || 'medium',
          reason: rec.reason || '',
          angle: rec.angle || ''
        };
      }
      return null;
    }).filter(Boolean);

    if (recommendations.length === 0) {
      return res.status(500).json({ error: '未能匹配到合适的题目，请尝试更详细地描述你的经历' });
    }

    // 记录到 histories
    const { error: dbError } = await supabase.from('histories').insert({
      user_id: user.id,
      experience: decomposition.summary || '',
      selected_topics: recommendations.map(r => r.topic_cn),
      results_json: recommendations,
      generation_type: 'recommend_topics'
    });
    if (dbError) console.error('DB log error:', dbError);

    return res.status(200).json({
      success: true,
      recommendations,
      total_topics: IELTS_TOPICS.length
    });

  } catch (err) {
    console.error('Recommend topics error:', err);
    const msg = err.message || '推荐失败，请稍后重试';
    return res.status(500).json({ error: msg });
  }
}
