import type { DictOption } from '@/store/dict';
import { ref } from 'vue';
import { useDictStore } from '@/store/dict';

export function useDict(dictType: string, immediate = true) {
  const dictStore = useDictStore();
  const options = ref<DictOption[]>(dictStore.getOptionsSync(dictType));
  const loading = ref(false);

  async function refresh() {
    loading.value = true;
    try {
      options.value = await dictStore.getOptions(dictType);
      return options.value;
    } finally {
      loading.value = false;
    }
  }

  if (immediate) {
    void refresh();
  }

  return {
    options,
    loading,
    refresh,
  };
}
