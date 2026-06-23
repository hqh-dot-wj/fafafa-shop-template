---
title: Miniapp Troubleshooting
status: active
doc_type: agent-supplement
owner: engineering-governance
last_verified: 2026-05-15
---

# Miniapp Troubleshooting

承接 miniapp AGENTS 中"出现这类症状先查什么"的故障模式表。规则正文以 `apps/miniapp-client/AGENTS.md` 为准。

## 1. 常见故障模式表

| 症状                     | 优先检查                                          |
| ------------------------ | ------------------------------------------------- |
| 顶栏跟着页面一起滚走     | H5 fixed 根容器、`disableScroll` 是否缺失         |
| 页面双滚动               | `uni-page-body`、根容器高度链、`scroll-view` 高度 |
| 安全区错位或底部重复留白 | `safe-area` 与 tabbar 占位是否重复                |
| 弹层打开后滚动异常       | `lock-scroll`、页面根容器、popup 时序             |
| 登录后页面状态不一致     | auth store、`onShow` / `onLoad` 刷新逻辑          |
| 支付结果页状态陈旧       | 结果页重进语义、订单状态刷新时机                  |
