import { IsNumber, IsString, Length } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import { CreateClientDto } from './create-client.dto';

export class UpdateClientDto extends CreateClientDto {
  @ApiProperty({ required: true, description: '主键 ID' })
  @Type(() => Number)
  @IsNumber()
  id: number;

  @ApiProperty({ required: true, description: '客户端唯一标识（业务 ID）' })
  @IsString()
  @Length(1, 64)
  clientId: string;
}
