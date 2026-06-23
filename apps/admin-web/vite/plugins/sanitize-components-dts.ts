import fs from 'node:fs';
import path from 'node:path';
import type { Plugin } from 'vite';

/**
 * unplugin-vue-components 为 declare global 生成的部分 icon 行形如：
 * `const 'IconCarbon:arrowRight': ...`，在 TS 中非法（接口里用引号键名是合法的，global const 不行）。
 * 规范化为 PascalCase：`const IconCarbonArrowRight:`，与 GlobalComponents 中已有命名一致。
 */
export function sanitizeComponentsDtsFile(filePath: string): void {
  if (!fs.existsSync(filePath)) return;
  const source = fs.readFileSync(filePath, 'utf8');
  if (!source.includes("const '")) return;

  const next = source.replace(/const '([^']+)':/g, (_, rawName: string) => {
    if (!rawName.includes(':')) {
      return `const ${rawName}:`;
    }
    const valid = rawName
      .split(':')
      .map((part, i) => (i === 0 ? part : part.charAt(0).toUpperCase() + part.slice(1)))
      .join('');
    return `const ${valid}:`;
  });

  if (next !== source) {
    fs.writeFileSync(filePath, next, 'utf8');
  }
}

export function sanitizeComponentsDtsPlugin(): Plugin {
  const filePath = path.resolve(process.cwd(), 'src/typings/components.d.ts');

  const run = () => sanitizeComponentsDtsFile(filePath);

  return {
    name: 'sanitize-components-dts',
    buildStart() {
      run();
    },
    buildEnd() {
      run();
    },
    closeBundle() {
      run();
    },
    configureServer(server) {
      server.watcher.add(filePath);
      const onFs = (p: string) => {
        if (path.normalize(p) === path.normalize(filePath)) {
          run();
        }
      };
      server.watcher.on('change', onFs);
      server.watcher.on('add', onFs);
      server.httpServer?.once('listening', () => {
        setTimeout(run, 800);
      });
    },
  };
}
