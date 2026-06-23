import { IsString, IsEnum, Length, IsOptional, IsArray, IsInt, Min, Max } from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import { StatusEnum, StatusEnumSchema } from 'src/common/enum';

export class CreateClientDto {
  @ApiProperty({ required: true, description: '客户端 key' })
  @IsString()
  @Length(1, 64)
  clientKey: string;

  @ApiProperty({ required: true, description: '客户端秘钥' })
  @IsString()
  @Length(1, 255)
  clientSecret: string;

  @ApiProperty({ required: true, description: '授权类型列表', type: [String] })
  @IsArray()
  @IsString({ each: true })
  grantTypeList: string[];

  @ApiProperty({ required: true, description: '设备类型' })
  @IsString()
  @Length(1, 20)
  deviceType: string;

  @ApiProperty({ required: false, description: '活跃超时（秒）', default: 1800 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(86400 * 365)
  activeTimeout?: number;

  @ApiProperty({ required: false, description: '固定超时（秒）', default: 86400 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(86400 * 365)
  timeout?: number;

  @ApiProperty({
    type: String,
    enum: StatusEnum,
    enumName: 'StatusEnum',
    enumSchema: StatusEnumSchema,
    required: false,
  })
  @IsOptional()
  @IsString()
  @IsEnum(StatusEnum)
  @Transform(({ value }) => {
    if (value === '0') return StatusEnum.NORMAL;
    if (value === '1') return StatusEnum.STOP;
    return value;
  })
  status?: string;
}
