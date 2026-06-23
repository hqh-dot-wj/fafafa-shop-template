import { ApiProperty } from '@nestjs/swagger';
import { ReconciliationBizScope } from '@prisma/client';
import { IsDateString, IsEnum, IsOptional, IsString, Length } from 'class-validator';

export class ImportStatementDto {
  @ApiProperty({ description: '账单日期', example: '2026-04-23' })
  @IsDateString()
  statementDate: string;

  @ApiProperty({ description: '对账业务范围', enum: ReconciliationBizScope })
  @IsEnum(ReconciliationBizScope)
  bizScope: ReconciliationBizScope;

  @ApiProperty({ description: '通道类型', example: 'WECHAT_PAY' })
  @IsString()
  @Length(1, 30)
  channelType: string;

  @ApiProperty({ required: false, description: '账单来源类型', example: 'GENERATED' })
  @IsOptional()
  @IsString()
  @Length(0, 30)
  sourceType?: string;

  @ApiProperty({ required: false, description: '文件名' })
  @IsOptional()
  @IsString()
  @Length(0, 200)
  fileName?: string;

  @ApiProperty({ required: false, description: '备注' })
  @IsOptional()
  @IsString()
  @Length(0, 500)
  remark?: string;
}
