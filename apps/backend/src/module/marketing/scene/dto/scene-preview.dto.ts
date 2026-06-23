import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString } from 'class-validator';
import { PageQueryDto } from 'src/common/dto/base.dto';

export const SCENE_PREVIEW_CHANNELS = ['MINIAPP', 'H5', 'ADMIN_PREVIEW'] as const;
export type ScenePreviewChannel = (typeof SCENE_PREVIEW_CHANNELS)[number];

export class ScenePreviewQueryDto extends PageQueryDto {
  @ApiPropertyOptional({ description: '模拟请求渠道', enum: SCENE_PREVIEW_CHANNELS, default: 'ADMIN_PREVIEW' })
  @IsOptional()
  @IsIn(SCENE_PREVIEW_CHANNELS)
  channel?: ScenePreviewChannel;

  @ApiPropertyOptional({ description: '模拟会员 ID；为空时按匿名预览上下文裁决' })
  @IsOptional()
  @IsString()
  memberId?: string;

  @ApiPropertyOptional({ description: '模拟客户端版本，用于复现版本差异出数' })
  @IsOptional()
  @IsString()
  clientVersion?: string;
}

export class ScenePreviewCardVo {
  @ApiProperty({ description: '场景编码' })
  sceneCode: string;

  @ApiProperty({ description: '模块编码' })
  moduleCode: string;

  @ApiProperty({ description: '模块名称' })
  moduleName: string;

  @ApiProperty({ description: '商品 ID' })
  productId: string;

  @ApiProperty({ description: '商品名称' })
  productName: string;

  @ApiPropertyOptional({ description: '商品图片' })
  productImg?: string;

  @ApiPropertyOptional({ description: '活动上下文键' })
  activityContextKey?: string;

  @ApiPropertyOptional({ description: '活动类型' })
  activityType?: string;

  @ApiPropertyOptional({ description: '活动配置 ID' })
  activityConfigId?: string;

  @ApiPropertyOptional({ description: '展示价' })
  displayPrice?: number;

  @ApiPropertyOptional({ description: '原价' })
  originalPrice?: number;

  @ApiPropertyOptional({ description: '商品/活动状态摘要' })
  status?: string;
}

export class ScenePreviewResultVo {
  @ApiProperty({ description: '预览商品卡片', type: [ScenePreviewCardVo] })
  rows: ScenePreviewCardVo[];

  @ApiProperty({ description: '总条数' })
  total: number;

  @ApiProperty({ description: '页码' })
  pageNum: number;

  @ApiProperty({ description: '每页条数' })
  pageSize: number;

  @ApiProperty({ description: '场景编码' })
  sceneCode: string;

  @ApiPropertyOptional({ description: '场景发布版本号' })
  releaseNo?: number;

  @ApiPropertyOptional({ description: '本次预览 traceId，可用于诊断面板查询' })
  traceId?: string;
}
