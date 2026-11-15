import React from 'react';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { LoveEffectsLayer } from '@/components/story/LoveEffectsLayer';
import { PixelHeartIntro } from '@/components/story/PixelHeartIntro';
import { StoryExperience } from '@/components/story/StoryExperience';
import { ViewerPasscodeGate } from '@/components/story/ViewerPasscodeGate';
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
  displayName: 'Anh · Người giữ chìa khóa ký ức',
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

    expect(screen.getByText('Minh & Lan')).toBeInTheDocument();
    expect(screen.getByText(/ngày bên nhau/i)).toBeInTheDocument();
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

  test('opens PhotoLightbox when clicking a memory photo, records memory_viewed, and closes on dismiss', async () => {
    const user = userEvent.setup();
    render(<StoryExperience data={SAMPLE_DATA} currentUser={VIEWER_USER} />);

    const photoTrigger = screen.getByRole('button', {
      name: /Phóng to ảnh: Buổi chiều mưa đầu tiên/i,
    });
    await user.click(photoTrigger);

    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('Buổi chiều mưa đầu tiên')).toBeInTheDocument();
    expect(within(dialog).getByText('Ngồi trú mưa cùng hai ly trà ấm.')).toBeInTheDocument();

    const activities = getActivityCalls(fetchSpy);
    expect(activities).toContainEqual(
      expect.objectContaining({
        eventType: 'memory_viewed',
        metadata: { memoryId: 'mem-1', title: 'Buổi chiều mưa đầu tiên' },
      })
    );

    const closeBtn = within(dialog).getByRole('button', { name: /Đóng xem ảnh/i });
    await user.click(closeBtn);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  test('reveals love letter paragraphs and signature only after tapping the sealed envelope and records letter_opened', async () => {
    const user = userEvent.setup();
    render(<StoryExperience data={SAMPLE_DATA} currentUser={VIEWER_USER} />);

    expect(screen.queryByText('Đoạn thứ nhất của bức thư.')).not.toBeInTheDocument();

    const openBtn = screen.getByRole('button', { name: /Chạm để mở thư/i });
    await user.click(openBtn);

    expect(await screen.findByText('Gửi em yêu của anh,')).toBeInTheDocument();
    expect(screen.getByText('Đoạn thứ nhất của bức thư.')).toBeInTheDocument();
    expect(screen.getByText('Đoạn thứ hai đầy thương nhớ.')).toBeInTheDocument();
    expect(screen.getByText(/Thương em, Minh/)).toBeInTheDocument();

    const activities = getActivityCalls(fetchSpy);
    expect(activities).toContainEqual(
      expect.objectContaining({
        eventType: 'letter_opened',
      })
    );
  });

  test('StoryExperience renders role topbar with /admin link for admin, omits it for viewer, toggles music telemetry, replays PixelHeartIntro, and logs out', async () => {
    const user = userEvent.setup();
    const { rerender } = render(
      <StoryExperience
        data={SAMPLE_DATA}
        currentUser={ADMIN_USER}
        viewerPasscodeEnabled={true}
      />
    );

    expect(screen.getByText('Anh · Quản trị')).toBeInTheDocument();
    const adminLink = screen.getByRole('link', { name: /Quản trị/i });
    expect(adminLink).toHaveAttribute('href', '/admin');
    expect(screen.getByRole('button', { name: /Bật nhạc nền/i })).toBeInTheDocument();

    // Music toggle telemetry + reduced-motion safety on pulse icon
    vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue();
    vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {});
    await user.click(screen.getByRole('button', { name: /Bật nhạc nền/i }));
    const pauseMusicBtn = screen.getByRole('button', { name: /Tạm dừng nhạc nền/i });
    expect(pauseMusicBtn.querySelector('svg')).toHaveClass('motion-reduce:animate-none');
    expect(getActivityCalls(fetchSpy)).toContainEqual(
      expect.objectContaining({ eventType: 'music_toggled' })
    );

    // Replay Pixel Heart modal + Escape close
    await user.click(screen.getByRole('button', { name: /Ngắm lại trái tim pixel/i }));
    const heartDialog = await screen.findByRole('dialog');
    const replayCanvas = within(heartDialog).getByRole('img', {
      name: /Trái tim pixel đang ghép nối và đập nhịp yêu thương/i,
    });
    expect(replayCanvas.tagName).toBe('CANVAS');
    expect(getActivityCalls(fetchSpy)).toContainEqual(
      expect.objectContaining({ eventType: 'pixel_heart_viewed' })
    );
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

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

  test('StoryExperience sends page_visit once per tab session for current user', () => {
    const { rerender } = render(<StoryExperience data={SAMPLE_DATA} currentUser={VIEWER_USER} />);
    expect(getActivityCalls(fetchSpy).filter((c) => c.eventType === 'page_visit')).toHaveLength(1);

    rerender(<StoryExperience data={SAMPLE_DATA} currentUser={VIEWER_USER} />);
    expect(getActivityCalls(fetchSpy).filter((c) => c.eventType === 'page_visit')).toHaveLength(1);
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
      name: /Mở khóa miền ký ức của tụi mình/i,
    });
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
    await screen.findByRole('button', { name: /Mở khóa miền ký ức của tụi mình/i });

    fireEvent(window, new Event('pagehide'));
    expect(sendBeaconMock).not.toHaveBeenCalled();
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
    expect(canvas.closest('.glass-card')).toHaveClass('pt-10');
    expect(screen.getByText(/Dành riêng cho Em bé thương yêu/).parentElement).toHaveClass(
      'max-w-[74%]'
    );

    await user.click(
      screen.getByRole('button', { name: /Mở khóa miền ký ức của tụi mình/i })
    );
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
});
