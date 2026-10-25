---
name: codeflex-testing-library
version: 1.0.0
last_reviewed: 2026-09-17
description: >
  CodeFlex engineering standards for Testing Library (React, Angular, Vue,
  Svelte). Use when writing component tests with @testing-library/*,
  choosing queries, handling async behavior, or integrating with
  jest-dom matchers.
---
# Testing Library Standards

These rules are mandatory whenever this Skill applies. They express
CodeFlex's baseline expectations for Testing Library usage. Where a
configured client or repository standard explicitly supersedes one of
these rules, the resolved override takes precedence; rules marked
non-overridable must not be bypassed automatically.

## TL-001 — Query by accessible role first

Prefer `getByRole` for querying elements. It matches how users perceive
the DOM (buttons, headings, textboxes) and enforces accessibility. Fall
back to `getByLabelText`, `getByPlaceholderText`, `getByText`, or
`getByTestId` only when role queries are insufficient.

## TL-002 — Avoid test IDs for queryable elements

Use `data-testid` only as a last resort when no other query can
reliably locate the element. Test IDs bypass accessibility semantics
and make tests fragile to refactoring. Reserve them for elements
without accessible names (e.g. icons, decorative containers).

## TL-003 — Use user-event over fireEvent

Prefer `userEvent` for simulating user interactions. It fires the full
sequence of events a real browser would (focus, keydown, keypress,
keyup, input, change, click). Use `fireEvent` only for events that
`userEvent` does not support or when testing low-level event handling.

## TL-004 — Wait for async assertions

Use `findBy*` queries (which return promises) for elements that appear
after async operations. Use `waitFor` for assertions that depend on
state changes. Never use arbitrary timeouts (`setTimeout`) in tests.

## TL-005 — Scope queries to rendered output

Always query within the rendered component's container. Use the return
value of `render()` or `setup()`: `const { getByRole } = render(<Component />)`.
Avoid querying `document.body` directly unless testing portal content.

## TL-006 — Assert on visible behavior, not implementation

Test what the user sees and does, not internal component state. Assert
on rendered text, visible elements, and DOM attributes. Do not assert
on component instance methods, internal state variables, or mock call
counts unless the side effect is the primary behavior under test.

## TL-007 — Clean up after each test

Call `cleanup()` after each test to unmount components and remove them
from the DOM. Most test runners (Jest, Vitest) handle this automatically
when configured with `@testing-library/jest-dom` and
`@testing-library/react`'s auto-cleanup. Verify cleanup is active.

## TL-008 — Use jest-dom matchers for DOM assertions

Import `@testing-library/jest-dom` to get expressive matchers:
`toBeInTheDocument()`, `toBeVisible()`, `toBeDisabled()`,
`toHaveTextContent()`, `toHaveAttribute()`. These produce clearer failure
messages than generic equality checks.

## TL-009 — Framework-specific render adapters

Use the correct Testing Library adapter for each framework:
- React: `@testing-library/react` with `render(<Component />)`
- Angular: `@testing-library/angular` with `render(Component, { componentProperties })`
- Vue: `@testing-library/vue` with `render(Component, { props })`
- Svelte: `@testing-library/svelte` with `render(Component, { props })`

## Additional guidance

For query priority, accessible roles, and when to fall back to test IDs,
read: `references/query-priorities.md`

For async patterns, `findBy*` queries, `waitFor`, and handling loading
states, read: `references/async-patterns.md`

For framework-specific render adapters and configuration, read:
`references/framework-adapters.md`

## Canonical numbers and sources of truth

- **Query priority** — `getByRole` first, test IDs last (`TL-001`,
  `TL-002`).
- **User interaction** — `userEvent` over `fireEvent` (`TL-003`).
- **Async handling** — `findBy*` and `waitFor`, never `setTimeout`
  (`TL-004`).
- **Assertion style** — Visible behavior, not implementation (`TL-006`).
- **DOM matchers** — `@testing-library/jest-dom` for all assertions
  (`TL-008`).
