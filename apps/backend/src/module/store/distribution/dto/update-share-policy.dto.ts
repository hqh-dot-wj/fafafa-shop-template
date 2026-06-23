import { DistShareAttributionMode, DistShareBindingMode } from '@prisma/client';
import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsEnum, IsInt, Min } from 'class-validator';

export class UpdateSharePolicyDto {
  @ApiProperty({ description: '分享链接有效期（分钟）', example: 1440 })
  @IsInt()
  @Min(1)
  linkExpireMinutes: number;

  @ApiProperty({ description: '点击次数上限', example: 100 })
  @IsInt()
  @Min(1)
  maxClickCount: number;

  @ApiProperty({ description: '绑定次数上限', example: 20 })
  @IsInt()
  @Min(0)
  maxBindCount: number;

  @ApiProperty({ description: '归因订单次数上限', example: 20 })
  @IsInt()
  @Min(0)
  maxOrderCount: number;

  @ApiProperty({ description: '绑定模式', enum: DistShareBindingMode, example: DistShareBindingMode.BOTH })
  @IsEnum(DistShareBindingMode)
  bindingMode: DistShareBindingMode;

  @ApiProperty({
    description: '归因模式',
    enum: DistShareAttributionMode,
    example: DistShareAttributionMode.LAST_TOUCH,
  })
  @IsEnum(DistShareAttributionMode)
  attributionMode: DistShareAttributionMode;

  @ApiProperty({ description: '归因有效期（分钟）', example: 43200 })
  @IsInt()
  @Min(1)
  attributionWindowMinutes: number;

  @ApiProperty({ description: '是否允许跨店绑定', example: false })
  @IsBoolean()
  enableCrossTenantBind: boolean;

  @ApiProperty({ description: '策略是否启用', example: true })
  @IsBoolean()
  isActive: boolean;
}
