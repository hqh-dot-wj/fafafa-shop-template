<script setup lang="ts">
import { useRouterPush } from '@/hooks/common/router';
import { $t } from '@/locales';

defineOptions({
  name: 'Register',
});

const { toggleLoginModule } = useRouterPush();
</script>

<template>
  <div class="text-center">
    <div class="mb-5px text-32px text-black font-600 sm:text-30px dark:text-white">
      {{ $t('page.login.common.register') }}
    </div>
    <div class="mx-auto mb-32px max-w-380px text-left text-16px text-#858585 leading-relaxed">
      <p class="mb-12px">
        本系统<strong>不提供</strong>管理端公开自助注册。后台账号由<strong>租户管理员或运维</strong>在系统中创建并分配，请勿尝试调用注册接口。
      </p>
      <p class="m-0">若您需要访问权限，请联系所在单位的管理员。</p>
    </div>
    <NButton type="primary" size="large" block class="max-w-380px" @click="toggleLoginModule('pwd-login')">
      {{ $t('page.login.common.back') }}
    </NButton>
  </div>
</template>

<style scoped>
:deep(.n-button) {
  --n-height: 42px !important;
  --n-font-size: 18px !important;
}
</style>
