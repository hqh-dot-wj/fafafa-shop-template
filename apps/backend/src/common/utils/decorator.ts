import { get } from 'lodash';

type DecoratorArgPrimitive = string | number | boolean | null | undefined;
export type DecoratorArgValue = DecoratorArgPrimitive | object;
type DecoratorArgObject = Record<string, DecoratorArgValue>;
type DecoratorMethod<TArgs extends DecoratorArgValue[], TReturn = void> = (...args: TArgs) => TReturn;

function getArgs<TArgs extends DecoratorArgValue[], TReturn>(func: DecoratorMethod<TArgs, TReturn>) {
  const funcString = func.toString();
  return funcString.slice(funcString.indexOf('(') + 1, funcString.indexOf(')')).match(/([^\s,]+)/g);
}

const stringFormat = (str: string, callback: (key: string) => string): string => {
  return str.replace(/\{([^}]+)\}/g, (word, key) => callback(key));
};

export function paramsKeyFormat<TArgs extends DecoratorArgValue[], TReturn>(
  func: DecoratorMethod<TArgs, TReturn>,
  formatKey: string,
  args: TArgs,
): string | null {
  const originMethodArgs = getArgs(func);

  const paramsMap: Record<string, DecoratorArgValue> = {};

  originMethodArgs?.forEach((arg: string, index: number) => {
    paramsMap[arg] = args[index];
  });

  let isNotGet = false;
  const key = stringFormat(formatKey, (key) => {
    const str = get(paramsMap, key) as DecoratorArgValue | undefined;
    if (!str) isNotGet = true;
    return String(str ?? '');
  });

  if (isNotGet) {
    return null;
  }

  return key;
}

export function paramsKeyGetObj<TArgs extends DecoratorArgValue[], TReturn>(
  func: DecoratorMethod<TArgs, TReturn>,
  formatKey: string | undefined,
  args: TArgs,
): DecoratorArgObject | null {
  const originMethodArgs = getArgs(func);

  const paramsMap: Record<string, DecoratorArgValue> = {};

  originMethodArgs?.forEach((arg: string, index: number) => {
    paramsMap[arg] = args[index];
  });

  const obj = get(paramsMap, formatKey) as DecoratorArgValue | undefined;

  if (obj && typeof obj === 'object' && !Array.isArray(obj)) {
    return obj as DecoratorArgObject;
  }

  if (args[0] && typeof args[0] === 'object' && !Array.isArray(args[0])) {
    return args[0] as DecoratorArgObject;
  }

  return null;
}
