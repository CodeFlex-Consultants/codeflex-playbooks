# Coverage and Performance

## Coverage configuration

Configure in `jest.config.js`:

```javascript
module.exports = {
  collectCoverage: true,
  coverageDirectory: 'coverage',
  coverageProvider: 'v8',
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.test.{ts,tsx}',
    '!src/**/*.spec.{ts,tsx}',
    '!src/**/index.ts',
    '!src/types/**',
  ],
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 80,
      lines: 80,
      statements: 80,
    },
  },
};
```

## Coverage thresholds

- **Business logic** — 80% minimum
- **Utility functions** — 70% minimum
- **UI components** — 60% minimum (focus on behavior, not implementation)
- **Configuration files** — Exempt from coverage

## Performance optimization

### Parallel execution

Jest runs tests in parallel by default. Configure worker count:

```javascript
module.exports = {
  maxWorkers: '50%', // or specific number
};
```

### Fake timers

```typescript
describe('Timer-based component', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test('debounces input', () => {
    const callback = jest.fn();
    const debounced = debounce(callback, 300);

    debounced();
    expect(callback).not.toHaveBeenCalled();

    jest.advanceTimersByTime(300);
    expect(callback).toHaveBeenCalledTimes(1);
  });
});
```

### Avoid heavy setup in describe

```typescript
// Bad - runs during test discovery
describe('Service', () => {
  const data = expensiveSetup(); // ❌

  test('uses data', () => { ... });
});

// Good - runs before each test
describe('Service', () => {
  let data: TestData;

  beforeEach(() => {
    data = expensiveSetup(); // ✅
  });

  test('uses data', () => { ... });
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

## Snapshot testing

```typescript
test('renders correctly', () => {
  const tree = renderer.create(<Component />).toJSON();
  expect(tree).toMatchSnapshot();
});

test('inline snapshot', () => {
  const result = transform('input');
  expect(result).toMatchInlineSnapshot(`"output"`);
});
```

Update snapshots: `jest -u` or `jest --updateSnapshot`
