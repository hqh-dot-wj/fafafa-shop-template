---
title: Backend Agent Map
status: active
doc_type: agent-supplement
owner: engineering-governance
last_verified: 2026-05-15
---

# Backend Agent Map

本文件承接 `apps/backend/AGENTS.md` 中"AI 定位代码用"的查询表，不是规则正文。规则正文以 `apps/backend/AGENTS.md` 为准。

## 1. 文件树与定位索引

这是一棵用于定位改动落点的业务文件树，不是完整文件清单。完整检索仍用 `rg --files apps/backend/src/module`，但进入实现前应先按下表收窄范围。

```text
apps/backend/
├── src/
│   ├── module/
│   │   ├── admin/                 # 后台管理入口层：Controller、权限、后台页面契约
│   │   │   ├── auth/              # 后台认证，高风险
│   │   │   ├── finance/           # 后台财务入口，高风险
│   │   │   ├── member/            # 后台会员管理入口
│   │   │   ├── monitor/           # 监控、任务、日志入口
│   │   │   ├── system/            # 租户、菜单、角色、字典、配置等系统管理
│   │   │   ├── tool/              # 代码生成等开发工具
│   │   │   ├── upload/            # 后台上传入口
│   │   │   └── upgrade/           # 后台升级申请入口
│   │   ├── client/                # C 端接口入口层：/client/* Controller 与适配
│   │   │   ├── auth/              # C 端认证，高风险
│   │   │   ├── finance/           # C 端财务视图，高风险
│   │   │   ├── marketing/         # C 端营销聚合、实例、优惠券入口
│   │   │   ├── order/             # C 端订单
│   │   │   ├── payment/           # C 端支付，高风险
│   │   │   ├── product/           # C 端商品
│   │   │   └── user/              # C 端用户资料与用户态
│   │   ├── marketing/             # 营销能力域事实源
│   │   │   ├── activity/          # 活动配置
│   │   │   ├── campaign-shell/    # 活动壳与工作台
│   │   │   ├── coupon/            # 优惠券
│   │   │   ├── course-group/      # 拼课团队、成员、投影
│   │   │   ├── instance/          # 营销实例与状态流转
│   │   │   ├── play/              # 玩法规则与购买链路
│   │   │   ├── points/            # 积分规则
│   │   │   ├── resolution/        # 营销决策、命中、模拟、事件
│   │   │   ├── scheduler/         # 营销定时任务
│   │   │   └── store-activity/    # 门店活动配置
│   │   ├── finance/               # 钱包、佣金、提现、清结算，高风险
│   │   ├── payment/               # 支付适配，高风险
│   │   ├── store/                 # 门店运营域：商品、订单、库存、分销、财务
│   │   ├── pms/                   # 平台商品基础资料：商品、分类、品牌、属性
│   │   ├── lbs/                   # 地理位置、区域、站点
│   │   ├── notification/          # 通知、短信、站内信、推送
│   │   ├── auth-core/             # 认证公共能力：验证码、密码策略、审计
│   │   ├── common/                # backend 内公共能力：Redis、Bull、操作日志、HTTP
│   │   ├── ai-content/            # AI 内容能力
│   │   ├── risk/                  # 风险控制能力
│   │   ├── worker/                # 工作端能力
│   │   ├── main/                  # 基础入口接口
│   │   └── backup/                # 备份能力
│   ├── database/                  # Prisma 服务、Repository 基类、租户/软删基础设施
│   ├── prisma/                    # Prisma 运行封装
│   ├── prisma-seeds/              # seed 辅助代码
│   ├── common/                    # 全局装饰器、过滤器、拦截器、工具
│   ├── config/                    # 后端配置
│   ├── types/                     # 后端本地类型
│   └── test-utils/                # 后端测试工具
└── prisma/
    ├── schema.prisma              # 数据模型，高风险
    ├── migrations/                # migration，高风险，禁止直接改已有 migration
    └── seeds/                     # seed 数据，高风险
```

定位规则：

- 后台页面请求优先从 `module/admin/*` 找 Controller，再顺到对应能力域 Service / Repository。
- C 端请求优先从 `module/client/*` 找 Controller；`client/*` 只做入口适配时，不应把能力域逻辑写回入口层。
- 商品、营销、财务、门店这类能力域以 `marketing/`、`finance/`、`store/`、`pms/` 为事实源；只查数据时优先找 `QueryService` / Repository，不直接注入整套跨域 Service。
- 普通功能扫描边界是"入口 Controller -> DTO -> Service -> Repository/Prisma -> 测试 + 同域 2-3 个相似实现"；没有高风险信号时不扩成全 backend 扫描。
- 触达 `finance`、`payment`、`auth`、`tenant`、`dict`、`job`、`prisma` 或跨 app 契约时，按根 `AGENTS.md` §3 高风险流程停手确认。

标准模块目录：

```text
xxx/
  dto/  vo/  services/  xxx.repository.ts  xxx.service.ts  xxx.controller.ts  xxx.module.ts
```

## 2. 读写决策表

| 场景                         | 推荐方式                                                                        |
| ---------------------------- | ------------------------------------------------------------------------------- |
| 租户内普通读写               | `BaseRepository` / `SoftDeleteRepository`                                       |
| 手写读查询且仍需租户隔离     | `TenantHelper.readWhereForDelegate(...)` 或 `TenantHelper.addTenantFilter(...)` |
| 跨租户 / 平台级查询          | `SystemPrismaService` + 显式权限校验                                            |
| 前端传入 `tenantId` 的写操作 | 禁止直接落库，必须由上下文注入                                                  |

## 3. 软删除语义

- 业务表以 `delFlag` 为准
- `OmsOrder.deleteTime` 仅审计
- 删除与读路径的软删语义由统一 middleware / extension 负责

## 4. 业务操作日志

涉及订单详情、会员详情等需要追溯的关键写操作：

- Controller 层优先加 `@LogOperation`
- 无法直接取得主体 ID 时，在 Service 成功后调用 `BizOperationLogService.append`
- 日志失败不得阻断主流程，但业务路径必须可追溯

### 何时必须补操作日志

| 场景                          | 做法                    |
| ----------------------------- | ----------------------- |
| 后台可见的关键写操作          | 优先 `@LogOperation`    |
| 真实主体 ID 不在 path/body 中 | Service 成功后 `append` |
| 仅内部辅助逻辑、无追溯要求    | 可不补，但先确认审计面  |

## 5. 字典治理

涉及新增/修改/废弃 `dictType`、字典项、展示文案时，必须同步：

1. `libs/common-constants/src/dict-governance/registry.ts`
2. `apps/backend/prisma/seed.ts`
3. 仍在使用的 init SQL 源

前端展示必须走字典系统，不允许新增硬编码选项数组。

## 6. backend 常见返工点

- 手写 Prisma 读查询时漏掉租户条件
- 任务只写了 `@Cron`，没有纳管到 `sys_job`
- 只改前端字典展示，没有补治理清单与 seed
- 写操作需要追溯却漏了操作日志
- 在高风险模块里顺手重构无关代码
