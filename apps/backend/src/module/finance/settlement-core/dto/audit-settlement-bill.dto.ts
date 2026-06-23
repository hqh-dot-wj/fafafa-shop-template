import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, Length } from 'class-validator';

export class AuditSettlementBillDto {
  @ApiProperty({ description: '结算单ID' })
  @IsString()
  billId: string;

  @ApiProperty({ description: '审核动作', enum: ['APPROVE', 'REJECT'] })
  @IsEnum(['APPROVE', 'REJECT'])
  action: 'APPROVE' | 'REJECT';

  @ApiProperty({ required: false, description: '审核备注' })
  @IsOptional()
  @IsString()
  @Length(0, 500)
  remark?: string;
}
