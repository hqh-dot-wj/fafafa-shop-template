import { BusinessException } from 'src/common/exceptions';
import { ResponseCode } from 'src/common/response';

export function normalizeClientPageQuery(
  pageNum: string | number | undefined,
  pageSize: string | number | undefined,
  options: { defaultPageNum?: number; defaultPageSize?: number; maxPageSize?: number } = {},
) {
  return {
    pageNum: normalizePositiveInteger(pageNum, options.defaultPageNum ?? 1, 'pageNum'),
    pageSize: normalizePositiveInteger(pageSize, options.defaultPageSize ?? 10, 'pageSize', options.maxPageSize ?? 100),
  };
}

function normalizePositiveInteger(value: string | number | undefined, fallback: number, field: string, max?: number) {
  if (value === undefined || value === null || value === '') return fallback;

  const parsed = typeof value === 'number' ? value : Number(value);
  BusinessException.throwIf(
    !Number.isInteger(parsed) || parsed <= 0,
    `${field} 必须为正整数`,
    ResponseCode.PARAM_INVALID,
  );
  BusinessException.throwIf(max !== undefined && parsed > max, `${field} 不能超过 ${max}`, ResponseCode.PARAM_INVALID);
  return parsed;
}
