import spawn from 'cross-spawn';

/**
 * Two things that only fail far from where they are caused.
 *
 * Generated native output committed by accident is regenerated anyway, and its
 * Gradle transform paths are long enough that `git checkout` fails outright on
 * Windows with "Filename too long" — a CI failure that looks nothing like its
 * cause. Both have happened here, so they are checks rather than conventions.
 */
const MAX_PATH_LENGTH = 180;
const GENERATED = /(^|\/)(build|\.gradle|\.cxx)\//;

const result = spawn.sync('git', ['ls-files'], { encoding: 'utf8' });
if (result.status !== 0) {
  console.error('Could not list tracked files.');
  process.exit(1);
}
const files = result.stdout.split('\n').filter(Boolean);

const generated = files.filter((file) => GENERATED.test(file));
const long = files.filter((file) => file.length > MAX_PATH_LENGTH);

for (const file of generated.slice(0, 5)) {
  console.error(`Generated native output is tracked: ${file}`);
}
if (generated.length > 5) {
  console.error(`…and ${generated.length - 5} more.`);
}
for (const file of long) {
  console.error(`Tracked path is ${file.length} characters, over ${MAX_PATH_LENGTH}: ${file}`);
}

if (generated.length > 0 || long.length > 0) {
  console.error('\nAdd the directory to .gitignore and `git rm -r --cached` it.');
  process.exit(1);
}
console.log(
  `${files.length} tracked paths: no generated output, none longer than ${MAX_PATH_LENGTH}.`,
);
