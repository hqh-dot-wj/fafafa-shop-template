import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { MarketingStockMode } from '@prisma/client';
import type { PlayMetadata } from '../play.dispatcher';

export class PlayMetadataVo {
  @ApiProperty({ description: '玩法编码' })
  code: string;

  @ApiProperty({ description: '玩法名称' })
  name: string;

  @ApiProperty({ description: '是否创建玩法实例' })
  hasInstance: boolean;

  @ApiProperty({ description: '是否存在状态流转' })
  hasState: boolean;

  @ApiProperty({ description: '是否存在失败态' })
  canFail: boolean;

  @ApiProperty({ description: '是否允许并行参与' })
  canParallel: boolean;

  @ApiProperty({ description: '默认库存模式', enum: MarketingStockMode })
  defaultStockMode: MarketingStockMode;

  @ApiPropertyOptional({ description: '玩法描述' })
  description?: string;
}

export class PlayExistsVo {
  @ApiProperty({ description: '玩法是否已注册' })
  exists: boolean;

  @ApiProperty({ description: '玩法编码' })
  code: string;
}

export class PlayFeaturesVo {
  @ApiProperty({ description: '玩法编码' })
  code: string;

  @ApiProperty({ description: '是否创建玩法实例' })
  hasInstance: boolean;

  @ApiProperty({ description: '是否存在状态流转' })
  hasState: boolean;

  @ApiProperty({ description: '是否存在失败态' })
  canFail: boolean;

  @ApiProperty({ description: '是否允许并行参与' })
  canParallel: boolean;
}

export function toPlayMetadataVo(metadata: PlayMetadata): PlayMetadataVo {
  return {
    code: metadata.code,
    name: metadata.name,
    hasInstance: metadata.hasInstance,
    hasState: metadata.hasState,
    canFail: metadata.canFail,
    canParallel: metadata.canParallel,
    defaultStockMode: metadata.defaultStockMode,
    description: metadata.description,
  };
}
