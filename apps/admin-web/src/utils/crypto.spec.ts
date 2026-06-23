import { describe, expect, it } from 'vitest';
import CryptoJS from 'crypto-js';
import { decryptBase64, decryptWithAes, encryptBase64, encryptWithAes, generateAesKey } from './crypto';

describe('crypto utils', () => {
  describe('generateAesKey', () => {
    it('Given 调用, When generateAesKey, Then 返回 WordArray', () => {
      const key = generateAesKey();
      expect(key).toBeDefined();
      expect(key.sigBytes).toBe(32);
    });

    it('Given 多次调用, When generateAesKey, Then 每次返回不同的 key', () => {
      const key1 = generateAesKey();
      const key2 = generateAesKey();
      expect(key1.toString()).not.toBe(key2.toString());
    });
  });

  describe('encryptBase64 / decryptBase64', () => {
    it('Given WordArray, When encryptBase64 then decryptBase64, Then 还原', () => {
      const original = CryptoJS.enc.Utf8.parse('hello world');
      const encoded = encryptBase64(original);
      const decoded = decryptBase64(encoded);

      expect(decoded.toString(CryptoJS.enc.Utf8)).toBe('hello world');
    });

    it('Given 空字符串, When encryptBase64, Then 返回空 base64', () => {
      const empty = CryptoJS.enc.Utf8.parse('');
      const encoded = encryptBase64(empty);
      expect(typeof encoded).toBe('string');
    });
  });

  describe('encryptWithAes / decryptWithAes', () => {
    it('Given 明文和密钥, When 加密后解密, Then 还原明文', () => {
      const key = generateAesKey();
      const plaintext = '这是一段测试文本 123';

      const encrypted = encryptWithAes(plaintext, key);
      const decrypted = decryptWithAes(encrypted, key);

      expect(decrypted).toBe(plaintext);
    });

    it('Given 同一明文加密两次, When encryptWithAes, Then 密文不同(随机IV)', () => {
      const key = generateAesKey();
      const plaintext = 'same message';

      const encrypted1 = encryptWithAes(plaintext, key);
      const encrypted2 = encryptWithAes(plaintext, key);

      expect(encrypted1).not.toBe(encrypted2);
    });

    it('Given 错误密钥, When decryptWithAes, Then 解密结果不等于原文或抛出异常', () => {
      const key1 = generateAesKey();
      const key2 = generateAesKey();
      const plaintext = 'secret data';

      const encrypted = encryptWithAes(plaintext, key1);

      // 用错误密钥解密：CryptoJS 可能返回乱码或抛出异常，两种情况都说明解密失败
      let decrypted: string | undefined;
      try {
        decrypted = decryptWithAes(encrypted, key2);
      } catch {
        // 抛出异常也是预期行为
        decrypted = undefined;
      }

      expect(decrypted).not.toBe(plaintext);
    });

    it('Given 长文本, When 加密后解密, Then 正确还原', () => {
      const key = generateAesKey();
      const longText = '测试'.repeat(1000);

      const encrypted = encryptWithAes(longText, key);
      const decrypted = decryptWithAes(encrypted, key);

      expect(decrypted).toBe(longText);
    });

    it('Given 特殊字符, When 加密后解密, Then 正确还原', () => {
      const key = generateAesKey();
      const special = '!@#$%^&*()_+-=[]{}|;:,.<>?/~`"\'\\';

      const encrypted = encryptWithAes(special, key);
      const decrypted = decryptWithAes(encrypted, key);

      expect(decrypted).toBe(special);
    });
  });
});
