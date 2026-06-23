import { Module } from '@nestjs/common';
import { ResolutionService } from './resolution.service';
import { ResolutionRepository } from './resolution.repository';
import { CandidateLoaderService } from './services/candidate-loader.service';
import { EligibilityFilterService } from './services/eligibility-filter.service';
import { AggregateSelectorService } from './services/aggregate-selector.service';
import { ActivityContextTokenService } from './services/activity-context-token.service';
import { PriorityRuleController } from './priority-rule.controller';
import { PriorityRuleService } from './priority-rule.service';
import { SimulatorController } from './simulator.controller';
import { SimulatorService } from './simulator.service';
import { ResolutionCacheListener } from './resolution-cache.listener';
import { SceneReleaseRepository } from './scene-release.repository';
import { SceneCandidateLoaderService } from './services/scene-candidate-loader.service';
import { AudienceFilterService } from './services/audience-filter.service';
import { OfferEligibilityService } from './services/offer-eligibility.service';
import { PrimaryOfferResolverService } from './services/primary-offer-resolver.service';
import { CourseGroupSceneExplainService } from './services/course-group-scene-explain.service';
import { SecondaryBenefitMergerService } from './services/secondary-benefit-merger.service';
import { ModuleRankerService } from './services/module-ranker.service';
import { ProductCardViewBuilder } from './services/product-card-view.builder';
import { ResolutionObservabilityService } from './resolution-observability.service';
import { ResolutionExplainService } from './services/resolution-explain.service';
import { ResolutionMetricsController } from './resolution-metrics.controller';
import { ResolutionDiagnosticController } from './resolution-diagnostic.controller';
import { ResolutionDiagnosticService } from './resolution-diagnostic.service';
import { BatchValidationService } from './services/batch-validation.service';
import { BatchLockService } from './services/batch-lock.service';
import { DelayCompressionService } from './services/delay-compression.service';
import { MarketingEventsModule } from '../events/events.module';
import { PlayInstanceModule } from '../instance/instance.module';
import { IncidentController } from './incident.controller';
import { IncidentService } from './incident.service';
import { ResolutionExplainController } from './resolution-explain.controller';

@Module({
  imports: [MarketingEventsModule, PlayInstanceModule],
  controllers: [
    PriorityRuleController,
    SimulatorController,
    ResolutionMetricsController,
    ResolutionDiagnosticController,
    IncidentController,
    ResolutionExplainController,
  ],
  providers: [
    ResolutionService,
    ResolutionRepository,
    CandidateLoaderService,
    EligibilityFilterService,
    AggregateSelectorService,
    ActivityContextTokenService,
    PriorityRuleService,
    SimulatorService,
    ResolutionCacheListener,
    SceneReleaseRepository,
    SceneCandidateLoaderService,
    AudienceFilterService,
    OfferEligibilityService,
    PrimaryOfferResolverService,
    CourseGroupSceneExplainService,
    SecondaryBenefitMergerService,
    ModuleRankerService,
    ProductCardViewBuilder,
    ResolutionObservabilityService,
    ResolutionDiagnosticService,
    BatchValidationService,
    BatchLockService,
    DelayCompressionService,
    IncidentService,
    ResolutionExplainService,
  ],
  exports: [
    ResolutionService,
    ActivityContextTokenService,
    ResolutionObservabilityService,
    ResolutionDiagnosticService,
    BatchValidationService,
    BatchLockService,
    IncidentService,
    ResolutionExplainService,
  ],
})
export class ResolutionModule {}
