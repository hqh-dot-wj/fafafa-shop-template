import { ApiProperty } from '@nestjs/swagger';
import { ReconciliationBizScope, ReconciliationBufferStatus } from '@prisma/client';
import { PageQueryDto } from 'src/common/dto';
import { IsEnum, IsOptional, IsString, Length } from 'class-validator';

export class ListReconciliationBufferDto extends PageQueryDto {
  @ApiProperty({ required: false, description: '业务范围', enum: ReconciliationBizScope })
  @IsOptional()
  @IsEnum(ReconciliationBizScope)
  bizScope?: ReconciliationBizScope;

  @ApiProperty({ required: false, description: '通道类型', example: 'WECHAT_PAY' })
  @IsOptional()
  @IsString()
  @Length(0, 30)
  channelType?: string;

  @ApiProperty({ required: false, description: '缓冲状态', enum: ReconciliationBufferStatus })
  @IsOptional()
  @IsEnum(ReconciliationBufferStatus)
  status?: ReconciliationBufferStatus;

  @ApiProperty({ required: false, description: '原因编码' })
  @IsOptional()
  @IsString()
  @Length(0, 50)
  reasonCode?: string;

  @ApiProperty({ required: false, description: '租户ID' })
  @IsOptional()
  @IsString()
  tenantId?: string;
}
