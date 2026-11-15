'use client';

import React, { useCallback, useState } from 'react';
import { MotionConfig } from 'framer-motion';
import { calculateDaysTogether } from '@/lib/date-utils';
import { PublicSiteData } from '@/types/memories';
import { AudioToggle } from '@/components/story/AudioToggle';
import { EnvelopeLetter } from '@/components/story/EnvelopeLetter';
import { HeroSection } from '@/components/story/HeroSection';
import { MemoryTimeline } from '@/components/story/MemoryTimeline';
import { PhotoLightbox } from '@/components/story/PhotoLightbox';

interface StoryExperienceProps {
  data: PublicSiteData;
}

export function StoryExperience({ data }: StoryExperienceProps) {
  const { settings, memories } = data;
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  const daysTogether = calculateDaysTogether(settings.loveStartDate);

  const handleStartJourney = useCallback(() => {
    const timelineEl = document.getElementById('timeline');
    if (timelineEl && typeof timelineEl.scrollIntoView === 'function') {
      timelineEl.scrollIntoView({ behavior: 'smooth' });
    }
    if (settings.musicEnabled && settings.musicUrl && !isPlaying) {
      setIsPlaying(true);
    }
  }, [settings.musicEnabled, settings.musicUrl, isPlaying]);

  const handleToggleMusic = useCallback(() => {
    setIsPlaying((prev) => !prev);
  }, []);

  return (
    <MotionConfig reducedMotion="user">
      <div className="relative min-h-screen overflow-x-hidden">
        {/* Soft luminous pastel mist orbs */}
        <div
          aria-hidden="true"
          className="pointer-events-none fixed -left-24 -top-24 h-80 w-80 rounded-full bg-pink-200/45 blur-3xl sm:h-[28rem] sm:w-[28rem]"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none fixed -right-24 top-1/3 h-80 w-80 rounded-full bg-sky-200/45 blur-3xl sm:h-[30rem] sm:w-[30rem]"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none fixed bottom-0 left-1/3 h-72 w-72 rounded-full bg-indigo-100/50 blur-3xl"
        />

        <AudioToggle
          musicUrl={settings.musicUrl}
          musicEnabled={settings.musicEnabled}
          isPlaying={isPlaying}
          onToggle={handleToggleMusic}
          onSyncPlayState={setIsPlaying}
        />

        <main className="relative z-10">
          <HeroSection
            coupleTitle={settings.coupleTitle}
            heroSubtitle={settings.heroSubtitle}
            loveStartDate={settings.loveStartDate}
            daysTogether={daysTogether}
            onStartJourney={handleStartJourney}
          />

          <MemoryTimeline memories={memories} onOpenPhoto={setSelectedIndex} />

          <EnvelopeLetter
            letterTitle={settings.letterTitle}
            letterBody={settings.letterBody}
            letterSignature={settings.letterSignature}
          />
        </main>

        <footer className="relative z-10 pb-8 text-center text-xs text-slate-400">
          <p>Lưu giữ từng khoảnh khắc dịu dàng của {settings.coupleTitle}</p>
        </footer>

        <PhotoLightbox
          memories={memories}
          selectedIndex={selectedIndex}
          onClose={() => setSelectedIndex(null)}
          onSelectIndex={setSelectedIndex}
        />
      </div>
    </MotionConfig>
  );
}
