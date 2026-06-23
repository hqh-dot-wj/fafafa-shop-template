import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNumber, IsNotEmpty, IsOptional, IsString, IsInt, Min, Max } from 'class-validator';
import { Transform } from 'class-transformer';

export class MatchTenantDto {
  @ApiProperty({ description: '纬度' })
  @IsNotEmpty({ message: '纬度不能为空' })
  @IsNumber()
  lat: number;

  @ApiProperty({ description: '经度' })
  @IsNotEmpty({ message: '经度不能为空' })
  @IsNumber()
  lng: number;
}

export class NearbyTenantsQueryDto {
  @ApiProperty({ description: '纬度' })
  @IsNotEmpty({ message: '纬度不能为空' })
  @Transform(({ value }) => parseFloat(value))
  @IsNumber()
  lat: number;

  @ApiProperty({ description: '经度' })
  @IsNotEmpty({ message: '经度不能为空' })
  @Transform(({ value }) => parseFloat(value))
  @IsNumber()
  lng: number;
}

/** 周边 POI：与 {@link NearbyTenantsQueryDto} 相同中心点参数，另可选条数 */
export class NearbyPlacesQueryDto extends NearbyTenantsQueryDto {
  @ApiPropertyOptional({ description: '返回条数，默认 5，最大 5', default: 5 })
  @IsOptional()
  @Transform(({ value }) => {
    if (value === undefined || value === '') return undefined;
    const n = parseInt(String(value), 10);
    return Number.isNaN(n) ? value : n;
  })
  @IsInt()
  @Min(1)
  @Max(5)
  limit?: number;
}

/** 位置漂移判定：用于无感切换前的服务端统一阈值与冷却判断 */
export class EvaluateLocationDriftDto {
  @ApiProperty({ description: '当前采样纬度' })
  @IsNotEmpty({ message: '纬度不能为空' })
  @IsNumber()
  lat: number;

  @ApiProperty({ description: '当前采样经度' })
  @IsNotEmpty({ message: '经度不能为空' })
  @IsNumber()
  lng: number;

  @ApiPropertyOptional({ description: '上次确认的归属租户 ID' })
  @IsOptional()
  @IsString()
  lastTenantId?: string;

  @ApiPropertyOptional({ description: '上次确认位置纬度（与 lastConfirmedLng 成对）' })
  @IsOptional()
  @IsNumber()
  lastConfirmedLat?: number;

  @ApiPropertyOptional({ description: '上次确认位置经度' })
  @IsOptional()
  @IsNumber()
  lastConfirmedLng?: number;

  @ApiPropertyOptional({ description: '上次调用本接口或完成漂移处理的时间戳（毫秒，Unix epoch）' })
  @IsOptional()
  @IsNumber()
  lastEvaluatedAt?: number;
}
