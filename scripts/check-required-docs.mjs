/**
 * 纯函数：检查必需文档的存在性
 * 列表来源：scripts/harness-manifest.mjs（单一登记源）
 */
import fs from 'node:fs';
import path from 'node:path';

import { REQUIRED_DOCS } from './harness-manifest.mjs';

export { REQUIRED_DOCS };

/**
 * @param {string} rootDir - 仓库根目录绝对路径
 * @param {string[]} requiredPaths - 相对于 rootDir 的必需文档路径列表
 * @returns {{ missing: string[], present: string[] }}
 */
export function checkRequiredDocs(rootDir, requiredPaths = REQUIRED_DOCS) {
  const missing = [];
  const present = [];

  for (const p of requiredPaths) {
    const fullPath = path.join(rootDir, p);
    if (fs.existsSync(fullPath)) {
      present.push(p);
    } else {
      missing.push(p);
    }
  }

  return { missing, present };
}
