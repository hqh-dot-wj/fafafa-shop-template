import { reactive } from 'vue';
import { defineStore } from 'pinia';
import { SetupStoreId } from '@/enum';

interface NoticeItem {
  title?: string;
  read: boolean;
  message: unknown;
  time: string;
}

const MAX_NOTICE_ITEMS = 100;

export const useNoticeStore = defineStore(SetupStoreId.Notice, () => {
  const state = reactive({
    notices: [] as NoticeItem[],
  });

  const addNotice = (notice: NoticeItem) => {
    state.notices.push(notice);
    if (state.notices.length > MAX_NOTICE_ITEMS) {
      state.notices.splice(0, state.notices.length - MAX_NOTICE_ITEMS);
    }
  };

  const removeNotice = (notice: NoticeItem) => {
    const index = state.notices.indexOf(notice);
    if (index >= 0) {
      state.notices.splice(index, 1);
    }
  };

  const readNotice = (notice: NoticeItem) => {
    const index = state.notices.indexOf(notice);
    if (index >= 0) {
      state.notices[index].read = true;
    }
  };

  // 实现全部已读
  const readAll = () => {
    state.notices.forEach((item) => {
      item.read = true;
    });
  };

  const clearNotice = () => {
    state.notices = [];
  };

  return {
    state,
    addNotice,
    removeNotice,
    readNotice,
    readAll,
    clearNotice,
  };
});

export default useNoticeStore;
