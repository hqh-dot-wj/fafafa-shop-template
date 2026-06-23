<script setup lang="ts">
import { onMounted, onUnmounted, ref, watch } from 'vue';
import AMapLoader from '@amap/amap-jsapi-loader';
import RegionCascader from './RegionCascader.vue';

interface Point {
  lat: number;
  lng: number;
}

type TenantFence =
  | {
      type: 'Polygon';
      coordinates: number[][][];
    }
  | {
      type: 'MultiPolygon';
      coordinates: number[][][][];
    };

interface Props {
  modelValue?: Point;
  address?: string;
  fence?: TenantFence | null;
  radius?: number; // Service radius in meters
}

const props = defineProps<Props>();
const emit = defineEmits<{
  'update:modelValue': [value: Point | undefined];
  'update:address': [value: string];
  'update:fence': [value: TenantFence | null];
  'update:radius': [value: number];
}>();

const loading = ref(true);
const mapLoadError = ref('');
const mapReady = ref(false);
const currentMode = ref('district');
const searchKeyword = ref('');
const currentAddress = ref(props.address || '');
const currentPoint = ref<Point | undefined>(props.modelValue);
const hasFence = ref(false);

let map: any = null;
let marker: any = null;
let AMapObj: any = null;
let districtSearch: any = null;
let polygonEditor: any = null;
let circleEditor: any = null;
let placeSearch: any = null;
let geocoder: any = null;

let currentPolygons: any[] = [];
let currentCircle: any = null;

const circleRadiusKm = ref(props.radius ? props.radius / 1000 : 3);

watch(
  () => props.radius,
  (val) => {
    if (val) {
      circleRadiusKm.value = val / 1000;
      updateCircle();
    }
  },
);

const isDrawing = ref(false);

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
      plugins: [
        'AMap.Geocoder',
        'AMap.AutoComplete',
        'AMap.PlaceSearch',
        'AMap.PolygonEditor',
        'AMap.CircleEditor',
        'AMap.DistrictSearch',
        'AMap.GeometryUtil',
      ],
    });

    map = new AMapObj.Map('amap-container', {
      zoom: 12,
      center: props.modelValue ? [props.modelValue.lng, props.modelValue.lat] : [112.9388, 28.2282],
      resizeEnable: true,
      scrollWheel: true,
    });

    geocoder = new AMapObj.Geocoder();
    placeSearch = new AMapObj.PlaceSearch({});

    districtSearch = new AMapObj.DistrictSearch({
      subdistrict: 1,
      extensions: 'all',
      level: 'province',
    });

    map.on('click', (e: any) => {
      handleMapClick(e.lnglat.getLat(), e.lnglat.getLng());
    });

    mapReady.value = true;

    if (props.modelValue) {
      addMarker(props.modelValue.lat, props.modelValue.lng);
    }

    if (props.fence && props.fence.coordinates) {
      if (props.fence.type === 'MultiPolygon') {
        const boundaries = props.fence.coordinates.map((poly: any) => poly[0]);
        drawRegionBoundary(boundaries);
      } else {
        drawPolygonOnMap(props.fence.coordinates[0]);
      }
      hasFence.value = true;
    }

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

function switchMode(val: string) {
  currentMode.value = val;

  if (!mapReady.value) return;

  if (isDrawing.value) endDraw();

  if (circleEditor) {
    circleEditor.close();
    circleEditor = null;
  }

  if (val === 'circle') {
    if (currentPoint.value) {
      clearFence(false);
      updateCircle();
    } else {
      clearFence();
    }
  } else if (val === 'district') {
    if (currentCircle) {
      map.remove(currentCircle);
      currentCircle = null;
    }
  } else if (val === 'polygon' && currentCircle) {
    map.remove(currentCircle);
    currentCircle = null;
  }
}

function handleMapClick(lat: number, lng: number) {
  if (!mapReady.value) return;

  if (currentMode.value === 'polygon' && isDrawing.value) return;

  selectPoint(lat, lng);

  if (currentMode.value === 'circle') {
    updateCircle();
  }
}

function selectPoint(lat: number, lng: number) {
  if (!mapReady.value || !geocoder) return;

  const safeLat = Number(lat);
  const safeLng = Number(lng);

  currentPoint.value = { lat: safeLat, lng: safeLng };
  emit('update:modelValue', currentPoint.value);
  addMarker(safeLat, safeLng);

  geocoder.getAddress([safeLng, safeLat], (status: string, result: any) => {
    if (status === 'complete' && result.regeocode) {
      currentAddress.value = result.regeocode.formattedAddress;
      emit('update:address', currentAddress.value);
    }
  });
}

function addMarker(lat: number, lng: number) {
  if (!mapReady.value) return;

  if (marker) map.remove(marker);
  marker = new AMapObj.Marker({
    position: [lng, lat],
    anchor: 'bottom-center',
  });
  marker.setMap(map);
  map.setCenter([lng, lat]);
}

function searchPlace() {
  if (!searchKeyword.value) return;
  if (!mapReady.value || !placeSearch) {
    window.$message?.warning('地图尚未加载完成，暂不能搜索地点');
    return;
  }

  placeSearch.search(searchKeyword.value, (status: string, result: any) => {
    if (status === 'complete' && result.poiList?.pois?.length > 0) {
      const poi = result.poiList.pois[0];
      selectPoint(poi.location.lat, poi.location.lng);
      if (currentMode.value === 'circle') updateCircle();
    }
  });
}

const pendingRegionLabels = ref<string[]>([]);
const pendingRegionCode = ref<string | null>(null);

function handleRegionLabelUpdate(labels: string[]) {
  pendingRegionLabels.value = labels;
}

function handleRegionValueUpdate(val: string) {
  pendingRegionCode.value = val;
}

function applyRegionSelection() {
  const labels = pendingRegionLabels.value;
  if (!labels || labels.length === 0) return;
  if (!mapReady.value || !districtSearch) {
    window.$message?.warning('地图尚未加载完成，暂不能选择区域');
    return;
  }

  const keyword = pendingRegionCode.value || labels[labels.length - 1];
  const levelMap = ['country', 'province', 'city', 'district'];
  const level = levelMap[labels.length] || 'district';

  if (districtSearch) {
    districtSearch.setLevel(level);
    districtSearch.search(keyword, (status: string, result: any) => {
      if (status === 'complete' && result.districtList?.length > 0) {
        const item = result.districtList[0];

        if (item.center && map) {
          map.setCenter(item.center);
          if (level === 'province') map.setZoom(8);
          else if (level === 'city') map.setZoom(10);
          else map.setZoom(13);
        }

        if (item.boundaries && item.boundaries.length > 0) {
          drawRegionBoundary(item.boundaries);
        }

        currentAddress.value = labels.join('');
        emit('update:address', currentAddress.value);
      }
    });
  }
}

function updateCircle() {
  if (!currentPoint.value || !AMapObj || !map) return;

  if (currentCircle) {
    if (!circleEditor) {
      map.remove(currentCircle);
      currentCircle = null;
    }
  }

  if (currentPolygons.length > 0) {
    currentPolygons.forEach((p) => map.remove(p));
    currentPolygons = [];
  }

  const center = [currentPoint.value.lng, currentPoint.value.lat];
  const radiusMeters = circleRadiusKm.value * 1000;

  if (!currentCircle) {
    currentCircle = new AMapObj.Circle({
      center,
      radius: radiusMeters,
      strokeColor: '#FF33FF',
      strokeWeight: 2,
      fillColor: '#1791fc',
      fillOpacity: 0.35,
      map,
      strokeStyle: 'dashed',
      strokeDasharray: [10, 10],
    });
  } else {
    currentCircle.setCenter(center);
    currentCircle.setRadius(radiusMeters);
  }

  if (!circleEditor) {
    circleEditor = new AMapObj.CircleEditor(map, currentCircle);

    circleEditor.on('adjust', (event: any) => {
      const r = event.radius;
      circleRadiusKm.value = Number((r / 1000).toFixed(2));
      emit('update:radius', Math.round(r));
      generateCircleGeoJson();
    });

    circleEditor.on('move', (event: any) => {
      const lnglat = event.lnglat;
      selectPoint(lnglat.lat, lnglat.lng);
    });

    circleEditor.open();
  }

  generateCircleGeoJson();
  emit('update:radius', Math.round(radiusMeters));
}

function generateCircleGeoJson() {
  if (!currentCircle || !currentPoint.value) return;

  const center = [currentPoint.value.lng, currentPoint.value.lat];
  const radiusMeters = currentCircle.getRadius();

  const path = [];
  const numPoints = 64;
  for (let i = 0; i < numPoints; i++) {
    const angle = (2 * Math.PI * i) / numPoints;
    const dx = radiusMeters * Math.cos(angle);
    const dy = radiusMeters * Math.sin(angle);

    const lng = center[0] + dx / (111319.55 * Math.cos((center[1] * Math.PI) / 180));
    const lat = center[1] + dy / 111319.55;
    path.push([lng, lat]);
  }
  path.push(path[0]);

  const geoJson: TenantFence = { type: 'Polygon', coordinates: [path] };
  emit('update:fence', geoJson);
  hasFence.value = true;
}

function startDraw() {
  if (!mapReady.value) {
    window.$message?.warning('地图尚未加载完成，暂不能绘制围栏');
    return;
  }

  if (currentCircle) {
    map.remove(currentCircle);
    currentCircle = null;
  }
  clearFence();

  if (!polygonEditor) {
    const polygon = new AMapObj.Polygon({
      map,
      path: [],
      strokeColor: '#FF33FF',
      fillColor: '#1791fc',
      fillOpacity: 0.35,
    });
    polygonEditor = new AMapObj.PolygonEditor(map, polygon);
    currentPolygons = [polygon];

    polygonEditor.on('end', () => syncPolygonData());
    polygonEditor.on('adjust', () => syncPolygonData());
  } else {
    const polygon = new AMapObj.Polygon({
      map,
      path: [],
      strokeColor: '#FF33FF',
      fillColor: '#1791fc',
      fillOpacity: 0.35,
    });
    polygonEditor.setTarget(polygon);
    currentPolygons = [polygon];
  }

  isDrawing.value = true;
  polygonEditor.open();
}

function endDraw() {
  if (polygonEditor) {
    polygonEditor.close();
    isDrawing.value = false;
    syncPolygonData();
  }
}

function drawPolygonOnMap(path: any[]) {
  clearFence();
  if (currentCircle) {
    map.remove(currentCircle);
    currentCircle = null;
  }

  const polygon = new AMapObj.Polygon({
    map,
    path,
    strokeColor: '#FF33FF',
    strokeWeight: 2,
    fillColor: '#1791fc',
    fillOpacity: 0.35,
  });
  currentPolygons = [polygon];
  map.setFitView(currentPolygons);
  syncPolygonData();
}

function drawRegionBoundary(boundaries: any[]) {
  if (currentPolygons.length > 0) {
    currentPolygons.forEach((p) => map.remove(p));
    currentPolygons = [];
  }
  if (currentCircle) {
    map.remove(currentCircle);
    currentCircle = null;
  }

  const newPolygons = [];
  for (let i = 0; i < boundaries.length; i++) {
    const polygon = new AMapObj.Polygon({
      map,
      strokeWeight: 1,
      path: boundaries[i],
      fillOpacity: 0.35,
      fillColor: '#1791fc',
      strokeColor: '#FF33FF',
    });
    newPolygons.push(polygon);
  }
  currentPolygons = newPolygons;

  if (currentPolygons.length > 0) {
    map.setFitView(currentPolygons);
  }
  syncPolygonData();
}

function clearFence(emitUpdate = true) {
  if (!mapReady.value) {
    if (emitUpdate) {
      hasFence.value = false;
      emit('update:fence', null);
    }
    return;
  }

  if (currentPolygons.length > 0) {
    currentPolygons.forEach((p) => map.remove(p));
    currentPolygons = [];
  }
  if (currentCircle) {
    map.remove(currentCircle);
    currentCircle = null;
  }
  if (circleEditor) {
    circleEditor.close();
    circleEditor = null;
  }

  if (polygonEditor) {
    polygonEditor.close();
    polygonEditor.setTarget(null);
  }

  if (emitUpdate) {
    hasFence.value = false;
    emit('update:fence', null);
  }
}

function syncPolygonData() {
  const validPolys = currentPolygons.filter((p) => {
    const path = p.getPath();
    return path && path.length >= 3;
  });

  if (validPolys.length === 0) {
    hasFence.value = false;
    return;
  }

  const allCoordinates = [];

  for (const poly of validPolys) {
    const path = poly.getPath();
    const ring = path.map((bg: any) => [bg.lng, bg.lat]);
    if (ring[0][0] !== ring[ring.length - 1][0] || ring[0][1] !== ring[ring.length - 1][1]) {
      ring.push(ring[0]);
    }
    allCoordinates.push([ring]);
  }

  if (allCoordinates.length > 0) {
    let geoJson: TenantFence;
    if (allCoordinates.length === 1) {
      geoJson = { type: 'Polygon', coordinates: allCoordinates[0] };
    } else {
      geoJson = { type: 'MultiPolygon', coordinates: allCoordinates };
    }
    emit('update:fence', geoJson);
    hasFence.value = true;
  }
}

onMounted(() => {
  initMap();
});

onUnmounted(() => {
  if (map) {
    map.destroy();
  }
});
</script>

<template>
  <div class="h-full w-full flex flex-col gap-2">
    <NTabs type="segment" :value="currentMode" @update:value="switchMode">
      <NTabPane name="district" tab="行政区域（自动）" />
      <NTabPane name="circle" tab="圆形范围（半径）" />
      <NTabPane name="polygon" tab="自定义绘制（手绘）" />
    </NTabs>

    <div
      class="min-h-[60px] flex flex-col flex-shrink-0 justify-center gap-2 border border-gray-100 rounded bg-gray-50 p-2"
    >
      <div v-if="currentMode === 'district'" class="flex items-center gap-2">
        <RegionCascader
          class="flex-1"
          @update:label="handleRegionLabelUpdate"
          @update:value="handleRegionValueUpdate"
        />
        <NButton
          type="primary"
          size="small"
          :disabled="!mapReady || !pendingRegionLabels || pendingRegionLabels.length === 0"
          @click="applyRegionSelection"
        >
          确定
        </NButton>
      </div>

      <div v-if="currentMode === 'circle'" class="flex items-center gap-4">
        <div class="flex flex-1 items-center gap-2">
          <span>半径（公里）：</span>
          <NSlider
            v-model:value="circleRadiusKm"
            :min="0.5"
            :max="50"
            :step="0.5"
            class="flex-1"
            :disabled="!mapReady"
            @update:value="updateCircle"
          />
          <NInputNumber
            v-model:value="circleRadiusKm"
            size="small"
            :min="0.1"
            class="w-20"
            :show-button="false"
            :disabled="!mapReady"
            @update:value="updateCircle"
          />
        </div>
        <div class="text-xs text-gray-400">请点击地图设置中心点</div>
      </div>

      <div v-if="currentMode === 'polygon'" class="flex gap-2">
        <NButton v-if="!isDrawing" type="primary" size="small" :disabled="!mapReady" @click="startDraw">
          开始绘制
        </NButton>
        <NButton v-else type="error" size="small" :disabled="!mapReady" @click="endDraw">结束并确认绘制</NButton>
        <NButton size="small" :disabled="!mapReady" @click="() => clearFence()">清除围栏</NButton>
      </div>

      <div v-if="currentMode !== 'district'" class="flex gap-2">
        <NInput
          v-model:value="searchKeyword"
          placeholder="搜索地点（例如：长沙市政府）"
          :disabled="!mapReady"
          @keypress.enter="searchPlace"
        />
        <NButton type="primary" :disabled="!mapReady" @click="searchPlace">搜索</NButton>
      </div>
    </div>

    <div id="amap-container" class="relative min-h-400px flex-1 border border-gray-200 rounded">
      <div v-if="loading" class="absolute inset-0 z-10 flex items-center justify-center bg-white/80">
        <NSpin description="地图资源加载中..." />
      </div>
      <div
        v-else-if="mapLoadError"
        class="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-white/90 p-4"
      >
        <NAlert type="error" title="地图加载失败" :bordered="false">{{ mapLoadError }}</NAlert>
        <NButton size="small" @click="retryInitMap">重试</NButton>
      </div>
    </div>

    <div class="flex justify-between text-xs text-gray-500">
      <span>当前地址：{{ currentAddress || '未选择' }}</span>
      <span v-if="hasFence" class="text-green-600 font-bold">已生成有效围栏数据</span>
      <span v-else class="text-red-400">未生成围栏</span>
    </div>
  </div>
</template>

<style scoped>
#amap-container {
  width: 100%;
  height: 100%;
  touch-action: none;
}
</style>
