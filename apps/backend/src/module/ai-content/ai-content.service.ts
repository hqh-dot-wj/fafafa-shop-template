import { Injectable, Logger } from '@nestjs/common';
import { AiContentRepository } from './ai-content.repository';
import { AiPlatformPromptRepository } from './ai-platform-prompt.repository';
import { OpenaiService } from './openai/openai.service';
import { Result } from 'src/common/response/result';
import { BusinessException } from 'src/common/exceptions/business.exception';
import { FormatDateFields } from 'src/common/utils';

const INJECTION_KEYWORDS = [
  'ignore previous',
  'ignore above',
  'disregard',
  'forget your instructions',
  'system:',
  'you are now',
  'new role',
  'act as',
];

const DAILY_LIMIT = 50;

@Injectable()
export class AiContentService {
  private readonly logger = new Logger(AiContentService.name);

  constructor(
    private readonly contentRepo: AiContentRepository,
    private readonly promptRepo: AiPlatformPromptRepository,
    private readonly openaiService: OpenaiService,
  ) {}

  /**
   * 获取当前租户可用的平台列表（启用状态），若租户无配置则回落全局
   *
   * @param tenantId - 当前租户 ID
   * @returns 可用平台列表（仅返回前端需要的字段）
   */
  async getAvailablePlatforms(tenantId: string) {
    const platforms = await this.promptRepo.findEnabledPlatforms();
    return Result.ok(
      platforms.map((p) => ({
        platformCode: p.platformCode,
        platformName: p.platformName,
        icon: p.icon,
        maxLength: p.maxLength,
        outputSchema: p.outputSchema,
      })),
    );
  }

  /**
   * 根据平台 Prompt 模板调用 AI 生成文案，并保存生成记录
   *
   * @param memberId - 会员 ID
   * @param platformCode - 平台标识
   * @param userInput - 用户输入的主题/关键词
   * @param tenantId - 当前租户 ID
   * @returns 生成的内容记录
   * @throws BusinessException 当平台不可用、超出每日限额或输入包含注入关键词时
   */
  async generate(memberId: string, platformCode: string, userInput: string, tenantId: string) {
    const normalizedPlatformCode = this.normalizeRequiredText(platformCode, '平台标识不能为空', 64);
    const normalizedUserInput = this.normalizeRequiredText(userInput, '输入内容不能为空', 500);
    const prompt =
      (await this.promptRepo.findByPlatformCode(normalizedPlatformCode, tenantId)) ??
      (await this.promptRepo.findByPlatformCode(normalizedPlatformCode, '000000'));
    BusinessException.throwIf(!prompt, '该平台暂不可用');

    const todayCount = await this.contentRepo.countTodayByMember(memberId);
    BusinessException.throwIf(todayCount >= DAILY_LIMIT, '今日生成次数已达上限');

    this.validateInput(normalizedUserInput);

    const result = await this.openaiService.generateText(prompt!.systemPrompt, normalizedUserInput);

    this.logger.log(
      `AI 生成完成: member=${memberId}, platform=${normalizedPlatformCode}, ` +
        `promptTokens=${result.promptTokens}, completionTokens=${result.completionTokens}`,
    );

    const record = await this.contentRepo.create({
      member: { connect: { memberId } },
      platformCode: normalizedPlatformCode,
      userInput: normalizedUserInput,
      generatedContent: result.content,
      promptTokens: result.promptTokens,
      completionTokens: result.completionTokens,
      tenantId,
    });

    return Result.ok(
      FormatDateFields({
        ...record,
        platformName: prompt!.platformName,
      }),
    );
  }

  /**
   * 分页查询会员的文案生成历史
   *
   * @param memberId - 会员 ID
   * @param pageNum - 页码
   * @param pageSize - 每页条数
   * @returns 分页列表
   */
  async getHistory(memberId: string, pageNum: number, pageSize: number) {
    const result = await this.contentRepo.findHistoryPage(memberId, pageNum, pageSize);
    return Result.page(FormatDateFields(result.rows), result.total);
  }

  private validateInput(input: string) {
    const lower = input.toLowerCase();
    const hasInjection = INJECTION_KEYWORDS.some((keyword) => lower.includes(keyword));
    BusinessException.throwIf(hasInjection, '输入内容包含不允许的字符');
  }

  private normalizeRequiredText(input: string, blankMessage: string, maxLength: number): string {
    BusinessException.throwIf(typeof input !== 'string', blankMessage);
    const value = input.trim();
    BusinessException.throwIf(!value, blankMessage);
    BusinessException.throwIf(value.length > maxLength, '输入内容超出长度限制');
    return value;
  }
}
