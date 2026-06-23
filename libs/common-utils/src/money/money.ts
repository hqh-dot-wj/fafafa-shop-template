import Decimal from 'decimal.js';

export type DecimalLike = { toString(): string };
export type MoneyInput = Decimal.Value | DecimalLike;

function toDecimal(input: MoneyInput): Decimal {
  if (input instanceof Decimal) return new Decimal(input);

  if (typeof input === 'number') {
    return new Decimal(input.toString());
  }

  if (typeof input === 'object' && input !== null) {
    return new Decimal(input.toString());
  }

  return new Decimal(input);
}

export class Money {
  private readonly value: Decimal;

  constructor(input: MoneyInput) {
    this.value = toDecimal(input);
    if (!this.value.isFinite()) {
      throw new Error(`Invalid money input: ${String(input)}`);
    }
  }

  static of(input: MoneyInput): Money {
    return new Money(input);
  }

  add(other: MoneyInput): Money {
    return new Money(this.value.plus(toDecimal(other)));
  }

  sub(other: MoneyInput): Money {
    return new Money(this.value.minus(toDecimal(other)));
  }

  mul(other: MoneyInput): Money {
    return new Money(this.value.times(toDecimal(other)));
  }

  div(other: MoneyInput): Money {
    return new Money(this.value.div(toDecimal(other)));
  }

  round(decimalPlaces = 2, rounding = Decimal.ROUND_HALF_UP): Money {
    return new Money(this.value.toDecimalPlaces(decimalPlaces, rounding));
  }

  eq(other: MoneyInput): boolean {
    return this.value.eq(toDecimal(other));
  }

  lt(other: MoneyInput): boolean {
    return this.value.lt(toDecimal(other));
  }

  lte(other: MoneyInput): boolean {
    return this.value.lte(toDecimal(other));
  }

  gt(other: MoneyInput): boolean {
    return this.value.gt(toDecimal(other));
  }

  gte(other: MoneyInput): boolean {
    return this.value.gte(toDecimal(other));
  }

  toDecimal(): Decimal {
    return new Decimal(this.value);
  }

  toAmount(decimalPlaces = 2, rounding = Decimal.ROUND_HALF_UP): string {
    return this.value.toDecimalPlaces(decimalPlaces, rounding).toFixed(decimalPlaces);
  }

  format(decimalPlaces = 2, rounding = Decimal.ROUND_HALF_UP): string {
    return this.toAmount(decimalPlaces, rounding);
  }

  toNumber(decimalPlaces = 2, rounding = Decimal.ROUND_HALF_UP): number {
    return Number(this.toAmount(decimalPlaces, rounding));
  }

  toString(): string {
    return this.value.toString();
  }

  toFen(): number {
    if (this.value.lt(0)) {
      throw new Error(`Money.toFen does not accept negative amount: ${this.value.toString()}`);
    }

    const fen = this.value.times(100);
    if (!fen.isInteger()) {
      throw new Error(`Money.toFen requires integer cents: ${this.value.toString()}`);
    }
    if (fen.gt(Number.MAX_SAFE_INTEGER)) {
      throw new Error(`Money.toFen exceeds safe integer cents: ${fen.toString()}`);
    }

    return fen.toNumber();
  }
}

export function money(input: MoneyInput): Money {
  return new Money(input);
}

export function sumMoney(values: Iterable<MoneyInput>): Money {
  let total = new Money(0);
  for (const value of values) {
    total = total.add(value);
  }
  return total;
}

export function formatMoney(input: MoneyInput, decimalPlaces = 2, rounding = Decimal.ROUND_HALF_UP): string {
  return new Money(input).format(decimalPlaces, rounding);
}

export function toFen(input: MoneyInput): number {
  return new Money(input).toFen();
}

export function splitByRatio(
  total: MoneyInput,
  ratio: MoneyInput,
  decimalPlaces = 2,
  rounding = Decimal.ROUND_HALF_UP,
): { first: Money; second: Money } {
  const base = new Money(total);
  const first = base.mul(ratio).round(decimalPlaces, rounding);
  return {
    first,
    second: base.sub(first.toDecimal()),
  };
}
