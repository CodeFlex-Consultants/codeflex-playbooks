# Test Structure and Organization

## File organization patterns

### Adjacent test files (preferred)

Place test files next to the source files they test:

```
src/
  services/
    user-service.ts
    user-service.test.ts
  utils/
    format-date.ts
    format-date.test.ts
```

### Parallel __tests__ directory

When adjacent placement clutters the source tree, use a parallel structure:

```
src/
  services/
    user-service.ts
__tests__/
  services/
    user-service.test.ts
```

## Describe block organization

Group related tests with `describe` blocks. Use the module or class name
as the outer `describe`:

```typescript
describe('UserService', () => {
  describe('createUser', () => {
    test('creates a user with valid data', () => { ... });
    test('throws on invalid email', () => { ... });
  });

  describe('getUserById', () => {
    test('returns user when found', () => { ... });
    test('returns null when not found', () => { ... });
  });
});
```

## Test naming conventions

Use descriptive names that read as specifications:

```typescript
// Good
test('returns cached result on second call', () => { ... });
test('throws AuthenticationError when token is expired', () => { ... });

// Bad
test('works', () => { ... });
test('test1', () => { ... });
```

## Setup and teardown hierarchy

```typescript
beforeAll(() => { /* expensive one-time setup */ });
afterAll(() => { /* one-time cleanup */ });

beforeEach(() => { /* fresh state per test */ });
afterEach(() => { /* cleanup after each test */ });
```

## Parameterized tests

Use `test.each` for data-driven testing:

```typescript
test.each([
  ['empty string', '', false],
  ['valid email', 'test@example.com', true],
  ['missing @', 'invalid', false],
])('validates %s (%s) as %s', (_, input, expected) => {
  expect(isValidEmail(input)).toBe(expected);
});
```
