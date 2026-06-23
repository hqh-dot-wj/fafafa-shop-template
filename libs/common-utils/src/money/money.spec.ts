import fc from 'fast-check';
import { formatMoney, Money, splitByRatio, sumMoney, toFen } from './money';

const centAmount = fc.integer({ min: -1_000_000, max: 1_000_000 }).map((cents) => (cents / 100).toFixed(2));
const positiveCentAmount = fc.integer({ min: 0, max: 1_000_000 }).map((cents) => (cents / 100).toFixed(2));

describe('Money', () => {
  describe('arithmetic properties', () => {
    it('Given cent amounts, When add then sub same value, Then original amount is preserved', () => {
      fc.assert(
        fc.property(centAmount, centAmount, (left, right) => {
          expect(new Money(left).add(right).sub(right).eq(left)).toBe(true);
        }),
      );
    });

    it('Given cent amounts, When sumMoney, Then result matches explicit Money addition', () => {
      fc.assert(
        fc.property(fc.array(centAmount, { minLength: 0, maxLength: 20 }), (values) => {
          const expected = values.reduce((sum, value) => sum.add(value), new Money(0));
          expect(sumMoney(values).eq(expected.toDecimal())).toBe(true);
        }),
      );
    });

    it('Given amount and non-zero factor, When multiply then divide, Then original amount is preserved', () => {
      fc.assert(
        fc.property(centAmount, fc.integer({ min: 1, max: 1000 }), (amount, factor) => {
          expect(new Money(amount).mul(factor).div(factor).eq(amount)).toBe(true);
        }),
      );
    });
  });

  describe('formatting', () => {
    it('Given amount with more than two decimals, When format, Then uses half-up cents', () => {
      expect(formatMoney('1.005')).toBe('1.01');
      expect(new Money('19.9').format()).toBe('19.90');
      expect(new Money('0').toAmount()).toBe('0.00');
    });

    it('Given invalid amount, When constructing Money, Then rejects non-finite values', () => {
      expect(() => new Money(Number.NaN)).toThrow('Invalid money input');
      expect(() => new Money(Number.POSITIVE_INFINITY)).toThrow('Invalid money input');
    });
  });

  describe('toFen', () => {
    it('Given valid yuan amounts, When toFen, Then returns integer cents', () => {
      expect(toFen('19.90')).toBe(1990);
      expect(new Money('0.01').toFen()).toBe(1);
      expect(new Money('0').toFen()).toBe(0);
    });

    it('Given generated cent amounts, When toFen, Then cents round-trip exactly', () => {
      fc.assert(
        fc.property(positiveCentAmount, (amount) => {
          const [yuan, cents] = amount.split('.');
          const expectedCents = Number(yuan) * 100 + Number(cents);
          expect(new Money(amount).toFen()).toBe(expectedCents);
        }),
      );
    });

    it('Given fractional cents or negative amounts, When toFen, Then rejects the value', () => {
      expect(() => toFen('0.001')).toThrow('integer cents');
      expect(() => toFen('19.905')).toThrow('integer cents');
      expect(() => toFen('-0.01')).toThrow('negative amount');
    });
  });

  describe('splitByRatio', () => {
    it('Given ratio split, When one side is rounded, Then total is conserved', () => {
      const result = splitByRatio('0.05', '0.5');

      expect(result.first.toAmount()).toBe('0.03');
      expect(result.second.toAmount()).toBe('0.02');
      expect(result.first.add(result.second.toDecimal()).eq('0.05')).toBe(true);
    });

    it('Given generated total and ratio, When splitByRatio, Then first plus second equals total', () => {
      fc.assert(
        fc.property(
          positiveCentAmount,
          fc.integer({ min: 0, max: 100 }).map((value) => value / 100),
          (total, ratio) => {
            const { first, second } = splitByRatio(total, ratio.toString());
            expect(first.add(second.toDecimal()).eq(total)).toBe(true);
          },
        ),
      );
    });
  });
});
