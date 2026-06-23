import { ImportExcelDto } from './dto';

export const STORE_PRODUCT_IMPORT_QUEUE = 'store-product-import';
export const STORE_PRODUCT_IMPORT_JOB = 'import-excel';

const parseIntegerEnv = (raw: string | undefined, fallback: number, min: number, max: number): number => {
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) return fallback;
  const normalized = Math.trunc(parsed);
  if (normalized < min) return min;
  if (normalized > max) return max;
  return normalized;
};

export const STORE_PRODUCT_IMPORT_WORKER_CONCURRENCY = parseIntegerEnv(
  process.env.ADMIN_STORE_PRODUCT_IMPORT_WORKER_CONCURRENCY,
  4,
  1,
  32,
);

export const STORE_PRODUCT_IMPORT_MAX_ROWS = parseIntegerEnv(
  process.env.ADMIN_STORE_PRODUCT_IMPORT_MAX_ROWS,
  500,
  1,
  5000,
);

export const STORE_PRODUCT_IMPORT_MAX_FILE_BASE64_CHARS = parseIntegerEnv(
  process.env.ADMIN_STORE_PRODUCT_IMPORT_MAX_FILE_BASE64_CHARS,
  12_000_000,
  2_048,
  50_000_000,
);

export const STORE_PRODUCT_IMPORT_QUEUE_BACKLOG_LIMIT = parseIntegerEnv(
  process.env.ADMIN_STORE_PRODUCT_IMPORT_QUEUE_BACKLOG_LIMIT,
  5_000,
  100,
  200_000,
);

export interface StoreProductImportJobPayload {
  tenantId: string;
  request: ImportExcelDto;
  queuedAt: string;
}

export interface StoreProductImportDoneResult {
  successCount: number;
  failCount: number;
  details: Array<{ rowNo: number; skuCode: string; success: boolean; reason?: string }>;
  finishedAt: string;
}
