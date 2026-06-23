import { Module } from '@nestjs/common';
import { PrismaModule } from 'src/prisma/prisma.module';
import { CourseGroupModule } from '../course-group/course-group.module';
import { ResolutionModule } from '../resolution/resolution.module';
import { ProductActivityViewRepository } from './product-activity-view.repository';
import { ProductActivityViewService } from './product-activity-view.service';

@Module({
  imports: [PrismaModule, CourseGroupModule, ResolutionModule],
  providers: [ProductActivityViewRepository, ProductActivityViewService],
  exports: [ProductActivityViewService],
})
export class ProductActivityViewModule {}
