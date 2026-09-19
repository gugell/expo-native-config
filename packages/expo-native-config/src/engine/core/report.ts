const PREFIX = '[expo-native-config]';

export function reportChange(label: string, file: string): void {
  console.log(`${PREFIX} ${label} → ${file}`);
}

export function reportSkip(label: string, file: string): void {
  console.log(`${PREFIX} ${label} (unchanged) → ${file}`);
}

export function reportInfo(message: string): void {
  console.log(`${PREFIX} ${message}`);
}

export function reportWarning(message: string): void {
  console.warn(`${PREFIX} warning: ${message}`);
}
