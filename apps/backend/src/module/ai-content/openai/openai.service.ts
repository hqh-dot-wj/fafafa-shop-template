import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import { AiGenerateOptions, AiGenerateResult, AiProvider } from '../interfaces/ai-provider.interface';
import { BusinessException } from 'src/common/exceptions/business.exception';
import { getErrorMessage } from 'src/common/utils/error';

const DEFAULT_CHAT_MODEL = 'gpt-5.4';

@Injectable()
export class OpenaiService implements AiProvider {
  private readonly logger = new Logger(OpenaiService.name);
  private readonly client: OpenAI;
  private readonly apiKey: string | undefined;
  private readonly chatModel: string;

  constructor(private readonly configService: ConfigService) {
    this.apiKey = this.configService.get<string>('OPENAI_API_KEY')?.trim() || undefined;
    this.chatModel = this.configService.get<string>('OPENAI_MODEL')?.trim() || DEFAULT_CHAT_MODEL;
    const baseURL = this.configService.get<string>('OPENAI_BASE_URL')?.trim();
    const timeoutMsRaw = this.configService.get<string>('OPENAI_TIMEOUT_MS')?.trim();
    const timeoutMsParsed = timeoutMsRaw ? Number.parseInt(timeoutMsRaw, 10) : Number.NaN;
    const timeout = Number.isFinite(timeoutMsParsed) && timeoutMsParsed > 0 ? timeoutMsParsed : 30_000;

    this.client = new OpenAI({
      apiKey: this.apiKey || 'placeholder',
      ...(baseURL ? { baseURL } : {}),
      timeout,
    });

    if (!this.apiKey) {
      this.logger.warn('OPENAI_API_KEY 未配置，AI 文案生成功能不可用');
    }
  }

  /**
   * 调用 OpenAI Chat Completions 生成结构化 JSON 文本
   *
   * @param systemPrompt - 系统提示词，定义 AI 的角色和输出格式
   * @param userMessage - 用户输入的主题或关键词
   * @param options - 可选的模型参数（model / temperature / maxTokens）
   * @returns 包含解析后 JSON 内容和 token 用量的结果
   * @throws BusinessException 当 API Key 未配置、返回异常或调用失败时
   */
  async generateText(
    systemPrompt: string,
    userMessage: string,
    options?: AiGenerateOptions,
  ): Promise<AiGenerateResult> {
    BusinessException.throwIf(!this.apiKey, 'OpenAI API Key 未配置');

    try {
      const response = await this.client.chat.completions.create({
        model: options?.model ?? this.chatModel,
        temperature: options?.temperature ?? 0.8,
        max_tokens: options?.maxTokens ?? 1000,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage },
        ],
      });

      const raw = response.choices[0]?.message?.content;
      BusinessException.throwIf(!raw, '生成结果异常，请重试');

      let parsed: Record<string, unknown>;
      try {
        parsed = JSON.parse(raw!);
      } catch {
        this.logger.error(`AI 返回非法 JSON: ${raw}`);
        throw new BusinessException(500, '生成结果异常，请重试');
      }

      return {
        content: parsed,
        promptTokens: response.usage?.prompt_tokens ?? 0,
        completionTokens: response.usage?.completion_tokens ?? 0,
      };
    } catch (error) {
      if (error instanceof BusinessException) throw error;
      this.logger.error(`OpenAI 调用失败: ${getErrorMessage(error)}`);
      throw new BusinessException(500, '生成失败，请稍后重试');
    }
  }
}
