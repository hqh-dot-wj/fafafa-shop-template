import { defineStore } from 'pinia';
import type { UserInfoRes } from '@/types/auth';
import { getUserInfo } from '@/service/api/auth';
import { useApi } from '@/hooks/use-api';

interface StoredUserInfo {
  userId: number | null;
  username: string;
  nickname: string;
  avatar: string;
  levelId?: number | null;
  mobile?: string | null;
}

const DEFAULT_USER: StoredUserInfo = {
  userId: null,
  username: '',
  nickname: '',
  avatar: '',
};

export const useUserStore = defineStore(
  'c-web-user',
  () => {
    const userInfo = ref<StoredUserInfo>({ ...DEFAULT_USER });

    function setUserInfo(val: UserInfoRes) {
      userInfo.value = {
        userId: val.userId,
        username: val.username,
        nickname: val.nickname,
        avatar: val.avatar || '',
        levelId: val.levelId,
        mobile: val.mobile,
      };
    }

    function clearUserInfo() {
      userInfo.value = { ...DEFAULT_USER };
    }

    async function fetchUserInfo() {
      const { apiClient } = useApi();
      const res = await getUserInfo(apiClient);
      setUserInfo(res);
      return res;
    }

    const displayName = computed(() => userInfo.value.nickname || userInfo.value.username || '会员');

    return {
      userInfo,
      displayName,
      setUserInfo,
      clearUserInfo,
      fetchUserInfo,
    };
  },
  { persist: true },
);
