const POSTGRES_PROTOCOLS = new Set(['postgres:', 'postgresql:']);

export function assertValidPostgresDatabaseUrl(url: string): void {
  const trimmed = url.trim();
  if (!trimmed) {
    throw new Error('数据库 URL 不能为空');
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new Error('数据库 URL 格式无效');
  }

  if (!POSTGRES_PROTOCOLS.has(parsed.protocol)) {
    throw new Error('数据库 URL 协议须为 postgres 或 postgresql');
  }

  if (!parsed.hostname) {
    throw new Error('数据库 URL 缺少主机名');
  }

  const databaseName = parsed.pathname.replace(/^\/+/, '').split('/')[0] ?? '';
  if (!databaseName) {
    throw new Error('数据库 URL 缺少库名');
  }
}

export function redactDatabaseUrl(url: string): string {
  try {
    const parsed = new URL(url);
    if (parsed.password !== '') {
      parsed.password = '******';
    }
    return parsed.toString();
  } catch {
    return '[invalid database url]';
  }
}
