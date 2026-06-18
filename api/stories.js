import { verifyUser, sbQuery, sbInsert, sbUpdate, sbDelete } from './lib/supabase';

// =============================================
// GET: 列出用户的故事库
// =============================================
async function handleGet(req, res, userId) {
  try {
    const stories = await sbQuery('stories', {
      select: 'id, title, raw_text, decomposition, categories, tags, is_archived, created_at, updated_at',
      eq: { user_id: userId, is_archived: 'false' },
      order: 'created_at',
      ascending: false,
      limit: 50
    });

    // 精简返回：隐藏完整的 raw_text 和 decomposition
    const slim = (stories || []).map(s => ({
      id: s.id,
      title: s.title,
      preview: s.raw_text ? s.raw_text.substring(0, 80) : '',
      categories: s.categories || [],
      tags: s.tags || [],
      created_at: s.created_at,
      updated_at: s.updated_at
    }));

    return res.status(200).json({ success: true, stories: slim });
  } catch (err) {
    console.error('List stories error:', err);
    return res.status(500).json({ error: '获取故事库失败' });
  }
}

// =============================================
// GET (single): 获取单个故事完整数据
// =============================================
async function handleGetSingle(req, res, userId) {
  try {
    const { id } = req.query;
    if (!id) return res.status(400).json({ error: '缺少 story_id' });

    const stories = await sbQuery('stories', {
      select: '*',
      eq: { id, user_id: userId },
      single: true
    });

    if (!stories || stories.length === 0) {
      return res.status(404).json({ error: '故事不存在' });
    }

    return res.status(200).json({ success: true, story: stories[0] || stories });
  } catch (err) {
    console.error('Get story error:', err);
    return res.status(500).json({ error: '获取故事失败' });
  }
}

// =============================================
// POST: 创建故事
// =============================================
async function handlePost(req, res, userId) {
  try {
    const { title, raw_text, decomposition, categories } = req.body;

    if (!title || !raw_text) {
      return res.status(400).json({ error: '标题和故事内容不能为空' });
    }

    const storyId = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).substr(2)}`;

    await sbInsert('stories', {
      id: storyId,
      user_id: userId,
      title,
      raw_text,
      decomposition: decomposition || {},
      categories: categories || [],
      tags: [],
      is_archived: false
    });

    return res.status(200).json({ success: true, story_id: storyId });
  } catch (err) {
    console.error('Create story error:', err);
    return res.status(500).json({ error: '保存故事失败' });
  }
}

// =============================================
// PATCH: 更新故事
// =============================================
async function handlePatch(req, res, userId) {
  try {
    const { story_id, title, decomposition, tags } = req.body;

    if (!story_id) {
      return res.status(400).json({ error: '缺少 story_id' });
    }

    // 验证所有权
    const existing = await sbQuery('stories', {
      select: 'id',
      eq: { id: story_id, user_id: userId }
    });

    if (!existing || existing.length === 0) {
      return res.status(404).json({ error: '故事不存在' });
    }

    const updates = { updated_at: new Date().toISOString() };
    if (title !== undefined) updates.title = title;
    if (decomposition !== undefined) updates.decomposition = decomposition;
    if (tags !== undefined) updates.tags = tags;

    await sbUpdate('stories', story_id, updates);

    return res.status(200).json({ success: true });
  } catch (err) {
    console.error('Update story error:', err);
    return res.status(500).json({ error: '更新故事失败' });
  }
}

// =============================================
// DELETE: 删除故事
// =============================================
async function handleDelete(req, res, userId) {
  try {
    const { story_id } = req.body;

    if (!story_id) {
      return res.status(400).json({ error: '缺少 story_id' });
    }

    // 验证所有权
    const existing = await sbQuery('stories', {
      select: 'id',
      eq: { id: story_id, user_id: userId }
    });

    if (!existing || existing.length === 0) {
      return res.status(404).json({ error: '故事不存在' });
    }

    await sbDelete('stories', story_id);

    return res.status(200).json({ success: true });
  } catch (err) {
    console.error('Delete story error:', err);
    return res.status(500).json({ error: '删除故事失败' });
  }
}

// =============================================
// 主入口
// =============================================
export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: '未提供认证 token' });

  const user = await verifyUser(token);
  if (!user || !user.id) return res.status(401).json({ error: '认证失败，请重新登录' });

  if (req.method === 'GET') {
    // 有 id 参数则获取单个，否则获取列表
    if (req.query.id) return handleGetSingle(req, res, user.id);
    return handleGet(req, res, user.id);
  }

  if (req.method === 'POST') return handlePost(req, res, user.id);
  if (req.method === 'PATCH') return handlePatch(req, res, user.id);
  if (req.method === 'DELETE') return handleDelete(req, res, user.id);

  return res.status(405).json({ error: 'Method not allowed' });
}
