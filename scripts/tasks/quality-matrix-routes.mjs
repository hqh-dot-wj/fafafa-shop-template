import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const matrixPath = path.join(repoRoot, 'docs/quality-attributes/matrix.yml');

/**
 * @param {string} glob
 * @returns {RegExp}
 */
export function globToRegExp(glob) {
  const normalized = glob.replaceAll('\\', '/');
  let re = '^';
  for (let i = 0; i < normalized.length; i += 1) {
    if (normalized[i] === '*' && normalized[i + 1] === '*') {
      re += '.*';
      i += 1;
      if (normalized[i + 1] === '/') {
        i += 1;
      }
    } else if (normalized[i] === '*') {
      re += '[^/]*';
    } else if ('.+^${}()|[]\\?'.includes(normalized[i])) {
      re += `\\${normalized[i]}`;
    } else {
      re += normalized[i];
    }
  }
  re += '$';
  return new RegExp(re);
}

/**
 * @param {string} filePath
 * @param {string} pattern
 */
export function matchGlob(filePath, pattern) {
  const normalized = filePath.replaceAll('\\', '/');
  return globToRegExp(pattern).test(normalized);
}

/**
 * @param {string} [matrixFilePath]
 * @returns {{ pattern: string, required: string[], hint: string, note: string }[]}
 */
export function loadMatrixRoutes(matrixFilePath = matrixPath) {
  if (!fs.existsSync(matrixFilePath)) {
    return [];
  }

  const content = fs.readFileSync(matrixFilePath, 'utf8');
  const lines = content.split(/\r?\n/);
  const routes = [];
  let inRoutes = false;
  /** @type {{ pattern: string, required: string[], hint: string, note: string } | null} */
  let current = null;

  for (const line of lines) {
    if (line.startsWith('routes:')) {
      inRoutes = true;
      continue;
    }
    if (inRoutes && /^[a-z_]+:/.test(line) && !line.startsWith(' ')) {
      break;
    }

    const routeMatch = line.match(/^ {2}'([^']+)':\s*$/);
    if (routeMatch) {
      current = { pattern: routeMatch[1], required: [], hint: '', note: '' };
      routes.push(current);
      continue;
    }

    if (!current) {
      continue;
    }

    const requiredMatch = line.match(/required:\s*\[([^\]]+)\]/);
    if (requiredMatch) {
      current.required = requiredMatch[1]
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean);
    }

    const hintMatch = line.match(/hint:\s*(.+)$/);
    if (hintMatch) {
      current.hint = hintMatch[1].trim();
    }

    const noteMatch = line.match(/note:\s*(.+)$/);
    if (noteMatch) {
      current.note = noteMatch[1].trim();
    }
  }

  return routes;
}

/**
 * @param {string[]} files
 * @param {{ pattern: string, required: string[], hint: string, note: string }[]} [routes]
 */
export function matchQualityAttributes(files, routes = loadMatrixRoutes()) {
  const attributeSet = new Set();
  const hints = [];
  const matchedRoutes = [];

  for (const route of routes) {
    const matchedFiles = files.filter((file) => matchGlob(file, route.pattern));
    if (matchedFiles.length === 0) {
      continue;
    }

    matchedRoutes.push({ ...route, files: matchedFiles });
    for (const attribute of route.required) {
      attributeSet.add(attribute);
    }
    if (route.hint) {
      hints.push({ pattern: route.pattern, hint: route.hint, files: matchedFiles });
    }
    if (route.note) {
      hints.push({ pattern: route.pattern, hint: route.note, files: matchedFiles });
    }
  }

  return {
    attributes: [...attributeSet].sort(),
    hints,
    matchedRoutes,
  };
}

/**
 * @param {string[]} files
 */
export function formatPrChecklistSuggestions(files) {
  const { attributes, hints } = matchQualityAttributes(files);
  const lines = [];

  if (attributes.length === 0) {
    lines.push('No quality-attribute routes matched changed files.');
    return lines.join('\n');
  }

  lines.push('Suggested PR checklist sections (docs/quality-attributes/matrix.yml):');
  for (const attribute of attributes) {
    lines.push(`- [ ] ${attribute}`);
  }

  if (hints.length > 0) {
    lines.push('', 'Route hints:');
    for (const item of hints) {
      lines.push(`- ${item.pattern}: ${item.hint}`);
    }
  }

  return lines.join('\n');
}
