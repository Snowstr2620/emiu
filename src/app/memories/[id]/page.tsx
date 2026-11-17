import Link from 'next/link';
import { ArrowLeft, HeartOff } from 'lucide-react';
import {
  isSessionSecretConfigured,
  resolveAdminSession,
  resolveViewerSession,
} from '@/lib/auth';
import { ProductionSetupError } from '@/lib/seed-data';
import { getStorageRepository } from '@/lib/storage';
import { MemoryAlbumDetailView } from '@/components/story/MemoryAlbumDetailView';
import { ProductionSetupNotice } from '@/components/story/ProductionSetupNotice';
import { ViewerPasscodeGate } from '@/components/story/ViewerPasscodeGate';
import type { PublicSiteData } from '@/types/memories';

export const dynamic = 'force-dynamic';

interface MemoryDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function MemoryDetailPage({ params }: MemoryDetailPageProps) {
  const { id } = await params;
  const repository = getStorageRepository();
  const isProd = process.env.NODE_ENV === 'production';

  let data: PublicSiteData;
  try {
    data = await repository.getPublicData();
  } catch (err) {
    if (err instanceof ProductionSetupError) {
      console.error('[NY Startup] Khởi tạo dữ liệu production thất bại:', err.message);
      return (
        <ProductionSetupNotice
          missingPassword={err.message.includes('ADMIN_PASSWORD')}
          missingSessionSecret={isProd && !isSessionSecretConfigured()}
          detailMessage={err.message.includes('ADMIN_DEFAULT_OTP') ? err.message : undefined}
        />
      );
    }
    throw err;
  }

  if (isProd && data.settings.viewerPasscodeEnabled && !isSessionSecretConfigured()) {
    return <ProductionSetupNotice missingSessionSecret />;
  }

  const session = await resolveViewerSession(repository);
  const showDevDefaultHints = !isProd;

  if (data.settings.viewerPasscodeEnabled && session.stage !== 'unlocked') {
    return (
      <ViewerPasscodeGate
        coupleTitle={data.settings.coupleTitle}
        initialStage={session.stage}
        initialOtpHint={session.otpHint}
        initialUsername={session.user?.username}
        initialDisplayName={session.user?.displayName}
        showDevDefaultHints={showDevDefaultHints}
      />
    );
  }

  const albumIndex = data.memories.findIndex((m) => m.id === id);
  if (albumIndex === -1) {
    return (
      <main className="godly-velvet-bg flex min-h-screen items-center justify-center bg-[#FFFBEB] px-4 py-12 text-stone-900">
        <div className="glass-card w-full max-w-md space-y-4 rounded-3xl p-8 text-center">
          <HeartOff className="mx-auto h-10 w-10 text-red-600" />
          <h1 className="font-serif text-2xl font-bold text-stone-900">
            Không tìm thấy album kỷ niệm này
          </h1>
          <p className="text-sm text-stone-700">
            Album có thể đã được đổi tên hoặc xoá khỏi dòng thời gian của hai bạn.
          </p>
          <Link
            href="/"
            className="inline-flex min-h-[42px] items-center justify-center gap-2 rounded-full bg-gradient-to-r from-red-600 via-rose-600 to-red-500 px-6 py-2.5 text-sm font-semibold text-white shadow-[0_10px_26px_rgba(220,38,38,0.25)] transition hover:shadow-[0_14px_34px_rgba(220,38,38,0.38)] hover:ring-1 hover:ring-red-300"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Quay lại hành trình kỷ niệm</span>
          </Link>
        </div>
      </main>
    );
  }

  const memory = data.memories[albumIndex];
  const prevItem = albumIndex > 0 ? data.memories[albumIndex - 1] : null;
  const nextItem = albumIndex < data.memories.length - 1 ? data.memories[albumIndex + 1] : null;
  const activeUser =
    session.user ?? (!data.settings.viewerPasscodeEnabled ? await resolveAdminSession(repository) : null);

  return (
    <MemoryAlbumDetailView
      memory={memory}
      albumIndex={albumIndex}
      totalAlbums={data.memories.length}
      settings={data.settings}
      currentUser={activeUser}
      prevMemory={prevItem ? { id: prevItem.id, title: prevItem.title } : null}
      nextMemory={nextItem ? { id: nextItem.id, title: nextItem.title } : null}
    />
  );
}
