/**
 * Auth Store - 管理全局登录弹窗状态
 */
import { isMp } from '@uni-helper/uni-env';
import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import { MEMBER_PRESET_AVATAR_PATHS } from '@/constants/member-preset-avatars';
import { LOGIN_PAGE_ENABLE_IN_MP } from '@/router/config';
import { hasBoundPhone } from '@/utils/member-phone';
import { buildLoginRedirectQueryString, toLoginPage } from '@/utils/toLoginPage';
import { enqueueRuntimePopup } from './popup-orchestrator';
import { useTokenStore } from './token';
import { useUserStore } from './user';

/** 随机头像池（包内静态资源路径） */
const AVATAR_POOL: readonly string[] = [...MEMBER_PRESET_AVATAR_PATHS];

// 随机昵称池
const NICKNAME_POOL = [
  '快乐的小狗',
  '奔跑的橘猫',
  '睡觉的熊猫',
  '微笑的兔子',
  '可爱的仓鼠',
  '调皮的猴子',
  '优雅的天鹅',
  '勤劳的蜜蜂',
];

// 分享归因过期时间（1天，毫秒）
const SHARE_USER_EXPIRE_MS = 24 * 60 * 60 * 1000;

export const useAuthStore = defineStore('auth', () => {
  // 全局登录弹窗是否显示
  const showAuthModal = ref(false);
  // 完成授权后的回调
  const authCallback = ref<(() => void) | null>(null);
  // 临时存储的头像 (tmp:// 路径)
  const tempAvatar = ref('');
  // 临时昵称
  const tempNickname = ref('');
  // 分享归因ID
  const shareUserId = ref<string | null>(null);

  const POLICY_VERSION = '2026-03-31';

  /** 与本地存储同步的协议状态（必须用 ref，否则 computed 读 storage 无响应式依赖会永久缓存首次结果） */
  const privacyDecision = ref(String(uni.getStorageSync('privacyDecision') ?? ''));
  const policyVersionStored = ref(String(uni.getStorageSync('policyVersion') ?? ''));

  /**
   * 是否需要弹协议：版本不一致必弹；同版本下仅「已同意」视为通过，「暂不同意」需持续询问
   */
  const requireAgreement = computed(() => {
    const decision = privacyDecision.value;
    const version = policyVersionStored.value;
    if (version !== POLICY_VERSION) return true;
    return decision !== 'agreed';
  });

  /** 是否已登录 */
  const requireLogin = computed(() => {
    const tokenStore = useTokenStore();
    return !tokenStore.hasLogin;
  });

  /** 已登录但未绑定手机号（与 /client/user/info 的 mobile 字段一致） */
  const requireBoundPhone = computed(() => {
    const userStore = useUserStore();
    const tokenStore = useTokenStore();
    return tokenStore.hasLogin && !hasBoundPhone(userStore.userInfo);
  });

  /** @deprecated 使用 requireBoundPhone 替代 */
  const needBindPhone = requireBoundPhone;

  /** 协议弹层是否正在展示（用于与登录、门店确认互斥） */
  const agreementPopupVisible = ref(false);

  function setAgreementPopupVisible(visible: boolean) {
    agreementPopupVisible.value = visible;
  }

  function recordAgreement(agreed: boolean) {
    const decision = agreed ? 'agreed' : 'rejected';
    uni.setStorageSync('privacyDecision', decision);
    uni.setStorageSync('policyVersion', POLICY_VERSION);
    privacyDecision.value = decision;
    policyVersionStored.value = POLICY_VERSION;
  }

  function openMpAuthModal(callback?: () => void) {
    showAuthModal.value = true;
    authCallback.value = callback || null;
    enqueueRuntimePopup('login');
  }

  // 打开认证入口：小程序使用全局授权弹窗，H5/App 使用登录页。
  function openAuthModal(callback?: () => void) {
    if (isMp && !LOGIN_PAGE_ENABLE_IN_MP) {
      openMpAuthModal(callback);
      return;
    }

    authCallback.value = callback || null;
    toLoginPage({ queryString: buildLoginRedirectQueryString() });
  }

  // 关闭授权弹窗
  function closeAuthModal() {
    showAuthModal.value = false;
    authCallback.value = null;
  }

  function consumeAuthCallback(): (() => void) | null {
    const callback = authCallback.value;
    authCallback.value = null;
    return callback;
  }

  // 授权成功后执行回调
  function onAuthSuccess() {
    const callback = consumeAuthCallback();
    if (callback) {
      callback();
    }
    closeAuthModal();
  }

  // 生成随机头像
  function generateRandomAvatar(): string {
    const index = Math.floor(Math.random() * AVATAR_POOL.length);
    tempAvatar.value = AVATAR_POOL[index] || '';
    return tempAvatar.value;
  }

  // 生成随机昵称
  function generateRandomNickname(): string {
    const index = Math.floor(Math.random() * NICKNAME_POOL.length);
    const suffix = Math.floor(Math.random() * 1000);
    tempNickname.value = `${NICKNAME_POOL[index]}${suffix}`;
    return tempNickname.value;
  }

  // 设置分享归因（带过期时间）
  function setShareUserId(id: string) {
    shareUserId.value = id;
    const expireTime = Date.now() + SHARE_USER_EXPIRE_MS;
    uni.setStorageSync('share_user_id', id);
    uni.setStorageSync('share_user_expire', expireTime);
  }

  // 获取分享归因 (检查过期)
  function getShareUserId(): string | null {
    if (shareUserId.value) {
      // 检查内存中的值是否过期
      const expireTime = uni.getStorageSync('share_user_expire');
      if (expireTime && Date.now() < expireTime) {
        return shareUserId.value;
      }
      // 已过期，清除
      clearShareUserId();
      return null;
    }

    const stored = uni.getStorageSync('share_user_id');
    const expireTime = uni.getStorageSync('share_user_expire');

    // 检查是否过期
    if (stored && expireTime && Date.now() < expireTime) {
      shareUserId.value = stored;
      return stored;
    }

    // 过期则清除
    clearShareUserId();
    return null;
  }

  // 清除分享归因
  function clearShareUserId() {
    shareUserId.value = null;
    uni.removeStorageSync('share_user_id');
    uni.removeStorageSync('share_user_expire');
  }

  // 需要登录时的检查 (如未登录弹出授权弹窗)
  function requireAuth(callback?: () => void): boolean {
    const tokenStore = useTokenStore();
    if (tokenStore.hasLogin) {
      return true;
    }
    if (requireAgreement.value || agreementPopupVisible.value) {
      enqueueRuntimePopup('agreement');
      openAuthModal(callback);
      return false;
    }

    if (tokenStore.tokenInfo?.refresh_token) {
      void tokenStore
        .tryGetValidToken()
        .then((token) => {
          if (token) {
            callback?.();
            return;
          }
          openAuthModal(callback);
        })
        .catch(() => openAuthModal(callback));
      return false;
    }
    openAuthModal(callback);
    return false;
  }

  return {
    showAuthModal,
    tempAvatar,
    tempNickname,
    shareUserId,
    needBindPhone,
    requireAgreement,
    requireLogin,
    requireBoundPhone,
    agreementPopupVisible,
    setAgreementPopupVisible,
    recordAgreement,
    openAuthModal,
    closeAuthModal,
    consumeAuthCallback,
    onAuthSuccess,
    generateRandomAvatar,
    generateRandomNickname,
    setShareUserId,
    getShareUserId,
    clearShareUserId,
    requireAuth,
  };
});
