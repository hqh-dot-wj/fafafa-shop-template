/**
 * 位置相关 API
 * 类型来自 @libs/common-types（由 backend public/openApi.json 生成）
 * @expires backend 导出 ReverseGeocode / NearbyPlaceSuggestion DTO/VO 后切换至 generate-types。
 */
import type { EvaluateLocationDriftDto, EvaluateLocationDriftVo } from '@libs/common-types';
import { httpGet, httpPost } from '@/http/http';

export interface ReverseGeocodeResult {
  formattedAddress: string | null;
}

/** 高德周边 POI（与 backend `NearbyPlaceSuggestionVo` 对齐） */
export interface NearbyPlaceSuggestionVo {
  id: string;
  fullAddress: string;
  latitude: number;
  longitude: number;
  distanceMeters: number;
}

/** 逆地理编码：坐标 → 展示用地址（服务端高德，需配置 AMAP_WEB_SERVICE_KEY） */
export function getReverseGeocode(lat: number, lng: number) {
  return httpGet<ReverseGeocodeResult>('/client/location/reverse-geocode', { lat, lng }, undefined, {
    hideErrorToast: true,
  });
}

/** 当前定位周边地点（高德 POI，非收货地址簿） */
export function getNearbyPlaceSuggestions(lat: number, lng: number, limit = 5) {
  return httpGet<{ list: NearbyPlaceSuggestionVo[] }>(
    '/client/location/nearby-places',
    { lat, lng, limit },
    undefined,
    { hideErrorToast: true },
  );
}

/** 位置漂移判定：动态阈值与冷却由服务端统一计算 */
export function evaluateLocationDrift(payload: EvaluateLocationDriftDto) {
  return httpPost<EvaluateLocationDriftVo>('/client/location/evaluate-drift', { ...payload }, undefined, undefined, {
    hideErrorToast: true,
  });
}
