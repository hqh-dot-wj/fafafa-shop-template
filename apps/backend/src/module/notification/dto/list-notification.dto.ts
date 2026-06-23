import { ApiProperty } from '@nestjs/swagger';
import { IsDateString, IsIn, IsOptional, IsString } from 'class-validator';
import { PageQueryDto } from 'src/common/dto/base.dto';

export class ListNotificationDto extends PageQueryDto {
  @ApiProperty({ required: false, description: '渠道' })
  @IsOptional()
  @IsString()
  @IsIn(['IN_APP', 'SMS', 'WECHAT_TEMPLATE', 'APP_PUSH'])
  channel?: string;

  @ApiProperty({ required: false, description: '状态' })
  @IsOptional()
  @IsString()
  @IsIn(['QUEUED', 'SENDING', 'SENT', 'FAILED'])
  status?: string;

  @ApiProperty({ required: false, description: '业务类型' })
  @IsOptional()
  @IsString()
  bizType?: string;

  @ApiProperty({ required: false, description: '业务引用ID' })
  @IsOptional()
  @IsString()
  bizRefId?: string;

  @ApiProperty({ required: false, description: '营销活动ID' })
  @IsOptional()
  @IsString()
  activityId?: string;

  @ApiProperty({ required: false, description: '触点编码' })
  @IsOptional()
  @IsString()
  touchpointCode?: string;

  @ApiProperty({ required: false, description: '触点类型' })
  @IsOptional()
  @IsString()
  @IsIn(['MESSAGE', 'SHARE'])
  touchpointKind?: string;

  @ApiProperty({ required: false, description: '模板编码（映射日志 template 字段）' })
  @IsOptional()
  @IsString()
  templateCode?: string;

  @ApiProperty({ required: false, description: '场景编码' })
  @IsOptional()
  @IsString()
  sceneCode?: string;

  @ApiProperty({ required: false, description: '创建时间起点' })
  @IsOptional()
  @IsDateString()
  createTimeFrom?: string;

  @ApiProperty({ required: false, description: '创建时间终点' })
  @IsOptional()
  @IsDateString()
  createTimeTo?: string;
}
