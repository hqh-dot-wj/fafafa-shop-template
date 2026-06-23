import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import { getErrorMessage } from 'src/common/utils/error';
import { haversineDistanceMeters } from 'src/common/utils/haversine-distance-meters';

/** 高德地理编码 API 响应（仅用到的字段） */
interface AmapGeocodeResponse {
  status: string;
  info?: string;
  geocodes?: Array<{ location: string }>;
}

/** 高德逆地理编码 API 响应（仅用到的字段） */
interface AmapRegeoResponse {
  status: string;
  info?: string;
  regeocode?: { formatted_address?: string };
}

/** 高德周边搜索 API 响应（仅用到的字段） */
interface AmapPlaceAroundResponse {
  status: string;
  info?: string;
  pois?: Array<{
    id: string;
    name: string;
    address?: string;
    location: string;
    distance?: string;
  }>;
}

/** 周边 POI 一条（GCJ-02） */
export interface NearbyPlaceScored {
  id: string;
  fullAddress: string;
  latitude: number;
  longitude: number;
  distanceMeters: number;
}

/**
 * 结构化地址 → 坐标（高德 Web 地理编码）
 * 返回坐标为 GCJ-02，与微信小程序 / 国内地图一致。
 */
@Injectable()
export class GeocodingService {
  private readonly logger = new Logger(GeocodingService.name);

  private static readonly AMAP_GEO_URL = 'https://restapi.amap.com/v3/geocode/geo';

  private static readonly AMAP_REGEO_URL = 'https://restapi.amap.com/v3/geocode/regeo';

  private static readonly AMAP_PLACE_AROUND_URL = 'https://restapi.amap.com/v3/place/around';

  constructor(
    private readonly http: HttpService,
    private readonly config: ConfigService,
  ) {}

  /**
   * 将省市区 + 详细地址拼接后请求地理编码
   *
   * @returns 解析成功返回经纬度；未配置 Key、无结果或请求失败时返回 null（不抛错，由调用方决定是否落库）
   */
  async geocodeStructuredAddress(parts: {
    province: string;
    city: string;
    district: string;
    detail: string;
  }): Promise<{ latitude: number; longitude: number } | null> {
    const key = this.config.get<string>('AMAP_WEB_SERVICE_KEY');
    if (!key?.trim()) {
      this.logger.debug('未配置 AMAP_WEB_SERVICE_KEY，跳过地理编码');
      return null;
    }

    const full = `${parts.province}${parts.city}${parts.district}${parts.detail}`.trim();
    if (!full) {
      return null;
    }

    try {
      const { data } = await firstValueFrom(
        this.http.get<AmapGeocodeResponse>(GeocodingService.AMAP_GEO_URL, {
          params: { key: key.trim(), address: full },
          timeout: 5000,
        }),
      );

      if (data.status !== '1' || !data.geocodes?.length) {
        this.logger.warn(`高德地理编码无结果: ${data.info ?? data.status}`);
        return null;
      }

      const loc = data.geocodes[0].location;
      const [lngStr, latStr] = loc.split(',');
      const longitude = Number(lngStr);
      const latitude = Number(latStr);
      if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
        return null;
      }
      return { latitude, longitude };
    } catch (error: unknown) {
      this.logger.warn(`地理编码请求失败: ${getErrorMessage(error)}`);
      return null;
    }
  }

  /**
   * 坐标 → 结构化展示地址（高德逆地理编码，GCJ-02/WGS84 均按高德约定传参）
   *
   * @returns 成功返回格式化地址文案；未配置 Key、无结果或失败时返回 null
   */
  async reverseGeocode(lat: number, lng: number): Promise<string | null> {
    const key = this.config.get<string>('AMAP_WEB_SERVICE_KEY');
    if (!key?.trim()) {
      this.logger.debug('未配置 AMAP_WEB_SERVICE_KEY，跳过逆地理编码');
      return null;
    }

    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return null;
    }

    const location = `${lng},${lat}`;

    try {
      const { data } = await firstValueFrom(
        this.http.get<AmapRegeoResponse>(GeocodingService.AMAP_REGEO_URL, {
          params: { key: key.trim(), location, extensions: 'base', radius: 1000 },
          timeout: 5000,
        }),
      );

      if (data.status !== '1' || !data.regeocode?.formatted_address) {
        this.logger.warn(`高德逆地理编码无结果: ${data.info ?? data.status}`);
        return null;
      }

      const text = data.regeocode.formatted_address.trim();
      return text.length > 0 ? text : null;
    } catch (error: unknown) {
      this.logger.warn(`逆地理编码请求失败: ${getErrorMessage(error)}`);
      return null;
    }
  }

  /**
   * 当前坐标周边 POI（高德 place/around），用于「附近地址」推荐，非用户收货地址簿。
   * 类型含商务住宅相关与门址信息；无 Key 或失败时返回空数组。
   *
   * @param lat - 中心纬度（GCJ-02，与小程序一致）
   * @param lng - 中心经度
   * @param options.radiusMeters - 搜索半径（米），建议 ≤ 5000
   * @param options.limit - 条数上限，最大 5
   */
  async searchNearbyPlaces(
    lat: number,
    lng: number,
    options: { radiusMeters: number; limit: number },
  ): Promise<NearbyPlaceScored[]> {
    const key = this.config.get<string>('AMAP_WEB_SERVICE_KEY');
    if (!key?.trim()) {
      this.logger.debug('未配置 AMAP_WEB_SERVICE_KEY，跳过周边搜索');
      return [];
    }

    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return [];
    }

    const limit = Math.min(5, Math.max(1, options.limit));
    const radius = Math.min(50_000, Math.max(1, Math.round(options.radiusMeters)));
    const offset = Math.min(25, limit);

    try {
      const { data } = await firstValueFrom(
        this.http.get<AmapPlaceAroundResponse>(GeocodingService.AMAP_PLACE_AROUND_URL, {
          params: {
            key: key.trim(),
            location: `${lng},${lat}`,
            radius,
            types: '120000|190108',
            offset,
            page: 1,
            extensions: 'base',
          },
          timeout: 8000,
        }),
      );

      if (data.status !== '1' || !data.pois?.length) {
        if (data.status !== '1') {
          this.logger.warn(`高德周边搜索无结果: ${data.info ?? data.status}`);
        }
        return [];
      }

      const out: NearbyPlaceScored[] = [];

      for (const p of data.pois) {
        if (out.length >= limit) break;
        const [lngStr, latStr] = p.location.split(',');
        const longitude = Number(lngStr);
        const latitude = Number(latStr);
        if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) continue;

        let distanceMeters =
          p.distance != null && String(p.distance).trim() !== '' ? Math.round(Number(p.distance)) : NaN;
        if (!Number.isFinite(distanceMeters) || distanceMeters < 0) {
          distanceMeters = Math.round(haversineDistanceMeters(lat, lng, latitude, longitude));
        }

        const addrPart = p.address?.trim() ?? '';
        const fullAddress = addrPart.length > 0 ? `${p.name} ${addrPart}` : p.name;

        out.push({
          id: p.id,
          fullAddress,
          latitude,
          longitude,
          distanceMeters,
        });
      }

      return out;
    } catch (error: unknown) {
      this.logger.warn(`周边搜索请求失败: ${getErrorMessage(error)}`);
      return [];
    }
  }
}
