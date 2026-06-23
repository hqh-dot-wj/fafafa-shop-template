import { EntitlementPoolCompileResultVo } from '../vo/entitlement-compile.vo';
import { PointsRuleService } from '../../points/rule/rule.service';
import { PointsTaskService } from '../../points/task/task.service';
import type { CompileEntitlementPoolDto } from '../dto/compile-entitlement.dto';

export class PointsPoolAdapter {
  constructor(
    private readonly pointsRuleService: PointsRuleService,
    private readonly pointsTaskService: PointsTaskService,
  ) {}

  async compile(input: Pick<CompileEntitlementPoolDto, 'taskId' | 'poolType'>): Promise<EntitlementPoolCompileResultVo> {
    const [rulesResult, taskResult] = await Promise.all([
      this.pointsRuleService.getRules(),
      this.pointsTaskService.findAll({ pageNum: 1, pageSize: 10 } as never),
    ]);

    const rules = (rulesResult.data as Record<string, unknown> | null) ?? {};
    const taskRows = ((taskResult.data as { rows?: unknown[] } | null)?.rows as unknown[]) ?? [];
    const taskId = input.taskId ?? '';
    const matchedTask = taskRows.find((task) => (task as { id?: string }).id === taskId) ?? null;
    return {
      poolType: 'POINTS',
      poolId: taskId || 'default-points-task',
      compileTarget: {
        owner: 'marketing points',
        runtimeArtifacts: ['points-rule', 'points-task', 'points-account'],
        forbiddenFacts: ['points-ledger', 'points-engine'],
      },
      preview: {
        taskId,
        task: matchedTask,
        rules,
        pointsTasks: taskRows,
        antiCheatHints: this.getAntiCheatHints(rules),
      },
      riskSummary: [
        '积分池仅输出规则+任务快照与约束建议，不接管积分账本',
        ...(this.getTaskRiskSummary(taskRows, taskId) ?? []),
      ].filter(Boolean) as string[],
    };
  }

  private getAntiCheatHints(rules: Record<string, unknown>) {
    if (!rules || Object.keys(rules).length === 0) {
      return ['规则数据为空，需在积分配置初始化后重试'];
    }
    if (rules.systemEnabled === false || rules.systemEnabled === 0) {
      return ['积分系统未启用，暂不产生积分变更'];
    }
    return ['积分池按现有积分 owner 的规则执行'];
  }

  private getTaskRiskSummary(taskRows: unknown[], taskId: string): string[] {
    const risks: string[] = [];
    if (!taskRows.length) {
      risks.push('积分任务列表为空，建议先配置并发布任务');
      return risks;
    }
    if (!taskId) {
      return ['未设置 taskId，默认落库为当前任务池内任务快照'];
    }
    const found = taskRows.some((task) => (task as { taskId?: string; id?: string }).taskId === taskId || (task as { id?: string }).id === taskId);
    if (!found) {
      risks.push('未找到指定 taskId 的积分任务快照，注意核对任务配置');
    }
    if (taskRows.length) {
      risks.push('积分发放与审计仍由积分 owner 统一执行');
    }
    return risks;
  }
}
