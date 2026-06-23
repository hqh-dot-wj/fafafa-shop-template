import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AiPlatformPromptController } from './ai-platform-prompt.controller';
import { AiPlatformPromptService } from './ai-platform-prompt.service';
import { AiPlatformPromptRepository } from './ai-platform-prompt.repository';
import { AiContentService } from './ai-content.service';
import { AiContentRepository } from './ai-content.repository';
import { OpenaiService } from './openai/openai.service';

@Module({
  imports: [ConfigModule],
  controllers: [AiPlatformPromptController],
  providers: [
    AiPlatformPromptService,
    AiPlatformPromptRepository,
    AiContentService,
    AiContentRepository,
    OpenaiService,
  ],
  exports: [AiContentService, AiPlatformPromptRepository],
})
export class AiContentModule {}
