import { readonly, ref } from 'vue';

/**
 * 阻断弹层优先级调度（运行时 + 可单测）
 * P0 协议 > P1 地址 > P2 登录；同优先级按入队先后（FIFO）
 */

export type PopupKind = 'agreement' | 'address' | 'login';

export interface PopupEnqueueMeta {
  /** 关键动作恢复标记（如 submitOrder / buyNow），出队时可交回业务层 */
  resumeAction?: string;
}

export interface PopupDequeueResult {
  kind: PopupKind;
  resumeAction?: string;
}

const PRIORITY: Record<PopupKind, number> = {
  agreement: 0,
  address: 1,
  login: 2,
};

interface InternalItem {
  kind: PopupKind;
  order: number;
  resumeAction?: string;
}

function createInternalItem(kind: PopupKind, order: number, resumeAction?: string): InternalItem {
  const item: InternalItem = { kind, order };
  if (resumeAction !== undefined) item.resumeAction = resumeAction;
  return item;
}

function createDequeueResult(item: InternalItem): PopupDequeueResult {
  const result: PopupDequeueResult = { kind: item.kind };
  if (item.resumeAction !== undefined) result.resumeAction = item.resumeAction;
  return result;
}

export interface PopupOrchestrator {
  enqueue: (kind: PopupKind, meta?: PopupEnqueueMeta) => void;
  /** 取出当前最高优先级项；队列为空时返回 undefined */
  next: () => PopupDequeueResult | undefined;
  /** 当前队列长度 */
  size: () => number;
  clear: () => void;
}

export function createPopupOrchestrator(): PopupOrchestrator {
  const items: InternalItem[] = [];
  let seq = 0;

  return {
    enqueue(kind, meta) {
      items.push(createInternalItem(kind, seq++, meta?.resumeAction));
    },
    next() {
      if (items.length === 0) {
        return undefined;
      }
      let bestIdx = 0;
      for (let i = 1; i < items.length; i++) {
        const cur = items[i];
        const best = items[bestIdx];
        if (!cur || !best) continue;
        const pi = PRIORITY[cur.kind];
        const pb = PRIORITY[best.kind];
        if (pi < pb || (pi === pb && cur.order < best.order)) {
          bestIdx = i;
        }
      }
      const removed = items.splice(bestIdx, 1)[0];
      if (!removed) {
        return undefined;
      }
      return createDequeueResult(removed);
    },
    size() {
      return items.length;
    },
    clear() {
      items.length = 0;
    },
  };
}

/**
 * 运行时全局调度器：所有阻断弹层通过同一队列仲裁，避免抢焦点。
 */
const runtimeActiveKind = ref<PopupKind | null>(null);
const runtimeActiveMeta = ref<PopupEnqueueMeta | null>(null);
const runtimeQueuedKinds = ref<PopupKind[]>([]);
let runtimeSeq = 0;
let runtimeQueue: InternalItem[] = [];

function pickBestRuntimeIndex(items: InternalItem[]): number {
  if (items.length === 0) return -1;
  let bestIdx = 0;
  for (let i = 1; i < items.length; i++) {
    const cur = items[i];
    const best = items[bestIdx];
    if (!cur || !best) continue;
    const pi = PRIORITY[cur.kind];
    const pb = PRIORITY[best.kind];
    if (pi < pb || (pi === pb && cur.order < best.order)) {
      bestIdx = i;
    }
  }
  return bestIdx;
}

function scheduleNextRuntimePopup() {
  if (runtimeActiveKind.value) return;
  const bestIdx = pickBestRuntimeIndex(runtimeQueue);
  if (bestIdx < 0) {
    runtimeActiveKind.value = null;
    runtimeActiveMeta.value = null;
    runtimeQueuedKinds.value = [];
    return;
  }
  const next = runtimeQueue.splice(bestIdx, 1)[0];
  runtimeQueuedKinds.value = runtimeQueue.map((item) => item.kind);
  if (!next) return;
  runtimeActiveKind.value = next.kind;
  runtimeActiveMeta.value =
    next.resumeAction !== undefined
      ? {
          resumeAction: next.resumeAction,
        }
      : null;
}

export function enqueueRuntimePopup(kind: PopupKind, meta?: PopupEnqueueMeta): void {
  if (runtimeActiveKind.value === kind || runtimeQueue.some((item) => item.kind === kind)) {
    return;
  }
  runtimeQueue.push(createInternalItem(kind, runtimeSeq++, meta?.resumeAction));
  runtimeQueuedKinds.value = runtimeQueue.map((item) => item.kind);
  scheduleNextRuntimePopup();
}

export function completeRuntimePopup(kind: PopupKind): void {
  if (runtimeActiveKind.value !== kind) return;
  runtimeActiveKind.value = null;
  runtimeActiveMeta.value = null;
  scheduleNextRuntimePopup();
}

export function cancelRuntimePopup(kind: PopupKind): void {
  if (runtimeActiveKind.value === kind) {
    completeRuntimePopup(kind);
    return;
  }
  runtimeQueue = runtimeQueue.filter((item) => item.kind !== kind);
  runtimeQueuedKinds.value = runtimeQueue.map((item) => item.kind);
}

export function resetRuntimePopupOrchestratorForTest(): void {
  runtimeQueue = [];
  runtimeQueuedKinds.value = [];
  runtimeActiveKind.value = null;
  runtimeActiveMeta.value = null;
  runtimeSeq = 0;
}

export function useRuntimePopupOrchestrator() {
  return {
    activeKind: readonly(runtimeActiveKind),
    activeMeta: readonly(runtimeActiveMeta),
    queuedKinds: readonly(runtimeQueuedKinds),
  };
}
