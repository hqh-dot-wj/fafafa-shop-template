import { Module } from '@nestjs/common';
import { MarketingSceneController } from './scene.controller';
import { MarketingSceneService } from './scene.service';
import { MarketingSceneRepository } from './scene.repository';
import { MarketingSceneAliasController } from './scene-admin-alias.controller';
import { ResolutionModule } from '../resolution/resolution.module';

@Module({
  imports: [ResolutionModule],
  controllers: [MarketingSceneController, MarketingSceneAliasController],
  providers: [MarketingSceneService, MarketingSceneRepository],
  exports: [MarketingSceneService],
})
export class MarketingSceneModule {}
