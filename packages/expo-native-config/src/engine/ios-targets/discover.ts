import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import jiti from 'jiti';

/**
 * A target that describes itself, next to its own source.
 *
 * Declaring a target inline means the config knows the directory layout, which
 * is fine for one app and wrong for a package that ships a target to several.
 * A `target.config.js` beside the Swift travels with it.
 *
 * `expo-target.config.*` is accepted too: @bacons/apple-targets established the
 * convention, generateTarget already excludes that filename from the build, and
 * a project moving across should not have to rename files first.
 */
const CONFIG_NAMES = [
  'target.config.js',
  'target.config.cjs',
  'target.config.mjs',
  'target.config.json',
  'target.config.ts',
  'expo-target.config.js',
  'expo-target.config.cjs',
  'expo-target.config.mjs',
  'expo-target.config.json',
];

/**
 * Refuses a directory outside `workspaceRoot`, before anything in it is read.
 *
 * A `target.config.js` is executed, so the boundary has to be enforced here
 * rather than by the later validation pass: rejecting a path after running its
 * config is not a boundary at all. Symlinks are canonicalized first, since
 * following one is the obvious way out.
 */
export function assertInsideWorkspace(workspaceRoot: string, dir: string, label: string): void {
  const canonicalRoot = fs.realpathSync(workspaceRoot);
  const canonicalDir = fs.existsSync(dir) ? fs.realpathSync(dir) : path.resolve(dir);
  const relative = path.relative(canonicalRoot, canonicalDir);
  if (relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
    throw new Error(
      `${label} resolves to ${canonicalDir}, which is outside the workspace (${canonicalRoot}). Nothing there is read.`,
    );
  }
}

/** The config file in `dir`, or undefined when that directory does not describe a target. */
export function findTargetConfig(dir: string): string | undefined {
  for (const name of CONFIG_NAMES) {
    const candidate = path.join(dir, name);
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
      return candidate;
    }
  }
  return undefined;
}

/** Reads one target config. JSON is parsed; everything else is executed, as configs are. */
function readTargetConfig(file: string): Record<string, unknown> {
  if (file.endsWith('.json')) {
    return JSON.parse(fs.readFileSync(file, 'utf8')) as Record<string, unknown>;
  }
  const loader = jiti(__filename, { interopDefault: true, requireCache: false });
  const loaded = loader(file) as unknown;
  const value = typeof loaded === 'function' ? (loaded as () => unknown)() : loaded;
  if (!value || typeof value !== 'object') {
    throw new Error(`${file} must export an object`);
  }
  return value as Record<string, unknown>;
}

/**
 * The directory a package specifier points at, resolved the way the app's own
 * tooling resolves it — so a pnpm symlink, a yarn workspace and a bun hoist all
 * land on the real directory rather than needing three special cases.
 */
export function resolvePackageDir(projectRoot: string, specifier: string): string | undefined {
  const require_ = createRequire(path.join(projectRoot, 'package.json'));
  try {
    return path.dirname(fs.realpathSync(require_.resolve(`${specifier}/package.json`)));
  } catch {
    // A package without a package.json "exports" entry for ./package.json is
    // still resolvable through its main entry point.
    try {
      return path.dirname(fs.realpathSync(require_.resolve(specifier)));
    } catch {
      return undefined;
    }
  }
}

export interface DiscoveredTarget {
  /** Absolute directory holding the target's source and its config. */
  dir: string;
  /** The declaration read from `target.config.*`, plus the defaulted name. */
  spec: Record<string, unknown>;
  /** Where it came from, for diagnostics. */
  origin: string;
}

/**
 * Targets found under `targetsRoot`, each described by its own config file.
 *
 * A directory without a config file is not a target: inline `ios.targets`
 * entries keep pointing at plain source directories, and adding a config file
 * is what opts a directory into describing itself.
 */
export function discoverTargets(
  projectRoot: string,
  targetsRoot: string,
  workspaceRoot: string,
): DiscoveredTarget[] {
  const root = path.resolve(projectRoot, targetsRoot);
  if (!fs.existsSync(root) || !fs.statSync(root).isDirectory()) {
    return [];
  }
  const found: DiscoveredTarget[] = [];
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    if (!entry.isDirectory() && !entry.isSymbolicLink()) {
      continue;
    }
    const dir = path.join(root, entry.name);
    // A symlinked directory under targetsRoot is the quiet way out of the
    // workspace, so it is checked before its config is executed.
    assertInsideWorkspace(workspaceRoot, dir, path.relative(projectRoot, dir));
    const file = findTargetConfig(dir);
    if (!file) {
      continue;
    }
    found.push({
      dir,
      spec: { name: entry.name, ...readTargetConfig(file) },
      origin: path.relative(projectRoot, file),
    });
  }
  return found.sort((a, b) => a.dir.localeCompare(b.dir));
}

/** Reads the target a directory describes, for an `ios.targets` entry naming a path. */
export function readPathTarget(
  projectRoot: string,
  relative: string,
  workspaceRoot: string,
): { dir: string; spec: Record<string, unknown> } {
  const dir = path.resolve(projectRoot, relative);
  assertInsideWorkspace(workspaceRoot, dir, `Target path "${relative}"`);
  if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) {
    throw new Error(`Target directory not found: ${dir}`);
  }
  const file = findTargetConfig(dir);
  if (!file) {
    throw new Error(
      `${dir} has no target.config.js. Add one so the directory describes itself, or declare the target inline with a "source".`,
    );
  }
  return { dir, spec: { name: path.basename(dir), ...readTargetConfig(file) } };
}

/** Reads the target a package ships, for an `ios.targets` entry that names one. */
export function readPackageTarget(
  projectRoot: string,
  specifier: string,
  workspaceRoot: string,
): { dir: string; spec: Record<string, unknown> } {
  const dir = resolvePackageDir(projectRoot, specifier);
  if (!dir) {
    throw new Error(
      `Cannot resolve package "${specifier}" from ${projectRoot}. Add it as a dependency of this app so the package manager links it.`,
    );
  }
  assertInsideWorkspace(workspaceRoot, dir, `Package "${specifier}"`);
  const file = findTargetConfig(dir);
  if (!file) {
    throw new Error(
      `Package "${specifier}" resolves to ${dir}, which has no target.config.js. A package can only be linked as a target if it describes itself.`,
    );
  }
  // The package name is not a usable Xcode target name; the last path segment
  // of a scoped specifier is the readable default.
  const fallback = specifier.split('/').pop() ?? specifier;
  return { dir, spec: { name: fallback, ...readTargetConfig(file) } };
}
