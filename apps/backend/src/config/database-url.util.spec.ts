import { assertValidPostgresDatabaseUrl, redactDatabaseUrl } from './database-url.util';

describe('database-url.util', () => {
  describe('assertValidPostgresDatabaseUrl', () => {
    it('accepts valid postgresql URL', () => {
      expect(() => assertValidPostgresDatabaseUrl('postgresql://user:secret@localhost:5432/mydb')).not.toThrow();
    });

    it('accepts valid postgres URL scheme', () => {
      expect(() => assertValidPostgresDatabaseUrl('postgres://user@db.example.com:5432/app_db')).not.toThrow();
    });

    it('rejects non-postgres scheme', () => {
      expect(() => assertValidPostgresDatabaseUrl('mysql://user:pass@localhost:3306/db')).toThrow(
        '数据库 URL 协议须为 postgres 或 postgresql',
      );
    });

    it('rejects missing host', () => {
      expect(() => assertValidPostgresDatabaseUrl('postgresql:///onlypath')).toThrow('数据库 URL 缺少主机名');
    });
  });

  describe('redactDatabaseUrl', () => {
    it('masks password while preserving host and path', () => {
      const out = redactDatabaseUrl('postgresql://appuser:mysecret@db.internal:5432/prod');
      expect(out).toContain('******');
      expect(out).not.toContain('mysecret');
      expect(out).toContain('db.internal');
      expect(out).toContain('/prod');
    });

    it('returns placeholder when parse fails', () => {
      expect(redactDatabaseUrl('not-a-url')).toBe('[invalid database url]');
    });

    it('redacts password containing special characters (percent-encoded in URL)', () => {
      const raw = 'postgresql://u:p%40%3Ax%25@h:5432/d';
      const out = redactDatabaseUrl(raw);
      expect(out).toContain('******');
      expect(out).not.toContain('p@');
      expect(out).not.toContain('p%40');
    });
  });
});
