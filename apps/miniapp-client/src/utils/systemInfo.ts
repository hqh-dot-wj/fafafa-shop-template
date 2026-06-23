type SystemInfo = UniNamespace.GetSystemInfoResult;
type SafeAreaInsets = UniNamespace.SafeAreaInsets | null;

export interface PhoneInfo {
  StatusBar: number;
  CustomBar: number;
  windowWidth: number;
  windowHeight: number;
  pixelRatio: number;
  screenWidth: number;
  screenHeight: number;
  SDKVersion: string;
  platform: string;
}

let systemInfo: Partial<SystemInfo> = {};
let safeAreaInsets: SafeAreaInsets = null;

const phone: PhoneInfo = {
  StatusBar: 0,
  CustomBar: 44,
  windowWidth: 375,
  windowHeight: 667,
  pixelRatio: 1,
  screenWidth: 375,
  screenHeight: 667,
  SDKVersion: '',
  platform: '',
};

// #ifdef MP-WEIXIN
const windowInfo = uni.getWindowInfo();
const appBaseInfo = uni.getAppBaseInfo();
const deviceInfo = uni.getDeviceInfo();

systemInfo = {
  ...windowInfo,
  ...appBaseInfo,
  ...deviceInfo,
};

safeAreaInsets = windowInfo.safeArea
  ? {
      top: windowInfo.safeArea.top,
      right: windowInfo.windowWidth - windowInfo.safeArea.right,
      bottom: windowInfo.windowHeight - windowInfo.safeArea.bottom,
      left: windowInfo.safeArea.left,
    }
  : null;
// #endif

// #ifndef MP-WEIXIN
systemInfo = uni.getSystemInfoSync();
safeAreaInsets = systemInfo.safeAreaInsets ?? null;
// #endif

phone.StatusBar = systemInfo.statusBarHeight ?? 0;
phone.windowWidth = systemInfo.windowWidth ?? 375;
phone.windowHeight = systemInfo.windowHeight ?? 667;
phone.pixelRatio = systemInfo.pixelRatio ?? 1;
phone.screenWidth = systemInfo.screenWidth ?? phone.windowWidth;
phone.screenHeight = systemInfo.screenHeight ?? phone.windowHeight;
phone.SDKVersion = systemInfo.SDKVersion ?? '';

if (systemInfo.platform === 'devtools') {
  phone.platform = 'android';
} else if (systemInfo.platform === 'ios') {
  phone.platform = 'IOS';
} else if (systemInfo.platform === 'android') {
  phone.platform = 'android';
} else {
  phone.platform = systemInfo.platform ?? '';
}

// #ifdef MP-WEIXIN
if (uni.getMenuButtonBoundingClientRect) {
  const custom = uni.getMenuButtonBoundingClientRect();
  phone.CustomBar = custom.bottom + custom.top - (systemInfo.statusBarHeight ?? 0);
}
// #endif

// #ifndef MP-WEIXIN
phone.CustomBar = (systemInfo.statusBarHeight ?? 0) + 44;
// #endif

console.log('systemInfo', systemInfo);
console.log('phone', phone);

export { phone, safeAreaInsets, systemInfo };
