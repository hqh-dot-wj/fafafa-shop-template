const STORAGE_KEY = 'admin-workbench-recent-routes';
const MAX_ITEMS = 5;

export interface WorkbenchRecentItem {
  routeName: string;
  label: string;
}

function readAll(): WorkbenchRecentItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (x): x is WorkbenchRecentItem =>
        typeof x === 'object' &&
        x !== null &&
        'routeName' in x &&
        'label' in x &&
        typeof (x as WorkbenchRecentItem).routeName === 'string' &&
        typeof (x as WorkbenchRecentItem).label === 'string',
    );
  } catch {
    return [];
  }
}

/**
 * 记录工作台快捷入口点击，用于首页「最近使用」
 */
export function recordWorkbenchRecent(item: WorkbenchRecentItem): void {
  const list = readAll().filter((x) => x.routeName !== item.routeName);
  list.unshift(item);
  const next = list.slice(0, MAX_ITEMS);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // 忽略存储失败（隐私模式等）
  }
}

export function getWorkbenchRecent(): WorkbenchRecentItem[] {
  return readAll();
}
