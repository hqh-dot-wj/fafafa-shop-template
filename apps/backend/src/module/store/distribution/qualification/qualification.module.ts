import { Module } from '@nestjs/common';
import { DistributionQualificationController } from './qualification.controller';
import { DistributionQualificationRepository } from './qualification.repository';
import { DistributionQualificationService } from './qualification.service';

@Module({
  controllers: [DistributionQualificationController],
  providers: [DistributionQualificationRepository, DistributionQualificationService],
  exports: [DistributionQualificationRepository, DistributionQualificationService],
})
export class DistributionQualificationModule {}
