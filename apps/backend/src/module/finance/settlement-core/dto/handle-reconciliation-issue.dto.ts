import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, Length } from 'class-validator';

export class HandleReconciliationIssueDto {
  @ApiProperty({ description: '对账异常ID' })
  @IsString()
  issueId: string;

  @ApiProperty({ description: '处理动作', enum: ['MARK_SUCCESS', 'MARK_FAILED', 'MARK_HANDLED'] })
  @IsEnum(['MARK_SUCCESS', 'MARK_FAILED', 'MARK_HANDLED'])
  action: 'MARK_SUCCESS' | 'MARK_FAILED' | 'MARK_HANDLED';

  @ApiProperty({ required: false, description: '外部流水号或回单号' })
  @IsOptional()
  @IsString()
  @Length(0, 100)
  externalNo?: string;

  @ApiProperty({ required: false, description: '处理备注' })
  @IsOptional()
  @IsString()
  @Length(0, 500)
  remark?: string;
}
