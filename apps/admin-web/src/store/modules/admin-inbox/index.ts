import { computed, ref } from 'vue';
import { defineStore } from 'pinia';
import { fetchGetMessageList } from '@/service/api/system/message';
import { SetupStoreId } from '@/enum';

/**
 * 管理端收件箱（与「站内消息」共用 sys_message，列表侧使用 adminInbox 过滤）
 */
export const useAdminInboxStore = defineStore(SetupStoreId.AdminInbox, () => {
  const items = ref<Api.System.Message[]>([]);
  const loading = ref(false);

  const unreadCount = computed(() => items.value.filter((row) => !row.isRead).length);

  async function refresh(): Promise<void> {
    loading.value = true;
    try {
      const { data, error } = await fetchGetMessageList({
        pageNum: 1,
        pageSize: 30,
        adminInbox: true,
        type: null,
        isRead: null,
      });
      if (error) return;
      const rows = data?.rows;
      items.value = Array.isArray(rows) ? rows : [];
    } finally {
      loading.value = false;
    }
  }

  return {
    items,
    loading,
    unreadCount,
    refresh,
  };
});

export default useAdminInboxStore;
