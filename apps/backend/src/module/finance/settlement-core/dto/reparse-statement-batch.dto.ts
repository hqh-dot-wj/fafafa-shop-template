import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString, Length } from 'class-validator';

export class ReparseStatementBatchDto {
  @ApiProperty({ required: false, description: '是否强制重新解析' })
  @IsOptional()
  @IsBoolean()
  force?: boolean;

  @ApiProperty({ required: false, description: '重解析备注' })
  @IsOptional()
  @IsString()
  @Length(0, 500)
  remark?: string;
}
