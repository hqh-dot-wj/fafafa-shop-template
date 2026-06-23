import { Test, TestingModule } from '@nestjs/testing';
import { BusinessException } from 'src/common/exceptions';
import { ClientLocationService } from './location.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { GeoService } from 'src/module/lbs/geo/geo.service';
import { TenantHelper } from 'src/common/tenant/tenant.helper';
import { GeocodingService } from 'src/module/lbs/geocoding/geocoding.service';

describe('ClientLocationService', () => {
  let service: ClientLocationService;

  const mockGeocoding = {
    reverseGeocode: jest.fn(),
    searchNearbyPlaces: jest.fn(),
  };

  const mockPrisma = {
    sysTenant: {
      findUnique: jest.fn(),
    },
    sysTenantGeo: {
      findMany: jest.fn(),
    },
  };

  const mockGeoService = {
    findStationByPoint: jest.fn(),
  };

  const mockTenantHelper = {
    readWhereForDelegate: (_key: string, w?: object) => w ?? {},
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ClientLocationService,
        {
          provide: PrismaService,
          useValue: mockPrisma,
        },
        {
          provide: GeoService,
          useValue: mockGeoService,
        },
        {
          provide: TenantHelper,
          useValue: mockTenantHelper,
        },
        {
          provide: GeocodingService,
          useValue: mockGeocoding,
        },
      ],
    }).compile();

    service = module.get<ClientLocationService>(ClientLocationService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('matchTenantByLocation', () => {
    it('should throw when station is not matched', async () => {
      mockGeoService.findStationByPoint.mockResolvedValue(null);

      await expect(service.matchTenantByLocation(30, 104)).rejects.toThrow(BusinessException);
    });

    it('should throw when tenant is inactive', async () => {
      mockGeoService.findStationByPoint.mockResolvedValue({
        stationId: 1,
        name: 'test',
        tenantId: 'tenant1',
      });
      mockPrisma.sysTenant.findUnique.mockResolvedValue({
        tenantId: 'tenant1',
        companyName: 'test tenant',
        status: 'STOP',
      });

      await expect(service.matchTenantByLocation(30, 104)).rejects.toThrow(BusinessException);
      try {
        await service.matchTenantByLocation(30, 104);
      } catch (error) {
        const response = (error as any).getResponse();
        expect(response.msg).toBe('服务商家暂不可用');
      }
    });

    it('should return tenant info when station and tenant are valid', async () => {
      mockGeoService.findStationByPoint.mockResolvedValue({
        stationId: 1,
        name: 'test',
        tenantId: 'tenant1',
      });
      mockPrisma.sysTenant.findUnique.mockResolvedValue({
        tenantId: 'tenant1',
        companyName: 'test tenant',
        status: 'NORMAL',
      });

      const result = await service.matchTenantByLocation(30, 104);
      expect(result).toEqual({
        tenantId: 'tenant1',
        companyName: 'test tenant',
      });
    });
  });

  describe('reverseGeocode', () => {
    it('应委托 GeocodingService 并原样返回', async () => {
      mockGeocoding.reverseGeocode.mockResolvedValue('湖南省长沙市');

      const result = await service.reverseGeocode(28.2, 113.0);

      expect(mockGeocoding.reverseGeocode).toHaveBeenCalledWith(28.2, 113.0);
      expect(result).toEqual({ formattedAddress: '湖南省长沙市' });
    });
  });

  describe('getNearbyPlaceSuggestions', () => {
    it('应委托 GeocodingService.searchNearbyPlaces 并包装为 list', async () => {
      mockGeocoding.searchNearbyPlaces.mockResolvedValue([
        {
          id: 'x',
          fullAddress: '测试点',
          latitude: 28,
          longitude: 113,
          distanceMeters: 10,
        },
      ]);

      const result = await service.getNearbyPlaceSuggestions(28.1, 113.1, 5);

      expect(mockGeocoding.searchNearbyPlaces).toHaveBeenCalledWith(28.1, 113.1, {
        radiusMeters: 5000,
        limit: 5,
      });
      expect(result.list).toHaveLength(1);
      expect(result.list[0].id).toBe('x');
    });
  });

  describe('evaluateLocationDrift', () => {
    it('租户变化且超阈值时 shouldSwitch=true', async () => {
      mockGeoService.findStationByPoint.mockResolvedValue({
        stationId: 2,
        name: 's2',
        tenantId: 'T2',
      });
      mockPrisma.sysTenant.findUnique.mockResolvedValue({
        tenantId: 'T2',
        companyName: '公司B',
        status: 'NORMAL',
        delFlag: 'NORMAL',
        geoConfig: { serviceRadius: 3000 },
      });

      const result = await service.evaluateLocationDrift({
        lat: 31.2415,
        lng: 121.45,
        lastTenantId: 'T1',
        lastConfirmedLat: 31.22,
        lastConfirmedLng: 121.45,
        lastEvaluatedAt: Date.now() - 20 * 60 * 1000,
      });

      expect(result.cooldownHit).toBe(false);
      expect(result.shouldSwitch).toBe(true);
      expect(result.reason).toBe('TENANT_CHANGED_AND_DISTANCE_EXCEEDED');
      expect(result.matchedTenant).toEqual({ tenantId: 'T2', companyName: '公司B' });
      expect(result.distanceMeters).toBeGreaterThan(result.dynamicThresholdMeters);
    });

    it('命中时间窗时 cooldownHit=true 且 shouldSwitch=false', async () => {
      mockGeoService.findStationByPoint.mockResolvedValue({
        stationId: 2,
        name: 's2',
        tenantId: 'T2',
      });
      mockPrisma.sysTenant.findUnique.mockResolvedValue({
        tenantId: 'T2',
        companyName: '公司B',
        status: 'NORMAL',
        delFlag: 'NORMAL',
        geoConfig: { serviceRadius: 3000 },
      });

      const result = await service.evaluateLocationDrift({
        lat: 31.2415,
        lng: 121.45,
        lastTenantId: 'T1',
        lastConfirmedLat: 31.22,
        lastConfirmedLng: 121.45,
        lastEvaluatedAt: Date.now() - 60_000,
      });

      expect(result.cooldownHit).toBe(true);
      expect(result.shouldSwitch).toBe(false);
      expect(result.reason).toBe('COOLDOWN_ACTIVE');
    });

    it('租户不变且未超阈值时 shouldSwitch=false', async () => {
      mockGeoService.findStationByPoint.mockResolvedValue({
        stationId: 1,
        name: 's1',
        tenantId: 'T1',
      });
      mockPrisma.sysTenant.findUnique.mockResolvedValue({
        tenantId: 'T1',
        companyName: '公司A',
        status: 'NORMAL',
        delFlag: 'NORMAL',
        geoConfig: { serviceRadius: 3000 },
      });

      const result = await service.evaluateLocationDrift({
        lat: 31.221,
        lng: 121.451,
        lastTenantId: 'T1',
        lastConfirmedLat: 31.22,
        lastConfirmedLng: 121.45,
        lastEvaluatedAt: Date.now() - 20 * 60 * 1000,
      });

      expect(result.cooldownHit).toBe(false);
      expect(result.shouldSwitch).toBe(false);
      expect(result.reason).toBe('TENANT_UNCHANGED');
    });
  });
});
