#!/usr/bin/env node
/**
 * 根据 views 目录结构生成菜单配置，供 E2E 或手动添加菜单使用
 * 用法：node scripts/generate-menu-from-views.mjs [views子路径]
 * 示例：node scripts/generate-menu-from-views.mjs store/distribution
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = fileURLToPath(new URL('.', import.meta.url));
const VIEWS_DIR = path.resolve(scriptDir, '..', 'src', 'views');

const subPath = process.argv[2] || 'store/distribution';
const targetDir = path.join(VIEWS_DIR, subPath);

/** 路由路径到中文标题的映射（与 sys_menu / 门店分销 一致，勿再用不存在的 store/marketing） */
const TITLE_MAP = {
  '/store/distribution': '分销管理',
  '/store/distribution/activity': '分销活动配置',
  '/store/distribution/coupon-distribution': '优惠券发放',
  '/store/distribution/coupon-usage': '优惠券使用',
  '/store/distribution/distribution': '分销配置',
  '/store/distribution/distribution-application': '分销治理',
  '/store/distribution/distribution-dashboard': '分销看板',
  '/store/distribution/distribution-level': '分销身份权益',
};

function collectRoutes(dir, base = '') {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const routes = [];

  const currentIndexPath = path.join(dir, 'index.vue');
  if (fs.existsSync(currentIndexPath) && base) {
    const routePath = `/${base.replace(/\\/g, '/')}`;
    const component = base.replace(/\\/g, '/');
    routes.push({ path: routePath, component, name: base.split(/[/\\]/).pop() });
  }

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    const relPath = base ? `${base}/${entry.name}` : entry.name;

    if (entry.isDirectory()) {
      const indexPath = path.join(fullPath, 'index.vue');
      if (fs.existsSync(indexPath)) {
        const routePath = `/${relPath.replace(/\\/g, '/')}`;
        const component = relPath.replace(/\\/g, '/');
        routes.push({ path: routePath, component, name: entry.name });
      }
      routes.push(...collectRoutes(fullPath, relPath));
    }
  }

  return routes;
}

if (!fs.existsSync(targetDir)) {
  console.error(`目录不存在: ${targetDir}`);
  process.exit(1);
}

const routes = collectRoutes(targetDir, subPath);
const unique = [...new Map(routes.map((r) => [r.path, r])).values()].sort((a, b) => a.path.localeCompare(b.path));

const menuItems = unique.map((r, i) => {
  const title = TITLE_MAP[r.path] || r.name.replace(/-/g, ' ');
  return {
    menuName: title,
    path: r.path,
    component: r.component,
    orderNum: i + 1,
  };
});

console.log(JSON.stringify(menuItems, null, 2));
console.error(`\n共 ${menuItems.length} 个菜单项，已输出 JSON`);
