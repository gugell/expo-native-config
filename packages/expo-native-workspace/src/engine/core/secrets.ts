import { ERR } from './validation';

export interface EnvRef {
  env: string;
}

export type SecretInput = string | EnvRef;

const SECRET_KEY = /password|secret|keyPassword|storePassword/i;

export function isEnvRef(value: unknown): value is EnvRef {
  return Boolean(value) && typeof value === 'object' && typeof (value as EnvRef).env === 'string';
}

export function parseSecretInput(value: unknown): SecretInput | undefined {
  if (value == null) {
    return undefined;
  }
  if (typeof value === 'string') {
    if (value.startsWith('env:')) {
      return { env: value.slice(4) };
    }
    return value;
  }
  if (isEnvRef(value)) {
    return value;
  }
  throw new Error(`${ERR} Secret field must be a string or { env: "VAR_NAME" }.`);
}

export function resolveSecret(value: unknown, label: string): string {
  const parsed = parseSecretInput(value);
  if (parsed == null) {
    return '';
  }
  if (isEnvRef(parsed)) {
    const resolved = process.env[parsed.env];
    if (!resolved) {
      throw new Error(`${ERR} ${label} references missing environment variable "${parsed.env}".`);
    }
    return resolved;
  }
  return parsed;
}

export function isLiteralSecret(value: unknown): boolean {
  const parsed = parseSecretInput(value);
  return typeof parsed === 'string' && parsed.length > 0;
}

export function redactValue(value: unknown): unknown {
  if (typeof value === 'string' && value.length > 0) {
    return '********';
  }
  if (isEnvRef(value)) {
    return { env: value.env };
  }
  return value;
}

export function redactDeep<T>(value: T): T {
  return redactWalk(value) as T;
}

function redactWalk(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(redactWalk);
  }
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
      out[key] = SECRET_KEY.test(key) ? redactValue(nested) : redactWalk(nested);
    }
    return out;
  }
  return value;
}
