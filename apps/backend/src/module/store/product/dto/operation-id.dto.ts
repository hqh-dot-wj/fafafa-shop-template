import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class OperationIdDto {
  @ApiProperty({ description: '幂等操作ID（可选）', required: false, maxLength: 64 })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  operationId?: string;
}
