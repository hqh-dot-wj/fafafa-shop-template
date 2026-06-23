import type { AddressVo } from '@/api/address';
import { describe, expect, it } from 'vitest';
import { ADDRESS_LOCATION_MATCH_MAX_METERS, haversineMeters, isNearAnySavedAddress } from '@/utils/geo-distance';

function addr(partial: { id: string; latitude?: number; longitude?: number }): AddressVo {
  const address: AddressVo = {
    id: partial.id,
    name: '',
    phone: '',
    province: '',
    city: '',
    district: '',
    detail: '',
    fullAddress: '',
    isDefault: false,
  };
  if (partial.latitude !== undefined) address.latitude = partial.latitude;
  if (partial.longitude !== undefined) address.longitude = partial.longitude;
  return address;
}

describe('isNearAnySavedAddress', () => {
  const refLat = 31.2304;
  const refLng = 121.4737;

  it('列表为空时不视为已保存', () => {
    expect(isNearAnySavedAddress(refLat, refLng, [])).toBe(false);
  });

  it('无坐标的地址不参与匹配', () => {
    expect(isNearAnySavedAddress(refLat, refLng, [addr({ id: '1' })])).toBe(false);
  });

  it('与任一条在阈值内为 true', () => {
    const nearLat = refLat + 0.0005;
    const nearLng = refLng + 0.0005;
    const d = haversineMeters(refLat, refLng, nearLat, nearLng);
    expect(d).toBeLessThanOrEqual(ADDRESS_LOCATION_MATCH_MAX_METERS);
    expect(isNearAnySavedAddress(refLat, refLng, [addr({ id: '1', latitude: nearLat, longitude: nearLng })])).toBe(
      true,
    );
  });

  it('全部超出阈值为 false', () => {
    const farLat = refLat + 0.02;
    const farLng = refLng + 0.02;
    expect(isNearAnySavedAddress(refLat, refLng, [addr({ id: '1', latitude: farLat, longitude: farLng })])).toBe(false);
  });
});
