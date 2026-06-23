import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, Length, MaxLength } from 'class-validator';

export class RejectStoreProductDto {
  @ApiProperty({ description: '驳回原因' })
  @IsString()
  @Length(1, 500)
  reason: string;

  @ApiProperty({ description: '幂等操作ID（可选）', required: false, maxLength: 64 })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  operationId?: string;
}
