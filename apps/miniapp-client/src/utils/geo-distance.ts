import type { AddressVo } from '@/api/address';

/** 判断「当前定位」是否与某条收货地址足够近（米），用于选择地址页「添加至我的地址」显隐 */
export const ADDRESS_LOCATION_MATCH_MAX_METERS = 150;

/** 球面距离（米），输入为 WGS84/GCJ-02 十进制度 */
export function haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/** 在带坐标的地址中取离参考点最近的一条 */
export function pickNearestAddressWithCoords(
  list: AddressVo[],
  refLat: number,
  refLng: number,
): AddressVo | null {
  let best: AddressVo | null = null;
  let bestD = Number.POSITIVE_INFINITY;
  for (const a of list) {
    if (a.latitude == null || a.longitude == null) continue;
    const d = haversineMeters(refLat, refLng, a.latitude, a.longitude);
    if (d < bestD) {
      bestD = d;
      best = a;
    }
  }
  return best;
}

/**
 * 当前坐标是否与列表中任一带坐标收货地址重合（阈值内）。
 * 无坐标的收货地址不参与匹配（无法判定为「已是我的地址」）。
 */
export function isNearAnySavedAddress(
  refLat: number,
  refLng: number,
  list: AddressVo[],
  maxMeters: number = ADDRESS_LOCATION_MATCH_MAX_METERS,
): boolean {
  for (const a of list) {
    if (a.latitude == null || a.longitude == null) continue;
    if (haversineMeters(refLat, refLng, a.latitude, a.longitude) <= maxMeters) {
      return true;
    }
  }
  return false;
}
