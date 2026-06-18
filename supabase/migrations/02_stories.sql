-- 02_stories.sql
-- ChainCue IELTS: 从串题工具重构为个人故事库

-- 1. 新建 stories 表
CREATE TABLE IF NOT EXISTS stories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  raw_text TEXT NOT NULL,
  decomposition JSONB NOT NULL DEFAULT '{}',
  categories JSONB NOT NULL DEFAULT '[]',
  tags TEXT[] DEFAULT '{}',
  is_archived BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_stories_user ON stories(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_stories_user_archived ON stories(user_id, is_archived);

ALTER TABLE stories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_read_own_stories" ON stories
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "users_insert_own_stories" ON stories
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "users_update_own_stories" ON stories
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "users_delete_own_stories" ON stories
  FOR DELETE USING (auth.uid() = user_id);

-- 2. 修改 histories 表：关联 stories，区分生成类型
ALTER TABLE histories
  ADD COLUMN IF NOT EXISTS story_id UUID REFERENCES stories(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS generation_type TEXT NOT NULL DEFAULT 'decompose';

CREATE INDEX IF NOT EXISTS idx_histories_story ON histories(story_id);

-- 3. 修改 archives 表：支持 story_id 收藏
ALTER TABLE archives
  ADD COLUMN IF NOT EXISTS story_id UUID REFERENCES stories(id) ON DELETE CASCADE;

ALTER TABLE archives DROP CONSTRAINT IF EXISTS archives_user_id_history_id_key;
ALTER TABLE archives ADD CONSTRAINT archives_user_id_story_id_key UNIQUE(user_id, story_id);
