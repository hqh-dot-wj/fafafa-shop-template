import { BusinessException } from 'src/common/exceptions';
import { minutesToMillis } from './duration.util';

describe('minutesToMillis', () => {
  it('converts positive minutes to milliseconds', () => {
    expect(minutesToMillis(30)).toBe(30 * 60 * 1000);
  });

  it('floors decimal minutes before conversion', () => {
    expect(minutesToMillis(1.8)).toBe(60 * 1000);
  });

  it.each([0, -1, Number.NaN, Number.POSITIVE_INFINITY])('rejects invalid minutes: %s', (minutes) => {
    expect(() => minutesToMillis(minutes)).toThrow(BusinessException);
  });
});
