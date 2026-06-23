import { describe, expect, it } from 'vitest';
import { formatPrice, Money, splitMoneyParts, sumMoney, sumMoneyByQuantity } from './money';

describe('miniapp money utilities', () => {
  it('adds 0.1 and 0.2 as an exact display amount', () => {
    expect(new Money(0.1).add(0.2).format()).toBe('0.30');
  });

  it('calculates cart selected total by quantity without floating point drift', () => {
    const total = sumMoneyByQuantity(
      [
        { currentPrice: 0.1, quantity: 3 },
        { currentPrice: 0.2, quantity: 1 },
      ],
      (item) => item.currentPrice,
      (item) => item.quantity,
    );

    expect(total.format()).toBe('0.50');
    expect(total.toNumber()).toBe(0.5);
  });

  it('keeps coupon and points deductions in Decimal before display', () => {
    const payable = new Money('39.90').sub('5.20').sub('0.30');

    expect(payable.format()).toBe('34.40');
  });

  it('detects profit loss while preserving break-even cents', () => {
    const breakEvenProfit = new Money('0.30').sub('0.20').sub(new Money('0.30').mul('0.33333333333333333333'));
    const lossProfit = new Money('9.90').sub('9.91').sub(0);

    expect(breakEvenProfit.isNegative()).toBe(false);
    expect(lossProfit.isNegative()).toBe(true);
  });

  it('summarizes batch amounts and splits formatted money parts', () => {
    const total = sumMoney(['19.90', '0.10', '0.20', '0.30']);

    expect(formatPrice(total.toDecimal())).toBe('20.50');
    expect(splitMoneyParts(total.toDecimal())).toEqual({ int: '20', dec: '50' });
  });
});
