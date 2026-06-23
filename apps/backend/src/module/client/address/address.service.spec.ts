import { Test, TestingModule } from '@nestjs/testing';
import { AddressService } from './address.service';
import { AddressRepository } from './address.repository';
import { GeocodingService } from 'src/module/lbs/geocoding/geocoding.service';
import { BusinessException } from 'src/common/exceptions';

describe('AddressService', () => {
  let service: AddressService;
  let addressRepo: jest.Mocked<
    Pick<
      AddressRepository,
      'count' | 'clearDefault' | 'create' | 'findOne' | 'update' | 'delete' | 'findFirst' | 'findMany' | 'findDefault'
    >
  >;
  let geocoding: jest.Mocked<Pick<GeocodingService, 'geocodeStructuredAddress'>>;

  beforeEach(async () => {
    addressRepo = {
      count: jest.fn(),
      clearDefault: jest.fn(),
      create: jest.fn(),
      findOne: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      findDefault: jest.fn(),
    };
    geocoding = { geocodeStructuredAddress: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AddressService,
        { provide: AddressRepository, useValue: addressRepo },
        { provide: GeocodingService, useValue: geocoding },
      ],
    }).compile();

    service = module.get(AddressService);
  });

  const baseDto = {
    name: '张三',
    phone: '13800138000',
    province: '湖南省',
    city: '长沙市',
    district: '岳麓区',
    detail: '麓谷大道1号',
    isDefault: false,
  };

  it('创建地址且无坐标时应调用地理编码并写入结果', async () => {
    addressRepo.count.mockResolvedValue(0);
    geocoding.geocodeStructuredAddress.mockResolvedValue({ latitude: 28.1, longitude: 112.9 });
    addressRepo.create.mockResolvedValue({
      id: 'addr-1',
      memberId: 'm1',
      ...baseDto,
      latitude: 28.1,
      longitude: 112.9,
      isDefault: true,
      tag: null,
      createTime: new Date(),
      updateTime: new Date(),
    } as never);

    await service.createAddress('m1', baseDto);

    expect(geocoding.geocodeStructuredAddress).toHaveBeenCalledWith({
      province: '湖南省',
      city: '长沙市',
      district: '岳麓区',
      detail: '麓谷大道1号',
    });
    expect(addressRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ latitude: 28.1, longitude: 112.9 }),
    );
  });

  it('创建地址若请求体已带坐标应跳过地理编码', async () => {
    addressRepo.count.mockResolvedValue(0);
    addressRepo.create.mockResolvedValue({
      id: 'addr-1',
      memberId: 'm1',
      ...baseDto,
      latitude: 1,
      longitude: 2,
      isDefault: true,
      tag: null,
      createTime: new Date(),
      updateTime: new Date(),
    } as never);

    await service.createAddress('m1', { ...baseDto, latitude: 1, longitude: 2 });

    expect(geocoding.geocodeStructuredAddress).not.toHaveBeenCalled();
    expect(addressRepo.create).toHaveBeenCalledWith(expect.objectContaining({ latitude: 1, longitude: 2 }));
  });

  it('更新地址且文案未变时应保留原坐标且不请求地理编码', async () => {
    addressRepo.findOne.mockResolvedValue({
      id: 'a1',
      memberId: 'm1',
      ...baseDto,
      latitude: 30,
      longitude: 120,
      isDefault: true,
      tag: null,
      createTime: new Date(),
      updateTime: new Date(),
    } as never);
    addressRepo.update.mockResolvedValue({
      id: 'a1',
      memberId: 'm1',
      ...baseDto,
      latitude: 30,
      longitude: 120,
      isDefault: true,
      tag: null,
      createTime: new Date(),
      updateTime: new Date(),
    } as never);

    await service.updateAddress('m1', { ...baseDto, id: 'a1', isDefault: true });

    expect(geocoding.geocodeStructuredAddress).not.toHaveBeenCalled();
    expect(addressRepo.update).toHaveBeenCalledWith(
      'a1',
      expect.objectContaining({ latitude: 30, longitude: 120 }),
    );
  });

  it('更新地址且文案变更时应重新地理编码', async () => {
    addressRepo.findOne.mockResolvedValue({
      id: 'a1',
      memberId: 'm1',
      ...baseDto,
      latitude: 30,
      longitude: 120,
      isDefault: true,
      tag: null,
      createTime: new Date(),
      updateTime: new Date(),
    } as never);
    geocoding.geocodeStructuredAddress.mockResolvedValue({ latitude: 31, longitude: 121 });
    addressRepo.update.mockResolvedValue({
      id: 'a1',
      memberId: 'm1',
      ...baseDto,
      detail: '新门牌',
      latitude: 31,
      longitude: 121,
      isDefault: true,
      tag: null,
      createTime: new Date(),
      updateTime: new Date(),
    } as never);

    await service.updateAddress('m1', { ...baseDto, id: 'a1', detail: '新门牌', isDefault: true });

    expect(geocoding.geocodeStructuredAddress).toHaveBeenCalled();
    expect(addressRepo.update).toHaveBeenCalledWith(
      'a1',
      expect.objectContaining({ latitude: 31, longitude: 121 }),
    );
  });

  it('更新地址地理编码失败时应保留旧坐标', async () => {
    addressRepo.findOne.mockResolvedValue({
      id: 'a1',
      memberId: 'm1',
      ...baseDto,
      latitude: 30,
      longitude: 120,
      isDefault: true,
      tag: null,
      createTime: new Date(),
      updateTime: new Date(),
    } as never);
    geocoding.geocodeStructuredAddress.mockResolvedValue(null);
    addressRepo.update.mockResolvedValue({
      id: 'a1',
      memberId: 'm1',
      ...baseDto,
      detail: '新门牌',
      latitude: 30,
      longitude: 120,
      isDefault: true,
      tag: null,
      createTime: new Date(),
      updateTime: new Date(),
    } as never);

    await service.updateAddress('m1', { ...baseDto, id: 'a1', detail: '新门牌', isDefault: true });

    expect(addressRepo.update).toHaveBeenCalledWith(
      'a1',
      expect.objectContaining({ latitude: 30, longitude: 120 }),
    );
  });

  it('超过地址上限应拒绝创建', async () => {
    addressRepo.count.mockResolvedValue(20);

    await expect(service.createAddress('m1', baseDto)).rejects.toThrow(BusinessException);
  });
});
