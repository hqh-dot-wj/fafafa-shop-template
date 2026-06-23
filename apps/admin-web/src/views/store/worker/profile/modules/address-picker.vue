<script setup lang="ts">
defineOptions({
  name: 'AddressPicker',
});

const model = defineModel<Api.Store.WorkerAddress>('value', {
  required: true,
});
</script>

<template>
  <NGrid responsive="screen" item-responsive :x-gap="12" :y-gap="8">
    <NFormItemGi span="24 s:8" label="省份" path="provinceName">
      <NInput v-model:value="model.provinceName" clearable placeholder="省份" />
    </NFormItemGi>
    <NFormItemGi span="24 s:8" label="城市" path="cityName">
      <NInput v-model:value="model.cityName" clearable placeholder="城市" />
    </NFormItemGi>
    <NFormItemGi span="24 s:8" label="区县" path="districtName">
      <NInput v-model:value="model.districtName" clearable placeholder="区县" />
    </NFormItemGi>
    <NFormItemGi span="24" label="详细地址" path="addressDetail">
      <NInput v-model:value="model.addressDetail" clearable placeholder="详细地址" />
    </NFormItemGi>
    <NFormItemGi span="24" label="完整地址" path="formattedAddress">
      <NInput v-model:value="model.formattedAddress" clearable placeholder="用于列表与详情展示的完整地址" />
    </NFormItemGi>
  </NGrid>
</template>
