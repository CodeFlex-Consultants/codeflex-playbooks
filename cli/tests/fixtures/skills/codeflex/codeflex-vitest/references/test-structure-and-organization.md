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
    it('creates a user with valid data', () => { ... });
    it('throws on invalid email', () => { ... });
  });

  describe('getUserById', () => {
    it('returns user when found', () => { ... });
    it('returns null when not found', () => { ... });
  });
});
```

## Test naming conventions

Use descriptive names that read as specifications:

```typescript
// Good
it('returns cached result on second call', () => { ... });
it('throws AuthenticationError when token is expired', () => { ... });

// Bad
it('works', () => { ... });
it('test1', () => { ... });
```

## Setup and teardown hierarchy

```typescript
beforeAll(() => { /* expensive one-time setup */ });
afterAll(() => { /* one-time cleanup */ });

beforeEach(() => { /* fresh state per test */ });
afterEach(() => { /* cleanup after each test */ });
```
