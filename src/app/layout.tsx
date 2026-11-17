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

export const metadata: Metadata = {
  title: 'Miền Ký Ức Yêu Thương · Chỉ Riêng Hai Đứa',
  description:
    'Nơi cất giữ từng nhịp tim rung động, những bức ảnh ngập tràn thương nhớ và bức tâm thư dịu dàng gửi em bé yêu.',
};

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
