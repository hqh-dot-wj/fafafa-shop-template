/**
 * 新零售：属性模板 3–5（酒水、冲调麦片、水果鲜花）及与 `categories-new-retail` 的绑定
 *
 * 与 SKU 的边界（约定）：
 * - `SPEC`：类目级销售规格维度，与 `PmsProduct.specDef` 组合生成 SKU 矩阵。
 * - `PARAM`：详情展示/合规字段，一般不单独驱动 SKU。
 * - 仅个别 SPU 才有的规格轴：只写在该商品的 `specDef`，不必升格为全类目模板。
 * - 单个 SKU 的价、码、库存：门店选品/库存等业务表，不进 `PmsAttribute`。
 */
import { PrismaClient, AttrUsageType } from '@prisma/client';

type AttrSeed = {
  attrId: number;
  name: string;
  usageType: AttrUsageType;
  applyType: number;
  inputType: number;
  inputList: string | null;
  sort: number;
};

export async function seedAttrTemplatesNewRetail(prisma: PrismaClient): Promise<void> {
  console.log('  [新零售] 属性模板 3–5...');

  const t3 = await prisma.pmsAttrTemplate.upsert({
    where: { templateId: 3 },
    update: { name: '酒水饮料通用参数' },
    create: { templateId: 3, name: '酒水饮料通用参数' },
  });

  const drinkAttrs: AttrSeed[] = [
    {
      attrId: 501,
      name: '净含量(ml)',
      usageType: AttrUsageType.PARAM,
      applyType: 1,
      inputType: 0,
      inputList: null,
      sort: 1,
    },
    {
      attrId: 502,
      name: '瓶数/连包装',
      usageType: AttrUsageType.SPEC,
      applyType: 1,
      inputType: 1,
      inputList: '单瓶,2瓶装,4瓶装,6瓶装,12瓶装,整箱(24瓶)',
      sort: 2,
    },
    {
      attrId: 503,
      name: '酒精度(%vol)',
      usageType: AttrUsageType.PARAM,
      applyType: 1,
      inputType: 0,
      inputList: null,
      sort: 3,
    },
    {
      attrId: 504,
      name: '口味香型',
      usageType: AttrUsageType.SPEC,
      applyType: 1,
      inputType: 1,
      inputList: '原味,柠檬,白桃,青柠,混合,其它',
      sort: 4,
    },
    {
      attrId: 505,
      name: '糖度',
      usageType: AttrUsageType.PARAM,
      applyType: 1,
      inputType: 1,
      inputList: '无糖,低糖,含糖',
      sort: 5,
    },
  ];

  for (const a of drinkAttrs) {
    await prisma.pmsAttribute.upsert({
      where: { attrId: a.attrId },
      update: {},
      create: {
        attrId: a.attrId,
        templateId: t3.templateId,
        name: a.name,
        usageType: a.usageType,
        applyType: a.applyType,
        inputType: a.inputType,
        inputList: a.inputList ?? undefined,
        sort: a.sort,
      },
    });
  }

  const t4 = await prisma.pmsAttrTemplate.upsert({
    where: { templateId: 4 },
    update: { name: '冲调谷物与麦片参数' },
    create: { templateId: 4, name: '冲调谷物与麦片参数' },
  });

  const cerealAttrs: AttrSeed[] = [
    {
      attrId: 511,
      name: '单袋净重',
      usageType: AttrUsageType.PARAM,
      applyType: 1,
      inputType: 0,
      inputList: null,
      sort: 1,
    },
    {
      attrId: 512,
      name: '口味',
      usageType: AttrUsageType.SPEC,
      applyType: 1,
      inputType: 1,
      inputList: '原味,莓果,巧克力,核桃,混合水果,低糖配方',
      sort: 2,
    },
    {
      attrId: 513,
      name: '内含小包装数',
      usageType: AttrUsageType.PARAM,
      applyType: 1,
      inputType: 0,
      inputList: null,
      sort: 3,
    },
    {
      attrId: 514,
      name: '食用方式',
      usageType: AttrUsageType.PARAM,
      applyType: 1,
      inputType: 1,
      inputList: '热水冲泡,冷泡,即食干吃,配牛奶',
      sort: 4,
    },
    {
      attrId: 515,
      name: '包装形态',
      usageType: AttrUsageType.SPEC,
      applyType: 1,
      inputType: 1,
      inputList: '袋装,桶装,礼盒装',
      sort: 5,
    },
  ];

  for (const a of cerealAttrs) {
    await prisma.pmsAttribute.upsert({
      where: { attrId: a.attrId },
      update: {},
      create: {
        attrId: a.attrId,
        templateId: t4.templateId,
        name: a.name,
        usageType: a.usageType,
        applyType: a.applyType,
        inputType: a.inputType,
        inputList: a.inputList ?? undefined,
        sort: a.sort,
      },
    });
  }

  const t5 = await prisma.pmsAttrTemplate.upsert({
    where: { templateId: 5 },
    update: { name: '水果鲜花通用参数' },
    create: { templateId: 5, name: '水果鲜花通用参数' },
  });

  const produceAttrs: AttrSeed[] = [
    {
      attrId: 521,
      name: '份量规格',
      usageType: AttrUsageType.SPEC,
      applyType: 1,
      inputType: 1,
      inputList: '约250g,约500g,约1kg,约1.5kg,礼盒装',
      sort: 1,
    },
    {
      attrId: 522,
      name: '品种或花材',
      usageType: AttrUsageType.PARAM,
      applyType: 1,
      inputType: 0,
      inputList: null,
      sort: 2,
    },
    {
      attrId: 523,
      name: '建议保鲜天数',
      usageType: AttrUsageType.PARAM,
      applyType: 1,
      inputType: 0,
      inputList: null,
      sort: 3,
    },
    {
      attrId: 524,
      name: '色系或风格',
      usageType: AttrUsageType.SPEC,
      applyType: 1,
      inputType: 1,
      inputList: '红色系,粉色系,白色系,黄橙系,混搭,绿植风',
      sort: 4,
    },
  ];

  for (const a of produceAttrs) {
    await prisma.pmsAttribute.upsert({
      where: { attrId: a.attrId },
      update: {},
      create: {
        attrId: a.attrId,
        templateId: t5.templateId,
        name: a.name,
        usageType: a.usageType,
        applyType: a.applyType,
        inputType: a.inputType,
        inputList: a.inputList ?? undefined,
        sort: a.sort,
      },
    });
  }

  await prisma.pmsCategory.updateMany({
    where: { catId: { in: [31, 32, 36] } },
    data: { attrTemplateId: t3.templateId },
  });
  await prisma.pmsCategory.updateMany({
    where: { catId: 38 },
    data: { attrTemplateId: t4.templateId },
  });
  await prisma.pmsCategory.updateMany({
    where: { catId: { in: [41, 42, 43] } },
    data: { attrTemplateId: t5.templateId },
  });
  await prisma.pmsCategory.updateMany({
    where: { catId: { in: [30, 40] } },
    data: { attrTemplateId: null },
  });
  await prisma.pmsAttribute.deleteMany({
    where: { attrId: { in: [531, 532, 533, 534, 535, 536, 537, 538] } },
  });
  await prisma.pmsAttrTemplate.deleteMany({
    where: { templateId: 6 },
  });

  console.log('    ✓ 模板 3–5，属性 501–524，已绑定指定新零售二级分类');
}
