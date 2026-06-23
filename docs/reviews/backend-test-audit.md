---
title: Backend Test Audit
status: draft
doc_type: development
last_verified: 2026-05-12
---

# 后端测试审计记录

## 审计范围

- 审计对象：`apps/backend` 测试文件、后端测试命令、E2E / integration 配置。
- 审计方式：静态阅读 + 文件检索 + 最小命令验证；未执行全量测试。
- 第一批聚焦：测试门禁、E2E 稳定性、支付、订单、库存、租户隔离相关测试。
- 评判标准：不是“是否有 happy path”，而是核心不变量是否被边界、非法输入、重复请求、越权访问、空数据、边界分页、状态非法流转、资源不存在、幂等重复调用、并发冲突、部分失败回滚主动攻击过。

## 结论

当前后端测试数量不少，但对高风险业务的“反例构造”覆盖不足。现有测试更偏向 happy path、mock 协作和局部 smoke；对支付、订单、库存、租户隔离这类模块，还不能证明核心不变量在极端输入和竞态条件下成立。

阶段性结论：后端测试暂不达标，尤其不满足高风险模块的规格驱动测试要求。第一批问题集中在支付、订单、库存和测试门禁；第二批问题集中在后台认证、权限、角色授权、用户数据范围和租户管理；第三批问题集中在财务集成测试证明力、钱包冻结不变量、提现幂等、HTTP 入口和资金分页边界；第四批问题集中在优惠券核销状态、积分任务并发、营销 HTTP 入口、C 端占位接口和分页边界；第五批问题集中在商品 / 门店 / 通知 / LBS 的 HTTP 权限、外部副作用幂等、公开错误上报入口、LBS 非法坐标和少数自定义分页；第六批问题集中在全量测试索引、文件管理公开入口、SSE 手工鉴权、履约状态副作用、监控任务高风险操作、AI Prompt 权限粒度和大量 C 端 controller 的 route-level 覆盖缺失；第七批问题集中在 E2E 未复用生产 bootstrap、controller 覆盖债务、DTO validation 证明缺口和全局 guard / interceptor / tenant path 组合测试不足。

## 关键发现

### P1：默认测试门禁不覆盖 E2E

证据：

- `apps/backend/package.json` 的默认 Jest 配置只匹配 `src` 与 `test/unit` 下的 `*.spec.ts`。
- `apps/backend/test/jest-e2e.json` 单独匹配 `*.e2e-spec.ts`。
- 根 `package.json` 的 `test` 走 `pnpm test:scripts && turbo run test`。
- `.github/workflows/ci.yml` 执行 `pnpm test`，未看到 E2E 链路。

风险：

E2E 文件即使存在，也不会被默认后端测试或 CI 捕获。订单全链路、佣金、优惠券、积分、租户链路这类高风险场景可能长期漂移。

### P1：E2E 使用共享租户和共享数据，存在互相污染风险

证据：

- 多个 E2E 使用租户 `000000`。
- 多个 E2E 对默认数据执行 delete / upsert / update。
- E2E Jest 配置未声明串行运行。

风险：

测试之间可能互相污染，导致假阳性、假阴性或顺序依赖。共享租户下的测试也难以证明多租户隔离。

涉及示例：

- `apps/backend/test/order-full-chain.e2e-spec.ts`
- `apps/backend/test/commission-coupon-points.e2e-spec.ts`
- `apps/backend/test/tenant-000000-marketing-distribution.e2e-spec.ts`

### P1：integration 测试配置当前不可用

已执行命令：

```bash
pnpm --filter @apps/backend exec jest --config ./test/jest-integration.config.js --listTests
```

结果：

```text
Module <rootDir>/test/setup.ts in the setupFilesAfterEnv option was not found.
```

风险：

`jest-integration.config.js` 指向缺失的 `test/setup.ts`，且未发现对应 `test/integration` 目录。integration 层名义存在，但当前不能作为质量门禁。

### P1：支付回调测试缺少关键反例

当前覆盖：

- 订单已取消时触发退款。
- 已支付订单重复回调返回幂等结果。
- 取消竞态下触发退款。

缺口：

- 非法输入：金额不一致、支付单号缺失、回调字段异常。
- 资源不存在：订单不存在、支付记录不存在。
- 状态不允许流转：已退款、已关闭、已取消、异常状态再次支付成功。
- 幂等重复调用：同一回调并发到达，而不是顺序调用。
- 部分失败：订单已更新但 fulfillment / 积分 / 事件发布失败。
- 契约安全：签名失败、租户不匹配、回调来源不可信。

涉及位置：

- `apps/backend/src/module/client/payment/payment.service.spec.ts`
- `apps/backend/src/module/client/payment/payment.service.ts`

### P1：下单测试缺少非法输入、重复请求和并发边界

当前 `createOrder` 测试覆盖了正常下单、余额支付、优惠券、积分、地址快照、缺货等路径。

缺口：

- 空数据：`items = []`。
- 非法输入：`quantity = 0`、`quantity < 0`、缺失收货信息、非法 `skuId`。
- 资源不存在：商品、SKU、优惠券、地址不存在。
- 重复请求：同一用户同一购物车 / 同一优惠券重复提交。
- 幂等边界：网络重试导致重复创建订单。
- 越权访问：使用其他用户优惠券、地址或订单资源。
- 并发冲突：两个请求同时抢最后一件库存。

涉及位置：

- `apps/backend/src/module/client/order/order.service.spec.ts`
- `apps/backend/src/module/client/order/order.service.ts`

### P1：分页测试只覆盖正常第一页

当前 `listOrders` 只看到正常分页查询验证，未覆盖分页边界。

缺口：

- `pageNum = 0`
- `pageNum = -1`
- `pageSize = 0`
- `pageSize` 极大值
- 空列表
- 最后一页
- 超出最后一页
- 总数刚好整除 `pageSize`
- 总数不整除 `pageSize`

风险：

实现中直接使用 `(pageNum - 1) * pageSize` 和 `take: pageSize`，如果上游 DTO 校验或 pipe 漏掉，可能产生负 skip、零 take 或异常分页行为。测试没有把这个契约钉死。

涉及位置：

- `apps/backend/src/module/client/order/order.service.ts`
- `apps/backend/src/module/client/order/order.service.spec.ts`

### P1：库存测试没有证明并发下库存不为负

当前测试更多 mock `TenantSkuRepository.updateStockForTenant` 的返回值；仓储层已有 `updateStockForTenant`，但未看到对该当前方法的并发与不变量测试。

缺口：

- 同 SKU 并发扣减。
- 库存刚好等于需求量。
- 库存差 1。
- 释放超过已锁定库存。
- 回滚重复执行。
- `available_stock >= 0`、`locked_stock >= 0`、`sold_stock >= 0` 这类不变量未在测试中系统表达。

涉及位置：

- `apps/backend/src/module/store/stock/stock.service.ts`
- `apps/backend/src/module/store/product/tenant-sku.repository.ts`

### P2：越权访问测试语义不足

订单详情 / 取消逻辑按 `{ id, memberId }` 查询，现有测试更多覆盖“查不到就是不存在”，没有明确构造“用户 A 访问用户 B 的订单”。

库存相关的“租户无权限”用 `sku: null` 模拟，也没有构造真实跨租户数据关系。

风险：

资源不存在和越权访问在测试语义上被混在一起，无法证明服务端强制权限边界。

### P2：租户扩展测试存在规则歧义

部分测试断言“已有 tenantId 不被覆盖”。如果后端约定是从请求上下文强制注入 tenantId，那么允许调用方携带 tenantId 并保留它，会削弱服务端租户边界。

风险：

测试可能固化了不安全语义。这里需要先回到租户规格：到底是“调用方 tenantId 优先”还是“上下文 tenantId 永远覆盖”。

## 证据快照

- 后端测试文件总数：302。
- 按目录粗略分布：marketing 104、admin 43、finance 30、client 26、store 23、common 18、E2E/root test 11、notification 9、pms 7、lbs 6、unit 4。
- 未检出：`@ts-nocheck`、`.only`、`.skip`。
- property-based testing 当前只看到两个文件：
  - `apps/backend/test/unit/points-rule.property.spec.ts`
  - `apps/backend/test/unit/coupon-usage.property.spec.ts`

## 缺口矩阵

| 模块 / 链路     | 当前证据                     | 主要缺口                                                | 优先级 |
| --------------- | ---------------------------- | ------------------------------------------------------- | ------ |
| 测试门禁        | 默认 unit/spec 可跑          | E2E 未进默认 CI；integration 配置不可用                 | P1     |
| 支付回调        | 少量状态和幂等 case          | 非法输入、签名失败、资源不存在、并发幂等、部分失败      | P1     |
| 下单            | 正常下单、优惠券、积分、缺货 | 空 items、非法 quantity、重复提交、越权资源、并发抢库存 | P1     |
| 订单分页        | 正常第一页                   | 0、负数、极大 pageSize、空列表、最后一页、超页          | P1     |
| 订单详情 / 取消 | 不存在路径                   | 用户 A 访问用户 B 订单、非法状态取消、重复取消          | P1     |
| 库存            | service mock 和部分仓储测试  | 当前扣减方法并发测试、不变量测试、释放边界              | P1     |
| 租户隔离        | 注入与查询局部测试           | 跨租户 fixture、调用方 tenantId 覆盖规则                | P2     |
| E2E 全链路      | 有全链路文件                 | 共享租户、手动调用关键服务、未证明真实事件链路          | P2     |

## 第二批审计：认证、权限、后台系统模块

### 第二批范围

- `apps/backend/src/module/admin/auth/**`
- `apps/backend/src/module/admin/common/guards/**`
- `apps/backend/src/module/admin/system/user/**`
- `apps/backend/src/module/admin/system/role/**`
- `apps/backend/src/module/admin/system/menu/**`
- `apps/backend/src/module/admin/system/dept/**`
- `apps/backend/src/module/admin/system/dict/**`
- `apps/backend/src/module/admin/system/tenant/**`
- `apps/backend/test/admin-auth.e2e-spec.ts`

### 第二批结论

后台认证与系统模块已有不少 service 级测试，`JwtAuthGuard`、`PermissionGuard`、`TokenService`、`AccountLockService` 也有一定覆盖。但这些测试仍不足以证明后台权限安全，因为关键缺口集中在“路由级真实鉴权”和“权限数据状态变更”：

- 多数 `system/*` 模块只有 service spec，没有 controller spec 或 E2E 覆盖真实 `JwtAuthGuard + PermissionGuard + RolesGuard + ValidationPipe` 链路。
- `RolesGuard` 没有测试，并且实现直接访问 `req.user.roles` / `roles.some`，未登录或会话缺角色数组时可能抛异常。
- `RoleService` 测试直接允许操作 `roleId=1`，而实现没有保护超级管理员 / 系统角色的停用和删除。
- `UserRoleService`、`UserAuthService`、`UserProfileService` 等实际承载权限和账号安全的子服务没有独立 spec，`UserService` 测试大量 mock 这些子服务，不能证明真实逻辑。
- `TenantService` 测试只覆盖 `syncTenantPackage` 的少数路径，没有覆盖租户创建、更新、删除、动态切换和跨租户边界。

### P1：后台系统路由缺少真实鉴权测试

证据：

- `user`、`role`、`menu`、`dept`、`dict`、`tenant` 控制器上大量使用 `@RequirePermission` 或 `@RequireRole`。
- 未发现这些模块对应的 controller spec 或 E2E 测试。
- 现有 `admin-auth.e2e-spec.ts` 只覆盖 `send-login-code` 的合法 / 非法手机号和微信回调占位。

缺口：

- 未登录访问后台系统接口应返回 403 / 401。
- 无权限用户访问 `system:user:add`、`system:role:edit`、`system:tenant:remove` 等接口应被拒绝。
- 有 token 但权限缺失应被 `PermissionGuard` 拦截。
- 有普通角色但缺少 `admin` 角色时，`@RequireRole('admin')` 接口应被拒绝。
- 超级管理员 `*:*:*` 是否能通过所有受保护接口没有路由级证明。

涉及位置：

- `apps/backend/src/module/admin/system/user/user.controller.ts`
- `apps/backend/src/module/admin/system/role/role.controller.ts`
- `apps/backend/src/module/admin/system/menu/menu.controller.ts`
- `apps/backend/src/module/admin/system/dept/dept.controller.ts`
- `apps/backend/src/module/admin/system/dict/dict.controller.ts`
- `apps/backend/src/module/admin/system/tenant/tenant.controller.ts`
- `apps/backend/test/admin-auth.e2e-spec.ts`

### P1：`RolesGuard` 没有测试，且缺少空用户 / 空角色防御

证据：

- `PermissionGuard` 有 spec，覆盖 `req.user` 缺失和权限数组缺失。
- 未发现 `roles.guard.spec.ts`。
- `RolesGuard` 中直接调用 `this.hasRole(role, req.user.roles)`，`hasRole` 中直接调用 `roles.some(...)`。

风险：

当接口要求 `@RequireRole('admin')`，但请求未建立 `req.user` 或 Redis 会话中缺少 `roles` 字段时，可能不是稳定返回 403，而是抛运行时异常。`UserController` 的 `authRole`、`updateAuthRole`、`changeStatus` 都依赖 `@RequireRole('admin')`。

涉及位置：

- `apps/backend/src/module/admin/common/guards/roles.guard.ts`
- `apps/backend/src/module/admin/system/user/user.controller.ts`

### P1：角色服务测试固化了可操作超级管理员角色的危险行为

证据：

- `RoleService.changeStatus` 直接按 `roleId` 更新状态，没有禁止 `roleId=1`。
- `RoleService.remove` 直接对传入 `roleIds` 批量软删除，没有过滤或拒绝 `roleId=1`。
- `role.service.spec.ts` 的 `changeStatus` 用例使用 `roleId: 1` 并期望成功。
- `role.service.spec.ts` 的 `remove` 用例传入 `[1, 2]` 并期望成功。

风险：

如果 `roleId=1` 是超级管理员角色，当前测试不仅没有防御这个反例，还把“停用 / 删除系统角色”写成了期望行为。权限系统的不变量应该至少包括：超级管理员角色不能被停用、不能被删除、不能被普通角色授予、不能被租户管理员改写。

涉及位置：

- `apps/backend/src/module/admin/system/role/role.service.ts`
- `apps/backend/src/module/admin/system/role/role.service.spec.ts`

### P1：角色授权子服务没有独立测试

证据：

- 未发现 `user-role.service.spec.ts`。
- `UserService` spec 通过 mock `UserRoleService` 覆盖外层委托，无法证明真实授权逻辑。

缺口：

- `updateAuthRole` 传入 `roleIds='1'`、空字符串、重复 ID、非法 ID。
- `authUserSelectAll` 是否允许批量绑定 `roleId=1`。
- `authUserCancel` / `authUserCancelAll` 是否允许移除管理员自己的关键角色。
- 用户、角色、部门跨租户时是否会被 `TenantHelper` 强制隔离。
- 重复授权是否保持幂等。

涉及位置：

- `apps/backend/src/module/admin/system/user/services/user-role.service.ts`
- `apps/backend/src/module/admin/system/user/user.service.spec.ts`

### P1：用户数据范围没有直接测试

证据：

- `UserService.findAll` 会根据当前用户角色的 `dataScope` 拼接查询条件。
- `user.service.spec.ts` 未看到 `findAll` / `buildDataScopeConditions` 的直接用例。
- `DeptService.findDeptIdsByDataScope` 有测试，但它不能替代用户列表最终 where 条件验证。

缺口：

- `DATA_SCOPE_ALL`：不追加部门限制。
- `DATA_SCOPE_SELF`：只能看到自己。
- `DATA_SCOPE_DEPT`：只能看到本部门。
- `DATA_SCOPE_DEPT_AND_CHILD`：包含子部门。
- `DATA_SCOPE_CUSTOM`：只包含角色绑定部门。
- 多角色混合时的优先级，例如 ALL 覆盖 SELF，CUSTOM 与 DEPT 合并。
- `currentUser` 为空时是否应该返回空范围，还是拒绝访问。

风险：

用户列表是后台越权访问的高风险入口。只测试 `DeptService` 不足以证明 `UserService.findAll` 最终没有漏掉数据权限过滤。

涉及位置：

- `apps/backend/src/module/admin/system/user/user.service.ts`
- `apps/backend/src/module/admin/system/user/user.service.spec.ts`

### P1：认证 E2E 没覆盖登录、刷新、登出、锁定闭环

已有覆盖：

- AuthService 单测覆盖验证码、租户列表、禁止管理员公开注册、短信登录 / 重置的局部逻辑。
- TokenService 单测覆盖 token type、黑名单、会话不存在、过期 token。
- AccountLockService 单测覆盖失败计数和锁定阈值。
- JwtAuthGuard 单测覆盖白名单、无 token、非法 token、合法 token、`/client/*` 放行。

缺口：

- `POST /auth/login` 账号密码真实路由级测试。
- 密码错误 5 次后的锁定、锁定后再次登录、成功后清除失败计数。
- 登录时 header `tenant-id` 与 body `tenantId` 冲突时的优先级。
- `POST /auth/refresh` 使用同一个 refresh token 并发刷新，是否只成功一次。
- `POST /auth/logout` 是否清理正确 Redis key，重复 logout 是否幂等。
- 禁用用户 / 删除用户持旧 token 访问后台系统接口是否被拒绝。

风险：

底层 service 有单测，但真实路由上还叠加了 `TenantContext`、`ValidationPipe`、锁定服务、token pair 转换、Redis 会话和全局 guard。当前 E2E 没有证明这些组合在极端条件下成立。

涉及位置：

- `apps/backend/src/module/admin/auth/auth.controller.ts`
- `apps/backend/src/module/admin/auth/auth.service.spec.ts`
- `apps/backend/src/module/admin/auth/services/token.service.spec.ts`
- `apps/backend/src/module/admin/auth/services/account-lock.service.spec.ts`
- `apps/backend/test/admin-auth.e2e-spec.ts`

### P1：refresh token 并发幂等未证明

证据：

- `TokenService.refreshToken` 的顺序是：验证 token -> 查黑名单 -> 查会话 -> 写黑名单 -> 生成新 token。
- 单测覆盖的是顺序调用下的黑名单、会话缺失和过期 token。

缺口：

没有构造两个并发请求使用同一个 refresh token 的场景。如果两个请求同时通过“查黑名单”再写入黑名单，可能双发新 token。这个测试需要模拟 Redis 原子性或用集成测试验证实际 Redis 行为。

涉及位置：

- `apps/backend/src/module/admin/auth/services/token.service.ts`
- `apps/backend/src/module/admin/auth/services/token.service.spec.ts`

### P1：租户管理测试范围过窄

证据：

- `tenant.service.spec.ts` 只看到 `syncTenantPackage` 的成功路径和超级租户拒绝路径。

缺口：

- 创建租户：租户 ID 重复、企业名称重复、弱密码、套餐不存在、账号数边界、地理配置部分失败回滚。
- 更新租户：租户不存在、企业名称冲突、结算配置 upsert、站点同步失败、状态非法流转。
- 删除租户：超级租户删除、已有关联业务数据的租户删除、重复删除、批量删除部分不存在。
- 动态租户切换：非超级管理员切换、目标租户不存在、停用租户、重复切换、清除动态租户。
- 跨租户：普通租户用户是否能读取 / 修改其他租户。

风险：

租户是系统级隔离边界。只测套餐同步不能证明租户生命周期安全。

涉及位置：

- `apps/backend/src/module/admin/system/tenant/tenant.service.ts`
- `apps/backend/src/module/admin/system/tenant/tenant.service.spec.ts`

### P2：系统模块 DTO / ValidationPipe 缺少反例测试

证据：

- 全局 `ValidationPipe` 启用了 `transform: true`、`whitelist: true`、`forbidNonWhitelisted: true`。
- 第二批范围内未发现独立 DTO validation spec。
- `admin-auth.e2e-spec.ts` 只覆盖了短信手机号非法输入。

缺口：

- 登录：空 username、空 password、多余字段、超长字段。
- refresh：空 refreshToken、access token 冒充 refresh token。
- 用户：非法 email、弱密码、非法 status、`roleIds` 不是数组、`postIds` 不是数组。
- 角色：空 roleName、非法 dataScope、非法 status、menuIds 含非法值。
- 菜单：非法 menuType、非法 visible/status、空 path、非法 sort items。
- 部门：负 parentId、非法 email、移动到非法父级。
- 字典：空 dictType、空 dataList、重复 sort、非法 status。
- 租户：弱密码、非法账号数、非法 settlement enum、非法经纬度、超长字段。

风险：

service spec 直接传对象会绕过 DTO 和 ValidationPipe，不能证明 HTTP 入口会拒绝非法输入。

### P2：部分后台查询端点的权限语义没有规格化

发现以下端点只依赖登录态或没有明确 `@RequirePermission` / `@RequireRole`，可能是有意作为通用选项接口，也可能是漏配权限：

- `GET /system/user/getInfo`
- `GET /system/user/optionselect`
- `GET /system/user/list/dept/:deptId`
- `GET /system/role/optionselect`
- `GET /system/dept/optionselect`
- `GET /system/menu/getRouters`
- `GET /system/menu/tenantPackageMenuTreeselect/:packageId`
- `GET /system/dict/data/:id`
- `GET /system/dict/data/type/:id`

风险：

如果这些接口本意是“任意已登录后台用户可访问”，需要测试证明它们仍受租户和数据范围约束；如果本意需要权限，则当前缺少路由级反例测试来发现漏配。

### P2：字典和部门 service 覆盖相对较多，但仍缺路由级和异常链路

相对较好的覆盖：

- `DeptService` 测了父子层级、移动、删除、空树、数据范围辅助方法。
- `DictService` 测了类型 / 数据增删改查、重复校验、缓存、导入、排序、统计。

仍然缺少：

- controller 权限和 DTO validation。
- 批量删除包含非法 ID、重复 ID、部分不存在 ID。
- 导入字典时 `dataList=[]`、重复 dictValue、跨租户同名 dictType。
- 缓存清理失败、DB 写成功但缓存清理失败的行为约定。

## 第二批缺口矩阵

| 模块 / 链路          | 当前证据              | 主要缺口                                        | 优先级 |
| -------------------- | --------------------- | ----------------------------------------------- | ------ |
| Auth E2E             | 3 个轻量接口 E2E      | login / refresh / logout / lock 闭环缺失        | P1     |
| JwtAuthGuard         | 有单元测试            | 缺与系统路由组合的 E2E 权限验证                 | P2     |
| PermissionGuard      | 有单元测试            | 缺 route-level 403 验证                         | P1     |
| RolesGuard           | 无 spec               | 空 user / 空 roles / 非 admin 访问未测          | P1     |
| RoleService          | service spec          | 测试允许 `roleId=1` 停用 / 删除，缺系统角色保护 | P1     |
| UserRoleService      | 无独立 spec           | 超管角色授权、重复授权、跨租户授权未测          | P1     |
| UserService.findAll  | 未见直接测试          | 数据范围、越权列表、空 currentUser 未测         | P1     |
| TenantService        | 仅套餐同步局部测试    | 创建 / 更新 / 删除 / 动态切换 / 跨租户未测      | P1     |
| DTO / ValidationPipe | 只有少量 E2E 间接覆盖 | 非法输入、多余字段、弱密码、非法 enum 未测      | P2     |
| Dept / Dict          | service 覆盖较多      | controller 权限、批量异常、缓存失败未测         | P2     |

## 第三批审计：财务、佣金、钱包、提现

### 第三批范围

- `apps/backend/src/module/finance/**`
- `apps/backend/src/module/admin/finance/**`
- `apps/backend/src/module/store/finance/**`
- `apps/backend/src/module/client/finance/**`
- `apps/backend/src/module/payment/**`
- `apps/backend/src/module/client/payment/**`
- `apps/backend/test/commission-flow.e2e-spec.ts`
- `apps/backend/test/commission-coupon-points.e2e-spec.ts`

### 第三批结论

财务模块的测试表面积比前两批更强。佣金、钱包、提现、结算、对账、门店财务都有较多 service spec，且已经覆盖了一部分真正有价值的反例：

- 钱包：金额上限、余额不足、待回收余额、退款冲减、冻结余额不足。
- 提现：单日次数 / 金额限制、重复提交锁、余额不足、租户不匹配、非法审核动作、已处理状态。
- 佣金：自购、黑名单、跨租户、跨店、退款取消、循环推荐、优惠券 / 积分参与计算。
- 结算与对账：租户范围、状态筛选、对账批次、异常记录、部分失败继续处理。
- 门店财务：深分页保护、导出上限、统计空数据。

但第三批仍不能判定达标。核心原因不是“没有测试”，而是部分高风险场景的测试证明力不足，尤其是集成测试空转、冻结余额不变量、提现业务幂等、controller / guard / DTO 组合链路和资金分页边界。

### P1：`finance.integration.spec.ts` 是 mock 流程，不应计为真实集成证明

证据：

- 文件说明为“Finance 模块集成测试（Mock 版本）”。
- 多个“完整流程”用例只设置 mock 数据，然后断言 `mockPrismaService.finCommission.create`、`finWithdrawal.create`、`finWithdrawal.update`、`finWallet.update` 等 mock 函数 `toBeDefined()`。
- “余额100元，并发申请3次50元提现，只有2次成功”没有实际并发调用提现服务，只断言 `finWallet.findUnique` 存在。
- “跨店日限额1000元，并发计算超限佣金”直接调用 mock Redis 的 `incrby`，没有通过真实佣金服务验证第三次被拒绝。
- “性能测试”主要验证常量和 mock 返回值，没有运行真实批处理或分页查询。

风险：

这些测试会给人“完整流程、并发、性能已覆盖”的错觉，但它们没有执行真实业务服务、事务、锁、状态流转或事件链路。财务模块最需要证明的是资金不变量，而不是 mock 方法存在。

涉及位置：

- `apps/backend/src/module/finance/finance.integration.spec.ts`

### P1：钱包冻结余额不变量没有被证明

已有覆盖：

- `freezeBalance` 使用 `freezeBalanceAtomic`，测试覆盖了余额充足、余额不足、金额超限。
- `deductBalance` 使用 `deductBalanceAtomic`，测试覆盖了余额不足。

缺口：

- `unfreezeBalance` 直接对 `balance` increment、`frozen` decrement。
- `deductFrozen` 直接对 `frozen` decrement。
- 测试只覆盖了解冻成功和扣减冻结成功，没有覆盖冻结余额不足、重复解冻、重复扣减、并发解冻和并发扣减。
- 未测试不变量：`frozen >= 0`、`balance >= 0`、提现拒绝只能释放已冻结金额、提现成功只能扣减已冻结金额。

风险：

如果上游重复调用审核、重试任务或对账补偿，`frozen` 可能被多次 decrement。当前 service spec 没有构造能击穿“冻结余额不会变负”的反例。

涉及位置：

- `apps/backend/src/module/finance/wallet/wallet.service.ts`
- `apps/backend/src/module/finance/wallet/wallet.service.spec.ts`

### P1：提现防重复是短锁，不是业务幂等

证据：

- `WithdrawalService.apply` 使用 Redis key `withdrawal:apply:${memberId}`，TTL 为 3 秒。
- 成功路径不会删除锁，失败路径会删除锁。
- 现有测试覆盖的是获取锁失败时抛“请勿重复提交”，也就是短时间重复提交。

缺口：

- 同一个提现请求在 3 秒后重放，是否会创建第二笔提现申请。
- 客户端超时后重试，第一笔已经冻结成功但响应丢失，第二次请求如何识别同一业务请求。
- 同一用户不同租户、不同提现渠道、不同请求体共用 `memberId` 锁的语义是否正确。
- `freezeBalance` 成功后，`withdrawalRepo.create` 或 `emitWithdrawalApplied` 失败时，数据库回滚、Redis 锁、事件副作用是否一致。

风险：

短锁只能防止瞬时连点，不能证明资金业务幂等。高风险资金入口应有业务 idempotency key、唯一约束或可复现的请求签名，并用测试证明重复请求只产生一笔冻结 / 提现。

涉及位置：

- `apps/backend/src/module/finance/withdrawal/withdrawal.service.ts`
- `apps/backend/src/module/finance/withdrawal/withdrawal.service.spec.ts`

### P1：钱包队列幂等没有覆盖服务直调和批处理细节

证据：

- `WalletProcessor` 使用 `wallet:idempotency:${data.idempotencyKey}` 做 24 小时幂等缓存。
- `WalletService.addBalance`、`deductBalance`、`freezeBalance`、`unfreezeBalance` 本身没有 idempotency key 参数。
- `WalletProcessor.handleBatchSettle` 对每个 item 直接调用 `walletService.addBalance`，批内单条失败只收集错误。

缺口：

- 重复队列任务是否只入账一次。
- `idempotencyKey` 缺失、空字符串、不同任务类型复用同一 key 时如何处理。
- 批量结算中同一 `commissionId` 重复出现是否会重复入账。
- 处理成功但写入幂等缓存失败，任务重试是否重复入账。
- 批处理部分成功后重试，已成功 item 是否会再次入账。

风险：

钱包队列的幂等点在 processor 层，资金增减的真实副作用在 service 层。测试必须证明消息重复、缓存失败、批内重复、部分成功重试都不会造成重复入账。

涉及位置：

- `apps/backend/src/module/finance/wallet/wallet.processor.ts`
- `apps/backend/src/module/finance/wallet/wallet.service.ts`

### P1：财务 HTTP 层缺少权限、租户和 DTO 反例

证据：

- 财务相关 controller 覆盖 admin、store、client 三类入口。
- admin / store controller 大量使用 `@RequirePermission`。
- client finance controller 使用 `@UseGuards(MemberAuthGuard)`。
- 未发现这些 controller 对应的 controller spec。
- E2E 只看到佣金优惠券积分相关文件，未覆盖财务 controller 的权限和 DTO 链路。

缺口：

- 未登录访问 `client/finance/wallet`、`client/finance/withdrawal/apply`。
- 会员 A 访问会员 B 的提现、流水或佣金。
- admin / store 用户无 `finance:*`、`store:finance:*` 权限访问财务接口。
- 普通租户访问其他租户钱包、提现、结算单、对账结果。
- `ApplyWithdrawalDto` 金额为 0、负数、超大、字符串、NaN、Infinity、多余字段。
- 导出类接口超大条件、空条件、非法日期范围。

风险：

资金 service 单测不能替代 HTTP 层，因为真实入口还叠加了 `MemberAuthGuard`、`RequirePermission`、DTO 转换、租户上下文和导出响应。越权、非法输入和空数据必须在 route-level 测试里证明。

涉及位置：

- `apps/backend/src/module/client/finance/client-finance.controller.ts`
- `apps/backend/src/module/admin/finance/admin-finance.controller.ts`
- `apps/backend/src/module/admin/finance/admin-settlement.controller.ts`
- `apps/backend/src/module/store/finance/store-finance.controller.ts`
- `apps/backend/src/module/finance/withdrawal/withdrawal.controller.ts`
- `apps/backend/src/module/finance/settlement/settlement.controller.ts`

### P2：资金分页边界覆盖不统一

已有覆盖：

- 门店 ledger 测试覆盖了深分页保护和导出上限。

缺口：

- `WalletService.getTransactions(memberId, page, size)` 直接使用 `(page - 1) * size` 和 `take: size`，测试只覆盖 `page=1,size=20` 和钱包不存在。
- client finance 的提现、佣金、流水列表未看到 route-level 分页边界。
- admin finance 的 wallet、withdrawal、commission、settlement、reconcile 列表未看到统一分页边界。

应补反例：

- `page = 0`
- `page = -1`
- `pageSize = 0`
- `pageSize` 极大值
- 空列表
- 最后一页
- 超出最后一页
- 总数刚好整除 `pageSize`
- 总数不整除 `pageSize`

涉及位置：

- `apps/backend/src/module/finance/wallet/wallet.service.ts`
- `apps/backend/src/module/client/finance/client-finance.controller.ts`
- `apps/backend/src/module/admin/finance/admin-finance.controller.ts`
- `apps/backend/src/module/admin/finance/admin-settlement.controller.ts`
- `apps/backend/src/module/store/finance/store-finance.controller.ts`

### P2：金额精度和非法数值测试仍偏散点

已有覆盖：

- 多数资金 service 使用 `Decimal`。
- 提现覆盖了低于最小金额、超过单笔上限。
- 提现手续费测试覆盖当前配置为 0 的结果。

缺口：

- `NaN`、`Infinity`、字符串数值、超高精度小数。
- 手续费非 0 时的费率、最低手续费、四舍五入或截断策略。
- 金额单位边界，例如 0.01、0.001、最大值、最大值加 0.01。
- 佣金计算中优惠券、积分、退款、部分退款叠加时的精度不变量。
- property-based testing 目前没有覆盖财务金额守恒。

建议不变量：

```text
钱包余额不能小于 0
冻结余额不能小于 0
待回收余额不能小于 0
提现 actualAmount = amount - fee
同一提现申请最多冻结一次
同一结算佣金最多入账一次
退款冲减不能让 totalIncome 小于 0
```

### 第三批缺口矩阵

| 模块 / 链路             | 当前证据                       | 主要缺口                                        | 优先级 |
| ----------------------- | ------------------------------ | ----------------------------------------------- | ------ |
| Finance integration     | mock 版完整流程                | 未执行真实服务 / 事务 / 并发 / 事件链路         | P1     |
| WalletService           | service spec 较多              | 解冻 / 扣减冻结余额未证明 `frozen >= 0`         | P1     |
| WalletProcessor         | 有 processor 幂等设计          | 重复任务、缓存失败、批内重复、部分成功重试      | P1     |
| WithdrawalService.apply | 日限额、余额不足、短锁重复提交 | 业务幂等、TTL 后重放、冻结后失败回滚            | P1     |
| Finance controllers     | controller 权限装饰器存在      | route-level 未登录 / 无权限 / 跨租户 / DTO      | P1     |
| 财务分页                | store ledger 覆盖深分页        | wallet / admin / client 列表分页边界不统一      | P2     |
| 金额精度                | Decimal 和部分边界             | NaN / Infinity / 小数精度 / 非 0 手续费未系统测 | P2     |
| 佣金与结算              | service spec 相对丰富          | property-based 资金守恒、重复结算幂等仍不足     | P2     |

## 第四批审计：营销、优惠券、积分、活动

### 第四批范围

- `apps/backend/src/module/marketing/**`
- `apps/backend/src/module/client/marketing/**`
- `apps/backend/test/unit/coupon-usage.property.spec.ts`
- `apps/backend/test/unit/points-rule.property.spec.ts`
- `apps/backend/test/unit/coupon-template.service.spec.ts`
- `apps/backend/test/unit/points-account.service.spec.ts`
- `apps/backend/test/commission-coupon-points.e2e-spec.ts`
- `apps/backend/test/tenant-000000-marketing-distribution.e2e-spec.ts`

### 第四批结论

营销模块是目前审计到的测试覆盖最强的一批。它不是单纯 happy path，已经有不少反例意识：

- `coupon-usage.property.spec.ts` 使用 fast-check 覆盖优惠券金额、有效期、适用商品 / 分类、状态转换。
- `points-rule.property.spec.ts` 使用 fast-check 覆盖积分计算、积分抵扣、上限比例、系统关闭等性质。
- `state-machine.config.spec.ts` 系统列出了营销实例合法 / 非法状态流转、终态和状态描述。
- `PointsAccountService`、`PointsLotLedgerService` 覆盖了冻结、解冻、结算、退款、lot 分摊和降级策略。
- `MarketingStockService` 覆盖了 `STRONG_LOCK`、`LAZY_CHECK`、缓存丢失、DB 兜底、释放名额。
- 活动、配置、审批、拼课、灰度、场景解析、缓存清理等模块都有 service 级反例。

但第四批仍不能判定完全达标。原因是：测试覆盖面广，不等于关键业务不变量已经闭合。优惠券核销、积分任务完成、营销 C 端入口、管理端权限和分页边界仍有可击穿点。

### P1：优惠券 `useCoupon` 没有校验原子状态更新结果

证据：

- `UserCouponRepository.useCoupon` 只会把 `status=LOCKED` 的券更新为 `USED`，返回 `updateMany` 结果。
- `CouponUsageService.useCoupon` 调用 `userCouponRepo.useCoupon(userCouponId)` 后没有检查 `updated.count`。
- `CouponUsageService.useCoupon` 也没有在 service 层校验当前券必须是 `LOCKED`。
- 随后它会继续创建 `usageRepo.create(...)` 使用记录并发送 `COUPON_USED` 事件。
- 现有 `usage.service.spec.ts` 和 `coupon-usage.property.spec.ts` 只验证调用了 `useCoupon`，没有构造 `updateMany.count = 0` 的反例。

风险：

当优惠券已经 `USED`、`UNUSED`、`EXPIRED`、已被其他订单锁定，或重复支付回调再次调用 `useCoupon` 时，仓储层可能没有更新任何券，但 service 仍然可能写入使用记录和发送已使用事件。这会击穿“同一张券最多核销一次”的不变量。

涉及位置：

- `apps/backend/src/module/marketing/coupon/usage/usage.service.ts`
- `apps/backend/src/module/marketing/coupon/distribution/user-coupon.repository.ts`
- `apps/backend/src/module/marketing/coupon/usage/usage.service.spec.ts`
- `apps/backend/test/unit/coupon-usage.property.spec.ts`

### P1：优惠券发放缺少事件失败后的幂等反例

证据：

- `CouponDistributionService.claimCouponInternal` 在 `$transaction` 中扣减库存并创建用户券。
- 事务完成后再 `await eventEmitter.emitAsync(...)`。
- 如果事件发送失败，方法会抛错，调用方看到失败，但券可能已经创建、库存已经扣减。
- 现有测试覆盖了领取成功、库存为 0、领取上限、模板停用、手动发放上限，但未覆盖“DB 成功、事件失败、客户端重试”。

缺口：

- 事件失败后是否回滚用户券和库存。
- 客户端重试同一次领取，是否会重复发券。
- `limitPerUser > 1` 时重复请求是否被业务幂等键识别为同一次请求。
- `memberIds` 中出现重复 memberId 的手动发放是否只发一次，还是按数组重复发放。

风险：

优惠券发放不是资金，但会影响订单优惠、佣金基数和库存。这里需要证明 `remainingStock` 不会被重复扣减，用户不会因为重试拿到多张本不该拿的券。

涉及位置：

- `apps/backend/src/module/marketing/coupon/distribution/distribution.service.ts`
- `apps/backend/src/module/marketing/coupon/distribution/distribution.service.spec.ts`
- `apps/backend/src/module/marketing/coupon/coupon.integration.spec.ts`

### P1：积分任务完成缺少并发幂等证明

证据：

- `PointsTaskService.completeTask` 的顺序是：查询任务 -> `checkTaskEligibility` 统计完成次数 -> `accountService.addPoints` -> `completionRepo.create`。
- `checkTaskEligibility` 是读取完成次数，不是原子占位。
- `PointsAccountService.addPoints` 没有业务 idempotency key。
- 现有测试覆盖任务不存在、任务停用、不可重复任务已完成、最大次数、正常完成，但没有构造两个并发请求同时完成同一不可重复任务。

风险：

两个并发请求可能都在 `countUserCompletions = 0` 时通过资格检查，然后各自发放积分并创建完成记录。如果数据库层没有唯一约束兜底，积分可能重复发放。

涉及位置：

- `apps/backend/src/module/marketing/points/task/task.service.ts`
- `apps/backend/src/module/marketing/points/task/task.service.spec.ts`
- `apps/backend/src/module/marketing/points/account/account.service.ts`

### P1：营销 HTTP 入口缺少真实权限、租户和 DTO 测试

证据：

- 营销管理端 controller 大量使用 `@RequirePermission`，例如活动、配置、券模板、券发放、积分账户、场景、策略、解析模拟。
- C 端 controller 大量使用 `@UseGuards(MemberAuthGuard)`，例如领券、积分、活动实例、场景商品、活动专区。
- 第四批只看到少数 controller spec，它们多为直接调用 controller 方法或 mock service；未看到覆盖这些营销路由的真实 E2E 权限链路。
- 第一批已记录 E2E 默认不进入 `pnpm test` / CI。

缺口：

- 未登录访问 C 端领券、积分签到、积分明细、活动实例详情。
- 会员 A 访问会员 B 的活动实例、积分 lot、优惠券列表。
- 无 `marketing:*` 权限的后台用户访问活动、券模板、积分调整、营销配置。
- 普通租户访问其他租户的活动配置、优惠券模板、积分账户和领取记录。
- DTO 多余字段、非法 enum、非法日期范围、负数金额、超长数组。

风险：

营销模块既有 C 端权益入口，也有后台运营入口。service 级测试无法证明 guard、permission、tenant context、ValidationPipe 的组合边界。

涉及位置：

- `apps/backend/src/module/marketing/**/*.controller.ts`
- `apps/backend/src/module/client/marketing/**/*.controller.ts`

### P1：C 端可领券接口仍是占位返回，测试未发现

证据：

- `ClientCouponController.getAvailableCoupons` 当前返回 `{ message: '功能开发中' }`。
- 该 controller 带有 `@UseGuards(MemberAuthGuard)` 并暴露 `GET client/marketing/coupon/available`。
- 未看到对应 controller spec 或 E2E 校验该接口真实返回可领取优惠券列表。

风险：

这是用户可见接口。现有测试没有阻止一个占位实现留在正式路由中，也没有证明 C 端可领券列表与模板状态、库存、领取上限、租户、会员身份一致。

涉及位置：

- `apps/backend/src/module/client/marketing/coupon/client-coupon.controller.ts`

### P2：营销分页边界覆盖不均

已有较好覆盖：

- 一些 C 端聚合 / 专区服务有 `normalizePageParams`，会限制 `pageNum >= 1`、`pageSize <= MAX_PAGE_SIZE`。
- 部分统计导出有 10000 条上限测试。

缺口：

- `PointsAssetQueryService.resolvePage` 使用 `Number(query.pageNum || 1)` 和 `Math.min(Number(query.pageSize || 10), 100)`，没有 `Math.max`；`pageNum=-1`、`pageSize=-1` 可能产生负 skip / take。
- `ActivityRepository.findPage` 直接使用 `(pageNum - 1) * pageSize` 和 `take: pageSize`，依赖上游校验，但未看到统一边界测试。
- `ClientCouponController.getMyCoupons` 直接把 `pageNum` / `pageSize` 透传给 repository，未看到 0、负数、极大值、空列表、超页测试。
- `PointsAccountService.getAccountsForAdmin` 和 `getTransactionsForAdmin` 使用 `query.pageNum || 1`、`query.pageSize || 10`，负数不会被修正。

风险：

营销模块列表入口很多，分页边界不统一会让某些接口具备稳定保护，另一些接口仍可能产生负 skip、负 take 或极大 pageSize。

涉及位置：

- `apps/backend/src/module/marketing/points/account/points-asset-query.service.ts`
- `apps/backend/src/module/marketing/activity/activity.repository.ts`
- `apps/backend/src/module/client/marketing/coupon/client-coupon.controller.ts`
- `apps/backend/src/module/marketing/points/account/account.service.ts`

### P2：mock integration 不等于真实跨组件集成

证据：

- `coupon.integration.spec.ts` 注释明确为“Mock 仓储”，实际使用 mock repo、mock Redis lock、mock Prisma transaction。
- `points.integration.spec.ts` 注释明确为“使用 Mock 仓储”，实际使用 mock repo、mock lotLedger、mock eventEmitter。
- 这些测试会真实调用 service，比第三批的空转 mock 更有价值，但仍不能证明真实 Prisma、Redis、事务隔离、唯一约束、事件失败和租户 helper。

风险：

这些测试适合作为 service collaboration spec，不适合作为“集成测试门禁”。如果后续质量报告把它们当作真实 integration，会高估优惠券和积分链路的可靠性。

涉及位置：

- `apps/backend/src/module/marketing/coupon/coupon.integration.spec.ts`
- `apps/backend/src/module/marketing/points/points.integration.spec.ts`

### P2：营销库存和幂等测试还停留在 mock Redis 层

已有覆盖：

- `MarketingStockService` 测了 Lua 返回值 `1 / -1 / -2`、缓存丢失、DB 兜底、释放名额。
- `IdempotencyService` 测了 join / payment / state / team lock、Redis 错误、回调异常释放锁。

缺口：

- 真实 Redis 下同一活动最后一个名额的并发领取 / 参与。
- 锁 TTL 到期但业务未完成时，第二个请求进入的行为。
- `reserveQuota` 成功、实例创建成功、`cacheJoinResult` 失败时的重试语义。
- `releaseQuota` 重复调用是否会虚增库存，在真实缓存和 DB 双层下是否成立。

风险：

mock Redis 能证明分支逻辑，但不能证明 Lua 脚本、锁 TTL、网络抖动和多实例服务下的不变量。

### 第四批缺口矩阵

| 模块 / 链路               | 当前证据                        | 主要缺口                                   | 优先级 |
| ------------------------- | ------------------------------- | ------------------------------------------ | ------ |
| CouponUsageService        | service spec + property spec    | `useCoupon` 未检查 update count            | P1     |
| CouponDistributionService | service spec + mock integration | 事件失败后重试、重复 memberId、业务幂等    | P1     |
| PointsTaskService         | service spec                    | 不可重复任务并发完成、重复发分             | P1     |
| Marketing controllers     | 少量 controller spec            | route-level 未登录 / 无权限 / 跨租户 / DTO | P1     |
| ClientCouponController    | 无有效 controller/E2E 覆盖      | `available` 正式路由仍返回占位             | P1     |
| 营销分页                  | 部分服务有 normalize            | 多个列表仍缺 0 / 负数 / 极大 pageSize      | P2     |
| mock integration          | 有 service 协作测试             | 不证明真实 Prisma / Redis / 事务 / 事件    | P2     |
| 库存与幂等                | Redis 分支 mock 覆盖            | 最后名额并发、TTL 到期、重复 release       | P2     |

## 第五批审计：商品、门店、通知、LBS、通用基础设施

### 第五批范围

- `apps/backend/src/module/pms/**`
- `apps/backend/src/module/store/**`
- `apps/backend/src/module/notification/**`
- `apps/backend/src/module/lbs/**`
- `apps/backend/src/module/common/error-event/**`
- `apps/backend/src/module/common/redis/**`
- `apps/backend/src/common/observability/**`

### 第五批结论

商品、门店、通知、LBS 和公共基础设施的测试覆盖是混合状态：服务层用例明显多于第一批支付 / 订单，也有不少边界意识，但仍未达到“反例驱动”的标准。

已有较好覆盖：

- `PmsProductService` 覆盖了创建、更新、删除、分类绑定、门店已导入不可删、商品上下架状态、上架前置检查和商品不存在。
- `StoreProductService` 覆盖了导入、SKU 不存在、租户不匹配、乐观锁调价、批量部分成功、导入队列积压、导入任务租户不匹配、下架态移除限制。
- `StockService` / `TenantSkuRepository` 覆盖了增减库存、库存不足、SKU 不存在、租户无权、库存归零、订单扣减与释放。
- `NotificationService` / `NotificationProcessor` 覆盖了入队、策略拒绝、多渠道、发送成功、发送失败、通道路由、providerMessageId 和 SSE 推送。
- `GeoService` / `AdmissionService` / `StationService` 覆盖了围栏 WKT、围栏点非法、服务站创建、围栏命中、半径降级、租户不可用、无 Key 地理编码、POI 解析和 LBS 指标。
- `RedisService` / `CacheManagerService` 覆盖了锁 token、Lua unlock、scan 删除、空值缓存、锁释放、cache jitter 和限流 storage 基本映射。

但核心缺口仍然集中在真实入口和副作用失败：controller 权限 / 租户 / DTO 主要没有 E2E 证明；公开错误上报入口没有测试；通知和商品上下架的“外部副作用成功或失败后，本地状态如何收敛”没有反例；LBS 点坐标入口和少数自定义分页仍依赖隐含假设。

### P1：PMS / store / notification / LBS controller 缺少真实权限、租户和 DTO 反例

证据：

- `pms` 的 brand、category、attribute、product controller 使用大量 `@RequirePermission`。
- `store` 的 product、stock、order、finance、distribution controller 也大量使用 `@RequirePermission`。
- `notification.controller.ts` 使用 `JwtAuthGuard` + `@RequirePermission('system:notification:list')`。
- `lbs` 的 station、metrics controller 使用 `@RequirePermission`。
- 现有部分 controller spec 只检查装饰器元数据，例如 `store/product/product.controller.spec.ts`、`store/stock/stock.controller.spec.ts`、`store/distribution/distribution.controller.spec.ts`，不能证明真实请求会被 guard、permission、tenant context 和 validation pipe 拦住。

风险：

service 单测和装饰器元数据测试都不能替代 HTTP 入口证明。以下反例仍缺统一覆盖：

- 未登录访问。
- 登录但无权限码。
- 有权限但跨租户访问。
- 超级管理员与普通租户语义差异。
- DTO 非法枚举、空数组、超长字符串、非法分页。
- 资源不存在与越权访问是否被区分。

涉及位置：

- `apps/backend/src/module/pms/brand/brand.controller.ts`
- `apps/backend/src/module/pms/category/category.controller.ts`
- `apps/backend/src/module/pms/attribute/attribute.controller.ts`
- `apps/backend/src/module/pms/product.controller.ts`
- `apps/backend/src/module/store/product/product.controller.ts`
- `apps/backend/src/module/store/stock/stock.controller.ts`
- `apps/backend/src/module/store/order/store-order.controller.ts`
- `apps/backend/src/module/store/distribution/distribution.controller.ts`
- `apps/backend/src/module/store/distribution/qualification/qualification.controller.ts`
- `apps/backend/src/module/notification/notification.controller.ts`
- `apps/backend/src/module/lbs/station/station.controller.ts`
- `apps/backend/src/module/lbs/monitoring/lbs-metrics.controller.ts`

### P1：通知发送缺少“外部发送成功但本地状态失败”的幂等测试

证据：

- `NotificationProcessor.handleNotification` 先调用 `channelImpl.send(target, message)`，再把 `sysNotificationLog` 更新为 `SENT`。
- 如果 provider 已经成功发送短信 / 推送 / 站内信，但 `sysNotificationLog.update` 在写 `SENT` 时失败，当前 catch 会尝试把日志写成 `FAILED` 并重新抛错，Bull 重试后可能再次发送外部消息。
- `notification.processor.spec.ts` 覆盖了发送成功、providerMessageId、通道返回失败、通道抛错，但未覆盖“provider 成功 + 本地写 SENT 失败”。
- `NotificationService.send` 先创建 `QUEUED` 日志，再执行 `queue.add`；`notification.service.spec.ts` 覆盖了入队成功和策略拒绝，但未覆盖 `queue.add` 失败后日志停留在 `QUEUED` 的处理语义。

风险：

通知是典型外部副作用链路。缺少这类反例时，测试无法证明重复发送、队列入队失败、状态补偿和重试幂等是否满足业务预期。

涉及位置：

- `apps/backend/src/module/notification/notification.processor.ts`
- `apps/backend/src/module/notification/notification.processor.spec.ts`
- `apps/backend/src/module/notification/notification.service.ts`
- `apps/backend/src/module/notification/notification.service.spec.ts`

### P1：公开错误上报入口没有测试

证据：

- `ErrorEventReportController` 暴露 `POST /client/error-event`。
- 该接口标记 `@NotRequireAuth()`，属于公开写入入口。
- `ReportErrorEventDto` 限制了 `app`、`level`、`errorCode`、`safeMessage`、`technicalMessage`、`stack`、`metadata` 等字段，但未检索到对应 controller / service spec。

缺口：

- 缺少 `app` 非法枚举、缺少 `errorCode`、缺少 `safeMessage`。
- 缺少 `stack` / `technicalMessage` 超长。
- 缺少 `metadata` 非对象、超大对象、敏感字段上报。
- 缺少未登录公开入口的限流 / 滥用 / 重复上报语义。
- 缺少 service 存储失败时的返回语义。

风险：

公开错误上报入口如果没有测试，很容易在 validation pipe、脱敏、限流或异常处理上形成盲区，尤其可能把敏感 payload 写入日志或数据库。

涉及位置：

- `apps/backend/src/module/common/error-event/error-event-report.controller.ts`
- `apps/backend/src/module/common/error-event/dto/report-error-event.dto.ts`
- `apps/backend/src/common/observability/error-event.service.ts`

### P2：LBS 点坐标入口的非法值覆盖不完整

证据：

- `GeoService.toPolygonWKT` 会校验围栏点，并已有少于 3 点、经度越界、点格式非法等测试。
- `GeoService.findStationByPoint` 直接拼接 `POINT(${lng} ${lat})` 后作为参数传入 PostGIS，没有复用 `normalizePoint`。
- `GeoService.calculateDistance` 同样直接构造两个 `POINT`。
- `AdmissionService.checkLocationAdmission` 直接把请求经纬度传给 `findStationByPoint` 和 `calculateDistance`。
- `StationService.create` 只检查 lat / lng 是否为空，没有检查范围；围栏会通过 `toPolygonWKT` 校验，但站点主体经纬度不会。

缺口：

- `lat=NaN`、`lng=Infinity`。
- `lat=91`、`lng=181`。
- 字符串数字、空字符串、null 与 undefined 的转换差异。
- 服务站主体经纬度非法但围栏合法。
- `findNearby` / `checkLocationAdmission` 非法坐标是否返回业务错误，而不是 PostGIS 报错。

风险：

围栏输入被证明了，点输入没有被同等证明。非法坐标进入 PostGIS 后，错误会变成数据库异常或产生不可解释的准入结果。

涉及位置：

- `apps/backend/src/module/lbs/geo/geo.service.ts`
- `apps/backend/src/module/lbs/geo/geo.service.spec.ts`
- `apps/backend/src/module/lbs/admission/admission.service.ts`
- `apps/backend/src/module/lbs/admission/admission.service.spec.ts`
- `apps/backend/src/module/lbs/station/station.service.ts`
- `apps/backend/src/module/lbs/station/station.service.spec.ts`

### P2：商品上下架状态变更的副作用失败未覆盖

证据：

- `PmsProductService.updateStatus` 先更新商品 `publishStatus`，再调用 `productSyncProducer.notifyOffShelf` 或 `notifyOnShelf`。
- `product.service.spec.ts` 覆盖了下架通知、上架通知、状态未变化、前置校验失败和商品不存在。
- 未看到 `notifyOffShelf` / `notifyOnShelf` 抛错时，商品状态已变更后的补偿、返回、重试或告警语义测试。

风险：

如果 DB 状态已改但同步通知失败，后台可能返回失败，而重试时又因为状态未变化直接返回，门店侧没有收到同步事件。测试目前没有证明这一状态副作用组合能收敛。

涉及位置：

- `apps/backend/src/module/pms/product.service.ts`
- `apps/backend/src/module/pms/product.service.spec.ts`
- `apps/backend/src/module/store/product/product-sync.queue.ts`

### P2：门店商品批量和导入边界还缺重复 / 非法集合反例

已有覆盖：

- 批量调价部分成功 / 部分失败。
- 批量提交审核、批量审核、批量移除的部分成功统计。
- Excel 导入入队、队列积压超限、导入任务执行、导入回执、租户不匹配。
- 乐观锁调价、SKU 不存在、无权操作、利润不足。

缺口：

- `items=[]` 的批量语义。
- 同一个 `items` 内重复 ID 是否去重、重复执行还是返回重复明细。
- 同一次导入内重复 `globalSkuId` / 重复商品行。
- `operationId` 重复调用是否返回同一 responseSnapshot，尤其是进行中状态和请求体不同但 operationId 相同。
- `queue.add` 失败后是否留下不可查询或永远 `PENDING` 的导入回执。
- `fileBase64` 不是合法 xlsx、解码失败、空文件、字段缺失。

风险：

批量接口和导入接口本质上是“集合输入 + 异步副作用”，正常与部分失败测试不能证明重复集合、空集合、重复请求和入队失败下的不变量。

涉及位置：

- `apps/backend/src/module/store/product/product.service.ts`
- `apps/backend/src/module/store/product/product.service.spec.ts`
- `apps/backend/src/module/store/product/dto/batch-store-product.dto.ts`
- `apps/backend/src/module/store/product/dto/batch-update-price.dto.ts`
- `apps/backend/src/module/store/product/dto/import-excel.dto.ts`

### P2：少数自定义分页没有统一边界保护

已有较好覆盖：

- 继承 `PageQueryDto` 的入口具备 `@Min(1)`、`@Max(100)`，例如 `ListNotificationDto`。
- 部分服务使用 `PaginationHelper.getPagination`，已有 0、负数、极大值等测试。

缺口：

- `DistributionQualificationRepository.getPagination` 使用 `pageNum ?? 1` 和 `pageSize ?? 10`，没有 `Math.max` / `Math.min`；负数会产生负 `skip` / `take`。
- `NotificationController` 使用 `query.skip` / `query.take`，依赖 route-level validation pipe，但该 controller 未看到未登录、无权限、非法分页的 HTTP 测试。
- 门店商品查询 fallback 已有 `toPositiveInt`，但主 controller 的分页边界仍需要 route-level 证明。

风险：

统一 DTO 和 helper 可以降低风险，但只要存在自定义分页函数或缺少入口级 validation 证明，仍可能在某些列表接口出现负 skip、负 take、极大 pageSize 或超页语义不一致。

涉及位置：

- `apps/backend/src/module/store/distribution/qualification/qualification.repository.ts`
- `apps/backend/src/module/notification/notification.controller.ts`
- `apps/backend/src/common/dto/base.dto.ts`

### P2：Redis / cache 基础设施仍缺真实并发与真实 Redis 反例

已有覆盖：

- `RedisService` 单测覆盖 `tryLock`、token unlock、scan 删除、非法 pattern。
- `CacheManagerService` 单测覆盖缓存命中、缓存空值、锁获取、锁未获取、fetcher 抛错释放锁、TTL jitter。
- Redis 限流 storage 覆盖了 eval 返回映射。

缺口：

- 真实 Redis 下两个请求同时争抢同一锁。
- 锁 TTL 过期但业务仍在执行时，第二个请求进入的语义。
- unlock 网络失败或 Redis 重连时是否留下脏锁。
- scan 删除过程中 key 新增 / 游标循环的行为。
- cache stampede 场景下多个进程是否真的只回源一次。

风险：

这些测试已经能证明封装分支逻辑，但不能证明多进程、多请求、TTL 到期和 Redis 网络异常下的并发不变量。

涉及位置：

- `apps/backend/src/module/common/redis/redis.service.spec.ts`
- `apps/backend/src/module/common/redis/cache-manager.service.spec.ts`
- `apps/backend/src/common/guards/redis-throttler.storage.spec.ts`
- `apps/backend/src/common/guards/redis-express-rate-limit.store.spec.ts`

### 第五批缺口矩阵

| 模块 / 链路                    | 当前证据                   | 主要缺口                                       | 优先级 |
| ------------------------------ | -------------------------- | ---------------------------------------------- | ------ |
| PMS / store / notification/LBS | service spec + 装饰器 spec | route-level 未登录 / 无权限 / 跨租户 / DTO     | P1     |
| NotificationProcessor          | processor spec             | provider 成功后本地写失败导致重复发送          | P1     |
| NotificationService            | service spec               | `queue.add` 失败后的日志状态和补偿             | P1     |
| ErrorEventReportController     | 未检索到 spec              | 公开入口非法输入、敏感字段、限流、上报失败     | P1     |
| LBS 点坐标                     | service spec               | NaN / Infinity / 越界坐标 / 主体经纬度校验     | P2     |
| PmsProductService.updateStatus | service spec               | 商品状态已变更但上下架通知失败                 | P2     |
| StoreProduct 批量 / 导入       | service spec               | 空集合、重复集合、重复 operationId、入队失败   | P2     |
| 自定义分页                     | helper / DTO 局部覆盖      | 非 helper 分页负数、入口级 validation 证明不足 | P2     |
| Redis / cache infra            | mock client unit spec      | 真实 Redis 并发、TTL 到期、网络异常            | P2     |

## 第六批审计：全量索引、文件入口、监控任务、履约和 C 端边缘模块

### 第六批范围

本批先做全量测试文件索引，再抽查前五批没有展开的外围模块：

- `apps/backend/test/**`
- `apps/backend/src/module/admin/resource/**`
- `apps/backend/src/module/admin/system/file-manager/**`
- `apps/backend/src/module/admin/monitor/**`
- `apps/backend/src/module/auth-core/**`
- `apps/backend/src/module/client/**`
- `apps/backend/src/module/fulfillment/**`
- `apps/backend/src/module/backup/**`
- `apps/backend/src/module/ai-content/**`
- `apps/backend/src/common/**`

### 第六批索引结论

backend 当前可检索到 `302` 个测试文件，`describe` / `it` / `test` 声明合计约 `3513` 处。按模块粗分：

| 模块         | 测试文件数 |
| ------------ | ---------- |
| marketing    | 104        |
| admin        | 43         |
| finance      | 30         |
| client       | 26         |
| store        | 23         |
| common       | 22         |
| e2e / test   | 15         |
| notification | 9          |
| pms          | 7          |
| lbs          | 6          |
| auth-core    | 3          |
| ai-content   | 3          |
| prisma       | 3          |
| fulfillment  | 3          |
| payment      | 2          |
| backup       | 1          |
| main         | 1          |
| config       | 1          |

没有检索到 `.skip(` / `.only(`，这是正向信号。但测试文件数量和 case 数量不等于达标：外围模块大量 controller spec 仍是“直接实例化 / 元数据读取 / 委托 service”，没有进入 Nest HTTP pipeline，因此不能证明 guard、permission、tenant、pipe、interceptor、multipart、响应过滤和异常过滤共同生效。

### P1：文件管理模块没有测试公开分享、令牌下载和危险删除

证据：

- `FileManagerController` 包含大量高风险文件操作：创建 / 删除文件夹、删除文件、移动、重命名、创建分享、取消分享、回收站恢复、彻底删除、访问令牌、批量下载。
- `getShare`、`downloadShare`、`downloadFile` 使用 `@NotRequireAuth()`，属于公开访问或令牌访问入口。
- `clearRecycle` 是彻底删除类接口。
- `getStorageStats` 当前没有看到 `@RequirePermission`。
- 未检索到 `apps/backend/src/module/admin/system/file-manager/**` 下的 spec。

缺口：

- 分享链接不存在、过期、错误提取码、重复下载、取消分享后下载。
- 下载令牌缺失、过期、伪造、跨租户文件 ID。
- `clearRecycle` 空数组、重复 ID、跨租户 ID、部分不存在、部分失败。
- `deleteFiles` / `restoreFiles` 的重复请求和部分失败。
- 文件名路径穿越、非法扩展名、超大批量下载。
- 未登录、无权限、权限不足访问管理接口。

风险：

文件管理是“公开入口 + 私有资源 + 删除操作”的组合，高风险远高于普通 CRUD。没有 route-level 和 service-level 反例时，无法证明文件访问控制、分享安全和永久删除边界。

涉及位置：

- `apps/backend/src/module/admin/system/file-manager/file-manager.controller.ts`
- `apps/backend/src/module/admin/system/file-manager/file-manager.service.ts`

### P1：SSE controller 存在手工鉴权入口和无权限码管理操作，测试未覆盖

证据：

- `SseController.sse` 标记本地定义的 `@NotRequireAuth()`，通过 query 参数 `Authorization` 手工解析 JWT。
- `resolveAccessUserId` 只接受 `type=access` 且 `userId` 为 number。
- `sendMessage`、`broadcast`、`getCount` 没有看到 `@RequirePermission`。
- 现有 `admin/resource` 下只有 `sse.service.spec.ts` 和 `oss-display-url.spec.ts`，未看到 `sse.controller.spec.ts` 或对应 E2E。

缺口：

- 无 token、伪造 token、refresh token、过期 token、`userId` 非 number。
- query token 与 header token 的优先级。
- clientid 为空、重复连接、close 后清理。
- 租户不匹配时是否只能推送给本租户连接。
- `sendMessage` / `broadcast` / `count` 未登录、无权限、普通用户访问。

风险：

SSE 是长期连接，手工鉴权和全局 guard 的行为更容易出现偏差。send / broadcast 如果只依赖全局登录而没有权限码，可能形成后台消息滥发入口。

涉及位置：

- `apps/backend/src/module/admin/resource/sse.controller.ts`
- `apps/backend/src/module/admin/resource/sse.service.spec.ts`

### P1：履约写操作缺少状态流转、重复调用和副作用失败反例

证据：

- `FulfillmentController` 包含发货、确认收货、指派技师、服务核销等写入口。
- `fulfillment.controller.spec.ts` 只验证 operation log 元数据。
- `fulfillment.service.spec.ts` 主要覆盖缺失履约诊断、候选技师、部分状态更新；仍以 mock Prisma 为主。
- `FulfillmentService` 的写操作包含 `updateMany.count`、`financeCommandPort.updateCommissionPlanSettleTime`、`distributionQualificationService.markServiceOrderVerified` 等副作用。

缺口：

- 已发货重复发货、已收货重复确认、已核销重复核销。
- 状态刚被其他请求改变时，`updateMany.count=0` 是否稳定回滚。
- 佣金结算时间更新失败时，订单 / 履约状态是否回滚或进入可补偿状态。
- 服务核销后 `markServiceOrderVerified` 失败时是否会重复核销或漏记分销资格。
- controller route-level 未登录、无权限、跨租户、DTO 非法。

风险：

履约是订单终态链路。只验证元数据和少量 service 分支，不能证明“订单状态只能单向流转”和“重复请求不产生重复副作用”。

涉及位置：

- `apps/backend/src/module/fulfillment/fulfillment.controller.ts`
- `apps/backend/src/module/fulfillment/fulfillment.controller.spec.ts`
- `apps/backend/src/module/fulfillment/fulfillment.service.ts`
- `apps/backend/src/module/fulfillment/fulfillment.service.spec.ts`

### P1：监控任务和缓存管理接口缺少真实权限与危险操作反例

证据：

- `JobController` spec 直接实例化 controller，只验证委托 `jobService`。
- `CacheController` / `ServerController` spec 只读取 `@RequirePermission` 元数据。
- 任务模块包含创建、更新、删除、启停、立即执行、同步 code-managed definitions、导出。
- 缓存模块包含按 key / name 清理和清空全部缓存。

缺口：

- 未登录、无权限、错误权限码访问 job / cache / server。
- 非法 cron、危险 bean/method、重复 job、删除 code-managed job、运行停用 job。
- `syncDefinitions` 重复执行、部分失败、菜单 / 权限未同步。
- `clearCacheAll` 未确认、空 key、通配符注入、跨业务缓存误删。
- 导出接口非法筛选、超大导出、无权限导出。

风险：

任务调度和缓存清理都属于运维高风险入口。controller 委托测试不能证明这些入口在真实 HTTP 下被正确授权和约束。

涉及位置：

- `apps/backend/src/module/admin/monitor/job/job.controller.spec.ts`
- `apps/backend/src/module/admin/monitor/job/job.service.spec.ts`
- `apps/backend/src/module/admin/monitor/cache/cache.controller.spec.ts`
- `apps/backend/src/module/admin/monitor/cache/cache.service.spec.ts`
- `apps/backend/src/module/admin/monitor/server/server.controller.spec.ts`

### P1：AI Prompt 写操作使用 list 权限，测试未发现权限粒度问题

证据：

- `AiPlatformPromptController` 的 list、detail、create、status、update、delete 都使用 `@RequirePermission('marketing:aiPrompt:list')`。
- `ai-platform-prompt.controller.spec.ts` 只验证 list 委托、create 使用当前租户、updateStatus 委托，没有验证权限码。

风险：

如果用户只拥有 AI Prompt 查看权限，也可能被允许创建、编辑、启停或删除 Prompt。测试没有从权限粒度角度攻击该 controller。

涉及位置：

- `apps/backend/src/module/ai-content/ai-platform-prompt.controller.ts`
- `apps/backend/src/module/ai-content/ai-platform-prompt.controller.spec.ts`

### P2：C 端 controller surface 很大，但 route-level 覆盖很少

证据：

- C 端 controller 覆盖 address、cart、auth、payment、upload、finance、upgrade、product、service、order、location、AI content、distribution、marketing aggregate / scene / coupon / points 等入口。
- 可检索到的 C 端 controller spec 只有少量：`service-slot.controller.spec.ts`、`client-upload.controller.spec.ts`、`client-points-account.controller.spec.ts`、`order-integration.controller.spec.ts`。
- `client-upload.controller.spec.ts` 只直接调用 `upload(undefined)`，覆盖“未选择文件”，不覆盖真实 multipart、guard、文件类型、大小、租户和恶意文件名。

缺口：

- `MemberAuthGuard` 未登录、token 过期、member 不存在。
- 地址、购物车、订单、金融、升级、分销等“只能操作本人资源”的越权反例。
- C 端公开 / 半公开入口的非法输入和限流，例如 location、auth、service slot。
- 上传文件大小、MIME、扩展名、空文件、重复上传、OSS 失败。
- 分页 0、负数、极大 pageSize、空列表、超页。

风险：

C 端入口的主要风险是越权访问、重复请求和非法输入。service 单测无法证明真实 member context 与 HTTP pipe 的组合行为。

涉及位置：

- `apps/backend/src/module/client/**`
- `apps/backend/src/module/client/upload/client-upload.controller.ts`
- `apps/backend/src/module/client/upload/client-upload.controller.spec.ts`

### P2：auth-core 测试较强，但仍停留在 service + mock Redis

已有覆盖：

- `SmsCodeService` 覆盖发送、错误验证码、消费、二次消费、发送间隔、小时次数、短信外发失败清理、场景隔离。
- `PasswordResetService` 覆盖 member / admin reset code 消费与新密码策略委托。
- `PasswordPolicyService` 覆盖短密码、弱密码和合规密码。

缺口：

- 真实 Redis 原子性：同一验证码两个并发消费只能成功一次。
- 真实 HTTP 登录 / 重置接口中的手机号格式、验证码空值、重复请求、限流 IP key。
- provider 已发送但 Redis 写入失败、Redis 写入成功但 provider 失败的线上补偿语义。

风险：

这些测试比多数模块更接近规格，但认证验证码属于安全入口，仍需要把 mock Redis 测试升级到真实原子消费和 route-level 滥用测试。

涉及位置：

- `apps/backend/src/module/auth-core/services/sms-code.service.spec.ts`
- `apps/backend/src/module/auth-core/services/password-reset.service.spec.ts`
- `apps/backend/src/module/auth-core/services/password-policy.service.spec.ts`

### P2：backup、common filter / guard / transaction 测试证明力不均

证据：

- `backup.service.spec.ts` 只验证 `performBackup('nightly')` 会写日志。
- `global-exception.filter.spec.ts` 有真实 Nest e2e 风格测试，覆盖 BusinessException、AuthenticationException、AuthorizationException、ValidationException、BadRequestException、未知错误。
- `transactional.decorator.spec.ts` 覆盖 propagation、noRollbackFor、repository prisma，但仍是 mock transaction。
- common guard / rate-limit / idempotent guard 以 mock store 为主。

缺口：

- backup 的失败、重试、并发触发、重复任务和备份产物验证。
- 真实数据库 transaction rollback / commit 行为。
- 真实 Redis 限流、幂等 key、TTL 到期和多实例并发。
- 全局异常过滤中敏感错误信息脱敏和 requestId / traceId 传播。

风险：

公共基础设施如果只验证封装分支，不验证真实外部依赖和高并发行为，会让上层业务测试误以为底层语义已经可靠。

涉及位置：

- `apps/backend/src/module/backup/backup.service.spec.ts`
- `apps/backend/src/common/filters/global-exception.filter.spec.ts`
- `apps/backend/src/common/decorators/transactional.decorator.spec.ts`
- `apps/backend/src/common/guards/*.spec.ts`

### 第六批缺口矩阵

| 模块 / 链路         | 当前证据                      | 主要缺口                                              | 优先级 |
| ------------------- | ----------------------------- | ----------------------------------------------------- | ------ |
| FileManager         | 无 spec                       | 公开分享、令牌下载、永久删除、跨租户、无权限          | P1     |
| SSE                 | service spec                  | query token 手工鉴权、send/broadcast 权限、租户隔离   | P1     |
| Fulfillment         | service spec + 元数据 spec    | 重复发货/核销、状态竞态、副作用失败、route-level 权限 | P1     |
| Monitor job/cache   | controller 委托 / 元数据 spec | run/sync/delete/clearAll 的真实权限和危险输入         | P1     |
| AI Prompt           | controller direct spec        | 写操作复用 list 权限，未验证权限粒度                  | P1     |
| Client controllers  | 少量 controller spec          | 大量 C 端入口缺未登录、越权、DTO、重复请求            | P2     |
| auth-core           | service spec                  | 真实 Redis 原子消费、route-level 滥用和限流           | P2     |
| backup/common infra | 少量 unit/e2e                 | 真实外部依赖、并发、脱敏、trace 传播                  | P2     |

## 第七批审计：E2E bootstrap、controller 覆盖债务、DTO 与全局管道

### 第七批范围

- `apps/backend/test/**/*.e2e-spec.ts`
- `apps/backend/src/main.ts`
- `apps/backend/src/app.module.ts`
- `apps/backend/src/**/*.controller.ts`
- `apps/backend/src/**/dto/**/*.ts`
- `apps/backend/src/common/tenant/**`
- `apps/backend/src/common/guards/**`
- `apps/backend/src/common/interceptors/**`

### 第七批结论

第七批发现的是结构性问题：当前 E2E 和 controller 测试并没有稳定复用生产启动链路，因此很多“非法输入、权限、租户、限流、异常过滤”的证明并不等价于线上行为。

关键统计：

- `apps/backend/src` 下约 `120` 个 controller。
- 可检索到的 controller spec + E2E 约 `31` 个。
- 约 `268` 个 DTO 文件。
- 可检索到的 DTO spec 约 `2` 个。
- `apps/backend/test/*.e2e-spec.ts` 多数直接 `moduleFixture.createNestApplication(); await app.init();`。
- `main.ts` 中的 `setGlobalPrefix`、`ValidationPipe`、`GlobalExceptionFilter`、`helmet`、`cookieParser`、部分 express rate limit 和 Swagger setup 不会因为直接 `createNestApplication()` 自动执行。

### P1：E2E 未复用生产 bootstrap，导致 ValidationPipe / prefix / filter / security 行为不等价

证据：

- `main.ts` 中生产启动链路包含：
  - `app.setGlobalPrefix(prefix)`
  - `app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true, enableImplicitConversion: true }))`
  - `app.useGlobalFilters(new GlobalExceptionFilter(...))`
  - `helmet(...)`
  - `cookieParser()`
  - express rate limit
  - 静态资源和 Swagger setup
- 多个 E2E 文件直接创建 Nest app 后 `app.init()`，没有调用同一套 bootstrap 配置：
  - `app.e2e-spec.ts`
  - `admin-auth.e2e-spec.ts`
  - `member-auth.e2e-spec.ts`
  - `business-flow.e2e-spec.ts`
  - `commission-flow.e2e-spec.ts`
  - `commission-coupon-points.e2e-spec.ts`
  - `order-full-chain.e2e-spec.ts`
  - `resource-oss-route.e2e-spec.ts`
  - `tenant-000000-marketing-distribution.e2e-spec.ts`
  - `tenant-middleware.e2e-spec.ts`
  - `upgrade.e2e-spec.ts`

风险：

如果 E2E 没有安装生产 `ValidationPipe`，那么“非法手机号应校验失败”“额外字段应被拒绝”“pageNum=-1 应失败”“DTO 转 number”这类断言不能证明线上行为。反过来，测试通过也可能只是 service 层自己兜底，而不是 HTTP 管道生效。

应补测试规格：

- E2E 必须通过统一 `createTestAppWithProductionBootstrap()` 或同等 helper 启动。
- 至少覆盖一组样例：非法 DTO、额外字段、隐式类型转换、全局前缀、异常过滤格式、限流 header、cookie 解析。
- 对比 direct controller spec 与 E2E 的职责边界，避免把 direct spec 当成入口证明。

### P1：controller route-level 覆盖债务过大

证据：

- `src` 下约 `120` 个 controller。
- exact controller spec / E2E 只有约 `31` 个。
- 大量缺少对应 route-level 测试的 controller 包括：
  - `admin/resource/sse.controller.ts`
  - `admin/resource/oss.controller.ts`
  - `admin/system/file-manager/file-manager.controller.ts`
  - `admin/system/user/user.controller.ts`
  - `admin/system/role/role.controller.ts`
  - `admin/system/tenant/tenant.controller.ts`
  - `admin/system/dict/dict.controller.ts`
  - `client/order/order.controller.ts`
  - `client/cart/cart.controller.ts`
  - `client/address/address.controller.ts`
  - `client/payment/payment.controller.ts`
  - `finance/withdrawal/withdrawal.controller.ts`
  - `store/order/store-order.controller.ts`
  - `pms/product.controller.ts`
  - `lbs/station/station.controller.ts`
  - 多数 marketing admin / client controller。

风险：

service 层覆盖再多，也不能证明真实 HTTP 路由路径、method、param pipe、body validation、guard、permission、tenant middleware、interceptor 和 exception filter 的组合。对高风险模块来说，controller 覆盖债务是 P1。

最低达标模板：

- 每个 controller 至少有一个 route-level smoke：未登录 / 有权限成功 / 无权限拒绝。
- 每个写入口至少有一个 DTO 非法输入。
- 每个资源型入口至少有资源不存在和跨租户访问。
- 每个分页入口至少有 0、负数、极大 pageSize、空页、超页。

### P1：DTO 文件很多，但 DTO validation 测试几乎没有

证据：

- 可检索到约 `268` 个 DTO 文件。
- 可检索到的 DTO spec 约 `2` 个。
- 生产 `ValidationPipe` 使用 `whitelist` 和 `forbidNonWhitelisted`，但 E2E 又没有统一复用生产 bootstrap。

风险：

DTO 是边界规格的第一层。如果 DTO 本身没有 unit spec，E2E 又没有生产 pipe，非法输入很可能只在 Swagger metadata 里“看起来有约束”，没有被测试执行。

重点反例：

- 额外字段应被拒绝。
- 空字符串是否等价于未传。
- `pageNum=-1`、`pageSize=0`、`pageSize=100000`。
- `ids=""`、`ids="1,,2"`、重复 ID、非数字 ID。
- enum 大小写、未知枚举。
- `@Type(() => Number)` 下 `NaN`、`Infinity`、`abc`。
- 嵌套数组空数组、超长数组、对象中混入未知字段。

### P1：全局 guard / interceptor / middleware 的组合链路缺测试矩阵

证据：

- `app.module.ts` 注册了多个 `APP_GUARD`：`CustomThrottlerGuard`、`JwtAuthGuard`、`TenantGuard`、`PermissionGuard`、`IdempotentGuard`。
- `app.module.ts` 还注册了全局 interceptor：解密、事务、HTTP metrics。
- `TenantMiddleware` 对所有路由执行，按路径处理后台 strict、C 端回落、白名单豁免。
- 现有测试多为单个 guard / tenant helper / path policy unit spec，只有少量最小 E2E。

缺口：

- 同一个请求同时命中 tenant 缺失、未登录、无权限、重复幂等 key 时，返回优先级是否稳定。
- `@NotRequireAuth` 与 tenant middleware 的组合是否正确。
- `@IgnoreTenant` 是否只影响 repository tenant filter，不影响 HTTP tenant 解析。
- 解密 interceptor 失败、validation 失败、transaction interceptor 的先后顺序。
- `HttpMetricsInterceptor` 对异常请求、流式 SSE、文件下载是否记录正确。

风险：

全局链路的 bug 往往不会出现在单个 service spec 里。权限、租户、幂等、限流、事务、异常过滤的先后顺序如果没有矩阵测试，很容易出现错误状态码、绕过权限或重复写入。

### P2：OpenAPI / Swagger metadata 与真实校验缺少漂移检测

证据：

- `src/metadata.ts` 记录了大量 Swagger model 和 controller metadata。
- 但没有看到针对 OpenAPI schema 与实际 DTO validation 的一致性测试。
- 现有 contract 主要依赖 `generate-types`，但测试审计中未看到“schema 生成后字段/必填/枚举与 DTO 一致”的门禁。

风险：

前端会消费 OpenAPI / common-types。如果 Swagger metadata、DTO validator、service 实际允许字段三者不一致，前端类型正确也不能保证请求会被后端接受，或者后端可能接受类型里没有的危险字段。

建议反例：

- DTO 必填字段在 OpenAPI 中也是 required。
- enum 值与 class-validator `@IsIn` 一致。
- `forbidNonWhitelisted` 下 OpenAPI 未声明字段会被拒绝。
- backend DTO 变更后 `generate-types` 输出有差异且前端编译能感知。

### P2：E2E 依赖共享环境，缺少隔离和清理契约

证据：

- 多个 E2E 注释显示依赖 PostgreSQL、Redis、seed 租户、固定 `000000`。
- `tenant-000000-marketing-distribution.e2e-spec.ts` 中有 `E2E_SKIP_CLEANUP` 相关注释。
- 第一批已记录共享租户和共享数据污染风险，第七批补充其测试架构层面的影响。

风险：

共享环境会让“重复请求、资源不存在、空数据、分页边界”难以稳定复现。测试顺序或残留数据可能让缺陷被掩盖。

最低要求：

- 每个 E2E suite 有唯一前缀 / tenant / member / order 标识。
- 清理失败应显式失败或记录隔离标记，不能静默污染。
- 并发 E2E 与普通 E2E 分离。

### 第七批缺口矩阵

| 模块 / 链路                | 当前证据                                       | 主要缺口                                                  | 优先级 |
| -------------------------- | ---------------------------------------------- | --------------------------------------------------------- | ------ |
| E2E bootstrap              | 直接 `createNestApplication().init()`          | 未复用生产 prefix / pipe / filter / security / rate limit | P1     |
| Controller 覆盖            | 约 120 controller，仅约 31 controller spec/E2E | 大量真实 route 未测未登录、权限、租户、DTO                | P1     |
| DTO validation             | 约 268 DTO，仅约 2 DTO spec                    | 非法输入、额外字段、枚举、分页、嵌套数组缺规格            | P1     |
| Global guards/interceptors | 有 unit spec 和少量 E2E                        | 权限、租户、幂等、限流、事务、异常顺序缺矩阵              | P1     |
| OpenAPI / metadata         | 有 `metadata.ts` / generate-types 链路         | schema 与 validator / service 行为缺漂移检测              | P2     |
| E2E 数据隔离               | 多 suite 依赖固定租户 / seed                   | 清理、唯一前缀、空数据、并发隔离不足                      | P2     |

## 第八批审计：测试基础设施、CI、Jest 与覆盖率门禁

本批审计对象：

- 根 `package.json`
- `apps/backend/package.json`
- `turbo.json`
- `.github/workflows/ci.yml`
- `apps/backend/test/jest-e2e.json`
- `apps/backend/test/jest-unit.config.js`
- `apps/backend/test/jest-integration.config.js`
- `scripts/check-test-spec-coverage.mjs`
- `scripts/tasks/changed-files.mjs`

### P1：默认测试与 CI 没有执行 backend E2E / integration

证据：

- 根 `test` 是 `pnpm test:scripts && turbo run test`。
- backend 包的默认 `test` 是 `jest`。
- backend Jest 默认配置只匹配 `(src|test[\\/]unit)[\\/].*\.spec\.ts$`。
- backend E2E 单独挂在 `test:e2e`：`jest --config ./test/jest-e2e.json`。
- CI 的 Test step 执行 `pnpm test`，没有看到执行 `pnpm --filter @apps/backend test:e2e`。
- 第一批已实测 integration 配置 `--listTests` 失败，原因是 `apps/backend/test/jest-integration.config.js` 引用了不存在的 `test/setup.ts`。

结论：

当前默认门禁主要证明 backend unit spec 能跑；不能证明真实 HTTP、真实 bootstrap、真实 DB / Redis、全局 guard / pipe / interceptor 链路能跑。

风险：

- 合并时可能通过 `pnpm test`，但支付回调、订单下单、库存扣减、权限越权、租户缺失、DTO 非法输入、分页边界等真实入口仍未被门禁覆盖。
- integration 配置存在但不可用，会形成“项目有集成测试门禁”的错觉。
- 后续补的 E2E 如果只挂在 `test:e2e`，但不接入 CI / 合并前门禁，仍然不能防回归。

最低整改：

- 新增明确的 `test:integration` 脚本，先修复缺失的 setup，再决定哪些 suite 进入 integration。
- 在 CI 单独增加 backend E2E job，不混进普通 unit job。
- E2E job 应显式启动 PostgreSQL / Redis，并执行迁移、seed 和清理。
- 保留 unit 快速反馈，但不能用 unit 结果替代 E2E 结论。

### P1：`verify:pre-push` 没有执行 backend 测试

证据：

- 根 `verify:pre-push` 执行的是 monorepo / scripts / lint / quality gates / admin view types / typecheck / `test:scripts`。
- 它没有执行 `pnpm test`、`pnpm test:backend` 或 backend E2E。

风险：

本地 pre-push 可以在 backend 业务测试完全未跑的情况下通过。对高风险后端模块来说，这个门禁不能代表“推送前已验证后端行为”。

最低整改：

- 如果 pre-push 不能承担全量测试成本，应在文档和 CI 名称中明确它不是测试门禁。
- 后端高风险改动至少需要一个可选但明确的 pre-push / pre-merge 命令，例如 backend unit + integration + E2E 的组合。

### P1：CI 环境缺 PostgreSQL 服务，不能直接承接真实数据库 E2E

证据：

- `.github/workflows/ci.yml` 中配置了 Redis service。
- 未看到 PostgreSQL service。
- CI 有 `Prisma Generate`、`build backend`、`OPENAPI_ONLY=true node dist/main.js`，但没有 migration deploy / test DB bootstrap。

风险：

即使把 `test:e2e` 接进 CI，也会因为数据库服务、迁移和 seed 没有标准化而不稳定。更重要的是，当前 CI 不能证明 Prisma schema、migration、repository、真实 transaction、并发写入在数据库上成立。

最低整改：

- E2E / integration job 使用独立 test database。
- 每次 job 执行 `prisma migrate deploy` 或等价迁移链路。
- seed 使用可重复、可清理、可隔离的数据集。
- 测试结束后清理数据或销毁数据库，不依赖共享 `000000` 状态。

### P1：覆盖率脚本存在，但没有覆盖率阈值和业务不变量门槛

证据：

- backend 有 `test:cov`：`jest --coverage`。
- 未看到 coverage threshold 被 CI 或 `pnpm test` 强制执行。
- `jest-unit.config.js` 的 coverage 收集范围只聚焦 marketing service。
- `jest-integration.config.js` 的 coverage 收集范围也只聚焦 marketing service / controller。

风险：

覆盖率不是质量本身，但没有阈值和范围约束时，新增高风险模块可以没有任何测试而不触发失败。当前覆盖率配置更像局部调试入口，不是仓库级测试门禁。

最低整改：

- 不建议一开始追求全仓高覆盖率。
- 先对高风险目录设置 changed-file coverage gate：支付、订单、库存、认证、权限、租户、财务、Prisma repository。
- 对新增 service / controller / repository 要求至少有规格文件或豁免说明。

### P2：`check-test-spec-coverage` 是 warn-only，不能阻断缺规格测试

证据：

- `scripts/check-test-spec-coverage.mjs` 注释写明“当前为 warn-only，不阻断构建”。
- 脚本只检查 `describe('invariants')` 与 `describe('boundary conditions')`，并且返回 `ok: true`。
- `check:slice` 会调用该脚本，但由于 warn-only，缺规格不会失败。

风险：

这说明仓库已经意识到规格驱动测试的重要性，但当前只是提醒，不是门禁。高风险模块可以继续增加 happy path spec，而不写不变量、边界、非法输入和反例。

最低整改：

- 第一阶段只对 changed backend spec 强制：缺 `invariants` / `boundary conditions` / `red team cases` 时失败。
- 第二阶段只对高风险模块强制：payment / order / finance / auth / tenant / Prisma / stock。
- 第三阶段再扩大到全部 backend service / controller / repository。

### P2：E2E ignore pattern 存在，需清理“被配置隐藏”的测试

证据：

- `apps/backend/test/jest-e2e.json` 中有 `testPathIgnorePatterns: ["marketing\\.e2e-spec\\.ts$"]`。

风险：

如果历史上存在同名或匹配的 E2E 文件，这类 ignore pattern 会让测试看起来在目录里，实际不会被执行。即使当前没有匹配文件，也应避免保留没有说明的忽略规则。

最低整改：

- 为每个 E2E ignore pattern 写明原因和替代门禁。
- 如果只是历史遗留，删除 ignore pattern。

### 第八批缺口矩阵

| 链路             | 当前证据                                  | 主要缺口                               | 优先级 |
| ---------------- | ----------------------------------------- | -------------------------------------- | ------ |
| 默认 `pnpm test` | 走 backend 默认 Jest                      | 不执行 E2E / integration               | P1     |
| Integration      | 有 config                                 | 缺 `test/setup.ts`，入口不可用         | P1     |
| CI               | 执行 `pnpm test`，有 Redis                | 缺 PostgreSQL / migration / E2E job    | P1     |
| Pre-push         | 执行 verify / lint / typecheck / scripts  | 不执行 backend 业务测试                | P1     |
| Coverage         | 有 `test:cov` 与局部 collectCoverageFrom  | 无 CI 阈值，无高风险 changed-file 门槛 | P1     |
| Spec coverage    | 有 `check-test-spec-coverage.mjs`         | warn-only，不能阻断缺不变量 / 边界测试 | P2     |
| E2E ignore       | `marketing.e2e-spec.ts` 被 ignore pattern | 缺说明，可能隐藏历史测试或造成门禁误解 | P2     |

## 第九批审计：Prisma、seed、migration 与 repository 契约

本批审计对象：

- `apps/backend/prisma/AGENTS.md`
- `apps/backend/prisma/migrations/**`
- `apps/backend/prisma/seeds/**`
- `apps/backend/src/prisma/*.spec.ts`
- `apps/backend/src/common/tenant/*.spec.ts`
- `apps/backend/src/common/repository/*.spec.ts`
- `apps/backend/src/module/**/**repository.ts`
- `apps/backend/src/module/**/**repository.spec.ts`

本批只读审计 Prisma 高风险目录，未修改 schema、migration、seed 或数据库脚本。

### 已有基础

已有值得保留的测试基础：

- 软删除 middleware：覆盖 `delete` / `deleteMany` 转 `update` / `updateMany`，以及物理删除豁免模型。
- 软删除 where 合并：覆盖空 where、已有 `delFlag`、`deleteTime` 兼容、顶层 `OR` 和 `AND` 合并。
- 租户 helper / path policy：覆盖 strict、exempt、client default super、配置白名单。
- `TenantContext`：覆盖嵌套上下文、并发 async 隔离。
- `BaseRepository`：覆盖 `findMany` / `count` 注入 tenantId。
- 少量 repository spec：`tenant-sku`、`product`、`role`、`ai-platform-prompt`、`team`、`proxy-open`。

这些测试能证明局部函数和 mock delegate 的参数合并行为，但还没有证明真实数据库契约。

### P1：Prisma 扩展 / middleware 缺真实数据库契约测试

证据：

- `prisma-soft-delete.extension.spec.ts` 测的是 `mergeSoftDeleteIntoWhere` 函数。
- `prisma-soft-delete.middleware.spec.ts` 测的是 middleware 修改 `params`。
- `tenant.extension.spec.ts` 内部重新写了测试版 `hasTenantField` / `addTenantFilter` / `setTenantId` / `setTenantIdForMany` 逻辑。
- `base.repository.spec.ts` 使用 mock Prisma delegate 验证传参。

风险：

这些测试不能证明真实 Prisma Client 查询引擎行为，包括：

- `findUnique` / `findFirst` / `findMany` / `count` / `aggregate` / `groupBy` 的过滤一致性。
- relation include / select / nested where 是否自动带 tenant / soft delete。
- transaction 内是否仍继承 tenant context。
- raw query / `$queryRaw` 是否绕过租户隔离。
- `updateMany` / `deleteMany` 在空 where 或跨租户 where 下是否被限制。

最低整改：

- 增加真实数据库 integration spec，使用 test database 和真实 Prisma Client。
- 对每个 tenant-scoped model 抽样执行跨租户读写反例。
- 对 soft delete model 执行真实删除后再读、count、relation include、恢复和二次删除。
- 明确 `$queryRaw` 只能在受控 repository 中使用，并有隔离测试或禁用扫描。

### P1：migration 链路缺自动化验证

证据：

- migration 目录包含大量历史 migration。
- 可见早期命名如 `20251219070121_test`、`20251219071104_test1`、`20251222081401_demo12`。
- 存在相近命名的 file management migration：`add_file_management_tables`、两次 `add_file_management_features`。
- CI 中未看到 `prisma migrate deploy`、`prisma validate` 或 schema diff gate。

风险：

`prisma generate` 只能证明 schema 能生成客户端，不能证明历史 migration 能从空库顺序部署，也不能证明已有数据库可安全升级。migration 是数据库状态机，缺门禁会让“本地 schema 正常”掩盖“生产迁移失败”。

最低整改：

- CI 增加空库 `prisma migrate deploy`。
- 增加 `prisma validate` / `prisma format --check` 等 schema gate。
- 对高风险 migration 增加 smoke query：关键表、索引、唯一约束、外键、枚举值存在。
- 对 destructive migration 单列人工确认和回滚策略。

### P1：seed / reset 脚本缺幂等、隔离和危险操作测试

证据：

- backend package scripts 包含 `prisma:seed:reset-hunan-skeleton`，内部使用 `--force-reset --accept-data-loss` 并执行 Redis `FLUSHDB`。
- package scripts 包含 `prisma:clear-business`、`prisma:reset`、`redis:flush`。
- `prisma/seeds/reset/clear-business-data.ts` 大量执行 `deleteMany()`。
- `prisma/seeds/reset/reset-marketing-all.ts`、`reset-marketing-templates.ts`、`utils/clear-store-configs.ts` 存在无租户过滤或全表清理语义。
- 多个 seed 使用固定租户 `000000`。

风险：

seed / reset 是数据迁移类风险。没有 dry-run、环境保护、幂等测试和租户边界测试时，误执行可能清空非测试数据，或者让 E2E 依赖不可重复的共享状态。

最低整改：

- destructive seed/reset 脚本必须检查 `NODE_ENV` / `DATABASE_URL` / 显式确认参数。
- 为 seed 增加幂等测试：连续执行两次后关键表数量和唯一键不膨胀。
- 为 reset 增加 tenant-scoped 测试：只清理目标租户，不影响旁路租户。
- E2E seed 与本地 demo seed 分离，不共享生产式 reset 脚本。

### P1：repository 契约覆盖极不均衡

证据：

- repository spec 只有少量文件：`base.repository.spec.ts`、`tenant-sku.repository.spec.ts`、`product.repository.spec.ts`、`role.repository.spec.ts`、`ai-platform-prompt.repository.spec.ts`、`team.repository.spec.ts`、`proxy-open.repository.spec.ts`。
- 大量 repository 没有同名 spec，包括订单、财务、提现、钱包、营销优惠券、积分、门店订单、通知、系统用户、菜单、租户、字典等核心 repository。

风险：

service spec mock repository 时，只能证明 service 调用了某个方法；不能证明 repository 实际 where 条件、tenantId、delFlag、唯一键、分页排序、事务写入、悲观 / 乐观并发策略正确。对支付、库存、资金、权限这类模块，repository 是最终数据不变量的落点。

最低整改：

- 高风险 repository 先补真实 DB contract test。
- 每个 repository 至少覆盖：资源不存在、跨租户不可见、软删不可见、分页边界、重复唯一键、update count=0、delete count=0。
- 写操作 repository 覆盖事务回滚和并发冲突。

### P2：seed 基线没有被测试成“权限 / 字典 / 菜单契约”

证据：

- seed 中存在大量菜单、字典、租户包、系统配置、H5 / marketing demo 初始化。
- 前面几批已经发现权限、字典、营销、C 端入口依赖这些基础数据。
- 当前未看到针对 seed 基线的 contract test。

风险：

后台权限和前端菜单往往不是纯代码决定，而是 seed 决定。seed 漂移会导致接口权限缺失、菜单不可见、字典枚举不一致、租户套餐功能缺失。单测不会发现这类问题。

最低整改：

- 增加 seed contract spec：超级租户、默认租户、核心菜单、核心 perms、字典类型、租户套餐、系统配置必须存在。
- OpenAPI / 权限 metadata / seed menu permission 做一致性检测。
- 字典 seed 与 `common-constants` / 前端消费建立漂移检测。

### 第九批缺口矩阵

| 链路               | 当前证据                                    | 主要缺口                                      | 优先级 |
| ------------------ | ------------------------------------------- | --------------------------------------------- | ------ |
| Prisma soft delete | 有函数 / middleware spec                    | 缺真实 DB 查询、relation、aggregate、事务测试 | P1     |
| Tenant extension   | 有 helper / context / path policy spec      | 缺真实 Prisma Client 跨租户读写测试           | P1     |
| Migration          | 有历史 migration                            | CI 未跑 migrate deploy / validate / smoke     | P1     |
| Seed / reset       | 有大量 seed、reset、deleteMany、force-reset | 缺幂等、环境保护、租户隔离测试                | P1     |
| Repository         | 少量 repository spec                        | 订单、财务、营销、系统核心 repository 未覆盖  | P1     |
| Seed contract      | 有菜单、字典、租户包、系统配置种子          | 缺权限 / 菜单 / 字典 / 套餐基线断言           | P2     |

## 第十批审计：收口与补测试路线图

### 总体结论

后端测试文件数量不少，但按“反直觉式工程方法”评判，目前不能算达标。核心原因不是没有测试，而是测试重心偏向 service mock、happy path、局部函数和元数据检查；真正能击穿假设的测试还不足：

- 非法输入：DTO validation 和生产 pipe E2E 不足。
- 重复请求：幂等 key、重复支付回调、重复提现、重复核销不足。
- 越权访问：controller + guard + tenant + permission E2E 不足。
- 空数据：分页、列表、统计、导出空集不足。
- 边界分页：0、负数、极大值、最后一页、超页不足。
- 状态不允许流转：订单、提现、退款、活动、优惠券、履约不足。
- 资源不存在：mock `null` 与真实 404 / forbidden 语义未充分区分。
- 幂等重复调用：写路径和外部副作用没有系统性覆盖。
- 并发与部分失败：库存、资金、事件、队列、通知、缓存、事务缺真实压力反例。

### 先修门禁，再补用例

如果直接继续堆单测，会加剧“测试很多但拦不住回归”的问题。建议先做门禁级修复：

1. 建生产等价 E2E bootstrap helper：复用 `main.ts` 中的 global prefix、ValidationPipe、filter、cookie parser、helmet、throttle、static、interceptor 关键配置。
2. 修复 integration config：补 `test/setup.ts`，明确 test database / Redis 初始化和清理。
3. 拆分 backend 测试脚本：`test:unit`、`test:integration`、`test:e2e`、`test:contract`。
4. CI 增加 PostgreSQL service 和 backend E2E / integration job。
5. 把 `check-test-spec-coverage` 从 warn-only 分阶段升级为 changed-file gate。

### P0 / P1 / P2 路线图

P0：门禁修复

- 修复 integration 不可运行。
- E2E 接入生产等价 bootstrap。
- CI 增加数据库服务和迁移验证。
- 明确默认 `pnpm test`、pre-push、CI、合并前分别保证什么。

P1：入口安全与状态不变量

- 后台 auth / user / role / tenant / menu / dict：未登录、无权限、跨租户、系统内置角色、超级管理员、重复授权。
- C 端 auth / order / payment / cart / address / product：资源不存在、越权访问、重复提交、状态流转、库存不足。
- finance / wallet / withdrawal / commission：余额不为负、冻结不为负、重复入账、提现状态机、部分失败回滚。
- marketing / coupon / points / activity：重复领券、重复核销、库存扣减、任务重复完成、活动状态窗口、事件失败恢复。
- file manager / SSE / notification / fulfillment / monitor job：分享权限、下载令牌、长连接鉴权、外部通知幂等、服务订单核销、任务并发锁。

P2：数据契约与性质测试

- Prisma migration deploy / seed contract / repository real DB test。
- OpenAPI schema 与 DTO validator 漂移检测。
- 统一分页 property-based testing。
- 金额、库存、积分、优惠券计算 property-based testing。
- Redis/cache key、TTL、空值缓存、缓存失效并发测试。

### 最小达标定义

一个后端高风险模块的测试文件，要达到本标准，至少需要同时具备：

- `invariants`：写明余额、库存、状态、租户、权限、幂等等不变量。
- `boundary conditions`：空、单个、最大、非法、重复、乱序、超时、部分失败。
- `red team cases`：越权、跨租户、重复请求、状态绕过、资源不存在、并发冲突。
- `entry coverage`：至少一个真实 controller / E2E 覆盖 guard / pipe / interceptor。
- `data contract`：写路径必须覆盖 repository / Prisma / transaction 的真实数据结果。
- `observability`：失败路径需要验证错误码、错误信息、日志 / 事件 / metrics 的关键字段。

### 剩余批次数

按目前这份后端测试审计口径，第一轮已经完成 10 批，不再建议继续横向扫新批次。下一步应从审计转入整改任务，把上面的 P0 / P1 / P2 变成可执行补测试清单。

## 整改建议

1. 先补测试规格，不直接补散点 case。每个高风险模块先写不变量、状态机、反例清单，再补实现。
2. 把 E2E 从默认 unit 测试中显式区分出来，但必须进入可执行门禁，例如单独 CI job 或明确的合并前命令。
3. integration 配置要么修复并接入，要么删除失效入口，避免形成虚假门禁。
4. 对支付、订单、库存、财务这类模块引入 property-based testing 或并发压力型测试，不只依赖手写 happy path。
5. 把“资源不存在”和“越权访问”拆成两个明确测试语义，不再用同一个 mock 返回 `null` 含混覆盖。
6. 对所有分页入口建立统一边界测试模板：0、负数、极大值、空列表、最后一页、超页、整除 / 非整除。
7. 对权限类接口建立统一 E2E 模板：未登录、无权限、有错误角色、有正确权限、超级管理员、跨租户访问。
8. 对角色 / 用户授权建立不变量：系统角色不可删改、超级管理员角色不可授予普通用户、重复授权幂等、跨租户授权拒绝。
9. 对测试门禁先做 P0 修复：backend integration 可运行、E2E 生产等价 bootstrap、CI 数据库服务、migration deploy smoke。
10. 对 `check-test-spec-coverage` 分阶段升级为阻断门禁，先只约束 changed backend 高风险测试文件。
11. 对 Prisma / repository 建真实 DB contract test，不再只用 mock delegate 证明数据不变量。
12. 对 seed / reset 脚本建立环境保护、dry-run、幂等和租户隔离测试，避免测试数据脚本变成生产数据风险。

## 逻辑矫正

本轮审计把判断标准从“测试文件数量多不多、是否能跑通主流程”矫正为“是否主动构造反例来击穿核心不变量”。因此，已有测试不能因为覆盖了正常路径就被判定达标；高风险模块必须证明非法、重复、越权、空数据、边界分页、状态流转、资源不存在、幂等和并发条件下仍然满足业务约束。

第二批进一步矫正了一个常见误区：service 单测不能替代后台权限验证。权限、角色、租户和 DTO 校验都发生在 controller / guard / pipe / tenant context 的组合链路中，只 mock service 会漏掉最关键的越权入口。

第三批补充矫正：资金模块不能因为测试数量多就判定达标。财务测试必须区分“真实执行业务链路”与“只验证 mock 被配置”。凡是并发、幂等、冻结余额、结算入账和提现回滚，都需要证明不变量在重复请求、部分失败和竞态下仍成立。

第四批补充矫正：property-based testing 是明显进步，但不能替代真实入口和状态副作用检查。优惠券、积分和活动必须同时证明计算性质、状态原子性、重复请求幂等、事件失败恢复和 HTTP 权限边界。

第五批补充矫正：外围模块和基础设施不能只看“服务层分支覆盖”。商品、门店、通知、LBS、Redis/cache 这类模块的关键风险在真实入口、公开写入、外部副作用、异步队列和真实并发上，必须把这些条件显式写成测试规格。

第六批补充矫正：测试文件全量很多并不代表入口全量可靠。controller direct spec、元数据 spec、mock service spec 都有价值，但它们不能证明公开入口、权限粒度、multipart、SSE 长连接、缓存清理、任务运行、文件下载令牌和真实外部依赖的组合语义。

第七批补充矫正：E2E 不是只要导入 `AppModule` 就等价于生产。凡是生产行为在 `main.ts` bootstrap 中注册，E2E 就必须复用同一套配置或通过测试 helper 显式安装，否则非法输入、全局前缀、异常过滤、安全中间件和限流都不能被声称已经覆盖。

第八批补充矫正：测试脚本存在不等于门禁存在。默认 `pnpm test`、pre-push、CI、E2E、integration 和 coverage 必须分别说明保证范围；没有被 CI 或合并前链路执行的测试，不能用于声称回归已被阻断。

第九批补充矫正：Prisma、migration、seed 和 repository 是数据契约，不是普通工具函数。mock delegate 能证明参数被组装，不能证明真实数据库上的租户隔离、软删、唯一约束、事务回滚、并发冲突和迁移链路成立。

第十批补充矫正：审计继续横向扩张的收益已经下降。下一步重点应从“还有哪些测试没看”切到“哪些门禁和 P1 不变量先补”，否则会继续得到更多类似结论，但不能提高回归防线。

## 注释审查与注释方案

- 当前未修改源码注释。
- 发现 `order-full-chain.e2e-spec.ts` 这类“全链路”语义需要复核：如果测试中手动调用佣金服务，而不是由真实 `order.paid` 事件链路触发，则不应在测试说明中暗示它已经覆盖真实全链路。
- 发现 `finance.integration.spec.ts` 使用“完整流程”“并发场景”“性能测试”等描述，但实际是 mock 验证。后续应把测试名称改成真实语义，或者补成真正调用 service / repository / Redis / transaction 的集成测试。
- 后续补测试时，测试名应直接表达被攻击的不变量，例如“重复支付回调不会重复发放积分”“用户不能取消他人订单”“库存并发扣减后不会小于 0”，避免只写“should work”。
- 第二批发现 `RoleService` 相关测试名如 “should change role status”“should soft delete roles” 过于泛化，且用例包含 `roleId=1`，后续应改成能表达安全不变量的名称，例如“不能停用超级管理员角色”“不能删除系统内置角色”。
- 第三批建议将钱包和提现测试名改为不变量表达，例如“重复解冻不能让 frozen 小于 0”“同一提现幂等键重复提交只冻结一次”“批量结算部分成功后重试不会重复入账”。
- 第四批建议将优惠券和积分测试名收敛到不变量，例如“状态更新 count=0 时不能创建核销记录”“同一不可重复任务并发完成只发一次积分”“事件发送失败后重试不会重复发券”。
- 第五批建议把通知、上下架和公开上报测试名改成反例表达，例如“provider 已发送但 SENT 写入失败不会重复外发”“商品状态已变更但门店同步失败会进入可补偿状态”“公开错误上报拒绝超长 stack 和敏感 metadata”。
- 第六批建议把 controller 元数据测试和真实入口测试区分命名，例如“只有 system:file:share 权限才能创建分享”“下载令牌过期后不能读取文件”“SSE broadcast 无权限应拒绝”“同一服务订单重复核销只生效一次”。
- 第七批建议给 E2E helper 和 DTO 测试加上明确命名，例如“E2E 使用生产 ValidationPipe 拒绝额外字段”“pageSize=100000 被 ValidationPipe 拒绝”“无 tenant-id 后台路径先返回租户错误而不是权限错误”。
- 第八批建议给测试脚本和 CI job 使用真实语义命名，例如 `backend-unit`、`backend-integration-db`、`backend-e2e-http`、`migration-deploy-smoke`，避免用 `test` 泛称所有门禁。
- 第九批建议给 Prisma / seed / repository 测试名直接表达数据契约，例如“跨租户 findMany 不返回旁路租户数据”“soft delete 后 relation include 不返回已删记录”“seed 连续执行两次不会增加重复菜单”“reset 只清理目标租户业务数据”。
- 第十批建议后续补测试任务不要命名为“补充测试覆盖率”，而要命名为“补订单状态机反例”“补提现幂等与并发冻结”“补生产等价 E2E bootstrap”等可验收事项。

## 已执行验证

```bash
pnpm --filter @apps/backend exec jest --config ./test/jest-integration.config.js --listTests
```

结果：失败。原因是 `apps/backend/test/jest-integration.config.js` 引用了不存在的 `test/setup.ts`。

第二批未执行新增测试命令，仅进行静态审计与文件检索。

第三批未执行新增测试命令，仅进行静态审计与文件检索。

第四批未执行新增测试命令，仅进行静态审计与文件检索。

第五批未执行新增测试命令，仅进行静态审计与文件检索。

第六批未执行新增测试命令，仅进行静态审计与文件检索；执行了全量测试文件数量、模块分布、`.skip` / `.only`、controller 元数据类测试的检索。

第七批未执行新增测试命令，仅进行静态审计与文件检索；执行了 controller 数量、controller spec / E2E 数量、DTO 文件 / DTO spec 数量、E2E bootstrap 写法、`main.ts` 全局配置与 `app.module.ts` 全局 guard / interceptor 的比对。

第八批未执行新增测试命令，仅进行静态审计与文件检索；执行了根 package scripts、backend package scripts、Turbo test task、CI workflow、Jest unit / integration / E2E config、spec coverage 脚本与 slice gate 的比对。

第九批未执行新增测试命令，仅进行静态审计与文件检索；执行了 Prisma 子规则、migration 列表、seed/reset 危险操作、repository spec 分布、Prisma soft delete / tenant / base repository 测试内容的比对。

第十批未执行新增测试命令，仅基于前九批证据整理收口路线图。

## 未执行验证与残余风险

- 未执行 `pnpm test:backend`。
- 未执行 E2E 测试。
- 未执行全仓验证。
- 未执行 migration deploy / seed / reset / real DB repository contract 测试。
- 本文件已记录第一批至第十批审计，已经覆盖支付、订单、库存、认证、权限、租户、财务、营销、商品、门店、通知、LBS、文件管理、SSE、履约、监控任务、C 端边缘入口、E2E bootstrap、DTO validation、CI / Jest / coverage / Prisma / seed / repository 和公共基础设施的主要测试风险。
- 本文件仍是静态审计记录；第六批已建立 302 个 backend 测试文件的全量索引，第七批补充了 120 个 controller / 268 个 DTO 的结构性覆盖债务，第八至第十批补齐门禁与数据契约层审计，但不等于每个测试文件都已逐行审完。后续应按 P0 / P1 / P2 缺口转成规格驱动测试任务并逐项补齐。

## 整改实施记录

### P0 第一批：backend 测试基础设施可执行化（2026-05-12）

状态：已实施。

改动范围：

- 抽取生产启动配置到 `apps/backend/src/bootstrap/apply-app-bootstrap.ts`。
- `apps/backend/src/main.ts` 改为复用 `applyAppBootstrap`。
- 新增 `apps/backend/test/helpers/e2e-app.ts`，AppModule 型 E2E 统一用生产等价 bootstrap 初始化。
- 新增 `apps/backend/test/setup.ts` 与 `apps/backend/test/integration/harness.spec.ts`。
- 修复 `apps/backend/test/jest-integration.config.js`，去掉 `testRegex` / `testMatch` 混用，并补齐 `moduleNameMapper`。
- 为 `apps/backend/test/jest-e2e.json` 增加 shared setup。
- backend package scripts 增加 `test:unit`、`test:integration`、`test:contract`，并让 `test` 指向 `test:unit`。
- CI 增加 PostgreSQL service、test database `DATABASE_URL`、`prisma:deploy`、backend integration test step。

已执行验证：

- `pnpm --filter @apps/backend test:integration -- --runInBand`：通过，1 个 harness suite / 2 个用例。
- `pnpm --filter @apps/backend typecheck`：通过。
- `pnpm --filter @apps/backend exec jest --config ./test/jest-e2e.json --listTests`：通过，能发现 11 个 E2E 文件。
- `pnpm --filter @apps/backend test:unit -- --listTests`：通过，能发现默认 unit 测试集。
- `pnpm --filter @apps/backend test:contract -- --listTests`：通过，目前 contract 测试集为空。
- `pnpm exec prettier --check` 针对本批 backend 文件：通过。
- `git diff --check` 针对本批 backend / CI 文件：通过。

未纳入本批：

- 未执行真实 E2E，因为当前 E2E 仍依赖 PostgreSQL、Redis、seed 租户与共享业务数据。
- 未把全量 E2E 接入 CI，避免在 seed / 清理 / 租户隔离未治理前制造不稳定门禁。
- 未补业务 integration / contract specs；本批只让入口可执行，后续 P1 / P2 再补业务反例和真实 DB 契约。

下一批建议：

- P1 从入口安全反例开始，优先补 admin auth / role / user / tenant 的未登录、无权限、跨租户、非法输入、资源不存在和重复请求。

### P1 第一批：后台认证与系统入口安全反例（2026-05-12）

状态：已实施。

改动范围：

- 新增 `apps/backend/src/module/admin/auth/dto/admin-auth.dto.spec.ts`。
- 新增 `apps/backend/src/module/admin/system/admin-system.dto.spec.ts`。
- 新增 `apps/backend/src/module/admin/system/admin-entry-security.metadata.spec.ts`。

已覆盖规格：

- 认证 DTO：手机号为空、短号、非数字、缺验证码、弱密码、额外字段注入。
- 系统 DTO：角色 / 用户 / 租户分页 `pageNum=0`、负数、`pageSize=0`、`pageSize=101`，非法状态、非法日期、非数字 ID、缺租户 ID。
- 权限元数据：角色、用户、租户的新增、修改、删除、导出、动态租户切换等入口必须挂载 `RequirePermission` 或 `RequireRole`。
- 动态租户切换入口明确不得标记 `notRequireAuth`。

已执行验证：

- `pnpm --filter @apps/backend test:unit -- src/module/admin/auth/dto/admin-auth.dto.spec.ts src/module/admin/system/admin-system.dto.spec.ts src/module/admin/system/admin-entry-security.metadata.spec.ts --runInBand`：通过，3 个 suite / 58 个用例。
- `pnpm --filter @apps/backend typecheck`：通过。
- `pnpm exec prettier --check` 针对本批新增测试：通过。

未纳入本批：

- 未运行真实 AppModule E2E，因为该类测试依赖 PostgreSQL、Redis、seed 与租户数据。
- 未改生产 DTO 行为。审计中仍建议后续单独评估 `roleIds` / `userIds` 这类逗号字符串是否需要 `IsNotEmpty` 与数字列表格式约束。

下一批建议：

- 继续补真实入口 E2E：未登录 / 无权限 / 缺 tenant-id / 错 tenant-id 下的 `system/role`、`system/user`、`system/tenant` 请求状态码矩阵。
- 若需要让这些 E2E 进入 CI，需要先准备独立 test seed 和测试账号 / 权限夹具。

### P1 第二批：后台系统 HTTP 入口拒绝矩阵（2026-05-12）

状态：已实施。

改动范围：

- 新增 `apps/backend/src/module/admin/system/admin-entry-security.http.spec.ts`。

已覆盖规格：

- `system/role/list` 缺 `tenant-id` 时，在进入 service 前返回 403。
- `system/role/list` 缺登录 token 时返回 403。
- `system/role/list` 已登录但缺 `system:role:list` 权限时返回 403。
- `system/role/list` 同时具备 tenant、登录和权限时允许进入 service。
- `system/role` 新增角色时，body 中的非白名单字段会被 `ValidationPipe` 拒绝，且不会调用 service。
- `system/user/list` 的 `pageNum=0` 边界分页会被拒绝，且不会调用 service。
- `system/tenant/dynamic/:tenantId` 缺 `system:tenant:dynamic` 权限时返回 403。
- `system/tenant/syncTenantPackage` 缺必填 query 时返回 400，且不会调用 service。

已执行验证：

- `pnpm --filter @apps/backend test:unit -- src/module/admin/system/admin-entry-security.http.spec.ts --runInBand`：通过，1 个 suite / 8 个用例。
- `pnpm --filter @apps/backend typecheck`：通过。
- `pnpm --filter @apps/backend exec prettier --check src/module/admin/system/admin-entry-security.http.spec.ts`：通过。

残余风险：

- 该批使用真实 controller、真实 `PermissionGuard`、真实 `TenantMiddleware`、生产等价 `ValidationPipe`，service 仍为 mock，不覆盖数据库、Redis、真实 JWT、真实 seed 权限数据。
- 当前 `AppModule` 中 `RolesGuard` 处于注释状态；`RequireRole('admin')` 已有元数据测试，但未被真实全局 guard 执行。涉及 `system/user/authRole`、`system/user/changeStatus` 等角色入口时，应单独高风险评估是否补接生产 `RolesGuard`，再补 HTTP 拒绝矩阵。

下一批建议：

- 补 admin auth service / session / token 刷新与短信登录的重复请求、非法 token、空 Redis 会话、验证码重放、租户头不一致用例。
- 若要覆盖真实 JWT 和权限数据，需要先准备独立 test seed，不复用本地开发账号。

### P1 第三批：后台认证 HTTP 边界反例（2026-05-12）

状态：已实施。

改动范围：

- 新增 `apps/backend/src/module/admin/auth/auth.controller.security.http.spec.ts`。

已覆盖规格：

- `send-login-code` 同时传 `tenant-id` header 与 body `tenantId` 时，以 header tenant 进入 `TenantContext`，避免 body 租户伪造覆盖请求头。
- `send-login-code` 非法手机号先被 `ValidationPipe` 拒绝，不调用 `AuthService`。
- 密码登录失败会按 header tenant 调用 `AccountLockService.recordLoginFail`，且不会生成 token pair。
- 密码登录成功会按 header tenant 清理失败计数，并将 legacy token 换发为 `access_token` / `refresh_token`。
- 短信登录验证码错误时不解码 token、不生成 token pair。
- `refresh` 空 refresh token 先被 DTO 校验拒绝，不调用 `TokenService`。
- `refresh` 指向不存在 Redis 会话时返回业务码 `UNAUTHORIZED` 与“会话已失效”消息。
- 合法 refresh token 返回新 token pair。
- 无用户 token 调用 `logout` 时不删除 Redis 登录 key，作为幂等 no-op 处理。

已执行验证：

- `pnpm --filter @apps/backend test:unit -- src/module/admin/auth/auth.controller.security.http.spec.ts --runInBand`：通过，1 个 suite / 9 个用例。
- `pnpm --filter @apps/backend typecheck`：通过。
- `pnpm --filter @apps/backend exec prettier --check src/module/admin/auth/auth.controller.security.http.spec.ts`：通过。

残余风险：

- 该批仍为轻量 HTTP controller 测试，不使用真实 JWT 签名、Redis、短信 provider、验证码 Redis key 或真实用户 seed。
- 现有 `TokenService` unit 已覆盖黑名单、空 Redis 会话、access / refresh 类型混用；若要证明端到端 refresh 重放只成功一次，需要后续使用真实 Redis 或可事务化的 fake Redis 执行并发 / 重复调用测试。
- 登录图形验证码的 Redis key 消费链路主要在 `UserService.login` 内，第三批未下钻该 service；后续应补验证码 uuid 不存在、验证码重放、验证码大小写与过期场景。

下一批建议：

- 补 `UserService.login` / 验证码 / Redis 会话写入的反例：验证码缺失、验证码重放、Redis 会话写入失败、停用用户、租户隔离用户不存在。
- 若继续 HTTP 入口，可补 `auth/register` 密码确认不一致、强密码校验、社交回调 state 缺失 / Redis state 不存在。

### P1 第四批：后台登录核心服务反例（2026-05-12）

状态：已实施。

改动范围：

- 新增 `apps/backend/src/module/admin/system/user/services/user-auth.service.security.spec.ts`。

已覆盖规格：

- 验证码开启时，缺少 `code` 会在查询用户前返回“请输入验证码”。
- 验证码 Redis key 不存在时，会在密码校验前返回“验证码已过期”。
- 验证码不匹配时，会在密码校验前返回“验证码错误”。
- 验证码大小写不敏感；通过后会写入登录 session，并把 session 中的 `user.tenantId` 覆盖为当前 `TenantContext`。
- 密码错误不会更新登录时间，也不会写入 Redis 登录 session。
- 已删除用户、已停用用户不会更新登录时间，也不会写入 Redis 登录 session。
- `updateRedisToken` 会合并已有 session metadata，而不是覆盖丢失旧字段。
- 免密登录遇到停用用户会抛出业务异常，并且不写入 session。
- 免密登录成功时会写入当前租户上下文的 session metadata。

已执行验证：

- `pnpm --filter @apps/backend test:unit -- src/module/admin/system/user/services/user-auth.service.security.spec.ts --runInBand`：通过，1 个 suite / 10 个用例。
- `pnpm --filter @apps/backend typecheck`：通过。
- `pnpm --filter @apps/backend exec prettier --check src/module/admin/system/user/services/user-auth.service.security.spec.ts`：通过。

残余风险：

- 当前 `Captcha` 装饰器验证成功后未删除验证码 Redis key，理论上仍存在验证码重放窗口；同时 `UserService.login` 与 `UserAuthService.login` 都挂了 `@Captcha('user')`，直接改为验证后立即删除会破坏双层装饰器链路。该问题应作为单独高风险修复：先决定保留哪一层验证码，再补“同一 uuid 第二次登录必须失败”的回归测试。
- 该批仍使用 mock Redis / Prisma，不覆盖真实 Redis TTL、真实并发登录、真实事务失败后的 session 补偿。

下一批建议：

- 进入资源不存在与状态流转类：`system/user`、`system/role`、`system/tenant` 的不存在 ID、内置管理员 / 内置角色禁止变更、重复删除、重复停用。
- 或先处理上面的验证码重放生产缺口：需要明确授权修改认证生产逻辑后再动手。

### P1 第五批：系统资源边界与内置资源保护（2026-05-12）

状态：已实施。

改动范围：

- 修改 `apps/backend/src/module/admin/system/role/role.service.ts`。
- 修改 `apps/backend/src/module/admin/system/user/user.service.ts`。
- 更新 `apps/backend/src/module/admin/system/role/role.service.spec.ts`。
- 更新 `apps/backend/src/module/admin/system/user/user.service.spec.ts`。
- 更新 `apps/backend/src/module/admin/system/tenant/tenant.service.spec.ts`。

已覆盖规格：

- `roleId=1` 超级管理员角色不可停用，且不会调用 `sysRole.update`。
- `roleId=1` 超级管理员角色不可删除，且不会调用 `sysRole.updateMany`。
- 普通角色仍可停用、软删除。
- `userId=1` 系统用户不可删除，且不会调用 `softDeleteBatch`。
- 普通用户仍可软删除。
- 租户详情 ID 不存在时抛出 `NOT_FOUND`。
- 租户更新 ID 不存在时抛出 `NOT_FOUND`，且不写库。
- 租户企业名称重复时抛出 `BAD_REQUEST`，且不写库。
- 非超级管理员动态切换租户时，在查询租户前拒绝。
- 超级管理员切换不存在租户时抛出 `NOT_FOUND`。
- 非超级管理员清除动态租户时，不写入新的 Redis session。

已执行验证：

- `pnpm --filter @apps/backend test:unit -- src/module/admin/system/role/role.service.spec.ts src/module/admin/system/user/user.service.spec.ts src/module/admin/system/tenant/tenant.service.spec.ts --runInBand`：通过，3 个 suite / 40 个用例。
- `pnpm --filter @apps/backend typecheck`：通过。
- `pnpm --filter @apps/backend exec prettier --check src/module/admin/system/role/role.service.ts src/module/admin/system/role/role.service.spec.ts src/module/admin/system/user/user.service.ts src/module/admin/system/user/user.service.spec.ts src/module/admin/system/tenant/tenant.service.spec.ts`：通过。

残余风险：

- 内置角色 / 用户保护目前覆盖停用与删除；角色编辑、数据权限编辑是否应禁止修改 `roleId=1`，需要按产品策略单独确认。
- 租户删除仍是批量软删除普通路径，本批没有改变生产逻辑；是否禁止删除超级租户、是否拒绝删除不存在 ID、是否要求删除前检查关联数据，应作为后续高风险租户治理任务处理。

下一批建议：

- 补幂等重复调用与重复请求：重复删除、重复状态变更、重复 refresh、重复短信发送、重复角色授权。
- 对租户删除 / 动态租户切换做生产策略确认后，再决定是否补生产保护。

### P1 第六批：重复删除幂等语义（2026-05-12）

状态：已实施。

改动范围：

- 修改 `apps/backend/src/module/admin/system/role/role.service.ts`。
- 更新 `apps/backend/src/module/admin/system/role/role.service.spec.ts`。
- 更新 `apps/backend/src/module/admin/system/user/user.service.spec.ts`。

已覆盖规格：

- 角色软删除只更新 `delFlag=NORMAL` 的角色，重复删除已删除角色时返回 `count=0`，不重复命中已删除数据。
- 用户软删除通过 `UserRepository.softDeleteBatch` 的 `delFlag=NORMAL` 语义，重复删除时返回 `count=0` 作为幂等 no-op。
- 第五批新增的内置角色 / 系统用户禁止删除规则仍然优先于重复删除逻辑。

已执行验证：

- `pnpm --filter @apps/backend test:unit -- src/module/admin/system/role/role.service.spec.ts src/module/admin/system/user/user.service.spec.ts --runInBand`：通过，2 个 suite / 34 个用例。
- `pnpm --filter @apps/backend typecheck`：通过。
- `pnpm --filter @apps/backend exec prettier --check src/module/admin/system/role/role.service.ts src/module/admin/system/role/role.service.spec.ts src/module/admin/system/user/user.service.spec.ts`：通过。

残余风险：

- 租户删除仍未纳入幂等 / 超级租户保护生产修复，因为 `system/tenant` 属于高风险租户治理链路，建议单独确认删除策略。
- 重复状态变更目前仍会执行一次 update；这通常是可接受的幂等写，但如果需要“相同状态不写库”，需另行定义审计与并发语义。

下一批建议：

- 补角色授权重复绑定 / 解绑、用户角色重复授权、`authUser/selectAll` 与 `cancelAll` 的幂等用例。
- 或进入业务域 P2：订单、支付、库存、钱包、优惠券等更高风险状态机。

### P1 第七批：用户角色授权幂等与超级管理员保护（2026-05-12）

状态：已实施。

改动范围：

- 修改 `apps/backend/src/module/admin/system/user/services/user-role.service.ts`。
- 新增 `apps/backend/src/module/admin/system/user/services/user-role.service.security.spec.ts`。

已覆盖规格：

- 禁止修改 `userId=1` 系统用户的角色授权，且不会删除 / 新建角色关系。
- `updateAuthRole` 会过滤超级管理员角色 `roleId=1`、重复 ID、非法 ID 和 `0`，只写入普通正整数角色 ID。
- 当 `roleIds` 仅包含超级管理员或非法 ID 时，会清空旧普通授权，不会遗留旧角色。
- 批量授权禁止授予 `roleId=1` 超级管理员角色。
- 批量授权会在 service 层去重用户 ID，并继续使用 `skipDuplicates` 兜底。
- 批量授权空列表作为幂等 no-op，不调用 `createMany`。
- 批量取消授权会去重 / 过滤用户 ID。
- 批量取消空列表作为幂等 no-op，不调用 `deleteMany`。

已执行验证：

- `pnpm --filter @apps/backend test:unit -- src/module/admin/system/user/services/user-role.service.security.spec.ts --runInBand`：通过，1 个 suite / 8 个用例。
- `pnpm --filter @apps/backend typecheck`：通过。
- `pnpm --filter @apps/backend exec prettier --check src/module/admin/system/user/services/user-role.service.ts src/module/admin/system/user/services/user-role.service.security.spec.ts`：通过。

残余风险：

- HTTP controller 层仍有 `RequireRole('admin')` 未被真实全局 `RolesGuard` 执行的问题；该生产缺口已在 P1 第二批记录，后续应单独修复。
- 该批未覆盖真实数据库唯一约束，当前依赖 `createMany(skipDuplicates)` 和 service 去重双保险。

下一批建议：

- 进入 P2 高风险业务域前，建议先确认是否修复 `RolesGuard` 与验证码重放两个生产缺口。
- 若继续只补测试，可转向支付 / 订单 / 库存 / 钱包等核心状态机反例。

### P1 第八批：认证高风险生产修复（2026-05-12）

状态：已实施，用户已明确确认执行认证高风险修复。

改动范围：

- 修改 `apps/backend/src/app.module.ts`，注册真实 `RolesGuard`。
- 修改 `apps/backend/src/module/admin/common/guards/roles.guard.ts`，让 `@RequireRole` 元数据真正参与 HTTP guard 判断。
- 修改 `apps/backend/src/module/admin/common/decorators/captcha.decorator.ts`，验证码验证成功后消费 Redis key。
- 修改 `apps/backend/src/module/admin/system/user/user.service.ts`，移除外层重复 `@Captcha`，保留 `UserAuthService.login` 的验证码校验，避免消费后第二层误判过期。
- 更新 `apps/backend/src/module/admin/system/admin-entry-security.http.spec.ts`。
- 更新 `apps/backend/src/module/admin/system/user/services/user-auth.service.security.spec.ts`。

已覆盖规格：

- `@RequireRole('admin')` 接口在缺少 `admin` 角色时返回 403，且不会进入 service。
- `@RequireRole('admin')` 接口在具备 `admin` 角色时允许进入 service。
- 验证码匹配成功后调用 `RedisService.del(captchaKey)` 消费验证码。
- 同一个验证码 uuid 首次登录成功后，第二次复用会返回“验证码已过期”。
- `UserService.login -> UserAuthService.login` 链路不再发生双层验证码消费 / 误判。

已执行验证：

- `pnpm --filter @apps/backend test:unit -- src/module/admin/system/admin-entry-security.http.spec.ts src/module/admin/system/user/services/user-auth.service.security.spec.ts --runInBand`：通过，2 个 suite / 21 个用例。
- `pnpm --filter @apps/backend test:unit -- src/module/admin/auth/dto/admin-auth.dto.spec.ts src/module/admin/auth/auth.controller.security.http.spec.ts src/module/admin/system/admin-system.dto.spec.ts src/module/admin/system/admin-entry-security.metadata.spec.ts src/module/admin/system/admin-entry-security.http.spec.ts src/module/admin/system/user/services/user-auth.service.security.spec.ts src/module/admin/system/user/services/user-role.service.security.spec.ts src/module/admin/system/role/role.service.spec.ts src/module/admin/system/user/user.service.spec.ts src/module/admin/system/tenant/tenant.service.spec.ts --runInBand`：通过，10 个 suite / 138 个用例。
- `pnpm --filter @apps/backend typecheck`：通过。
- `pnpm --filter @apps/backend exec prettier --check src/module/admin/common/guards/roles.guard.ts src/module/admin/common/decorators/captcha.decorator.ts src/module/admin/system/admin-entry-security.http.spec.ts src/module/admin/system/user/services/user-auth.service.security.spec.ts src/module/admin/system/user/user.service.ts src/app.module.ts`：通过。

残余风险：

- 未运行真实 AppModule E2E；真实 JWT、Redis、seed 权限数据仍需在集成环境验证。
- `RolesGuard` 当前支持 `roles` 数组匹配，并允许 `permissions` 包含 `*:*:*` 作为超级权限兜底；如产品要求“只有角色名 admin 才能过”，需移除权限兜底并补回归测试。
- 验证码消费失败时当前会抛出 Redis 错误并中断登录；这是偏安全的处理，后续若要可用性优先，需要定义降级策略。

下一批建议：

- 补真实 AppModule E2E：非 admin token 调用 `system/user/authRole/:id` 必须 403；admin token 必须通过。
- 进入 P2 高风险业务域：订单、支付、库存、钱包、优惠券状态机与幂等反例。

### P2 第一批：支付回调状态机与库存非法输入防线（2026-05-12）

状态：已实施，用户已明确确认执行 P2 高风险业务域测试与必要修复。

改动范围：

- 修改 `apps/backend/src/module/client/payment/payment.service.ts`。
- 更新 `apps/backend/src/module/client/payment/payment.service.spec.ts`。
- 修改 `apps/backend/src/module/store/stock/stock.service.ts`。
- 更新 `apps/backend/src/module/store/stock/stock.service.spec.ts`。

已覆盖规格：

- 预下单必须同时满足订单主状态 `PENDING_PAY` 与支付状态 `UNPAID`，避免已支付订单重复预下单。
- 支付回调缺少商户订单号或交易单号时拒绝处理，且不查询订单、不推进状态。
- 支付回调金额与订单应付金额不一致时拒绝推进支付状态。
- 支付成功 CAS 必须同时约束 `status=PENDING_PAY`、`payStatus=UNPAID`、`delFlag=NORMAL`，防止支付回调击穿取消、重复支付或软删边界。
- 订单主状态待支付但 `payStatus=PAID` 的异常重复回调不会再次更新订单、创建履约单或发布支付事件。
- 库存手工调整拒绝 `NaN` / `Infinity`，且不触达仓储。
- 订单库存扣减拒绝 `0`、负数、`NaN`、`Infinity`，且不写库存流水。
- 订单取消释放遇到 `0`、负数、`NaN`、`Infinity` 会跳过，避免污染库存。
- 批量库存调整遇到非法数字会记录单项失败，并继续处理后续合法项。

已执行验证：

- `pnpm --filter @apps/backend test:unit -- src/module/client/payment/payment.service.spec.ts src/module/store/stock/stock.service.spec.ts --runInBand`：通过，2 个 suite / 36 个用例。

残余风险：

- 本批是 service 级单元测试，未运行真实微信回调 E2E、真实数据库事务或真实履约单唯一约束。
- 支付自动退款目前仍只触发网关退款并返回 `REFUND_PENDING`，未补退款记录 / 对账状态机；后续应进入退款与财务账务专项。
- 库存并发不为负仍主要依赖 `TenantSkuRepository.updateStockForTenant` 的原子更新；本批没有补真实 DB 并发测试。

下一批建议：

- P2 第二批继续订单状态机：取消订单重复调用、用户 A 访问 / 取消用户 B 订单、分页边界、系统自动取消与支付回调的更多乱序反例。
- P2 第三批进入退款 / 钱包 / 提现 / 财务账务幂等与部分失败。

### P2 第二批：订单状态机、越权访问与分页边界（2026-05-12）

状态：已实施，延续用户对 P2 高风险业务域测试与必要修复的确认。

改动范围：

- 修改 `apps/backend/src/module/client/order/order.service.ts`。
- 修改 `apps/backend/src/module/client/order/services/order-creation-application.service.ts`。
- 更新 `apps/backend/src/module/client/order/order.service.spec.ts`。

已覆盖规格：

- 下单前在 service 层拒绝空 `tenantId`、空 `items`、空 `skuId`、非法数量 `0` / 负数 / `NaN` / 小数，避免绕过 DTO 时创建空订单或脏订单。
- 下单非法输入在风控、结算预览和订单写库前失败，不产生外部副作用。
- 用户 A 访问或取消用户 B 的订单时，必须按当前 `memberId` 查询；查不到统一返回“订单不存在”，不执行取消、库存释放或事件发布。
- 已取消订单重复取消时幂等返回“订单已取消”，不重复 CAS、不重复释放库存、不重复发布取消事件。
- 两个取消请求并发时，CAS 失败的一侧不释放库存、不发布取消事件。
- 系统自动取消遇到 CAS 冲突时返回 `conflict`，不释放库存、不发布取消事件。
- 订单列表 service 层拒绝非法 `pageNum`、非法 `pageSize` 和非法 `status`，不把负 skip、零 take 或未知状态传给仓储。
- 空订单列表稳定返回 `{ rows: [], total: 0 }`；第三页边界稳定计算 `skip=20`、`take=10`。

已执行验证：

- `pnpm --filter @apps/backend test:unit -- src/module/client/order/order.service.spec.ts --runInBand`：通过，1 个 suite / 59 个用例。
- `pnpm --filter @apps/backend typecheck`：通过。

残余风险：

- 本批仍是 service 级单元测试，未运行真实 C 端 HTTP + `MemberAuthGuard` + `ValidationPipe` + 数据库链路。
- 创建订单重复请求仍主要依赖 controller 上的 `@Idempotent`，本批未验证真实 Redis 幂等键。
- 订单支付后退款、履约发货、确认收货等后续状态机未纳入本批。

下一批建议：

- P2 第三批进入退款 / 钱包 / 提现 / 财务账务幂等与部分失败。
- 或先补 C 端订单 HTTP 入口：未登录、非法 body、多余字段、重复 idempotency key、用户 A 访问用户 B 订单的真实路由测试。

### P2 第三批：钱包冻结余额与提现非法金额防线（2026-05-12）

状态：已实施，延续用户对 P2 高风险业务域测试与必要修复的确认。

改动范围：

- 修改 `apps/backend/src/module/finance/wallet/wallet.repository.ts`。
- 修改 `apps/backend/src/module/finance/wallet/wallet.service.ts`。
- 更新 `apps/backend/src/module/finance/wallet/wallet.service.spec.ts`。
- 修改 `apps/backend/src/module/finance/withdrawal/withdrawal.service.ts`。
- 更新 `apps/backend/src/module/finance/withdrawal/withdrawal.service.spec.ts`。

已覆盖规格：

- 钱包金额操作拒绝 `NaN`，不会把非法金额传入余额增加、扣减、冻结等写路径。
- 待回收余额回收遇到 `NaN` 或非正数时返回 0，不查库、不更新待回收台账。
- 提现驳回解冻余额改为 `unfreezeBalanceAtomic`：只有 `frozen >= amount` 时才 `balance += amount`、`frozen -= amount`，防止重复驳回或并发解冻把冻结余额扣成负数。
- 提现成功扣减冻结余额改为 `deductFrozenAtomic`：只有 `frozen >= amount` 时才扣减，防止重复打款完成或并发扣减把冻结余额扣成负数。
- 原子解冻 / 扣减失败时抛出“冻结余额不足”，且不查询更新后钱包。
- 提现申请金额为 `NaN` 时在每日限额、钱包查询、冻结和创建提现记录前拒绝，并释放防重锁。
- 提现申请余额不足等失败路径会释放防重锁，避免失败请求占住短期提现锁。

已执行验证：

- `pnpm --filter @apps/backend test:unit -- src/module/finance/wallet/wallet.service.spec.ts src/module/finance/withdrawal/withdrawal.service.spec.ts --runInBand`：通过，2 个 suite / 53 个用例。
- `pnpm --filter @apps/backend typecheck`：通过。

残余风险：

- 本批未运行真实数据库并发测试，`frozen >= amount` 的不变量仍需后续用 repository / integration 验证真实 Prisma `updateMany` 行为。
- 提现外部打款回调、退款记录和对账状态机未纳入本批。
- 真实 Redis 防重锁、事务回滚与外部事件失败的组合仍需集成测试补证据。

下一批建议：

- P2 第四批进入提现审核 / 打款重试状态机：重复 approve、重复 reject、PROCESSING 回调、FAILED 重试上限、打款成功后流水幂等。
- 或补 wallet repository 集成测试，用真实 DB 验证冻结余额 CAS 在并发下不为负。

### P2 第四批：提现审核与打款重试状态机（2026-05-13）

状态：已实施，延续用户对 P2 高风险业务域测试与必要修复的确认。

改动范围：

- 修改 `apps/backend/src/module/finance/withdrawal/withdrawal.repository.ts`。
- 修改 `apps/backend/src/module/finance/withdrawal/withdrawal-audit.service.ts`。
- 更新 `apps/backend/src/module/finance/withdrawal/withdrawal-audit.service.spec.ts`。

已覆盖规格：

- 审核通过前先用 `claimPendingForApproval` 抢占 `PENDING -> PROCESSING`；抢占失败时视为已处理，不调用外部打款、不扣冻结余额、不写流水。
- 非 `PENDING` 提现不能再次审核通过或驳回，避免已处理状态被重复推进。
- 打款成功后的完成入账必须通过 `PROCESSING -> APPROVED` CAS；CAS 失败时不扣冻结余额、不写钱包流水。
- 打款失败只把仍处于 `PROCESSING` 的提现标记为 `FAILED`，避免覆盖已被其他流程处理的状态。
- 驳回提现必须先通过 `PENDING -> REJECTED` CAS；CAS 成功后才释放冻结余额，重复驳回或竞态失败不解冻。
- 打款重试先用 `claimFailedForRetry` 抢占 `FAILED -> PROCESSING` 并递增 `retryCount`；抢占失败时不打款。
- 重试成功、处理中、失败都只更新 `PROCESSING` 状态；重试成功后的扣冻结余额和流水写入同样受完成 CAS 保护。

已执行验证：

- `pnpm --filter @apps/backend test:unit -- src/module/finance/withdrawal/withdrawal-audit.service.spec.ts --runInBand`：通过，1 个 suite / 17 个用例。
- `pnpm --filter @apps/backend test:unit -- src/module/finance/withdrawal/withdrawal-audit.service.spec.ts src/module/finance/wallet/wallet.service.spec.ts src/module/finance/withdrawal/withdrawal.service.spec.ts --runInBand`：通过，3 个 suite / 70 个用例。
- `pnpm --filter @apps/backend typecheck`：通过。

残余风险：

- 本批仍是 service + repository mock 级验证，未运行真实数据库并发、真实支付通道或真实事务回滚。
- `WithdrawalReconciliationScheduler` 仍存在直接状态更新与钱包扣减 / 解冻路径，尚未纳入本批 CAS 幂等治理。
- `PROCESSING` 且无 `paymentNo` 的异常挂起路径依赖后续对账超时策略收口，尚未补真实调度测试。

下一批建议：

- P2 第五批进入提现对账补偿 scheduler：`PROCESSING` 成功 / 失败 CAS、重复调度不重复扣款或解冻、无 `paymentNo` 超时处理、真实支付查询异常。
- 或补提现 repository / integration 测试，用真实 DB 验证 `claimPendingForApproval`、`claimFailedForRetry` 与完成 CAS 在并发下只有一个成功。

### P2 第五批：提现对账补偿状态机与重复调度防线（2026-05-13）

状态：已实施，延续用户对 P2 高风险业务域测试与必要修复的确认。

改动范围：

- 修改 `apps/backend/src/module/finance/withdrawal/withdrawal-audit.service.ts`。
- 修改 `apps/backend/src/module/finance/withdrawal/withdrawal-reconciliation.scheduler.ts`。
- 更新 `apps/backend/src/module/finance/withdrawal/withdrawal-reconciliation.scheduler.spec.ts`。

已覆盖规格：

- 无 `paymentNo` 的 `FAILED` 记录会先走 `retryPayment`；重试成功时不自动驳回、不解冻余额。
- 无 `paymentNo` 的超时记录只有当前状态 CAS 成功后才终止并解冻；CAS 失败时不解冻，避免重复调度或竞态重复释放冻结余额。
- 通道确认成功时，scheduler 不再直接扣冻结余额，而是委托 `WithdrawalAuditService.completeChannelConfirmedSuccess` 走统一完成入账路径，复用 `PROCESSING/FAILED -> APPROVED` CAS、冻结扣减和钱包流水写入。
- 通道确认失败时，只有当前状态 CAS 成功后才终止并解冻；CAS 失败时不解冻。
- 对账单条记录处理失败时继续处理后续记录；任务锁获取失败仍跳过，任务异常仍释放锁。

已执行验证：

- `pnpm --filter @apps/backend test:unit -- src/module/finance/withdrawal/withdrawal-reconciliation.scheduler.spec.ts --runInBand`：通过，1 个 suite / 13 个用例。
- `pnpm --filter @apps/backend test:unit -- src/module/finance/withdrawal/withdrawal-audit.service.spec.ts src/module/finance/withdrawal/withdrawal-reconciliation.scheduler.spec.ts src/module/finance/wallet/wallet.service.spec.ts src/module/finance/withdrawal/withdrawal.service.spec.ts --runInBand`：通过，4 个 suite / 83 个用例。
- `pnpm --filter @apps/backend typecheck`：通过。

残余风险：

- 本批仍是单元级 mock 验证，未运行真实数据库并发、真实 Redis 锁或真实支付通道查询。
- 通道确认失败后当前使用 `REJECTED` 作为终止并解冻状态；如果产品语义要求保留“通道失败但已退回”的独立终态，需要新增枚举和迁移，需单独确认 Prisma 高风险变更。
- 无 `paymentNo` 的 `FAILED` 记录在重试仍失败后会按现有策略进入终止解冻；如果要“失败后继续等下一轮直到重试上限”，需要重新定义调度策略。

下一批建议：

- 进入钱包 / 提现 repository integration：用真实 DB 验证 `updateMany` CAS、冻结余额不为负和重复调度只有一次资金副作用。
- 或切到营销优惠券 / 积分任务并发：重复核销、状态不允许流转、任务并发重复发放。

### P2 第六批：钱包 / 提现 Repository CAS 合同测试（2026-05-13）

状态：已实施，延续用户对 P2 高风险业务域测试与必要修复的确认。

改动范围：

- 新增 `apps/backend/src/module/finance/wallet/wallet.repository.spec.ts`。
- 新增 `apps/backend/src/module/finance/withdrawal/withdrawal.repository.spec.ts`。

已覆盖规格：

- `freezeBalanceAtomic` 必须使用 `updateMany`，且 where 同时包含 `memberId` 与 `balance >= amount`，data 同时执行 `balance -= amount`、`frozen += amount`、`version += 1`。
- `unfreezeBalanceAtomic` 必须使用 `frozen >= amount` 作为下界，CAS 失败返回 0，不允许调用方误以为解冻成功。
- `deductFrozenAtomic` 必须使用 `frozen >= amount` 作为下界，CAS 失败返回 0，不允许重复提现完成把冻结余额扣成负数。
- `updateStatusIfCurrent` 必须把 `id + currentStatus` 放入 where，避免无状态约束更新提现记录。
- `claimPendingForApproval` 只能抢占 `PENDING -> PROCESSING`，并写入审核人、审核时间与清空失败原因。
- `claimFailedForRetry` 只能抢占 `FAILED` 且 `retryCount < maxRetryCount` 的记录，并原子递增 `retryCount`。
- 状态已变或重试次数已达上限时，repository 返回 0，由 service 层决定幂等返回或拒绝副作用。

已执行验证：

- `pnpm --filter @apps/backend test:unit -- src/module/finance/wallet/wallet.repository.spec.ts src/module/finance/withdrawal/withdrawal.repository.spec.ts --runInBand`：通过，2 个 suite / 10 个用例。
- `pnpm --filter @apps/backend test:unit -- src/module/finance/wallet/wallet.repository.spec.ts src/module/finance/withdrawal/withdrawal.repository.spec.ts src/module/finance/wallet/wallet.service.spec.ts src/module/finance/withdrawal/withdrawal.service.spec.ts src/module/finance/withdrawal/withdrawal-audit.service.spec.ts src/module/finance/withdrawal/withdrawal-reconciliation.scheduler.spec.ts --runInBand`：通过，6 个 suite / 93 个用例。
- `pnpm --filter @apps/backend typecheck`：通过。

残余风险：

- 当前仓库 `test/integration` 仍是基础 harness，当前进程也未设置 `DATABASE_URL`；本批没有运行真实 PostgreSQL 并发测试，避免误连本地业务库。
- 真实 Prisma `updateMany` 的事务隔离、并发竞争和 Decimal 精度仍需在专用 test database 上补证据。
- `BaseRepository.updateMany` 当前写路径不自动注入 tenant scope；本批验证的是资金 CAS 合同，不改变租户写入语义。后续若要收敛，需要单独做多租户写路径设计。

下一批建议：

- 若能提供专用 `DATABASE_URL` / 隔离测试库，补真实 DB repository integration：并发 freeze/unfreeze/deductFrozen、重复状态抢占、调度重复执行。
- 若暂不启用真实 DB，切到营销优惠券 / 积分任务并发：重复核销、状态不允许流转、任务并发重复发放。

### P2 第七批：优惠券核销状态机与积分任务并发防线（2026-05-13）

状态：已实施，延续用户对 P2 高风险业务域测试与必要修复的确认。

改动范围：

- 修改 `apps/backend/src/module/marketing/coupon/distribution/user-coupon.repository.ts`。
- 新增 `apps/backend/src/module/marketing/coupon/distribution/user-coupon.repository.spec.ts`。
- 修改 `apps/backend/src/module/marketing/coupon/usage/usage.service.ts`。
- 更新 `apps/backend/src/module/marketing/coupon/usage/usage.service.spec.ts`。
- 修改 `apps/backend/src/module/marketing/points/task/task.service.ts`。
- 更新 `apps/backend/src/module/marketing/points/task/task.service.spec.ts`。

已覆盖规格：

- 优惠券核销必须从 `LOCKED -> USED`，且 where 同时约束 `id + status=LOCKED + orderId`，避免订单 B 核销订单 A 锁定的券。
- 核销 CAS 返回 0 时，service 抛业务异常，且不查询订单金额、不创建使用记录、不发送 `COUPON_USED` 事件。
- 使用记录和营销事件只在优惠券状态推进成功后发生，避免重复回调或乱序支付事件重复写副作用。
- 积分任务完成切换为 `Serializable` 事务隔离，降低 `countUserCompletions -> addPoints -> create completion` 在并发下重复发放积分的风险。
- `completeTask` 的事务元数据有单测证明，防止后续改回默认隔离级别。

已执行验证：

- `pnpm --filter @apps/backend test:unit -- src/module/marketing/coupon/usage/usage.service.spec.ts src/module/marketing/coupon/distribution/user-coupon.repository.spec.ts src/module/marketing/points/task/task.service.spec.ts --runInBand`：通过，3 个 suite / 41 个用例。
- `pnpm --filter @apps/backend typecheck`：通过。

残余风险：

- 积分任务完成仍缺少数据库唯一约束，`Serializable` 能降低并发重复发放风险，但不是跨数据库 / 异常重试下的完整幂等键。若要彻底证明，需要 Prisma schema 新增唯一约束或引入业务幂等表，需单独确认高风险 schema 变更。
- 优惠券 refund / unlock 当前仍未绑定 orderId，重复退款本批不会创建额外使用记录，但跨订单解锁 / 返还语义仍需后续按订单状态机收口。
- 本批未运行真实 PostgreSQL 并发测试，营销状态机仍需专用 test database 进一步验证。

下一批建议：

- 继续营销：优惠券 `unlock/refund` 增加 orderId 约束与重复退款幂等测试，或为积分任务设计 schema 级唯一约束方案。
- 或切回 C 端 HTTP 入口：优惠券领取 / 核销 / 积分任务完成的未登录、越权、非法 body、重复请求验证。

### P2 第八批：优惠券解锁/退款归属、C 端入口边界与批处理重复输入（2026-05-13）

状态：已实施，延续用户对 P2 高风险业务域测试与必要修复的确认。

改动范围：

- 修改 `apps/backend/src/module/marketing/coupon/distribution/user-coupon.repository.ts`。
- 更新 `apps/backend/src/module/marketing/coupon/distribution/user-coupon.repository.spec.ts`。
- 修改 `apps/backend/src/module/marketing/coupon/usage/usage.service.ts`。
- 更新 `apps/backend/src/module/marketing/coupon/usage/usage.service.spec.ts`。
- 修改 `apps/backend/src/module/marketing/integration/integration.service.ts`。
- 新增 `apps/backend/src/module/client/common/utils/pagination.ts`。
- 修改 `apps/backend/src/module/client/marketing/coupon/client-coupon.controller.ts`。
- 修改 `apps/backend/src/module/client/marketing/coupon/client-coupon.module.ts`。
- 新增 `apps/backend/src/module/client/marketing/coupon/client-coupon.controller.spec.ts`。
- 修改 `apps/backend/src/module/client/marketing/points/client-points-task.controller.ts`。
- 新增 `apps/backend/src/module/client/marketing/points/client-points-task.controller.spec.ts`。
- 修改 `apps/backend/src/module/client/finance/client-finance.service.ts`。
- 更新 `apps/backend/src/module/client/finance/client-finance.service.spec.ts`。
- 修改 `apps/backend/src/module/store/order/store-order.service.ts`。
- 更新 `apps/backend/src/module/store/order/store-order.service.spec.ts`。

已覆盖规格：

- 优惠券解锁必须从 `LOCKED -> UNUSED`，且 where 同时约束 `id + status=LOCKED + orderId`，避免订单 B 解锁订单 A 的券。
- 优惠券退款返还必须从 `USED -> UNUSED`，且 where 同时约束 `id + status=USED + orderId`，避免跨订单重复返还。
- `UsageService.unlockCoupon/refundCoupon` 在 CAS 返回 0 时抛业务异常，不继续假定状态已推进。
- `IntegrationService.handleOrderCancelled/handleOrderRefunded` 将订单 ID 传入优惠券状态机，保证取消 / 退款事件与券归属一致。
- C 端优惠券可领取列表移除占位返回，改为查询有效模板、剩余库存、时间窗口，并返回会员维度 `claimedCount/claimable`。
- C 端优惠券、积分任务和财务列表统一拒绝 `pageNum <= 0`、`pageSize <= 0`、`pageSize > 100`、非整数分页。
- C 端优惠券状态、财务提现状态、佣金状态、流水类型均增加枚举边界，非法值不再透传 repository。
- C 端积分任务完成拒绝空 `taskKey`。
- 门店订单批量核销、批量退款、批量状态流转、批量备注更新先去重 `orderIds`，同一批内重复 ID 只触发一次业务副作用。

已执行验证：

- `pnpm --filter @apps/backend test:unit -- src/module/marketing/coupon/usage/usage.service.spec.ts src/module/marketing/coupon/distribution/user-coupon.repository.spec.ts src/module/marketing/points/task/task.service.spec.ts --runInBand`：通过，3 个 suite / 46 个用例。
- `pnpm --filter @apps/backend test:unit -- src/module/client/marketing/coupon/client-coupon.controller.spec.ts src/module/client/marketing/points/client-points-task.controller.spec.ts src/module/client/finance/client-finance.service.spec.ts src/module/marketing/coupon/usage/usage.service.spec.ts src/module/marketing/coupon/distribution/user-coupon.repository.spec.ts src/module/marketing/points/task/task.service.spec.ts --runInBand`：通过，6 个 suite / 62 个用例。
- `pnpm --filter @apps/backend test:unit -- src/module/store/order/store-order.service.spec.ts --runInBand`：通过，1 个 suite / 51 个用例。
- `pnpm --filter @apps/backend typecheck`：通过。

残余风险：

- C 端优惠券可领取列表当前是 controller 级 mock 验证，未跑真实 Prisma 查询与真实 tenant 上下文。
- 可领取列表对每个模板逐条统计会员领取次数，后续数据量增大时可继续优化为聚合查询；本批只收口正确性与边界。
- 批处理去重只解决同一请求内重复输入，跨请求重复仍依赖各单项状态机和幂等键。

### P2 第九批：公开入口权限、错误上报、AI 文案与 SSE 边界（2026-05-13）

状态：已实施，延续用户对 P2 高风险业务域测试与必要修复的确认。

改动范围：

- 修改 `apps/backend/src/module/common/error-event/dto/report-error-event.dto.ts`。
- 新增 `apps/backend/src/module/common/error-event/error-event-report.controller.spec.ts`。
- 修改 `apps/backend/src/module/ai-content/dto/generate-content.dto.ts`。
- 修改 `apps/backend/src/module/ai-content/ai-content.service.ts`。
- 新增 `apps/backend/src/module/ai-content/ai-content.service.spec.ts`。
- 修改 `apps/backend/src/module/client/ai-content/client-ai-content.controller.ts`。
- 新增 `apps/backend/src/module/client/ai-content/client-ai-content.controller.spec.ts`。
- 修改 `apps/backend/src/module/admin/resource/sse.controller.ts`。
- 新增 `apps/backend/src/module/admin/resource/sse.controller.spec.ts`。

已覆盖规格：

- 公开错误上报入口继续显式 `@NotRequireAuth`，但 DTO 拒绝空 `errorCode`、空 `safeMessage`、未知 app、负耗时和额外字段。
- 错误上报 controller 默认 `level=error`，并固定 `source=client-report` 传入观测服务。
- AI 文案生成拒绝空平台、空输入、超长平台、超长输入和 prompt injection 关键词；拒绝后不调用 OpenAI、不写生成记录。
- AI 文案生成会 trim 平台和用户输入，写入记录与调用 OpenAI 均使用规范化值。
- C 端 AI 历史分页复用统一分页边界，拒绝非法页码与超大页大小。
- SSE 长连接继续手工校验 access token；缺 token 或非 access token 返回 Unauthorized 事件且不注册连接。
- SSE `send` / `broadcast` / `count` 增加权限元数据，其中发送与广播复用 `system:notice:add`，连接数复用 `system:message:list`。
- SSE 发送和广播拒绝非法用户 ID、空消息与超长消息，消息发送前会 trim。

已执行验证：

- `pnpm --filter @apps/backend test:unit -- src/module/common/error-event/error-event-report.controller.spec.ts src/module/ai-content/ai-content.service.spec.ts src/module/client/ai-content/client-ai-content.controller.spec.ts src/module/admin/resource/sse.controller.spec.ts --runInBand`：通过，4 个 suite / 29 个用例。
- `pnpm --filter @apps/backend typecheck`：通过。

残余风险：

- 错误上报仍是公开入口，仍依赖全局限流；本批没有新增独立上报频率策略。
- SSE 连接鉴权仍通过 query token 兼容前端 `EventSource`，本批仅收口权限元数据和消息写入口参数，不改连接协议。
- AI 文案测试未调用真实 OpenAI provider，只验证本地防线和调用边界。

### P2 第十批：佣金结算、部分退款与履约幂等副作用（2026-05-13）

状态：已实施，延续用户对 P2 高风险业务域测试与必要修复的确认。

改动范围：

- 修改 `apps/backend/src/module/finance/settlement/settlement.scheduler.ts`。
- 更新 `apps/backend/src/module/finance/settlement/settlement.scheduler.spec.ts`。
- 修改 `apps/backend/src/module/finance/commission/services/commission-settler.service.ts`。
- 更新 `apps/backend/src/module/finance/commission/services/commission-settler.service.spec.ts`。
- 修改 `apps/backend/src/module/fulfillment/fulfillment.controller.ts`。
- 修改 `apps/backend/src/module/fulfillment/fulfillment.service.ts`。
- 更新 `apps/backend/src/module/fulfillment/fulfillment.service.spec.ts`。
- 修改 `apps/backend/src/module/fulfillment/dto/fulfillment.dto.ts`。
- 新增 `apps/backend/src/module/fulfillment/dto/fulfillment.dto.spec.ts`。

已覆盖规格：

- 佣金结算 `settleOne` 在 `FROZEN -> SETTLED` CAS 返回 0 时返回 `settled=false`，不增加统计成功数、不写钱包、不写流水、不发送 `CommissionSettled` 事件。
- 结算重试结果区分 `success` 与 `settled`，状态已变化的重复调度不再被统计为成功结算。
- 部分退款佣金回滚拒绝 `refundRatio <= 0` 或 `refundRatio > 1`，非法比例不会查询佣金、不会取消佣金、不会回退钱包。
- 后台确认实物收货现在把 DTO 的 `operationId` 传入 service 层。
- 发货、确认收货、服务核销在发现同一 `operationId` 已处理时，跳过后续状态推进和后置副作用。
- 重复发货不会再次创建 shipment、不会再次追加订单备注。
- 重复确认收货不会再次更新佣金计划结算时间。
- 重复服务核销不会再次更新佣金结算时间、不会重复标记服务订单资格、不会重复同步主订单备注。
- 履约 DTO 拒绝空订单号、空幂等号、非法订单项 ID、非法发货数量、非法技师 ID 和额外字段。

已执行验证：

- `pnpm --filter @apps/backend test:unit -- src/module/finance/settlement/settlement.scheduler.spec.ts --runInBand`：通过，1 个 suite / 10 个用例。
- `pnpm --filter @apps/backend test:unit -- src/module/finance/commission/services/commission-settler.service.spec.ts --runInBand`：通过，1 个 suite / 8 个用例。
- `pnpm --filter @apps/backend test:unit -- src/module/fulfillment/fulfillment.service.spec.ts --runInBand`：通过，1 个 suite / 12 个用例。
- `pnpm --filter @apps/backend test:unit -- src/module/fulfillment/dto/fulfillment.dto.spec.ts --runInBand`：通过，1 个 suite / 11 个用例。
- `pnpm --filter @apps/backend test:unit -- src/module/marketing/coupon/usage/usage.service.spec.ts src/module/marketing/coupon/distribution/user-coupon.repository.spec.ts src/module/marketing/points/task/task.service.spec.ts src/module/client/marketing/coupon/client-coupon.controller.spec.ts src/module/client/marketing/points/client-points-task.controller.spec.ts src/module/client/finance/client-finance.service.spec.ts src/module/store/order/store-order.service.spec.ts src/module/common/error-event/error-event-report.controller.spec.ts src/module/ai-content/ai-content.service.spec.ts src/module/client/ai-content/client-ai-content.controller.spec.ts src/module/admin/resource/sse.controller.spec.ts src/module/finance/settlement/settlement.scheduler.spec.ts src/module/finance/commission/services/commission-settler.service.spec.ts src/module/fulfillment/fulfillment.service.spec.ts src/module/fulfillment/dto/fulfillment.dto.spec.ts --runInBand`：通过，15 个 suite / 183 个用例。
- `pnpm --filter @apps/backend typecheck`：通过。

残余风险：

- 本批仍未引入真实数据库并发测试；CAS、事务和幂等副作用仍需在隔离 test database 上补证据。
- 履约幂等依赖 `fulfillmentEvent.operationId + eventType` 查询，若底层没有唯一约束，极端并发下仍可能需要 schema 级唯一约束；这属于 Prisma 高风险变更，未在本批执行。
- 佣金部分退款当前沿用“部分退款后取消有效佣金”的历史语义，只补比例防线，没有重新设计“部分保留佣金”的账务模型。

下一批建议：

- 在专用测试库上补真实并发 integration：佣金结算 CAS、履约 operationId、优惠券 orderId CAS、钱包冻结不变量。
- 若允许 Prisma schema 高风险变更，再评估积分任务唯一键、履约 operationId 唯一键、部分退款佣金明细状态模型。
