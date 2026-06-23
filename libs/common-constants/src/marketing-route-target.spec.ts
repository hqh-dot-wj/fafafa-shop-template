import { describe, expect, it } from 'vitest';
import { MARKETING_ROUTE_TARGETS, buildMarketingRoutePath, parseMarketingRoutePath } from './marketing-route-target';

describe('marketing-route-target', () => {
  it('应维护稳定的路由白名单', () => {
    const keys = MARKETING_ROUTE_TARGETS.map((item) => item.key);
    expect(keys).toContain('product_detail');
    expect(keys).toContain('product_list');
    expect(keys).toContain('marketing_detail');
  });

  it('应根据目标和参数构建规范路径', () => {
    const path = buildMarketingRoutePath('product_detail', {
      id: 'p_1001',
      entrySource: 'home_banner',
    });
    expect(path).toBe('/pages/product/detail?id=p_1001&entrySource=home_banner');
  });

  it('应能解析并标准化场景商品列表路径', () => {
    const result = parseMarketingRoutePath('/pages/product/list?sceneCode=FLASH_SALE&sourceType=SCENE');
    expect(result.valid).toBe(true);
    expect(result.targetKey).toBe('product_list');
    expect(result.normalizedPath).toBe('/pages/product/list?sourceType=SCENE&sceneCode=FLASH_SALE');
  });

  it('应拒绝白名单外路径', () => {
    const result = parseMarketingRoutePath('/pages/unknown/path?foo=1');
    expect(result.valid).toBe(false);
    expect(result.reason).toBe('路由不在营销白名单');
  });

  it('应校验必填参数', () => {
    const result = parseMarketingRoutePath('/pages/product/detail');
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('缺少必填参数');
  });

  it('拼课组队页缺少 productId 时应校验失败', () => {
    const result = parseMarketingRoutePath('/pages/course-group/teams?activityContextKey=COURSE_GROUP_BUY:cfg1');
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('缺少必填参数');
  });

  it('拼课组队页传入 productId 时应校验通过', () => {
    const result = parseMarketingRoutePath(
      '/pages/course-group/teams?productId=prod1&activityContextKey=COURSE_GROUP_BUY:cfg1',
    );
    expect(result.valid).toBe(true);
    expect(result.params.productId).toBe('prod1');
  });

  it('buildMarketingRoutePath 应为拼课组队页含 productId 的路径', () => {
    const path = buildMarketingRoutePath('course_group_teams', { productId: 'prod1', teamId: 'team1' });
    expect(path).toBe('/pages/course-group/teams?productId=prod1&teamId=team1');
  });
});
