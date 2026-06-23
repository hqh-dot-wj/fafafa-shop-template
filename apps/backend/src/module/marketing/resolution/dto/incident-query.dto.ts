import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { PageQueryDto } from 'src/common/dto/base.dto';
import { IncidentAction, IncidentLevel, IncidentStatus, IncidentType } from '../vo/incident.vo';

export class IncidentQueryDto extends PageQueryDto {
  @ApiPropertyOptional({ description: '工单状态', enum: IncidentStatus })
  @IsOptional()
  @IsEnum(IncidentStatus)
  status?: IncidentStatus;

  @ApiPropertyOptional({ description: '工单等级', enum: IncidentLevel })
  @IsOptional()
  @IsEnum(IncidentLevel)
  level?: IncidentLevel;

  @ApiPropertyOptional({ description: '工单类型', enum: IncidentType })
  @IsOptional()
  @IsEnum(IncidentType)
  type?: IncidentType;

  @ApiPropertyOptional({ description: '关键字（标题/内容）', maxLength: 100 })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  keyword?: string;

  @ApiPropertyOptional({ description: '租户 ID（由服务端注入）' })
  @IsOptional()
  @IsString()
  tenantId?: string;
}

export class HandleIncidentDto {
  @ApiProperty({ description: '处理动作', enum: IncidentAction })
  @IsEnum(IncidentAction)
  action: IncidentAction;

  @ApiPropertyOptional({ description: '备注', maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  remark?: string;
}
