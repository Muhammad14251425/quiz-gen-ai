import { en, type Strings } from './en';

const locales: Record<string, Strings> = { en };
let current: Strings = en;

export function setLocale(code: string) {
  current = locales[code] ?? en;
}

type Leaves<T, P extends string = ''> = {
  [K in keyof T & string]: T[K] extends string
    ? `${P}${K}`
    : T[K] extends readonly unknown[]
      ? never
      : T[K] extends object
        ? Leaves<T[K], `${P}${K}.`>
        : never;
}[keyof T & string];

export type StringKey = Leaves<Strings>;

/** Looks up a dotted key and fills {placeholders}. */
export function t(key: StringKey, params?: Record<string, string | number>): string {
  let value: unknown = current;
  for (const part of key.split('.')) value = (value as Record<string, unknown>)?.[part];
  let s = typeof value === 'string' ? value : key;
  if (params) for (const [k, v] of Object.entries(params)) s = s.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v));
  return s;
}

/** Non-string entries (e.g. lists of steps). */
export function strings(): Strings {
  return current;
}
