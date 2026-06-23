import { ApiProperty } from '@nestjs/swagger';
import { IsString, Length } from 'class-validator';

/**
 * 按 configKey 仅更新 configValue（与 admin-web fetchUpdateConfigByKey 入参一致）
 */
export class UpdateConfigByKeyDto {
  @ApiProperty({ required: true, description: '参数键名' })
  @IsString()
  @Length(1, 100)
  configKey: string;

  @ApiProperty({ required: true, description: '参数键值' })
  @IsString()
  @Length(0, 500)
  configValue: string;
}
