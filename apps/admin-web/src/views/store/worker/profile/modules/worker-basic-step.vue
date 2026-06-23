<script setup lang="ts">
import { computed } from 'vue';
import { useNaiveForm } from '@/hooks/common/form';
import AddressPicker from './address-picker.vue';
import TenantSelect from './tenant-select.vue';
import WorkerAvatarUpload from './worker-avatar-upload.vue';

defineOptions({
  name: 'WorkerBasicStep',
});

type BasicInfo = Api.Store.CreateWorkerProfileDto['basicInfo'];

const model = defineModel<BasicInfo>('model', { required: true });

const { formRef, validate, restoreValidation } = useNaiveForm();

const rules = computed<Record<keyof BasicInfo, App.Global.FormRule[]>>(() => ({
  tenantId: [{ required: true, message: '请选择所属租户', trigger: ['blur', 'change'] }],
  name: [{ required: true, message: '请输入姓名', trigger: ['blur', 'input'] }],
  nickName: [],
  phone: [
    { required: true, message: '请输入手机号', trigger: ['blur', 'input'] },
    { pattern: /^1[3-9]\d{9}$/, message: '手机号格式不正确', trigger: ['blur', 'input'] },
  ],
  avatar: [],
  gender: [],
  address: [],
  remark: [],
}));

defineExpose({
  validate,
  restoreValidation,
});
</script>

<template>
  <NForm ref="formRef" :model="model" :rules="rules" label-placement="left" :label-width="92">
    <NGrid responsive="screen" item-responsive :x-gap="16" :y-gap="8">
      <!-- 基础资料第一屏确认租户和联系方式，tenantId 后端仍会按用户身份兜底校验。 -->
      <NFormItemGi span="24 s:12" label="所属租户" path="tenantId">
        <TenantSelect v-model:value="model.tenantId" />
      </NFormItemGi>
      <NFormItemGi span="24 s:12" label="姓名" path="name">
        <NInput v-model:value="model.name" clearable placeholder="请输入真实姓名" />
      </NFormItemGi>
      <NFormItemGi span="24 s:12" label="昵称" path="nickName">
        <NInput v-model:value="model.nickName" clearable placeholder="请输入展示昵称" />
      </NFormItemGi>
      <NFormItemGi span="24 s:12" label="手机号" path="phone">
        <NInput v-model:value="model.phone" clearable placeholder="请输入手机号" />
      </NFormItemGi>
      <NFormItemGi span="24 s:12" label="性别" path="gender">
        <NSelect
          v-model:value="model.gender"
          clearable
          :options="[
            { label: '未知', value: 'UNKNOWN' },
            { label: '男', value: 'MALE' },
            { label: '女', value: 'FEMALE' },
          ]"
          placeholder="请选择性别"
        />
      </NFormItemGi>
      <NFormItemGi span="24 s:12" label="头像" path="avatar">
        <WorkerAvatarUpload v-model:value="model.avatar" />
      </NFormItemGi>
      <NFormItemGi span="24" label="联系地址" path="address">
        <AddressPicker v-model:value="model.address" />
      </NFormItemGi>
      <NFormItemGi span="24" label="后台备注" path="remark">
        <NInput v-model:value="model.remark" type="textarea" clearable placeholder="请输入后台备注" />
      </NFormItemGi>
    </NGrid>
  </NForm>
</template>
