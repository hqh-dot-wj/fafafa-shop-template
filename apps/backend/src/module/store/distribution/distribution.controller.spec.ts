/**
 * 校验分销 Controller 与种子菜单权限码一致（以代码为事实源）。
 */
import { DistributionController } from './distribution.controller';

describe('DistributionController - @RequirePermission', () => {
  const expectedPermissions: Record<string, string> = {
    getConfig: 'store:distribution:config:query',
    updateConfig: 'store:distribution:config:edit',
    getConfigLogs: 'store:distribution:config:query',
    getCommissionPreview: 'store:distribution:commission:preview',
    getSharePolicy: 'store:distribution:share:policy:query',
    updateSharePolicy: 'store:distribution:share:policy:edit',
    createShareToken: 'store:distribution:share:token:create',
    createShareTokenQrcode: 'store:distribution:share:token:create',
    getShareTokenLogs: 'store:distribution:share:token:query',
    getDashboard: 'store:distribution:dashboard:query',
    createLevel: 'store:distribution:level:create',
    updateLevel: 'store:distribution:level:update',
    deleteLevel: 'store:distribution:level:delete',
    getLevelList: 'store:distribution:level:list',
    getLevel: 'store:distribution:level:query',
    updateMemberLevel: 'store:distribution:member-level:edit',
    getMemberLevelLogs: 'store:distribution:member-level:query',
    checkLevelUpgrade: 'store:distribution:member-level:query',
    listApplications: 'store:distribution:application:list',
    reviewApplication: 'store:distribution:application:review',
    batchReview: 'store:distribution:application:review',
    getReviewConfig: 'store:distribution:application:config:query',
    updateReviewConfig: 'store:distribution:application:config:edit',
  };

  for (const [method, permission] of Object.entries(expectedPermissions)) {
    it(`${method} 应有 @RequirePermission('${permission}')`, () => {
      const metadata = Reflect.getMetadata('permission', DistributionController.prototype[method]);
      expect(metadata).toBe(permission);
    });
  }

  it('端点数量与权限表一致', () => {
    expect(Object.keys(expectedPermissions)).toHaveLength(23);
  });
});
