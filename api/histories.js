import { verifyUser, sbQuery } from './lib/supabase.js';

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

    const data = await sbQuery('histories', {
      select: 'id,created_at,experience,selected_topics,results_json',
      eq: { user_id: user.id },
      order: 'created_at',
      ascending: false,
      limit: 50
    });

    const histories = (data || []).map(h => ({
      id: h.id,
      created_at: h.created_at,
      experience_preview: h.experience.substring(0, 60) + (h.experience.length > 60 ? '...' : ''),
      topic_count: (h.selected_topics || []).length,
      experience: h.experience,
      selected_topics: h.selected_topics,
      results_json: h.results_json
    }));

    return res.status(200).json({ success: true, histories });

  } catch (err) {
    console.error('Histories error:', err);
    return res.status(500).json({ error: err.message });
  }
}
