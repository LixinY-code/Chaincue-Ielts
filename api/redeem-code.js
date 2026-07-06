import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// =============================================
// 主入口
// =============================================
export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // 1. 验证用户身份
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) return res.status(401).json({ error: '未提供认证 token' });

    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) return res.status(401).json({ error: '认证失败，请重新登录' });

    const { code } = req.body;
    if (!code || typeof code !== 'string') {
      return res.status(400).json({ error: '请输入激活码' });
    }

    // 统一格式：大写 + 去空格
    const normalizedCode = code.trim().toUpperCase();

    // 2. 查询兑换码
    const { data: redeemRecord, error: queryError } = await supabase
      .from('redeem_codes')
      .select('id, code, package_type, credits_amount, is_used, used_by')
      .eq('code', normalizedCode)
      .single();

    if (queryError || !redeemRecord) {
      return res.status(200).json({ success: false, error: '激活码不存在，请检查是否输入正确' });
    }

    // 3. 检查是否已使用
    if (redeemRecord.is_used) {
      if (redeemRecord.used_by === user.id) {
        return res.status(200).json({ success: false, error: '你已使用过此激活码' });
      } else {
        return res.status(200).json({ success: false, error: '该激活码已被其他用户使用' });
      }
    }

    // 4. 事务：增加积分 + 标记已使用
    // 4a. 查询当前积分
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('credits')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      // 如果 profile 不存在，自动创建一个（防御性）
      const { data: newProfile, error: createError } = await supabase
        .from('profiles')
        .insert({ id: user.id, credits: redeemRecord.credits_amount })
        .select('credits')
        .single();

      if (createError) {
        console.error('Create profile error:', createError);
        return res.status(500).json({ error: '用户信息初始化失败' });
      }

      const newBalance = newProfile.credits;

      // 4b. 标记兑换码已使用
      const { error: updateCodeError } = await supabase
        .from('redeem_codes')
        .update({
          is_used: true,
          used_by: user.id,
          used_at: new Date().toISOString()
        })
        .eq('id', redeemRecord.id);

      if (updateCodeError) {
        console.error('Update redeem code error:', updateCodeError);
        return res.status(500).json({ error: '兑换码状态更新失败' });
      }

      return res.status(200).json({
        success: true,
        credits_added: redeemRecord.credits_amount,
        new_balance: newBalance
      });
    }

    // 4c. 增加积分
    const currentCredits = profile.credits || 0;
    const newBalance = currentCredits + redeemRecord.credits_amount;

    const { error: updateCreditsError } = await supabase
      .from('profiles')
      .update({ credits: newBalance, updated_at: new Date().toISOString() })
      .eq('id', user.id);

    if (updateCreditsError) {
      console.error('Update credits error:', updateCreditsError);
      return res.status(500).json({ error: '积分更新失败' });
    }

    // 4d. 标记兑换码已使用
    const { error: updateCodeError } = await supabase
      .from('redeem_codes')
      .update({
        is_used: true,
        used_by: user.id,
        used_at: new Date().toISOString()
      })
      .eq('id', redeemRecord.id)
      .eq('is_used', false); // 防止并发：只有未使用的才能更新

    if (updateCodeError) {
      console.error('Update redeem code error:', updateCodeError);
      // 回滚积分
      await supabase
        .from('profiles')
        .update({ credits: currentCredits, updated_at: new Date().toISOString() })
        .eq('id', user.id);
      return res.status(500).json({ error: '兑换码状态更新失败，积分已回滚' });
    }

    // 检查是否真的更新了（防止并发竞争）
    const { count } = await supabase
      .from('redeem_codes')
      .select('id', { count: 'exact', head: true })
      .eq('id', redeemRecord.id)
      .eq('is_used', true)
      .eq('used_by', user.id);

    if (!count || count === 0) {
      // 被别人抢用了，回滚积分
      await supabase
        .from('profiles')
        .update({ credits: currentCredits, updated_at: new Date().toISOString() })
        .eq('id', user.id);
      return res.status(200).json({ success: false, error: '该激活码已被其他用户使用' });
    }

    return res.status(200).json({
      success: true,
      credits_added: redeemRecord.credits_amount,
      new_balance: newBalance
    });

  } catch (err) {
    console.error('Redeem code error:', err);
    return res.status(500).json({ error: err.message || '兑换失败' });
  }
}
