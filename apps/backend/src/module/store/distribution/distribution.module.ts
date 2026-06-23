import { Module } from '@nestjs/common';
import { DistributionController } from './distribution.controller';
import { DistributionService } from './distribution.service';
import { DashboardService } from './services/dashboard.service';
import { LevelService } from './services/level.service';
import { LevelConditionService } from './services/level-condition.service';
import { ApplicationService } from './services/application.service';
import { LevelScheduler } from './scheduler/level.scheduler';
import { SharePolicyService } from './services/share-policy.service';
import { ShareTokenService } from './services/share-token.service';
import { DistributorEligibilityService } from './services/distributor-eligibility.service';
import { ClientCommonModule } from 'src/module/client/common/client-common.module';
import { UploadModule } from 'src/module/admin/upload/upload.module';
import { RedisModule } from 'src/module/common/redis/redis.module';
import { DistributionQualificationModule } from './qualification/qualification.module';
import { AttributionConfigService } from 'src/module/marketing/common/attribution-config.service';

@Module({
  imports: [ClientCommonModule, UploadModule, RedisModule, DistributionQualificationModule],
  controllers: [DistributionController],
  providers: [
    DistributionService,
    DashboardService,
    LevelService,
    LevelConditionService,
    ApplicationService,
    SharePolicyService,
    AttributionConfigService,
    DistributorEligibilityService,
    ShareTokenService,
    LevelScheduler,
  ],
  exports: [
    DistributionService,
    LevelService,
    ApplicationService,
    SharePolicyService,
    AttributionConfigService,
    DistributorEligibilityService,
    ShareTokenService,
    DistributionQualificationModule,
  ],
})
export class DistributionModule {}
