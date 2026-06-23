import { REG_USER_NAME, REG_PHONE, REG_PWD, REG_EMAIL, REG_CODE_SIX, REG_CODE_FOUR, REG_URL } from './regex';

describe('REG_USER_NAME', () => {
  it.each(['张三丰abc', 'user_name', 'test-user', '用户1234', 'abcd', '1234567890123456'])(
    'Given 合法用户名 "%s", When test, Then 通过',
    (name) => {
      expect(REG_USER_NAME.test(name)).toBe(true);
    },
  );

  it.each([
    'abc', // 少于4位
    'a'.repeat(17), // 超过16位
    'user name', // 含空格
    'user@name', // 含特殊字符
    '', // 空字符串
  ])('Given 非法用户名 "%s", When test, Then 不通过', (name) => {
    expect(REG_USER_NAME.test(name)).toBe(false);
  });
});

describe('REG_PHONE', () => {
  it.each(['13800138000', '15912345678', '18600001111', '17700009999', '19900008888'])(
    'Given 合法手机号 "%s", When test, Then 通过',
    (phone) => {
      expect(REG_PHONE.test(phone)).toBe(true);
    },
  );

  it.each([
    '12345678901', // 12开头
    '1380013800', // 10位
    '138001380001', // 12位
    '23800138000', // 非1开头
    'abcdefghijk', // 非数字
    '', // 空字符串
  ])('Given 非法手机号 "%s", When test, Then 不通过', (phone) => {
    expect(REG_PHONE.test(phone)).toBe(false);
  });
});

describe('REG_PWD', () => {
  it.each([
    'abc123', // 字母+数字
    'abc!@#', // 字母+特殊字符
    '123!@#', // 数字+特殊字符
    'Abc123!@', // 三种都有
    'Abc123!@#$%^789012', // 18位
  ])('Given 合法密码 "%s", When test, Then 通过', (pwd) => {
    expect(REG_PWD.test(pwd)).toBe(true);
  });

  it.each([
    'abcde', // 少于6位
    'abcdef', // 仅字母
    '123456', // 仅数字
    '!@#$%^', // 仅特殊字符
    'a'.repeat(19), // 超过18位
  ])('Given 非法密码 "%s", When test, Then 不通过', (pwd) => {
    expect(REG_PWD.test(pwd)).toBe(false);
  });
});

describe('REG_EMAIL', () => {
  it.each(['test@example.com', 'user.name@domain.co', 'user+tag@sub.domain.com', 'a@b.cc'])(
    'Given 合法邮箱 "%s", When test, Then 通过',
    (email) => {
      expect(REG_EMAIL.test(email)).toBe(true);
    },
  );

  it.each(['plainaddress', '@no-local.com', 'no-at-sign', ''])(
    'Given 非法邮箱 "%s", When test, Then 不通过',
    (email) => {
      expect(REG_EMAIL.test(email)).toBe(false);
    },
  );
});

describe('REG_CODE_SIX', () => {
  it.each(['123456', '000000', '999999'])('Given 合法6位验证码 "%s", When test, Then 通过', (code) => {
    expect(REG_CODE_SIX.test(code)).toBe(true);
  });

  it.each(['12345', '1234567', 'abcdef', '12 345', ''])('Given 非法6位验证码 "%s", When test, Then 不通过', (code) => {
    expect(REG_CODE_SIX.test(code)).toBe(false);
  });
});

describe('REG_CODE_FOUR', () => {
  it.each(['1234', '0000', '9999'])('Given 合法4位验证码 "%s", When test, Then 通过', (code) => {
    expect(REG_CODE_FOUR.test(code)).toBe(true);
  });

  it.each(['123', '12345', 'abcd', ''])('Given 非法4位验证码 "%s", When test, Then 不通过', (code) => {
    expect(REG_CODE_FOUR.test(code)).toBe(false);
  });
});

describe('REG_URL', () => {
  it.each([
    'https://example.com',
    'http://example.com/path',
    'https://sub.domain.com/path?q=1#hash',
    'http://localhost:3000',
  ])('Given 合法URL "%s", When test, Then 通过', (url) => {
    expect(REG_URL.test(url)).toBe(true);
  });

  it.each(['not-a-url', 'ftp://example.com', ''])('Given 非法URL "%s", When test, Then 不通过', (url) => {
    expect(REG_URL.test(url)).toBe(false);
  });
});
