# Optimization and Performance

## Image optimization

```typescript
import Image from 'next/image';

// Fixed size
<Image
  src="/profile.jpg"
  alt="Profile"
  width={200}
  height={200}
  priority // Above-the-fold
/>

// Fill parent container
<div style={{ position: 'relative', width: '100%', height: '400px' }}>
  <Image
    src="/hero.jpg"
    alt="Hero"
    fill
    style={{ objectFit: 'cover' }}
    priority
  />
</div>
```

```javascript
// next.config.js
module.exports = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'images.example.com',
        pathname: '/**',
      },
    ],
  },
};
```

## Font optimization

```typescript
// app/layout.tsx
import { Inter } from 'next/font/google';

const inter = Inter({ subsets: ['latin'] });

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={inter.className}>
      <body>{children}</body>
    </html>
  );
}
```

```typescript
// Local font
import localFont from 'next/font/local';

const myFont = localFont({
  src: [
    { path: './font.woff2', weight: '400', style: 'normal' },
    { path: './font-bold.woff2', weight: '700', style: 'normal' },
  ],
});
```

## Metadata optimization

```typescript
// app/layout.tsx
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: {
    default: 'My App',
    template: '%s | My App',
  },
  description: 'My application description',
  openGraph: {
    title: 'My App',
    description: 'My application description',
    images: ['/og-image.png'],
  },
  twitter: {
    card: 'summary_large_image',
  },
};
```

```typescript
// Dynamic metadata
export async function generateMetadata({ params }): Promise<Metadata> {
  const post = await getPost(params.id);
  return {
    title: post.title,
    description: post.excerpt,
  };
}
```

## Bundle analysis

```bash
# Install analyzer
npm install @next/bundle-analyzer

# next.config.js
const withBundleAnalyzer = require('@next/bundle-analyzer')({
  enabled: process.env.ANALYZE === 'true',
});

module.exports = withBundleAnalyzer({});

# Run analysis
ANALYZE=true npm run build
```

## Static generation

```typescript
// Force static
export const dynamic = 'force-static';
export const revalidate = 3600; // Revalidate every hour

export default async function StaticPage() {
  const data = await fetchData();
  return <div>{data}</div>;
}
```

## Streaming and Suspense

```typescript
import { Suspense } from 'react';

export default function Page() {
  return (
    <div>
      <h1>Page Title</h1>
      <Suspense fallback={<Loading />}>
        <SlowComponent />
      </Suspense>
    </div>
  );
}
```

## Code splitting

```typescript
import dynamic from 'next/dynamic';

const HeavyComponent = dynamic(() => import('./HeavyComponent'), {
  loading: () => <p>Loading...</p>,
  ssr: false, // Disable SSR for this component
});

export default function Page() {
  return <HeavyComponent />;
}
```

## Caching headers

```typescript
// app/api/data/route.ts
import { NextResponse } from 'next/server';

export async function GET() {
  const data = await fetchData();

  return NextResponse.json(data, {
    headers: {
      'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300',
    },
  });
}
```
