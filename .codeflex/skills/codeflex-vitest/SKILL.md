---
name: codeflex-vitest
version: 1.1.0
last_reviewed: 2026-09-21
description: >
  CodeFlex engineering standards for Vitest testing framework.
  Use when writing unit tests, integration tests, or configuring
  Vitest for TypeScript/JavaScript projects.
---
# Vitest Testing Standards

These rules are mandatory whenever this Skill applies. They express
CodeFlex's baseline expectations for Vitest testing. Where a configured
client or repository standard explicitly supersedes one of these rules,
the resolved override takes precedence; rules marked non-overridable
must not be bypassed automatically.

## VITEST-001 — Test file naming and location

Test files must follow the naming convention `*.test.ts` or `*.spec.ts`
(and their `.tsx`, `.js`, `.jsx` variants). Place test files adjacent to
the source files they test, or in a parallel `__tests__` directory that
mirrors the source structure.

## VITEST-002 — Describe and it block structure

Organize tests with `describe` blocks for logical grouping and `it` or
`test` blocks for individual test cases. Use descriptive names that
explain the behavior being tested: `describe('UserService', () => { it('creates a user with valid email', ...) })`.

## VITEST-003 — Async test handling

Always return promises or use `async/await` in asynchronous tests. Use
`await expect(...).resolves` or `await expect(...).rejects` for testing
async assertions — Vitest 5 fails a test if an assertion chain
(`resolves`/`rejects`/`toMatchFileSnapshot`) is never awaited, instead of
silently passing. Never use `done` callbacks unless testing
callback-based APIs.

## VITEST-004 — Mocking with vi.mock and vi.fn

Use `vi.mock()` for module mocking and `vi.fn()` for function mocking.
Mock at the module boundary, not internal implementation details.
`vi.mock()`, `vi.unmock()`, and `vi.hoisted()` must be called at the
top level of a test file — Vitest 5 throws if they are called inside a
`describe` block or other nested scope. Restore mocks in `afterEach` or
`afterAll` to prevent test pollution: `vi.restoreAllMocks()`.

## VITEST-005 — Test isolation and cleanup

Each test must be independent. Use `beforeEach` to set up fresh state and
`afterEach` to clean up. Avoid shared mutable state between tests. Vitest
5 enables `clearMocks: true` by default, so mock call history is cleared
automatically before each test; explicitly set `restoreMocks: true` (or
call `vi.restoreAllMocks()`) in cleanup hooks when you also need mock
implementations and spies reset, not just call history.

## VITEST-006 — Assertions with expect

Use Vitest's `expect` API for assertions. Prefer specific matchers over
generic ones: `expect(arr).toContain(item)` instead of
`expect(arr.includes(item)).toBe(true)`. Use `expect.objectContaining()`
for partial object matching.

## VITEST-007 — Test coverage configuration

Configure coverage in `vitest.config.ts` with reasonable thresholds.
Target 80% coverage for business logic, 70% for utilities. Exclude test
files, configuration files, and type definitions from coverage reports.
Use `@vitest/coverage-v8` for fast, accurate coverage.

## VITEST-008 — Performance and parallelization

Vitest runs test files in parallel by default, distributed across worker
processes (`pool: 'forks'` by default; `'threads'` is often faster for
pure JS/TS suites). Configure the worker pool and concurrency with the
top-level `pool`, `maxWorkers`, and `isolate` options in
`vitest.config.ts` (the older nested `poolOptions` object was removed in
Vitest 4+). Use `vi.useFakeTimers()` for time-dependent tests instead of
actual delays. Avoid heavy setup in `describe` blocks; defer to
`beforeEach` to keep test discovery fast.

## Additional guidance

For test structure, file organization, and naming conventions, read:
`references/test-structure-and-organization.md`

For mocking strategies, module mocking, and stubbing patterns, read:
`references/mocking-and-stubbing.md`

For coverage configuration, performance optimization, and CI integration,
read: `references/coverage-and-performance.md`

## Canonical numbers and sources of truth

- **Coverage target** — 80% for business logic, 70% for utilities
  (`VITEST-007`).
- **Test naming** — `*.test.ts` or `*.spec.ts` adjacent to source
  (`VITEST-001`).
- **Mock cleanup** — Restore mocks in `afterEach` (`VITEST-004`); Vitest 5
  clears mock call history automatically by default (`clearMocks: true`).
- **Async handling** — Always use `async/await` or return promises
  (`VITEST-003`).
- **Version baseline** — Vitest 5 requires Node.js >=22.12 and Vite
  >=6.4; `test.sequential`/`describe.sequential` were removed in favor of
  `{ concurrent: false }`.
