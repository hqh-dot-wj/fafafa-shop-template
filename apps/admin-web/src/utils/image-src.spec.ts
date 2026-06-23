import { describe, expect, it } from 'vitest';
import { safeRemoteImageUrl } from './image-src';

describe('safeRemoteImageUrl', () => {
  it('Given 有效 HTTPS URL, When safeRemoteImageUrl, Then 返回原 URL', () => {
    expect(safeRemoteImageUrl('https://cdn.example.com/avatar.jpg')).toBe('https://cdn.example.com/avatar.jpg');
  });

  it('Given 有效 HTTP URL, When safeRemoteImageUrl, Then 返回原 URL', () => {
    expect(safeRemoteImageUrl('http://cdn.example.com/avatar.jpg')).toBe('http://cdn.example.com/avatar.jpg');
  });

  it('Given null, When safeRemoteImageUrl, Then 返回 undefined', () => {
    expect(safeRemoteImageUrl(null)).toBeUndefined();
  });

  it('Given undefined, When safeRemoteImageUrl, Then 返回 undefined', () => {
    expect(safeRemoteImageUrl(undefined)).toBeUndefined();
  });

  it('Given 空字符串, When safeRemoteImageUrl, Then 返回 undefined', () => {
    expect(safeRemoteImageUrl('')).toBeUndefined();
  });

  it('Given 仅空格, When safeRemoteImageUrl, Then 返回 undefined', () => {
    expect(safeRemoteImageUrl('   ')).toBeUndefined();
  });

  it('Given http://a.com 占位地址, When safeRemoteImageUrl, Then 返回 undefined', () => {
    expect(safeRemoteImageUrl('http://a.com/avatar.jpg')).toBeUndefined();
  });

  it('Given http://a.com 根路径, When safeRemoteImageUrl, Then 返回 undefined', () => {
    expect(safeRemoteImageUrl('http://a.com')).toBeUndefined();
  });

  it('Given http://a.com/ 带斜杠, When safeRemoteImageUrl, Then 返回 undefined', () => {
    expect(safeRemoteImageUrl('http://a.com/')).toBeUndefined();
  });

  it('Given https://a.com 占位地址, When safeRemoteImageUrl, Then 返回 undefined', () => {
    expect(safeRemoteImageUrl('https://a.com/test.png')).toBeUndefined();
  });

  it('Given 带前后空格的有效 URL, When safeRemoteImageUrl, Then 返回 trim 后的 URL', () => {
    expect(safeRemoteImageUrl('  https://cdn.example.com/img.png  ')).toBe('https://cdn.example.com/img.png');
  });

  it('Given 非字符串类型, When safeRemoteImageUrl, Then 返回 undefined', () => {
    expect(safeRemoteImageUrl(123 as any)).toBeUndefined();
  });
});
