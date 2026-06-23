import Decimal from 'decimal.js';

export type MoneyInput = Decimal.Value | null | undefined;

function createDecimal(input: MoneyInput): Decimal {
  try {
    if (input === null || input === undefined) return new Decimal(0);
    if (typeof input === 'string') {
      const trimmed = input.trim();
      return trimmed ? new Decimal(trimmed) : new Decimal(0);
    }
    return new Decimal(input);
  } catch {
    return new Decimal(0);
  }
}

export class Money {
  private readonly value: Decimal;

  constructor(input: MoneyInput = 0) {
    this.value = createDecimal(input);
  }

  private static toDecimal(input: MoneyInput | Money): Decimal {
    return input instanceof Money ? input.value : createDecimal(input);
  }

  add(other: MoneyInput | Money): Money {
    return new Money(this.value.plus(Money.toDecimal(other)));
  }

  sub(other: MoneyInput | Money): Money {
    return new Money(this.value.minus(Money.toDecimal(other)));
  }

  mul(other: MoneyInput | Money): Money {
    return new Money(this.value.times(Money.toDecimal(other)));
  }

  div(other: MoneyInput | Money): Money {
    return new Money(this.value.div(Money.toDecimal(other)));
  }

  isNegative(): boolean {
    return this.value.lt(0);
  }

  isPositive(): boolean {
    return this.value.gt(0);
  }

  gte(other: MoneyInput | Money): boolean {
    return this.value.gte(Money.toDecimal(other));
  }

  lte(other: MoneyInput | Money): boolean {
    return this.value.lte(Money.toDecimal(other));
  }

  toDecimal(): Decimal {
    return this.value;
  }

  format(): string {
    return this.value.toFixed(2, Decimal.ROUND_HALF_UP);
  }

  toNumber(): number {
    return Number(this.format());
  }
}

export function sumMoney(values: MoneyInput[]): Money {
  return values.reduce<Money>((acc, value) => acc.add(value), new Money(0));
}

export function sumMoneyByQuantity<T>(
  items: T[],
  getAmount: (item: T) => MoneyInput,
  getQuantity: (item: T) => number,
): Money {
  return items.reduce<Money>((acc, item) => acc.add(new Money(getAmount(item)).mul(getQuantity(item))), new Money(0));
}

export function formatPrice(value: MoneyInput): string {
  return new Money(value).format();
}
