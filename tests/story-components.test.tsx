import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { AudioToggle } from '@/components/story/AudioToggle';
import { DailyDiarySection } from '@/components/story/DailyDiarySection';
import { LoveEffectsLayer } from '@/components/story/LoveEffectsLayer';
import { MemoryAlbumDetailView } from '@/components/story/MemoryAlbumDetailView';
import { PixelHeartIntro } from '@/components/story/PixelHeartIntro';
import { StoryExperience } from '@/components/story/StoryExperience';
import { ViewerPasscodeGate } from '@/components/story/ViewerPasscodeGate';
import { createSeedSettingsAndMemories } from '@/lib/seed-data';
import { PublicSiteData, SafeAppUser } from '@/types/memories';

const mockRouterRefresh = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    refresh: mockRouterRefresh,
    push: vi.fn(),
    replace: vi.fn(),
  }),
}));

const SAMPLE_DATA: PublicSiteData = {
  settings: {
    coupleTitle: 'Minh & Lan',
    heroSubtitle: 'Mỗi bức ảnh là một ngày bình yên anh cất giữ cho riêng hai đứa.',
    loveStartDate: '2024-10-12',
    musicUrl: '/samples/gentle-memories.wav',
    musicEnabled: true,
    letterTitle: 'Gửi em yêu của anh,',
    letterBody: 'Đoạn thứ nhất của bức thư.\n\nĐoạn thứ hai đầy thương nhớ.',
    letterSignature: 'Thương em, Minh',
    viewerPasscodeEnabled: false,
    updatedAt: '2026-11-15T00:00:00.000Z',
  },
  memories: [
    {
      id: 'mem-1',
      memoryDate: '2024-10-12',
      title: 'Buổi chiều mưa đầu tiên',
      story: 'Ngồi trú mưa cùng hai ly trà ấm.',
      imageUrl: '/samples/memory-1.svg',
      imageAlt: 'Quán trà chiều mưa',
      sortOrder: 0,
      createdAt: '2026-11-15T00:00:00.000Z',
    },
    {
      id: 'mem-2',
      memoryDate: '2025-02-14',
      title: 'Hoàng hôn trên đồi',
      story: 'Gió thổi nhè nhẹ và em cười thật tươi.',
      imageUrl: '/samples/memory-2.svg',
      imageAlt: 'Hoàng hôn trên đồi',
      sortOrder: 1,
      createdAt: '2026-11-15T00:00:00.000Z',
    },
  ],
};

const ADMIN_USER: SafeAppUser = {
  id: '00000000-0000-4000-8000-000000000001',
  username: 'admin',
  displayName: 'Anh · Người giữ chìa khoá ký ức',
  role: 'admin',
  otpHint: '140226',
  isActive: true,
  sessionVersion: 1,
  hasPassword: true,
  hasOtp: true,
  lastLoginAt: null,
  createdAt: '2026-11-15T00:00:00.000Z',
  updatedAt: '2026-11-15T00:00:00.000Z',
};

const VIEWER_USER: SafeAppUser = {
  id: '00000000-0000-4000-8000-000000000002',
  username: 'nguoithuong',
  displayName: 'Em bé thương yêu',
  role: 'viewer',
  otpHint: '121024',
  isActive: true,
  sessionVersion: 1,
  hasPassword: true,
  hasOtp: true,
  lastLoginAt: null,
  createdAt: '2026-11-15T00:00:00.000Z',
  updatedAt: '2026-11-15T00:00:00.000Z',
};

function createCanvas2dContextStub() {
  return {
    clearRect: vi.fn(),
    fillRect: vi.fn(),
    save: vi.fn(),
    restore: vi.fn(),
    scale: vi.fn(),
    translate: vi.fn(),
    setTransform: vi.fn(),
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    quadraticCurveTo: vi.fn(),
    closePath: vi.fn(),
    arc: vi.fn(),
    fill: vi.fn(),
    stroke: vi.fn(),
    createRadialGradient: vi.fn(() => ({
      addColorStop: vi.fn(),
    })),
    fillStyle: '',
    strokeStyle: '',
    globalAlpha: 1,
    shadowColor: '',
    shadowBlur: 0,
  } as unknown as CanvasRenderingContext2D;
}

function mockMatchMediaReducedMotion(reduced: boolean) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn((query: string) => ({
      matches: query.includes('prefers-reduced-motion') ? reduced : false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(() => false),
    })),
  });
}

function getActivityCalls(fetchSpy: ReturnType<typeof vi.fn>) {
  return fetchSpy.mock.calls
    .filter(([url]) => url === '/api/activity')
    .map(([, init]) => JSON.parse(String((init as RequestInit)?.body || '{}')) as {
      eventType: string;
      detail?: string;
      metadata?: Record<string, unknown>;
    });
}

describe('StoryExperience UI components', () => {
  let fetchSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockRouterRefresh.mockReset();
    window.sessionStorage.clear();
    mockMatchMediaReducedMotion(false);
    fetchSpy = vi.fn(async () => new Response(JSON.stringify({ ok: true }), { status: 200 }));
    vi.stubGlobal('fetch', fetchSpy);
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(
      () => createCanvas2dContextStub() as unknown as RenderingContext
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  test('renders couple title, days-together counter, and memories in order; handles empty memories gracefully', () => {
    const { rerender } = render(<StoryExperience data={SAMPLE_DATA} />);

    expect(screen.getByRole('heading', { level: 1, name: 'Minh & Lan' })).toBeInTheDocument();
    expect(screen.getByTestId('story-topbar')).toHaveTextContent('Minh & Lan');
    expect(screen.queryByText(/ngày bên nhau/i)).not.toBeInTheDocument();
    expect(screen.getByText('Buổi chiều mưa đầu tiên')).toBeInTheDocument();
    expect(screen.getByText('Hoàng hôn trên đồi')).toBeInTheDocument();

    // Empty timeline state
    rerender(
      <StoryExperience
        data={{
          settings: SAMPLE_DATA.settings,
          memories: [],
        }}
      />
    );
    expect(screen.getByText(/Chưa có kỷ niệm nào/i)).toBeInTheDocument();
  });

  test('opens PhotoLightbox when clicking a memory photo, navigates prev/next with memory_viewed telemetry, preserves responsive stage classes, and closes on dismiss', async () => {
    const user = userEvent.setup();
    render(<StoryExperience data={SAMPLE_DATA} currentUser={VIEWER_USER} />);

    const photoTrigger = screen.getByRole('button', {
      name: /Phóng to ảnh: Buổi chiều mưa đầu tiên/i,
    });
    photoTrigger.focus();
    await user.click(photoTrigger);

    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('Buổi chiều mưa đầu tiên')).toBeInTheDocument();
    expect(within(dialog).getByText('Ngồi trú mưa cùng hai ly trà ấm.')).toBeInTheDocument();

    const closeBtn = within(dialog).getByRole('button', { name: /Đóng xem ảnh/i });
    const prevBtn = within(dialog).getByRole('button', { name: /Ảnh trước/i });
    const nextBtn = within(dialog).getByRole('button', { name: /Ảnh tiếp theo/i });

    // WCAG modal focus management & focus-visible rings
    expect(closeBtn).toHaveFocus();
    for (const btn of [closeBtn, prevBtn, nextBtn]) {
      expect(btn).toHaveClass(
        'focus-visible:outline-none',
        'focus-visible:ring-2',
        'focus-visible:ring-red-500'
      );
    }

    await user.tab();
    expect(prevBtn).toHaveFocus();
    await user.tab();
    expect(nextBtn).toHaveFocus();
    await user.tab();
    expect(closeBtn).toHaveFocus();
    await user.tab({ shift: true });
    expect(nextBtn).toHaveFocus();

    const img = within(dialog).getByRole('img', { name: /Quán trà chiều mưa/i });
    expect(img).toHaveClass('max-h-[calc(48vh-1rem)]', 'sm:max-h-[calc(56vh-1rem)]');
    expect(img).not.toHaveClass('max-h-full');
    expect(dialog).toHaveClass(
      'bg-stone-950/60',
      'overflow-y-auto',
      'overscroll-contain',
      'items-start',
      'sm:items-center'
    );
    expect(dialog.firstElementChild).toHaveClass(
      'my-auto',
      '[@media(min-height:560px)]:max-h-[92vh]'
    );
    expect(dialog.firstElementChild).not.toHaveClass('max-h-[92vh]');
    expect(img.parentElement).toHaveClass(
      'shrink-0',
      'min-h-[160px]',
      'max-h-[48vh]',
      '[@media(min-height:560px)]:sm:min-h-[200px]'
    );
    expect(img.parentElement).not.toHaveClass('sm:min-h-[200px]');
    const captionContainer = within(dialog).getByText('Ngồi trú mưa cùng hai ly trà ấm.').parentElement;
    expect(captionContainer).toHaveClass('min-h-0', 'flex-1', 'overflow-y-auto');

    // Navigate next and previous without stealing focus back to Close button
    await user.click(nextBtn);
    expect(within(dialog).getByText('Hoàng hôn trên đồi')).toBeInTheDocument();
    expect(closeBtn).not.toHaveFocus();
    await user.click(prevBtn);
    expect(within(dialog).getByText('Buổi chiều mưa đầu tiên')).toBeInTheDocument();

    const memoryViewedCalls = getActivityCalls(fetchSpy).filter(
      (c) => c.eventType === 'memory_viewed'
    );
    expect(memoryViewedCalls).toHaveLength(3);
    expect(memoryViewedCalls[0].metadata).toEqual({
      memoryId: 'mem-1',
      title: 'Buổi chiều mưa đầu tiên',
    });
    expect(memoryViewedCalls[1].metadata).toEqual({
      memoryId: 'mem-2',
      title: 'Hoàng hôn trên đồi',
    });

    await user.click(closeBtn);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(photoTrigger).toHaveFocus();
  });

  test('reveals love letter paragraphs and signature only after tapping the sealed envelope and records letter_opened', async () => {
    const user = userEvent.setup();
    render(<StoryExperience data={SAMPLE_DATA} currentUser={VIEWER_USER} />);

    expect(screen.queryByText('Đoạn thứ nhất của bức thư.')).not.toBeInTheDocument();

    const openBtn = screen.getByRole('button', { name: /Chạm để mở thư/i });
    expect(openBtn).toHaveClass(
      'to-red-500',
      'hover:shadow-[0_14px_34px_rgba(220,38,38,0.4)]',
      'hover:ring-1',
      'hover:ring-red-300'
    );
    expect(openBtn).not.toHaveClass('hover:brightness-110');
    await user.click(openBtn);

    const letterHeading = await screen.findByText('Gửi em yêu của anh,');
    expect(letterHeading).toBeInTheDocument();
    expect(letterHeading).toHaveClass('min-w-0');
    expect(letterHeading.closest('div')?.parentElement).toHaveClass('bg-[#FFFDF5]/95');
    expect(screen.getByText('Đoạn thứ nhất của bức thư.')).toBeInTheDocument();
    expect(screen.getByText('Đoạn thứ hai đầy thương nhớ.')).toBeInTheDocument();
    expect(screen.getByText(/Thương em, Minh/)).toBeInTheDocument();

    const foldBtn = screen.getByRole('button', { name: /Gấp lại phong thư giữ vào tim/i });
    expect(foldBtn).toHaveClass('min-h-[36px]');
    expect(document.querySelector('[aria-hidden="true"].top-16')).toBeInTheDocument();

    const activities = getActivityCalls(fetchSpy);
    expect(activities).toContainEqual(
      expect.objectContaining({
        eventType: 'letter_opened',
      })
    );
  });

  test('StoryExperience renders single-row topbar, responsive mobile drawer + bottom nav, always-on autoplay music, replays PixelHeartIntro, and logs out', async () => {
    const user = userEvent.setup();
    const playSpy = vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue();
    vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {});

    const { rerender } = render(
      <StoryExperience
        data={SAMPLE_DATA}
        currentUser={ADMIN_USER}
        viewerPasscodeEnabled={true}
      />
    );

    const topbar = screen.getByTestId('story-topbar');
    expect(topbar).toHaveClass('fixed', 'inset-x-0', 'top-0');

    const primaryNav = screen.getByRole('navigation', { name: /Điều hướng chính/i });
    expect(primaryNav).toHaveClass(
      'fixed',
      'inset-x-0',
      'bottom-0',
      'grid',
      'grid-cols-3',
      'md:static',
      'md:inline-flex'
    );

    const roleText = screen.getByText('Anh · Người giữ chìa khoá ký ức');
    expect(roleText).toHaveClass('truncate', 'lg:max-w-[130px]', '2xl:max-w-[200px]');
    const adminLink = screen.getByRole('link', { name: /Quản trị/i });
    expect(adminLink).toHaveAttribute('href', '/admin');
    expect(adminLink).toHaveClass('min-h-[44px]', 'lg:min-h-[36px]');
    const heartReplayBtn = screen.getByRole('button', { name: /Ngắm lại trái tim pixel/i });
    expect(heartReplayBtn).toHaveClass('min-h-[48px]', 'md:min-h-[36px]');
    const logoutBtn = screen.getByRole('button', { name: /Đăng xuất/i });
    expect(logoutBtn).toHaveClass('min-h-[44px]', 'lg:min-h-[36px]');

    // Mobile account menu toggle opens drawer and Escape closes it
    const mobileMenuToggle = screen.getByRole('button', { name: /Mở menu tài khoản/i });
    expect(mobileMenuToggle).toHaveAttribute('aria-expanded', 'false');
    await user.click(mobileMenuToggle);
    expect(screen.getByRole('button', { name: /Đóng menu tài khoản/i })).toHaveAttribute(
      'aria-expanded',
      'true'
    );
    expect(screen.getByTestId('story-account-menu')).toHaveClass('fixed', 'inset-x-3');
    await user.keyboard('{Escape}');
    expect(screen.getByRole('button', { name: /Mở menu tài khoản/i })).toHaveAttribute(
      'aria-expanded',
      'false'
    );

    // Hero top clearance, timeline scroll margin, and responsive footer safe clearance
    expect(document.querySelector('header')).toHaveClass('pt-20', 'sm:pt-28');
    const timelineSection = document.getElementById('timeline');
    expect(timelineSection).toHaveClass('scroll-mt-20', 'md:scroll-mt-20');
    const footer = document.querySelector('footer')!;
    expect(footer).toHaveClass('px-4', 'pb-28', 'md:pb-10');
    expect(footer.querySelector('p')).toHaveClass('max-w-full');
    expect(footer.querySelector('svg')).toHaveClass('shrink-0');

    // Always-on default background music auto-starts, renders status pill without a turn-off button, and resists pause
    const ambientAudio = screen.getByTestId('ambient-audio') as HTMLAudioElement;
    expect(ambientAudio).toHaveAttribute('autoplay');
    expect(ambientAudio).toHaveAttribute('loop');
    expect(playSpy).toHaveBeenCalled();

    const musicPill = screen.getByTestId('ambient-music-pill');
    expect(musicPill).toHaveAttribute('role', 'status');
    expect(musicPill.querySelector('svg')).toHaveClass('motion-reduce:animate-none');
    expect(
      screen.queryByRole('button', { name: /Tạm dừng nhạc nền|Bật nhạc nền/i })
    ).not.toBeInTheDocument();

    playSpy.mockClear();
    fireEvent(ambientAudio, new Event('pause'));
    expect(playSpy).toHaveBeenCalledTimes(1);

    // Replay Pixel Heart modal + scrollable backdrop + h2 heading + focus trap/restore + Escape close
    heartReplayBtn.focus();
    await user.click(heartReplayBtn);
    const heartDialog = await screen.findByRole('dialog');
    expect(heartDialog).toHaveClass('overflow-y-auto', 'overscroll-contain', 'items-start', 'sm:items-center');
    expect(heartDialog.firstElementChild).toHaveClass('my-auto');
    const heartCloseBtn = within(heartDialog).getByRole('button', { name: /Đóng trái tim pixel/i });
    const heartBackBtn = within(heartDialog).getByRole('button', { name: /Quay lại miền ký ức/i });
    expect(heartCloseBtn).toHaveFocus();
    expect(heartCloseBtn).toHaveClass(
      'focus-visible:outline-none',
      'focus-visible:ring-2',
      'focus-visible:ring-red-500'
    );
    await user.tab();
    expect(heartBackBtn).toHaveFocus();
    await user.tab();
    expect(heartCloseBtn).toHaveFocus();
    await user.tab({ shift: true });
    expect(heartBackBtn).toHaveFocus();
    expect(within(heartDialog).getByRole('heading', { level: 2, name: 'Minh & Lan' })).toBeInTheDocument();
    const replayCanvas = within(heartDialog).getByRole('img', {
      name: /Trái tim pixel đang ghép nối và đập nhịp yêu thương/i,
    });
    expect(replayCanvas.tagName).toBe('CANVAS');
    expect(getActivityCalls(fetchSpy)).toContainEqual(
      expect.objectContaining({ eventType: 'pixel_heart_viewed' })
    );
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(heartReplayBtn).toHaveFocus();

    // Empty displayName falls back cleanly by role
    rerender(
      <StoryExperience
        data={SAMPLE_DATA}
        currentUser={{ ...ADMIN_USER, displayName: '' }}
        viewerPasscodeEnabled={true}
      />
    );
    expect(screen.getByText('Anh · Quản trị')).toBeInTheDocument();

    // Viewer role hides /admin link
    rerender(
      <StoryExperience
        data={SAMPLE_DATA}
        currentUser={VIEWER_USER}
        viewerPasscodeEnabled={true}
      />
    );
    expect(screen.getByText('Em bé thương yêu')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Quản trị/i })).not.toBeInTheDocument();

    // Logout calls /api/viewer/logout and refreshes router
    await user.click(screen.getByRole('button', { name: /Đăng xuất/i }));
    expect(fetchSpy).toHaveBeenCalledWith(
      '/api/viewer/logout',
      expect.objectContaining({ method: 'POST' })
    );
    await waitFor(() => {
      expect(mockRouterRefresh).toHaveBeenCalledTimes(1);
    });
  });

  test('StoryExperience refreshes router on 401 activity response, respects reduced-motion scrollIntoView, and sends page_leave beacon in public mode', async () => {
    const user = userEvent.setup();
    const sendBeaconMock = vi.fn(() => true);
    Object.defineProperty(navigator, 'sendBeacon', {
      configurable: true,
      writable: true,
      value: sendBeaconMock,
    });

    mockMatchMediaReducedMotion(true);
    fetchSpy.mockImplementation(async (input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input.toString();
      if (url === '/api/activity') {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
      }
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    });

    const { unmount } = render(
      <StoryExperience
        data={SAMPLE_DATA}
        currentUser={null}
        viewerPasscodeEnabled={false}
      />
    );

    // Public mode omits logout button and role badge
    expect(screen.queryByRole('button', { name: /Đăng xuất/i })).not.toBeInTheDocument();
    expect(screen.queryByText('Em bé thương yêu')).not.toBeInTheDocument();

    // Start journey uses auto scrollIntoView when prefers-reduced-motion is active
    const timelineEl = document.getElementById('timeline')!;
    const scrollIntoViewMock = vi.fn();
    timelineEl.scrollIntoView = scrollIntoViewMock;
    vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue();
    await user.click(screen.getByRole('button', { name: /Dạo bước vào miền ký ức/i }));
    expect(scrollIntoViewMock).toHaveBeenCalledWith({ behavior: 'auto' });

    // 401 on /api/activity triggers router.refresh()
    await waitFor(() => {
      expect(mockRouterRefresh).toHaveBeenCalled();
    });

    // pagehide dispatches sendBeacon('/api/activity', ...)
    fireEvent(window, new Event('pagehide'));
    expect(sendBeaconMock).toHaveBeenCalledWith('/api/activity', expect.any(Blob));
    unmount();
  });

  test('StoryExperience sends page_visit once per tab session for current user', () => {
    const { rerender } = render(<StoryExperience data={SAMPLE_DATA} currentUser={VIEWER_USER} />);
    expect(getActivityCalls(fetchSpy).filter((c) => c.eventType === 'page_visit')).toHaveLength(1);

    rerender(<StoryExperience data={SAMPLE_DATA} currentUser={VIEWER_USER} />);
    expect(getActivityCalls(fetchSpy).filter((c) => c.eventType === 'page_visit')).toHaveLength(1);
  });

  test('renders Godly Bento showcase (#01/#02 badges, lg:col-span-7/lg:col-span-5 spans, Hero metrics) and switches between Bento and Dòng chảy without blue/purple classes', async () => {
    const user = userEvent.setup();
    const fourMemoriesData: PublicSiteData = {
      ...SAMPLE_DATA,
      memories: [
        ...SAMPLE_DATA.memories,
        {
          id: 'mem-3',
          memoryDate: '2025-05-01',
          title: 'Đêm biển lộng gió',
          story: 'Ánh trăng soi sóng vỗ dịu dàng.',
          imageUrl: '/samples/memory-3.svg',
          imageAlt: 'Biển đêm',
          sortOrder: 2,
          createdAt: '2026-11-15T00:00:00.000Z',
        },
        {
          id: 'mem-4',
          memoryDate: '2025-08-20',
          title: 'Bó hoa hồng nhung',
          story: 'Mùi hương ngọt ngào còn vương trên áo.',
          imageUrl: '/samples/memory-4.svg',
          imageAlt: 'Bó hoa',
          sortOrder: 3,
          createdAt: '2026-11-15T00:00:00.000Z',
        },
      ],
    };

    const { container, rerender } = render(
      <StoryExperience data={fourMemoriesData} currentUser={ADMIN_USER} viewerPasscodeEnabled />
    );

    // Hero Bento secondary metric tile
    expect(screen.getByText(/KHO LƯU TRỮ KỶ NIỆM/i)).toBeInTheDocument();
    expect(screen.getByText(/4 khoảnh khắc quý giá/i)).toBeInTheDocument();

    // Bento switcher defaults to Bento active
    const bentoBtn = screen.getByRole('button', { name: 'Bento' });
    const streamBtn = screen.getByRole('button', { name: 'Dòng chảy' });
    expect(bentoBtn).toHaveAttribute('aria-pressed', 'true');
    expect(bentoBtn).toHaveClass('min-h-[42px]', 'sm:min-h-[36px]');
    expect(streamBtn).toHaveAttribute('aria-pressed', 'false');
    expect(streamBtn).toHaveClass('min-h-[42px]', 'sm:min-h-[36px]');

    // Editorial #01..#04 badges and 7-5-5-7 asymmetric col-span pattern
    const card1 = screen.getByText('#01').closest('article');
    const card2 = screen.getByText('#02').closest('article');
    const card3 = screen.getByText('#03').closest('article');
    const card4 = screen.getByText('#04').closest('article');
    expect(card1).toHaveClass('lg:col-span-7');
    expect(card2).toHaveClass('lg:col-span-5');
    expect(card3).toHaveClass('lg:col-span-5');
    expect(card4).toHaveClass('lg:col-span-7');
    expect(card1?.parentElement).toHaveClass('lg:grid-cols-12');

    // Switch to Dòng chảy (1-column stream)
    await user.click(streamBtn);
    expect(streamBtn).toHaveAttribute('aria-pressed', 'true');
    expect(bentoBtn).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByText('#01').closest('article')).not.toHaveClass('lg:col-span-7');
    expect(screen.getByText('#01').closest('article')?.parentElement).toHaveClass('max-w-3xl', 'space-y-8');

    // Switch back to Bento
    await user.click(bentoBtn);
    expect(bentoBtn).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText('#01').closest('article')).toHaveClass('lg:col-span-7');

    // Zero blue/sky/indigo/violet/purple utility classes, invalid opacities, hover:brightness-110, or low-contrast to-pink-500 CTAs
    expect(container.innerHTML).not.toMatch(/\b(sky|indigo|blue|violet|purple)-\d{2,3}\b/);
    expect(container.innerHTML).not.toMatch(/\/(18|88|92)\b/);
    expect(container.innerHTML).not.toContain('hover:brightness-110');
    const heroIssueBadge = screen.getByText(/đến mãi mãi về sau/i).parentElement!;
    expect(heroIssueBadge).toHaveClass('max-w-full');
    expect(heroIssueBadge.querySelector('svg')).toHaveClass('shrink-0');
    const heroCta = screen.getByRole('button', { name: /Dạo bước vào miền ký ức/i });
    expect(heroCta).toHaveClass(
      'to-red-500',
      'hover:shadow-[0_14px_34px_rgba(220,38,38,0.4)]',
      'hover:ring-1',
      'hover:ring-red-300'
    );
    expect(bentoBtn).toHaveClass('to-red-500');

    // Equalized paired Bento media stages
    const card1PhotoBtn = screen.getByRole('button', {
      name: /Phóng to ảnh: Buổi chiều mưa đầu tiên/i,
    });
    expect(card1PhotoBtn).toHaveClass('flex', 'items-center', 'justify-center', 'md:min-h-[240px]');

    // Trailing odd memory (>= 3) spans full desktop & tablet width (lg:col-span-12)
    rerender(
      <StoryExperience
        data={{
          ...fourMemoriesData,
          memories: fourMemoriesData.memories.slice(0, 3),
        }}
        currentUser={ADMIN_USER}
      />
    );
    expect(screen.getByText('#03').closest('article')).toHaveClass('md:col-span-2', 'lg:col-span-12');

    // Single-memory Bento spans full 12 columns centered; ambient background music stays active even if settings.musicEnabled is false or musicUrl is empty
    rerender(
      <StoryExperience
        data={{
          settings: { ...SAMPLE_DATA.settings, musicEnabled: false, musicUrl: '' },
          memories: [SAMPLE_DATA.memories[0]],
        }}
        currentUser={null}
      />
    );
    expect(screen.getByText('#01').closest('article')).toHaveClass('lg:col-span-12');
    const ambientAudio = screen.getByTestId('ambient-audio') as HTMLAudioElement;
    expect(ambientAudio).toHaveAttribute('src', '/samples/gentle-memories.wav');
    expect(screen.getByTestId('ambient-music-pill')).toBeInTheDocument();
  });

  test('switches to "Nhật ký mỗi ngày" tab in top dock, allows viewer to upload/drop a photo & save a diary entry, and enforces author-only edit/delete vs admin full control', async () => {
    const user = userEvent.setup();
    vi.stubGlobal('URL', {
      ...URL,
      createObjectURL: vi.fn(() => 'blob:diary-preview'),
      revokeObjectURL: vi.fn(),
    });

    const dataWithDiary: PublicSiteData = {
      ...SAMPLE_DATA,
      diaryEntries: [
        {
          id: 'diary-admin-1',
          entryDate: '2026-11-17',
          title: 'Buổi chiều của Anh',
          content: 'Pha sẵn tách trà ấm đợi em về.',
          mood: 'loved',
          imageUrl: '/samples/memory-1.svg',
          imageAlt: 'Tách trà ấm',
          authorId: ADMIN_USER.id,
          authorUsername: 'admin',
          authorDisplayName: ADMIN_USER.displayName,
          authorRole: 'admin',
          createdAt: '2026-11-17T09:00:00.000Z',
          updatedAt: '2026-11-17T09:00:00.000Z',
        },
        {
          id: 'diary-viewer-1',
          entryDate: '2026-11-17',
          title: 'Buổi tối của Em',
          content: 'Tan làm nhìn thấy anh đứng đợi thương ơi là thương.',
          mood: 'grateful',
          imageUrl: '',
          imageAlt: '',
          authorId: VIEWER_USER.id,
          authorUsername: 'nguoithuong',
          authorDisplayName: VIEWER_USER.displayName,
          authorRole: 'viewer',
          createdAt: '2026-11-17T12:30:00.000Z',
          updatedAt: '2026-11-17T12:30:00.000Z',
        },
      ],
    };

    let createdDiaryPayload: Record<string, unknown> | null = null;
    fetchSpy.mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.toString();
      if (url === '/api/diary/upload-url' && init?.method === 'POST') {
        return new Response(
          JSON.stringify({ mode: 'local', uploadEndpoint: '/api/diary/upload' }),
          { status: 200 }
        );
      }
      if (url === '/api/diary/upload' && init?.method === 'POST') {
        return new Response(
          JSON.stringify({ publicUrl: '/uploads/1731840000-aa11bb22-dinner.jpg' }),
          { status: 200 }
        );
      }
      if (url === '/api/diary' && init?.method === 'POST') {
        createdDiaryPayload = JSON.parse(String(init.body || '{}')) as Record<string, unknown>;
        return new Response(
          JSON.stringify({
            entry: {
              id: 'diary-viewer-new',
              entryDate: String(createdDiaryPayload.entryDate),
              title: String(createdDiaryPayload.title || ''),
              content: String(createdDiaryPayload.content),
              mood: String(createdDiaryPayload.mood || 'loved'),
              imageUrl: String(createdDiaryPayload.imageUrl || ''),
              imageAlt: String(createdDiaryPayload.imageAlt || 'Ảnh nhật ký'),
              authorId: VIEWER_USER.id,
              authorUsername: VIEWER_USER.username,
              authorDisplayName: VIEWER_USER.displayName,
              authorRole: 'viewer',
              createdAt: '2026-11-17T14:00:00.000Z',
              updatedAt: '2026-11-17T14:00:00.000Z',
            },
          }),
          { status: 201 }
        );
      }
      if (url === '/api/diary/diary-viewer-1' && init?.method === 'DELETE') {
        return new Response(JSON.stringify({ ok: true }), { status: 200 });
      }
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    });

    const { rerender } = render(
      <StoryExperience data={dataWithDiary} currentUser={VIEWER_USER} viewerPasscodeEnabled />
    );

    const storyTabBtn = screen.getByRole('button', { name: /Hành trình kỷ niệm/i });
    const diaryTabBtn = screen.getByRole('button', { name: /Nhật ký mỗi ngày/i });
    expect(storyTabBtn).toHaveAttribute('aria-pressed', 'true');
    expect(diaryTabBtn).toHaveAttribute('aria-pressed', 'false');

    await user.click(diaryTabBtn);
    expect(diaryTabBtn).toHaveAttribute('aria-pressed', 'true');
    expect(storyTabBtn).toHaveAttribute('aria-pressed', 'false');

    // Both entries visible under 17 Tháng 11, 2026
    expect(screen.getByText('17 Tháng 11, 2026')).toBeInTheDocument();
    const adminCard = screen.getByTestId('diary-card-diary-admin-1');
    const viewerCard = screen.getByTestId('diary-card-diary-viewer-1');

    // Viewer can ONLY edit/delete own entry, NOT admin's entry
    expect(within(adminCard).queryByRole('button', { name: /^Sửa$/i })).not.toBeInTheDocument();
    expect(within(adminCard).queryByRole('button', { name: /^Xoá$/i })).not.toBeInTheDocument();
    expect(within(viewerCard).getByRole('button', { name: /^Sửa$/i })).toBeInTheDocument();
    expect(within(viewerCard).getByRole('button', { name: /^Xoá$/i })).toBeInTheDocument();

    // Clicking diary photo opens lightbox dialog and closes on Escape
    await user.click(within(adminCard).getByRole('button', { name: /Phóng to ảnh nhật ký/i }));
    const photoDialog = await screen.findByRole('dialog', { name: /Xem ảnh nhật ký/i });
    expect(within(photoDialog).getByRole('img', { name: 'Tách trà ấm' })).toBeInTheDocument();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog', { name: /Xem ảnh nhật ký/i })).not.toBeInTheDocument();

    // Quick-drop an image onto diary-quick-dropzone -> opens composer with preview & uploads via /api/diary/upload-url
    const quickDropzone = screen.getByTestId('diary-quick-dropzone');
    const photoFile = new File([new Uint8Array([1, 2, 3, 4])], 'dinner.jpg', {
      type: 'image/jpeg',
    });
    fireEvent.drop(quickDropzone, {
      dataTransfer: { files: [photoFile], types: ['Files'] },
    });

    expect(screen.getByText(/Đã chọn: dinner\.jpg/i)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Hạnh phúc/i }));
    await user.type(screen.getByLabelText(/Tiêu đề nhỏ hôm nay/i), 'Bữa tối ấm áp');
    await user.type(
      screen.getByLabelText(/Nội dung nhật ký/i),
      'Món mì Ý anh làm ngon xuất sắc luôn.'
    );
    await user.click(screen.getByRole('button', { name: /Lưu trang nhật ký/i }));

    expect(await screen.findByText('Bữa tối ấm áp')).toBeInTheDocument();
    expect(createdDiaryPayload).toMatchObject({
      title: 'Bữa tối ấm áp',
      content: 'Món mì Ý anh làm ngon xuất sắc luôn.',
      mood: 'happy',
      imageUrl: '/uploads/1731840000-aa11bb22-dinner.jpg',
    });

    // 2-click delete on viewer's own entry
    await user.click(within(viewerCard).getByRole('button', { name: /^Xoá$/i }));
    await user.click(within(viewerCard).getByRole('button', { name: /Xác nhận xoá/i }));
    await waitFor(() => {
      expect(screen.queryByText('Buổi tối của Em')).not.toBeInTheDocument();
    });

    // Rerender as ADMIN_USER -> admin sees edit/delete even on entries written by viewer
    rerender(
      <StoryExperience data={dataWithDiary} currentUser={ADMIN_USER} viewerPasscodeEnabled />
    );
    const newViewerCardAsAdmin = screen.getByTestId('diary-card-diary-viewer-new');
    expect(within(newViewerCardAsAdmin).getByRole('button', { name: /^Sửa$/i })).toBeInTheDocument();
    expect(within(newViewerCardAsAdmin).getByRole('button', { name: /^Xoá$/i })).toBeInTheDocument();
  });

  test('DailyDiarySection filters by author/mood/search, renders inline login when currentUser is null, and obeys Pale Yellow & Red Hearts theme', async () => {
    const user = userEvent.setup();
    const dataWithDiary: PublicSiteData = {
      ...SAMPLE_DATA,
      diaryEntries: [
        {
          id: 'd-1',
          entryDate: '2026-11-17',
          title: 'Trà chiều',
          content: 'Ngồi đọc sách cạnh nhau.',
          mood: 'peaceful',
          imageUrl: '',
          imageAlt: '',
          authorId: ADMIN_USER.id,
          authorUsername: 'admin',
          authorDisplayName: 'Anh',
          authorRole: 'admin',
          createdAt: '2026-11-17T08:00:00.000Z',
          updatedAt: '2026-11-17T08:00:00.000Z',
        },
        {
          id: 'd-2',
          entryDate: '2026-11-16',
          title: 'Nhớ anh quá',
          content: 'Mong tới cuối tuần gặp nhau.',
          mood: 'miss_you',
          imageUrl: '',
          imageAlt: '',
          authorId: VIEWER_USER.id,
          authorUsername: 'nguoithuong',
          authorDisplayName: 'Em bé',
          authorRole: 'viewer',
          createdAt: '2026-11-16T15:00:00.000Z',
          updatedAt: '2026-11-16T15:00:00.000Z',
        },
      ],
    };

    const { container, rerender } = render(
      <StoryExperience data={dataWithDiary} currentUser={null} viewerPasscodeEnabled={false} />
    );

    await user.click(screen.getByRole('button', { name: /Nhật ký mỗi ngày/i }));

    // Guest sees read-only prompt & zero edit/delete buttons
    expect(screen.queryByRole('button', { name: /Viết cho hôm nay/i })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Đăng nhập để viết nhật ký/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Xoá$/i })).not.toBeInTheDocument();

    // Filter by mood
    const moodSelect = screen.getByLabelText(/Lọc theo tâm trạng/i);
    await user.selectOptions(moodSelect, 'miss_you');
    expect(screen.queryByText('Trà chiều')).not.toBeInTheDocument();
    expect(screen.getByText('Nhớ anh quá')).toBeInTheDocument();

    await user.selectOptions(moodSelect, 'all');
    // Filter by author role
    await user.click(screen.getByRole('button', { name: /Anh viết/i }));
    expect(screen.getByText('Trà chiều')).toBeInTheDocument();
    expect(screen.queryByText('Nhớ anh quá')).not.toBeInTheDocument();

    // Rerender logged in & open composer to check Pale Yellow & Red Hearts theme across all elements
    rerender(
      <StoryExperience data={dataWithDiary} currentUser={VIEWER_USER} viewerPasscodeEnabled />
    );
    await user.click(screen.getByRole('button', { name: /Tất cả tác giả/i }));
    await user.click(screen.getByRole('button', { name: /Viết cho hôm nay/i }));

    const classTokens = Array.from(container.querySelectorAll('[class]')).flatMap((el) =>
      (el.getAttribute('class') ?? '').split(/\s+/).filter(Boolean)
    );
    for (const token of classTokens) {
      expect(token).not.toBe('hover:brightness-110');
      expect(token).not.toMatch(/^(?:[a-z0-9-]+:)*(?:sky|indigo|blue|violet|purple|slate)-/);
      expect(token).not.toMatch(/^(?:[a-z0-9-]+:)*bg-white(?:\/|$)/);
      expect(token).not.toMatch(/^(?:[a-z0-9-]+:)*bg-(?:rose|pink|red|emerald|amber)-950(?:\/|$)/);
      expect(token).not.toMatch(
        /#(?:080306|0d0408|0b0408|090306|050203|12060b|14060c|16070d|16080f|190911|071f17|23070e)/i
      );
      expect(token).not.toMatch(/^(?:[a-z0-9-]+:)*to-pink-500(?:\/|$)/);
      expect(token).not.toMatch(/^placeholder:.*\/(?:30|35|40|60)$/);
      const opacityMatch = token.match(
        /^(?:[a-z0-9-]+:)*(?:bg|text|border|ring|from|via|to|divide|placeholder|fill|stroke)-.*\/(\d+)$/
      );
      if (opacityMatch) {
        expect(Number(opacityMatch[1]) % 5).toBe(0);
      }
    }
    for (const opt of container.querySelectorAll('select option')) {
      expect(opt).toHaveClass('bg-[#FFFBEB]', 'text-stone-900');
    }
  });
});

describe('ViewerPasscodeGate 2-step auth, OTP, PixelHeart transition & guest telemetry', () => {
  let fetchSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockRouterRefresh.mockReset();
    window.sessionStorage.clear();
    mockMatchMediaReducedMotion(false);
    fetchSpy = vi.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input.toString();
      if (url === '/api/viewer/login') {
        return new Response(
          JSON.stringify({
            ok: true,
            step: 'otp_required',
            otpHint: 'Ngày đầu tiên mình nắm tay nhau (12/10/24)',
            user: VIEWER_USER,
          }),
          { status: 200 }
        );
      }
      if (url === '/api/viewer/verify-otp') {
        return new Response(
          JSON.stringify({
            ok: true,
            user: VIEWER_USER,
          }),
          { status: 200 }
        );
      }
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    });
    vi.stubGlobal('fetch', fetchSpy);
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(
      () => createCanvas2dContextStub() as unknown as RenderingContext
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  test('logs guest page_visit once and strictly hides dev hints when showDevDefaultHints is false', () => {
    render(<ViewerPasscodeGate coupleTitle="Minh & Lan" showDevDefaultHints={false} />);

    expect(getActivityCalls(fetchSpy).filter((c) => c.eventType === 'page_visit')).toHaveLength(1);
    expect(screen.queryByText('nguoithuong')).not.toBeInTheDocument();
    expect(screen.queryByText('121024')).not.toBeInTheDocument();
    expect(screen.queryByText('140226')).not.toBeInTheDocument();
  });

  test('shows dev quick-fill hints when showDevDefaultHints is true and completes full 2-step + OTP paste -> PixelHeartIntro -> router.refresh()', async () => {
    const user = userEvent.setup();
    render(<ViewerPasscodeGate coupleTitle="Minh & Lan" showDevDefaultHints={true} />);

    // Dev hints visible
    expect(screen.getByText(/nguoithuong/i)).toBeInTheDocument();
    expect(screen.getByText(/121024/)).toBeInTheDocument();

    // Step 1: credentials submit
    const usernameInput = screen.getByLabelText(/Tài khoản của mình/i);
    const passwordInput = screen.getByLabelText(/Mật khẩu yêu thương/i);
    await user.type(usernameInput, '  NguoiThuong  ');
    await user.type(passwordInput, 'love2026');
    await user.click(screen.getByRole('button', { name: /Tiếp tục đến bước OTP/i }));

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledWith(
        '/api/viewer/login',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ username: 'nguoithuong', password: 'love2026' }),
        })
      );
    });

    // Step 2: OTP hint + 6 digit boxes + paste
    expect(await screen.findByText(/Em bé thương yêu/i)).toBeInTheDocument();
    expect(screen.getByText(/Gợi ý OTP:.*12\/10\/24/i)).toBeInTheDocument();

    const submitOtpBtn = screen.getByRole('button', { name: /Xác nhận bước vào tim nhau/i });
    expect(submitOtpBtn).toBeDisabled();

    const digit1 = screen.getByLabelText('Chữ số OTP thứ 1');
    const digit6 = screen.getByLabelText('Chữ số OTP thứ 6');
    fireEvent.paste(digit1, {
      clipboardData: {
        getData: () => '12-10-24',
      },
    });
    expect(digit1).toHaveValue('1');
    expect(digit6).toHaveValue('4');
    expect(submitOtpBtn).toBeEnabled();

    await user.click(submitOtpBtn);

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledWith(
        '/api/viewer/verify-otp',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ otp: '121024' }),
        })
      );
    });

    // Step 3: PixelHeartIntro renders canvas WITHOUT calling router.refresh yet
    const enterStoryBtn = await screen.findByRole('button', {
      name: /Mở khoá miền ký ức của tụi mình/i,
    });
    expect(screen.getByRole('heading', { level: 1, name: 'Minh & Lan' })).toBeInTheDocument();
    expect(document.querySelector('canvas')).toBeInTheDocument();
    expect(mockRouterRefresh).not.toHaveBeenCalled();

    // Clicking CTA fires pixel_heart_viewed and calls router.refresh()
    await user.click(enterStoryBtn);

    await waitFor(() => {
      expect(getActivityCalls(fetchSpy)).toContainEqual(
        expect.objectContaining({ eventType: 'pixel_heart_viewed' })
      );
      expect(mockRouterRefresh).toHaveBeenCalledTimes(1);
    });
  });

  test('supports initialStage="otp_pending" and returning to Step 1 calls /api/viewer/logout and clears password & OTP', async () => {
    const user = userEvent.setup();
    const { unmount } = render(
      <ViewerPasscodeGate
        coupleTitle="Minh & Lan"
        initialStage="otp_pending"
        initialOtpHint="Ngày quen nhau"
        initialUsername="nguoithuong"
        initialDisplayName="Em bé thương yêu"
        showDevDefaultHints={false}
      />
    );

    expect(screen.getByText(/Gợi ý OTP: Ngày quen nhau/i)).toBeInTheDocument();
    expect(screen.getByLabelText('Chữ số OTP thứ 1')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Quay lại bước 1/i }));

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledWith(
        '/api/viewer/logout',
        expect.objectContaining({ method: 'POST' })
      );
    });
    const passwordEl = await screen.findByLabelText(/Mật khẩu yêu thương/i);
    expect(passwordEl).toHaveValue('');
    unmount();

    // Regression: full Step 1 -> Step 2 -> Back to Step 1 clears entered password and logs out Step 1 session
    fetchSpy.mockClear();
    window.sessionStorage.clear();
    render(<ViewerPasscodeGate coupleTitle="Minh & Lan" showDevDefaultHints={false} />);

    await user.type(screen.getByLabelText(/Tài khoản của mình/i), 'nguoithuong');
    await user.type(screen.getByLabelText(/Mật khẩu yêu thương/i), 'love2026');
    await user.click(screen.getByRole('button', { name: /Tiếp tục đến bước OTP/i }));

    expect(await screen.findByLabelText('Chữ số OTP thứ 1')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Quay lại bước 1/i }));

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledWith(
        '/api/viewer/logout',
        expect.objectContaining({ method: 'POST' })
      );
    });
    const returnedPasswordInput = await screen.findByLabelText(/Mật khẩu yêu thương/i);
    expect(returnedPasswordInput).toHaveValue('');
  });

  test('supports typing individual OTP digits with auto-focus, Backspace stepping back, and Arrow key navigation', async () => {
    const user = userEvent.setup();
    render(
      <ViewerPasscodeGate
        coupleTitle="Minh & Lan"
        initialStage="otp_pending"
        initialUsername="nguoithuong"
        initialDisplayName="Em bé thương yêu"
      />
    );

    const d1 = screen.getByLabelText('Chữ số OTP thứ 1');
    const d2 = screen.getByLabelText('Chữ số OTP thứ 2');
    const d3 = screen.getByLabelText('Chữ số OTP thứ 3');

    await user.click(d1);
    await user.keyboard('1');
    expect(d1).toHaveValue('1');
    expect(d2).toHaveFocus();

    await user.keyboard('2');
    expect(d2).toHaveValue('2');
    expect(d3).toHaveFocus();

    await user.keyboard('{Backspace}');
    expect(d2).toHaveFocus();
    expect(d2).toHaveValue('');

    await user.keyboard('{ArrowLeft}');
    expect(d1).toHaveFocus();
    await user.keyboard('{ArrowRight}');
    expect(d2).toHaveFocus();
  });

  test('dispatches guest page_leave beacon on pagehide during login gate and skips leave once in pixel_heart stage', async () => {
    const sendBeaconMock = vi.fn(() => true);
    Object.defineProperty(navigator, 'sendBeacon', {
      configurable: true,
      writable: true,
      value: sendBeaconMock,
    });

    const user = userEvent.setup();
    const { unmount } = render(
      <ViewerPasscodeGate coupleTitle="Minh & Lan" showDevDefaultHints={false} />
    );

    fireEvent(window, new Event('pagehide'));
    expect(sendBeaconMock).toHaveBeenCalledTimes(1);
    unmount();

    // New session reaching pixel_heart skips guest page_leave
    sendBeaconMock.mockClear();
    window.sessionStorage.clear();
    render(
      <ViewerPasscodeGate
        coupleTitle="Minh & Lan"
        initialStage="otp_pending"
        initialUsername="nguoithuong"
      />
    );

    fireEvent.paste(screen.getByLabelText('Chữ số OTP thứ 1'), {
      clipboardData: { getData: () => '121024' },
    });
    await user.click(screen.getByRole('button', { name: /Xác nhận bước vào tim nhau/i }));
    await screen.findByRole('button', { name: /Mở khoá miền ký ức của tụi mình/i });

    fireEvent(window, new Event('pagehide'));
    expect(sendBeaconMock).not.toHaveBeenCalled();
  });

  test('ViewerPasscodeGate renders purely in Pale Yellow & Red Hearts without blue/purple classes, meets WCAG contrast, and uses romantic copy', async () => {
    const user = userEvent.setup();
    const { container, unmount } = render(
      <ViewerPasscodeGate coupleTitle="Minh & Lan" showDevDefaultHints={true} />
    );
    expect(container.innerHTML).not.toMatch(/\b(sky|indigo|blue|violet|purple)-\d{2,3}\b/);
    expect(container.innerHTML).not.toMatch(/\/(18|88|92)\b/);
    expect(container.innerHTML).not.toContain('hover:brightness-110');
    expect(screen.getByLabelText(/Tài khoản của mình/i)).toHaveClass(
      'bg-[#FFFDF5]',
      'placeholder:text-stone-500'
    );
    expect(screen.getByLabelText(/Mật khẩu yêu thương/i)).toHaveClass(
      'bg-[#FFFDF5]',
      'placeholder:text-stone-500'
    );
    expect(screen.getByRole('button', { name: /Tiếp tục đến bước OTP/i })).toHaveClass(
      'to-red-500',
      'hover:shadow-[0_14px_34px_rgba(220,38,38,0.38)]',
      'hover:ring-1',
      'hover:ring-red-300'
    );
    unmount();

    fetchSpy.mockResolvedValueOnce(new Response(JSON.stringify({}), { status: 401 }));
    const otpRender = render(
      <ViewerPasscodeGate
        coupleTitle="Minh & Lan"
        initialStage="otp_pending"
        initialUsername="nguoithuong"
        initialDisplayName="Em bé thương yêu"
      />
    );
    expect(otpRender.container.innerHTML).not.toMatch(/\/(18|88|92)\b/);
    expect(otpRender.container.innerHTML).not.toContain('hover:brightness-110');
    expect(screen.getByLabelText('Chữ số OTP thứ 1')).toHaveClass(
      'border-amber-400/80',
      'bg-[#FFFDF5]'
    );
    const otpSubmitBtn = screen.getByRole('button', { name: /Xác nhận bước vào tim nhau/i });
    expect(otpSubmitBtn).toHaveClass(
      'to-red-500',
      'hover:shadow-[0_14px_34px_rgba(220,38,38,0.38)]',
      'hover:ring-1',
      'hover:ring-red-300'
    );
    fireEvent.paste(screen.getByLabelText('Chữ số OTP thứ 1'), {
      clipboardData: { getData: () => '999999' },
    });
    await user.click(otpSubmitBtn);
    expect(await screen.findByRole('alert')).toHaveTextContent(/em bé kiểm tra gợi ý/i);

    const seed = createSeedSettingsAndMemories('2026-11-15T00:00:00.000Z');
    expect(seed.memories[3].title).toBe('Bó hoa hồng nhung và lời thương tròn đầy');
    expect(seed.memories[3].imageAlt).toBe('Bó hoa hồng nhung rực rỡ dưới ánh nến đêm');
  });
});

describe('PixelHeartIntro canvas & reduced motion', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  test('renders <canvas> without throwing when ctx.roundRect is missing and invokes onEnterStory', async () => {
    const user = userEvent.setup();
    const ctxWithoutRoundRect = createCanvas2dContextStub();
    expect((ctxWithoutRoundRect as unknown as Record<string, unknown>).roundRect).toBeUndefined();

    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
      ctxWithoutRoundRect as unknown as RenderingContext
    );

    const onEnterStory = vi.fn();
    render(
      <PixelHeartIntro
        coupleTitle="Anh & Em"
        displayName="Em bé thương yêu"
        onEnterStory={onEnterStory}
        isModalReplay
      />
    );

    const canvas = screen.getByRole('img', {
      name: /Trái tim pixel đang ghép nối và đập nhịp yêu thương/i,
    });
    expect(canvas.tagName).toBe('CANVAS');
    expect(screen.getByText(/Em bé thương yêu/)).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'Anh & Em' })).toBeInTheDocument();
    expect(canvas.closest('.glass-card')).toHaveClass('pt-12', 'sm:pt-8');
    expect(screen.getByText(/Dành riêng cho Em bé thương yêu/).parentElement).toHaveClass(
      'max-w-[68%]'
    );

    const tagline = screen.getByText(/Từng mảnh nhỏ đều mang theo một ngày anh thương em thật nhiều/i);
    expect(tagline).toHaveClass('font-serif', 'italic', 'text-sm', 'sm:text-base');

    const ctaBtn = screen.getByRole('button', { name: /Mở khoá miền ký ức của tụi mình/i });
    expect(ctaBtn).toHaveClass(
      'to-red-500',
      'motion-reduce:transform-none',
      'motion-reduce:transition-none',
      'hover:shadow-[0_14px_34px_rgba(220,38,38,0.4)]',
      'hover:ring-1',
      'hover:ring-red-300'
    );
    expect(ctaBtn).not.toHaveClass('hover:brightness-110');
    await user.click(ctaBtn);
    expect(onEnterStory).toHaveBeenCalledTimes(1);
  });

  test('handles null canvas 2D context gracefully without throwing', () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);

    expect(() =>
      render(<PixelHeartIntro coupleTitle="Anh & Em" onEnterStory={vi.fn()} />)
    ).not.toThrow();
    expect(document.querySelector('canvas')).toBeInTheDocument();
  });

  test('respects prefers-reduced-motion by drawing statically without requestAnimationFrame loop', () => {
    mockMatchMediaReducedMotion(true);
    const ctxStub = createCanvas2dContextStub();
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
      ctxStub as unknown as RenderingContext
    );
    const rafSpy = vi.spyOn(window, 'requestAnimationFrame').mockImplementation(() => 1);

    render(<PixelHeartIntro coupleTitle="Anh & Em" onEnterStory={vi.fn()} />);

    expect(rafSpy).not.toHaveBeenCalled();
    expect(ctxStub.fill).toHaveBeenCalled();
  });

  test('uses pure crimson and rose-red palette in canvas pixels, sparkles, and CTA without purple/lavender hexes', () => {
    mockMatchMediaReducedMotion(false);
    const assignedColors: string[] = [];
    let currentFillStyle = '';
    const ctxStub = createCanvas2dContextStub();
    Object.defineProperty(ctxStub, 'fillStyle', {
      get: () => currentFillStyle,
      set: (value: string) => {
        currentFillStyle = value;
        if (typeof value === 'string') {
          assignedColors.push(value.toLowerCase());
        }
      },
    });
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
      ctxStub as unknown as RenderingContext
    );

    const rafCallbacks: FrameRequestCallback[] = [];
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb: FrameRequestCallback) => {
      rafCallbacks.push(cb);
      return rafCallbacks.length;
    });

    const { container } = render(<PixelHeartIntro coupleTitle="Anh & Em" onEnterStory={vi.fn()} />);

    // Advance animation past assemblyDurationMs (1150ms) so ambient sparkles also draw
    act(() => {
      rafCallbacks[0]?.(0);
      rafCallbacks[rafCallbacks.length - 1]?.(1300);
    });

    const forbiddenHexes = ['#c4b5fd', '#e879f9', '#ddd6fe', '#e9d5ff', '#93c5fd', '#6366f1'];
    for (const hex of forbiddenHexes) {
      expect(assignedColors).not.toContain(hex);
    }
    expect(assignedColors).toContain('#dc2626');
    expect(assignedColors).toContain('#e11d48');
    expect(assignedColors).toContain('#ef4444');
    expect(container.innerHTML).not.toMatch(/\b(sky|indigo|blue|violet|purple)-\d{2,3}\b/);
  });
});

describe('LoveEffectsLayer ambient effects & reduced motion', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  test('renders pastel floating elements and creates temporary heart bursts on non-input pointerdown', () => {
    vi.useFakeTimers();
    mockMatchMediaReducedMotion(false);

    const { container } = render(
      <div>
        <LoveEffectsLayer />
        <input aria-label="test input" />
      </div>
    );

    expect(container.querySelectorAll('[data-love-particle="true"]').length).toBeGreaterThan(0);

    // Input pointerdown should NOT trigger burst
    const input = screen.getByLabelText('test input');
    fireEvent.pointerDown(input, { clientX: 50, clientY: 50 });
    expect(container.querySelectorAll('[data-love-burst="true"]')).toHaveLength(0);

    // Non-input pointerdown triggers burst, caps at 5 concurrent bursts, and auto-cleans
    for (let i = 0; i < 7; i++) {
      fireEvent.pointerDown(document.body, { clientX: 120 + i * 10, clientY: 200 });
    }
    expect(container.querySelectorAll('[data-love-burst="true"]')).toHaveLength(5);

    act(() => {
      vi.advanceTimersByTime(800);
    });
    expect(container.querySelectorAll('[data-love-burst="true"]')).toHaveLength(0);
  });

  test('disables floating animations and click bursts when prefers-reduced-motion is active', () => {
    mockMatchMediaReducedMotion(true);

    const { container } = render(<LoveEffectsLayer />);
    const layer = container.querySelector('[data-testid="love-effects-layer"]');
    expect(layer).toHaveAttribute('data-reduced-motion', 'true');
    expect(container.querySelectorAll('[data-love-particle="true"]')).toHaveLength(0);

    fireEvent.pointerDown(document.body, { clientX: 120, clientY: 200 });
    expect(container.querySelectorAll('[data-love-burst="true"]')).toHaveLength(0);
  });

  test('renders zero ambient particles during SSR before client mount', () => {
    const ssrHtml = renderToStaticMarkup(<LoveEffectsLayer />);
    expect(ssrHtml).not.toContain('data-love-particle');
  });

  test('uses exclusively crimson and rose-pink shades for floating particles and tap bursts without purple/lavender hexes', () => {
    mockMatchMediaReducedMotion(false);
    const { container } = render(<LoveEffectsLayer />);

    fireEvent.pointerDown(document.body, { clientX: 160, clientY: 220 });

    const htmlLower = container.innerHTML.toLowerCase();
    const forbiddenHexes = ['#c4b5fd', '#e879f9', '#ddd6fe', '#e9d5ff', '#93c5fd', '#6366f1'];
    for (const hex of forbiddenHexes) {
      expect(htmlLower).not.toContain(hex);
    }
    expect(htmlLower).toContain('#ef4444');
    expect(htmlLower).toContain('#fb7185');
  });
});

describe('Multi-photo album timeline cards & /memories/[id] e-commerce detail showcase', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  test('MemoryTimeline renders photo count badge, mini preview strip, and /memories/[id] detail link while preserving cover quick-zoom', async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify({ ok: true }), { status: 200 }))
    );

    const albumMemoryData: PublicSiteData = {
      ...SAMPLE_DATA,
      memories: [
        {
          id: 'mem-album-1',
          memoryDate: '2026-04-05',
          title: 'Đà Lạt nhiều ảnh',
          story: 'Một album đầy nắng chiều và hương thông.',
          imageUrl: '/samples/memory-1.svg',
          imageAlt: 'Ảnh bìa Đà Lạt',
          images: [
            { url: '/samples/memory-1.svg', alt: 'Ảnh bìa Đà Lạt' },
            { url: '/samples/memory-2.svg', alt: 'Quán cà phê sáng' },
            { url: '/samples/memory-3.svg', alt: 'Hoàng hôn đồi thông' },
          ],
          sortOrder: 0,
          createdAt: '2026-11-17T00:00:00.000Z',
        },
      ],
    };

    render(<StoryExperience data={albumMemoryData} currentUser={VIEWER_USER} />);

    expect(screen.getByText('3 ảnh')).toBeInTheDocument();
    const detailLink = screen.getByRole('link', { name: /Xem chi tiết album/i });
    expect(detailLink).toHaveAttribute('href', '/memories/mem-album-1');

    // Quick lightbox still opens on cover click and offers deep link into full album
    await user.click(screen.getByRole('button', { name: /Phóng to ảnh: Đà Lạt nhiều ảnh/i }));
    const dialog = await screen.findByRole('dialog');
    const deepLink = within(dialog).getByRole('link', { name: /Xem trọn bộ album \(3 ảnh\)/i });
    expect(deepLink).toHaveAttribute('href', '/memories/mem-album-1');
  });

  test('MemoryAlbumDetailView renders 2-column gallery, updates stage on thumbnail click, opens swipeable Popup Lightbox (touch + pointer + keyboard), and follows Dark Velvet theme', async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify({ ok: true }), { status: 200 }))
    );

    const albumMemory = {
      id: 'mem-dalat-4',
      memoryDate: '2026-04-05',
      title: 'Chuyến đi Đà Lạt 4 ngày',
      story: 'Ngày đầu đón sương sớm.\n\nTối uống sữa đậu nành nóng bên nhau.',
      imageUrl: '/samples/memory-1.svg',
      imageAlt: 'Ảnh bìa sương sớm',
      images: [
        { url: '/samples/memory-1.svg', alt: 'Ảnh bìa sương sớm' },
        { url: '/samples/memory-2.svg', alt: 'Cà phê đồi chè' },
        { url: '/samples/memory-3.svg', alt: 'Chợ đêm ấm áp' },
        { url: '/samples/memory-4.svg', alt: 'Hoa hồng buổi cuối' },
      ],
      sortOrder: 1,
      createdAt: '2026-11-17T00:00:00.000Z',
    };

    const { container } = render(
      <MemoryAlbumDetailView
        memory={albumMemory}
        albumIndex={1}
        totalAlbums={3}
        settings={SAMPLE_DATA.settings}
        currentUser={VIEWER_USER}
        prevMemory={{ id: 'mem-prev', title: 'Buổi hẹn đầu' }}
        nextMemory={{ id: 'mem-next', title: 'Biển xanh 2026' }}
      />
    );

    expect(
      screen.getByRole('heading', { level: 1, name: 'Chuyến đi Đà Lạt 4 ngày' })
    ).toBeInTheDocument();
    expect(screen.getByText('Ngày đầu đón sương sớm.')).toBeInTheDocument();
    expect(screen.getByText('Tối uống sữa đậu nành nóng bên nhau.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Quay lại hành trình/i })).toHaveAttribute('href', '/');

    const thumbStrip = screen.getByTestId('album-thumbnail-strip');
    const thumbButtons = within(thumbStrip).getAllByRole('button');
    expect(thumbButtons).toHaveLength(4);
    expect(thumbButtons[0]).toHaveAttribute('aria-pressed', 'true');

    // Click thumbnail #2 like an e-commerce product gallery
    await user.click(thumbButtons[1]);
    expect(thumbButtons[1]).toHaveAttribute('aria-pressed', 'true');
    const mainStage = screen.getByTestId('album-main-stage');
    const mainImg = within(mainStage).getByRole('img', { name: 'Cà phê đồi chè' });
    expect(mainImg).toHaveAttribute('src', '/samples/memory-2.svg');

    // Click main stage to open swipeable full-screen popup
    await user.click(within(mainStage).getByRole('button', { name: /Phóng to xem ảnh 2/i }));
    const popup = await screen.findByRole('dialog', { name: /Chuyến đi Đà Lạt 4 ngày/i });
    expect(within(popup).getByText('2 / 4')).toBeInTheDocument();
    const swipeStage = within(popup).getByTestId('album-popup-stage');

    // Touch swipe left -> advance to photo #3
    fireEvent.touchStart(swipeStage, { touches: [{ clientX: 280, clientY: 200 }] });
    fireEvent.touchEnd(swipeStage, { changedTouches: [{ clientX: 130, clientY: 205 }] });
    expect(within(popup).getByText('3 / 4')).toBeInTheDocument();

    // Pointer swipe right -> go back to photo #2
    fireEvent.pointerDown(swipeStage, { clientX: 100, clientY: 200 });
    fireEvent.pointerUp(swipeStage, { clientX: 250, clientY: 204 });
    expect(within(popup).getByText('2 / 4')).toBeInTheDocument();

    // Keyboard ArrowRight / Escape
    await user.keyboard('{ArrowRight}');
    expect(within(popup).getByText('3 / 4')).toBeInTheDocument();
    await user.keyboard('{Escape}');
    expect(
      screen.queryByRole('dialog', { name: /Chuyến đi Đà Lạt 4 ngày/i })
    ).not.toBeInTheDocument();

    // Dark Velvet & Crimson-Rose theme verification
    const classTokens = Array.from(container.querySelectorAll('[class]')).flatMap((el) =>
      (el.getAttribute('class') ?? '').split(/\s+/).filter(Boolean)
    );
    for (const token of classTokens) {
      expect(token).not.toBe('hover:brightness-110');
      expect(token).not.toMatch(/^(?:[a-z0-9-]+:)*(?:sky|indigo|blue|violet|purple|slate)-/);
      expect(token).not.toMatch(/^(?:[a-z0-9-]+:)*bg-white(?:\/|$)/);
      expect(token).not.toMatch(/^(?:[a-z0-9-]+:)*to-pink-500(?:\/|$)/);
      const opacityMatch = token.match(
        /^(?:[a-z0-9-]+:)*(?:bg|text|border|ring|from|via|to|divide|placeholder|fill|stroke)-.*\/(\d+)$/
      );
      if (opacityMatch) {
        expect(Number(opacityMatch[1]) % 5).toBe(0);
      }
    }
  });

  test('MemoryAlbumDetailView renders mixed photo+video album, plays interactive <video controls> on stage & popup, auto-pauses active AudioToggle music, and keeps Dark Velvet palette', async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify({ ok: true }), { status: 200 }))
    );
    vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue();
    vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {});

    const mixedAlbumMemory = {
      id: 'mem-video-album',
      memoryDate: '2026-06-01',
      title: 'Đêm pháo hoa bên sông',
      story: 'Giây phút rực rỡ bên nhau.',
      imageUrl: '/uploads/cover.jpg',
      imageAlt: 'Ảnh chụp bờ sông',
      images: [
        { url: '/uploads/cover.jpg', alt: 'Ảnh chụp bờ sông' },
        { url: '/uploads/fireworks.mp4', alt: 'Clip pháo hoa đêm', mediaType: 'video' as const },
      ],
      sortOrder: 0,
      createdAt: '2026-11-17T00:00:00.000Z',
    };

    const { container } = render(
      <MemoryAlbumDetailView
        memory={mixedAlbumMemory}
        albumIndex={0}
        totalAlbums={1}
        settings={SAMPLE_DATA.settings}
        currentUser={VIEWER_USER}
      />
    );

    expect(screen.getByText('1 ảnh · 1 video')).toBeInTheDocument();
    expect(screen.getByTestId('album-topbar')).toHaveClass('fixed', 'inset-x-0', 'top-0');

    // Background music starts automatically on mount without needing a turn-on button
    const playSpy = vi.mocked(HTMLMediaElement.prototype.play);
    const pauseSpy = vi.mocked(HTMLMediaElement.prototype.pause);
    expect(screen.getByTestId('ambient-music-pill')).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /Tạm dừng nhạc nền|Bật nhạc nền/i })
    ).not.toBeInTheDocument();
    expect(playSpy).toHaveBeenCalled();

    // Click thumbnail #2 (video) -> main stage renders interactive <video controls> NOT inside a <button>
    const thumbStrip = screen.getByTestId('album-thumbnail-strip');
    const thumbButtons = within(thumbStrip).getAllByRole('button');
    expect(thumbStrip.querySelectorAll('video')).toHaveLength(1);
    await user.click(thumbButtons[1]);

    const mainStage = screen.getByTestId('album-main-stage');
    const stageVideo = mainStage.querySelector('video[controls]') as HTMLVideoElement | null;
    expect(stageVideo).toBeInTheDocument();
    expect(stageVideo).toHaveAttribute('src', '/uploads/fireworks.mp4');
    expect(stageVideo?.closest('button')).toBeNull();

    // Playing unmuted video ducks background music, and pausing video resumes background music automatically
    pauseSpy.mockClear();
    playSpy.mockClear();
    fireEvent(stageVideo!, new Event('play'));
    expect(pauseSpy).toHaveBeenCalled();
    fireEvent(stageVideo!, new Event('pause'));
    expect(playSpy).toHaveBeenCalled();

    // Click popup trigger -> opens dialog with <video controls> inside album-popup-stage
    await user.click(within(mainStage).getByRole('button', { name: /Phóng to xem video 2/i }));
    const popup = await screen.findByRole('dialog', { name: /Đêm pháo hoa bên sông/i });
    const popupStage = within(popup).getByTestId('album-popup-stage');
    const popupVideo = popupStage.querySelector('video[controls]');
    expect(popupVideo).toBeInTheDocument();
    expect(popupVideo).toHaveAttribute('src', '/uploads/fireworks.mp4');

    // Theme rules
    const classTokens = Array.from(container.querySelectorAll('[class]')).flatMap((el) =>
      (el.getAttribute('class') ?? '').split(/\s+/).filter(Boolean)
    );
    for (const token of classTokens) {
      expect(token).not.toBe('hover:brightness-110');
      expect(token).not.toMatch(/^(?:[a-z0-9-]+:)*(?:sky|indigo|blue|violet|purple|slate)-/);
      expect(token).not.toMatch(/^(?:[a-z0-9-]+:)*bg-white(?:\/|$)/);
    }
  });

  test('DailyDiarySection accepts dropping an .mp4 video, uploads with kind=video, and renders <video controls> on saved diary card', async () => {
    const user = userEvent.setup();
    vi.stubGlobal('URL', {
      ...URL,
      createObjectURL: vi.fn(() => 'blob:diary-video-preview'),
      revokeObjectURL: vi.fn(),
    });

    let requestedUploadKind: string | null = null;
    let formDataKind: unknown = null;

    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = typeof input === 'string' ? input : input.toString();
        if (url === '/api/diary/upload-url' && init?.method === 'POST') {
          const body = JSON.parse(String(init.body || '{}')) as { kind?: string };
          requestedUploadKind = body.kind ?? null;
          return new Response(
            JSON.stringify({ mode: 'local', uploadEndpoint: '/api/diary/upload' }),
            { status: 200 }
          );
        }
        if (url === '/api/diary/upload' && init?.method === 'POST') {
          const fd = init.body as FormData;
          formDataKind = fd.get('kind');
          return new Response(
            JSON.stringify({ publicUrl: '/uploads/1731840000-aa11bb22-walk.mp4' }),
            { status: 200 }
          );
        }
        if (url === '/api/diary' && init?.method === 'POST') {
          const body = JSON.parse(String(init.body || '{}')) as Record<string, unknown>;
          return new Response(
            JSON.stringify({
              entry: {
                id: 'diary-video-new',
                entryDate: String(body.entryDate),
                title: String(body.title || ''),
                content: String(body.content),
                mood: String(body.mood || 'loved'),
                imageUrl: String(body.imageUrl || ''),
                imageAlt: String(body.imageAlt || 'Video nhật ký'),
                authorId: VIEWER_USER.id,
                authorUsername: VIEWER_USER.username,
                authorDisplayName: VIEWER_USER.displayName,
                authorRole: 'viewer',
                createdAt: '2026-11-17T18:00:00.000Z',
                updatedAt: '2026-11-17T18:00:00.000Z',
              },
            }),
            { status: 201 }
          );
        }
        return new Response(JSON.stringify({ ok: true }), { status: 200 });
      })
    );

    render(
      <DailyDiarySection
        coupleTitle={SAMPLE_DATA.settings.coupleTitle}
        initialEntries={[]}
        currentUser={VIEWER_USER}
      />
    );

    const videoFile = new File([new Uint8Array([1, 2, 3, 4])], 'evening-walk.mp4', {
      type: 'video/mp4',
    });
    fireEvent.drop(screen.getByTestId('diary-quick-dropzone'), {
      dataTransfer: { files: [videoFile], types: ['Files'] },
    });

    expect(screen.getByText(/Đã chọn: evening-walk\.mp4/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Xem trước video nhật ký/i)).toHaveAttribute(
      'src',
      'blob:diary-video-preview'
    );

    await user.type(
      screen.getByLabelText(/Nội dung nhật ký/i),
      'Đoạn video tụi mình đi dạo buổi tối.'
    );
    await user.click(screen.getByRole('button', { name: /Lưu trang nhật ký/i }));

    const savedCard = await screen.findByTestId('diary-card-diary-video-new');
    expect(requestedUploadKind).toBe('video');
    expect(formDataKind).toBe('video');
    const cardVideo = savedCard.querySelector('video[controls]');
    expect(cardVideo).toBeInTheDocument();
    expect(cardVideo).toHaveAttribute('src', '/uploads/1731840000-aa11bb22-walk.mp4');
  });
});

describe('AudioToggle always-on ambient autoplay', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  test('unlocks and auto-starts playback on first user gesture if browser blocks cold autoplay', async () => {
    const playSpy = vi
      .spyOn(HTMLMediaElement.prototype, 'play')
      .mockRejectedValueOnce(new Error('NotAllowedError'))
      .mockResolvedValue();
    vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {});
    const onAutoStart = vi.fn();

    render(<AudioToggle inline musicUrl="/samples/gentle-memories.wav" onAutoStart={onAutoStart} />);

    await waitFor(() => {
      expect(playSpy).toHaveBeenCalledTimes(1);
    });
    expect(onAutoStart).not.toHaveBeenCalled();

    fireEvent.pointerDown(document);
    await waitFor(() => {
      expect(playSpy).toHaveBeenCalledTimes(2);
      expect(onAutoStart).toHaveBeenCalledTimes(1);
    });

    // Subsequent clicks do not re-trigger unlock play listener once started
    fireEvent.pointerDown(document);
    expect(playSpy).toHaveBeenCalledTimes(2);
  });
});
