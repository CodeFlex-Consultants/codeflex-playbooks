# Mocking and Stubbing

## Module mocking with jest.mock

Mock entire modules before imports:

```typescript
import { describe, test, expect, jest } from '@jest/globals';

jest.mock('./api-client', () => ({
  fetchUser: jest.fn().mockResolvedValue({ id: 1, name: 'Test' }),
}));

import { fetchUser } from './api-client';

describe('UserService', () => {
  test('fetches user from API', async () => {
    const result = await getUser(1);
    expect(fetchUser).toHaveBeenCalledWith(1);
    expect(result).toEqual({ id: 1, name: 'Test' });
  });
});
```

## Function mocking with jest.fn

Create mock functions for dependency injection:

```typescript
const mockSave = jest.fn();
const service = new UserService({ save: mockSave });

test('saves user to database', () => {
  service.create({ name: 'Alice' });
  expect(mockSave).toHaveBeenCalledWith({ name: 'Alice' });
});
```

## Mock return values

```typescript
jest.fn().mockReturnValue(42);
jest.fn().mockResolvedValue({ data: 'ok' });
jest.fn().mockRejectedValue(new Error('fail'));
jest.fn().mockImplementation((x) => x * 2);
```

## Mock restoration

Always clear mocks to prevent cross-test pollution:

```typescript
afterEach(() => {
  jest.clearAllMocks();
});
```

## Partial mocking

Mock specific exports while keeping others:

```typescript
jest.mock('./module', () => {
  const actual = jest.requireActual('./module');
  return {
    ...actual,
    specificFunction: jest.fn(),
  };
});
```

## Spy on existing objects

```typescript
const spy = jest.spyOn(console, 'log').mockImplementation(() => {});
// ... test code ...
expect(spy).toHaveBeenCalledWith('expected message');
spy.mockRestore();
```

## Manual mocks (__mocks__)

Create manual mocks for complex modules:

```
src/
  api-client.ts
  __mocks__/
    api-client.ts
```

```typescript
// src/__mocks__/api-client.ts
export const fetchUser = jest.fn().mockResolvedValue({ id: 1, name: 'Mock' });
```
