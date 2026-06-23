import { isMp } from '@uni-helper/uni-env';
import { storeToRefs } from 'pinia';
import { computed } from 'vue';
import { bindPhone } from '@/api/login';
import { useTokenStore } from '@/store/token';
import { useUserStore } from '@/store/user';
import { hasBoundPhone } from '@/utils/member-phone';

/**
 * 小程序一键绑手机提示：已登录、未绑手机、且当前端支持 getPhoneNumber。
 * H5 账号密码/短信登录用户资料里已有 mobile，不会误提示。
 */
export function usePhoneBindTip() {
  const tokenStore = useTokenStore();
  const userStore = useUserStore();
  const { userInfo } = storeToRefs(userStore);

  const showPhoneBindTip = computed(() => tokenStore.hasLogin && isMp && !hasBoundPhone(userInfo.value));

  async function handleBindPhone(e: { detail: { errMsg: string; code?: string } }) {
    if (e.detail.errMsg !== 'getPhoneNumber:ok') {
      if (!e.detail.errMsg.includes('user deny')) {
        uni.showToast({ title: '您取消了授权', icon: 'none' });
      }
      return;
    }
    if (!e.detail.code) {
      uni.showToast({ title: '获取手机号失败', icon: 'none' });
      return;
    }

    uni.showLoading({ title: '绑定中...' });
    try {
      const res = await bindPhone({ phoneCode: e.detail.code });
      if (res?.userInfo) {
        userStore.setUserInfo(res.userInfo);
      } else {
        await userStore.fetchUserInfo();
      }
      uni.showToast({ title: '绑定成功', icon: 'success' });
    } catch (err) {
      console.error(err);
      uni.showToast({ title: '绑定失败', icon: 'none' });
    } finally {
      uni.hideLoading();
    }
  }

  return {
    showPhoneBindTip,
    handleBindPhone,
  };
}
