# Libs 共享包指引

## 1. 速览

- 适用范围：`libs/common-types`、`libs/common-constants`、`libs/common-utils`
- 职责定位：跨 app 类型契约、共享常量与运行环境无关工具。
- 先读顺序：
  1. 根 `AGENTS.md`
  2. 本文件
  3. 涉及跨 app 契约时读 `.codex/playbooks/context-scan.md`
  4. 涉及验证时读 `.codex/playbooks/verification-gates.md`
  5. 涉及接口、DTO、返回字段或方案分析时读 `docs/governance/AGENT_OUTPUT_PROTOCOL.md`

`libs/**` 是跨 app 边界，不是任何单个 app 的私有扩展目录。触达 `libs/**` 默认按 `cross-app` 判断，除非只是纯文档或包内注释。

## 2. 目录与职责

```text
libs/
├── common-types/       # OpenAPI 生成类型与跨 app 类型契约
├── common-constants/   # 跨 app 共享常量、枚举、状态语义
└── common-utils/       # 运行环境无关纯工具
```

### 2.1 `common-types`

- 承载后端 OpenAPI 生成类型和跨端共享类型。
- 后端接口 / DTO / VO 是契约源头；前端不得在页面或 API 层手写同义类型绕过这里。
- 生成入口以根脚本 `pnpm generate-types` / `pnpm contracts:generate` 为准。
- 不手改由 OpenAPI 生成的契约文件来掩盖后端字段问题。

### 2.2 `common-constants`

- 放跨 app 共享常量、枚举、状态语义、字典治理相关稳定定义。
- 不放 app 私有文案、页面私有选项、临时筛选项。
- 涉及字典语义、状态文案、展示枚举时，先确认后端治理、seed 与前端消费链路。

### 2.3 `common-utils`

- 只放运行环境无关的纯工具。
- 禁止引入 Nest、Prisma、server-only provider、浏览器页面状态、uniapp 平台 API 或 app 私有业务流程。
- 工具函数应有清晰输入输出，不依赖全局运行时副作用。

## 3. 导入与导出边界

- 跨包导入只能走各包 `package.json` 的 `exports` 入口。
- 禁止从其他包或 app 直接 import `src/**`、`dist/**` 内部文件或相对源码路径。
- 新增公开入口时，必须同步检查对应包的 `package.json` `exports`、类型输出和调用方导入路径。
- `libs` 包不得依赖 `apps/**` 源码；如果出现需要依赖 app 的场景，说明职责方向反了。

## 4. 常见改动分类

| 改动类型         | 默认判断               | 必查项                         |
| ---------------- | ---------------------- | ------------------------------ |
| OpenAPI 类型生成 | `cross-app`            | 后端契约、生成命令、前端消费点 |
| 共享枚举 / 常量  | `cross-app`            | 是否真跨 app、是否涉及字典治理 |
| 纯工具函数       | `cross-app` 或包内闭环 | 运行环境无关性、调用方类型     |
| 包公开入口       | `cross-app`            | `exports`、构建输出、导入边界  |

## 5. 反模式

- 在 `common-types` 中手写与 backend DTO / VO 同义但独立演化的类型。
- 为某个页面的临时筛选项新增全局常量。
- 在 `common-utils` 中引入 Nest provider、Prisma Client、Pinia store、浏览器 `window` 或 uniapp API。
- 新增共享常量后，不检查 admin-web 与 miniapp-client 是否已有重复定义。
- 改了 backend 契约后，跳过 `pnpm generate-types`，直接在前端补兼容类型。

## 6. 验证建议

按改动影响选择：

- 契约生成：`pnpm generate-types`
- 受影响前端类型：`pnpm typecheck:admin`、`pnpm typecheck:h5`
- 共享包构建：`pnpm --filter @libs/common-types build`、`pnpm --filter @libs/common-constants build`、`pnpm --filter @libs/common-utils build`
- 涉及 monorepo 导入边界：`pnpm verify-monorepo`

是否执行完整链路由任务范围决定；跨 app 契约变更不得用单包验证替代完整验证链路。
