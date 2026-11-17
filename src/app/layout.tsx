import type { Metadata, Viewport } from 'next';
import '@fontsource-variable/plus-jakarta-sans';
import '@fontsource/cormorant-garamond/400.css';
import '@fontsource/cormorant-garamond/500.css';
import '@fontsource/cormorant-garamond/600.css';
import '@fontsource/cormorant-garamond/700.css';
import '@fontsource/cormorant-garamond/400-italic.css';
import '@fontsource/cormorant-garamond/600-italic.css';
import './globals.css';
import { AmbientAudioProvider } from '@/components/story/AudioToggle';
import { getSiteBranding } from '@/lib/site-branding';
import { getStorageRepository } from '@/lib/storage';

// Tab title and icon come from admin settings, so every page is rendered per request
// (this also keeps `next build` from reading or seeding the production database).
export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  let settings = null;
  try {
    settings = (await getStorageRepository().getPublicData()).settings;
  } catch {
    // Storage not ready (e.g. missing production config): fall back to the defaults.
  }
  const { siteTitle, faviconUrl } = getSiteBranding(settings);
  return {
    title: siteTitle,
    description:
      'Nơi cất giữ từng nhịp tim rung động, những bức ảnh ngập tràn thương nhớ và bức tâm thư dịu dàng gửi em bé yêu.',
    icons: { icon: faviconUrl, shortcut: faviconUrl, apple: faviconUrl },
  };
}

export const viewport: Viewport = {
  themeColor: '#FFFBEB',
  viewportFit: 'cover',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="vi">
      <body className="min-h-[100dvh] antialiased bg-[#FFFBEB] text-stone-900 godly-velvet-bg selection:bg-red-200/70 selection:text-stone-900">
        <AmbientAudioProvider>{children}</AmbientAudioProvider>
      </body>
    </html>
  );
}
