// Supabase REST API 工具函数（不依赖 SDK，零依赖）

const SB_URL = process.env.SUPABASE_URL;
const SB_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// 验证用户 JWT token → 返回 user 对象
async function verifyUser(token) {
  const res = await fetch(`${SB_URL}/auth/v1/user`, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'apikey': process.env.SUPABASE_ANON_KEY || ''
    }
  });
  if (!res.ok) return null;
  const data = await res.json();
  return data || null;
}

// Supabase REST API 查询
async function sbQuery(table, { select = '*', eq, single, order, ascending = false, limit = 100 } = {}) {
  let url = `${SB_URL}/rest/v1/${table}?select=${encodeURIComponent(select)}`;
  if (eq) Object.entries(eq).forEach(([k, v]) => { url += `&${k}=eq.${v}`; });
  if (order) url += `&order=${order}.${ascending ? 'asc' : 'desc'}`;
  if (limit) url += `&limit=${limit}`;
  if (single) url += '&select=...single()';

  const res = await fetch(url, {
    headers: {
      'apikey': SB_KEY,
      'Authorization': `Bearer ${SB_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': single ? 'return=representation' : 'return=representation'
    }
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(err);
  }
  if (single) {
    const data = await res.json();
    return data;
  }
  return await res.json();
}

// Supabase REST API 插入
async function sbInsert(table, row) {
  const res = await fetch(`${SB_URL}/rest/v1/${table}`, {
    method: 'POST',
    headers: {
      'apikey': SB_KEY,
      'Authorization': `Bearer ${SB_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=minimal'
    },
    body: JSON.stringify(row)
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(err);
  }
  return true;
}

// Supabase REST API upsert
async function sbUpsert(table, row, onConflict) {
  let url = `${SB_URL}/rest/v1/${table}`;
  const headers = {
    'apikey': SB_KEY,
    'Authorization': `Bearer ${SB_KEY}`,
    'Content-Type': 'application/json',
    'Prefer': 'resolution=merge-duplicates,return=minimal'
  };
  if (onConflict) {
    url += `?on_conflict=${onConflict}`;
  }
  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(row)
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(err);
  }
  return true;
}

export { verifyUser, sbQuery, sbInsert, sbUpsert, SB_URL };
