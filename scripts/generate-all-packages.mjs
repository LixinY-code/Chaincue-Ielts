#!/usr/bin/env node

/**
 * 题链扣 — 一键生成全部套餐兑换码
 *
 * 按建议为四个套餐各生成一批：
 *   7积分  x 20 个
 *   25积分 x 20 个
 *   60积分 x 30 个
 *   100积分 x 15 个
 *   总计 85 个
 *
 * 用法：
 *   node scripts/generate-all-packages.mjs
 *
 * 每个套餐之间会暂停 2 秒，避免请求过快。
 */

import { execSync } from 'child_process';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const BATCH_CONFIG = [
    { type: 'package_7',   count: 20, batchSize: 10, label: '7积分套餐' },
    { type: 'package_25',  count: 20, batchSize: 10, label: '25积分套餐' },
    { type: 'package_60',  count: 30, batchSize: 15, label: '60积分套餐' },
    { type: 'package_100', count: 15, batchSize: 10, label: '100积分套餐' }
];

console.log('');
console.log('╔═══════════════════════════════════════════════╗');
console.log('║  📖 题链扣 — 一键生成全部套餐兑换码          ║');
console.log('╚═══════════════════════════════════════════════╝');
console.log('');
console.log('生成计划:');
BATCH_CONFIG.forEach((b, i) => {
    console.log(`  ${i + 1}. ${b.type.padEnd(14)} x ${b.count} 个 (批次: ${b.batchSize}) — ${b.label}`);
});
console.log(`  总计: ${BATCH_CONFIG.reduce((s, b) => s + b.count, 0)} 个`);
console.log('');

const scriptPath = resolve(__dirname, 'generate-redeem-codes.mjs');

for (let i = 0; i < BATCH_CONFIG.length; i++) {
    const cfg = BATCH_CONFIG[i];
    console.log('');
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`  第 ${i + 1}/${BATCH_CONFIG.length} 批: ${cfg.label}`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);

    try {
        execSync(`node "${scriptPath}" ${cfg.type} ${cfg.count} ${cfg.batchSize}`, {
            stdio: 'inherit',
            cwd: resolve(__dirname, '..')
        });
    } catch (err) {
        console.error(`❌ ${cfg.label} 生成失败: ${err.message}`);
    }

    // 批次间暂停 2 秒
    if (i < BATCH_CONFIG.length - 1) {
        console.log('');
        console.log('⏳ 等待 2 秒...');
        execSync('timeout 2', { stdio: 'ignore' }).catch(() => {});
    }
}

console.log('');
console.log('╔═══════════════════════════════════════════════╗');
console.log('║  ✨ 全部套餐兑换码生成完毕！                  ║');
console.log('╚═══════════════════════════════════════════════╝');
console.log('');
console.log('可在 Supabase Dashboard 查看结果:');
console.log('  SELECT package_type, credits_amount, count(*) as total,');
console.log('         count(*) FILTER (WHERE is_used = true) as used');
console.log('  FROM redeem_codes GROUP BY package_type, credits_amount;');
console.log('');
