import { isViewerRequestUnlocked } from '@/lib/auth';
import { getStorageRepository } from '@/lib/storage';
import { StoryExperience } from '@/components/story/StoryExperience';
import { ViewerPasscodeGate } from '@/components/story/ViewerPasscodeGate';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const repository = getStorageRepository();
  const data = await repository.getPublicData();

  if (data.settings.viewerPasscodeEnabled) {
    const unlocked = await isViewerRequestUnlocked();
    if (!unlocked) {
      return <ViewerPasscodeGate coupleTitle={data.settings.coupleTitle} />;
    }
  }

  return <StoryExperience data={data} />;
}
