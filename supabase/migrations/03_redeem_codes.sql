-- 03_redeem_codes.sql
-- ChainCue IELTS: 兑换码系统
-- 在 Supabase Dashboard → SQL Editor 中执行

-- =============================================
-- 1. 创建 redeem_codes 表
-- =============================================
CREATE TABLE IF NOT EXISTS redeem_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(20) NOT NULL UNIQUE,
  package_type VARCHAR(20) NOT NULL,
  credits_amount INTEGER NOT NULL,
  is_used BOOLEAN NOT NULL DEFAULT FALSE,
  used_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =============================================
-- 2. 索引
-- =============================================
-- code 唯一索引（UNIQUE 约束已自动创建，显式声明便于维护）
CREATE INDEX IF NOT EXISTS idx_redeem_codes_code ON redeem_codes(code);

-- 按套餐类型查询（用于统计、批量管理）
CREATE INDEX IF NOT EXISTS idx_redeem_codes_package ON redeem_codes(package_type, is_used);

-- 按使用状态查询（用于查找可用码）
CREATE INDEX IF NOT EXISTS idx_redeem_codes_unused ON redeem_codes(is_used) WHERE is_used = FALSE;

-- 按使用者查询（用于查询某用户兑换了哪些码）
CREATE INDEX IF NOT EXISTS idx_redeem_codes_used_by ON redeem_codes(used_by) WHERE used_by IS NOT NULL;

-- =============================================
-- 3. RLS 策略
-- =============================================
-- 兑换码表不直接对用户开放 CRUD，所有操作通过 Serverless API（service_role key）完成
-- 这里启用 RLS 作为防御性措施，不带任何用户策略
ALTER TABLE redeem_codes ENABLE ROW LEVEL SECURITY;

-- 仅允许用户查询自己已兑换的码（可选，主要用于前端展示兑换记录）
CREATE POLICY "users_read_own_redeemed_codes" ON redeem_codes
  FOR SELECT USING (auth.uid() = used_by);

-- =============================================
-- 4. 更新时间触发器（可选）
-- =============================================
-- 此表没有 updated_at 字段，无需触发器

-- =============================================
-- 5. 验证
-- =============================================
-- 执行后可在 SQL Editor 中运行以下查询验证：
-- SELECT count(*) FROM redeem_codes;
-- SELECT package_type, credits_amount, count(*) as total,
--        count(*) FILTER (WHERE is_used = true) as used
-- FROM redeem_codes GROUP BY package_type, credits_amount;
