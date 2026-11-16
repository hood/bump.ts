const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const {
  cpSync,
  mkdtempSync,
  mkdirSync,
  rmSync,
  writeFileSync,
} = require('node:fs');
const { tmpdir } = require('node:os');
const { join, resolve } = require('node:path');
const { test, after } = require('node:test');

// Test the emitted package through Node's resolver, without bundler interop.
const root = mkdtempSync(join(tmpdir(), 'bump-package-'));
const pkg = join(root, 'node_modules', 'bump-ts');
mkdirSync(pkg, { recursive: true });
cpSync(resolve('dist'), join(pkg, 'dist'), { recursive: true });
cpSync(resolve('package.json'), join(pkg, 'package.json'));
after(() => rmSync(root, { recursive: true, force: true }));

const example = `
const world = Bump.newWorld(50);
world.add('A', 0, 0, 64, 256);
world.add('B', 0, -100, 32, 32);
const { x, y, collisions } = world.move('B', 0, 64);
console.log(JSON.stringify({ x, y, collisions: collisions.length }));
`;

for (const [kind, source] of [
  ['esm', "import Bump, { World } from 'bump-ts';"],
  ['cjs', "const Bump = require('bump-ts'); const { World } = Bump;"],
]) {
  test(`${kind} executes the README example`, () => {
    const file = join(root, `example.${kind === 'esm' ? 'mjs' : 'cjs'}`);
    writeFileSync(
      file,
      source +
        example +
        'if (!(world instanceof World)) throw new Error("World export");'
    );
    const output = execFileSync(process.execPath, [file], { encoding: 'utf8' });
    assert.deepEqual(JSON.parse(output), { x: 0, y: -32, collisions: 1 });
  });
}

test('NodeNext resolves default imports and exported types', () => {
  const file = join(root, 'consumer.mts');
  writeFileSync(
    file,
    "import Bump, { World, type IRect } from 'bump-ts';\nconst world: World = Bump.newWorld(50);\nconst rect: IRect = { x: 0, y: 0, w: 1, h: 1 };\nworld.add('item', rect.x, rect.y, rect.w, rect.h);\n"
  );
  execFileSync(
    process.execPath,
    [
      require.resolve('typescript/bin/tsc'),
      '--noEmit',
      '--strict',
      '--module',
      'nodenext',
      '--moduleResolution',
      'nodenext',
      '--target',
      'es2022',
      file,
    ],
    { cwd: root, stdio: 'pipe' }
  );
});
