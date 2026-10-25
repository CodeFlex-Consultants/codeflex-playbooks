# Mocking and Stubbing

## Module mocking with vi.mock

Mock entire modules before imports:

```typescript
import { describe, it, expect, vi } from 'vitest';

vi.mock('./api-client', () => ({
  fetchUser: vi.fn().mockResolvedValue({ id: 1, name: 'Test' }),
}));

import { fetchUser } from './api-client';

describe('UserService', () => {
  it('fetches user from API', async () => {
    const result = await getUser(1);
    expect(fetchUser).toHaveBeenCalledWith(1);
    expect(result).toEqual({ id: 1, name: 'Test' });
  });
});
```

## Function mocking with vi.fn

Create mock functions for dependency injection:

```typescript
const mockSave = vi.fn();
const service = new UserService({ save: mockSave });

it('saves user to database', () => {
  service.create({ name: 'Alice' });
  expect(mockSave).toHaveBeenCalledWith({ name: 'Alice' });
});
```

## Mock return values

```typescript
vi.fn().mockReturnValue(42);
vi.fn().mockResolvedValue({ data: 'ok' });
vi.fn().mockRejectedValue(new Error('fail'));
vi.fn().mockImplementation((x) => x * 2);
```

## Mock restoration

Vitest 5 sets `clearMocks: true` by default, so `vi.clearAllMocks()`
runs automatically before every test. Explicitly restore mocks and spies
(resetting implementations, not just call history) in cleanup hooks:

```typescript
afterEach(() => {
  vi.restoreAllMocks();
});
```

## Partial mocking

Mock specific exports while keeping others:

```typescript
vi.mock('./module', async () => {
  const actual = await vi.importActual('./module');
  return {
    ...actual,
    specificFunction: vi.fn(),
  };
});
```

## Spy on existing objects

```typescript
const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
// ... test code ...
expect(spy).toHaveBeenCalledWith('expected message');
spy.mockRestore();
```
