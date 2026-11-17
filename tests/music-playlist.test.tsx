import React, { useState } from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { AmbientAudioProvider, AudioToggle } from '@/components/story/AudioToggle';
import {
  DEFAULT_MUSIC_URL,
  getMusicPlaylist,
  getPlayablePlaylist,
  getTrackDisplayName,
  MAX_MUSIC_TRACKS,
  normalizePlaylist,
} from '@/lib/music-playlist';
import { validateSettingsPayload } from '@/lib/validation';

const BASE_SETTINGS = {
  coupleTitle: 'Anh & Em',
  heroSubtitle: 'Mãi bên nhau',
  loveStartDate: '2024-10-12',
  musicEnabled: true,
  letterTitle: 'Gửi em',
  letterBody: 'Thương em nhiều lắm.',
  letterSignature: 'Anh',
  viewerPasscodeEnabled: true,
};

describe('music playlist helpers', () => {
  test('normalizes, falls back to the legacy single musicUrl, then to the sample track', () => {
    expect(normalizePlaylist([' /a.mp3 ', '', '/a.mp3', 5, '/b.mp3'])).toEqual(['/a.mp3', '/b.mp3']);
    expect(normalizePlaylist('nope')).toEqual([]);

    expect(getMusicPlaylist({ musicUrl: '/one.mp3', musicPlaylist: ['/x.mp3', '/y.mp3'] })).toEqual([
      '/x.mp3',
      '/y.mp3',
    ]);
    expect(getMusicPlaylist({ musicUrl: '/one.mp3' })).toEqual(['/one.mp3']);
    expect(getMusicPlaylist({ musicUrl: '', musicPlaylist: [] })).toEqual([]);
    expect(getPlayablePlaylist({ musicUrl: '' })).toEqual([DEFAULT_MUSIC_URL]);
  });

  test('shows a friendly track name without the upload prefix', () => {
    expect(getTrackDisplayName('/uploads/1731840000123-ab12cd34-our%20song.mp3')).toBe('our song.mp3');
    expect(getTrackDisplayName('https://cdn.example.com/music/em-oi.m4a?v=2')).toBe('em-oi.m4a');
  });

  test('validates the playlist and keeps musicUrl as the first track', () => {
    const ok = validateSettingsPayload({
      ...BASE_SETTINGS,
      musicUrl: '/samples/gentle-memories.wav',
      musicPlaylist: ['/uploads/1.mp3', '/uploads/2.mp3'],
    });
    expect('data' in ok && ok.data.musicPlaylist).toEqual(['/uploads/1.mp3', '/uploads/2.mp3']);
    expect('data' in ok && ok.data.musicUrl).toBe('/uploads/1.mp3');

    const legacy = validateSettingsPayload({ ...BASE_SETTINGS, musicUrl: '/uploads/old.mp3' });
    expect('data' in legacy && legacy.data.musicPlaylist).toEqual(['/uploads/old.mp3']);

    expect(
      'error' in validateSettingsPayload({ ...BASE_SETTINGS, musicUrl: '', musicPlaylist: 'x' })
    ).toBe(true);
    expect(
      'error' in
        validateSettingsPayload({
          ...BASE_SETTINGS,
          musicUrl: '',
          musicPlaylist: ['javascript:alert(1)'],
        })
    ).toBe(true);
    const tooMany = Array.from({ length: MAX_MUSIC_TRACKS + 1 }, (_, i) => `/uploads/${i}.mp3`);
    expect(
      'error' in validateSettingsPayload({ ...BASE_SETTINGS, musicUrl: '', musicPlaylist: tooMany })
    ).toBe(true);
  });
});

describe('ambient playlist player', () => {
  beforeEach(() => {
    vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue();
    vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  test('plays tracks in order and loops back to the first after the last one ends', () => {
    render(<AudioToggle inline playlist={['/uploads/1.mp3', '/uploads/2.mp3', '/uploads/3.mp3']} />);
    const audio = screen.getByTestId('ambient-audio') as HTMLAudioElement;

    expect(audio.getAttribute('src')).toBe('/uploads/1.mp3');
    expect(audio.loop).toBe(false);

    fireEvent.ended(audio);
    expect(audio.getAttribute('src')).toBe('/uploads/2.mp3');
    fireEvent.ended(audio);
    expect(audio.getAttribute('src')).toBe('/uploads/3.mp3');
    fireEvent.ended(audio);
    expect(audio.getAttribute('src')).toBe('/uploads/1.mp3');
  });

  test('loops a single track natively and skips a broken track', () => {
    const { unmount } = render(<AudioToggle inline playlist={['/uploads/only.mp3']} />);
    expect((screen.getByTestId('ambient-audio') as HTMLAudioElement).loop).toBe(true);
    unmount();

    render(<AudioToggle inline playlist={['/uploads/broken.mp3', '/uploads/ok.mp3']} />);
    const audio = screen.getByTestId('ambient-audio') as HTMLAudioElement;
    fireEvent.error(audio);
    expect(audio.getAttribute('src')).toBe('/uploads/ok.mp3');
  });

  test('keeps the same player and track when navigating between pages inside the provider', () => {
    const playlist = ['/uploads/1.mp3', '/uploads/2.mp3'];

    function FakeRouter() {
      const [page, setPage] = useState<'home' | 'detail'>('home');
      return (
        <AmbientAudioProvider>
          {page === 'home' ? (
            <div>
              <h1>Trang chính</h1>
              <AudioToggle inline playlist={playlist} />
              <button onClick={() => setPage('detail')}>Xem chi tiết</button>
            </div>
          ) : (
            <div>
              <h1>Chi tiết</h1>
              <AudioToggle inline playlist={[...playlist]} />
            </div>
          )}
        </AmbientAudioProvider>
      );
    }

    render(<FakeRouter />);
    const audioBefore = screen.getByTestId('ambient-audio') as HTMLAudioElement;
    fireEvent.ended(audioBefore); // now on track 2
    expect(audioBefore.getAttribute('src')).toBe('/uploads/2.mp3');

    fireEvent.click(screen.getByRole('button', { name: 'Xem chi tiết' }));
    expect(screen.getByRole('heading', { name: 'Chi tiết' })).toBeInTheDocument();

    const audioAfter = screen.getByTestId('ambient-audio') as HTMLAudioElement;
    expect(audioAfter).toBe(audioBefore);
    expect(audioAfter.getAttribute('src')).toBe('/uploads/2.mp3');
    expect(screen.getAllByTestId('ambient-audio')).toHaveLength(1);
  });

  test('stops the music shortly after leaving every page that plays it', () => {
    vi.useFakeTimers();

    function Shell() {
      const [withMusic, setWithMusic] = useState(true);
      return (
        <AmbientAudioProvider>
          {withMusic ? <AudioToggle inline playlist={['/uploads/1.mp3']} /> : <p>Trang admin</p>}
          <button onClick={() => setWithMusic(false)}>Sang admin</button>
        </AmbientAudioProvider>
      );
    }

    render(<Shell />);
    expect(screen.getByTestId('ambient-audio')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Sang admin' }));
    expect(screen.getByTestId('ambient-audio')).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(screen.queryByTestId('ambient-audio')).not.toBeInTheDocument();
  });

  test('resumes the music after a playing video with sound is removed from the page (popup closed / navigated away)', () => {
    vi.useFakeTimers();
    const playSpy = vi.mocked(HTMLMediaElement.prototype.play);
    const pauseSpy = vi.mocked(HTMLMediaElement.prototype.pause);

    render(<AudioToggle inline playlist={['/uploads/1.mp3']} />);
    const audio = screen.getByTestId('ambient-audio');
    playSpy.mockClear();

    // An unmuted video starts playing
    const video = document.createElement('video');
    Object.defineProperty(video, 'paused', { configurable: true, get: () => false });
    document.body.appendChild(video);
    fireEvent.play(video);
    expect(pauseSpy.mock.contexts).toContain(audio);

    // Still playing after a while -> music stays paused
    act(() => {
      vi.advanceTimersByTime(3000);
    });
    expect(playSpy).not.toHaveBeenCalled();

    // The video element disappears without any pause/ended event reaching the document
    video.remove();
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(playSpy.mock.contexts).toContain(audio);
  });

  test('pauses for a video only while it is audible (mute / unmute)', () => {
    const playSpy = vi.mocked(HTMLMediaElement.prototype.play);
    const pauseSpy = vi.mocked(HTMLMediaElement.prototype.pause);

    render(<AudioToggle inline playlist={['/uploads/1.mp3']} />);
    const audio = screen.getByTestId('ambient-audio');

    const video = document.createElement('video');
    Object.defineProperty(video, 'paused', { configurable: true, get: () => false });
    video.muted = true;
    document.body.appendChild(video);

    // Muted autoplay preview does not interrupt the music
    fireEvent.play(video);
    expect(pauseSpy.mock.contexts).not.toContain(audio);

    // Viewer unmutes -> music pauses; mutes again -> music resumes
    video.muted = false;
    fireEvent(video, new Event('volumechange'));
    expect(pauseSpy.mock.contexts).toContain(audio);

    playSpy.mockClear();
    video.muted = true;
    fireEvent(video, new Event('volumechange'));
    expect(playSpy.mock.contexts).toContain(audio);

    video.remove();
  });
});
