import { Injectable } from '@nestjs/common';
import { ValidateActivityDto } from '../dto/validate-activity.dto';
import { ResolutionService } from '../resolution.service';
import { ResolvedActivityContextVo } from '../vo/resolved-activity-context.vo';

@Injectable()
export class BatchLockService {
  constructor(private readonly resolutionService: ResolutionService) {}

  async validateAndLock(item: ValidateActivityDto): Promise<ResolvedActivityContextVo> {
    return this.resolutionService.validateAndLock(item);
  }
}

