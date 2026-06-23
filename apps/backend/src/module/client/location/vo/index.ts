import { ApiProperty } from '@nestjs/swagger';

export class MatchTenantVo {
  @ApiProperty({ description: '租户ID' })
  tenantId: string;

  @ApiProperty({ description: '公司名称' })
  companyName: string;
}

export class NearbyTenantVo {
  @ApiProperty({ description: '租户ID' })
  tenantId: string;

  @ApiProperty({ description: '公司名称' })
  companyName: string;

  @ApiProperty({ description: '距离(公里)' })
  distance: number;
}

export class ReverseGeocodeVo {
  @ApiProperty({ description: '高德格式化地址；无 Key 或无结果时为 null', nullable: true })
  formattedAddress: string | null;
}

/** 高德周边 POI 一条（用于精细化定位，非用户收货地址） */
export class NearbyPlaceSuggestionVo {
  @ApiProperty({ description: '高德 POI id' })
  id: string;

  @ApiProperty({ description: '名称 + 地址展示' })
  fullAddress: string;

  @ApiProperty({ description: '纬度（GCJ-02）' })
  latitude: number;

  @ApiProperty({ description: '经度' })
  longitude: number;

  @ApiProperty({ description: '与中心点距离（米）' })
  distanceMeters: number;
}

export class NearbyPlacesListVo {
  @ApiProperty({ type: [NearbyPlaceSuggestionVo], description: '周边 POI，最多 5 条' })
  list: NearbyPlaceSuggestionVo[];
}

export class EvaluateLocationDriftMatchedTenantVo {
  @ApiProperty({ description: '当前坐标匹配到的租户 ID' })
  tenantId: string;

  @ApiProperty({ description: '公司名称' })
  companyName: string;
}

export class EvaluateLocationDriftVo {
  @ApiProperty({ description: '是否建议前端执行无感切换租户' })
  shouldSwitch: boolean;

  @ApiProperty({ description: '判定原因码（埋点/排查）' })
  reason: string;

  @ApiProperty({ description: '相对上次确认点的直线距离（米）' })
  distanceMeters: number;

  @ApiProperty({ description: '服务端计算的动态阈值（米）' })
  dynamicThresholdMeters: number;

  @ApiProperty({ description: '是否处于冷却时间窗内（为 true 时应跳过本轮无感切换）' })
  cooldownHit: boolean;

  @ApiProperty({
    description: '当前坐标匹配到的租户；无覆盖服务区时为 null',
    type: EvaluateLocationDriftMatchedTenantVo,
    nullable: true,
  })
  matchedTenant: EvaluateLocationDriftMatchedTenantVo | null;
}
