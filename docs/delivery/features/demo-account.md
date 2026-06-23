# 演示账户系统

Nest-Admin-Soybean 内置完善的演示账户系统，提供安全可靠的在线演示方案。演示账户具有 52 个只读权限，可以查看系统所有模块，但不能进行任何修改操作。

## 快速使用

### 登录信息

- **账号**: `demo`
- **密码**: `demo123`
- **租户ID**: `000000`

### 权限范围

演示账户可以：

- ✅ 查看所有系统模块
- ✅ 查询用户、角色、菜单等数据
- ✅ 导出数据为 Excel
- ✅ 查看操作日志和登录日志
- ✅ 查看系统监控数据

演示账户不能：

- ❌ 添加、修改、删除任何数据
- ❌ 导入数据
- ❌ 重置密码
- ❌ 修改系统配置
- ❌ 执行定时任务

## 系统架构

### 1. 数据库设计

演示账户的数据存储在标准用户表中，通过角色关联获得权限：

```sql
-- 演示角色
INSERT INTO sys_role (role_id, role_name, role_key, data_scope)
VALUES ('demo-role-id', '演示角色', 'demo', '1');

-- 演示用户
INSERT INTO sys_user (user_id, username, password, nick_name)
VALUES ('demo-user-id', 'demo', '$2b$10$hash...', '演示账户');

-- 用户角色关联
INSERT INTO _SysRoleToSysUser (A, B)
VALUES ('demo-role-id', 'demo-user-id');

-- 52个只读权限关联
INSERT INTO _SysMenuToSysRole (A, B)
SELECT menu_id, 'demo-role-id'
FROM sys_menu
WHERE permission LIKE '%:list'
   OR permission LIKE '%:query'
   OR permission LIKE '%:export';
```

### 2. 权限列表

演示角色拥有 52 个只读权限：

| 模块     | 权限标识                  | 说明           |
| -------- | ------------------------- | -------------- |
| 用户管理 | system:user:list          | 查询用户列表   |
|          | system:user:query         | 查询用户详情   |
|          | system:user:export        | 导出用户数据   |
| 角色管理 | system:role:list          | 查询角色列表   |
|          | system:role:query         | 查询角色详情   |
|          | system:role:export        | 导出角色数据   |
| 菜单管理 | system:menu:list          | 查询菜单列表   |
|          | system:menu:query         | 查询菜单详情   |
| 部门管理 | system:dept:list          | 查询部门列表   |
|          | system:dept:query         | 查询部门详情   |
| 岗位管理 | system:post:list          | 查询岗位列表   |
|          | system:post:query         | 查询岗位详情   |
|          | system:post:export        | 导出岗位数据   |
| 字典管理 | system:dict:list          | 查询字典列表   |
|          | system:dict:query         | 查询字典详情   |
|          | system:dict:export        | 导出字典数据   |
| 参数配置 | system:config:list        | 查询配置列表   |
|          | system:config:query       | 查询配置详情   |
|          | system:config:export      | 导出配置数据   |
| 通知公告 | system:notice:list        | 查询公告列表   |
|          | system:notice:query       | 查询公告详情   |
| 操作日志 | monitor:operlog:list      | 查询操作日志   |
|          | monitor:operlog:query     | 查询日志详情   |
|          | monitor:operlog:export    | 导出日志数据   |
| 登录日志 | monitor:logininfor:list   | 查询登录日志   |
|          | monitor:logininfor:query  | 查询登录详情   |
|          | monitor:logininfor:export | 导出登录日志   |
| 在线用户 | monitor:online:list       | 查询在线用户   |
|          | monitor:online:query      | 查询用户详情   |
| 定时任务 | monitor:job:list          | 查询任务列表   |
|          | monitor:job:query         | 查询任务详情   |
|          | monitor:job:export        | 导出任务数据   |
| 系统监控 | monitor:server:list       | 查询服务器信息 |
|          | monitor:cache:list        | 查询缓存信息   |

完整的 52 个权限详见 [演示账户权限清单](#权限清单)

## 后端实现

### 1. 权限守卫

通过 `PermissionGuard` 验证演示账户权限：

```typescript
@Injectable()
export class PermissionGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    // 检查是否为演示账户
    if (user.username === 'demo') {
      const method = request.method;

      // 拦截写操作
      if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(method)) {
        throw new ForbiddenException('演示账户不允许修改数据');
      }

      // 验证只读权限
      const requiredPermission = this.reflector.get('permission', context.getHandler());
      const userPermissions = await this.getUserPermissions(user.id);

      if (requiredPermission && !userPermissions.includes(requiredPermission)) {
        throw new ForbiddenException('权限不足');
      }
    }

    return true;
  }
}
```

### 2. 拦截器

使用拦截器作为额外的安全层：

```typescript
@Injectable()
export class DemoAccountInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    // 演示账户额外检查
    if (user?.username === 'demo') {
      const method = request.method;
      const path = request.url;

      // 黑名单路径
      const blacklist = [
        '/system/user/resetPwd',
        '/system/user/profile/updatePwd',
        '/system/config/edit',
        '/monitor/job/run',
      ];

      if (blacklist.some((p) => path.includes(p))) {
        throw new ForbiddenException('演示账户禁止访问此接口');
      }

      // 拦截写操作
      if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(method)) {
        throw new ForbiddenException('演示账户不允许修改数据');
      }
    }

    return next.handle();
  }
}
```

### 3. 应用拦截器

在应用启动时应用：

```typescript
// main.ts
async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // 全局应用演示账户拦截器
  app.useGlobalInterceptors(new DemoAccountInterceptor());

  await app.listen(8080);
}
```

## 前端实现

### 1. 登录页提示

在登录页显示演示账户信息：

```vue
<template>
  <div class="login-page">
    <!-- 登录表单 -->
    <n-form>
      <!-- ... -->
    </n-form>

    <!-- 演示账户提示卡片 -->
    <n-card class="demo-card">
      <template #header>
        <n-space align="center">
          <n-icon :component="UserOutlined" />
          <span>演示账户</span>
        </n-space>
      </template>

      <n-descriptions :column="1" label-placement="left">
        <n-descriptions-item label="账号">demo</n-descriptions-item>
        <n-descriptions-item label="密码">demo123</n-descriptions-item>
        <n-descriptions-item label="租户ID">000000</n-descriptions-item>
      </n-descriptions>

      <template #footer>
        <n-space vertical>
          <n-text type="success">✓ 可查看所有模块</n-text>
          <n-text type="success">✓ 可导出数据</n-text>
          <n-text type="warning">✗ 不可修改数据</n-text>
        </n-space>
      </template>

      <template #action>
        <n-button type="primary" @click="loginWithDemo"> 一键登录演示 </n-button>
      </template>
    </n-card>
  </div>
</template>

<script setup lang="ts">
const loginWithDemo = async () => {
  await login({
    username: 'demo',
    password: 'demo123',
    tenantId: '000000',
  });
};
</script>
```

### 2. 按钮禁用

根据演示账户自动禁用操作按钮：

```vue
<template>
  <n-space>
    <!-- 查询按钮 - 演示账户可用 -->
    <n-button type="primary" @click="handleQuery">
      <template #icon>
        <n-icon :component="SearchOutlined" />
      </template>
      查询
    </n-button>

    <!-- 添加按钮 - 演示账户禁用 -->
    <n-button type="primary" :disabled="isDemoAccount" @click="handleAdd">
      <template #icon>
        <n-icon :component="PlusOutlined" />
      </template>
      添加
    </n-button>

    <!-- 导出按钮 - 演示账户可用 -->
    <n-button type="success" @click="handleExport">
      <template #icon>
        <n-icon :component="DownloadOutlined" />
      </template>
      导出
    </n-button>
  </n-space>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useAuthStore } from '@/store';

const authStore = useAuthStore();
const isDemoAccount = computed(() => authStore.userInfo?.username === 'demo');
</script>
```

### 3. 提示信息

演示账户操作时显示友好提示：

```typescript
// utils/demo.ts
export function showDemoTip(message = '演示账户不允许此操作') {
  const authStore = useAuthStore();

  if (authStore.userInfo?.username === 'demo') {
    window.$message?.warning(message);
    return true;
  }

  return false;
}

// 使用
const handleDelete = async (id: string) => {
  if (showDemoTip()) return;

  await deleteUser(id);
};
```

## 初始化脚本

### 1. TypeScript 初始化脚本

位置：`server/scripts/init-demo-account.ts`

```typescript
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🚀 开始初始化演示账户...');

  // 1. 创建演示角色
  const demoRole = await prisma.sysRole.upsert({
    where: { roleKey: 'demo' },
    create: {
      roleId: 'demo-role-id',
      roleName: '演示角色',
      roleKey: 'demo',
      roleSort: 99,
      dataScope: '1',
      status: '0',
      tenantId: '000000',
      createBy: 'system',
      updateBy: 'system',
    },
    update: {},
  });

  // 2. 获取只读权限菜单
  const readOnlyMenus = await prisma.sysMenu.findMany({
    where: {
      OR: [
        { permission: { contains: ':list' } },
        { permission: { contains: ':query' } },
        { permission: { contains: ':export' } },
      ],
    },
  });

  // 3. 关联权限到角色
  await prisma.sysRole.update({
    where: { roleId: demoRole.roleId },
    data: {
      menus: {
        set: readOnlyMenus.map((m) => ({ menuId: m.menuId })),
      },
    },
  });

  // 4. 创建演示用户
  const hashedPassword = await bcrypt.hash('demo123', 10);

  const demoUser = await prisma.sysUser.upsert({
    where: { username: 'demo' },
    create: {
      userId: 'demo-user-id',
      username: 'demo',
      password: hashedPassword,
      nickName: '演示账户',
      userType: '00',
      email: 'demo@example.com',
      phonenumber: '',
      sex: '0',
      status: '0',
      tenantId: '000000',
      createBy: 'system',
      updateBy: 'system',
    },
    update: {
      password: hashedPassword,
    },
  });

  // 5. 关联用户到角色
  await prisma.sysUser.update({
    where: { userId: demoUser.userId },
    data: {
      roles: {
        connect: { roleId: demoRole.roleId },
      },
    },
  });

  console.log('✅ 演示账户初始化完成');
  console.log(`📋 权限数量: ${readOnlyMenus.length}`);
  console.log('🔑 账号: demo');
  console.log('🔑 密码: demo123');
  console.log('🏢 租户ID: 000000');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
```

### 2. Bash 辅助脚本

位置：`server/scripts/init-demo.sh`

```bash
#!/bin/bash

echo "🚀 初始化演示账户系统"
echo ""

# 检查 Node.js
if ! command -v node &> /dev/null; then
    echo "❌ 未找到 Node.js，请先安装"
    exit 1
fi

# 检查 pnpm
if ! command -v pnpm &> /dev/null; then
    echo "❌ 未找到 pnpm，请先安装"
    exit 1
fi

# 执行初始化脚本
echo "📦 执行初始化脚本..."
pnpm tsx scripts/init-demo-account.ts

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ 演示账户初始化成功！"
    echo ""
    echo "📖 使用说明："
    echo "  账号: demo"
    echo "  密码: demo123"
    echo "  租户ID: 000000"
    echo ""
else
    echo "❌ 初始化失败，请检查错误信息"
    exit 1
fi
```

### 3. 运行初始化

```bash
cd server

# 方式一：直接运行 TypeScript 脚本
pnpm tsx scripts/init-demo-account.ts

# 方式二：使用 bash 脚本
chmod +x scripts/init-demo.sh
./scripts/init-demo.sh

# 方式三：在数据库初始化时自动创建
pnpm prisma:seed:reset-hunan-skeleton
```

## 测试验证

### 1. 登录测试

```bash
curl -X POST http://localhost:8080/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "username": "demo",
    "password": "demo123",
    "tenantId": "000000"
  }'
```

预期结果：

```json
{
  "code": 200,
  "msg": "登录成功",
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIs..."
  }
}
```

### 2. 查询测试

```bash
curl -X GET http://localhost:8080/api/system/user/list \
  -H "Authorization: Bearer <token>" \
  -H "x-tenant-id: 000000"
```

预期结果：`200 OK` 返回用户列表

### 3. 写操作测试

```bash
curl -X POST http://localhost:8080/api/system/user \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"username": "test"}'
```

预期结果：

```json
{
  "code": 403,
  "msg": "演示账户不允许修改数据"
}
```

## 权限清单

演示角色的完整 52 个权限列表：

```
system:user:list
system:user:query
system:user:export
system:role:list
system:role:query
system:role:export
system:menu:list
system:menu:query
system:dept:list
system:dept:query
system:post:list
system:post:query
system:post:export
system:dict:list
system:dict:query
system:dict:export
system:config:list
system:config:query
system:config:export
system:notice:list
system:notice:query
monitor:operlog:list
monitor:operlog:query
monitor:operlog:export
monitor:logininfor:list
monitor:logininfor:query
monitor:logininfor:export
monitor:online:list
monitor:online:query
monitor:job:list
monitor:job:query
monitor:job:export
monitor:server:list
monitor:server:query
monitor:cache:list
monitor:cache:query
system:tenant:list
system:tenant:query
system:upload:list
system:upload:query
```

## 常见问题

### Q: 如何修改演示账户密码？

```typescript
// 在初始化脚本中修改
const hashedPassword = await bcrypt.hash('new-password', 10);
```

### Q: 如何添加新的演示权限？

```typescript
// 在初始化脚本中添加权限过滤条件
const readOnlyMenus = await prisma.sysMenu.findMany({
  where: {
    OR: [
      { permission: { contains: ':list' } },
      { permission: { contains: ':query' } },
      { permission: { contains: ':export' } },
      { permission: { contains: ':view' } }, // 新增
    ],
  },
});
```

### Q: 演示账户能查看敏感信息吗？

可以在服务层过滤敏感字段：

```typescript
async findAll() {
  const users = await this.prisma.sysUser.findMany()

  // 演示账户隐藏敏感信息
  if (isDemoAccount()) {
    return users.map(u => ({
      ...u,
      password: undefined,
      phonenumber: maskPhone(u.phonenumber),
      email: maskEmail(u.email)
    }))
  }

  return users
}
```

## 下一步

- [开始开发](/development/getting-started) - 环境与仓库约定
- [API 开发](/development/api) - 学习 API 开发
- [系统管理](/features/system-management) - 了解系统管理功能
