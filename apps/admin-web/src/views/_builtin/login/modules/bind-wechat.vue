<script setup lang="ts">
import { useLoading } from '@sa/hooks';
import { fetchWechatSocialCallback } from '@/service/api';
import { useRouterPush } from '@/hooks/common/router';

defineOptions({
  name: 'BindWechat',
});

const { toggleLoginModule } = useRouterPush();
const { loading, startLoading, endLoading } = useLoading();

async function handleProbeBackend() {
  startLoading();
  try {
    await fetchWechatSocialCallback({});
  } finally {
    endLoading();
  }
}
</script>

<template>
  <div>
    <div class="mb-5px text-32px text-black font-600 sm:text-30px dark:text-white">微信扫码 / 绑定</div>
    <div class="pb-18px text-16px text-#858585 leading-relaxed">
      微信开放平台扫码登录与账号绑定能力正在接入中。配置完成前，请使用<strong>账号密码</strong>或<strong>短信验证码</strong>登录。
    </div>
    <NAlert type="info" class="mb-20px" :bordered="false">
      若管理员已在服务端配置微信应用，回调将返回绑定结果；未配置时接口会返回明确提示，而非空白页。
    </NAlert>
    <NSpace vertical :size="16" class="w-full">
      <NButton type="primary" size="large" block :loading="loading" @click="handleProbeBackend">
        检测服务端接入状态
      </NButton>
      <NButton size="large" block @click="toggleLoginModule('pwd-login')">返回密码登录</NButton>
    </NSpace>
  </div>
</template>

<style scoped>
:deep(.n-button) {
  --n-height: 42px !important;
  --n-font-size: 18px !important;
  --n-border-radius: 8px !important;
}
</style>
