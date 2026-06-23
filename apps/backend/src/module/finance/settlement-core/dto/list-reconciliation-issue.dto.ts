import { ApiProperty } from '@nestjs/swagger';
import { ReconciliationStatus } from '@prisma/client';
import { PageQueryDto } from 'src/common/dto';
import { IsEnum, IsOptional, IsString } from 'class-validator';

export class ListReconciliationIssueDto extends PageQueryDto {
  @ApiProperty({ required: false, description: '租户ID' })
  @IsOptional()
  @IsString()
  tenantId?: string;

  @ApiProperty({ required: false, description: '对账状态', enum: ReconciliationStatus })
  @IsOptional()
  @IsEnum(ReconciliationStatus)
  status?: ReconciliationStatus;

  @ApiProperty({ required: false, description: '异常类型' })
  @IsOptional()
  @IsString()
  issueType?: string;

  @ApiProperty({ required: false, description: '结算单号' })
  @IsOptional()
  @IsString()
  billNo?: string;

  @ApiProperty({ required: false, description: '订单号' })
  @IsOptional()
  @IsString()
  orderSn?: string;
}
