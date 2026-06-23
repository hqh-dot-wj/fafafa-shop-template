import { describe, expect, it } from 'vitest';
import {
  arraysEqualSet,
  formatDateTime,
  formatFileSize,
  getFileExtension,
  getFileIcon,
  humpToLine,
  toggleHtmlClass,
  transformRecordToNumberOption,
  transformRecordToOption,
  transformToURLSearchParams,
} from './common';

describe('transformRecordToOption', () => {
  it('Given record 有多个键值对, When transformRecordToOption, Then 返回对应 option 数组', () => {
    const record = { key1: 'label1', key2: 'label2' };
    const options = transformRecordToOption(record);
    expect(options).toHaveLength(2);
    expect(options[0]).toEqual({ value: 'key1', label: 'label1' });
    expect(options[1]).toEqual({ value: 'key2', label: 'label2' });
  });

  it('Given 空 record, When transformRecordToOption, Then 返回空数组', () => {
    expect(transformRecordToOption({})).toEqual([]);
  });

  it('Given 单个键值对, When transformRecordToOption, Then 返回单元素数组', () => {
    const options = transformRecordToOption({ only: 'one' });
    expect(options).toEqual([{ value: 'only', label: 'one' }]);
  });
});

describe('transformRecordToNumberOption', () => {
  it('Given record, When transformRecordToNumberOption, Then 返回 option 数组', () => {
    const record = { '1': '选项一', '2': '选项二' };
    const options = transformRecordToNumberOption(record);
    expect(options).toHaveLength(2);
    expect(options[0]).toEqual({ value: '1', label: '选项一' });
  });
});

describe('humpToLine', () => {
  it('Given camelCase, When humpToLine, Then 转为 kebab-case', () => {
    expect(humpToLine('userName')).toBe('user-name');
    expect(humpToLine('roleKey')).toBe('role-key');
  });

  it('Given 自定义分隔符, When humpToLine, Then 使用自定义分隔符', () => {
    expect(humpToLine('userName', '_')).toBe('user_name');
  });

  it('Given 首字母大写, When humpToLine, Then 正确处理', () => {
    expect(humpToLine('UserName')).toBe('user-name');
  });

  it('Given 全小写, When humpToLine, Then 原样返回', () => {
    expect(humpToLine('username')).toBe('username');
  });

  it('Given 连续大写, When humpToLine, Then 每个大写字母前加分隔符', () => {
    expect(humpToLine('XMLParser')).toBe('x-m-l-parser');
  });

  it('Given 空字符串, When humpToLine, Then 返回空字符串', () => {
    expect(humpToLine('')).toBe('');
  });
});

describe('toggleHtmlClass', () => {
  it('Given className, When add, Then documentElement 包含该 class', () => {
    const { add, remove } = toggleHtmlClass('test-class');
    add();
    expect(document.documentElement.classList.contains('test-class')).toBe(true);
    remove();
    expect(document.documentElement.classList.contains('test-class')).toBe(false);
  });

  it('Given 重复 add, When add 两次, Then 不会重复添加', () => {
    const { add, remove } = toggleHtmlClass('dup-class');
    add();
    add();
    expect(document.documentElement.classList.length).toBeGreaterThanOrEqual(1);
    remove();
  });
});

describe('formatFileSize', () => {
  it('Given 0 bytes, When formatFileSize, Then 返回 "0 B"', () => {
    expect(formatFileSize(0)).toBe('0 B');
  });

  it('Given 小于 1KB, When formatFileSize, Then 返回 B 单位', () => {
    expect(formatFileSize(500)).toBe('500 B');
  });

  it('Given 1024 bytes, When formatFileSize, Then 返回 1 KB', () => {
    expect(formatFileSize(1024)).toBe('1 KB');
  });

  it('Given 1MB, When formatFileSize, Then 返回 1 MB', () => {
    expect(formatFileSize(1024 * 1024)).toBe('1 MB');
  });

  it('Given 1.5GB, When formatFileSize, Then 返回 1.5 GB', () => {
    expect(formatFileSize(1.5 * 1024 * 1024 * 1024)).toBe('1.5 GB');
  });

  it('Given 1TB, When formatFileSize, Then 返回 1 TB', () => {
    expect(formatFileSize(1024 ** 4)).toBe('1 TB');
  });
});

describe('formatDateTime', () => {
  it('Given 有效日期字符串, When formatDateTime, Then 返回格式化字符串', () => {
    const result = formatDateTime('2026-01-15T10:30:45');
    expect(result).toBe('2026-01-15 10:30:45');
  });

  it('Given Date 对象, When formatDateTime, Then 返回格式化字符串', () => {
    const date = new Date(2026, 0, 15, 10, 30, 45);
    const result = formatDateTime(date);
    expect(result).toBe('2026-01-15 10:30:45');
  });

  it('Given 自定义格式, When formatDateTime, Then 使用自定义格式', () => {
    const result = formatDateTime('2026-03-01T08:05:09', 'YYYY/MM/DD');
    expect(result).toBe('2026/03/01');
  });

  it('Given null, When formatDateTime, Then 返回空字符串', () => {
    expect(formatDateTime(null)).toBe('');
  });

  it('Given undefined, When formatDateTime, Then 返回空字符串', () => {
    expect(formatDateTime(undefined)).toBe('');
  });

  it('Given 无效日期字符串, When formatDateTime, Then 返回空字符串', () => {
    expect(formatDateTime('not-a-date')).toBe('');
  });

  it('Given 空字符串, When formatDateTime, Then 返回空字符串', () => {
    expect(formatDateTime('')).toBe('');
  });
});

describe('getFileExtension', () => {
  it('Given 正常文件名, When getFileExtension, Then 返回小写扩展名', () => {
    expect(getFileExtension('photo.JPG')).toBe('jpg');
    expect(getFileExtension('document.pdf')).toBe('pdf');
  });

  it('Given 多个点的文件名, When getFileExtension, Then 返回最后一个扩展名', () => {
    expect(getFileExtension('archive.tar.gz')).toBe('gz');
  });

  it('Given 无扩展名, When getFileExtension, Then 返回空字符串', () => {
    expect(getFileExtension('README')).toBe('');
  });

  it('Given 空字符串, When getFileExtension, Then 返回空字符串', () => {
    expect(getFileExtension('')).toBe('');
  });

  it('Given 以点开头的隐藏文件, When getFileExtension, Then 返回扩展名', () => {
    expect(getFileExtension('.gitignore')).toBe('gitignore');
  });
});

describe('getFileIcon', () => {
  it.each([
    ['jpg', 'ant-design:file-image-outlined'],
    ['png', 'ant-design:file-image-outlined'],
    ['svg', 'ant-design:file-image-outlined'],
    ['mp4', 'ant-design:video-camera-outlined'],
    ['mp3', 'ant-design:audio-outlined'],
    ['pdf', 'ant-design:file-text-outlined'],
    ['doc', 'ant-design:file-text-outlined'],
    ['zip', 'ant-design:file-zip-outlined'],
    ['rar', 'ant-design:file-zip-outlined'],
    ['ts', 'ant-design:file-outlined'],
    ['vue', 'ant-design:file-outlined'],
  ])('Given 扩展名 "%s", When getFileIcon, Then 返回 "%s"', (ext, expected) => {
    expect(getFileIcon(ext)).toBe(expected);
  });

  it('Given 未知扩展名, When getFileIcon, Then 返回默认图标', () => {
    expect(getFileIcon('xyz')).toBe('ant-design:file-unknown-outlined');
  });
});

describe('arraysEqualSet', () => {
  it('Given 相同元素不同顺序, When arraysEqualSet, Then 返回 true', () => {
    expect(arraysEqualSet([1, 2, 3], [3, 2, 1])).toBe(true);
  });

  it('Given 完全相同数组, When arraysEqualSet, Then 返回 true', () => {
    expect(arraysEqualSet([1, 2], [1, 2])).toBe(true);
  });

  it('Given 长度不同, When arraysEqualSet, Then 返回 false', () => {
    expect(arraysEqualSet([1, 2], [1, 2, 3])).toBe(false);
  });

  it('Given 空数组, When arraysEqualSet, Then 返回 true', () => {
    expect(arraysEqualSet([], [])).toBe(true);
  });

  it('Given 有重复元素, When arraysEqualSet, Then 返回 false', () => {
    expect(arraysEqualSet([1, 1, 2], [1, 2, 2])).toBe(false);
  });

  it('Given 字符串数组, When arraysEqualSet, Then 正确比较', () => {
    expect(arraysEqualSet(['a', 'b'], ['b', 'a'])).toBe(true);
  });
});

describe('transformToURLSearchParams', () => {
  it('Given 简单对象, When transformToURLSearchParams, Then 返回正确的 URLSearchParams', () => {
    const params = transformToURLSearchParams({ name: 'test', age: 25 });
    expect(params.get('name')).toBe('test');
    expect(params.get('age')).toBe('25');
  });

  it('Given 含 null/undefined 值, When transformToURLSearchParams, Then 跳过空值', () => {
    const params = transformToURLSearchParams({ name: 'test', empty: null, undef: undefined });
    expect(params.get('name')).toBe('test');
    expect(params.has('empty')).toBe(false);
    expect(params.has('undef')).toBe(false);
  });

  it('Given excludeKeys, When transformToURLSearchParams, Then 排除指定键', () => {
    const params = transformToURLSearchParams({ name: 'test', secret: '123' }, ['secret']);
    expect(params.get('name')).toBe('test');
    expect(params.has('secret')).toBe(false);
  });

  it('Given 嵌套对象, When transformToURLSearchParams, Then 展开为嵌套键', () => {
    const params = transformToURLSearchParams({ filter: { status: 'active' } });
    expect(params.get('filter[status]')).toBe('active');
  });

  it('Given null 输入, When transformToURLSearchParams, Then 返回空 URLSearchParams', () => {
    const params = transformToURLSearchParams(null as any);
    expect([...params.entries()]).toHaveLength(0);
  });
});
