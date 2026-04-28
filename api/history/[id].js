import { verifyUser, sbQuery } from '../lib/supabase.js';

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) return res.status(401).json({ error: '未提供认证 token' });

    const user = await verifyUser(token);
    if (!user) return res.status(401).json({ error: '认证失败' });

    const historyId = req.query.id;
    if (!historyId) return res.status(400).json({ error: '缺少 history ID' });

    // 查询指定记录，用 user_id 过滤确保只能看自己的
    const data = await sbQuery('histories', {
      select: '*',
      eq: { id: historyId, user_id: user.id },
      limit: 1
    });

    const record = Array.isArray(data) ? data[0] : data;
    if (!record) return res.status(404).json({ error: '记录不存在' });

    return res.status(200).json({
      success: true,
      history: {
        id: record.id,
        experience: record.experience,
        selected_topics: record.selected_topics,
        results_json: record.results_json,
        created_at: record.created_at
      }
    });

  } catch (err) {
    console.error('History detail error:', err);
    return res.status(500).json({ error: err.message });
  }
}
