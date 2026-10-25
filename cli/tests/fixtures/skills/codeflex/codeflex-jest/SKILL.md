---
name: codeflex-jest
version: 1.0.0
last_reviewed: 2026-09-17
description: >
  CodeFlex engineering standards for Jest testing framework.
  Use when writing unit tests, integration tests, or configuring
  Jest for TypeScript/JavaScript projects.
---
# Jest Testing Standards

These rules are mandatory whenever this Skill applies. They express
CodeFlex's baseline expectations for Jest testing. Where a configured
client or repository standard explicitly supersedes one of these rules,
the resolved override takes precedence; rules marked non-overridable
must not be bypassed automatically.

## JEST-001 — Test file naming and location

Test files must follow the naming convention `*.test.ts` or `*.spec.ts`
(and their `.tsx`, `.js`, `.jsx` variants). Place test files adjacent to
the source files they test, or in a parallel `__tests__` directory that
mirrors the source structure.

## JEST-002 — Describe and test block structure

Organize tests with `describe` blocks for logical grouping and `test` or
`it` blocks for individual test cases. Use descriptive names that explain
the behavior being tested: `describe('UserService', () => { test('creates a user with valid email', ...) })`.

## JEST-003 — Async test handling

Always return promises or use `async/await` in asynchronous tests. Use
`await expect(...).resolves` or `await expect(...).rejects` for testing
async assertions. For callback-based APIs, use the `done` parameter.

## JEST-004 — Mocking with jest.mock and jest.fn

Use `jest.mock()` for module mocking and `jest.fn()` for function mocking.
Mock at the module boundary, not internal implementation details. Clear
mocks in `afterEach` or `afterAll` to prevent test pollution:
`jest.clearAllMocks()`.

## JEST-005 — Test isolation and cleanup

Each test must be independent. Use `beforeEach` to set up fresh state and
`afterEach` to clean up. Avoid shared mutable state between tests. Use
`jest.restoreAllMocks()` in cleanup hooks when using `jest.spyOn()`.

## JEST-006 — Assertions with expect

Use Jest's `expect` API for assertions. Prefer specific matchers over
generic ones: `expect(arr).toContain(item)` instead of
`expect(arr.includes(item)).toBe(true)`. Use `expect.objectContaining()`
for partial object matching.

## JEST-007 — Test coverage configuration

Configure coverage in `jest.config.js` with reasonable thresholds. Target
80% coverage for business logic, 70% for utilities. Exclude test files,
configuration files, and type definitions from coverage reports. Use
`@jest/coverage-v8` or the default Istanbul provider.

## JEST-008 — Snapshot testing discipline

Use snapshot tests sparingly and only for stable, serializable output.
Keep snapshots small and focused. Review snapshot changes carefully in
PRs. Use inline snapshots (`toMatchInlineSnapshot()`) for small values and
external snapshots (`toMatchSnapshot()`) for larger structures.

## Additional guidance

For test structure, file organization, and naming conventions, read:
`references/test-structure-and-organization.md`

For mocking strategies, module mocking, and stubbing patterns, read:
`references/mocking-and-stubbing.md`

For coverage configuration, performance optimization, and CI integration,
read: `references/coverage-and-performance.md`

## Canonical numbers and sources of truth

- **Coverage target** — 80% for business logic, 70% for utilities
  (`JEST-007`).
- **Test naming** — `*.test.ts` or `*.spec.ts` adjacent to source
  (`JEST-001`).
- **Mock cleanup** — Clear mocks in `afterEach` (`JEST-004`).
- **Async handling** — Always use `async/await` or return promises
  (`JEST-003`).
- **Snapshot review** — Review all snapshot changes in PRs (`JEST-008`).
