# 诸葛陪伴 · Antigravity 风格官网

银发教育社区团购平台单页站，**视觉与动效 1:1 对标** [Google Antigravity](https://antigravity.google/)。

## 技术栈

| 模块                     | 用途                             | 链接                                           |
| ------------------------ | -------------------------------- | ---------------------------------------------- |
| **Three.js**             | WebGL GPU 粒子球（首屏粒子效果） | <https://threejs.org/>                         |
| **GSAP + ScrollTrigger** | 时间线、滚动驱动、卡片 pin       | <https://greensock.com/gsap/>                  |
| **Lenis**                | 平滑滚动                         | <https://github.com/darkroomengineering/lenis> |
| **SplitType**            | 标题逐字符 mask 上推出场         | <https://github.com/lukePeavey/SplitType>      |
| **Material Symbols**     | 图标体系                         | <https://fonts.google.com/icons>               |

## 目录结构

```
├─ index.html              主页面（Hero / Tabs / Carousel / 双 CTA / Blogs / Footer）
├─ css/styles.css          全局样式 + Antigravity 设计 token
├─ js/
│  ├─ particles.js         Three.js + GLSL shader 粒子球
│  └─ main.js              Lenis · SplitType · ScrollTrigger 交互
├─ assets/                 课程图片（1:1）
└─ _ag.html                原站抓取的 HTML 快照（仅参考）
```

## 实现的效果

### 1. 粒子效果（首屏）

- GPU 实例化 12 000 粒子，Fibonacci 球面分布
- Simplex 3D noise 实时驱动顶点位移，呈现流体感
- 粒子色：橘红 / 蓝 / 青 / 白 四档随机混合 + 噪声闪烁
- 鼠标 pointer 跟随，附近粒子被推开
- AdditiveBlending + 软边光晕，整体被动旋转
- 自动按视口/PixelRatio 调整粒子数与尺寸

### 2. 文字出场

- SplitType 将每行标题拆为 `line > word > char`
- 每行外层 `overflow:hidden`，char `translateY(110%)`
- GSAP 用 `expo.out` 缓动 + 每字符 18ms stagger 上推
- 渐变色 char 单独标记，避免 `background-clip:text` 因 inline-block 失效

### 3. 滚动效果

- Lenis 平滑滚动接管 wheel/touch
- ScrollTrigger 区块入场（标题/段落/卡片错峰）
- 导航条滚动后玻璃模糊背景

### 4. 卡片滚动（横向 pin）

- "Features" 区使用 ScrollTrigger `pin + scrub`
- 6 张特性卡固定后水平位移
- 底部进度条与滚动同步缩放

### 5. 其他

- 4-Tab 自动播放产品介绍（5s 切换，用户交互后暂停）
- 双色 CTA 卡（深色发光 + 浅色）
- Blogs 6 卡网格 + hover 抬升

## 本地预览

```bash
npx serve .
# 浏览器打开 http://localhost:3000
```

> ⚠️ 必须通过 HTTP 服务器访问，**不能直接双击 `index.html`** —— 否则跨域策略会阻止 Three.js / CDN 库加载。
