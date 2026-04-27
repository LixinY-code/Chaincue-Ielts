-- =============================================
-- 题链扣 — 数据库初始化
-- 在 Supabase Dashboard → SQL Editor 中执行
-- =============================================

-- 历史记录表
CREATE TABLE IF NOT EXISTS histories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  experience TEXT NOT NULL,
  selected_topics JSONB NOT NULL DEFAULT '[]',
  results_json JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 存档表（收藏）
CREATE TABLE IF NOT EXISTS archives (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  history_id UUID NOT NULL REFERENCES histories(id) ON DELETE CASCADE,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, history_id)
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_histories_user ON histories(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_archives_user ON archives(user_id);

-- RLS（防御性策略，后端用 service_role key 绕过）
ALTER TABLE histories ENABLE ROW LEVEL SECURITY;
ALTER TABLE archives ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_read_own_histories" ON histories
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "users_insert_own_histories" ON histories
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "users_delete_own_histories" ON histories
  FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "users_read_own_archives" ON archives
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "users_insert_own_archives" ON archives
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "users_delete_own_archives" ON archives
  FOR DELETE USING (auth.uid() = user_id);
