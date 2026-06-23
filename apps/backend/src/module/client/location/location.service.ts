import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { GeoService } from 'src/module/lbs/geo/geo.service';
import { ResponseCode } from 'src/common/response';
import { BusinessException } from 'src/common/exceptions';
import { EvaluateLocationDriftDto } from './dto';
import { EvaluateLocationDriftVo, MatchTenantVo, NearbyPlacesListVo, NearbyTenantVo } from './vo';
import { Prisma } from '@prisma/client';
import { TenantHelper } from 'src/common/tenant/tenant.helper';
import { GeocodingService } from 'src/module/lbs/geocoding/geocoding.service';
import { haversineDistanceMeters } from 'src/common/utils/haversine-distance-meters';

/** 无感切换冷却：15 分钟内最多处理一轮（与产品设计一致，可后续配置化） */
const LOCATION_DRIFT_COOLDOWN_MS = 15 * 60 * 1000;

const LOCATION_DRIFT_MIN_THRESHOLD_M = 800;

const LOCATION_DRIFT_DEFAULT_SERVICE_RADIUS_M = 3000;

const LOCATION_DRIFT_RADIUS_FACTOR = 0.6;

/** 周边 POI 搜索半径（米），与选择页「附近地址」产品约定一致 */
const NEARBY_PLACES_RADIUS_M = 5000;

@Injectable()
export class ClientLocationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly geoService: GeoService,
    private readonly tenantHelper: TenantHelper,
    private readonly geocoding: GeocodingService,
  ) {}

  /**
   * 根据坐标匹配归属租户
   * 使用 PostGIS 电子围栏判断用户位于哪个服务站点
   */
  async matchTenantByLocation(lat: number, lng: number): Promise<MatchTenantVo> {
    // 1. 利用 GeoService 查找归属站点
    const station = await this.geoService.findStationByPoint(lat, lng);

    if (!station) {
      throw new BusinessException(ResponseCode.DATA_NOT_FOUND, '抱歉，该地址暂未开通服务');
    }

    // 2. 查询租户详情
    const tenant = await this.prisma.sysTenant.findUnique({
      where: { tenantId: station.tenantId },
    });

    if (!tenant) {
      throw new BusinessException(ResponseCode.DATA_NOT_FOUND, '服务商家信息不存在');
    }
    if (tenant.status !== 'NORMAL') {
      throw new BusinessException(ResponseCode.BUSINESS_ERROR, '服务商家暂不可用');
    }

    return {
      tenantId: tenant.tenantId,
      companyName: tenant.companyName,
    };
  }

  /**
   * 获取附近租户列表
   * 按距离排序，用于手动切换租户
   */
  async getNearbyTenants(lat: number, lng: number, radiusKm = 50): Promise<NearbyTenantVo[]> {
    // 查询所有有地理配置的租户
    const tenantsWithGeo = await this.prisma.sysTenantGeo.findMany({
      where: this.tenantHelper.readWhereForDelegate('sysTenantGeo', {
        latitude: { not: null },
        longitude: { not: null },
      }) as Prisma.SysTenantGeoWhereInput,
      include: {
        tenant: {
          select: {
            tenantId: true,
            companyName: true,
            status: true,
          },
        },
      },
    });

    // 计算距离并过滤
    const results: NearbyTenantVo[] = [];

    for (const geo of tenantsWithGeo) {
      if (!geo.latitude || !geo.longitude || !geo.tenant) continue;
      if (geo.tenant.status !== 'NORMAL') continue;

      // 计算距离 (使用 Haversine 公式简化计算，避免多次数据库查询)
      const distance = haversineDistanceMeters(lat, lng, geo.latitude, geo.longitude);
      const distanceKm = distance / 1000;

      if (distanceKm <= radiusKm) {
        results.push({
          tenantId: geo.tenant.tenantId,
          companyName: geo.tenant.companyName,
          distance: Math.round(distanceKm * 10) / 10, // 保留一位小数
        });
      }
    }

    // 按距离排序
    results.sort((a, b) => a.distance - b.distance);

    return results;
  }

  /**
   * 坐标逆地理编码（高德），供 C 端展示「当前位置」文案
   */
  async reverseGeocode(lat: number, lng: number): Promise<{ formattedAddress: string | null }> {
    const text = await this.geocoding.reverseGeocode(lat, lng);
    return { formattedAddress: text };
  }

  /**
   * 当前坐标周边 POI（高德），用于精细化定位；**非**用户收货地址簿数据。
   */
  async getNearbyPlaceSuggestions(lat: number, lng: number, limit?: number): Promise<NearbyPlacesListVo> {
    const take = Math.min(5, Math.max(1, limit ?? 5));
    const list = await this.geocoding.searchNearbyPlaces(lat, lng, {
      radiusMeters: NEARBY_PLACES_RADIUS_M,
      limit: take,
    });
    return { list };
  }

  /**
   * 根据当前定位与上次确认状态，判断是否建议无感切换租户。
   * 阈值取自匹配租户 geo 配置的 serviceRadius，避免前端猜测。
   */
  async evaluateLocationDrift(dto: EvaluateLocationDriftDto): Promise<EvaluateLocationDriftVo> {
    const now = Date.now();
    const lastEvaluatedAt = dto.lastEvaluatedAt;
    const cooldownHit =
      typeof lastEvaluatedAt === 'number' &&
      Number.isFinite(lastEvaluatedAt) &&
      now - lastEvaluatedAt >= 0 &&
      now - lastEvaluatedAt < LOCATION_DRIFT_COOLDOWN_MS;

    const station = await this.geoService.findStationByPoint(dto.lat, dto.lng);

    let matchedTenant: EvaluateLocationDriftVo['matchedTenant'] = null;
    let dynamicThresholdMeters = Math.max(
      LOCATION_DRIFT_MIN_THRESHOLD_M,
      Math.round(LOCATION_DRIFT_DEFAULT_SERVICE_RADIUS_M * LOCATION_DRIFT_RADIUS_FACTOR),
    );

    if (station) {
      const tenant = await this.prisma.sysTenant.findUnique({
        where: { tenantId: station.tenantId },
        include: { geoConfig: true },
      });

      if (tenant && tenant.status === 'NORMAL' && tenant.delFlag === 'NORMAL') {
        const radiusMeters = tenant.geoConfig?.serviceRadius ?? LOCATION_DRIFT_DEFAULT_SERVICE_RADIUS_M;
        dynamicThresholdMeters = Math.max(
          LOCATION_DRIFT_MIN_THRESHOLD_M,
          Math.round(radiusMeters * LOCATION_DRIFT_RADIUS_FACTOR),
        );
        matchedTenant = { tenantId: tenant.tenantId, companyName: tenant.companyName };
      }
    }

    const lastLat = dto.lastConfirmedLat;
    const lastLng = dto.lastConfirmedLng;
    let distanceMeters = 0;
    if (
      typeof lastLat === 'number' &&
      typeof lastLng === 'number' &&
      Number.isFinite(lastLat) &&
      Number.isFinite(lastLng)
    ) {
      distanceMeters = Math.round(haversineDistanceMeters(dto.lat, dto.lng, lastLat, lastLng));
    }

    const lastId = dto.lastTenantId?.trim() ?? '';
    const tenantChanged = Boolean(matchedTenant && lastId.length > 0 && matchedTenant.tenantId !== lastId);

    let shouldSwitch = false;
    let reason = 'NO_STATION_MATCH';

    if (cooldownHit) {
      shouldSwitch = false;
      reason = 'COOLDOWN_ACTIVE';
    } else if (!matchedTenant) {
      shouldSwitch = false;
      reason = 'NO_STATION_MATCH';
    } else if (lastId.length === 0) {
      shouldSwitch = false;
      reason = 'NO_PRIOR_TENANT';
    } else if (!tenantChanged) {
      shouldSwitch = false;
      reason = 'TENANT_UNCHANGED';
    } else if (distanceMeters > dynamicThresholdMeters) {
      shouldSwitch = true;
      reason = 'TENANT_CHANGED_AND_DISTANCE_EXCEEDED';
    } else {
      shouldSwitch = false;
      reason = 'TENANT_CHANGED_BUT_BELOW_THRESHOLD';
    }

    return {
      shouldSwitch,
      reason,
      distanceMeters,
      dynamicThresholdMeters,
      cooldownHit,
      matchedTenant,
    };
  }
}
