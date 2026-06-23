import { Injectable } from '@nestjs/common';
import { BusinessException } from 'src/common/exceptions/business.exception';
import { ResponseCode } from 'src/common/response/response.interface';
import { PrismaService } from 'src/prisma/prisma.service';
import { RuleValidatorService, type FormFieldSchema, type FormSchema } from '../rule/rule-validator.service';
import { getCampaignPolicySchema } from './policy-schemas';
import type { MarketingJsonSchema, MarketingJsonSchemaProperty } from './json-schema';

@Injectable()
export class MarketingSchemaService {
  constructor(
    private readonly ruleValidatorService: RuleValidatorService,
    private readonly prisma: PrismaService,
  ) {}

  getPolicySchema(type: string): MarketingJsonSchema {
    const schema = getCampaignPolicySchema(type);
    if (!schema) {
      throw new BusinessException(ResponseCode.BUSINESS_ERROR, `未找到营销策略 Schema: ${type}`);
    }
    return schema;
  }

  async getPlayRuleSchema(code: string): Promise<MarketingJsonSchema> {
    const formSchema = await this.ruleValidatorService.getRuleFormSchema(code);
    return this.convertFormSchemaToJsonSchema(formSchema);
  }

  async getSceneTemplateSchema(templateCode: string): Promise<MarketingJsonSchema> {
    const template = await this.prisma.mktSceneTemplate.findUnique({
      where: { templateCode },
      include: {
        modules: {
          orderBy: [{ displayOrder: 'asc' }, { moduleSlot: 'asc' }],
        },
      },
    });

    if (!template) {
      throw new BusinessException(ResponseCode.BUSINESS_ERROR, `未找到场景模板: ${templateCode}`);
    }

    const moduleProperties = Object.fromEntries(
      template.modules.map((module) => [
        module.moduleSlot,
        {
          type: 'object',
          title: module.moduleName,
          properties: {
            title: { type: 'string', title: '模块标题', default: module.title ?? '' },
            subTitle: { type: 'string', title: '副标题', default: module.subTitle ?? '' },
            limitSize: { type: 'integer', title: '展示数量', minimum: 1, default: module.limitSize },
            activityPool: { type: 'array', title: '活动池', 'ui:widget': 'ActivityPoolPicker' },
            uiConfig: {
              type: 'object',
              title: 'UI 配置',
              default: module.uiConfig ?? {},
              additionalProperties: true,
            },
          },
        } satisfies MarketingJsonSchemaProperty,
      ]),
    );

    return {
      type: 'object',
      title: template.templateName,
      required: ['pageRoute'],
      properties: {
        templateCode: {
          type: 'string',
          title: '模板编码',
          enum: [template.templateCode],
          default: template.templateCode,
        },
        pageRoute: { type: 'string', title: '页面路径', default: template.pageRoute ?? '' },
        placementConfig: {
          type: 'object',
          title: '投放配置',
          default: template.placementConfig ?? {},
          additionalProperties: true,
        },
        modules: {
          type: 'object',
          title: '模板模块',
          properties: moduleProperties,
          additionalProperties: false,
        },
      },
    };
  }

  private convertFormSchemaToJsonSchema(formSchema: FormSchema): MarketingJsonSchema {
    const required: string[] = [];
    const properties = Object.fromEntries(
      formSchema.fields.map((field) => {
        if (field.required) {
          required.push(field.name);
        }
        return [field.name, this.convertFormField(field)];
      }),
    );

    return {
      type: 'object',
      title: formSchema.templateName,
      required,
      properties,
    };
  }

  private convertFormField(field: FormFieldSchema): MarketingJsonSchemaProperty {
    const property: MarketingJsonSchemaProperty = {
      type: field.type,
      title: field.label ?? field.name,
      description: field.description,
      default: field.defaultValue,
    };

    if (field.validations?.min != null) property.minimum = field.validations.min;
    if (field.validations?.max != null) property.maximum = field.validations.max;
    if (field.validations?.minLength != null) property.minLength = field.validations.minLength;
    if (field.validations?.maxLength != null) property.maxLength = field.validations.maxLength;

    if (field.name.endsWith('Time') || field.name.endsWith('Deadline')) {
      property.format = 'date-time';
      property['ui:widget'] = 'datetime';
    }
    if (field.name === 'classAddress') {
      property['ui:widget'] = 'ScheduleEditor';
    }

    return property;
  }
}
