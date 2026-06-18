import { verifyUser, sbQuery, sbUpsert } from './lib/supabase.js';

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

    const user = await verifyUser(token);
    if (!user) return res.status(401).json({ error: '认证失败' });

    const { story_id, note } = req.body;
    if (!story_id) return res.status(400).json({ error: '缺少 story_id' });

    // 确认该 story 属于当前用户
    const storyData = await sbQuery('stories', {
      select: 'id',
      eq: { id: story_id, user_id: user.id },
      limit: 1
    });
    const story = Array.isArray(storyData) ? storyData[0] : storyData;
    if (!story) return res.status(404).json({ error: '故事不存在' });

    // Upsert archive
    await sbUpsert('archives', { user_id: user.id, story_id, note: note || null }, 'user_id,story_id');

    return res.status(200).json({ success: true, message: '收藏成功' });

  } catch (err) {
    console.error('Save archive error:', err);
    return res.status(500).json({ error: err.message });
  }
}
