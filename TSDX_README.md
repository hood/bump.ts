# Development Guide

This project was originally bootstrapped with [TSDX](https://github.com/jaredpalmer/tsdx). It now
tracks TSDX 2.x, which is a full rewrite: the old Rollup/Jest/ESLint/Prettier stack is gone, replaced
by bunchee/vitest/oxlint/oxfmt.

Note that the `tsdx` CLI itself shells out to `bunx` for every subcommand. This repo uses pnpm and
invokes the underlying tools directly instead — which is exactly what `tsdx init` writes into
`package.json` — so no bun install is required.

## Commands

| Command              | What it does                                                  |
| -------------------- | ------------------------------------------------------------- |
| `pnpm build`         | One-off build to `dist` (CJS) and `dist/esm` (ESM) via `tsc`   |
| `pnpm start`         | Same build in watch mode                                      |
| `pnpm test`          | Run the suite once with [vitest](https://vitest.dev)           |
| `pnpm test:watch`    | Vitest in watch mode                                           |
| `pnpm lint`          | Lint `src` and `test` with [oxlint](https://oxc.rs)            |
| `pnpm format`        | Format `src` and `test` with [oxfmt](https://oxc.rs)           |
| `pnpm format:check`  | Check formatting without writing                               |
| `pnpm typecheck`     | `tsc --noEmit`                                                 |
| `pnpm size`          | Bundle cost via [size-limit](https://github.com/ai/size-limit) |
| `pnpm analyze`       | Visualize the bundle                                           |
| `pnpm benchmark`     | Run the `benchmarks/` suite                                    |

## Build

The build is plain `tsc`, not a bundler — it predates the TSDX 2 migration and is kept deliberately,
since `main`/`module` in `package.json` point at the resulting `dist/index.js` and `dist/esm/index.js`
layout. CJS and ESM are emitted; UMD is not.

## Configuration

- `tsconfig.json` — type-check only (`noEmit`), interprets `dom` and `esnext` libs
- `tsconfig.build.json` — emit config used by `pnpm build`
- `vitest.config.mts` — test config. Uses `globals: true` so suites keep using bare `describe` /
  `it` / `expect`. Note that vitest exposes mocks as `vi`, not `jest`.
- `.oxlintrc.json` — lint rules. A few stylistic rules are disabled where they conflict with
  deliberate conventions in this codebase (`_`-prefixed internal params, unused fixture bindings in
  tests).
- `.oxfmtrc.json` — formatting, carried over from the previous Prettier settings (80 cols, single
  quotes, semicolons, ES5 trailing commas, no parens around sole arrow params).

## Setup Files

```txt
/src
  index.ts
/test
  *.test.ts
/benchmarks
package.json
tsconfig.json
tsconfig.build.json
vitest.config.mts
.oxlintrc.json
.oxfmtrc.json
```

## Node version

`engines.node` is `>=24`, tracking the current Node Active LTS (v24, LTS since 2025-10-28, security
support to 2028-04). This is a consumer-facing floor: anyone installing `bump-ts` needs Node 24+.
Bump it to 26 once that line goes LTS on 2026-10-28.

The dev toolchain requires at least Node 20 (vitest 4, oxlint, and the `tsdx` CLI), so it is already
satisfied by the baseline above.

## Publishing to NPM

`prepare` runs the build automatically. We recommend [np](https://github.com/sindresorhus/np) for
the release itself.
