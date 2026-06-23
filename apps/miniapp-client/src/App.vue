<script setup lang="ts">
import { onHide, onLaunch, onShow } from '@dcloudio/uni-app';
import { resolveShareToken, trackShareEvent } from '@/api/distribution';
import { reportActionError, safeIgnoreActionError } from '@/http/error-monitoring';
import { navigateToInterceptor } from '@/router/interceptor';
import { useAuthStore } from '@/store/auth';
import { useTokenStore } from '@/store/token';
import { extractDistShareContext, saveShareSid } from '@/utils/dist-share-context';

interface AppRouteOptions {
  path?: string;
  query?: Record<string, unknown>;
}

function normalizeRouteQuery(query?: Record<string, unknown>): Record<string, string> | undefined {
  if (!query) return undefined;

  const entries = Object.entries(query).flatMap(([key, value]) => {
    if (value === undefined || value === null) return [];
    return [[key, String(value)]];
  });

  return entries.length > 0 ? Object.fromEntries(entries) : undefined;
}

onLaunch((options: AppRouteOptions) => {
  console.log('App.vue onLaunch', options);

  // #ifdef MP-WEIXIN
  // 启动时先静默登录，再处理分享归因，确保绑定事件可携带会员身份
  void launchWorkflow(options);
  // #endif
});

onShow((options: AppRouteOptions) => {
  console.log('App.vue onShow', options);
  // 处理直接进入页面路由的情况：如h5直接输入路由、微信小程序分享后进入等
  // https://github.com/unibest-tech/unibest/issues/192
  if (options?.path) {
    navigateToInterceptor.invoke({ url: `/${options.path}`, query: normalizeRouteQuery(options.query) });
  } else {
    navigateToInterceptor.invoke({ url: '/' });
  }
});

onHide(() => {
  console.log('App Hide');
});

/**
 * 捕获分享归因参数
 */
async function captureShareAttribution(options?: AppRouteOptions) {
  const authStore = useAuthStore();
  const tokenStore = useTokenStore();
  const context = extractDistShareContext(options);

  if (!context.sid && !context.shareUserId) return;

  if (context.sid) {
    console.log('捕获分销 sid:', context.sid);
    saveShareSid(context.sid);
    try {
      const resolved = await resolveShareToken({ sid: context.sid });
      if (resolved?.available === false) {
        console.warn('sid 已失效:', resolved.code, resolved.message);
      } else if (resolved?.shareUserId) {
        const shareUserId = String(resolved.shareUserId);
        console.log('sid 解析推荐人成功:', shareUserId);
        authStore.setShareUserId(shareUserId);
      }

      if (tokenStore.hasLogin) {
        await trackShareEvent({
          sid: context.sid,
          eventType: 'BIND',
          ext: { source: context.source },
        });
      }
      return;
    } catch (e) {
      safeIgnoreActionError(e, {
        module: 'app-launch',
        operationCode: 'share.attribution',
        stepCode: 'share.attribution.resolveSid',
        stepName: '解析分享 sid',
        metadata: { sid: context.sid, source: context.source },
      });
      console.warn('sid 解析失败，回退 shareUserId:', e);
    }
  }

  if (context.shareUserId) {
    console.log('捕获分享归因 shareUserId:', context.shareUserId);
    authStore.setShareUserId(context.shareUserId);
  }
}

async function launchWorkflow(options?: AppRouteOptions) {
  await silentLogin();
  await captureShareAttribution(options);
}

/**
 * 静默登录 - 检查是否已注册
 */
async function silentLogin() {
  const tokenStore = useTokenStore();

  // 如果已登录则跳过
  if (tokenStore.hasLogin) {
    console.log('已登录，跳过静默登录');
    return;
  }

  try {
    // 静默登录检查
    const res = await tokenStore.wxLogin();
    if (res.isRegistered) {
      console.log('静默登录成功');
    } else {
      console.log('用户未注册，等待触发授权弹窗');
    }
  } catch (e) {
    reportActionError(e, {
      module: 'app-launch',
      operationCode: 'auth.silentLogin',
      stepCode: 'auth.silentLogin.wxLogin',
      stepName: '小程序静默登录',
    });
    console.warn('静默登录失败:', e);
  }
}
</script>

<style lang="scss"></style>
