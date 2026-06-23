---
title: Miniapp Agent Map
status: active
doc_type: agent-supplement
owner: engineering-governance
last_verified: 2026-05-15
---

# Miniapp Agent Map

承接 miniapp AGENTS 中"AI 定位页面/API/store/双端边界"的查询表。规则正文以 `apps/miniapp-client/AGENTS.md` 为准。

## 1. 文件树与定位索引

这是一棵用于定位页面、API、store、双端样式和平台边界的文件树，不是完整文件清单。完整检索仍用 `rg --files apps/miniapp-client/src`。

```text
apps/miniapp-client/
├── src/
│   ├── pages/                    # 主包页面
│   │   ├── index/                # 首页 Tab
│   │   ├── category/             # 分类 Tab
│   │   ├── cart/                 # 购物车 Tab
│   │   ├── me/                   # 我的 Tab
│   │   ├── product/              # 商品列表、商品详情
│   │   ├── marketing/            # 营销详情与营销组件入口
│   │   ├── course-group/         # 拼课团队列表、详情、进度组件
│   │   ├── order/                # 下单、订单列表、订单详情，高风险
│   │   ├── pay/                  # 支付结果，高风险
│   │   ├── address/              # 地址列表、编辑、选择
│   │   ├── distribution/         # 分销入口、海报、二维码、商品
│   │   ├── upgrade/              # 升级、推荐码、团队，高风险
│   │   └── preview/              # 预览页
│   ├── pages-auth/               # 登录注册与授权页面，高风险
│   ├── pages-ai/                 # AI 内容页面
│   ├── api/                      # backend /client/* API 封装
│   │   ├── login.ts
│   │   ├── product.ts
│   │   ├── order.ts
│   │   ├── payment.ts
│   │   ├── marketing.ts
│   │   ├── marketing-coupon.ts
│   │   ├── course-group.ts
│   │   ├── distribution.ts
│   │   ├── upgrade.ts
│   │   └── types/
│   ├── http/                     # HTTP 客户端、拦截器、请求基础设施
│   ├── store/                    # Pinia 状态：auth、token、user、cart、dict、location
│   ├── components/               # 全局组件
│   ├── composables/              # 组合式业务能力
│   ├── hooks/                    # hooks
│   ├── layouts/                  # 页面布局壳
│   ├── tabbar/                   # 自定义 tabbar
│   ├── router/                   # 页面路由声明与跳转辅助
│   ├── constants/                # 业务常量与展示映射
│   ├── style/                    # Design Token 与全局样式
│   ├── static/                   # 静态资源
│   ├── types/                    # 小程序端本地类型
│   ├── utils/                    # 通用工具
│   ├── service/                  # 模板/演示服务封装，业务 API 优先放 api/
│   ├── test/                     # 测试工具
│   └── uni_modules/              # uniapp 插件
├── scripts/                      # miniapp 专用脚本
└── vite-plugins/                 # Vite 插件
```

定位规则：

- 页面问题先定位 `src/pages/**` 或 `src/pages-auth/**`,再看页面级 `components/`、对应 `src/api/*`、相关 `store/*` 与双端样式。
- API 调用统一放 `src/api/`；页面里不要散落请求实现。`src/service/` 不是新增业务 API 的默认落点。
- 登录、下单、支付、升级、分销身份变化属于高风险链路，触达时必须同步检查 token、回跳、状态刷新和 H5 / MP 差异。
- 布局问题先查页面根容器、`scroll-view`、`tabbar`、安全区和条件编译，再改业务逻辑。
- 普通页面扫描边界是"页面 -> 页面组件 -> api -> store -> 样式/平台边界 -> 同类页面"；没有跨端或高风险信号时不扩成全 miniapp-client 扫描。

## 2. 目录结构

| 目录                       | 用途                    |
| -------------------------- | ----------------------- |
| `src/pages/`               | 页面                    |
| `src/components/`          | 全局组件                |
| `src/pages/xx/components/` | 页面级组件              |
| `src/api/`                 | API 接口                |
| `src/http/`                | HTTP 封装               |
| `src/store/`               | Pinia 状态              |
| `src/tabbar/`              | 自定义 tabbar           |
| `src/style/`               | Design Token 与全局样式 |

## 3. 页面类型矩阵

| 页面类型          | 典型页面                          | 优先检查                                     |
| ----------------- | --------------------------------- | -------------------------------------------- |
| Tab 页            | `index`、`category`、`cart`、`me` | fixed 根容器、`disableScroll`、tabbar 安全区 |
| 详情页            | `product`、`marketing`、`preview` | 图片、滚动区、懒加载、分享态                 |
| 表单 / 提交流程页 | `order/create`、`address/edit`    | 输入状态、回填、错误态、幂等                 |
| 结果页 / 状态页   | `pay/result`                      | 状态刷新、返回链路、页面重进语义             |
| 登录注册页        | `pages-auth/login`                | token、回跳、授权流程                        |
