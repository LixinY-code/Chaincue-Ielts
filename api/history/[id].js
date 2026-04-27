import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

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

    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) return res.status(401).json({ error: '认证失败' });

    const historyId = req.query.id;
    if (!historyId) return res.status(400).json({ error: '缺少 history ID' });

    const { data, error } = await supabase
      .from('histories')
      .select('*')
      .eq('id', historyId)
      .eq('user_id', user.id)
      .single();

    if (error || !data) return res.status(404).json({ error: '记录不存在' });

    return res.status(200).json({
      success: true,
      history: {
        id: data.id,
        experience: data.experience,
        selected_topics: data.selected_topics,
        results_json: data.results_json,
        created_at: data.created_at
      }
    });

  } catch (err) {
    console.error('History detail error:', err);
    return res.status(500).json({ error: err.message });
  }
}
