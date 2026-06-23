# miniapp-client 已退役（Phase 4）

**状态**：`retired` — 自 FAFAFA-PIVOT Phase 4 起，C 端由 `apps/c-web`（Nuxt 3 响应式 Web）承接。

## 说明

- 本目录**保留归档**，供对照 miniapp 业务与回归参考，不再参与默认 `pnpm lint` / `pnpm typecheck` / fafafa GitLab CI 构建。
- 生产部署已移除 `/h5/` 路由与 `h5` 容器；商城入口为 `/shop/`。
- 新功能请在 `apps/c-web` 实现。

## 本地调试（仅维护需要时）

```bash
pnpm dev:mp
pnpm build:mp
```
