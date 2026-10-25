# Framework Adapters

## React

### Installation

```bash
npm install --save-dev @testing-library/react @testing-library/jest-dom
```

### Basic usage

```typescript
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';

test('renders component', () => {
  render(<MyComponent prop="value" />);
  expect(screen.getByText(/hello/i)).toBeInTheDocument();
});
```

### With hooks and context

```typescript
import { render, screen } from '@testing-library/react';
import { ThemeProvider } from './theme';

test('uses theme context', () => {
  render(
    <ThemeProvider theme="dark">
      <MyComponent />
    </ThemeProvider>
  );
  expect(screen.getByTestId('component')).toHaveClass('dark-theme');
});
```

### Custom render with providers

```typescript
// test-utils.ts
import { render, type RenderOptions } from '@testing-library/react';
import { ThemeProvider } from './theme';
import { AuthProvider } from './auth';

function AllProviders({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider theme="light">
      <AuthProvider user={mockUser}>
        {children}
      </AuthProvider>
    </ThemeProvider>
  );
}

function customRender(ui: React.ReactElement, options?: Omit<RenderOptions, 'wrapper'>) {
  return render(ui, { wrapper: AllProviders, ...options });
}

export * from '@testing-library/react';
export { customRender as render };
```

## Angular

### Installation

```bash
npm install --save-dev @testing-library/angular @testing-library/jest-dom
```

### Basic usage

```typescript
import { render, screen } from '@testing-library/angular';
import { MyComponent } from './my.component';

test('renders component', async () => {
  await render(MyComponent, {
    componentProperties: {
      title: 'Hello',
    },
  });
  expect(screen.getByText('Hello')).toBeInTheDocument();
});
```

### With template

```typescript
import { render, screen } from '@testing-library/angular';

test('renders with template', async () => {
  await render('<my-component [title]="title"></my-component>', {
    componentProperties: { title: 'Hello' },
    declarations: [MyComponent],
  });
  expect(screen.getByText('Hello')).toBeInTheDocument();
});
```

### With services

```typescript
import { render, screen } from '@testing-library/angular';
import { UserService } from './user.service';

test('uses service', async () => {
  const mockService = {
    getUser: jest.fn().mockReturnValue({ name: 'Alice' }),
  };

  await render(MyComponent, {
    providers: [{ provide: UserService, useValue: mockService }],
  });

  expect(screen.getByText('Alice')).toBeInTheDocument();
});
```

## Vue

### Installation

```bash
npm install --save-dev @testing-library/vue @testing-library/jest-dom
```

### Basic usage

```typescript
import { render, screen } from '@testing-library/vue';
import MyComponent from './MyComponent.vue';

test('renders component', () => {
  render(MyComponent, {
    props: {
      title: 'Hello',
    },
  });
  expect(screen.getByText('Hello')).toBeInTheDocument();
});
```

### With slots

```typescript
import { render, screen } from '@testing-library/vue';
import MyComponent from './MyComponent.vue';

test('renders with slot', () => {
  render(MyComponent, {
    slots: {
      default: '<p>Slot content</p>',
    },
  });
  expect(screen.getByText('Slot content')).toBeInTheDocument();
});
```

## Svelte

### Installation

```bash
npm install --save-dev @testing-library/svelte @testing-library/jest-dom
```

### Basic usage

```typescript
import { render, screen } from '@testing-library/svelte';
import MyComponent from './MyComponent.svelte';

test('renders component', () => {
  render(MyComponent, {
    props: {
      title: 'Hello',
    },
  });
  expect(screen.getByText('Hello')).toBeInTheDocument();
});
```

## Common configuration

### jest-dom setup

Add to your test setup file (e.g., `setupTests.ts`):

```typescript
import '@testing-library/jest-dom';
```

### Vitest configuration

```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    setupFiles: ['./setupTests.ts'],
    environment: 'jsdom', // or 'happy-dom'
  },
});
```

### Jest configuration

```javascript
// jest.config.js
module.exports = {
  setupFilesAfterEnv: ['<rootDir>/setupTests.ts'],
  testEnvironment: 'jsdom',
};
```
