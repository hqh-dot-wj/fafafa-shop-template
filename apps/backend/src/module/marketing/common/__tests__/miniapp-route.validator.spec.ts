import { normalizeMiniappRoutePath, normalizeStoredMiniappRoutePathOrDefault } from '../miniapp-route.validator';
import { BusinessException } from 'src/common/exceptions/business.exception';

function parseQuery(path: string): Record<string, string> {
  const queryString = path.split('?')[1] || '';
  if (!queryString) return {};
  return Object.fromEntries(
    queryString
      .split('&')
      .filter(Boolean)
      .map((segment) => {
        const [key, value = ''] = segment.split('=');
        return [decodeURIComponent(key), decodeURIComponent(value)];
      }),
  );
}

describe('miniapp-route.validator', () => {
  it('应标准化拼课场景列表路由', () => {
    const route = normalizeMiniappRoutePath('/pages/product/list?sceneCode=COURSE_GROUP_RECOMMEND&sourceType=SCENE');
    expect(route.path.split('?')[0]).toBe('/pages/product/list');
    expect(parseQuery(route.path)).toEqual({
      sceneCode: 'COURSE_GROUP_RECOMMEND',
      sourceType: 'SCENE',
    });
  });

  it('应标准化新人专享场景路由', () => {
    const route = normalizeMiniappRoutePath('/pages/product/list?sourceType=SCENE&sceneCode=NEWCOMER_EXCLUSIVE');
    expect(route.path.split('?')[0]).toBe('/pages/product/list');
    expect(parseQuery(route.path)).toEqual({
      sceneCode: 'NEWCOMER_EXCLUSIVE',
      sourceType: 'SCENE',
    });
  });

  it('应标准化秒杀场景路由', () => {
    const route = normalizeMiniappRoutePath(
      '/pages/product/list?sceneCode=FLASH_SALE&sourceType=SCENE&activityType=FLASH_SALE',
    );
    expect(route.path.split('?')[0]).toBe('/pages/product/list');
    expect(parseQuery(route.path)).toEqual({
      activityType: 'FLASH_SALE',
      sceneCode: 'FLASH_SALE',
      sourceType: 'SCENE',
    });
  });

  it('广告位路由必须满足必填参数', () => {
    try {
      normalizeMiniappRoutePath('/pages/marketing/detail');
      throw new Error('expect throw');
    } catch (error) {
      expect(error).toBeInstanceOf(BusinessException);
      const message = (error as BusinessException).getResponse() as { msg?: string };
      expect(message.msg).toBe('页面路由缺少必填参数：id');
    }
    const route = normalizeMiniappRoutePath('/pages/marketing/detail?id=activity_1');
    expect(route.path).toBe('/pages/marketing/detail?id=activity_1');
  });

  it('读取持久化旧路由时应回退到默认场景路径', () => {
    const route = normalizeStoredMiniappRoutePathOrDefault(
      '/pages/marketing/flash',
      '/pages/product/list?sourceType=SCENE&sceneCode=FLASH_SALE',
    );

    expect(route).toBe('/pages/product/list?sceneCode=FLASH_SALE&sourceType=SCENE');
  });
});
