import { Money, formatPrice, sumMoney, sumMoneyByQuantity } from './money';

describe('admin money utilities', () => {
  it('adds decimal amounts without floating point drift', () => {
    expect(new Money(0.1).add(0.2).format()).toBe('0.30');
  });

  it('keeps coupon and points deductions in Decimal before formatting', () => {
    const payable = new Money('19.90').sub('1.10').sub('0.20');

    expect(payable.format()).toBe('18.60');
  });

  it('does not mark exact zero profit as negative and still detects real loss', () => {
    const breakEvenProfit = new Money('0.30').sub('0.20').sub(new Money('0.30').mul('0.33333333333333333333'));
    const lossProfit = new Money('9.90').sub('9.91').sub(0);

    expect(breakEvenProfit.isNegative()).toBe(false);
    expect(formatPrice(breakEvenProfit.toDecimal())).toBe('0.00');
    expect(lossProfit.isNegative()).toBe(true);
  });

  it('summarizes batch amounts without Number reduce drift', () => {
    const total = sumMoney(['19.90', '0.10', '0.20', '0.30']);

    expect(total.format()).toBe('20.50');
  });

  it('summarizes line amounts by quantity for bulk rows', () => {
    const total = sumMoneyByQuantity(
      [
        { amount: '0.10', quantity: 3 },
        { amount: '19.90', quantity: 2 },
      ],
      (item) => item.amount,
      (item) => item.quantity,
    );

    expect(total.format()).toBe('40.10');
  });
});
