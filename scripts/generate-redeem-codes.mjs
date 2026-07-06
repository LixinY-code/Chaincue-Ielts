#!/usr/bin/env node

/**
 * 题链扣 — 兑换码批量生成脚本
 *
 * 用法：
 *   node scripts/generate-redeem-codes.mjs <packageType> <count> [batchSize]
 *
 * 参数：
 *   packageType  套餐类型：package_7 | package_25 | package_60 | package_100
 *   count        生成数量
 *   batchSize    每批插入数量（默认 10，最大 50）
 *
 * 示例：
 *   node scripts/generate-redeem-codes.mjs package_7 20
 *   node scripts/generate-redeem-codes.mjs package_25 20 20
 *   node scripts/generate-redeem-codes.mjs package_60 30 15
 *   node scripts/generate-redeem-codes.mjs package_100 15 10
 *
 * 环境变量（从 .env.local 读取）：
 *   SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *
 * 运行前请确保已执行 supabase/migrations/03_redeem_codes.sql
 */

import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = resolve(__dirname, '..');

// ========================================
// 加载环境变量
// ========================================
function loadEnv() {
    const envPath = resolve(projectRoot, '.env.local');
    if (!existsSync(envPath)) {
        console.error('❌ 找不到 .env.local 文件');
        console.error(`   期望路径: ${envPath}`);
        process.exit(1);
    }

    const envContent = readFileSync(envPath, 'utf8');
    const env = {};

    for (const line of envContent.split('\n')) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const eqIndex = trimmed.indexOf('=');
        if (eqIndex === -1) continue;
        const key = trimmed.substring(0, eqIndex).trim();
        const value = trimmed.substring(eqIndex + 1).trim();
        env[key] = value;
    }

    if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
        console.error('❌ .env.local 缺少 SUPABASE_URL 或 SUPABASE_SERVICE_ROLE_KEY');
        process.exit(1);
    }

    return env;
}

const ENV = loadEnv();
const SB_URL = ENV.SUPABASE_URL;
const SB_KEY = ENV.SUPABASE_SERVICE_ROLE_KEY;

// ========================================
// 套餐配置
// ========================================
const PACKAGE_CONFIG = {
    package_7:   { credits: 7,   label: '7积分套餐' },
    package_25:  { credits: 25,  label: '25积分套餐' },
    package_60:  { credits: 60,  label: '60积分套餐' },
    package_100: { credits: 100, label: '100积分套餐' }
};

// ========================================
// 兑换码生成
// ========================================
// 排除 0 和 O，避免视觉混淆
const CHARSET = 'ABCDEFGHIJKLMNPQRSTUVWXYZ123456789';

function generateCode() {
    let part1 = '';
    let part2 = '';
    for (let i = 0; i < 4; i++) {
        part1 += CHARSET[Math.floor(Math.random() * CHARSET.length)];
        part2 += CHARSET[Math.floor(Math.random() * CHARSET.length)];
    }
    return `CHAIN-${part1}-${part2}`;
}

// ========================================
// Supabase REST API 操作
// ========================================

// 检查码是否已存在
async function checkCodeExists(code) {
    const url = `${SB_URL}/rest/v1/redeem_codes?select=id&code=eq.${code}&limit=1`;
    const res = await fetch(url, {
        headers: {
            'apikey': SB_KEY,
            'Authorization': `Bearer ${SB_KEY}`
        }
    });
    if (!res.ok) {
        throw new Error(`查询失败: ${res.status} ${await res.text()}`);
    }
    const data = await res.json();
    return data.length > 0;
}

// 批量检查码是否已存在
async function checkCodesExist(codes) {
    const codeFilter = codes.map(c => `"${c}"`).join(',');
    const url = `${SB_URL}/rest/v1/redeem_codes?select=code&code=in.(${codeFilter})`;
    const res = await fetch(url, {
        headers: {
            'apikey': SB_KEY,
            'Authorization': `Bearer ${SB_KEY}`
        }
    });
    if (!res.ok) {
        throw new Error(`批量查询失败: ${res.status} ${await res.text()}`);
    }
    const data = await res.json();
    return new Set(data.map(r => r.code));
}

// 批量插入码
async function batchInsertCodes(rows) {
    const res = await fetch(`${SB_URL}/rest/v1/redeem_codes`, {
        method: 'POST',
        headers: {
            'apikey': SB_KEY,
            'Authorization': `Bearer ${SB_KEY}`,
            'Content-Type': 'application/json',
            'Prefer': 'return=minimal'
        },
        body: JSON.stringify(rows)
    });

    if (!res.ok) {
        const errText = await res.text();
        throw new Error(`插入失败: ${res.status} ${errText}`);
    }
    return true;
}

// 查询当前总数
async function getTotalCount() {
    const url = `${SB_URL}/rest/v1/redeem_codes?select=id&limit=1`;
    const res = await fetch(url, {
        headers: {
            'apikey': SB_KEY,
            'Authorization': `Bearer ${SB_KEY}`,
            'Prefer': 'count=exact'
        }
    });
    if (!res.ok) return -1;
    const range = res.headers.get('content-range');
    if (range) {
        const parts = range.split('/');
        return parseInt(parts[1]) || -1;
    }
    return -1;
}

// ========================================
// 主流程
// ========================================
async function main() {
    const args = process.argv.slice(2);

    if (args.length < 2) {
        console.log('');
        console.log('📖 题链扣 — 兑换码批量生成工具');
        console.log('');
        console.log('用法: node scripts/generate-redeem-codes.mjs <packageType> <count> [batchSize]');
        console.log('');
        console.log('套餐类型:');
        Object.entries(PACKAGE_CONFIG).forEach(([key, cfg]) => {
            console.log(`  ${key.padEnd(14)} → ${cfg.credits} 积分 (${cfg.label})`);
        });
        console.log('');
        console.log('示例:');
        console.log('  node scripts/generate-redeem-codes.mjs package_7 20');
        console.log('  node scripts/generate-redeem-codes.mjs package_25 20 20');
        console.log('  node scripts/generate-redeem-codes.mjs package_60 30 15');
        console.log('  node scripts/generate-redeem-codes.mjs package_100 15 10');
        console.log('');
        process.exit(0);
    }

    const packageType = args[0];
    const totalCount = parseInt(args[1]);
    const batchSize = Math.min(parseInt(args[2]) || 10, 50);

    // 验证参数
    if (!PACKAGE_CONFIG[packageType]) {
        console.error(`❌ 无效的套餐类型: ${packageType}`);
        console.error(`   可选: ${Object.keys(PACKAGE_CONFIG).join(', ')}`);
        process.exit(1);
    }

    if (!totalCount || totalCount < 1 || totalCount > 500) {
        console.error(`❌ 无效的数量: ${totalCount}（范围 1-500）`);
        process.exit(1);
    }

    const credits = PACKAGE_CONFIG[packageType].credits;
    const label = PACKAGE_CONFIG[packageType].label;

    console.log('');
    console.log('═══════════════════════════════════════════');
    console.log('  📖 题链扣 — 兑换码批量生成');
    console.log('═══════════════════════════════════════════');
    console.log(`  套餐类型:  ${packageType} (${label})`);
    console.log(`  积分数:    ${credits}`);
    console.log(`  生成数量:  ${totalCount}`);
    console.log(`  批次大小:  ${batchSize}`);
    console.log(`  Supabase: ${SB_URL}`);
    console.log('═══════════════════════════════════════════');
    console.log('');

    // 查询当前总数
    const beforeCount = await getTotalCount();
    if (beforeCount >= 0) {
        console.log(`📊 数据库当前兑换码总数: ${beforeCount}`);
        console.log('');
    }

    let successCount = 0;
    let failCount = 0;
    const allGeneratedCodes = [];
    const batches = Math.ceil(totalCount / batchSize);

    for (let batch = 0; batch < batches; batch++) {
        const currentBatchSize = Math.min(batchSize, totalCount - batch * batchSize);
        console.log(`📦 第 ${batch + 1}/${batches} 批 — 生成 ${currentBatchSize} 个码...`);

        // 生成码（带去重）
        const batchCodes = new Set();
        let attempts = 0;
        const maxAttempts = currentBatchSize * 5; // 防止无限循环

        while (batchCodes.size < currentBatchSize && attempts < maxAttempts) {
            const code = generateCode();
            // 本批次内去重
            if (!batchCodes.has(code)) {
                batchCodes.add(code);
            }
            attempts++;
        }

        // 如果本地生成不够，继续尝试
        while (batchCodes.size < currentBatchSize) {
            batchCodes.add(generateCode() + '-' + Date.now().toString(36).slice(-4));
        }

        const codesArray = Array.from(batchCodes);

        // 查询数据库中是否已存在这些码
        try {
            const existingCodes = await checkCodesExist(codesArray);
            const newCodes = codesArray.filter(c => !existingCodes.has(c));
            const dupCount = codesArray.length - newCodes.length;

            if (dupCount > 0) {
                console.log(`   ⚠️  ${dupCount} 个码与数据库重复，已跳过`);
            }

            // 构建插入数据
            const rows = newCodes.map(code => ({
                code,
                package_type: packageType,
                credits_amount: credits,
                is_used: false
            }));

            if (rows.length === 0) {
                console.log(`   ⏭️  本批无新码可插入`);
                failCount += currentBatchSize;
                continue;
            }

            // 批量插入
            await batchInsertCodes(rows);
            successCount += rows.length;
            allGeneratedCodes.push(...newCodes);

            // 打印本批结果
            newCodes.forEach(code => {
                console.log(`   ✅ ${code}`);
            });
            console.log(`   📊 本批成功: ${rows.length}, 重复跳过: ${dupCount}`);
            console.log('');

        } catch (err) {
            console.error(`   ❌ 第 ${batch + 1} 批失败: ${err.message}`);
            failCount += currentBatchSize;
            console.log('');
        }
    }

    // ========================================
    // 最终统计
    // ========================================
    console.log('═══════════════════════════════════════════');
    console.log('  📊 生成结果统计');
    console.log('═══════════════════════════════════════════');
    console.log(`  ✅ 成功生成: ${successCount} 个`);
    console.log(`  ❌ 失败/跳过: ${failCount} 个`);
    console.log(`  📦 套餐: ${packageType} (${credits} 积分)`);
    console.log('');

    // 查询更新后的总数
    const afterCount = await getTotalCount();
    if (afterCount >= 0 && beforeCount >= 0) {
        console.log(`📊 数据库兑换码总数: ${beforeCount} → ${afterCount} (新增 ${afterCount - beforeCount})`);
        console.log('');
    }

    // 输出所有生成的码（方便复制）
    if (allGeneratedCodes.length > 0) {
        console.log('📋 所有生成的兑换码:');
        console.log('─────────────────────────────');
        allGeneratedCodes.forEach((code, i) => {
            console.log(`  ${String(i + 1).padStart(3)}. ${code}`);
        });
        console.log('─────────────────────────────');
        console.log(`  共 ${allGeneratedCodes.length} 个`);
        console.log('');
    }

    console.log('✨ 完成！');
}

main().catch(err => {
    console.error('');
    console.error('💥 脚本执行出错:');
    console.error(err);
    process.exit(1);
});
