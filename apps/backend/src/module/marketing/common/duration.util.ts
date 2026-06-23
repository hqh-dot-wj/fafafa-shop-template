import { BusinessException } from 'src/common/exceptions';
import { ResponseCode } from 'src/common/response';

export function minutesToMillis(minutes: number): number {
  if (!Number.isFinite(minutes) || minutes <= 0) {
    throw new BusinessException(ResponseCode.PARAM_INVALID, `Invalid duration: ${minutes} minutes`);
  }

  return Math.floor(minutes) * 60 * 1000;
}
