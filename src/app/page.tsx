import { isSessionSecretConfigured, resolveViewerSession } from '@/lib/auth';
import { ProductionSetupError } from '@/lib/seed-data';
import { getStorageRepository } from '@/lib/storage';
import { ProductionSetupNotice } from '@/components/story/ProductionSetupNotice';
import { StoryExperience } from '@/components/story/StoryExperience';
import { ViewerPasscodeGate } from '@/components/story/ViewerPasscodeGate';
import type { PublicSiteData } from '@/types/memories';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const repository = getStorageRepository();
  const isProd = process.env.NODE_ENV === 'production';

  let data: PublicSiteData;
  try {
    data = await repository.getPublicData();
  } catch (err) {
    if (err instanceof ProductionSetupError) {
      console.error(
        '[NY Startup] Khởi tạo dữ liệu production thất bại:',
        err.message,
        '— Hãy cấu hình ADMIN_PASSWORD (khác love2026) và ADMIN_SESSION_SECRET trong .env.local rồi khởi động lại máy chủ.'
      );
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
    console.error(
      '[NY Startup] Thiếu biến môi trường ADMIN_SESSION_SECRET trong chế độ production.'
    );
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

  return (
    <StoryExperience
      data={data}
      currentUser={session.user}
      viewerPasscodeEnabled={data.settings.viewerPasscodeEnabled}
    />
  );
}
