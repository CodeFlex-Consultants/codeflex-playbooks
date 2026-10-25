# App Router Patterns

## Basic route structure

```
app/
  layout.tsx          // Root layout
  page.tsx            // Home page
  loading.tsx         // Root loading
  error.tsx           // Root error
  blog/
    layout.tsx        // Blog layout
    page.tsx          // Blog list
    [slug]/
      page.tsx        // Dynamic blog post
  dashboard/
    layout.tsx        // Dashboard layout
    page.tsx          // Dashboard home
```

## Layouts

```typescript
// app/layout.tsx (Root Layout)
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <Header />
        {children}
        <Footer />
      </body>
    </html>
  );
}
```

```typescript
// app/dashboard/layout.tsx
export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex">
      <Sidebar />
      <main className="flex-1">{children}</main>
    </div>
  );
}
```

## Dynamic routes

```typescript
// app/blog/[slug]/page.tsx
export default async function BlogPost({
  params,
}: {
  params: { slug: string };
}) {
  const post = await getPost(params.slug);
  return <article>{post.content}</article>;
}

export async function generateStaticParams() {
  const posts = await getAllPosts();
  return posts.map((post) => ({ slug: post.slug }));
}
```

## Catch-all routes

```typescript
// app/docs/[...slug]/page.tsx
export default function Docs({ params }: { params: { slug: string[] } }) {
  // /docs/a/b/c -> params.slug = ['a', 'b', 'c']
  return <div>Path: {params.slug.join('/')}</div>;
}
```

## Parallel routes

```typescript
// app/layout.tsx
export default function Layout({
  children,
  team,
  analytics,
}: {
  children: React.ReactNode;
  team: React.ReactNode;
  analytics: React.ReactNode;
}) {
  return (
    <>
      {children}
      {team}
      {analytics}
    </>
  );
}
```

```
app/
  layout.tsx
  page.tsx
  @team/
    page.tsx
  @analytics/
    page.tsx
```

## Intercepting routes

```typescript
// app/feed/[id]/page.tsx
// Intercepted by app/@modal/(.)photo/[id]/page.tsx
export default function FeedPage() {
  return <div>Feed</div>;
}
```

```typescript
// app/@modal/(.)photo/[id]/page.tsx
export default function PhotoModal() {
  return <dialog>Photo modal</dialog>;
}
```

## Route groups

```
app/
  (marketing)/
    about/page.tsx
    contact/page.tsx
  (dashboard)/
    dashboard/page.tsx
    settings/page.tsx
```

Route groups don't affect URL structure.
