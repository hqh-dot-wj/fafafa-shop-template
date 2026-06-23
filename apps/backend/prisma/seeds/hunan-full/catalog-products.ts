import type { HunanProductBlueprint, HunanSkuBlueprint } from './types';
import { hunanFullImage } from './shared';

export const HUNAN_FULL_PRODUCT_THEMES = ['retail', 'instant', 'service'] as const;

function sku(
  skuId: string,
  specValues: Record<string, string>,
  guidePrice: number,
  costPrice: number,
  tenantPrice: number,
  stock: number,
  extras: Partial<HunanSkuBlueprint> = {},
): HunanSkuBlueprint {
  return {
    skuId,
    specValues,
    guidePrice,
    costPrice,
    tenantPrice,
    stock,
    distMode: 'RATIO',
    distRate: 1,
    pointsRatio: 100,
    isPromotionProduct: false,
    newcomerPrice: null,
    ...extras,
  };
}

function realProduct(product: Omit<HunanProductBlueprint, 'type' | 'isFreeShip'>): HunanProductBlueprint {
  return {
    type: 'REAL',
    isFreeShip: false,
    ...product,
  };
}

function serviceProduct(
  product: Omit<HunanProductBlueprint, 'type' | 'weight' | 'isFreeShip'>,
): HunanProductBlueprint {
  return {
    type: 'SERVICE',
    isFreeShip: true,
    ...product,
  };
}

const retailProducts: HunanProductBlueprint[] = [
  realProduct({
    theme: 'retail',
    productId: 'hf-retail-cleaner-001',
    categoryId: 101,
    brandId: 1,
    name: '净润多效厨房清洁剂',
    subTitle: '去油快，适合湖南门店高频补货',
    weight: 1100,
    mainImage: hunanFullImage('retail-cleaner-001'),
    attrValues: [
      { attrId: 1, attrName: '材质', value: '塑料+液体' },
      { attrId: 2, attrName: '规格', value: '500ml/1L/补充装' },
      { attrId: 3, attrName: '颜色', value: '透明' },
      { attrId: 4, attrName: '产地', value: '长沙' },
    ],
    specs: [
      { name: '规格', values: ['500ml', '1L', '补充装'] },
      { name: '香型', values: ['青柠', '无香'] },
    ],
    skus: [
      sku('hf-retail-cleaner-001-sku-1', { 规格: '500ml', 香型: '青柠' }, 23.9, 9.8, 21.9, 180, {
        isPromotionProduct: true,
        newcomerPrice: 19.9,
      }),
      sku('hf-retail-cleaner-001-sku-2', { 规格: '1L', 香型: '青柠' }, 39.9, 15.2, 36.9, 160, {
        isPromotionProduct: true,
      }),
      sku('hf-retail-cleaner-001-sku-3', { 规格: '补充装', 香型: '无香' }, 19.9, 7.6, 18.5, 96, {
        pointsRatio: 80,
      }),
    ],
    isHot: true,
    sort: 10,
  }),
  realProduct({
    theme: 'retail',
    productId: 'hf-retail-mop-001',
    categoryId: 101,
    brandId: 2,
    name: '轻旋拖地桶套装',
    subTitle: '家清主推款，适合门店组合促销',
    weight: 3200,
    mainImage: hunanFullImage('retail-mop-001'),
    attrValues: [
      { attrId: 1, attrName: '材质', value: '塑料+金属' },
      { attrId: 2, attrName: '规格', value: '标准/升级' },
      { attrId: 3, attrName: '颜色', value: '灰白/奶茶' },
      { attrId: 4, attrName: '产地', value: '株洲' },
    ],
    specs: [
      { name: '版本', values: ['标准版', '升级版'] },
      { name: '颜色', values: ['灰白', '奶茶'] },
    ],
    skus: [
      sku('hf-retail-mop-001-sku-1', { 版本: '标准版', 颜色: '灰白' }, 99, 42, 92, 48),
      sku('hf-retail-mop-001-sku-2', { 版本: '升级版', 颜色: '灰白' }, 129, 55, 118, 36, {
        distRate: 0.85,
      }),
      sku('hf-retail-mop-001-sku-3', { 版本: '升级版', 颜色: '奶茶' }, 129, 55, 118, 32, {
        distRate: 0.85,
      }),
    ],
    sort: 20,
  }),
  realProduct({
    theme: 'retail',
    productId: 'hf-retail-baby-wipes-001',
    categoryId: 103,
    brandId: 5,
    name: '婴护柔润湿巾',
    subTitle: '母婴常备，支持新人券与积分抵扣',
    weight: 680,
    mainImage: hunanFullImage('retail-baby-wipes-001'),
    attrValues: [
      { attrId: 1, attrName: '材质', value: '无纺布' },
      { attrId: 2, attrName: '规格', value: '80抽/100抽/家庭装' },
      { attrId: 3, attrName: '颜色', value: '白色' },
      { attrId: 4, attrName: '产地', value: '岳阳' },
    ],
    specs: [
      { name: '规格', values: ['80抽', '100抽', '80抽*6包'] },
      { name: '配方', values: ['纯水', '芦荟'] },
    ],
    skus: [
      sku('hf-retail-baby-wipes-001-sku-1', { 规格: '80抽', 配方: '纯水' }, 19.9, 8.4, 17.9, 220, {
        newcomerPrice: 15.9,
      }),
      sku('hf-retail-baby-wipes-001-sku-2', { 规格: '100抽', 配方: '芦荟' }, 24.9, 10.8, 22.9, 186),
      sku('hf-retail-baby-wipes-001-sku-3', { 规格: '80抽*6包', 配方: '纯水' }, 89, 43, 82, 58, {
        isPromotionProduct: true,
        pointsRatio: 70,
      }),
    ],
    isHot: true,
    sort: 30,
  }),
  realProduct({
    theme: 'retail',
    productId: 'hf-retail-baby-shampoo-001',
    categoryId: 103,
    brandId: null,
    name: '儿童氨基酸洗发露',
    subTitle: '低刺激配方，适合母婴专区满减',
    weight: 520,
    mainImage: hunanFullImage('retail-baby-shampoo-001'),
    attrValues: [
      { attrId: 1, attrName: '材质', value: '液体' },
      { attrId: 2, attrName: '规格', value: '300ml/500ml' },
      { attrId: 3, attrName: '颜色', value: '白色' },
      { attrId: 4, attrName: '产地', value: '衡阳' },
    ],
    specs: [
      { name: '规格', values: ['300ml', '500ml'] },
      { name: '香型', values: ['桃桃', '无香'] },
    ],
    skus: [
      sku('hf-retail-baby-shampoo-001-sku-1', { 规格: '300ml', 香型: '桃桃' }, 45, 18, 41, 90),
      sku('hf-retail-baby-shampoo-001-sku-2', { 规格: '500ml', 香型: '无香' }, 69, 29, 63, 72, {
        isPromotionProduct: true,
      }),
    ],
    sort: 40,
  }),
  realProduct({
    theme: 'retail',
    productId: 'hf-retail-earbud-001',
    categoryId: 104,
    brandId: 3,
    name: '轻音蓝牙耳机',
    subTitle: '数码引流款，支持分销但积分比例降档',
    weight: 120,
    mainImage: hunanFullImage('retail-earbud-001'),
    attrValues: [
      { attrId: 1, attrName: '材质', value: '塑料+金属' },
      { attrId: 2, attrName: '规格', value: '标准/长续航' },
      { attrId: 3, attrName: '颜色', value: '白/黑/薄荷绿' },
      { attrId: 4, attrName: '产地', value: '深圳' },
    ],
    specs: [
      { name: '版本', values: ['标准版', '长续航版'] },
      { name: '颜色', values: ['白色', '黑色', '薄荷绿'] },
    ],
    skus: [
      sku('hf-retail-earbud-001-sku-1', { 版本: '标准版', 颜色: '白色' }, 199, 88, 188, 46, {
        pointsRatio: 30,
      }),
      sku('hf-retail-earbud-001-sku-2', { 版本: '标准版', 颜色: '黑色' }, 199, 88, 188, 38, {
        pointsRatio: 30,
      }),
      sku('hf-retail-earbud-001-sku-3', { 版本: '长续航版', 颜色: '薄荷绿' }, 239, 112, 226, 28, {
        distRate: 0.7,
        pointsRatio: 20,
      }),
    ],
    sort: 50,
  }),
  realProduct({
    theme: 'retail',
    productId: 'hf-retail-powerbank-001',
    categoryId: 104,
    brandId: 3,
    name: '磁吸快充充电宝',
    subTitle: '大件数码，作为低库存样本与禁佣样本',
    weight: 460,
    mainImage: hunanFullImage('retail-powerbank-001'),
    attrValues: [
      { attrId: 1, attrName: '材质', value: '塑料+锂电芯' },
      { attrId: 2, attrName: '规格', value: '10000mAh/20000mAh' },
      { attrId: 3, attrName: '颜色', value: '岩黑/奶油白' },
      { attrId: 4, attrName: '产地', value: '东莞' },
    ],
    specs: [
      { name: '容量', values: ['10000mAh', '20000mAh'] },
      { name: '颜色', values: ['岩黑', '奶油白'] },
    ],
    skus: [
      sku('hf-retail-powerbank-001-sku-1', { 容量: '10000mAh', 颜色: '岩黑' }, 149, 79, 139, 8, {
        distMode: 'NONE',
        distRate: 0,
        pointsRatio: 0,
      }),
      sku('hf-retail-powerbank-001-sku-2', { 容量: '20000mAh', 颜色: '奶油白' }, 189, 98, 176, 5, {
        distMode: 'NONE',
        distRate: 0,
        pointsRatio: 0,
      }),
    ],
    sort: 60,
  }),
  realProduct({
    theme: 'retail',
    productId: 'hf-retail-nuts-gift-001',
    categoryId: 105,
    brandId: 4,
    name: '每日坚果分享礼盒',
    subTitle: '食品礼赠，适合节庆拼团与企业福利',
    weight: 950,
    mainImage: hunanFullImage('retail-nuts-gift-001'),
    attrValues: [
      { attrId: 1, attrName: '材质', value: '食品' },
      { attrId: 2, attrName: '规格', value: '12包/24包/节礼盒' },
      { attrId: 3, attrName: '颜色', value: '原色包装' },
      { attrId: 4, attrName: '产地', value: '新疆' },
    ],
    specs: [
      { name: '规格', values: ['12包', '24包', '节礼盒'] },
      { name: '口味', values: ['经典', '低糖'] },
    ],
    skus: [
      sku('hf-retail-nuts-gift-001-sku-1', { 规格: '12包', 口味: '经典' }, 59, 26, 55, 110, {
        isPromotionProduct: true,
      }),
      sku('hf-retail-nuts-gift-001-sku-2', { 规格: '24包', 口味: '经典' }, 99, 45, 92, 78, {
        isPromotionProduct: true,
        distRate: 0.9,
      }),
      sku('hf-retail-nuts-gift-001-sku-3', { 规格: '节礼盒', 口味: '低糖' }, 129, 60, 118, 42, {
        pointsRatio: 60,
      }),
    ],
    sort: 70,
  }),
  realProduct({
    theme: 'retail',
    productId: 'hf-retail-oatmeal-001',
    categoryId: 105,
    brandId: 4,
    name: '即食燕麦谷物杯',
    subTitle: '快消复购款，兑换券样本',
    weight: 420,
    mainImage: hunanFullImage('retail-oatmeal-001'),
    attrValues: [
      { attrId: 1, attrName: '材质', value: '谷物' },
      { attrId: 2, attrName: '规格', value: '6杯/12杯/组合装' },
      { attrId: 3, attrName: '颜色', value: '彩盒' },
      { attrId: 4, attrName: '产地', value: '常德' },
    ],
    specs: [
      { name: '口味', values: ['莓果', '坚果'] },
      { name: '规格', values: ['6杯', '12杯', '组合装'] },
    ],
    skus: [
      sku('hf-retail-oatmeal-001-sku-1', { 口味: '莓果', 规格: '6杯' }, 29.9, 13.2, 27.9, 150),
      sku('hf-retail-oatmeal-001-sku-2', { 口味: '坚果', 规格: '12杯' }, 49.9, 22.6, 46.9, 104, {
        isPromotionProduct: true,
      }),
      sku('hf-retail-oatmeal-001-sku-3', { 口味: '莓果', 规格: '组合装' }, 0, 0, 0, 40, {
        guidePrice: 39.9,
        costPrice: 18,
        tenantPrice: 0.01,
        stock: 40,
        distMode: 'NONE',
        distRate: 0,
        pointsRatio: 0,
        isExchangeProduct: true,
      }),
    ],
    sort: 80,
  }),
];

const instantProducts: HunanProductBlueprint[] = [
  realProduct({
    theme: 'instant',
    productId: 'hf-instant-blueberry-001',
    categoryId: 41,
    brandId: null,
    name: '云南蓝莓鲜果盒',
    subTitle: '首页鲜果模块主推款',
    weight: 1000,
    mainImage: hunanFullImage('instant-blueberry-001'),
    attrValues: [
      { attrId: 521, attrName: '份量规格', value: '125g*2/125g*4/礼盒装' },
      { attrId: 522, attrName: '品种或花材', value: 'L25蓝莓' },
      { attrId: 523, attrName: '建议保鲜天数', value: '5' },
      { attrId: 524, attrName: '色系或风格', value: '蓝紫色系' },
    ],
    specs: [{ name: '规格', values: ['125g*2盒', '125g*4盒', '礼盒装'] }],
    skus: [
      sku('hf-instant-blueberry-001-sku-1', { 规格: '125g*2盒' }, 29.9, 18, 28.8, 85, {
        isPromotionProduct: true,
        newcomerPrice: 25.9,
      }),
      sku('hf-instant-blueberry-001-sku-2', { 规格: '125g*4盒' }, 49.9, 32, 47.8, 64, {
        isPromotionProduct: true,
      }),
      sku('hf-instant-blueberry-001-sku-3', { 规格: '礼盒装' }, 79.9, 52, 76.9, 28, {
        distRate: 0.9,
      }),
    ],
    isHot: true,
    sort: 110,
  }),
  realProduct({
    theme: 'instant',
    productId: 'hf-instant-cherry-001',
    categoryId: 42,
    brandId: null,
    name: '进口车厘子尝鲜箱',
    subTitle: '高客单即时零售样本',
    weight: 1500,
    mainImage: hunanFullImage('instant-cherry-001'),
    attrValues: [
      { attrId: 521, attrName: '份量规格', value: '1kg/2kg/J礼盒' },
      { attrId: 522, attrName: '品种或花材', value: '智利JJJ' },
      { attrId: 523, attrName: '建议保鲜天数', value: '4' },
      { attrId: 524, attrName: '色系或风格', value: '红色系' },
    ],
    specs: [
      { name: '规格', values: ['1kg', '2kg'] },
      { name: '等级', values: ['JJ', 'JJJ'] },
    ],
    skus: [
      sku('hf-instant-cherry-001-sku-1', { 规格: '1kg', 等级: 'JJ' }, 89, 62, 85, 42),
      sku('hf-instant-cherry-001-sku-2', { 规格: '2kg', 等级: 'JJJ' }, 169, 125, 162, 21, {
        pointsRatio: 50,
      }),
    ],
    sort: 120,
  }),
  realProduct({
    theme: 'instant',
    productId: 'hf-instant-fruit-platter-001',
    categoryId: 43,
    brandId: null,
    name: '聚会鲜切果盘',
    subTitle: '活动页秒杀与拼团共用样本',
    weight: 900,
    mainImage: hunanFullImage('instant-fruit-platter-001'),
    attrValues: [
      { attrId: 521, attrName: '份量规格', value: '双人/四人/礼赠' },
      { attrId: 522, attrName: '品种或花材', value: '混合鲜切' },
      { attrId: 523, attrName: '建议保鲜天数', value: '1' },
      { attrId: 524, attrName: '色系或风格', value: '混搭' },
    ],
    specs: [{ name: '规格', values: ['双人装', '四人装', '礼赠装'] }],
    skus: [
      sku('hf-instant-fruit-platter-001-sku-1', { 规格: '双人装' }, 36.9, 18.5, 34.9, 48, {
        isPromotionProduct: true,
      }),
      sku('hf-instant-fruit-platter-001-sku-2', { 规格: '四人装' }, 58.9, 31.2, 55.9, 38, {
        isPromotionProduct: true,
      }),
      sku('hf-instant-fruit-platter-001-sku-3', { 规格: '礼赠装' }, 79.9, 46.8, 75.9, 16, {
        distRate: 0.6,
      }),
    ],
    sort: 130,
  }),
  realProduct({
    theme: 'instant',
    productId: 'hf-instant-coconut-water-001',
    categoryId: 36,
    brandId: null,
    name: '100%椰子水组合装',
    subTitle: '秒杀专区高频款',
    weight: 1200,
    mainImage: hunanFullImage('instant-coconut-water-001'),
    attrValues: [
      { attrId: 501, attrName: '净含量(ml)', value: '350/1000' },
      { attrId: 502, attrName: '瓶数/连包装', value: '6瓶/12瓶' },
      { attrId: 503, attrName: '酒精度(%vol)', value: '0' },
      { attrId: 505, attrName: '糖度', value: '低糖' },
    ],
    specs: [
      { name: '规格', values: ['350ml*6瓶', '350ml*12瓶', '1L*2瓶'] },
      { name: '口味', values: ['原味'] },
    ],
    skus: [
      sku('hf-instant-coconut-water-001-sku-1', { 规格: '350ml*6瓶', 口味: '原味' }, 39.9, 24, 36.9, 130, {
        isPromotionProduct: true,
        newcomerPrice: 29.9,
      }),
      sku('hf-instant-coconut-water-001-sku-2', { 规格: '350ml*12瓶', 口味: '原味' }, 72, 45, 68, 90, {
        isPromotionProduct: true,
      }),
      sku('hf-instant-coconut-water-001-sku-3', { 规格: '1L*2瓶', 口味: '原味' }, 29.9, 17, 27.9, 84),
    ],
    isHot: true,
    sort: 140,
  }),
  realProduct({
    theme: 'instant',
    productId: 'hf-instant-oat-milk-001',
    categoryId: 36,
    brandId: null,
    name: '低糖燕麦奶礼享装',
    subTitle: '低糖饮品，满减专区样本',
    weight: 1150,
    mainImage: hunanFullImage('instant-oat-milk-001'),
    attrValues: [
      { attrId: 501, attrName: '净含量(ml)', value: '250/1000' },
      { attrId: 502, attrName: '瓶数/连包装', value: '6盒/12盒' },
      { attrId: 503, attrName: '酒精度(%vol)', value: '0' },
      { attrId: 505, attrName: '糖度', value: '低糖' },
    ],
    specs: [
      { name: '规格', values: ['250ml*6盒', '250ml*12盒'] },
      { name: '配方', values: ['经典', '高钙'] },
    ],
    skus: [
      sku('hf-instant-oat-milk-001-sku-1', { 规格: '250ml*6盒', 配方: '经典' }, 26.9, 15.2, 24.9, 118),
      sku('hf-instant-oat-milk-001-sku-2', { 规格: '250ml*12盒', 配方: '高钙' }, 49.9, 29, 46.9, 76, {
        pointsRatio: 80,
      }),
    ],
    sort: 150,
  }),
  realProduct({
    theme: 'instant',
    productId: 'hf-instant-craft-beer-001',
    categoryId: 31,
    brandId: null,
    name: '精酿小麦啤酒组合',
    subTitle: '晚间场景投放样本',
    weight: 2100,
    mainImage: hunanFullImage('instant-craft-beer-001'),
    attrValues: [
      { attrId: 501, attrName: '净含量(ml)', value: '330/500' },
      { attrId: 502, attrName: '瓶数/连包装', value: '6罐/12罐' },
      { attrId: 503, attrName: '酒精度(%vol)', value: '4.8' },
      { attrId: 504, attrName: '口味香型', value: '小麦/青柠' },
    ],
    specs: [
      { name: '规格', values: ['330ml*6罐', '500ml*6罐'] },
      { name: '口味', values: ['小麦', '青柠'] },
    ],
    skus: [
      sku('hf-instant-craft-beer-001-sku-1', { 规格: '330ml*6罐', 口味: '小麦' }, 49.9, 30.5, 46.9, 68),
      sku('hf-instant-craft-beer-001-sku-2', { 规格: '500ml*6罐', 口味: '青柠' }, 69.9, 44, 65.9, 52, {
        distRate: 0.8,
      }),
    ],
    sort: 160,
  }),
  realProduct({
    theme: 'instant',
    productId: 'hf-instant-red-wine-001',
    categoryId: 32,
    brandId: null,
    name: '智利赤霞珠双支礼盒',
    subTitle: '礼盒高客单样本，积分关闭',
    weight: 2600,
    mainImage: hunanFullImage('instant-red-wine-001'),
    attrValues: [
      { attrId: 501, attrName: '净含量(ml)', value: '750' },
      { attrId: 502, attrName: '瓶数/连包装', value: '双支礼盒' },
      { attrId: 503, attrName: '酒精度(%vol)', value: '13.5' },
      { attrId: 504, attrName: '口味香型', value: '黑樱桃' },
    ],
    specs: [
      { name: '规格', values: ['双支礼盒', '单支收藏盒'] },
      { name: '年份', values: ['2021', '2022'] },
    ],
    skus: [
      sku('hf-instant-red-wine-001-sku-1', { 规格: '双支礼盒', 年份: '2021' }, 199, 124, 189, 24, {
        pointsRatio: 0,
      }),
      sku('hf-instant-red-wine-001-sku-2', { 规格: '单支收藏盒', 年份: '2022' }, 109, 68, 102, 30, {
        pointsRatio: 0,
      }),
    ],
    sort: 170,
  }),
  realProduct({
    theme: 'instant',
    productId: 'hf-instant-granola-001',
    categoryId: 38,
    brandId: null,
    name: '烘焙谷物燕麦片',
    subTitle: '早餐场景与兑换券样本',
    weight: 680,
    mainImage: hunanFullImage('instant-granola-001'),
    attrValues: [
      { attrId: 511, attrName: '单袋净重', value: '280g/420g' },
      { attrId: 512, attrName: '口味', value: '莓果/核桃' },
      { attrId: 514, attrName: '食用方式', value: '热泡/冷泡' },
      { attrId: 515, attrName: '包装形态', value: '袋装/礼盒装' },
    ],
    specs: [
      { name: '口味', values: ['莓果', '核桃'] },
      { name: '规格', values: ['280g', '420g'] },
    ],
    skus: [
      sku('hf-instant-granola-001-sku-1', { 口味: '莓果', 规格: '280g' }, 32.9, 18.2, 30.9, 84),
      sku('hf-instant-granola-001-sku-2', { 口味: '核桃', 规格: '420g' }, 46.9, 26.6, 43.9, 70, {
        isPromotionProduct: true,
      }),
      sku('hf-instant-granola-001-sku-3', { 口味: '莓果', 规格: '420g' }, 46.9, 26.6, 0.01, 20, {
        distMode: 'NONE',
        distRate: 0,
        pointsRatio: 0,
        isExchangeProduct: true,
      }),
    ],
    sort: 180,
  }),
];

const serviceProducts: HunanProductBlueprint[] = [
  serviceProduct({
    theme: 'service',
    productId: 'hf-service-art-001',
    categoryId: 201,
    brandId: null,
    name: '少儿创意绘画启蒙',
    subTitle: '艺术启蒙主打课，支持课程拼课',
    serviceDuration: 60,
    serviceRadius: 12000,
    needBooking: true,
    mainImage: hunanFullImage('service-art-001'),
    attrValues: [
      { attrId: 101, attrName: '班型', value: '小班/一对一' },
      { attrId: 102, attrName: '级别', value: '启蒙/进阶' },
      { attrId: 103, attrName: '课时包', value: '8/16/32课时' },
      { attrId: 104, attrName: '适用年龄', value: '4-8岁' },
    ],
    specs: [
      { name: '班型', values: ['小班', '一对一'] },
      { name: '课时包', values: ['8课时', '16课时'] },
    ],
    skus: [
      sku('hf-service-art-001-sku-1', { 班型: '小班', 课时包: '8课时' }, 980, 320, 899, 36, {
        isPromotionProduct: true,
      }),
      sku('hf-service-art-001-sku-2', { 班型: '小班', 课时包: '16课时' }, 1760, 620, 1620, 24, {
        distRate: 0.9,
      }),
      sku('hf-service-art-001-sku-3', { 班型: '一对一', 课时包: '8课时' }, 1680, 740, 1560, 12, {
        pointsRatio: 50,
      }),
    ],
    isHot: true,
    sort: 210,
  }),
  serviceProduct({
    theme: 'service',
    productId: 'hf-service-piano-001',
    categoryId: 201,
    brandId: null,
    name: '钢琴陪练进阶课',
    subTitle: '一对一高客单样本',
    serviceDuration: 45,
    serviceRadius: 15000,
    needBooking: true,
    mainImage: hunanFullImage('service-piano-001'),
    attrValues: [
      { attrId: 101, attrName: '班型', value: '一对一/双人' },
      { attrId: 102, attrName: '级别', value: '初级/中级' },
      { attrId: 103, attrName: '课时包', value: '8/16课时' },
      { attrId: 104, attrName: '适用年龄', value: '6-14岁' },
    ],
    specs: [
      { name: '班型', values: ['一对一', '双人'] },
      { name: '课时包', values: ['8课时', '16课时'] },
    ],
    skus: [
      sku('hf-service-piano-001-sku-1', { 班型: '一对一', 课时包: '8课时' }, 1980, 860, 1880, 16),
      sku('hf-service-piano-001-sku-2', { 班型: '一对一', 课时包: '16课时' }, 3680, 1580, 3490, 10, {
        distRate: 0.75,
      }),
      sku('hf-service-piano-001-sku-3', { 班型: '双人', 课时包: '8课时' }, 1480, 620, 1390, 8, {
        pointsRatio: 60,
      }),
    ],
    sort: 220,
  }),
  serviceProduct({
    theme: 'service',
    productId: 'hf-service-basketball-001',
    categoryId: 202,
    brandId: null,
    name: '篮球体能训练营',
    subTitle: '体育服务订单样本',
    serviceDuration: 90,
    serviceRadius: 10000,
    needBooking: true,
    mainImage: hunanFullImage('service-basketball-001'),
    attrValues: [
      { attrId: 101, attrName: '班型', value: '周末班/集训班' },
      { attrId: 102, attrName: '级别', value: '启蒙/进阶' },
      { attrId: 103, attrName: '课时包', value: '10/20课时' },
      { attrId: 104, attrName: '适用年龄', value: '7-13岁' },
    ],
    specs: [
      { name: '班型', values: ['周末班', '集训班'] },
      { name: '课时包', values: ['10课时', '20课时'] },
    ],
    skus: [
      sku('hf-service-basketball-001-sku-1', { 班型: '周末班', 课时包: '10课时' }, 1280, 420, 1199, 30),
      sku('hf-service-basketball-001-sku-2', { 班型: '周末班', 课时包: '20课时' }, 2280, 860, 2140, 20, {
        isPromotionProduct: true,
      }),
      sku('hf-service-basketball-001-sku-3', { 班型: '集训班', 课时包: '10课时' }, 1680, 720, 1580, 12, {
        distRate: 0.85,
      }),
    ],
    sort: 230,
  }),
  serviceProduct({
    theme: 'service',
    productId: 'hf-service-swimming-001',
    categoryId: 202,
    brandId: null,
    name: '少儿游泳安全课',
    subTitle: '预约制样本，支持新人专享价',
    serviceDuration: 60,
    serviceRadius: 8000,
    needBooking: true,
    mainImage: hunanFullImage('service-swimming-001'),
    attrValues: [
      { attrId: 101, attrName: '班型', value: '小班/一对二' },
      { attrId: 102, attrName: '级别', value: '启蒙/进阶' },
      { attrId: 103, attrName: '课时包', value: '8/16课时' },
      { attrId: 104, attrName: '适用年龄', value: '5-10岁' },
    ],
    specs: [
      { name: '班型', values: ['小班', '一对二'] },
      { name: '课时包', values: ['8课时', '16课时'] },
    ],
    skus: [
      sku('hf-service-swimming-001-sku-1', { 班型: '小班', 课时包: '8课时' }, 1180, 460, 1099, 20, {
        newcomerPrice: 999,
      }),
      sku('hf-service-swimming-001-sku-2', { 班型: '小班', 课时包: '16课时' }, 2180, 920, 2050, 14),
      sku('hf-service-swimming-001-sku-3', { 班型: '一对二', 课时包: '8课时' }, 1480, 620, 1390, 10, {
        pointsRatio: 60,
      }),
    ],
    sort: 240,
  }),
  serviceProduct({
    theme: 'service',
    productId: 'hf-service-english-001',
    categoryId: 203,
    brandId: null,
    name: '英语启蒙表达课',
    subTitle: '语言课程主推款',
    serviceDuration: 50,
    serviceRadius: 15000,
    needBooking: true,
    mainImage: hunanFullImage('service-english-001'),
    attrValues: [
      { attrId: 101, attrName: '班型', value: '小班/一对一' },
      { attrId: 102, attrName: '级别', value: '启蒙/初级' },
      { attrId: 103, attrName: '课时包', value: '12/24课时' },
      { attrId: 104, attrName: '适用年龄', value: '4-8岁' },
    ],
    specs: [
      { name: '班型', values: ['小班', '一对一'] },
      { name: '课时包', values: ['12课时', '24课时'] },
    ],
    skus: [
      sku('hf-service-english-001-sku-1', { 班型: '小班', 课时包: '12课时' }, 1580, 580, 1490, 26, {
        isPromotionProduct: true,
      }),
      sku('hf-service-english-001-sku-2', { 班型: '小班', 课时包: '24课时' }, 2880, 1160, 2720, 18, {
        distRate: 0.85,
      }),
      sku('hf-service-english-001-sku-3', { 班型: '一对一', 课时包: '12课时' }, 2280, 980, 2160, 8),
    ],
    sort: 250,
  }),
  serviceProduct({
    theme: 'service',
    productId: 'hf-service-spoken-001',
    categoryId: 203,
    brandId: null,
    name: '少儿口才表达周末班',
    subTitle: '可拼课语言服务样本',
    serviceDuration: 75,
    serviceRadius: 12000,
    needBooking: true,
    mainImage: hunanFullImage('service-spoken-001'),
    attrValues: [
      { attrId: 101, attrName: '班型', value: '周末班/寒暑假班' },
      { attrId: 102, attrName: '级别', value: '初级/进阶' },
      { attrId: 103, attrName: '课时包', value: '8/16课时' },
      { attrId: 104, attrName: '适用年龄', value: '6-12岁' },
    ],
    specs: [
      { name: '班型', values: ['周末班', '寒暑假班'] },
      { name: '课时包', values: ['8课时', '16课时'] },
    ],
    skus: [
      sku('hf-service-spoken-001-sku-1', { 班型: '周末班', 课时包: '8课时' }, 1380, 500, 1290, 22),
      sku('hf-service-spoken-001-sku-2', { 班型: '寒暑假班', 课时包: '16课时' }, 2480, 960, 2360, 12, {
        isPromotionProduct: true,
      }),
    ],
    sort: 260,
  }),
  serviceProduct({
    theme: 'service',
    productId: 'hf-service-scratch-001',
    categoryId: 204,
    brandId: null,
    name: 'Scratch 创意编程营',
    subTitle: '科创课程与会员升级联动样本',
    serviceDuration: 90,
    serviceRadius: 15000,
    needBooking: true,
    mainImage: hunanFullImage('service-scratch-001'),
    attrValues: [
      { attrId: 101, attrName: '班型', value: '小班/项目制' },
      { attrId: 102, attrName: '级别', value: '入门/进阶' },
      { attrId: 103, attrName: '课时包', value: '12/24课时' },
      { attrId: 104, attrName: '适用年龄', value: '7-12岁' },
    ],
    specs: [
      { name: '班型', values: ['小班', '项目制'] },
      { name: '课时包', values: ['12课时', '24课时'] },
    ],
    skus: [
      sku('hf-service-scratch-001-sku-1', { 班型: '小班', 课时包: '12课时' }, 1680, 660, 1580, 20, {
        isPromotionProduct: true,
      }),
      sku('hf-service-scratch-001-sku-2', { 班型: '项目制', 课时包: '24课时' }, 3180, 1380, 2990, 10, {
        distRate: 0.8,
      }),
    ],
    sort: 270,
  }),
  serviceProduct({
    theme: 'service',
    productId: 'hf-service-math-001',
    categoryId: 205,
    brandId: null,
    name: '数学思维突破课',
    subTitle: '思维课程，提供高库存容量样本',
    serviceDuration: 60,
    serviceRadius: 15000,
    needBooking: true,
    mainImage: hunanFullImage('service-math-001'),
    attrValues: [
      { attrId: 101, attrName: '班型', value: '小班/强化班' },
      { attrId: 102, attrName: '级别', value: '启蒙/提高' },
      { attrId: 103, attrName: '课时包', value: '16/32课时' },
      { attrId: 104, attrName: '适用年龄', value: '6-11岁' },
    ],
    specs: [
      { name: '班型', values: ['小班', '强化班'] },
      { name: '课时包', values: ['16课时', '32课时'] },
    ],
    skus: [
      sku('hf-service-math-001-sku-1', { 班型: '小班', 课时包: '16课时' }, 1880, 720, 1760, 40),
      sku('hf-service-math-001-sku-2', { 班型: '强化班', 课时包: '32课时' }, 3380, 1460, 3190, 26, {
        pointsRatio: 70,
      }),
    ],
    sort: 280,
  }),
];

export const HUNAN_FULL_PRODUCTS: HunanProductBlueprint[] = [
  ...retailProducts,
  ...instantProducts,
  ...serviceProducts,
];
