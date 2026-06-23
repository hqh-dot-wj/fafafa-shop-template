import { Controller, Post, Get, Body, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Api } from 'src/common/decorators/api.decorator';
import { ClientLocationService } from './location.service';
import { EvaluateLocationDriftDto, MatchTenantDto, NearbyPlacesQueryDto, NearbyTenantsQueryDto } from './dto';
import {
  EvaluateLocationDriftVo,
  MatchTenantVo,
  NearbyPlacesListVo,
  NearbyTenantVo,
  ReverseGeocodeVo,
} from './vo';
import { Result } from 'src/common/response';
import { IgnoreTenant } from 'src/common/tenant/tenant.decorator';

@ApiTags('C端-位置服务')
@Controller('client/location')
export class ClientLocationController {
  constructor(private readonly locationService: ClientLocationService) {}

  /**
   * 根据坐标匹配归属租户
   */
  @Api({ summary: '根据坐标匹配归属租户', type: MatchTenantVo })
  /**
   * @sloCategory core
   * @sloLatency P99 < 500ms
   * @sloAvailability 99.9%
   */
  @IgnoreTenant()
  @Post('match-tenant')
  async matchTenant(@Body() dto: MatchTenantDto) {
    const result = await this.locationService.matchTenantByLocation(dto.lat, dto.lng);
    return Result.ok(result);
  }

  /**
   * 判定当前定位相对上次确认是否构成「显著漂移」，并输出动态阈值与冷却状态
   */
  @Api({ summary: '位置漂移判定（无感切换建议）', type: EvaluateLocationDriftVo })
  @IgnoreTenant()
  @Post('evaluate-drift')
  async evaluateDrift(@Body() dto: EvaluateLocationDriftDto) {
    const result = await this.locationService.evaluateLocationDrift(dto);
    return Result.ok(result);
  }

  /**
   * 获取附近租户列表 (用于手动切换)
   */
  @Api({ summary: '获取附近租户列表', type: NearbyTenantVo, isArray: true })
  /**
   * @sloCategory list
   * @sloLatency P99 < 1000ms
   * @sloAvailability 99.5%
   */
  @IgnoreTenant()
  @Get('nearby-tenants')
  async getNearbyTenants(@Query() query: NearbyTenantsQueryDto) {
    const result = await this.locationService.getNearbyTenants(query.lat, query.lng);
    return Result.ok(result);
  }

  /**
   * 逆地理编码：经纬度 → 展示用地址（高德）
   */
  @Api({ summary: '逆地理编码（坐标转地址文案）', type: ReverseGeocodeVo })
  /**
   * @sloCategory list
   * @sloLatency P99 < 1000ms
   */
  @IgnoreTenant()
  @Get('reverse-geocode')
  async reverseGeocode(@Query() query: NearbyTenantsQueryDto) {
    const result = await this.locationService.reverseGeocode(query.lat, query.lng);
    return Result.ok(result);
  }

  /**
   * 周边 POI 推荐（高德 place/around，五公里内最近若干条），**非**用户已保存收货地址
   *
   * @tenantScope TenantAgnostic
   * @sloCategory list
   * @sloLatency P99 < 2000ms
   */
  @Api({ summary: '周边地点推荐（高德 POI）', type: NearbyPlacesListVo })
  @IgnoreTenant()
  @Get('nearby-places')
  async getNearbyPlaces(@Query() query: NearbyPlacesQueryDto) {
    const result = await this.locationService.getNearbyPlaceSuggestions(
      query.lat,
      query.lng,
      query.limit,
    );
    return Result.ok(result);
  }
}
