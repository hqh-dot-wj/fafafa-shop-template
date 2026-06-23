import { getErrorMessage, getErrorStack, getErrorInfo } from './error';

describe('getErrorMessage', () => {
  it('Given Error 实例, When getErrorMessage, Then 返回 error.message', () => {
    const error = new Error('something went wrong');
    expect(getErrorMessage(error)).toBe('something went wrong');
  });

  it('Given 带 message 属性的对象, When getErrorMessage, Then 返回 message 字符串', () => {
    const error = { message: 'custom error', code: 500 };
    expect(getErrorMessage(error)).toBe('custom error');
  });

  it('Given message 为 null 的对象, When getErrorMessage, Then 返回对象字符串', () => {
    const error = { message: null };
    expect(getErrorMessage(error)).toBe('[object Object]');
  });

  it('Given 字符串, When getErrorMessage, Then 返回该字符串', () => {
    expect(getErrorMessage('plain string error')).toBe('plain string error');
  });

  it('Given 数字, When getErrorMessage, Then 返回数字字符串', () => {
    expect(getErrorMessage(404)).toBe('404');
  });

  it('Given null, When getErrorMessage, Then 返回 "null"', () => {
    expect(getErrorMessage(null)).toBe('null');
  });

  it('Given undefined, When getErrorMessage, Then 返回 "undefined"', () => {
    expect(getErrorMessage(undefined)).toBe('undefined');
  });

  it('Given 空对象, When getErrorMessage, Then 返回对象字符串', () => {
    expect(getErrorMessage({})).toBe('[object Object]');
  });

  it('Given message 为数字的对象, When getErrorMessage, Then 返回数字字符串', () => {
    const error = { message: 42 };
    expect(getErrorMessage(error)).toBe('42');
  });
});

describe('getErrorStack', () => {
  it('Given Error 实例, When getErrorStack, Then 返回 stack 字符串', () => {
    const error = new Error('test');
    expect(getErrorStack(error)).toBeDefined();
    expect(typeof getErrorStack(error)).toBe('string');
    expect(getErrorStack(error)).toContain('Error: test');
  });

  it('Given 非 Error 对象, When getErrorStack, Then 返回 undefined', () => {
    expect(getErrorStack({ message: 'not an error' })).toBeUndefined();
  });

  it('Given 字符串, When getErrorStack, Then 返回 undefined', () => {
    expect(getErrorStack('string error')).toBeUndefined();
  });

  it('Given null, When getErrorStack, Then 返回 undefined', () => {
    expect(getErrorStack(null)).toBeUndefined();
  });
});

describe('getErrorInfo', () => {
  it('Given Error 实例, When getErrorInfo, Then 返回 message 和 stack', () => {
    const error = new Error('test error');
    const info = getErrorInfo(error);

    expect(info.message).toBe('test error');
    expect(info.stack).toBeDefined();
    expect(info.stack).toContain('Error: test error');
  });

  it('Given 非 Error 对象, When getErrorInfo, Then 返回 message 无 stack', () => {
    const info = getErrorInfo({ message: 'custom' });

    expect(info.message).toBe('custom');
    expect(info.stack).toBeUndefined();
  });

  it('Given 字符串, When getErrorInfo, Then 返回字符串作为 message', () => {
    const info = getErrorInfo('raw error');

    expect(info.message).toBe('raw error');
    expect(info.stack).toBeUndefined();
  });

  it('Given null, When getErrorInfo, Then 返回 "null" 作为 message', () => {
    const info = getErrorInfo(null);

    expect(info.message).toBe('null');
    expect(info.stack).toBeUndefined();
  });
});
