import { Test, TestingModule } from '@nestjs/testing';
import { GrayReleaseService, GrayReleaseConfig } from './gray-release.service';
import { StorePlayConfig } from '@prisma/client';

describe('GrayReleaseService', () => {
  let service: GrayReleaseService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [GrayReleaseService],
    }).compile();

    service = module.get<GrayReleaseService>(GrayReleaseService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('isInGrayRelease', () => {
    /**
     * 娴嬭瘯鍦烘櫙1: 鏈惎鐢ㄧ伆搴?     * 棰勬湡: 鎵€鏈夌敤鎴烽兘鍙互鍙備笌娲诲姩
     */
    it('should return true when gray release is not enabled', async () => {
      const config = {
        id: 'config-1',
        grayRelease: {
          enabled: false,
          whitelistUserIds: [],
          whitelistTenantIds: [],
          percentage: 0,
        },
      } as unknown as StorePlayConfig;

      const result = await service.isInGrayRelease(config, 'user-1', 'store-1');
      expect(result).toBe(true);
    });

    /**
     * 娴嬭瘯鍦烘櫙2: 鏈厤缃伆搴︼紙grayRelease 涓?null锛?     * 棰勬湡: 鎵€鏈夌敤鎴烽兘鍙互鍙備笌娲诲姩
     */
    it('should return true when gray release config is null', async () => {
      const config = {
        id: 'config-1',
        grayRelease: null,
      } as unknown as StorePlayConfig;

      const result = await service.isInGrayRelease(config, 'user-1', 'store-1');
      expect(result).toBe(true);
    });

    /**
     * 娴嬭瘯鍦烘櫙3: 鐧藉悕鍗曠敤鎴?     * 棰勬湡: 鐧藉悕鍗曚腑鐨勭敤鎴峰彲浠ュ弬涓庢椿鍔?     */
    it('should return true for whitelisted users', async () => {
      const config = {
        id: 'config-1',
        grayRelease: {
          enabled: true,
          whitelistUserIds: ['user-1', 'user-2'],
          whitelistTenantIds: [],
          percentage: 0,
        },
      } as unknown as StorePlayConfig;

      const result = await service.isInGrayRelease(config, 'user-1', 'store-1');
      expect(result).toBe(true);
    });

    /**
     * 娴嬭瘯鍦烘櫙4: 闈炵櫧鍚嶅崟鐢ㄦ埛
     * 棰勬湡: 闈炵櫧鍚嶅崟鐢ㄦ埛涓嶈兘鍙備笌娲诲姩锛堢伆搴︽瘮渚嬩负0锛?     */
    it('should return false for non-whitelisted users when percentage is 0', async () => {
      const config = {
        id: 'config-1',
        grayRelease: {
          enabled: true,
          whitelistUserIds: ['user-2'],
          whitelistTenantIds: [],
          percentage: 0,
        },
      } as unknown as StorePlayConfig;

      const result = await service.isInGrayRelease(config, 'user-1', 'store-1');
      expect(result).toBe(false);
    });

    /**
     * 娴嬭瘯鍦烘櫙5: 鐧藉悕鍗曢棬搴?     * 棰勬湡: 鐧藉悕鍗曢棬搴楃殑鎵€鏈夌敤鎴烽兘鍙互鍙備笌娲诲姩
     */
    it('should return true for users in whitelisted stores', async () => {
      const config = {
        id: 'config-1',
        grayRelease: {
          enabled: true,
          whitelistUserIds: [],
          whitelistTenantIds: ['store-1', 'store-2'],
          percentage: 0,
        },
      } as unknown as StorePlayConfig;

      const result = await service.isInGrayRelease(config, 'user-1', 'store-1');
      expect(result).toBe(true);
    });

    it('should keep supporting legacy whitelistStoreIds config', async () => {
      const config = {
        id: 'config-1',
        grayRelease: {
          enabled: true,
          whitelistUserIds: [],
          whitelistStoreIds: ['tenant-legacy'],
          percentage: 0,
        },
      } as unknown as StorePlayConfig;

      const result = await service.isInGrayRelease(config, 'user-1', 'tenant-legacy');
      expect(result).toBe(true);
    });

    /**
     * 娴嬭瘯鍦烘櫙6: 闈炵櫧鍚嶅崟闂ㄥ簵
     * 棰勬湡: 闈炵櫧鍚嶅崟闂ㄥ簵鐨勭敤鎴蜂笉鑳藉弬涓庢椿鍔紙鐏板害姣斾緥涓?锛?     */
    it('should return false for users in non-whitelisted stores when percentage is 0', async () => {
      const config = {
        id: 'config-1',
        grayRelease: {
          enabled: true,
          whitelistUserIds: [],
          whitelistTenantIds: ['store-2'],
          percentage: 0,
        },
      } as unknown as StorePlayConfig;

      const result = await service.isInGrayRelease(config, 'user-1', 'store-1');
      expect(result).toBe(false);
    });

    /**
     * 娴嬭瘯鍦烘櫙7: 鎸夋瘮渚嬬伆搴︼紙100%锛?     * 棰勬湡: 鎵€鏈夌敤鎴烽兘鍙互鍙備笌娲诲姩
     */
    it('should return true for all users when percentage is 100', async () => {
      const config = {
        id: 'config-1',
        grayRelease: {
          enabled: true,
          whitelistUserIds: [],
          whitelistTenantIds: [],
          percentage: 100,
        },
      } as unknown as StorePlayConfig;

      // 娴嬭瘯澶氫釜鐢ㄦ埛
      const users = ['user-1', 'user-2', 'user-3', 'user-4', 'user-5'];
      for (const userId of users) {
        const result = await service.isInGrayRelease(config, userId, 'store-1');
        expect(result).toBe(true);
      }
    });

    /**
     * 娴嬭瘯鍦烘櫙8: 鎸夋瘮渚嬬伆搴︼紙0%锛?     * 棰勬湡: 鎵€鏈夌敤鎴烽兘涓嶈兘鍙備笌娲诲姩
     */
    it('should return false for all users when percentage is 0', async () => {
      const config = {
        id: 'config-1',
        grayRelease: {
          enabled: true,
          whitelistUserIds: [],
          whitelistTenantIds: [],
          percentage: 0,
        },
      } as unknown as StorePlayConfig;

      // 娴嬭瘯澶氫釜鐢ㄦ埛
      const users = ['user-1', 'user-2', 'user-3', 'user-4', 'user-5'];
      for (const userId of users) {
        const result = await service.isInGrayRelease(config, userId, 'store-1');
        expect(result).toBe(false);
      }
    });

    /**
     * 娴嬭瘯鍦烘櫙9: 鍝堝笇绠楁硶绋冲畾鎬?     * 棰勬湡: 鐩稿悓鐢ㄦ埛ID澶氭璋冪敤杩斿洖鐩稿悓缁撴灉
     */
    it('should return consistent results for the same user', async () => {
      const config = {
        id: 'config-1',
        grayRelease: {
          enabled: true,
          whitelistUserIds: [],
          whitelistTenantIds: [],
          percentage: 50,
        },
      } as unknown as StorePlayConfig;

      const result1 = await service.isInGrayRelease(config, 'user-1', 'store-1');
      const result2 = await service.isInGrayRelease(config, 'user-1', 'store-1');
      const result3 = await service.isInGrayRelease(config, 'user-1', 'store-1');

      expect(result1).toBe(result2);
      expect(result2).toBe(result3);
    });

    /**
     * 娴嬭瘯鍦烘櫙10: 浼樺厛绾ф祴璇曪紙鐧藉悕鍗曠敤鎴?> 鐏板害姣斾緥锛?     * 棰勬湡: 鐧藉悕鍗曠敤鎴峰嵆浣垮搱甯屽€间笉鍦ㄧ伆搴﹁寖鍥村唴涔熷彲浠ュ弬涓?     */
    it('should prioritize whitelist over percentage', async () => {
      const config = {
        id: 'config-1',
        grayRelease: {
          enabled: true,
          whitelistUserIds: ['user-1'],
          whitelistTenantIds: [],
          percentage: 0, // 鐏板害姣斾緥涓?
        },
      } as unknown as StorePlayConfig;

      const result = await service.isInGrayRelease(config, 'user-1', 'store-1');
      expect(result).toBe(true);
    });

    /**
     * 娴嬭瘯鍦烘櫙11: 浼樺厛绾ф祴璇曪紙鐧藉悕鍗曢棬搴?> 鐏板害姣斾緥锛?     * 棰勬湡: 鐧藉悕鍗曢棬搴楃殑鐢ㄦ埛鍗充娇鍝堝笇鍊间笉鍦ㄧ伆搴﹁寖鍥村唴涔熷彲浠ュ弬涓?     */
    it('should prioritize store whitelist over percentage', async () => {
      const config = {
        id: 'config-1',
        grayRelease: {
          enabled: true,
          whitelistUserIds: [],
          whitelistTenantIds: ['store-1'],
          percentage: 0, // 鐏板害姣斾緥涓?
        },
      } as unknown as StorePlayConfig;

      // 鐧藉悕鍗曢棬搴楃殑鐢ㄦ埛搴旇鍙互鍙備笌
      const result = await service.isInGrayRelease(config, 'user-1', 'store-1');
      expect(result).toBe(true);
    });
  });

  describe('getGrayConfig', () => {
    /**
     * 娴嬭瘯鑾峰彇鐏板害閰嶇疆
     */
    it('should return gray config when it exists', () => {
      const grayConfig: GrayReleaseConfig = {
        enabled: true,
        whitelistUserIds: ['user-1'],
        whitelistTenantIds: ['store-1'],
        percentage: 50,
      };

      const config = {
        id: 'config-1',
        grayRelease: grayConfig,
      } as unknown as StorePlayConfig;

      const result = service.getGrayConfig(config);
      expect(result).toEqual(grayConfig);
    });

    /**
     * 娴嬭瘯鑾峰彇榛樿鐏板害閰嶇疆
     */
    it('should return default config when gray config is null', () => {
      const config = {
        id: 'config-1',
        grayRelease: null,
      } as unknown as StorePlayConfig;

      const result = service.getGrayConfig(config);
      expect(result).toEqual({
        enabled: false,
        whitelistUserIds: [],
        whitelistTenantIds: [],
        percentage: 0,
      });
    });
  });

  describe('validateGrayConfig', () => {
    /**
     * 娴嬭瘯鍚堟硶鐨勭伆搴﹂厤缃?     */
    it('should not throw error for valid config', () => {
      const config: GrayReleaseConfig = {
        enabled: true,
        whitelistUserIds: ['user-1'],
        whitelistTenantIds: ['store-1'],
        percentage: 50,
      };

      expect(() => service.validateGrayConfig(config)).not.toThrow();
    });

    /**
     * 娴嬭瘯鐏板害姣斾緥瓒呭嚭鑼冨洿锛堣礋鏁帮級
     */
    it('should throw error when percentage is negative', () => {
      const config: GrayReleaseConfig = {
        enabled: true,
        whitelistUserIds: [],
        whitelistTenantIds: [],
        percentage: -10,
      };

      expect(() => service.validateGrayConfig(config)).toThrow('灰度比例必须在 0-100 之间');
    });

    /**
     * 娴嬭瘯鐏板害姣斾緥瓒呭嚭鑼冨洿锛堝ぇ浜?00锛?     */
    it('should throw error when percentage is greater than 100', () => {
      const config: GrayReleaseConfig = {
        enabled: true,
        whitelistUserIds: [],
        whitelistTenantIds: [],
        percentage: 150,
      };

      expect(() => service.validateGrayConfig(config)).toThrow('灰度比例必须在 0-100 之间');
    });

    /**
     * 娴嬭瘯鐧藉悕鍗曠敤鎴蜂笉鏄暟缁?     */
    it('should throw error when whitelistUserIds is not an array', () => {
      const config = {
        enabled: true,
        whitelistUserIds: 'user-1', // 涓嶆槸鏁扮粍
        whitelistTenantIds: [],
        percentage: 50,
      } as any;

      expect(() => service.validateGrayConfig(config)).toThrow('whitelistUserIds 必须是数组');
    });

    /**
     * 娴嬭瘯鐧藉悕鍗曢棬搴椾笉鏄暟缁?     */
    it('should throw error when whitelistTenantIds is not an array', () => {
      const config = {
        enabled: true,
        whitelistUserIds: [],
        whitelistTenantIds: 'store-1', // 涓嶆槸鏁扮粍
        percentage: 50,
      } as any;

      expect(() => service.validateGrayConfig(config)).toThrow('whitelistTenantIds 必须是数组');
    });

    /**
     * 娴嬭瘯杈圭晫鍊硷紙0%锛?     */
    it('should not throw error for percentage 0', () => {
      const config: GrayReleaseConfig = {
        enabled: true,
        whitelistUserIds: [],
        whitelistTenantIds: [],
        percentage: 0,
      };

      expect(() => service.validateGrayConfig(config)).not.toThrow();
    });

    /**
     * 娴嬭瘯杈圭晫鍊硷紙100%锛?     */
    it('should not throw error for percentage 100', () => {
      const config: GrayReleaseConfig = {
        enabled: true,
        whitelistUserIds: [],
        whitelistTenantIds: [],
        percentage: 100,
      };

      expect(() => service.validateGrayConfig(config)).not.toThrow();
    });
  });
});

