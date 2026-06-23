import { ApiProperty } from '@nestjs/swagger';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsOptional, IsString, MaxLength } from 'class-validator';

export class BatchApproveAuditDto {
  @ApiProperty({ description: '待审核商品ID列表', type: [String] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @IsString({ each: true })
  items: string[];

  @ApiProperty({ description: '幂等操作ID（可选）', required: false, maxLength: 64 })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  operationId?: string;
}
