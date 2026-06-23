import { IsString, IsEnum, Length, IsOptional } from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import { PageQueryDto } from 'src/common/dto/index';
import { StatusEnum, StatusEnumSchema } from 'src/common/enum';

export class ListClientDto extends PageQueryDto {
  @ApiProperty({ required: false, description: '客户端 key' })
  @IsOptional()
  @IsString()
  @Length(0, 64)
  clientKey?: string;

  @ApiProperty({ required: false, description: '客户端秘钥（模糊）' })
  @IsOptional()
  @IsString()
  @Length(0, 255)
  clientSecret?: string;

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
