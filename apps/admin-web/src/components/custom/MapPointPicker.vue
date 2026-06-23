<script setup lang="ts">
import { onMounted, onUnmounted, ref, watch } from 'vue';
import { NAlert, NButton, NInput, NInputGroup, NSpin } from 'naive-ui';
import AMapLoader from '@amap/amap-jsapi-loader';

defineOptions({ name: 'MapPointPicker' });

interface Point {
  lat: number;
  lng: number;
}

interface Props {
  /** 初始坐标 */
  modelValue?: Point;
  /** 初始地址描述 */
  address?: string;
}

const props = defineProps<Props>();

interface Emits {
  (e: 'update:modelValue', val: Point): void;
  (e: 'update:address', val: string): void;
}

const emit = defineEmits<Emits>();

const loading = ref(true);
const mapLoadError = ref('');
const mapReady = ref(false);
const searchKeyword = ref('');
const currentAddress = ref(props.address || '');
const currentPoint = ref<Point | undefined>(props.modelValue);

let map: any = null;
let marker: any = null;
let AMapObj: any = null;
let geocoder: any = null;
let placeSearch: any = null;

watch(
  () => props.modelValue,
  (val) => {
    if (val && (!currentPoint.value || val.lat !== currentPoint.value.lat || val.lng !== currentPoint.value.lng)) {
      currentPoint.value = val;
      updateMarkerAndCenter();
    }
  },
);

watch(
  () => props.address,
  (val) => {
    if (val !== currentAddress.value) {
      currentAddress.value = val || '';
    }
  },
);

async function initMap() {
  loading.value = true;
  mapLoadError.value = '';
  mapReady.value = false;

  try {
    Object.defineProperty(window, '_AMapSecurityConfig', {
      value: {
        securityJsCode: import.meta.env.VITE_AMAP_SECURITY_CODE,
      },
      configurable: true,
    });

    AMapObj = await AMapLoader.load({
      key: import.meta.env.VITE_AMAP_KEY,
      version: '2.0',
      plugins: ['AMap.Geocoder', 'AMap.AutoComplete', 'AMap.PlaceSearch'],
    });

    const center = props.modelValue ? [props.modelValue.lng, props.modelValue.lat] : [112.9388, 28.2282];

    map = new AMapObj.Map('point-map-container', {
      zoom: 13,
      center,
      resizeEnable: true,
    });

    geocoder = new AMapObj.Geocoder();
    placeSearch = new AMapObj.PlaceSearch({});

    map.on('click', (e: any) => {
      handleMapClick(e.lnglat.getLat(), e.lnglat.getLng());
    });

    if (props.modelValue) {
      addMarker(props.modelValue.lat, props.modelValue.lng);
    }

    mapReady.value = true;
    loading.value = false;
  } catch {
    mapLoadError.value = '地图资源加载失败，请检查高德配置或网络后重试';
    mapReady.value = false;
    window.$message?.error(mapLoadError.value);
    loading.value = false;
  }
}

async function retryInitMap() {
  if (map) {
    map.destroy();
    map = null;
  }
  await initMap();
}

function handleMapClick(lat: number, lng: number) {
  if (!mapReady.value) return;

  const safeLat = Number(lat);
  const safeLng = Number(lng);

  currentPoint.value = { lat: safeLat, lng: safeLng };
  emit('update:modelValue', currentPoint.value);

  addMarker(safeLat, safeLng);
  resolveAddress(safeLat, safeLng);
}

function addMarker(lat: number, lng: number) {
  if (!map || !AMapObj) return;

  if (marker) map.remove(marker);

  marker = new AMapObj.Marker({
    position: [lng, lat],
    anchor: 'bottom-center',
  });

  marker.setMap(map);
  map.setCenter([lng, lat]);
}

function updateMarkerAndCenter() {
  if (!currentPoint.value) return;
  addMarker(currentPoint.value.lat, currentPoint.value.lng);
}

function resolveAddress(lat: number, lng: number) {
  if (!geocoder) return;
  geocoder.getAddress([lng, lat], (status: string, result: any) => {
    if (status === 'complete' && result.regeocode) {
      currentAddress.value = result.regeocode.formattedAddress;
      emit('update:address', currentAddress.value);
    }
  });
}

function searchPlace() {
  if (!mapReady.value) {
    window.$message?.warning('地图尚未加载完成，暂不能搜索地点');
    return;
  }
  if (!searchKeyword.value || !placeSearch) return;

  placeSearch.search(searchKeyword.value, (status: string, result: any) => {
    if (status === 'complete' && result.poiList && result.poiList.pois && result.poiList.pois.length > 0) {
      const poi = result.poiList.pois[0];
      const lat = poi.location.lat;
      const lng = poi.location.lng;

      currentPoint.value = { lat, lng };
      currentAddress.value = poi.name;
      emit('update:modelValue', { lat, lng });
      emit('update:address', `${poi.name} (${poi.address})`);

      addMarker(lat, lng);
    } else {
      window.$message?.warning('未找到相关地点');
    }
  });
}

onMounted(() => {
  initMap();
});

onUnmounted(() => {
  if (map) map.destroy();
});
</script>

<template>
  <div class="relative h-full w-full flex flex-col gap-2">
    <div class="absolute left-2 right-2 top-2 z-10 flex gap-2">
      <NInputGroup>
        <NInput
          v-model:value="searchKeyword"
          placeholder="输入关键词搜索地点(Enter 搜索)"
          class="bg-white shadow-sm"
          :disabled="!mapReady"
          @keypress.enter="searchPlace"
        />
        <NButton type="primary" :disabled="!mapReady" @click="searchPlace">搜索</NButton>
      </NInputGroup>
    </div>

    <div id="point-map-container" class="relative min-h-[400px] flex-1 border border-gray-200 rounded">
      <div v-if="loading" class="absolute inset-0 z-20 flex items-center justify-center bg-white/80">
        <NSpin description="地图加载中..." />
      </div>
      <div
        v-else-if="mapLoadError"
        class="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 bg-white/90 p-4"
      >
        <NAlert type="error" title="地图加载失败" :bordered="false">{{ mapLoadError }}</NAlert>
        <NButton size="small" @click="retryInitMap">重试</NButton>
      </div>
    </div>

    <div class="flex flex-col gap-1 border border-gray-200 rounded bg-gray-50 p-2">
      <div class="flex items-center gap-2">
        <span class="whitespace-nowrap text-gray-500">当前选中:</span>
        <span class="flex-1 truncate text-primary font-bold">{{ currentAddress || '请在地图上点击选择' }}</span>
      </div>
      <div class="flex items-center gap-4 text-xs text-gray-400">
        <span>经度: {{ currentPoint?.lng || '-' }}</span>
        <span>纬度: {{ currentPoint?.lat || '-' }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
#point-map-container {
  width: 100%;
  height: 100%;
}
</style>
