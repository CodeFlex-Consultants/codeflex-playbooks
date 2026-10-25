# Query Priorities

## Query priority order

Testing Library queries follow a priority based on how users interact
with your page:

1. **getByRole** — Most preferred. Matches ARIA roles (button, heading,
   textbox, checkbox, etc.).
2. **getByLabelText** — Form labels. Matches `<label>` text or
   `aria-label` attributes.
3. **getByPlaceholderText** — Input placeholders. Only use when no label
   is available.
4. **getByText** — Visible text content. Good for links, buttons, and
   static text.
5. **getByDisplayValue** — Current value of form elements.
6. **getByAltText** — Alt text for images.
7. **getByTitle** — Title attribute.
8. **getByTestId** — Last resort. `data-testid` attribute.

## Examples by query type

### getByRole (preferred)

```typescript
// Button
const submitButton = screen.getByRole('button', { name: /submit/i });

// Heading
const heading = screen.getByRole('heading', { level: 1 });

// Textbox with accessible name
const emailInput = screen.getByRole('textbox', { name: /email/i });

// Checkbox
const rememberMe = screen.getByRole('checkbox', { name: /remember me/i });
```

### getByLabelText (form fields)

```typescript
// Implicit label
<label>
  Email
  <input type="email" />
</label>
const emailInput = screen.getByLabelText('Email');

// Explicit label
<label htmlFor="email">Email</label>
<input id="email" type="email" />
const emailInput = screen.getByLabelText('Email');

// aria-label
<input aria-label="Search" type="search" />
const searchInput = screen.getByLabelText('Search');
```

### getByText (visible content)

```typescript
// Exact match
const errorMessage = screen.getByText('An error occurred');

// Regex (case-insensitive)
const welcomeMessage = screen.getByText(/welcome, alice/i);

// Function
const item = screen.getByText((content, element) => {
  return element?.tagName === 'SPAN' && content.startsWith('Item');
});
```

### getByTestId (last resort)

```typescript
// Only when no other query works
const loadingSpinner = screen.getByTestId('loading-spinner');
const analyticsTracker = screen.getByTestId('analytics-tracker');
```

## When to use test IDs

Use `data-testid` only when:
- Element has no accessible role or name
- Content is dynamic or localized
- Element is purely decorative or functional (not user-facing)
- No other query can reliably locate the element

```typescript
// Good use of test ID
<div data-testid="modal-overlay" role="presentation">
  <div role="dialog" aria-label="Confirm deletion">
    {/* Use role query for the dialog */}
  </div>
</div>

// Bad use of test ID
<button data-testid="submit-button">Submit</button>
// Should use: screen.getByRole('button', { name: /submit/i })
```
