import type { IUserInfoRes } from '@/api/types/login';
import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import { getUserInfo } from '@/api/login';

interface StoredUserInfo extends Record<string, unknown> {
  userId: number | null;
  username: string;
  nickname: string;
  avatar: string;
  levelId?: number | null;
  mobile?: string | null;
  phone?: string | null;
}

const DEFAULT_AVATAR = '/static/images/default-avatar.png';

// 初始化状态
const userInfoState: StoredUserInfo = {
  userId: null, // 未登录态使用 null
  username: '',
  nickname: '',
  avatar: DEFAULT_AVATAR,
};

export const useUserStore = defineStore(
  'user',
  () => {
    // 定义用户信息
    const userInfo = ref<StoredUserInfo>({ ...userInfoState });
    // 设置用户信息
    const setUserInfo = (val: IUserInfoRes) => {
      console.log('设置用户信息', val);
      userInfo.value = {
        ...val,
        userId: val.userId,
        username: val.username,
        nickname: val.nickname,
        avatar: val.avatar || DEFAULT_AVATAR,
      };
    };
    const setUserAvatar = (avatar: string) => {
      userInfo.value.avatar = avatar;
      console.log('设置用户头像', avatar);
      console.log('userInfo', userInfo.value);
    };
    // 删除用户信息
    const clearUserInfo = () => {
      userInfo.value = { ...userInfoState };
      uni.removeStorageSync('user');
    };

    /**
     * 获取用户信息
     */
    const fetchUserInfo = async () => {
      const res = await getUserInfo();
      setUserInfo(res);
      return res;
    };

    // 是否分销员
    const isDistributor = computed(() => {
      const level = userInfo.value.levelId || 0;
      // 简单判定：等级 > 0 即为分销员 (如有其他逻辑可在此调整)
      return level > 0;
    });

    return {
      userInfo,
      clearUserInfo,
      fetchUserInfo,
      setUserInfo,
      setUserAvatar,
      isDistributor,
    };
  },
  {
    persist: true,
  },
);
