---
name: codeflex-code-craftsmanship
version: 1.0.0
last_reviewed: 2026-09-17
description: >
  CodeFlex engineering standards for senior-level code craftsmanship,
  design quality, and architectural maturity. Use when writing, reviewing,
  or refactoring code to ensure SOLID principles, intentional design patterns,
  low coupling, high cohesion, manageable cognitive complexity, and professional
  error handling. Applies to all developers aspiring to senior-quality output.
---
# Code Craftsmanship

These rules are mandatory whenever this Skill applies. They express
CodeFlex's advanced design quality and craftsmanship standards, building
on the baseline principles in `common.engineering`. Where a configured
client or repository standard explicitly supersedes one of these rules,
the resolved override takes precedence.

## CRAFT-001 — SOLID principles

All code must adhere to the five SOLID principles as a coherent set:
- **Single Responsibility**: Each class or module has one, and only one,
  reason to change. A class should own exactly one concern.
- **Open/Closed**: Software entities are open for extension but closed
  for modification. Add new behaviour through new types, not by editing
  existing ones.
- **Liskov Substitution**: Subtypes must be substitutable for their base
  types without altering correctness. Overrides must honour preconditions
  and postconditions.
- **Interface Segregation**: Many client-specific interfaces are superior
  to one general-purpose interface. Consumers should not depend on methods
  they do not use.
- **Dependency Inversion**: Depend on abstractions, not concretions.
  High-level modules must not depend on low-level modules; both should
  depend on abstractions.
See `references/solid-principles.md`.

## CRAFT-002 — Design patterns: use intentionally

Apply design patterns to solve known, recurring problems — not
speculatively. Prefer composition over inheritance. Follow the Rule of
Three: do not extract an abstraction until the same concept appears in
at least three concrete places. Document non-obvious pattern choices
with a brief comment explaining the *why*.
See `references/design-patterns.md`.

## CRAFT-003 — Minimise coupling, maximise cohesion

Favour loose coupling between modules and high cohesion within them.
Use dependency injection to reduce coupling between components. Avoid
circular dependencies entirely. Target low afferent and efferent coupling
ratios for stable, reusable modules.
See `references/coupling-and-cohesion.md`.

## CRAFT-004 — Cognitive complexity budgets

Cognitive complexity measures how hard code is to understand, distinct
from cyclomatic complexity. Targets:
- **Ideal**: < 15 cognitive complexity per method.
- **Maximum**: 30 cognitive complexity per method.
Break down deeply nested control flow, chained ternaries, and
multi-condition boolean logic. Extract well-named methods to reduce
cognitive load at each level.
See `references/cognitive-complexity.md`.

## CRAFT-005 — Code smells and refactoring discipline

Recognise and eliminate common code smells: long methods, large classes,
feature envy, data clumps, speculative generality, and shotgun surgery.
Apply refactoring techniques systematically in small, testable steps.
Follow the Boy Scout Rule: leave the code cleaner than you found it.
Never let known smells accumulate as permanent debt.
See `references/code-smells-and-refactoring.md`.

## CRAFT-006 — Advanced error handling

Design domain-specific exception hierarchies for exceptional cases.
Use Result or Either types for expected, recoverable failures. Propagate
errors with context — wrap exceptions rather than swallowing them. Fail
fast with meaningful error messages. Never use exceptions for control
flow. See `references/advanced-error-handling.md`.

## CRAFT-007 — Performance awareness

Understand the algorithmic complexity (Big O) of operations you write.
Avoid unnecessary allocations, copies, and string concatenations in hot
paths. Choose data structures that match the access pattern. Profile
before optimising — never guess at bottlenecks. Be vigilant about N+1
queries, excessive I/O, and resource leaks.
See `references/performance-patterns.md`.

## CRAFT-008 — Dependency injection patterns

Use constructor injection for required dependencies. Reserve property or
method injection for optional dependencies. Understand service lifetimes
(Transient, Scoped, Singleton) and their implications for state and
thread safety. Avoid the service locator pattern. Register services at
the appropriate composition root.
See `references/dependency-injection.md`.

## CRAFT-009 — Documentation quality

Public APIs must have documentation comments describing *what* and *why*,
not *how*. Complex algorithms need inline explanation of intent. Record
significant design choices in Architecture Decision Records (ADRs).
Maintain README files that explain module purpose and usage. Keep
documentation close to code to prevent drift.
See `references/documentation-standards.md`.

## Additional guidance

For detailed SOLID guidance with examples and anti-patterns, read:
`references/solid-principles.md`

For design pattern selection and intentional application, read:
`references/design-patterns.md`

For coupling and cohesion metrics and reduction techniques, read:
`references/coupling-and-cohesion.md`

For cognitive complexity measurement and reduction strategies, read:
`references/cognitive-complexity.md`

For code smell catalogue and refactoring techniques, read:
`references/code-smells-and-refactoring.md`

For exception hierarchies, Result types, and error propagation, read:
`references/advanced-error-handling.md`

For algorithmic complexity, data structure selection, and profiling, read:
`references/performance-patterns.md`

For DI patterns, service lifetimes, and composition roots, read:
`references/dependency-injection.md`

For API docs, ADRs, and inline documentation standards, read:
`references/documentation-standards.md`

For baseline engineering principles (KISS, DRY, YAGNI, code metrics),
use the `common.engineering` skill (`ENGINEERING-009`). This skill covers
advanced design quality; the baseline skill owns fundamental principles
and size budgets.

## Canonical numbers and sources of truth

- **Cognitive complexity target** — < 15 per method, 30 absolute max (`CRAFT-004`).
- **Rule of Three** — Do not extract abstraction before 3 concrete occurrences (`CRAFT-002`).
- **SOLID** — All five principles applied as a coherent set (`CRAFT-001`).
- **DI default** — Constructor injection for required dependencies (`CRAFT-008`).
- **Error handling split** — Result types for expected failures, exceptions for exceptional cases (`CRAFT-006`).
