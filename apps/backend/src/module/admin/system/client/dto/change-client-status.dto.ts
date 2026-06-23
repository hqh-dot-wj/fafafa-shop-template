import { IsString, IsEnum } from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import { StatusEnum, StatusEnumSchema } from 'src/common/enum';

export class ChangeClientStatusDto {
  @ApiProperty({ required: true, description: '客户端业务 ID（client_id）' })
  @IsString()
  clientId: string;

  @ApiProperty({
    type: String,
    enum: StatusEnum,
    enumName: 'StatusEnum',
    enumSchema: StatusEnumSchema,
    required: true,
    description: '状态：0 正常 1 停用',
  })
  @IsString()
  @IsEnum(StatusEnum)
  @Transform(({ value }) => {
    if (value === '0') return StatusEnum.NORMAL;
    if (value === '1') return StatusEnum.STOP;
    return value;
  })
  status: StatusEnum;
}
