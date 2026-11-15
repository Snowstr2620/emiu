import type { Metadata, Viewport } from 'next';
import '@fontsource-variable/plus-jakarta-sans';
import '@fontsource/cormorant-garamond/400.css';
import '@fontsource/cormorant-garamond/500.css';
import '@fontsource/cormorant-garamond/600.css';
import '@fontsource/cormorant-garamond/700.css';
import '@fontsource/cormorant-garamond/400-italic.css';
import '@fontsource/cormorant-garamond/600-italic.css';
import './globals.css';

export const metadata: Metadata = {
  title: 'Miền Ký Ức Yêu Thương · Chỉ Riêng Hai Đứa',
  description:
    'Nơi cất giữ từng nhịp tim rung động, những bức ảnh ngập tràn thương nhớ và bức tâm thư dịu dàng gửi em bé yêu.',
};

export const viewport: Viewport = {
  themeColor: '#080306',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="vi">
      <body className="min-h-screen antialiased bg-[#080306] text-rose-50 godly-velvet-bg selection:bg-rose-500/30 selection:text-rose-100">
        {children}
      </body>
    </html>
  );
}
