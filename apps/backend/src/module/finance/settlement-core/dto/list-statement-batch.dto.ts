import { ApiProperty } from '@nestjs/swagger';
import { ReconciliationBizScope, StatementBatchStatus } from '@prisma/client';
import { PageQueryDto } from 'src/common/dto';
import { IsDateString, IsEnum, IsOptional, IsString, Length } from 'class-validator';

export class ListStatementBatchDto extends PageQueryDto {
  @ApiProperty({ required: false, description: '账单日期', example: '2026-04-23' })
  @IsOptional()
  @IsDateString()
  statementDate?: string;

  @ApiProperty({ required: false, description: '对账业务范围', enum: ReconciliationBizScope })
  @IsOptional()
  @IsEnum(ReconciliationBizScope)
  bizScope?: ReconciliationBizScope;

  @ApiProperty({ required: false, description: '通道类型', example: 'WECHAT_PAY' })
  @IsOptional()
  @IsString()
  @Length(0, 30)
  channelType?: string;

  @ApiProperty({ required: false, description: '账单状态', enum: StatementBatchStatus })
  @IsOptional()
  @IsEnum(StatementBatchStatus)
  status?: StatementBatchStatus;
}
