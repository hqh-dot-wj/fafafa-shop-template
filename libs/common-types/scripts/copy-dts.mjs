import { copyFile, mkdir, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const packageDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const srcDir = path.join(packageDir, 'src');
const distDir = path.join(packageDir, 'dist');

async function copyDeclarationFiles(sourceDir) {
  const entries = await readdir(sourceDir, { withFileTypes: true });

  await Promise.all(
    entries.map(async (entry) => {
      const sourcePath = path.join(sourceDir, entry.name);

      if (entry.isDirectory()) {
        await copyDeclarationFiles(sourcePath);
        return;
      }

      if (!entry.isFile() || !entry.name.endsWith('.d.ts')) {
        return;
      }

      const relativePath = path.relative(srcDir, sourcePath);
      const targetPath = path.join(distDir, relativePath);
      await mkdir(path.dirname(targetPath), { recursive: true });
      await copyFile(sourcePath, targetPath);
    }),
  );
}

await mkdir(distDir, { recursive: true });
await copyDeclarationFiles(srcDir);
