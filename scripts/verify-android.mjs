import { existsSync, mkdtempSync, createWriteStream } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import spawn from 'cross-spawn';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sdk = process.env.ANDROID_HOME ?? process.env.ANDROID_SDK_ROOT;
if (!sdk || !existsSync(path.join(sdk, 'platforms'))) {
  console.error(
    'Android SDK not found. Set ANDROID_HOME (or ANDROID_SDK_ROOT) to an installed SDK containing platforms/.',
  );
  process.exit(1);
}
const java = process.env.JAVA_HOME
  ? path.join(process.env.JAVA_HOME, 'bin', process.platform === 'win32' ? 'java.exe' : 'java')
  : 'java';
const javaCheck = spawn.sync(java, ['-version'], { encoding: 'utf8' });
if (javaCheck.error || javaCheck.status !== 0) {
  console.error('Java is unavailable. Install JDK 17 or newer and set JAVA_HOME.');
  process.exit(1);
}
const project = path.join(root, 'apps/android-gradle/android');
const wrapper = path.join(project, process.platform === 'win32' ? 'gradlew.bat' : 'gradlew');
if (!existsSync(wrapper)) {
  console.error(
    'Android sample is not generated. Run pnpm --filter @expo-native-workspace/example-android-gradle prebuild --platform android --no-install first.',
  );
  process.exit(1);
}
const logPath = path.join(mkdtempSync(path.join(tmpdir(), 'expo-native-android-')), 'build.log');
const log = createWriteStream(logPath);
console.log(`Building Android debug APK. Gradle log: ${logPath}`);
const child = spawn(
  wrapper,
  [
    ':app:assembleDebug',
    `-PreactNativeArchitectures=${process.env.ANDROID_ARCHITECTURES ?? 'arm64-v8a'}`,
    '--no-daemon',
    '--console=plain',
  ],
  {
    cwd: project,
    env: { ...process.env, ANDROID_HOME: sdk, NODE_ENV: process.env.NODE_ENV ?? 'development' },
    stdio: ['ignore', 'pipe', 'pipe'],
  },
);
child.stdout.pipe(log, { end: false });
child.stderr.pipe(log, { end: false });
child.on('error', (error) => {
  console.error(`Cannot start Gradle: ${error.message}`);
});
child.on('close', (code) => {
  log.end();
  const apk = path.join(project, 'app/build/outputs/apk/debug/app-debug.apk');
  if (code !== 0 || !existsSync(apk)) {
    console.error(`Android build failed. Read ${logPath}`);
    process.exitCode = code || 1;
  } else console.log(`Android debug APK verified: ${apk}`);
});
