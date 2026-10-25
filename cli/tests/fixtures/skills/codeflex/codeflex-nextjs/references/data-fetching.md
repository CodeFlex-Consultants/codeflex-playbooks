# Data Fetching

## Server Component data fetching

```typescript
// app/posts/page.tsx
export default async function PostsPage() {
  const posts = await fetch('https://api.example.com/posts', {
    cache: 'force-cache', // Default: cached
  });
  const data = await posts.json();

  return (
    <ul>
      {data.map((post) => (
        <li key={post.id}>{post.title}</li>
      ))}
    </ul>
  );
}
```

## Caching strategies

```typescript
// Static (cached indefinitely)
const data = await fetch('https://...', { cache: 'force-cache' });

// No cache (always fresh)
const data = await fetch('https://...', { cache: 'no-store' });

// Time-based revalidation
const data = await fetch('https://...', { next: { revalidate: 3600 } });

// On-demand revalidation
import { revalidatePath } from 'next/cache';

export async function updatePost(formData: FormData) {
  // ... update logic
  revalidatePath('/posts');
}
```

## Server Actions

```typescript
// app/actions.ts
'use server';

export async function createPost(formData: FormData) {
  const title = formData.get('title') as string;
  const content = formData.get('content') as string;

  await db.post.create({ data: { title, content } });
  revalidatePath('/posts');
}
```

```typescript
// app/posts/new/page.tsx
import { createPost } from '@/app/actions';

export default function NewPostPage() {
  return (
    <form action={createPost}>
      <input name="title" />
      <textarea name="content" />
      <button type="submit">Create</button>
    </form>
  );
}
```

## Direct database queries

```typescript
// app/users/[id]/page.tsx
import { db } from '@/lib/db';

export default async function UserPage({
  params,
}: {
  params: { id: string };
}) {
  const user = await db.user.findUnique({
    where: { id: params.id },
  });

  return <div>{user.name}</div>;
}
```

## Parallel data fetching

```typescript
// app/dashboard/page.tsx
async function getPosts() {
  return fetch('https://.../posts').then((res) => res.json());
}

async function getAnalytics() {
  return fetch('https://.../analytics').then((res) => res.json());
}

export default async function DashboardPage() {
  const [posts, analytics] = await Promise.all([
    getPosts(),
    getAnalytics(),
  ]);

  return (
    <div>
      <Posts data={posts} />
      <Analytics data={analytics} />
    </div>
  );
}
```

## Sequential data fetching

```typescript
// app/posts/[id]/page.tsx
export default async function PostPage({
  params,
}: {
  params: { id: string };
}) {
  const post = await getPost(params.id);
  const comments = await getComments(post.id);
  const author = await getAuthor(post.authorId);

  return (
    <article>
      <h1>{post.title}</h1>
      <p>By {author.name}</p>
      <div>{post.content}</div>
      <Comments comments={comments} />
    </article>
  );
}
```
