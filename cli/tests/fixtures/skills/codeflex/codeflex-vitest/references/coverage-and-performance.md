# Coverage and Performance

## Coverage configuration

Configure in `vitest.config.ts`:

```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*.ts'],
      exclude: [
        'src/**/*.test.ts',
        'src/**/*.spec.ts',
        'src/**/index.ts',
        'src/types/**',
      ],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 70,
        statements: 80,
      },
    },
  },
});
```

## Coverage thresholds

- **Business logic** — 80% minimum
- **Utility functions** — 70% minimum
- **UI components** — 60% minimum (focus on behavior, not implementation)
- **Configuration files** — Exempt from coverage

## Performance optimization

### Parallel execution

```typescript
// vitest.config.ts
export default defineConfig({
  test: {
    pool: 'threads',
    poolOptions: {
      threads: {
        singleThread: false,
      },
    },
  },
});
```

### Fake timers

```typescript
import { vi, describe, it, beforeEach, afterEach } from 'vitest';

describe('Timer-based component', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('debounces input', () => {
    const callback = vi.fn();
    const debounced = debounce(callback, 300);

    debounced();
    expect(callback).not.toHaveBeenCalled();

    vi.advanceTimersByTime(300);
    expect(callback).toHaveBeenCalledOnce();
  });
});
```

### Avoid heavy setup in describe

```typescript
// Bad - runs during test discovery
describe('Service', () => {
  const data = expensiveSetup(); // ❌

  it('uses data', () => { ... });
});

// Good - runs before each test
describe('Service', () => {
  let data: TestData;

  beforeEach(() => {
    data = expensiveSetup(); // ✅
  });

  it('uses data', () => { ... });
});
```

## CI integration

```yaml
# GitHub Actions example
- name: Run tests with coverage
  run: npm run test:coverage

- name: Upload coverage
  uses: codecov/codecov-action@v3
  with:
    files: ./coverage/coverage-final.json
```
