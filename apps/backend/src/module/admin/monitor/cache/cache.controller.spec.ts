import { CacheController } from './cache.controller';

describe('CacheController - @RequirePermission', () => {
  const methods = ['getInfo', 'getNames', 'getKeys', 'getValue', 'clearCacheName', 'clearCacheKey', 'clearCacheAll'];

  for (const method of methods) {
    it(`${method} 应有 monitor:cache:list`, () => {
      expect(Reflect.getMetadata('permission', CacheController.prototype[method])).toBe('monitor:cache:list');
    });
  }
});
