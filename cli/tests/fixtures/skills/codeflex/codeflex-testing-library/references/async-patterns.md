# Async Patterns

## findBy* queries

`findBy*` queries combine `getBy*` with `waitFor`. They retry until the
element is found or a timeout occurs (default 1000ms).

```typescript
// Wait for element to appear
const successMessage = await screen.findByText(/success/i);
expect(successMessage).toBeInTheDocument();

// Wait for element with role
const loadedItem = await screen.findByRole('listitem');
expect(loadedItem).toHaveTextContent('Item 1');

// With options
const button = await screen.findByRole('button', { name: /submit/i }, {
  timeout: 3000,
});
```

## waitFor

Use `waitFor` for assertions that depend on state changes or async
operations that don't directly add elements to the DOM.

```typescript
// Wait for assertion to pass
await waitFor(() => {
  expect(mockApi.fetchUser).toHaveBeenCalledTimes(1);
});

// Wait for element to disappear
await waitFor(() => {
  expect(screen.queryByText(/loading/i)).not.toBeInTheDocument();
});

// With options
await waitFor(
  () => {
    expect(screen.getByText(/loaded/i)).toBeInTheDocument();
  },
  { timeout: 5000, interval: 100 }
);
```

## Common async patterns

### Loading states

```typescript
test('shows loading then data', async () => {
  render(<UserList />);

  // Initially shows loading
  expect(screen.getByText(/loading/i)).toBeInTheDocument();

  // Wait for data to load
  const users = await screen.findAllByRole('listitem');
  expect(users).toHaveLength(3);

  // Loading message should be gone
  expect(screen.queryByText(/loading/i)).not.toBeInTheDocument();
});
```

### Form submission

```typescript
test('submits form and shows success', async () => {
  const mockSubmit = jest.fn().mockResolvedValue({ success: true });
  render(<ContactForm onSubmit={mockSubmit} />);

  // Fill form
  await userEvent.type(screen.getByLabelText(/name/i), 'Alice');
  await userEvent.type(screen.getByLabelText(/email/i), 'alice@example.com');

  // Submit
  await userEvent.click(screen.getByRole('button', { name: /submit/i }));

  // Wait for success message
  expect(await screen.findByText(/thank you/i)).toBeInTheDocument();
  expect(mockSubmit).toHaveBeenCalledWith({
    name: 'Alice',
    email: 'alice@example.com',
  });
});
```

### API calls

```typescript
test('fetches and displays user', async () => {
  const mockUser = { id: 1, name: 'Alice' };
  jest.spyOn(api, 'fetchUser').mockResolvedValue(mockUser);

  render(<UserProfile userId={1} />);

  // Wait for user data to appear
  const userName = await screen.findByText('Alice');
  expect(userName).toBeInTheDocument();
});
```

## Avoiding common pitfalls

### Never use setTimeout

```typescript
// ❌ Bad
test('waits for data', async () => {
  render(<Component />);
  await new Promise((resolve) => setTimeout(resolve, 100));
  expect(screen.getByText(/loaded/i)).toBeInTheDocument();
});

// ✅ Good
test('waits for data', async () => {
  render(<Component />);
  expect(await screen.findByText(/loaded/i)).toBeInTheDocument();
});
```

### Don't mix waitFor with findBy

```typescript
// ❌ Redundant
await waitFor(() => {
  screen.findByText(/loaded/i); // findBy already waits
});

// ✅ Direct
await screen.findByText(/loaded/i);
```

### Handle multiple async updates

```typescript
test('handles multiple state updates', async () => {
  render(<Component />);

  // Wait for first update
  expect(await screen.findByText(/step 1/i)).toBeInTheDocument();

  // Wait for second update
  expect(await screen.findByText(/step 2/i)).toBeInTheDocument();

  // Wait for final state
  expect(await screen.findByText(/complete/i)).toBeInTheDocument();
});
```
