# Scripts 治理脚本指引

## 1. 速览

- 适用范围：`scripts/**`
- 职责定位：仓库治理、质量门禁、类型/文档/结构检查脚本。
- 先读顺序：
  1. 根 `AGENTS.md`
  2. 本文件
  3. 涉及验证策略时读 `.codex/playbooks/verification-gates.md`
  4. 涉及文档规则时读 `docs/governance/DOCUMENT_POLICY.md`

新增脚本前先确认现有脚本是否可扩展。`scripts/` 是 Harness Engineering 的可执行规则层，不是一次性临时命令收纳处。复杂任务编排默认放在 `scripts/tasks/*.mjs`，root `package.json` 只暴露少量稳定公共入口。

## 2. 现有脚本分层

| 脚本                                   | 作用                                      |
| -------------------------------------- | ----------------------------------------- |
| `verify-monorepo.mjs`                  | monorepo 边界、依赖与结构校验             |
| `check-quality-gates.mjs`              | 质量门禁                                  |
| `check-admin-view-types.mjs`           | admin-web views 类型门禁                  |
| `check-dict-governance.mjs`            | 字典治理校验                              |
| `check-required-docs.mjs`              | 必需文档检查                              |
| `harness-doctor.mjs`                   | Harness 上下文、命令与关键工件体检        |
| `harness-manifest.mjs`                 | 检查项注册表；`pnpm harness:manifest`     |
| `eval-phase.mjs`                       | Phase DoD 重跑；`pnpm eval:phase`         |
| `check-exec-plan-presence.mjs`         | 大 diff 无 active plan 时 warn            |
| `tasks/verify-pr-slice.mjs`            | PR 自检：matrix 勾选 + exec-plan          |
| `tasks/quality-matrix-routes.mjs`      | 读取 `docs/quality-attributes/matrix.yml` |
| `harness-smoke.mjs`                    | 已启动服务的低成本可达性 smoke            |
| `check-commit-message.mjs`             | 提交信息检查                              |
| `tasks/changed-files.mjs`              | Git 变更文件修复与切片验证路由            |
| `tasks/generate-project-maps.mjs`      | 从 OpenAPI / 路由 / 页面源码生成项目地图  |
| `tasks/strict-report.mjs`              | admin-web / miniapp strict 非阻塞报告     |
| `tasks/package-scripts-governance.mjs` | root package scripts 公共 API 治理        |
| `tasks/test-scripts.mjs`               | 脚本测试聚合入口                          |
| `*.spec.mjs`                           | 脚本自身测试                              |

脚本改动优先保持“规则可解释、错误可修复”。错误信息应告诉维护者或智能体：哪里错、为什么错、如何改。

## 3. 新增或修改脚本原则

- 优先扩展已有脚本，避免新增功能重叠的平行工具链。
- 脚本默认从仓库根运行，路径处理使用稳定的根目录解析。
- 默认排除 `node_modules/`、`dist/`、`.turbo/`、`.codex/tmp/`、`.codex/runtime-logs/`、`db/`、`upload/`、`logs/`。
- root package scripts 只做公共入口；新增入口前先实现 `scripts/tasks/*.mjs`，再通过 `pnpm verify:scripts` 检查。
- 检查规则要尽量机械化，避免依赖人类主观判断。
- 阻塞型规则和提示型规则要区分清楚；不要把未成熟规则直接升级为阻塞门禁。
- 涉及删除、批量写入、迁移、数据回填的脚本属于高风险，必须先按根 `AGENTS.md` 停手确认。

## 4. 脚本测试约定

- 修改已有脚本时，优先同步更新对应 `*.spec.mjs`。
- 新增可长期维护的脚本时，默认补对应测试；如果只是接入已有规则，说明为什么不需要新增测试。
- 脚本测试入口优先使用 `pnpm test:scripts`。
- 不要为绕过失败而降低断言；连续失败时回到规则定义和输入样本。

## 5. 常见反模式

- 为一次性扫描新增长期脚本，却没有测试、文档和 package script 入口。
- 复制一个已有检查脚本后只改少量逻辑，形成两套规则。
- 错误信息只输出 `failed`，不给路径、规则名和修复方向。
- 脚本默认扫描运行数据、上传目录或构建产物，导致校验慢且噪声大。
- 在脚本里硬编码本地绝对路径、个人环境变量或敏感信息。

## 6. 验证建议

按改动选择：

- 单脚本快速验证：`node scripts/<script-name>.mjs`
- 脚本测试集：`pnpm test:scripts`
- 影响 pre-commit / pre-push 时，补跑对应 package script 中的脚本组合。

仅文档更新不需要跑脚本测试；脚本行为变更必须说明已执行或未执行的验证。
