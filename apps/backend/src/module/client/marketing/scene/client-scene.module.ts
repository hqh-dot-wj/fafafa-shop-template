import { Module } from '@nestjs/common';
import { ClientSceneController } from './client-scene.controller';
import { ClientSceneService } from './client-scene.service';
import { ResolutionModule } from 'src/module/marketing/resolution/resolution.module';
import { ClientSceneProductsController } from './client-scene-products.controller';

@Module({
  imports: [ResolutionModule],
  controllers: [ClientSceneController, ClientSceneProductsController],
  providers: [ClientSceneService],
  exports: [ClientSceneService],
})
export class ClientSceneModule {}
