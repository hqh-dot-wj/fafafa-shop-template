<script setup lang="ts">
import type { CreateAddressParams, UpdateAddressParams } from '@libs/common-types';
import { createAddress, getAddressDetail, updateAddress } from '@/service/api/address';
import { toastError, toastMessage } from '@/utils/toast';

const route = useRoute();
const router = useRouter();
const { apiClient } = useApi();

const addressId = computed(() => (typeof route.query.id === 'string' ? route.query.id : ''));
const loading = ref(false);
const saving = ref(false);

const form = ref({
  name: '',
  phone: '',
  province: '',
  city: '',
  district: '',
  detail: '',
  tag: '',
  isDefault: false,
});

async function loadDetail() {
  if (!addressId.value) return;
  loading.value = true;
  try {
    const detail = await getAddressDetail(apiClient, addressId.value);
    form.value = {
      name: detail.name,
      phone: detail.phone,
      province: detail.province,
      city: detail.city,
      district: detail.district,
      detail: detail.detail,
      tag: detail.tag ?? '',
      isDefault: detail.isDefault,
    };
  } catch (error) {
    toastError(error, '加载地址失败');
    void router.replace('/address');
  } finally {
    loading.value = false;
  }
}

function validate(): boolean {
  const { name, phone, province, city, district, detail } = form.value;
  if (!name.trim() || !phone.trim() || !province.trim() || !city.trim() || !district.trim() || !detail.trim()) {
    toastMessage('请填写完整收货信息');
    return false;
  }
  return true;
}

async function onSubmit() {
  if (!validate() || saving.value) return;
  saving.value = true;
  try {
    const payload = {
      name: form.value.name.trim(),
      phone: form.value.phone.trim(),
      province: form.value.province.trim(),
      city: form.value.city.trim(),
      district: form.value.district.trim(),
      detail: form.value.detail.trim(),
      isDefault: form.value.isDefault,
      ...(form.value.tag.trim() ? { tag: form.value.tag.trim() } : {}),
    };

    if (addressId.value) {
      const dto: UpdateAddressParams = { ...payload, id: addressId.value };
      await updateAddress(apiClient, dto);
    } else {
      await createAddress(apiClient, payload as CreateAddressParams);
    }
    void router.replace('/address');
  } catch (error) {
    toastError(error, '保存失败');
  } finally {
    saving.value = false;
  }
}

onMounted(() => {
  if (addressId.value) void loadDetail();
});
</script>

<template>
  <main class="address-edit">
    <p v-if="loading" class="address-edit__state">加载中…</p>

    <form v-else class="address-edit__form" @submit.prevent="onSubmit">
      <label class="address-edit__field">
        <span>收货人</span>
        <input v-model="form.name" type="text" placeholder="姓名" required />
      </label>
      <label class="address-edit__field">
        <span>手机号</span>
        <input v-model="form.phone" type="tel" maxlength="11" placeholder="手机号" required />
      </label>
      <label class="address-edit__field">
        <span>省</span>
        <input v-model="form.province" type="text" placeholder="省" required />
      </label>
      <label class="address-edit__field">
        <span>市</span>
        <input v-model="form.city" type="text" placeholder="市" required />
      </label>
      <label class="address-edit__field">
        <span>区/县</span>
        <input v-model="form.district" type="text" placeholder="区/县" required />
      </label>
      <label class="address-edit__field">
        <span>详细地址</span>
        <textarea v-model="form.detail" rows="3" placeholder="街道、门牌号等" required />
      </label>
      <label class="address-edit__field">
        <span>标签（选填）</span>
        <input v-model="form.tag" type="text" placeholder="家、公司、学校" />
      </label>
      <label class="address-edit__check">
        <input v-model="form.isDefault" type="checkbox" />
        <span>设为默认地址</span>
      </label>

      <button type="submit" class="address-edit__submit" :disabled="saving">
        {{ saving ? '保存中…' : '保存' }}
      </button>
    </form>
  </main>
</template>

<style scoped>
.address-edit {
  margin: 0 auto;
  max-width: 720px;
  padding: 12px 12px 24px;
}

.address-edit__state {
  color: #64748b;
  padding: 48px 0;
  text-align: center;
}

.address-edit__form {
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  padding: 16px;
}

.address-edit__field {
  display: grid;
  gap: 6px;
  margin-bottom: 12px;
}

.address-edit__field span {
  color: #64748b;
  font-size: 0.8125rem;
}

.address-edit__field input,
.address-edit__field textarea {
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  font: inherit;
  padding: 10px 12px;
  width: 100%;
}

.address-edit__check {
  align-items: center;
  display: flex;
  gap: 8px;
  margin: 16px 0;
}

.address-edit__submit {
  background: #0d9488;
  border: none;
  border-radius: 10px;
  color: #fff;
  cursor: pointer;
  font-weight: 600;
  padding: 12px 16px;
  width: 100%;
}

.address-edit__submit:disabled {
  cursor: not-allowed;
  opacity: 0.6;
}
</style>
