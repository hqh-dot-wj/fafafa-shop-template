import { Test, TestingModule } from '@nestjs/testing';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { of, throwError } from 'rxjs';
import { GeocodingService } from './geocoding.service';

describe('GeocodingService', () => {
  let service: GeocodingService;
  let http: jest.Mocked<Pick<HttpService, 'get'>>;
  let config: jest.Mocked<Pick<ConfigService, 'get'>>;

  beforeEach(async () => {
    http = { get: jest.fn() };
    config = { get: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GeocodingService,
        { provide: HttpService, useValue: http },
        { provide: ConfigService, useValue: config },
      ],
    }).compile();

    service = module.get(GeocodingService);
  });

  it('未配置 Key 时应返回 null', async () => {
    config.get.mockReturnValue(undefined);

    const r = await service.geocodeStructuredAddress({
      province: '湖南省',
      city: '长沙市',
      district: '岳麓区',
      detail: '麓谷大道',
    });

    expect(r).toBeNull();
    expect(http.get).not.toHaveBeenCalled();
  });

  it('高德返回成功时应解析 location 为经纬度', async () => {
    config.get.mockReturnValue('test-key');
    http.get.mockReturnValue(
      of({
        data: {
          status: '1',
          geocodes: [{ location: '112.123456,28.654321' }],
        },
      }) as never,
    );

    const r = await service.geocodeStructuredAddress({
      province: '湖南省',
      city: '长沙市',
      district: '岳麓区',
      detail: '麓谷大道',
    });

    expect(r).toEqual({ latitude: 28.654321, longitude: 112.123456 });
  });

  it('请求异常时应返回 null', async () => {
    config.get.mockReturnValue('test-key');
    http.get.mockReturnValue(throwError(() => new Error('network')) as never);

    const r = await service.geocodeStructuredAddress({
      province: '湖南省',
      city: '长沙市',
      district: '岳麓区',
      detail: '麓谷大道',
    });

    expect(r).toBeNull();
  });

  describe('reverseGeocode', () => {
    it('逆地理成功时应返回格式化地址', async () => {
      config.get.mockReturnValue('test-key');
      http.get.mockReturnValue(
        of({
          data: {
            status: '1',
            regeocode: { formatted_address: '湖南省长沙市开福区某某路' },
          },
        }) as never,
      );

      const r = await service.reverseGeocode(28.22, 112.98);
      expect(r).toBe('湖南省长沙市开福区某某路');
      expect(http.get).toHaveBeenCalledWith(
        'https://restapi.amap.com/v3/geocode/regeo',
        expect.objectContaining({
          params: expect.objectContaining({ location: '112.98,28.22' }),
        }),
      );
    });

    it('无 Key 时逆地理应返回 null', async () => {
      config.get.mockReturnValue(undefined);
      const r = await service.reverseGeocode(28, 113);
      expect(r).toBeNull();
    });
  });

  describe('searchNearbyPlaces', () => {
    it('无 Key 时应返回空数组', async () => {
      config.get.mockReturnValue(undefined);
      const r = await service.searchNearbyPlaces(28, 113, { radiusMeters: 5000, limit: 5 });
      expect(r).toEqual([]);
      expect(http.get).not.toHaveBeenCalled();
    });

    it('高德返回 POI 时应解析为列表', async () => {
      config.get.mockReturnValue('k');
      http.get.mockReturnValue(
        of({
          data: {
            status: '1',
            pois: [
              {
                id: 'p1',
                name: '某某小区',
                address: '岳麓区麓谷大道1号',
                location: '112.9,28.2',
                distance: '88',
              },
            ],
          },
        }) as never,
      );

      const r = await service.searchNearbyPlaces(28.19, 112.89, { radiusMeters: 5000, limit: 5 });
      expect(r).toHaveLength(1);
      expect(r[0]).toMatchObject({
        id: 'p1',
        fullAddress: '某某小区 岳麓区麓谷大道1号',
        latitude: 28.2,
        longitude: 112.9,
        distanceMeters: 88,
      });
    });
  });
});
