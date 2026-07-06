-- 04_profiles_credits.sql
-- ChainCue IELTS: 用户积分系统
-- 在 Supabase Dashboard → SQL Editor 中执行

-- =============================================
-- 1. 创建 profiles 表
-- =============================================
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  credits INTEGER NOT NULL DEFAULT 5,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =============================================
-- 2. 索引
-- =============================================
CREATE INDEX IF NOT EXISTS idx_profiles_id ON profiles(id);

-- =============================================
-- 3. RLS 策略
-- =============================================
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- 用户只能读取自己的 profile
CREATE POLICY "users_read_own_profile" ON profiles
  FOR SELECT USING (auth.uid() = id);

-- 用户不能直接修改自己的积分（防止作弊），所有积分变更通过 API（service_role）
-- 不创建 UPDATE/INSERT/DELETE 策略

-- =============================================
-- 4. 自动创建 profile 的触发器（新用户注册时）
-- =============================================
-- 当 auth.users 新增用户时，自动在 profiles 表插入一条记录
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, credits)
  VALUES (NEW.id, 5)
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

-- 如果触发器已存在则先删除再创建
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- =============================================
-- 5. 为已有用户补建 profile（如果之前注册的用户没有 profile 记录）
-- =============================================
INSERT INTO profiles (id, credits)
SELECT id, 5
FROM auth.users
WHERE id NOT IN (SELECT id FROM profiles)
ON CONFLICT (id) DO NOTHING;

-- =============================================
-- 6. updated_at 自动更新触发器
-- =============================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_updated_at ON profiles;
CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- =============================================
-- 验证
-- =============================================
-- 执行后可在 SQL Editor 中运行：
-- SELECT id, credits, created_at FROM profiles LIMIT 10;
