import { Module } from '@nestjs/common';
import { ClientAiContentController } from './client-ai-content.controller';
import { AiContentModule } from 'src/module/ai-content/ai-content.module';

@Module({
  imports: [AiContentModule],
  controllers: [ClientAiContentController],
})
export class ClientAiContentModule {}
