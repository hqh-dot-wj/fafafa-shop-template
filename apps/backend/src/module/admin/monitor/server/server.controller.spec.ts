import { ServerController } from './server.controller';

describe('ServerController - @RequirePermission', () => {
  it('getInfo 应有 monitor:server:list', () => {
    expect(Reflect.getMetadata('permission', ServerController.prototype.getInfo)).toBe('monitor:server:list');
  });
});
