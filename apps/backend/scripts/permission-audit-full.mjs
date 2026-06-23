import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const backendRoot = path.resolve(__dirname, '..');

function walkDir(dir, acc = []) {
  for (const n of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, n.name);
    if (n.isDirectory() && n.name !== 'node_modules' && n.name !== 'dist') walkDir(p, acc);
    else if (n.isFile() && n.name.endsWith('.controller.ts') && !n.name.includes('.spec.')) acc.push(p);
  }
  return acc;
}

const moduleRoot = path.join(backendRoot, 'src', 'module');
const files = walkDir(moduleRoot);

const requirePermRe = /@RequirePermission\('([^']+)'\)/g;

const occurrences = [];
const byFile = new Map();

for (const file of files) {
  const rel = path.relative(backendRoot, file).split(path.sep).join('/');
  const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/);
  lines.forEach((line, i) => {
    const re = new RegExp(requirePermRe.source, 'g');
    let m;
    while ((m = re.exec(line)) !== null) {
      const perm = m[1];
      const rec = { file: rel, line: i + 1, perm };
      occurrences.push(rec);
      if (!byFile.has(rel)) byFile.set(rel, []);
      byFile.get(rel).push(rec);
    }
  });
}

const codeSet = new Set(occurrences.map((o) => o.perm));

const seedPath = path.join(backendRoot, 'prisma/seeds/00-platform/sys-menu-and-role-menu.ts');
const seedText = fs.readFileSync(seedPath, 'utf8');
const seedSet = new Set();
for (const m of seedText.matchAll(/perms: '([^']*)'/g)) {
  const p = m[1].trim();
  if (p) seedSet.add(p);
}

const onlyCode = [...codeSet].filter((p) => !seedSet.has(p)).sort();
const onlySeed = [...seedSet].filter((p) => !codeSet.has(p)).sort();

const noPermFiles = files
  .map((f) => path.relative(backendRoot, f).split(path.sep).join('/'))
  .filter((rel) => !byFile.has(rel))
  .sort();

function extractControllerPath(content) {
  const withPath = content.match(/@Controller\(\s*['"]([^'"]+)['"]\s*\)/);
  if (withPath) return withPath[1];
  if (/@Controller\s*\(\s*\)/.test(content)) return '(全局前缀，@Controller())';
  return '(unknown)';
}

const outLines = [];
outLines.push('=== 全量权限审计（apps/backend）===');
outLines.push(`生成: ${new Date().toISOString()}`);
outLines.push('');
outLines.push('## 1. 统计');
outLines.push(`Controller 文件数: ${files.length}`);
outLines.push(`含 @RequirePermission 的文件数: ${byFile.size}`);
outLines.push(`无任何 @RequirePermission 的文件数: ${noPermFiles.length}`);
outLines.push(`@RequirePermission 出现次数（含重复）: ${occurrences.length}`);
outLines.push(`代码中去重权限码数量: ${codeSet.size}`);
outLines.push(`种子 sys_menu 非空去重 perms 数量: ${seedSet.size}`);
outLines.push(`仅代码有、种子无: ${onlyCode.length}`);
outLines.push(`仅种子有、代码无: ${onlySeed.length}`);
outLines.push('');
outLines.push(`## 2. 无任何 @RequirePermission 的 Controller（全量 ${noPermFiles.length} 个）`);
noPermFiles.forEach((f) => outLines.push(f));
outLines.push('');
outLines.push(`## 3. 代码中去重权限码（全量 ${codeSet.size} 个，字母序）`);
[...codeSet].sort().forEach((p) => outLines.push(p));
outLines.push('');
outLines.push(`## 4. 种子中去重非空 perms（全量 ${seedSet.size} 个，字母序）`);
[...seedSet].sort().forEach((p) => outLines.push(p));
outLines.push('');
outLines.push(`## 5. 仅代码有、种子无（全量 ${onlyCode.length} 个）`);
onlyCode.forEach((p) => outLines.push(p));
outLines.push('');
outLines.push(`## 6. 仅种子有、代码无（全量 ${onlySeed.length} 个）`);
onlySeed.forEach((p) => outLines.push(p));
outLines.push('');
outLines.push(`## 7. 每条 @RequirePermission 出现位置（全量 ${occurrences.length} 条）`);
occurrences
  .sort((a, b) => (a.file !== b.file ? a.file.localeCompare(b.file) : a.line - b.line))
  .forEach((o) => outLines.push(`${o.file}:${o.line}  ${o.perm}`));
outLines.push('');
outLines.push('## 8. 含权限的 Controller 与 @Controller 路径');
[...byFile.keys()]
  .sort()
  .forEach((rel) => {
    const abs = path.join(backendRoot, rel);
    const content = fs.readFileSync(abs, 'utf8');
    const base = extractControllerPath(content);
    outLines.push(`${rel}  @Controller('${base}')  权限条数:${byFile.get(rel).length}`);
  });

const outPath = path.join(backendRoot, 'permission-audit-full.txt');
fs.writeFileSync(outPath, outLines.join('\n'), 'utf8');
console.log('Wrote', outPath);
console.log('lines', outLines.length);
