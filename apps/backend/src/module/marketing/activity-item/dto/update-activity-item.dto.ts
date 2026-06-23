import { PartialType } from '@nestjs/swagger';
import { CreateActivityItemDto } from './create-activity-item.dto';

export class UpdateActivityItemDto extends PartialType(CreateActivityItemDto) {}
