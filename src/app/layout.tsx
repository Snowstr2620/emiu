import type { Metadata } from 'next';
import '@fontsource-variable/plus-jakarta-sans';
import '@fontsource/cormorant-garamond/400.css';
import '@fontsource/cormorant-garamond/500.css';
import '@fontsource/cormorant-garamond/600.css';
import '@fontsource/cormorant-garamond/400-italic.css';
import '@fontsource/cormorant-garamond/600-italic.css';
import './globals.css';

export const metadata: Metadata = {
  title: 'Hành Trình Kỷ Niệm Của Tụi Mình',
  description: 'Những bức ảnh kỷ niệm cũ và lời tâm sự dịu dàng dành cho người thương.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="vi">
      <body className="min-h-screen antialiased text-ink-primary airy-pastel-bg selection:bg-pink-100 selection:text-pink-700">
        {children}
      </body>
    </html>
  );
}
