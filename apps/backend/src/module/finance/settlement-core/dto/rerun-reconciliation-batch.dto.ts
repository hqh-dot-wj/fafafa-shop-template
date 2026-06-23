import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsOptional } from 'class-validator';

export class RerunReconciliationBatchDto {
  @ApiProperty({ required: false, description: '是否清理旧结果后重跑' })
  @IsOptional()
  @IsBoolean()
  clearOldResult?: boolean;
}
