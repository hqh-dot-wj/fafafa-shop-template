import { Module } from '@nestjs/common';
import { ReportFactService } from './report-fact.service';
import { PrismaModule } from 'src/prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  providers: [ReportFactService],
  exports: [ReportFactService],
})
export class ReportModule {}
