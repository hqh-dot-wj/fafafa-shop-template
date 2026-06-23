import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, Length } from 'class-validator';

export class HandleReconciliationBufferDto {
  @ApiProperty({ description: '缓冲记录ID' })
  @IsString()
  bufferId: string;

  @ApiProperty({ description: '处理动作', enum: ['RECHECK', 'ESCALATE', 'IGNORE'] })
  @IsOptional()
  @IsEnum(['RECHECK', 'ESCALATE', 'IGNORE'])
  action: 'RECHECK' | 'ESCALATE' | 'IGNORE';

  @ApiProperty({ required: false, description: '处理备注' })
  @IsOptional()
  @IsString()
  @Length(0, 500)
  remark?: string;
}
