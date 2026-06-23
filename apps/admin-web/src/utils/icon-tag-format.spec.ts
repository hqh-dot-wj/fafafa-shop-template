import { describe, expect, it } from 'vitest';
import { getBrowserIcon, getOsIcon, getRequestMethodTagType } from './icon-tag-format';

describe('getRequestMethodTagType', () => {
  it.each([
    ['GET', 'success'],
    ['get', 'success'],
    ['POST', 'primary'],
    ['post', 'primary'],
    ['PUT', 'warning'],
    ['put', 'warning'],
    ['DELETE', 'error'],
    ['delete', 'error'],
  ])('Given 方法 "%s", When getRequestMethodTagType, Then 返回 "%s"', (method, expected) => {
    expect(getRequestMethodTagType(method)).toBe(expected);
  });

  it('Given 未知方法, When getRequestMethodTagType, Then 返回 "default"', () => {
    expect(getRequestMethodTagType('PATCH')).toBe('default');
    expect(getRequestMethodTagType('OPTIONS')).toBe('default');
  });
});

describe('getBrowserIcon', () => {
  it.each([
    ['Chrome 120', 'logos:chrome'],
    ['Microsoft Edge', 'logos:microsoft-edge'],
    ['Firefox 115', 'logos:firefox'],
    ['Opera GX', 'logos:opera'],
    ['Safari 17', 'logos:safari'],
    ['MicroMessenger', 'ic:baseline-wechat'],
    ['WindowsWechat', 'ic:baseline-wechat'],
    ['QQ Browser', 'simple-icons:tencentqq'],
    ['DingTalk', 'arcticons:dingtalk'],
    ['UCBrowser', 'arcticons:uc-browser'],
    ['Quark', 'arcticons:quark-browser'],
    ['Baidu Browser', 'ri:baidu-fill'],
  ])('Given 浏览器 "%s", When getBrowserIcon, Then 返回正确图标', (browser, expected) => {
    expect(getBrowserIcon(browser)).toBe(expected);
  });

  it('Given 未知浏览器, When getBrowserIcon, Then 返回默认图标', () => {
    expect(getBrowserIcon('UnknownBrowser')).toBe('stash:browser-light');
  });
});

describe('getOsIcon', () => {
  it.each([
    ['Windows 11', 'devicon:windows8'],
    ['OSX Monterey', 'cbi:imac'],
    ['Linux Ubuntu', 'devicon:linux'],
    ['Android 14', 'logos:android-icon'],
    ['iOS 17', 'file-icons:apple'],
  ])('Given 操作系统 "%s", When getOsIcon, Then 返回正确图标', (os, expected) => {
    expect(getOsIcon(os)).toBe(expected);
  });

  it('Given 未知操作系统, When getOsIcon, Then 返回默认图标', () => {
    expect(getOsIcon('ChromeOS')).toBe('mingcute:device-fill');
  });
});
