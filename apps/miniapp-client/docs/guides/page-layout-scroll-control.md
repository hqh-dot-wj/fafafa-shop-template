# 页面布局和弹窗滚动说明

## 问题：弹窗打开后背景还能滚动

### 为什么会出现这个问题？

当弹窗（popup）打开时，如果没有正确配置，底层页面仍然可以滚动，导致用户体验不佳。

## 解决方案

### 方案概述

完整解决滚动穿透需要**多层防护**：

1. **页面布局层**：固定高度 + 禁止溢出（必要时 H5 对根容器 `position: fixed`，见下文）
2. **Popup 组件层**：`lock-scroll` 属性
3. **page-meta 层**：`page-style` 控制页面级 overflow（小程序侧辅助；**H5 上常无法单独拦住 `uni-page-body` 整页滚动**）

### 1. 使用 page-meta 组件

**重要**: `<page-meta>` 必须是页面的**第一个节点**！

```vue
<template>
  <page-meta page-style="overflow: hidden;" />

  <view class="category-page">
    <!-- 页面内容 -->
  </view>
</template>
```

**说明**：

- 弹窗组件（如 `wd-popup`）应设置 `:lock-scroll="true"`，关闭弹窗时不必把页面改回 `overflow: visible`，否则在「整页固定 + 内层 scroll-view」场景下易与外层整页滚动叠加。
- **H5**：若仍出现整页滚动、顶栏被滚走，请在页面根容器上使用 `position: fixed` + `bottom: var(--tabbar-total-height)`（自定义 Tabbar 时），详见 `apps/miniapp-client/AGENTS.md`「页面滚动与满屏布局」。

### 2. 页面布局结构

```scss
.category-page {
  display: flex;
  flex-direction: column;
  height: 100vh; // ✅ 固定页面高度为视口高度
  overflow: hidden; // ✅ 防止页面整体滚动
  background-color: #f5f5f5;
}

.main-content {
  display: flex;
  flex: 1; // ✅ 占据剩余空间
  overflow: hidden; // ✅ 防止主体内容溢出
}

// 左侧分类和右侧商品列表使用 scroll-view
.category-nav,
.product-list {
  height: 100%; // ✅ 继承父容器高度
  // scroll-view 自带滚动能力
}
```

### 2. 为什么需要 `height: 100vh`？

**目的**：创建一个**固定高度**的容器，内部使用 `scroll-view` 来滚动内容。

#### 布局原理：

```
┌────────────────────────────────┐
│  .category-page (100vh)        │ ← 固定视口高度，不滚动
│  ┌──────────────────────────┐  │
│  │ .tenant-bar (固定高度)    │  │ ← 不滚动
│  └──────────────────────────┘  │
│  ┌──────────────────────────┐  │
│  │ .search-wrap (固定高度)   │  │ ← 不滚动
│  └──────────────────────────┘  │
│  ┌──────────────────────────┐  │
│  │ .main-content (flex: 1)  │  │ ← 占据剩余空间
│  │ ┌────────┬─────────────┐ │  │
│  │ │ 分类导航  │  商品列表    │ │  │ ← scroll-view 内部滚动
│  │ │(滚动)   │  (滚动)     │ │  │
│  │ └────────┴─────────────┘ │  │
│  └──────────────────────────┘  │
└────────────────────────────────┘
```

#### 关键点：

1. **外层容器固定高度** (`height: 100vh`)
2. **外层禁止滚动** (`overflow: hidden`)
3. **内部使用 scroll-view** 来实现局部滚动

这样做的好处：

- ✅ 页面整体不会滚动
- ✅ 只有内容区域可以滚动
- ✅ 弹窗打开时，配合 `lock-scroll`，可以完全阻止背景滚动

### 3. Popup 组件配置

在租户选择器组件中添加以下属性：

```vue
<wd-popup
  v-model="showPopup"
  position="bottom"
  :safe-area-inset-bottom="true"
  :z-index="10001"
  :lock-scroll="true"
  ←
  ✅
  锁定背景滚动
  :close-on-click-modal="true"
  ←
  ✅
  点击遮罩层关闭
  round
></wd-popup>
```

#### 属性说明：

- **`lock-scroll="true"`**：当弹窗打开时，锁定背景页面的滚动
- **`close-on-click-modal="true"`**：允许用户点击遮罩层（背景黑色半透明区域）关闭弹窗
- **`z-index="10001"`**：确保弹窗在 tabbar (z-index: 1000) 之上

### 4. 完整的滚动控制逻辑

#### 正常状态（弹窗未打开）：

```
页面整体：不滚动 (overflow: hidden)
  ↓
左侧分类导航：可滚动 (scroll-view)
右侧商品列表：可滚动 (scroll-view)
```

#### 弹窗打开状态：

```
页面整体：不滚动 (overflow: hidden)
  ↓
左侧分类导航：被锁定 (lock-scroll)
右侧商品列表：被锁定 (lock-scroll)
  ↓
弹窗内容：可滚动（如果内容超出弹窗高度）
```

## 如果不设置 `height: 100vh` 会怎样？

### ❌ 错误方式（没有固定高度）：

```scss
.category-page {
  display: flex;
  flex-direction: column;
  // 没有 height: 100vh
  // 没有 overflow: hidden
}
```

**问题**：

1. 页面容器会根据内容自动撑开高度
2. 如果内容超过视口，整个页面会出现滚动条
3. 弹窗打开时，即使有 `lock-scroll`，页面整体仍可能滚动
4. scroll-view 的高度计算可能不正确

### ✅ 正确方式（固定高度）：

```scss
.category-page {
  display: flex;
  flex-direction: column;
  height: 100vh; // ✅ 固定高度
  overflow: hidden; // ✅ 禁止整体滚动
}
```

**优点**：

1. 页面容器固定为视口高度
2. 页面整体不会滚动
3. 只有 scroll-view 内部可以滚动
4. 弹窗打开时，背景完全不可滚动

## 总结

1. **`height: 100vh`** 是必需的，用于创建固定高度的容器
2. **`overflow: hidden`** 防止页面整体滚动
3. **`lock-scroll="true"`** 在弹窗打开时锁定背景滚动
4. **内部使用 scroll-view** 实现局部滚动

这种布局方式是现代小程序开发的**最佳实践**，确保了：

- ✅ 性能优化（局部滚动比整页滚动更流畅）
- ✅ 用户体验（弹窗打开时背景不会滚动）
- ✅ 布局稳定（固定高度，不会因内容变化而跳动）
