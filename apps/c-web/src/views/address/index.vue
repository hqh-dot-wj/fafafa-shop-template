<script setup lang="ts">
const router = useRouter();
import type { AddressVo } from '@/service/api/address';
import { deleteAddress, getAddressList, setDefaultAddress } from '@/service/api/address';
import { toastError } from '@/utils/toast';

const { apiClient } = useApi();

const loading = ref(true);
const addresses = ref<AddressVo[]>([]);

async function loadList() {
  loading.value = true;
  try {
    const result = await getAddressList(apiClient);
    addresses.value = result.list ?? [];
  } catch (error) {
    addresses.value = [];
    toastError(error, '加载地址失败');
  } finally {
    loading.value = false;
  }
}

function goEdit(id?: string) {
  void router.push(id ? `/address/edit?id=${id}` : '/address/edit');
}

async function onSetDefault(item: AddressVo) {
  if (item.isDefault) return;
  try {
    await setDefaultAddress(apiClient, item.id);
    await loadList();
  } catch (error) {
    toastError(error, '设置失败');
  }
}

async function onDelete(item: AddressVo) {
  if (!window.confirm('确定删除该地址吗？')) return;
  try {
    await deleteAddress(apiClient, item.id);
    await loadList();
  } catch (error) {
    toastError(error, '删除失败');
  }
}

onMounted(() => {
  void loadList();
});
</script>

<template>
  <main class="address-list">
    <p v-if="loading" class="address-list__state">加载中…</p>
    <p v-else-if="addresses.length === 0" class="address-list__state">暂无收货地址</p>

    <ul v-else class="address-list__items">
      <li v-for="item in addresses" :key="item.id" class="address-list__card">
        <div class="address-list__head">
          <span class="address-list__name">{{ item.name }}</span>
          <span class="address-list__phone">{{ item.phone }}</span>
          <span v-if="item.isDefault" class="address-list__badge">默认</span>
          <span v-if="item.tag" class="address-list__tag">{{ item.tag }}</span>
        </div>
        <p class="address-list__full">{{ item.fullAddress }}</p>
        <div class="address-list__actions">
          <button v-if="!item.isDefault" type="button" @click="onSetDefault(item)">设为默认</button>
          <button type="button" @click="goEdit(item.id)">编辑</button>
          <button type="button" class="address-list__danger" @click="onDelete(item)">删除</button>
        </div>
      </li>
    </ul>

    <button type="button" class="address-list__add" @click="goEdit()">新增地址</button>
  </main>
</template>

<style scoped>
.address-list {
  margin: 0 auto;
  max-width: 720px;
  padding: 12px 12px 96px;
}

.address-list__state {
  color: #64748b;
  padding: 48px 0;
  text-align: center;
}

.address-list__items {
  display: grid;
  gap: 12px;
  list-style: none;
  margin: 0;
  padding: 0;
}

.address-list__card {
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  padding: 14px;
}

.address-list__head {
  align-items: center;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 8px;
}

.address-list__name {
  font-weight: 600;
}

.address-list__phone {
  color: #475569;
}

.address-list__badge {
  background: #ccfbf1;
  border-radius: 4px;
  color: #0f766e;
  font-size: 0.6875rem;
  padding: 2px 6px;
}

.address-list__tag {
  background: #f1f5f9;
  border-radius: 4px;
  color: #64748b;
  font-size: 0.6875rem;
  padding: 2px 6px;
}

.address-list__full {
  color: #334155;
  font-size: 0.875rem;
  margin: 0 0 12px;
}

.address-list__actions {
  display: flex;
  gap: 12px;
}

.address-list__actions button {
  background: none;
  border: none;
  color: #0d9488;
  cursor: pointer;
  font-size: 0.8125rem;
  padding: 0;
}

.address-list__danger {
  color: #b91c1c !important;
}

.address-list__add {
  background: #0d9488;
  border: none;
  border-radius: 10px;
  bottom: calc(64px + env(safe-area-inset-bottom, 0px));
  color: #fff;
  cursor: pointer;
  font-weight: 600;
  left: 16px;
  padding: 12px 16px;
  position: fixed;
  right: 16px;
  z-index: 15;
}
</style>
