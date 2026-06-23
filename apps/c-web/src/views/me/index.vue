<script setup lang="ts">
const router = useRouter();
import { fetchUnusedCouponTotal } from '@/service/api/coupon';

const tokenStore = useTokenStore();
const userStore = useUserStore();
const { apiClient } = useApi();
const { visibleMeMenu } = useFeatureNav();

const couponCount = ref(0);

onMounted(async () => {
  if (tokenStore.hasLogin) {
    couponCount.value = await fetchUnusedCouponTotal(apiClient);
  }
});

async function handleLogout() {
  await tokenStore.logout();
  await router.push('/');
}
</script>

<template>
  <section class="me">
    <div class="me__card">
      <p class="me__label">当前会员</p>
      <h2>{{ userStore.displayName }}</h2>
      <p v-if="userStore.userInfo.mobile" class="me__mobile">{{ userStore.userInfo.mobile }}</p>
    </div>

    <nav class="me__menu">
      <RouterLink v-for="item in visibleMeMenu" :key="item.to" :to="item.to" class="me__item">
        <div>
          <p class="me__item-title">{{ item.label }}</p>
          <p class="me__item-desc">{{ item.desc }}</p>
        </div>
        <span v-if="item.badgeKey === 'coupon' && couponCount > 0" class="me__badge">{{ couponCount }}</span>
        <span class="me__arrow">›</span>
      </RouterLink>
    </nav>

    <button type="button" class="me__logout" @click="handleLogout">退出登录</button>
  </section>
</template>

<style scoped>
.me {
  margin: 0 auto;
  max-width: 720px;
  padding: 24px 16px;
}

.me__card {
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  margin-bottom: 16px;
  padding: 20px;
}

.me__label {
  color: #64748b;
  font-size: 0.8125rem;
  margin: 0 0 4px;
}

.me h2 {
  margin: 0;
}

.me__mobile {
  color: #475569;
  margin: 8px 0 0;
}

.me__menu {
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  margin-bottom: 16px;
  overflow: hidden;
}

.me__item {
  align-items: center;
  border-bottom: 1px solid #f1f5f9;
  color: inherit;
  display: flex;
  gap: 12px;
  padding: 14px 16px;
  text-decoration: none;
}

.me__item:last-child {
  border-bottom: none;
}

.me__item-title {
  font-weight: 600;
  margin: 0;
}

.me__item-desc {
  color: #64748b;
  font-size: 0.75rem;
  margin: 4px 0 0;
}

.me__badge {
  background: #fee2e2;
  border-radius: 999px;
  color: #b91c1c;
  font-size: 0.75rem;
  margin-left: auto;
  min-width: 20px;
  padding: 2px 8px;
  text-align: center;
}

.me__arrow {
  color: #94a3b8;
  font-size: 1.25rem;
  margin-left: auto;
}

.me__item:has(.me__badge) .me__arrow {
  margin-left: 0;
}

.me__logout {
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  color: #b91c1c;
  cursor: pointer;
  font-size: 0.9375rem;
  padding: 12px 16px;
  width: 100%;
}
</style>
