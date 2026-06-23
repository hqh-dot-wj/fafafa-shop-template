import type { DictDataItem } from '@/api/dict';
import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import { getDictByType } from '@/api/dict';

export interface DictOption {
  label: string;
  value: string;
}

export const useDictStore = defineStore('dict', () => {
  const dictData = ref<Record<string, DictDataItem[]>>({});
  const pending = new Map<string, Promise<DictDataItem[]>>();

  function getDict(dictType: string): DictDataItem[] {
    return dictData.value[dictType] ?? [];
  }

  function setDict(dictType: string, rows: DictDataItem[]) {
    dictData.value[dictType] = rows;
  }

  function clearDict(dictType?: string) {
    if (dictType) {
      if (dictType in dictData.value) {
        delete dictData.value[dictType];
      }
      return;
    }
    dictData.value = {};
  }

  async function ensureDict(dictType: string): Promise<DictDataItem[]> {
    const cached = getDict(dictType);
    if (cached.length > 0) {
      return cached;
    }

    const inflight = pending.get(dictType);
    if (inflight) {
      return inflight;
    }

    const task = getDictByType(dictType)
      .then((rows) => {
        const safeRows = Array.isArray(rows) ? rows : [];
        setDict(dictType, safeRows);
        return safeRows;
      })
      .finally(() => {
        pending.delete(dictType);
      });

    pending.set(dictType, task);
    return task;
  }

  async function getOptions(dictType: string): Promise<DictOption[]> {
    const rows = await ensureDict(dictType);
    return rows.map((item) => ({ label: item.dictLabel, value: item.dictValue }));
  }

  function getOptionsSync(dictType: string): DictOption[] {
    return getDict(dictType).map((item) => ({ label: item.dictLabel, value: item.dictValue }));
  }

  const dictTypeCount = computed(() => Object.keys(dictData.value).length);

  return {
    dictData,
    dictTypeCount,
    getDict,
    setDict,
    clearDict,
    ensureDict,
    getOptions,
    getOptionsSync,
  };
});
