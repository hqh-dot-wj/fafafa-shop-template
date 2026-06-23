import { Status } from '@prisma/client';
import { TaskService } from './task.service';
import { createPrismaMock, PrismaMock } from 'src/test-utils/prisma-mock';
import { Result } from 'src/common/response';
import { ModuleRef } from '@nestjs/core';

describe('TaskService', () => {
  let service: TaskService;
  let prisma: PrismaMock;

  const moduleRef = {
    get: jest.fn(),
  } as unknown as ModuleRef;

  const jobLogService = {
    addJobLog: jest.fn().mockResolvedValue(Result.ok()),
  };

  const noticeService = {
    create: jest.fn(),
  };

  const versionService = {
    deletePhysicalFile: jest.fn(),
  };

  const tenantHelper = {
    readWhereForDelegate: jest.fn((_delegate: string, where?: object) => ({ ...(where ?? {}) })),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    prisma = createPrismaMock();
    service = new TaskService(
      moduleRef,
      jobLogService as any,
      prisma as any,
      noticeService as any,
      versionService as any,
      tenantHelper as any,
    );
    // 注册测试用的 mock 任务
    (service as any).taskMap.set('demoTask', jest.fn().mockResolvedValue(undefined));
    (service as any).taskMap.set('failTask', jest.fn().mockRejectedValue(new Error('任务执行出错')));
    (service as any).taskMap.set('paramTask', jest.fn().mockResolvedValue(undefined));
  });

  // ─── R-FLOW-JOB-10/11/12, R-BRANCH-JOB-09: 执行已注册任务成功 ───
  describe('executeTask - 成功路径', () => {
    it('Given 无参任务已注册, When executeTask("demoTask"), Then 返回true并记录成功日志', async () => {
      const result = await service.executeTask('demoTask', 'testJob', 'DEFAULT');

      expect(result).toBe(true);
      expect((service as any).taskMap.get('demoTask')).toHaveBeenCalled();
      expect(jobLogService.addJobLog).toHaveBeenCalledWith(
        expect.objectContaining({
          jobName: 'testJob',
          jobGroup: 'DEFAULT',
          invokeTarget: 'demoTask',
          status: Status.NORMAL,
        }),
      );
    });

    // R-FLOW-JOB-10: 解析带参数的 invokeTarget
    it('Given 有参任务, When executeTask("paramTask(1,2)"), Then 解析参数并传入', async () => {
      const result = await service.executeTask('paramTask(1,2)', 'testJob', 'DEFAULT');

      expect(result).toBe(true);
      expect((service as any).taskMap.get('paramTask')).toHaveBeenCalledWith(1, 2);
    });

    it('Given 字符串参数, When executeTask("paramTask(\'hello\')"), Then 正确解析字符串', async () => {
      const result = await service.executeTask("paramTask('hello')", 'testJob');

      expect(result).toBe(true);
      expect((service as any).taskMap.get('paramTask')).toHaveBeenCalledWith('hello');
    });
  });

  // ─── R-BRANCH-JOB-10, R-TXN-JOB-01/02: 执行失败路径 ───
  describe('executeTask - 失败路径', () => {
    // R-PRE-JOB-02: 任务方法不存在
    it('Given 任务未注册, When executeTask("missingTask"), Then 返回false并记录失败日志', async () => {
      const result = await service.executeTask('missingTask', 'testJob', 'DEFAULT');

      expect(result).toBe(false);
      expect(jobLogService.addJobLog).toHaveBeenCalledWith(
        expect.objectContaining({
          status: Status.STOP,
          invokeTarget: 'missingTask',
        }),
      );
    });

    // R-TXN-JOB-02: 任务方法抛出异常
    it('Given 任务执行抛异常, When executeTask("failTask"), Then 返回false并记录异常信息', async () => {
      const result = await service.executeTask('failTask', 'testJob', 'DEFAULT');

      expect(result).toBe(false);
      expect(jobLogService.addJobLog).toHaveBeenCalledWith(
        expect.objectContaining({
          status: Status.STOP,
          exceptionInfo: expect.stringContaining('任务执行出错'),
        }),
      );
    });

    // R-PRE-JOB-03 / R-TXN-JOB-04: invokeTarget 格式错误
    it('Given invokeTarget 格式非法, When executeTask, Then 返回false并记录失败日志', async () => {
      const result = await service.executeTask('', 'testJob');

      expect(result).toBe(false);
      expect(jobLogService.addJobLog).toHaveBeenCalledWith(
        expect.objectContaining({
          status: Status.STOP,
        }),
      );
    });
  });

  // ─── R-LOG-JOB-01/02: 日志记录 ───
  describe('executeTask - 日志记录', () => {
    // R-FLOW-JOB-13: 日志含耗时
    it('Given 任务执行完成, When executeTask, Then 日志包含耗时信息', async () => {
      await service.executeTask('demoTask', 'testJob', 'DEFAULT');

      expect(jobLogService.addJobLog).toHaveBeenCalledWith(
        expect.objectContaining({
          jobMessage: expect.stringContaining('耗时'),
          createTime: expect.any(Date),
        }),
      );
    });

    // R-LOG-JOB-02: 失败日志含 exceptionInfo
    it('Given 任务执行失败, When executeTask, Then 日志含 exceptionInfo', async () => {
      await service.executeTask('failTask', 'testJob');

      expect(jobLogService.addJobLog).toHaveBeenCalledWith(
        expect.objectContaining({
          exceptionInfo: expect.any(String),
        }),
      );
      const logArg = jobLogService.addJobLog.mock.calls[0][0];
      expect(logArg.exceptionInfo.length).toBeGreaterThan(0);
    });

    it('Given 未提供 jobName, When executeTask, Then 日志 jobName 为"未知任务"', async () => {
      await service.executeTask('demoTask');

      expect(jobLogService.addJobLog).toHaveBeenCalledWith(
        expect.objectContaining({
          jobName: '未知任务',
          jobGroup: 'DEFAULT',
        }),
      );
    });
  });

  // ─── getTasks: 获取已注册任务列表 ───
  describe('getTasks', () => {
    it('Given 有已注册任务, When getTasks, Then 返回任务名称列表', () => {
      const tasks = service.getTasks();

      expect(tasks).toContain('demoTask');
      expect(tasks).toContain('failTask');
      expect(tasks).toContain('paramTask');
    });
  });

  describe('code managed jobs', () => {
    it('Given 注册代码托管任务定义, When getCodeManagedJobs, Then 返回稳定任务键与保护模式', () => {
      service.registerCodeManagedJob({
        key: 'finance.settleJob',
        name: '佣金结算到钱包',
        group: 'FINANCE',
        cron: '0 */5 * * * *',
        guardMode: 'self-managed',
        invokeTarget: 'finance.settleJob',
      });

      expect(service.getCodeManagedJobs()).toEqual([
        expect.objectContaining({
          key: 'finance.settleJob',
          group: 'FINANCE',
          guardMode: 'self-managed',
          invokeTarget: 'finance.settleJob',
        }),
      ]);
    });

    it('Given 重复注册同一个代码托管任务, When registerCodeManagedJob, Then 抛出错误', () => {
      const definition = {
        key: 'stock.handleStockAlert',
        name: '库存预警扫描',
        group: 'STORE',
        cron: '0 0 9 * * *',
        guardMode: 'platform-lock',
        invokeTarget: 'stock.handleStockAlert',
      };

      service.registerCodeManagedJob(definition);

      expect(() => service.registerCodeManagedJob(definition)).toThrow('代码托管任务重复注册');
    });
  });

  // ─── parseParams: 参数解析边界 ───
  describe('parseParams (private)', () => {
    it('Given 空字符串参数, When executeTask("paramTask()"), Then 不传参数', async () => {
      await service.executeTask('paramTask()', 'testJob');

      expect((service as any).taskMap.get('paramTask')).toHaveBeenCalledWith();
    });

    it('Given 布尔和数字混合参数, When executeTask, Then 正确解析类型', async () => {
      await service.executeTask('paramTask(true, 42)', 'testJob');

      expect((service as any).taskMap.get('paramTask')).toHaveBeenCalledWith(true, 42);
    });
  });

  // ─── SEC-JOB-RCE-01..11: parseParams 安全（拒绝代码执行 / 原型链污染 / DoS） ───
  // 业务语义：sysJob.invokeTarget 来自数据库，任何 admin 可写。
  // 历史实现用 `new Function(...)` 解析参数 = eval 等价，构成 RCE。
  // 本组 spec 断言：恶意输入必须被拒绝（executeTask 返回 false 且不调用任务方法）。
  describe('parseParams - 安全', () => {
    // SEC-JOB-RCE-01: 直接访问全局对象
    it('Given invokeTarget 含 globalThis 访问, When executeTask, Then 拒绝执行且任务方法不被调用', async () => {
      const r = await service.executeTask('paramTask(globalThis)', 'sec');
      expect(r).toBe(false);
      expect((service as any).taskMap.get('paramTask')).not.toHaveBeenCalled();
    });

    // SEC-JOB-RCE-02: process.exit 注入
    it('Given invokeTarget 含 process.exit, When executeTask, Then 拒绝且 process.exit 未被调用', async () => {
      const exitSpy = jest.spyOn(process, 'exit').mockImplementation(((_c?: number) => undefined) as never);
      const r = await service.executeTask('paramTask(process.exit(1))', 'sec');
      expect(r).toBe(false);
      expect(exitSpy).not.toHaveBeenCalled();
      expect((service as any).taskMap.get('paramTask')).not.toHaveBeenCalled();
      exitSpy.mockRestore();
    });

    // SEC-JOB-RCE-03: require child_process
    it("Given invokeTarget 含 require('child_process'), When executeTask, Then 拒绝执行", async () => {
      const r = await service.executeTask(`paramTask(require('child_process'))`, 'sec');
      expect(r).toBe(false);
      expect((service as any).taskMap.get('paramTask')).not.toHaveBeenCalled();
    });

    // SEC-JOB-RCE-04: 立即执行函数 (IIFE)
    it('Given invokeTarget 含 IIFE, When executeTask, Then 拒绝执行', async () => {
      const r = await service.executeTask('paramTask((()=>1)())', 'sec');
      expect(r).toBe(false);
      expect((service as any).taskMap.get('paramTask')).not.toHaveBeenCalled();
    });

    // SEC-JOB-RCE-05: 算术表达式
    it('Given invokeTarget 含算术表达式, When executeTask, Then 拒绝执行', async () => {
      const r = await service.executeTask('paramTask(1+1)', 'sec');
      expect(r).toBe(false);
      expect((service as any).taskMap.get('paramTask')).not.toHaveBeenCalled();
    });

    // SEC-JOB-RCE-06: 裸标识符引用
    it('Given invokeTarget 含裸标识符, When executeTask, Then 拒绝执行', async () => {
      const r = await service.executeTask('paramTask(console)', 'sec');
      expect(r).toBe(false);
      expect((service as any).taskMap.get('paramTask')).not.toHaveBeenCalled();
    });

    // SEC-JOB-RCE-07: 数组内嵌函数调用
    it('Given invokeTarget 数组内含 eval 调用, When executeTask, Then 拒绝执行', async () => {
      const r = await service.executeTask('paramTask([eval("1")])', 'sec');
      expect(r).toBe(false);
      expect((service as any).taskMap.get('paramTask')).not.toHaveBeenCalled();
    });

    // SEC-JOB-RCE-08: 原型链污染 __proto__ 直接键
    it('Given invokeTarget 对象键含 __proto__, When executeTask, Then 拒绝执行且 Object.prototype 未被污染', async () => {
      const r = await service.executeTask('paramTask({"__proto__": {"polluted": true}})', 'sec');
      expect(r).toBe(false);
      expect((service as any).taskMap.get('paramTask')).not.toHaveBeenCalled();
      expect(({} as Record<string, unknown>).polluted).toBeUndefined();
    });

    // SEC-JOB-RCE-09: 原型链污染 constructor.prototype 路径
    it('Given invokeTarget 对象键含 constructor, When executeTask, Then 拒绝执行', async () => {
      const r = await service.executeTask('paramTask({"constructor": {"prototype": {"x": 1}}})', 'sec');
      expect(r).toBe(false);
      expect((service as any).taskMap.get('paramTask')).not.toHaveBeenCalled();
    });

    // SEC-JOB-RCE-10: 超长字符串 DoS
    it('Given invokeTarget 参数超过长度上限, When executeTask, Then 拒绝执行', async () => {
      const huge = `paramTask("${'A'.repeat(5000)}")`;
      const r = await service.executeTask(huge, 'sec');
      expect(r).toBe(false);
      expect((service as any).taskMap.get('paramTask')).not.toHaveBeenCalled();
    });

    // SEC-JOB-RCE-11: Unicode 转义构造 __proto__ 绕过字符串比较
    it('Given invokeTarget 用 Unicode 转义构造 __proto__, When executeTask, Then 拒绝执行', async () => {
      const r = await service.executeTask(
        'paramTask({"\\u005f\\u005fproto\\u005f\\u005f": {"polluted": true}})',
        'sec',
      );
      expect(r).toBe(false);
      expect((service as any).taskMap.get('paramTask')).not.toHaveBeenCalled();
      expect(({} as Record<string, unknown>).polluted).toBeUndefined();
    });
  });

  // ─── parseParams 合法输入回归（保护历史运维用法不被白名单误伤） ───
  describe('parseParams - 合法输入回归', () => {
    it('数字参数', async () => {
      await service.executeTask('paramTask(1, 2)', 'ok');
      expect((service as any).taskMap.get('paramTask')).toHaveBeenCalledWith(1, 2);
    });

    it('单引号 / 双引号字符串混用', async () => {
      await service.executeTask(`paramTask('hello', "world")`, 'ok');
      expect((service as any).taskMap.get('paramTask')).toHaveBeenCalledWith('hello', 'world');
    });

    it('布尔 + null', async () => {
      await service.executeTask('paramTask(true, false, null)', 'ok');
      expect((service as any).taskMap.get('paramTask')).toHaveBeenCalledWith(true, false, null);
    });

    it('普通字面量对象 + 数组', async () => {
      await service.executeTask(`paramTask({a:1,b:'x'}, [1,2,3])`, 'ok');
      expect((service as any).taskMap.get('paramTask')).toHaveBeenCalledWith({ a: 1, b: 'x' }, [1, 2, 3]);
    });
  });
});
