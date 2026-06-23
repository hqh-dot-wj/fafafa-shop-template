import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * 营销玩法模板重置脚本
 *
 * 功能：
 * 1. 删除所有现有的营销玩法模板
 * 2. 重新创建标准的营销玩法模板
 *
 * 使用方法：
 * ```bash
 * cd apps/backend
 * npx ts-node prisma/reset-marketing-templates.ts
 * ```
 */

async function main() {
  console.log('🚀 开始重置营销玩法模板...\n');

  // ==========================================
  // 第一步：删除所有现有模板
  // ==========================================
  console.log('🗑️  第一步：删除所有现有模板...');

  try {
    const deleteResult = await prisma.playTemplate.deleteMany({});
    console.log(`   ✅ 已删除 ${deleteResult.count} 个模板\n`);
  } catch (error: any) {
    console.error('   ❌ 删除模板失败:', error.message);
    throw error;
  }

  // ==========================================
  // 第二步：创建标准营销玩法模板
  // ==========================================
  console.log('📝 第二步：创建标准营销玩法模板...\n');

  const templates = [
    // 1. 课程拼团
    {
      code: 'COURSE_GROUP_BUY',
      name: '课程拼团',
      unitName: '节',
      ruleSchema: {
        fields: [
          { key: 'price', label: '课程价格', type: 'number', required: true },
          { key: 'minCount', label: '最低开班人数', type: 'number', required: true },
          { key: 'maxCount', label: '最高招生人数', type: 'number', required: true },
          { key: 'leaderDiscount', label: '团长优惠金额', type: 'number', required: false },
          { key: 'joinDeadline', label: '报名截止时间', type: 'datetime', required: true },
          { key: 'classStartTime', label: '开课时间', type: 'datetime', required: true },
          { key: 'address', label: '上课地址', type: 'address', required: true },
          { key: 'totalLessons', label: '总课时数', type: 'number', required: true },
          { key: 'dayLessons', label: '每日课时', type: 'number', required: true },
          { key: 'classTime', label: '上课时间段', type: 'string', required: true },
          { key: 'validDays', label: '课程有效期(天)', type: 'number', required: true },
        ],
      },
    },

    // 2. 限时秒杀
    {
      code: 'FLASH_SALE',
      name: '限时秒杀',
      unitName: '个',
      ruleSchema: {
        fields: [
          { key: 'price', label: '秒杀价', type: 'number', required: true },
          { key: 'stock', label: '秒杀库存', type: 'number', required: true },
          { key: 'startTime', label: '秒杀开始时间', type: 'datetime', required: true },
          { key: 'endTime', label: '秒杀结束时间', type: 'datetime', required: true },
          { key: 'limitPerUser', label: '每人限购数量', type: 'number', required: false },
        ],
      },
    },

    // 3. 会员升级
    {
      code: 'MEMBER_UPGRADE',
      name: '会员升级',
      unitName: '个',
      ruleSchema: {
        fields: [
          { key: 'price', label: '会员价格', type: 'number', required: true },
          { key: 'validDays', label: '会员有效期(天)', type: 'number', required: true },
          { key: 'commission', label: '推荐佣金比例(%)', type: 'number', required: false },
          { key: 'benefits', label: '会员权益说明', type: 'string', required: false },
        ],
      },
    },
  ];

  // 批量创建模板
  for (const template of templates) {
    try {
      const created = await prisma.playTemplate.create({
        data: template,
      });
      console.log(`   ✅ ${template.name} (${template.code})`);
    } catch (error: any) {
      console.error(`   ❌ 创建 ${template.name} 失败:`, error.message);
    }
  }

  console.log('\n🎉 营销玩法模板重置完成！\n');

  // ==========================================
  // 第三步：验证结果
  // ==========================================
  console.log('🔍 第三步：验证结果...\n');

  const allTemplates = await prisma.playTemplate.findMany({
    orderBy: { code: 'asc' },
  });

  console.log('📋 当前系统中的营销玩法模板：\n');
  allTemplates.forEach((template, index) => {
    console.log(`   ${index + 1}. ${template.name} (${template.code})`);
    console.log(`      单位: ${template.unitName}`);
    console.log(`      字段数: ${(template.ruleSchema as any)?.fields?.length || 0}`);
    console.log('');
  });

  console.log(`✨ 总计: ${allTemplates.length} 个模板\n`);
}

main()
  .catch((e) => {
    console.error('\n❌ 脚本执行失败:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
