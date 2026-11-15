import { resolveViewerSession } from '@/lib/auth';
import { getStorageRepository } from '@/lib/storage';
import { StoryExperience } from '@/components/story/StoryExperience';
import { ViewerPasscodeGate } from '@/components/story/ViewerPasscodeGate';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const repository = getStorageRepository();
  const [data, session] = await Promise.all([
    repository.getPublicData(),
    resolveViewerSession(repository),
  ]);

  const showDevDefaultHints = process.env.NODE_ENV !== 'production';

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
