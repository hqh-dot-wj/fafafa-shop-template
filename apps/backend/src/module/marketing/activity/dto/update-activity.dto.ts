import { PartialType, OmitType } from '@nestjs/swagger';
import { CreateActivityDto } from './create-activity.dto';

/**
 * 更新营销活动 DTO（type 不可修改）
 */
export class UpdateActivityDto extends PartialType(OmitType(CreateActivityDto, ['type'] as const)) {}
