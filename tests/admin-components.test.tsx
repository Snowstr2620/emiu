import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { AdminDashboard } from '@/components/admin/AdminDashboard';
import { AdminLoginForm } from '@/components/admin/AdminLoginForm';
import type {
  ActivityEventType,
  ActivityLogItem,
  AdminSiteData,
  SafeAppUser,
  StorageStatus,
} from '@/types/memories';

const mockHeicTo = vi.fn(async () => new Blob([new Uint8Array([9, 9])], { type: 'image/jpeg' }));
vi.mock('heic-to/next', () => ({ heicTo: mockHeicTo }));

const mockPush = vi.fn();
const mockRefresh = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    refresh: mockRefresh,
    replace: vi.fn(),
  }),
}));

const ADMIN_USER: SafeAppUser = {
  id: '00000000-0000-4000-8000-000000000001',
  username: 'admin',
  displayName: 'Anh · Chủ vườn ký ức',
  role: 'admin',
  otpHint: 'Ngày lễ tình nhân 14/02/26',
  isActive: true,
  sessionVersion: 1,
  hasPassword: true,
  hasOtp: true,
  lastLoginAt: '2026-11-15T10:05:30.000Z',
  createdAt: '2026-11-15T00:00:00.000Z',
  updatedAt: '2026-11-15T00:00:00.000Z',
};

const VIEWER_USER: SafeAppUser = {
  id: '00000000-0000-4000-8000-000000000002',
  username: 'nguoithuong',
  displayName: 'Em bé thương yêu',
  role: 'viewer',
  otpHint: 'Ngày đầu tiên mình nắm tay nhau (12/10/24)',
  isActive: true,
  sessionVersion: 2,
  hasPassword: true,
  hasOtp: true,
  lastLoginAt: '2026-11-15T18:05:30.000Z',
  createdAt: '2026-11-15T00:00:00.000Z',
  updatedAt: '2026-11-15T00:00:00.000Z',
};

const SECOND_ADMIN_USER: SafeAppUser = {
  id: '00000000-0000-4000-8000-000000000003',
  username: 'admin2',
  displayName: 'Quản trị phụ',
  role: 'admin',
  otpHint: 'Mã phụ 6 số',
  isActive: true,
  sessionVersion: 1,
  hasPassword: true,
  hasOtp: true,
  lastLoginAt: null,
  createdAt: '2026-11-15T00:00:00.000Z',
  updatedAt: '2026-11-15T00:00:00.000Z',
};

const SAMPLE_LOGS: ActivityLogItem[] = [
  {
    id: 'log-1',
    userId: VIEWER_USER.id,
    username: 'nguoithuong',
    userRole: 'viewer',
    eventType: 'otp_verified',
    detail: 'Xác thực OTP thành công để mở miền ký ức',
    deviceSummary: 'Safari · iPhone',
    metadata: null,
    createdAt: '2026-11-15T10:05:30.000Z', // 17:05:30 15/11/2026 VN (UTC+7)
  },
  {
    id: 'log-2',
    userId: null,
    username: 'khach',
    userRole: 'guest',
    eventType: 'login_failed',
    detail: 'Sai mật khẩu khi đăng nhập cổng ký ức',
    deviceSummary: 'Chrome · macOS',
    metadata: null,
    createdAt: '2026-11-15T18:05:30.000Z', // 01:05:30 16/11/2026 VN (UTC+7)
  },
  {
    id: 'log-3',
    userId: ADMIN_USER.id,
    username: 'admin',
    userRole: 'admin',
    eventType: 'memory_viewed',
    detail: 'Xem ảnh: Buổi chiều mưa đầu tiên',
    deviceSummary: 'Chrome · macOS',
    metadata: { memoryId: 'mem-1' },
    createdAt: '2026-11-15T08:00:00.000Z',
  },
];

const STORAGE_STATUS: StorageStatus = {
  mode: 'local',
  readOnlyServerlessWarning: false,
  usingDefaultAdminPassword: false,
  usingDefaultSessionSecret: false,
};

function makeInitialData(overrides?: Partial<AdminSiteData>): AdminSiteData {
  return {
    settings: {
      coupleTitle: 'Anh & Em · Chung Một Nhịp Tim',
      heroSubtitle: 'Mỗi ngày bên em đều là một kỷ niệm dịu dàng.',
      loveStartDate: '2024-10-12',
      musicUrl: '/samples/gentle-memories.wav',
      musicEnabled: true,
      letterTitle: 'Gửi em bé thương yêu,',
      letterBody: 'Đoạn thứ nhất.\n\nĐoạn thứ hai.',
      letterSignature: 'Thương em mãi mãi',
      viewerPasscodeEnabled: true,
      updatedAt: '2026-11-15T00:00:00.000Z',
    },
    memories: [
      {
        id: 'mem-1',
        memoryDate: '2024-10-12',
        title: 'Chiều mưa đầu tiên',
        story: 'Ngồi bên nhau uống trà ấm.',
        imageUrl: '/samples/memory-1.svg',
        imageAlt: 'Chiều mưa đầu tiên',
        sortOrder: 0,
        createdAt: '2026-11-15T00:00:00.000Z',
      },
    ],
    diaryEntries: [
      {
        id: 'diary-v1',
        entryDate: '2026-11-16',
        title: 'Trang viết của Em',
        content: 'Hôm nay trời nắng đẹp, nhớ anh.',
        mood: 'loved',
        imageUrl: '',
        imageAlt: '',
        authorId: VIEWER_USER.id,
        authorUsername: 'nguoithuong',
        authorDisplayName: VIEWER_USER.displayName,
        authorRole: 'viewer',
        createdAt: '2026-11-16T10:00:00.000Z',
        updatedAt: '2026-11-16T10:00:00.000Z',
      },
    ],
    users: [ADMIN_USER, VIEWER_USER],
    activityLogs: SAMPLE_LOGS,
    trafficSummary: {
      visitsToday: 12,
      otpVerifiedToday: 4,
      failedAuthToday: 2,
      activeUsersCount: 2,
    },
    currentUser: ADMIN_USER,
    ...overrides,
  };
}

describe('AdminLoginForm', () => {
  let fetchSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockPush.mockReset();
    mockRefresh.mockReset();
    fetchSpy = vi.fn(async () => new Response(JSON.stringify({ ok: true }), { status: 200 }));
    vi.stubGlobal('fetch', fetchSpy);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  test('defaults username to admin, validates required fields, and posts { username, password } to /api/admin/login', async () => {
    const user = userEvent.setup();
    render(<AdminLoginForm showDevDefaultHint={false} />);

    const usernameInput = screen.getByLabelText(/Tài khoản quản trị/i);
    const passwordInput = screen.getByLabelText(/Mật khẩu quản trị/i);
    const submitBtn = screen.getByRole('button', { name: /Vào trang quản trị/i });

    expect(usernameInput).toHaveValue('admin');
    expect(usernameInput).toHaveAttribute('id', 'admin-username');
    expect(usernameInput).toHaveAttribute('autocomplete', 'username');
    expect(submitBtn).toBeDisabled();

    // Clearing username keeps submit disabled even when password is provided
    await user.clear(usernameInput);
    await user.type(passwordInput, 'secret-pass');
    expect(submitBtn).toBeDisabled();

    // Edits username (with whitespace/uppercase) and submits normalized payload
    await user.type(usernameInput, '  AdminMaster  ');
    expect(submitBtn).toBeEnabled();
    await user.click(submitBtn);

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledWith(
        '/api/admin/login',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: 'adminmaster', password: 'secret-pass' }),
        })
      );
    });
    expect(mockPush).toHaveBeenCalledWith('/admin');
    expect(mockRefresh).toHaveBeenCalledTimes(1);
  });

  test('shows error alert on failed login response', async () => {
    const user = userEvent.setup();
    fetchSpy.mockResolvedValueOnce(
      new Response(JSON.stringify({ error: 'Tài khoản hoặc mật khẩu quản trị chưa đúng.' }), {
        status: 401,
      })
    );

    render(<AdminLoginForm showDevDefaultHint={false} />);
    await user.type(screen.getByLabelText(/Mật khẩu quản trị/i), 'wrong-pass');
    await user.click(screen.getByRole('button', { name: /Vào trang quản trị/i }));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Tài khoản hoặc mật khẩu quản trị chưa đúng.');
    expect(mockPush).not.toHaveBeenCalled();
  });

  test('shows network error alert when /api/admin/login fetch rejects', async () => {
    const user = userEvent.setup();
    fetchSpy.mockRejectedValueOnce(new Error('Network down'));

    render(<AdminLoginForm showDevDefaultHint={false} />);
    await user.type(screen.getByLabelText(/Mật khẩu quản trị/i), 'secret-pass');
    await user.click(screen.getByRole('button', { name: /Vào trang quản trị/i }));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Không thể kết nối máy chủ. Vui lòng thử lại.');
  });

  test('gates dev default hint by both showDevDefaultHint and non-production NODE_ENV', () => {
    vi.stubEnv('NODE_ENV', 'development');
    const { rerender } = render(<AdminLoginForm showDevDefaultHint={true} />);
    expect(screen.getByText('love2026')).toBeInTheDocument();
    expect(screen.getByText('admin')).toBeInTheDocument();

    rerender(<AdminLoginForm showDevDefaultHint={false} />);
    expect(screen.queryByText('love2026')).not.toBeInTheDocument();

    vi.stubEnv('NODE_ENV', 'production');
    rerender(<AdminLoginForm showDevDefaultHint={true} />);
    expect(screen.queryByText('love2026')).not.toBeInTheDocument();
  });

  test('renders in Pale Yellow & Red Hearts theme with zero sky/indigo/blue/violet/purple/slate/bg-white classes', () => {
    vi.stubEnv('NODE_ENV', 'development');
    const { container } = render(<AdminLoginForm showDevDefaultHint={true} />);

    expect(container.firstElementChild).toHaveClass('overflow-x-hidden');

    const usernameInput = screen.getByLabelText(/Tài khoản quản trị/i);
    const passwordInput = screen.getByLabelText(/Mật khẩu quản trị/i);
    expect(usernameInput).toHaveClass(
      'bg-[#FFFDF5]',
      'text-stone-900',
      'text-base',
      'sm:text-sm',
      'placeholder:text-stone-500'
    );
    expect(passwordInput).toHaveClass(
      'bg-[#FFFDF5]',
      'text-stone-900',
      'text-base',
      'sm:text-sm',
      'placeholder:text-stone-500'
    );

    const backLink = screen.getByRole('link', { name: /Về trang kỷ niệm/i });
    expect(backLink).toHaveClass(
      'focus-visible:outline-none',
      'focus-visible:ring-2',
      'focus-visible:ring-red-500'
    );
    const heartWrapper = backLink.nextElementSibling as HTMLElement;
    expect(heartWrapper).toHaveClass('shrink-0');
    expect(heartWrapper.querySelector('svg')).toHaveClass('fill-red-500', 'text-red-500');

    const submitBtn = screen.getByRole('button', { name: /Vào trang quản trị/i });
    expect(submitBtn).toHaveClass(
      'to-red-500',
      'text-white',
      'hover:shadow-[0_14px_34px_rgba(220,38,38,0.38)]',
      'hover:ring-1',
      'hover:ring-red-300',
      'focus-visible:outline-none',
      'focus-visible:ring-2',
      'focus-visible:ring-red-500'
    );
    expect(submitBtn).not.toHaveClass('hover:brightness-110');

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
    expect(container.innerHTML.toLowerCase()).not.toContain('#bae6fd');
  });
});

describe('AdminDashboard 5-tab UI', () => {
  let fetchSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockPush.mockReset();
    mockRefresh.mockReset();
    fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  test('renders 5 responsive tabs with aria-current, persistent live region, current user header badge, and non-overflowing layout structure', () => {
    const initialWithBlankAlt = makeInitialData({
      memories: [
        {
          ...makeInitialData().memories[0],
          imageAlt: '',
        },
      ],
    });
    const { container } = render(
      <AdminDashboard initialData={initialWithBlankAlt} storageStatus={STORAGE_STATUS} />
    );

    expect(screen.getByText('Anh · Chủ vườn ký ức')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Xem trang chính/i }).parentElement).toHaveClass(
      'sm:shrink-0'
    );
    expect(container.querySelector('[aria-live="polite"]')).toBeInTheDocument();

    const nav = screen.getByRole('navigation', { name: /Mục quản trị/i });
    const memoriesTab = within(nav).getByRole('button', { name: /Kỷ niệm & Ảnh/i });
    const settingsTab = within(nav).getByRole('button', {
      name: /Mở đầu, Nhạc nền & Riêng tư/i,
    });
    const letterTab = within(nav).getByRole('button', { name: /Phong thư tâm sự/i });
    const usersTab = within(nav).getByRole('button', {
      name: /Tài khoản & Kiểm soát truy cập/i,
    });
    const activityTab = within(nav).getByRole('button', {
      name: /Nhật ký ra vào & Hành động/i,
    });

    expect(memoriesTab).toHaveAttribute('aria-current', 'page');
    for (const inactive of [settingsTab, letterTab, usersTab, activityTab]) {
      expect(inactive).not.toHaveAttribute('aria-current');
    }

    expect(container.firstElementChild).toHaveClass('overflow-x-hidden');

    // Tab 1 (memories) renders existing memory with title alt fallback & >=40px editor trigger
    expect(screen.getByText('Chiều mưa đầu tiên')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Chiều mưa đầu tiên' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Thêm kỷ niệm mới/i })).toHaveClass('min-h-[40px]');
  });

  test('Tab 3 love letter live preview stays intact', async () => {
    const user = userEvent.setup();
    render(<AdminDashboard initialData={makeInitialData()} storageStatus={STORAGE_STATUS} />);

    await user.click(screen.getByRole('button', { name: /Phong thư tâm sự/i }));
    const titleInput = screen.getByLabelText(/Tiêu đề bức thư/i);
    await user.clear(titleInput);
    await user.type(titleInput, 'Gửi em yêu dấu,');
    expect(screen.getByRole('heading', { name: 'Gửi em yêu dấu,' })).toBeInTheDocument();
  });

  test('Tab 2 builds a music playlist (upload, link, reorder, remove) and saves it in order', async () => {
    const user = userEvent.setup();
    vi.stubGlobal('URL', {
      ...URL,
      createObjectURL: vi.fn(() => 'blob:mock-audio'),
      revokeObjectURL: vi.fn(),
    });
    const initial = makeInitialData();
    let uploadCount = 0;
    fetchSpy.mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.toString();
      if (url === '/api/admin/upload-url') {
        return new Response(
          JSON.stringify({ mode: 'local', uploadEndpoint: '/api/admin/upload' }),
          { status: 200 }
        );
      }
      if (url === '/api/admin/upload' && init?.method === 'POST') {
        uploadCount += 1;
        return new Response(
          JSON.stringify({ publicUrl: `/uploads/1731840000000-aaaa111${uploadCount}-song-${uploadCount}.mp3` }),
          { status: 200 }
        );
      }
      if (url === '/api/admin/settings') {
        const body = JSON.parse(String(init?.body));
        return new Response(
          JSON.stringify({ settings: { ...initial.settings, ...body } }),
          { status: 200 }
        );
      }
      return new Response(JSON.stringify({ error: 'Unexpected' }), { status: 500 });
    });

    render(<AdminDashboard initialData={initial} storageStatus={STORAGE_STATUS} />);
    await user.click(screen.getByRole('button', { name: /Mở đầu, Nhạc nền & Riêng tư/i }));

    // Starts with the saved sample track
    expect(screen.getAllByTestId('playlist-track')).toHaveLength(1);

    // Upload two songs at once
    const fileInput = screen
      .getByText(/Tải file nhạc/i)
      .closest('label')!
      .querySelector('input[type="file"]') as HTMLInputElement;
    expect(fileInput).toHaveAttribute('multiple');
    await user.upload(fileInput, [
      new File(['a'], 'em-oi.mp3', { type: 'audio/mpeg' }),
      new File(['b'], 'mua-he.mp3', { type: 'audio/mpeg' }),
    ]);

    // Add a link with Enter
    const linkInput = screen.getByLabelText(/Đường dẫn nhạc nền/i);
    await user.type(linkInput, 'https://cdn.example.com/music/dem-trang.m4a{Enter}');

    let tracks = screen.getAllByTestId('playlist-track');
    expect(tracks).toHaveLength(4);
    expect(within(tracks[1]).getByText('em-oi.mp3')).toBeInTheDocument();
    expect(within(tracks[1]).getByText('Chưa lưu')).toBeInTheDocument();
    expect(within(tracks[3]).getByText('dem-trang.m4a')).toBeInTheDocument();

    // Remove the sample, then move the link to the top
    await user.click(screen.getByRole('button', { name: 'Xoá bài 1 khỏi danh sách' }));
    await user.click(screen.getByRole('button', { name: 'Đưa bài 3 lên trên' }));
    await user.click(screen.getByRole('button', { name: 'Đưa bài 2 lên trên' }));
    tracks = screen.getAllByTestId('playlist-track');
    expect(within(tracks[0]).getByText('dem-trang.m4a')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Lưu cài đặt/i }));

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledWith(
        '/api/admin/settings',
        expect.objectContaining({ method: 'PUT' })
      );
    });
    const settingsCall = fetchSpy.mock.calls.find(([url]) => url === '/api/admin/settings');
    const sentBody = JSON.parse(String((settingsCall?.[1] as RequestInit).body));
    expect(sentBody.musicPlaylist).toEqual([
      'https://cdn.example.com/music/dem-trang.m4a',
      '/uploads/1731840000000-aaaa1111-song-1.mp3',
      '/uploads/1731840000000-aaaa1112-song-2.mp3',
    ]);
    expect(sentBody.musicUrl).toBe('https://cdn.example.com/music/dem-trang.m4a');

    // After saving, uploaded tracks are no longer marked as unsaved
    await waitFor(() => {
      expect(screen.queryByText('Chưa lưu')).not.toBeInTheDocument();
    });
    expect(screen.getByText('song-1.mp3')).toBeInTheDocument();
  });

  test('Tab 2 saves settings without legacy viewerPasscode and offers quick jump to Tab 4', async () => {
    const user = userEvent.setup();
    const initial = makeInitialData();
    fetchSpy.mockResolvedValueOnce(
      new Response(JSON.stringify({ settings: initial.settings }), { status: 200 })
    );

    render(<AdminDashboard initialData={initial} storageStatus={STORAGE_STATUS} />);

    await user.click(screen.getByRole('button', { name: /Mở đầu, Nhạc nền & Riêng tư/i }));

    const toggle = screen.getByRole('checkbox', {
      name: /Khoá bảo vệ trang kỷ niệm \(Đăng nhập \+ OTP 6 số\)/i,
    });
    expect(toggle).toBeChecked();
    expect(
      screen.queryByPlaceholderText(/Nhập mã mở khoá|Nhập mã mới nếu muốn thay đổi/i)
    ).not.toBeInTheDocument();

    await user.click(toggle);
    await user.click(screen.getByRole('button', { name: /Lưu cài đặt/i }));

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledWith(
        '/api/admin/settings',
        expect.objectContaining({ method: 'PUT' })
      );
    });

    const settingsCall = fetchSpy.mock.calls.find(([url]) => url === '/api/admin/settings');
    const sentBody = JSON.parse(String((settingsCall?.[1] as RequestInit).body));
    expect(sentBody.viewerPasscodeEnabled).toBe(false);
    expect('viewerPasscode' in sentBody).toBe(false);

    // Quick jump button moves to Tab 4
    await user.click(
      screen.getByRole('button', { name: /Đi tới quản lý tài khoản & OTP/i })
    );
    expect(screen.getByText(/Tạo tài khoản mới/i)).toBeInTheDocument();
  });

  test('Tab 4 enforces self & sole-active-admin guards and supports create, edit, lock/unlock, revoke session, and 2-click inline delete', async () => {
    const user = userEvent.setup();
    const createdViewer: SafeAppUser = {
      id: '00000000-0000-4000-8000-000000000099',
      username: 'emyeu2',
      displayName: 'Cô gái nhỏ',
      role: 'viewer',
      otpHint: 'Sinh nhật em',
      isActive: true,
      sessionVersion: 1,
      hasPassword: true,
      hasOtp: true,
      lastLoginAt: null,
      createdAt: '2026-11-15T00:00:00.000Z',
      updatedAt: '2026-11-15T00:00:00.000Z',
    };

    fetchSpy.mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.toString();
      const method = init?.method || 'GET';
      if (url === '/api/admin/users' && method === 'POST') {
        return new Response(JSON.stringify({ user: createdViewer }), { status: 201 });
      }
      if (url === `/api/admin/users/${VIEWER_USER.id}` && method === 'PATCH') {
        const body = JSON.parse(String(init?.body || '{}'));
        if (body.revokeSession) {
          return new Response(
            JSON.stringify({ user: { ...VIEWER_USER, sessionVersion: 3 } }),
            { status: 200 }
          );
        }
        if (typeof body.isActive === 'boolean') {
          return new Response(
            JSON.stringify({ user: { ...VIEWER_USER, isActive: body.isActive } }),
            { status: 200 }
          );
        }
        return new Response(
          JSON.stringify({
            user: {
              ...VIEWER_USER,
              displayName: body.displayName ?? VIEWER_USER.displayName,
              otpHint: body.otpHint ?? VIEWER_USER.otpHint,
            },
          }),
          { status: 200 }
        );
      }
      if (url === `/api/admin/users/${createdViewer.id}` && method === 'DELETE') {
        return new Response(JSON.stringify({ ok: true }), { status: 200 });
      }
      return new Response(JSON.stringify({ error: 'Unexpected call' }), { status: 500 });
    });

    render(<AdminDashboard initialData={makeInitialData()} storageStatus={STORAGE_STATUS} />);

    await user.click(
      screen.getByRole('button', { name: /Tài khoản & Kiểm soát truy cập/i })
    );

    const adminCard = screen.getByTestId(`user-card-${ADMIN_USER.id}`);
    expect(within(adminCard).getByText(/Đang đăng nhập/i)).toBeInTheDocument();
    expect(within(adminCard).getByRole('button', { name: /^Khoá$/i })).toBeDisabled();
    expect(within(adminCard).getByRole('button', { name: /Thu hồi phiên/i })).toBeDisabled();
    expect(within(adminCard).getByRole('button', { name: /^Xoá$/i })).toBeDisabled();

    // Viewer card actions are enabled
    const viewerCard = screen.getByTestId(`user-card-${VIEWER_USER.id}`);
    expect(within(viewerCard).getByText(/Em bé thương yêu/i)).toBeInTheDocument();
    expect(within(viewerCard).getByText(/@nguoithuong/i)).toBeInTheDocument();
    expect(within(viewerCard).getByText(/Đang hoạt động/i)).toBeInTheDocument();
    expect(within(viewerCard).getByText(/01:05:30 16\/11\/2026/)).toBeInTheDocument();

    // Create new user
    await user.type(screen.getByLabelText(/^Tên đăng nhập$/i), 'EmYeu2');
    await user.type(screen.getByLabelText(/Tên hiển thị ngọt ngào/i), 'Cô gái nhỏ');
    await user.selectOptions(screen.getByLabelText(/^Vai trò$/i), 'viewer');
    await user.type(screen.getByLabelText(/^Mật khẩu$/i), 'secret123');
    await user.type(screen.getByLabelText(/Mã OTP 6 số/i), '251225');
    await user.type(screen.getByLabelText(/Gợi ý OTP/i), 'Sinh nhật em');
    await user.click(screen.getByRole('button', { name: /Tạo tài khoản/i }));

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledWith(
        '/api/admin/users',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            username: 'emyeu2',
            displayName: 'Cô gái nhỏ',
            role: 'viewer',
            password: 'secret123',
            otpCode: '251225',
            otpHint: 'Sinh nhật em',
            isActive: true,
          }),
        })
      );
    });
    expect(await screen.findByText(/Cô gái nhỏ/i)).toBeInTheDocument();

    // Inline edit viewer
    await user.click(within(viewerCard).getByRole('button', { name: /^Sửa$/i }));
    const editDisplayInput = within(viewerCard).getByLabelText(/Tên hiển thị/i);
    await user.clear(editDisplayInput);
    await user.type(editDisplayInput, 'Công chúa bé nhỏ');
    await user.click(within(viewerCard).getByRole('button', { name: /Lưu thay đổi/i }));

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledWith(
        `/api/admin/users/${VIEWER_USER.id}`,
        expect.objectContaining({
          method: 'PATCH',
          body: expect.stringContaining('Công chúa bé nhỏ'),
        })
      );
    });
    expect(await within(viewerCard).findByText('Công chúa bé nhỏ')).toBeInTheDocument();

    // Revoke session
    await user.click(within(viewerCard).getByRole('button', { name: /Thu hồi phiên/i }));
    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledWith(
        `/api/admin/users/${VIEWER_USER.id}`,
        expect.objectContaining({
          method: 'PATCH',
          body: JSON.stringify({ revokeSession: true }),
        })
      );
    });
    expect(await within(viewerCard).findByText(/v3/i)).toBeInTheDocument();

    // Lock viewer
    await user.click(within(viewerCard).getByRole('button', { name: /^Khoá$/i }));
    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledWith(
        `/api/admin/users/${VIEWER_USER.id}`,
        expect.objectContaining({
          method: 'PATCH',
          body: JSON.stringify({ isActive: false }),
        })
      );
    });
    expect(await within(viewerCard).findByText(/Đã tạm khoá/i)).toBeInTheDocument();

    // Unlock viewer again and verify status returns to active
    await user.click(within(viewerCard).getByRole('button', { name: /Mở khoá/i }));
    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledWith(
        `/api/admin/users/${VIEWER_USER.id}`,
        expect.objectContaining({
          method: 'PATCH',
          body: JSON.stringify({ isActive: true }),
        })
      );
    });
    expect(await within(viewerCard).findByText(/Đang hoạt động/i)).toBeInTheDocument();

    // 2-click inline delete on newly created user (no window.confirm)
    const createdCard = screen.getByTestId(`user-card-${createdViewer.id}`);
    await user.click(within(createdCard).getByRole('button', { name: /^Xoá$/i }));
    await user.click(within(createdCard).getByRole('button', { name: /Xác nhận xoá/i }));

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledWith(
        `/api/admin/users/${createdViewer.id}`,
        expect.objectContaining({ method: 'DELETE' })
      );
    });
    expect(screen.queryByTestId(`user-card-${createdViewer.id}`)).not.toBeInTheDocument();

    // Active users count updates live when switching to Tab 5 (ADMIN_USER + VIEWER_USER -> 2)
    await user.click(
      screen.getByRole('button', { name: /Nhật ký ra vào & Hành động/i })
    );
    const activeStatCard = screen.getByTestId('stat-active-users');
    expect(within(activeStatCard).getByText('2')).toBeInTheDocument();
  });

  test('Tab 4 disables Lock/Delete on sole active admin even when another admin is inactive or when non-self sole admin', async () => {
    const user = userEvent.setup();
    const inactiveSecondAdmin: SafeAppUser = { ...SECOND_ADMIN_USER, isActive: false };
    render(
      <AdminDashboard
        initialData={makeInitialData({
          users: [ADMIN_USER, inactiveSecondAdmin, VIEWER_USER],
          currentUser: VIEWER_USER,
        })}
        storageStatus={STORAGE_STATUS}
      />
    );

    const nav = screen.getByRole('navigation', { name: /Mục quản trị/i });
    await user.click(
      within(nav).getByRole('button', { name: /Tài khoản & Kiểm soát truy cập/i })
    );

    // Even when viewing as non-self, sole active admin cannot be locked or deleted
    const soleActiveAdminCard = screen.getByTestId(`user-card-${ADMIN_USER.id}`);
    expect(within(soleActiveAdminCard).getByRole('button', { name: /^Khoá$/i })).toBeDisabled();
    expect(within(soleActiveAdminCard).getByRole('button', { name: /^Xoá$/i })).toBeDisabled();
    // Inactive second admin CAN be unlocked or deleted
    const inactiveAdminCard = screen.getByTestId(`user-card-${inactiveSecondAdmin.id}`);
    expect(within(inactiveAdminCard).getByRole('button', { name: /Mở khoá/i })).toBeEnabled();
    expect(within(inactiveAdminCard).getByRole('button', { name: /^Xoá$/i })).toBeEnabled();
  });

  test('Tab 5 displays 4 traffic stat cards, Vietnam-timezone activity logs, mobile/desktop responsive wrappers, and filter refresh GET /api/admin/activity', async () => {
    const user = userEvent.setup();
    const filteredLog: ActivityLogItem = {
      id: 'log-filtered',
      userId: VIEWER_USER.id,
      username: 'nguoithuong',
      userRole: 'viewer',
      eventType: 'otp_failed',
      detail: 'Nhập sai mã OTP lần 1',
      deviceSummary: 'Safari · iPhone',
      metadata: null,
      createdAt: '2026-11-15T12:30:00.000Z', // 19:30:00 15/11/2026 VN
    };

    fetchSpy.mockResolvedValue(
      new Response(
        JSON.stringify({
          logs: [filteredLog],
          trafficSummary: {
            visitsToday: 15,
            otpVerifiedToday: 5,
            failedAuthToday: 3,
            activeUsersCount: 2,
          },
        }),
        { status: 200 }
      )
    );

    render(<AdminDashboard initialData={makeInitialData()} storageStatus={STORAGE_STATUS} />);

    await user.click(
      screen.getByRole('button', { name: /Nhật ký ra vào & Hành động/i })
    );

    // 4 summary cards
    expect(within(screen.getByTestId('stat-visits-today')).getByText('12')).toBeInTheDocument();
    expect(within(screen.getByTestId('stat-otp-verified')).getByText('4')).toBeInTheDocument();
    expect(within(screen.getByTestId('stat-failed-auth')).getByText('2')).toBeInTheDocument();
    expect(within(screen.getByTestId('stat-active-users')).getByText('2')).toBeInTheDocument();

    // Responsive containers: mobile cards (< md) and overflow-x-auto desktop table (>= md)
    const mobileList = screen.getByTestId('activity-mobile-list');
    const desktopWrapper = screen.getByTestId('activity-desktop-table');
    expect(mobileList).toHaveClass('md:hidden');
    expect(desktopWrapper).toHaveClass('overflow-x-auto');

    // Vietnam-timezone timestamps (UTC+7)
    expect(within(desktopWrapper).getByText('17:05:30 15/11/2026')).toBeInTheDocument();
    expect(within(desktopWrapper).getByText('01:05:30 16/11/2026')).toBeInTheDocument();
    expect(within(mobileList).getByText('17:05:30 15/11/2026')).toBeInTheDocument();

    // Filters + Refresh call GET /api/admin/activity
    await user.selectOptions(screen.getByLabelText(/Loại hành động/i), 'otp_failed');
    await user.selectOptions(screen.getByLabelText(/Lọc tài khoản/i), 'nguoithuong');
    await user.type(screen.getByLabelText(/Tìm kiếm nhật ký/i), 'iPhone');
    await user.selectOptions(screen.getByLabelText(/Giới hạn/i), '50');
    await user.click(screen.getByRole('button', { name: /Làm mới/i }));

    await waitFor(() => {
      const activityUrls = fetchSpy.mock.calls
        .map(([u]) => String(u))
        .filter((u) => u.startsWith('/api/admin/activity'));
      const lastUrl = activityUrls[activityUrls.length - 1];
      expect(lastUrl).toBeDefined();
      const parsed = new URL(lastUrl, 'http://localhost');
      expect(parsed.searchParams.get('eventType')).toBe('otp_failed');
      expect(parsed.searchParams.get('username')).toBe('nguoithuong');
      expect(parsed.searchParams.get('search')).toBe('iPhone');
      expect(parsed.searchParams.get('limit')).toBe('50');
    });

    expect(
      await within(desktopWrapper).findByText('Nhập sai mã OTP lần 1')
    ).toBeInTheDocument();
    expect(within(desktopWrapper).getByText('19:30:00 15/11/2026')).toBeInTheDocument();
    expect(within(screen.getByTestId('stat-visits-today')).getByText('15')).toBeInTheDocument();
  });

  test('Tab 4 syncs header currentUser badge on self-edit, omits blank password/otpCode, rejects whitespace-only password client-side, and explains locked role', async () => {
    const user = userEvent.setup();
    let capturedPatchBody: Record<string, unknown> | null = null;

    fetchSpy.mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.toString();
      if (url === `/api/admin/users/${ADMIN_USER.id}` && init?.method === 'PATCH') {
        capturedPatchBody = JSON.parse(String(init.body || '{}')) as Record<string, unknown>;
        return new Response(
          JSON.stringify({
            user: {
              ...ADMIN_USER,
              displayName: String(capturedPatchBody.displayName ?? ADMIN_USER.displayName),
            },
          }),
          { status: 200 }
        );
      }
      return new Response(JSON.stringify({ error: 'Unexpected call' }), { status: 500 });
    });

    render(<AdminDashboard initialData={makeInitialData()} storageStatus={STORAGE_STATUS} />);

    const header = screen.getByRole('banner');
    expect(within(header).getByText(ADMIN_USER.displayName)).toBeInTheDocument();

    await user.click(
      screen.getByRole('button', { name: /Tài khoản & Kiểm soát truy cập/i })
    );

    const adminCard = screen.getByTestId(`user-card-${ADMIN_USER.id}`);
    await user.click(within(adminCard).getByRole('button', { name: /^Sửa$/i }));

    // Disabled role selector exposes tooltip & helper note explaining why role change is locked
    const roleSelect = within(adminCard).getByLabelText(/^Vai trò$/i);
    expect(roleSelect).toBeDisabled();
    expect(roleSelect).toHaveAttribute(
      'title',
      expect.stringContaining('tài khoản đang đăng nhập')
    );

    // Input length constraints align with server validation limits
    const editDisplayInput = within(adminCard).getByLabelText(/Tên hiển thị/i);
    const editPasswordInput = within(adminCard).getByLabelText(/Mật khẩu mới/i);
    const editHintInput = within(adminCard).getByLabelText(/Gợi ý OTP/i);
    expect(editDisplayInput).toHaveAttribute('maxLength', '60');
    expect(editPasswordInput).toHaveAttribute('maxLength', '128');
    expect(editHintInput).toHaveAttribute('maxLength', '120');

    // Whitespace-only password (6 spaces) is rejected client-side without calling PATCH
    await user.type(editPasswordInput, '      ');
    await user.click(within(adminCard).getByRole('button', { name: /Lưu thay đổi/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/khoảng trắng|6–128/i);
    expect(fetchSpy).not.toHaveBeenCalled();

    // Clear password, keep otpCode blank, update displayName -> omits password & otpCode keys and syncs header badge
    await user.clear(editPasswordInput);
    await user.clear(editDisplayInput);
    await user.type(editDisplayInput, 'Anh · Chủ Vườn Mới');
    await user.click(within(adminCard).getByRole('button', { name: /Lưu thay đổi/i }));

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledTimes(1);
    });
    expect(capturedPatchBody).not.toBeNull();
    expect('password' in capturedPatchBody!).toBe(false);
    expect('otpCode' in capturedPatchBody!).toBe(false);
    expect(capturedPatchBody!.displayName).toBe('Anh · Chủ Vườn Mới');

    expect(await within(header).findByText('Anh · Chủ Vườn Mới')).toBeInTheDocument();
  });

  test('Tab 5 <select> filter triggers GET /api/admin/activity immediately, shows error notice on failure, and resets username filter when deleted', async () => {
    const user = userEvent.setup();
    let failNextActivity = false;

    fetchSpy.mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.toString();
      if (url.startsWith('/api/admin/activity')) {
        if (failNextActivity) {
          return new Response(JSON.stringify({ error: 'Không thể tải nhật ký lúc này.' }), {
            status: 500,
          });
        }
        return new Response(
          JSON.stringify({
            logs: [],
            trafficSummary: {
              visitsToday: 12,
              otpVerifiedToday: 4,
              failedAuthToday: 2,
              activeUsersCount: 2,
            },
          }),
          { status: 200 }
        );
      }
      if (url === `/api/admin/users/${VIEWER_USER.id}` && init?.method === 'DELETE') {
        return new Response(JSON.stringify({ ok: true }), { status: 200 });
      }
      return new Response(JSON.stringify({ error: 'Unexpected call' }), { status: 500 });
    });

    render(<AdminDashboard initialData={makeInitialData()} storageStatus={STORAGE_STATUS} />);

    // Open Tab 5 and change a <select> filter without clicking Làm mới
    await user.click(
      screen.getByRole('button', { name: /Nhật ký ra vào & Hành động/i })
    );
    await user.selectOptions(screen.getByLabelText(/Lọc tài khoản/i), 'nguoithuong');

    await waitFor(() => {
      const firstActivityUrl = fetchSpy.mock.calls
        .map(([u]) => String(u))
        .find((u) => u.startsWith('/api/admin/activity'));
      expect(firstActivityUrl).toBeDefined();
      const parsed = new URL(firstActivityUrl!, 'http://localhost');
      expect(parsed.searchParams.get('username')).toBe('nguoithuong');
    });

    // Next select filter triggers a failing fetch -> displays error alert notice cleanly inside assertive live region
    failNextActivity = true;
    await user.selectOptions(screen.getByLabelText(/Loại hành động/i), 'otp_failed');
    const errorAlert = await screen.findByRole('alert');
    expect(errorAlert).toHaveTextContent('Không thể tải nhật ký lúc này.');
    expect(errorAlert.parentElement).toHaveAttribute('aria-live', 'assertive');

    // Deleting the currently filtered user in Tab 4 resets Tab 5 username filter back to ''
    await user.click(
      screen.getByRole('button', { name: /Tài khoản & Kiểm soát truy cập/i })
    );
    const viewerCard = screen.getByTestId(`user-card-${VIEWER_USER.id}`);
    await user.click(within(viewerCard).getByRole('button', { name: /^Xoá$/i }));
    await user.click(within(viewerCard).getByRole('button', { name: /Xác nhận xoá/i }));

    await waitFor(() => {
      expect(screen.queryByTestId(`user-card-${VIEWER_USER.id}`)).not.toBeInTheDocument();
    });

    await user.click(
      screen.getByRole('button', { name: /Nhật ký ra vào & Hành động/i })
    );
    expect(screen.getByLabelText(/Lọc tài khoản/i)).toHaveValue('');
  });

  test('Tab 1 supports memory create, edit, sort by date, and 2-click delete with in-flight guard + responsive/floating toast polish', async () => {
    const user = userEvent.setup();
    const secondMemory = {
      id: 'mem-2',
      memoryDate: '2024-05-01',
      title: 'Ngày đầu gặp gỡ',
      story: 'Nắng sớm sân trường.',
      imageUrl: '/samples/memory-2.svg',
      imageAlt: 'Ngày đầu gặp gỡ',
      sortOrder: 1,
      createdAt: '2026-11-15T00:00:00.000Z',
    };
    const createdMemory = {
      id: 'mem-3',
      memoryDate: '2025-08-20',
      title: 'Biển chiều',
      story: 'Sóng hát tên mình.',
      imageUrl: '/samples/memory-3.svg',
      imageAlt: 'Biển chiều',
      sortOrder: 2,
      createdAt: '2026-11-15T00:00:00.000Z',
    };

    let resolveDelete: ((val: Response) => void) | null = null;
    let deleteCount = 0;

    fetchSpy.mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.toString();
      const method = init?.method || 'GET';
      if (url === '/api/admin/memories' && method === 'POST') {
        return new Response(JSON.stringify({ memory: createdMemory }), { status: 201 });
      }
      if (url === `/api/admin/memories/${createdMemory.id}` && method === 'PUT') {
        const body = JSON.parse(String(init?.body || '{}'));
        return new Response(
          JSON.stringify({
            memory: { ...createdMemory, title: body.title, story: body.story },
          }),
          { status: 200 }
        );
      }
      if (url === '/api/admin/memories/reorder' && method === 'PUT') {
        const body = JSON.parse(String(init?.body || '{}')) as { ids: string[] };
        const map = new Map(
          [makeInitialData().memories[0], secondMemory, createdMemory].map((m) => [m.id, m])
        );
        return new Response(
          JSON.stringify({
            memories: body.ids.map((id, idx) => ({ ...map.get(id)!, sortOrder: idx })),
          }),
          { status: 200 }
        );
      }
      if (url === `/api/admin/memories/${createdMemory.id}` && method === 'DELETE') {
        deleteCount++;
        return new Promise<Response>((resolve) => {
          resolveDelete = resolve;
        });
      }
      return new Response(JSON.stringify({ error: 'Unexpected call' }), { status: 500 });
    });

    render(
      <AdminDashboard
        initialData={makeInitialData({
          memories: [makeInitialData().memories[0], secondMemory],
        })}
        storageStatus={STORAGE_STATUS}
      />
    );

    // Navigation tabs meet mobile 44px touch target (>= 42px on sm+)
    const nav = screen.getByRole('navigation', { name: /Mục quản trị/i });
    for (const tabBtn of within(nav).getAllByRole('button')) {
      expect(tabBtn).toHaveClass('min-h-[44px]', 'sm:min-h-[42px]');
    }

    // Create memory
    await user.click(screen.getByRole('button', { name: /Thêm kỷ niệm mới/i }));
    const dateInput = screen.getByLabelText(/Ngày kỷ niệm/i);
    expect(dateInput).toHaveClass('text-base', 'sm:text-sm');
    await user.clear(dateInput);
    await user.type(dateInput, '2025-08-20');
    await user.type(screen.getByLabelText(/Tiêu đề ngắn/i), 'Biển chiều');
    await user.type(screen.getByLabelText(/Câu chuyện/i), 'Sóng hát tên mình.');
    await user.type(screen.getByLabelText(/Đường dẫn ảnh/i), '/samples/memory-3.svg');
    await user.click(screen.getByRole('button', { name: /Thêm vào dòng thời gian/i }));

    expect(await screen.findByText('Biển chiều')).toBeInTheDocument();

    // Floating always-visible status toast + >=36px close button
    const statusToast = screen.getByRole('status');
    expect(statusToast).toHaveClass('fixed', 'bottom-4', 'z-50');
    expect(within(statusToast).getByRole('button', { name: /Đóng/i })).toHaveClass('min-h-[36px]');

    // Sort by date ascending
    await user.click(screen.getByRole('button', { name: /Sắp xếp theo ngày tăng dần/i }));
    await waitFor(() => {
      const titles = screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent);
      expect(titles).toEqual(['Ngày đầu gặp gỡ', 'Chiều mưa đầu tiên', 'Biển chiều']);
    });

    // Edit memory respects reduced-motion scrollIntoView
    const origMatchMedia = window.matchMedia;
    window.matchMedia = vi.fn(() => ({
      matches: true,
      media: '(prefers-reduced-motion: reduce)',
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(() => false),
    })) as unknown as typeof window.matchMedia;
    const scrollIntoViewMock = vi.fn();
    Element.prototype.scrollIntoView = scrollIntoViewMock;

    const editButtons = screen.getAllByRole('button', { name: /^Sửa$/i });
    await user.click(editButtons[2]);
    const titleInput = screen.getByLabelText(/Tiêu đề ngắn/i);
    await user.clear(titleInput);
    await user.type(titleInput, 'Biển chiều hoàng hôn');
    await user.click(screen.getByRole('button', { name: /Lưu thay đổi/i }));
    expect(await screen.findByText('Biển chiều hoàng hôn')).toBeInTheDocument();
    window.matchMedia = origMatchMedia;

    // 2-click delete with in-flight guard disables repeat clicks
    const deleteButtons = screen.getAllByRole('button', { name: /^Xoá$/i });
    await user.click(deleteButtons[2]);
    const confirmDeleteBtn = screen.getByRole('button', { name: /Xác nhận xoá/i });
    await user.click(confirmDeleteBtn);
    expect(confirmDeleteBtn).toBeDisabled();
    await user.click(confirmDeleteBtn);
    expect(deleteCount).toBe(1);

    resolveDelete!(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    await waitFor(() => {
      expect(screen.queryByText('Biển chiều hoàng hôn')).not.toBeInTheDocument();
    });
  });

  test('redirects to /admin/login on 401 across memory upload-url, upload, and delete actions and resets file input on clear', async () => {
    const user = userEvent.setup();
    vi.stubGlobal('URL', {
      ...URL,
      createObjectURL: vi.fn(() => 'blob:mock-preview'),
      revokeObjectURL: vi.fn(),
    });

    fetchSpy.mockImplementation(async (input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input.toString();
      if (url === '/api/admin/upload-url') {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
      }
      if (url.startsWith('/api/admin/memories/')) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
      }
      return new Response(JSON.stringify({ error: 'Unexpected' }), { status: 500 });
    });

    render(<AdminDashboard initialData={makeInitialData()} storageStatus={STORAGE_STATUS} />);

    // Tab 2 audio constraints + arrow + Tab 4 neutral OTP placeholder
    await user.click(screen.getByRole('button', { name: /Mở đầu, Nhạc nền & Riêng tư/i }));
    expect(document.querySelector('audio')).toHaveClass('w-full', 'min-w-0', 'max-w-full');
    expect(
      screen.getByRole('button', { name: /Đi tới quản lý tài khoản & OTP →/i })
    ).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Tài khoản & Kiểm soát truy cập/i }));
    expect(screen.getByLabelText(/Mã OTP 6 số/i)).toHaveAttribute('placeholder', 'VD: 654321');

    // Back to Tab 1: pick image file, verify typing URL clears file input, then pick file & trigger 401 upload-url
    await user.click(screen.getByRole('button', { name: /Kỷ niệm & Ảnh/i }));
    await user.click(screen.getByRole('button', { name: /Thêm kỷ niệm mới/i }));
    const fileInput = document.getElementById('memory-file-upload') as HTMLInputElement;
    const mockFile = new File([new Uint8Array([1, 2, 3])], 'pic.png', { type: 'image/png' });
    await user.upload(fileInput, mockFile);
    expect(fileInput.files).toHaveLength(1);

    await user.type(screen.getByLabelText(/Đường dẫn ảnh/i), '/samples/memory-1.svg');
    expect(fileInput.value).toBe('');

    // Re-upload file and submit -> /api/admin/upload-url returns 401 -> redirects to /admin/login
    await user.upload(fileInput, mockFile);
    await user.type(screen.getByLabelText(/Câu chuyện/i), 'Test story');
    await user.click(screen.getByRole('button', { name: /Thêm vào dòng thời gian/i }));

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/admin/login');
      expect(mockRefresh).toHaveBeenCalled();
    });
  });

  test('renders Pale Yellow & Red Hearts styling across all 5 tabs, light <option> controls, and zero legacy sky/indigo/blue/violet/purple/slate/bg-white classes', async () => {
    const user = userEvent.setup();
    const allEventTypes: ActivityEventType[] = [
      'page_visit',
      'page_leave',
      'login_step1_ok',
      'login_failed',
      'otp_verified',
      'otp_failed',
      'pixel_heart_viewed',
      'music_toggled',
      'memory_viewed',
      'letter_opened',
      'diary_saved',
      'diary_deleted',
      'logout',
    ];
    const allLogs: ActivityLogItem[] = allEventTypes.map((eventType, idx) => ({
      id: `log-palette-${idx}`,
      userId: idx % 3 === 0 ? ADMIN_USER.id : idx % 3 === 1 ? VIEWER_USER.id : null,
      username: idx % 3 === 0 ? 'admin' : idx % 3 === 1 ? 'nguoithuong' : 'khach',
      userRole: idx % 3 === 0 ? 'admin' : idx % 3 === 1 ? 'viewer' : 'guest',
      eventType,
      detail: `Sự kiện ${eventType}`,
      deviceSummary: 'Chrome · macOS',
      metadata: null,
      createdAt: '2026-11-15T10:05:30.000Z',
    }));

    function assertPaleYellowTheme(root: HTMLElement) {
      const classTokens = Array.from(root.querySelectorAll('[class]')).flatMap((el) =>
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

      const selectOptions = root.querySelectorAll('select option');
      for (const opt of selectOptions) {
        expect(opt).toHaveClass('bg-[#FFFBEB]', 'text-stone-900');
      }
    }

    const inactiveSecondAdmin: SafeAppUser = { ...SECOND_ADMIN_USER, isActive: false };
    const initial = makeInitialData({
      users: [ADMIN_USER, VIEWER_USER, inactiveSecondAdmin],
      activityLogs: allLogs,
    });
    fetchSpy.mockResolvedValueOnce(
      new Response(JSON.stringify({ settings: initial.settings }), { status: 200 })
    );

    const { container, rerender } = render(
      <AdminDashboard
        initialData={initial}
        storageStatus={{
          mode: 'local',
          readOnlyServerlessWarning: true,
          usingDefaultAdminPassword: true,
          usingDefaultSessionSecret: true,
        }}
      />
    );

    // Tab 1: open form + open delete confirmation
    assertPaleYellowTheme(container);
    await user.click(screen.getByRole('button', { name: /Thêm kỷ niệm mới/i }));
    expect(screen.getByLabelText(/Ngày kỷ niệm/i).parentElement).toHaveClass('min-w-0');
    expect(screen.getByLabelText(/Tiêu đề ngắn/i).parentElement).toHaveClass('min-w-0');
    const memoryDropzone = document.getElementById('memory-file-upload')!.closest('label')!;
    expect(memoryDropzone).toHaveClass(
      'focus-within:border-red-500',
      'focus-within:ring-2',
      'focus-within:ring-red-500/30'
    );
    await user.type(screen.getByLabelText(/Đường dẫn ảnh/i), '/samples/memory-1.svg');
    expect(screen.getByRole('img', { name: /Xem trước ảnh/i })).toHaveClass('max-w-full');
    assertPaleYellowTheme(container);
    await user.click(screen.getByRole('button', { name: /^Huỷ$/i }));
    await user.click(screen.getByRole('button', { name: /^Xoá$/i }));
    assertPaleYellowTheme(container);

    // Tab 2: settings + trigger success toast + responsive/a11y checks
    const nav = screen.getByRole('navigation', { name: /Mục quản trị/i });
    expect(nav).toHaveClass('overflow-x-auto', 'flex-nowrap', 'md:flex-wrap');
    await user.click(within(nav).getByRole('button', { name: /Mở đầu, Nhạc nền & Riêng tư/i }));
    expect(within(nav).getByRole('button', { name: /Mở đầu, Nhạc nền & Riêng tư/i })).toHaveAttribute(
      'aria-current',
      'page'
    );
    expect(within(nav).getByRole('button', { name: /Kỷ niệm & Ảnh/i })).not.toHaveAttribute(
      'aria-current'
    );
    expect(screen.getByLabelText(/Tên hai bạn/i).parentElement).toHaveClass('min-w-0');
    expect(screen.getByLabelText(/Ngày bắt đầu yêu/i).parentElement).toHaveClass('min-w-0');
    const musicUrlInput = screen.getByLabelText(/Đường dẫn nhạc nền/i);
    expect(musicUrlInput).toHaveAttribute('id', 'settings-music-url');
    expect(musicUrlInput).toHaveClass('placeholder:text-stone-500');
    expect(musicUrlInput.parentElement?.parentElement).toHaveClass(
      'sm:grid-cols-[minmax(0,1fr)_minmax(0,auto)]'
    );
    const audioFilenameSpan = screen.getByText(/Tải file nhạc/i);
    expect(audioFilenameSpan).toHaveClass('max-w-full', 'sm:max-w-[220px]', 'truncate');
    expect(audioFilenameSpan.closest('label')).toHaveClass(
      'focus-within:border-red-500',
      'focus-within:ring-2',
      'focus-within:ring-red-500/30'
    );
    expect(screen.getByText(/Luôn phát tự động mặc định/i)).toBeInTheDocument();
    expect(
      screen.queryByRole('checkbox', { name: /Hiển thị nút bật\/tắt nhạc/i })
    ).not.toBeInTheDocument();
    expect(
      screen
        .getByRole('checkbox', { name: /Khoá bảo vệ trang kỷ niệm/i })
        .closest('label')
    ).toHaveClass('min-h-[36px]', 'py-1');
    assertPaleYellowTheme(container);
    await user.click(screen.getByRole('button', { name: /Lưu cài đặt/i }));
    const successToast = await screen.findByRole('status');
    expect(successToast).toBeInTheDocument();
    const toastCloseBtn = within(successToast).getByRole('button', { name: /Đóng/i });
    expect(toastCloseBtn).toHaveClass(
      'text-stone-700',
      'focus-visible:outline-none',
      'focus-visible:ring-2',
      'focus-visible:ring-red-500'
    );
    expect(toastCloseBtn).not.toHaveClass('text-rose-100/80', 'hover:bg-rose-500/20');
    assertPaleYellowTheme(container);

    // Tab 3: letter & preview
    await user.click(screen.getByRole('button', { name: /Phong thư tâm sự/i }));
    assertPaleYellowTheme(container);

    // Tab Diary: couple daily diary management
    await user.click(screen.getByRole('button', { name: /Nhật ký mỗi ngày/i }));
    await user.click(screen.getByRole('button', { name: /Viết cho hôm nay/i }));
    assertPaleYellowTheme(container);

    // Tab 4: create form + user cards + inline edit form + inline delete confirm
    await user.click(screen.getByRole('button', { name: /Tài khoản & Kiểm soát truy cập/i }));
    expect(
      screen.getByRole('checkbox', { name: /Kích hoạt ngay/i }).closest('label')
    ).toHaveClass('min-h-[36px]', 'py-1');
    expect(screen.getByRole('button', { name: /Tạo tài khoản/i })).toHaveClass('min-h-[44px]');
    expect(container.querySelectorAll('#new-user-role option')).toHaveLength(2);
    const adminCard = screen.getByTestId(`user-card-${ADMIN_USER.id}`);
    await user.click(within(adminCard).getByRole('button', { name: /^Sửa$/i }));
    expect(
      container.querySelectorAll(`#edit-role-${ADMIN_USER.id} option`)
    ).toHaveLength(2);
    const viewerCard = screen.getByTestId(`user-card-${VIEWER_USER.id}`);
    await user.click(within(viewerCard).getByRole('button', { name: /^Xoá$/i }));
    assertPaleYellowTheme(container);

    // Tab 5: stat cards + filter selects + all 11 event badges + mobile/desktop views
    await user.click(screen.getByRole('button', { name: /Nhật ký ra vào & Hành động/i }));
    for (const statId of [
      'stat-visits-today',
      'stat-otp-verified',
      'stat-failed-auth',
      'stat-active-users',
    ]) {
      expect(screen.getByTestId(statId)).toHaveClass('min-w-0');
    }
    const desktopTable = screen.getByTestId('activity-desktop-table');
    const deviceCells = desktopTable.querySelectorAll('tbody tr td:last-child');
    expect(deviceCells[0]).toHaveClass('max-w-[200px]', 'truncate');
    expect(deviceCells[0]).toHaveAttribute('title', 'Chrome · macOS');
    expect(container.querySelectorAll('select option').length).toBeGreaterThanOrEqual(16);
    assertPaleYellowTheme(container);

    // Supabase mode + empty memories/logs state
    rerender(
      <AdminDashboard
        initialData={makeInitialData({ memories: [], activityLogs: [] })}
        storageStatus={{ ...STORAGE_STATUS, mode: 'supabase' }}
      />
    );
    assertPaleYellowTheme(container);
  });

  test('Tab 1 supports dragging & dropping images (onto form dropzone & quick header dropzone), pasting clipboard images, clearing pending file, and rejecting invalid dropped files', async () => {
    const user = userEvent.setup();
    vi.stubGlobal('URL', {
      ...URL,
      createObjectURL: vi.fn(() => 'blob:mock-preview'),
      revokeObjectURL: vi.fn(),
    });

    const createdMemory = {
      id: 'mem-dropped',
      memoryDate: '2026-04-05',
      title: 'Góc phố nắng chiều',
      story: 'Chuyến đi cùng em.',
      imageUrl: '/uploads/eiu-1.jpg',
      imageAlt: 'Góc phố nắng chiều',
      sortOrder: 1,
      createdAt: '2026-11-16T00:00:00.000Z',
    };

    fetchSpy.mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.toString();
      const method = init?.method || 'GET';
      if (url === '/api/admin/upload-url' && method === 'POST') {
        return new Response(
          JSON.stringify({ mode: 'local', uploadEndpoint: '/api/admin/upload' }),
          { status: 200 }
        );
      }
      if (url === '/api/admin/upload' && method === 'POST') {
        return new Response(JSON.stringify({ publicUrl: '/uploads/eiu-1.jpg' }), { status: 200 });
      }
      if (url === '/api/admin/memories' && method === 'POST') {
        return new Response(JSON.stringify({ memory: createdMemory }), { status: 201 });
      }
      return new Response(JSON.stringify({ error: 'Unexpected call' }), { status: 500 });
    });

    render(<AdminDashboard initialData={makeInitialData()} storageStatus={STORAGE_STATUS} />);

    const validJpg = new File([new Uint8Array([1, 2, 3])], 'eiu-1.jpg', { type: 'image/jpeg' });

    // 1. Quick drop when form is closed -> auto-opens form, shows filename & preview
    const quickDropzone = screen.getByTestId('memories-quick-dropzone');
    fireEvent.drop(quickDropzone, { dataTransfer: { files: [validJpg] } });

    expect(screen.getByText('eiu-1.jpg')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: /Xem trước ảnh/i })).toHaveAttribute(
      'src',
      'blob:mock-preview'
    );

    // 2. Clear pending file button resets back to default drop prompt
    await user.click(screen.getByRole('button', { name: /Bỏ ảnh vừa chọn/i }));
    expect(screen.queryByText('eiu-1.jpg')).not.toBeInTheDocument();
    expect(screen.getByText(/Kéo thả ảnh hoặc video vào đây để chọn/i)).toBeInTheDocument();

    // 3. Drag-enter / child drag-enter+leave / outside drag-leave on form dropzone
    const dropzone = screen.getByTestId('memory-image-dropzone');
    const innerLabel = dropzone.querySelector('label')!;
    fireEvent.dragEnter(dropzone);
    expect(screen.getByText(/Thả ảnh hoặc video vào đây để xem trước/i)).toBeInTheDocument();

    fireEvent.dragEnter(innerLabel);
    fireEvent.dragLeave(dropzone);
    expect(screen.getByText(/Thả ảnh hoặc video vào đây để xem trước/i)).toBeInTheDocument();

    fireEvent.dragLeave(dropzone);
    expect(screen.getByText(/Kéo thả ảnh hoặc video vào đây để chọn/i)).toBeInTheDocument();

    // 4. Reject invalid dropped file cleanly without creating preview
    const invalidTxt = new File(['bad'], 'notes.txt', { type: 'text/plain' });
    fireEvent.drop(dropzone, { dataTransfer: { files: [invalidTxt] } });
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Chỉ hỗ trợ ảnh (JPG, PNG, WebP, GIF, AVIF, HEIC) hoặc video (MP4, WebM, MOV, M4V).'
    );
    expect(screen.queryByRole('img', { name: /Xem trước ảnh/i })).not.toBeInTheDocument();

    // 5. Clipboard paste image
    const pastedPng = new File([new Uint8Array([4, 5])], 'pasted.png', { type: 'image/png' });
    fireEvent.paste(dropzone, { clipboardData: { files: [pastedPng] } });
    expect(screen.getByText('pasted.png')).toBeInTheDocument();

    // 6. Drop valid image & submit form -> uploads and saves memory
    fireEvent.drop(dropzone, { dataTransfer: { files: [validJpg] } });
    expect(screen.getByText('eiu-1.jpg')).toBeInTheDocument();
    await user.type(screen.getByLabelText(/Câu chuyện/i), 'Chuyến đi cùng em.');
    await user.click(screen.getByRole('button', { name: /Thêm vào dòng thời gian/i }));

    expect(await screen.findByText('Chuyến đi cùng em.')).toBeInTheDocument();
    expect(fetchSpy).toHaveBeenCalledWith('/api/admin/upload-url', expect.anything());
    expect(fetchSpy).toHaveBeenCalledWith('/api/admin/upload', expect.anything());
    expect(fetchSpy).toHaveBeenCalledWith(
      '/api/admin/memories',
      expect.objectContaining({ method: 'POST' })
    );
  });

  test('converts dropped iPhone HEIC photos to JPEG before previewing in the album', async () => {
    vi.stubGlobal('URL', {
      ...URL,
      createObjectURL: vi.fn(() => 'blob:mock-preview'),
      revokeObjectURL: vi.fn(),
    });
    mockHeicTo.mockClear();

    render(<AdminDashboard initialData={makeInitialData()} storageStatus={STORAGE_STATUS} />);

    const heic = new File([new Uint8Array([1, 2, 3])], 'IMG_0001.HEIC', { type: 'image/heic' });
    fireEvent.drop(screen.getByTestId('memories-quick-dropzone'), {
      dataTransfer: { files: [heic] },
    });

    expect(await screen.findByText('IMG_0001.jpg')).toBeInTheDocument();
    expect(mockHeicTo).toHaveBeenCalledWith(
      expect.objectContaining({ blob: heic, type: 'image/jpeg' })
    );
    expect(screen.queryByText('IMG_0001.HEIC')).not.toBeInTheDocument();
  });

  test('shows a friendly error when a HEIC photo cannot be converted', async () => {
    mockHeicTo.mockRejectedValueOnce(new Error('bad heic'));

    render(<AdminDashboard initialData={makeInitialData()} storageStatus={STORAGE_STATUS} />);

    const heic = new File([new Uint8Array([1])], 'broken.heic', { type: '' });
    fireEvent.drop(screen.getByTestId('memories-quick-dropzone'), {
      dataTransfer: { files: [heic] },
    });

    expect(await screen.findByRole('alert')).toHaveTextContent(/Không thể chuyển ảnh HEIC sang JPG/);
  });

  test('Tab "Nhật ký mỗi ngày" in /admin supports creating with dropped photo, editing partner entry, updating tab count badge, 2-click delete, and 401 redirect', async () => {
    const user = userEvent.setup();
    vi.stubGlobal('URL', {
      ...URL,
      createObjectURL: vi.fn(() => 'blob:admin-diary-preview'),
      revokeObjectURL: vi.fn(),
    });

    let return401OnDelete = false;
    fetchSpy.mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.toString();
      const method = init?.method || 'GET';
      if (url === '/api/diary/upload-url' && method === 'POST') {
        return new Response(
          JSON.stringify({ mode: 'local', uploadEndpoint: '/api/diary/upload' }),
          { status: 200 }
        );
      }
      if (url === '/api/diary/upload' && method === 'POST') {
        return new Response(JSON.stringify({ publicUrl: '/uploads/admin-diary.jpg' }), {
          status: 200,
        });
      }
      if (url === '/api/diary' && method === 'POST') {
        const body = JSON.parse(String(init?.body || '{}')) as Record<string, unknown>;
        return new Response(
          JSON.stringify({
            entry: {
              id: 'diary-admin-created',
              entryDate: String(body.entryDate),
              title: String(body.title || ''),
              content: String(body.content),
              mood: String(body.mood || 'loved'),
              imageUrl: String(body.imageUrl || ''),
              imageAlt: String(body.imageAlt || ''),
              authorId: ADMIN_USER.id,
              authorUsername: ADMIN_USER.username,
              authorDisplayName: ADMIN_USER.displayName,
              authorRole: 'admin',
              createdAt: '2026-11-17T10:00:00.000Z',
              updatedAt: '2026-11-17T10:00:00.000Z',
            },
          }),
          { status: 201 }
        );
      }
      if (url === '/api/diary/diary-v1' && method === 'PUT') {
        const body = JSON.parse(String(init?.body || '{}')) as Record<string, unknown>;
        return new Response(
          JSON.stringify({
            entry: {
              id: 'diary-v1',
              entryDate: String(body.entryDate),
              title: String(body.title || ''),
              content: String(body.content),
              mood: String(body.mood || 'loved'),
              imageUrl: '',
              imageAlt: '',
              authorId: VIEWER_USER.id,
              authorUsername: 'nguoithuong',
              authorDisplayName: VIEWER_USER.displayName,
              authorRole: 'viewer',
              createdAt: '2026-11-16T10:00:00.000Z',
              updatedAt: '2026-11-17T10:05:00.000Z',
            },
          }),
          { status: 200 }
        );
      }
      if (url.startsWith('/api/diary/') && method === 'DELETE') {
        if (return401OnDelete) {
          return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
        }
        return new Response(JSON.stringify({ ok: true }), { status: 200 });
      }
      return new Response(JSON.stringify({ error: 'Unexpected call' }), { status: 500 });
    });

    render(<AdminDashboard initialData={makeInitialData()} storageStatus={STORAGE_STATUS} />);

    const diaryTabBtn = screen.getByRole('button', { name: /Nhật ký mỗi ngày \(1\)/i });
    await user.click(diaryTabBtn);

    // Edit partner's entry
    const viewerEntryCard = screen.getByTestId('diary-card-diary-v1');
    await user.click(within(viewerEntryCard).getByRole('button', { name: /^Sửa$/i }));
    const titleInput = screen.getByLabelText(/Tiêu đề nhỏ hôm nay/i);
    await user.clear(titleInput);
    await user.type(titleInput, 'Trang viết của Em (đã chỉnh)');
    await user.click(screen.getByRole('button', { name: /Lưu thay đổi nhật ký/i }));
    expect(await screen.findByText('Trang viết của Em (đã chỉnh)')).toBeInTheDocument();

    // Quick-drop image to create new diary entry -> updates tab badge to (2)
    const dropFile = new File([new Uint8Array([1, 2, 3])], 'admin-diary.jpg', {
      type: 'image/jpeg',
    });
    fireEvent.drop(screen.getByTestId('diary-quick-dropzone'), {
      dataTransfer: { files: [dropFile] },
    });
    await user.type(screen.getByLabelText(/Nội dung nhật ký/i), 'Một ngày bận rộn nhưng vui.');
    await user.click(screen.getByRole('button', { name: /Lưu trang nhật ký/i }));

    expect(await screen.findByText('Một ngày bận rộn nhưng vui.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Nhật ký mỗi ngày \(2\)/i })).toBeInTheDocument();

    // 2-click delete -> updates tab badge back to (1)
    const createdCard = screen.getByTestId('diary-card-diary-admin-created');
    await user.click(within(createdCard).getByRole('button', { name: /^Xoá$/i }));
    await user.click(within(createdCard).getByRole('button', { name: /Xác nhận xoá/i }));
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Nhật ký mỗi ngày \(1\)/i })).toBeInTheDocument();
    });

    // 401 on delete redirects to /admin/login
    return401OnDelete = true;
    const remainingCard = screen.getByTestId('diary-card-diary-v1');
    await user.click(within(remainingCard).getByRole('button', { name: /^Xoá$/i }));
    await user.click(within(remainingCard).getByRole('button', { name: /Xác nhận xoá/i }));
    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/admin/login');
    });
  });

  test('Tab 1 supports dropping multiple images at once into a single memory album, setting cover image, reordering/removing items, and submitting images[] array', async () => {
    const user = userEvent.setup();
    let previewSeq = 0;
    vi.stubGlobal('URL', {
      ...URL,
      createObjectURL: vi.fn(() => `blob:album-preview-${++previewSeq}`),
      revokeObjectURL: vi.fn(),
    });

    let postedBody: Record<string, unknown> | null = null;
    let uploadIndex = 0;

    fetchSpy.mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.toString();
      const method = init?.method || 'GET';
      if (url === '/api/admin/upload-url' && method === 'POST') {
        return new Response(
          JSON.stringify({ mode: 'local', uploadEndpoint: '/api/admin/upload' }),
          { status: 200 }
        );
      }
      if (url === '/api/admin/upload' && method === 'POST') {
        uploadIndex++;
        return new Response(
          JSON.stringify({ publicUrl: `/uploads/batch-${uploadIndex}.jpg` }),
          { status: 200 }
        );
      }
      if (url === '/api/admin/memories' && method === 'POST') {
        postedBody = JSON.parse(String(init?.body || '{}')) as Record<string, unknown>;
        return new Response(
          JSON.stringify({
            memory: {
              id: 'mem-album-created',
              memoryDate: String(postedBody.memoryDate),
              title: String(postedBody.title),
              story: String(postedBody.story),
              imageUrl: String(postedBody.imageUrl),
              imageAlt: String(postedBody.imageAlt),
              images: postedBody.images,
              sortOrder: 1,
              createdAt: '2026-11-17T00:00:00.000Z',
            },
          }),
          { status: 201 }
        );
      }
      return new Response(JSON.stringify({ error: 'Unexpected call' }), { status: 500 });
    });

    const { container } = render(
      <AdminDashboard initialData={makeInitialData()} storageStatus={STORAGE_STATUS} />
    );

    const f1 = new File([new Uint8Array([1])], 'trip-1.jpg', { type: 'image/jpeg' });
    const f2 = new File([new Uint8Array([2])], 'trip-2.jpg', { type: 'image/jpeg' });
    const f3 = new File([new Uint8Array([3])], 'trip-3.jpg', { type: 'image/jpeg' });

    // Drag & drop 3 images AT ONCE onto memories-quick-dropzone
    fireEvent.drop(screen.getByTestId('memories-quick-dropzone'), {
      dataTransfer: { files: [f1, f2, f3] },
    });

    const albumGrid = await screen.findByTestId('memory-album-grid');
    expect(within(albumGrid).getByText('trip-1.jpg')).toBeInTheDocument();
    expect(within(albumGrid).getByText('trip-2.jpg')).toBeInTheDocument();
    expect(within(albumGrid).getByText('trip-3.jpg')).toBeInTheDocument();
    expect(within(albumGrid).getByText('Ảnh bìa')).toBeInTheDocument();

    // Promote trip-2.jpg to cover (#1)
    const makeCoverButtons = within(albumGrid).getAllByRole('button', { name: /Đặt làm bìa/i });
    expect(makeCoverButtons).toHaveLength(2);
    await user.click(makeCoverButtons[0]);

    // Remove the 3rd photo (trip-3.jpg)
    await user.click(within(albumGrid).getByRole('button', { name: /Xoá ảnh thứ 3/i }));
    expect(within(albumGrid).queryByText('trip-3.jpg')).not.toBeInTheDocument();

    // Verify main preview element remains unambiguous and Dark Velvet theme stays clean
    expect(screen.getByRole('img', { name: /Xem trước ảnh/i })).toBeInTheDocument();
    const classTokens = Array.from(container.querySelectorAll('[class]')).flatMap((el) =>
      (el.getAttribute('class') ?? '').split(/\s+/).filter(Boolean)
    );
    for (const token of classTokens) {
      expect(token).not.toMatch(/^(?:[a-z0-9-]+:)*(?:sky|indigo|blue|violet|purple|slate)-/);
      expect(token).not.toMatch(/^(?:[a-z0-9-]+:)*bg-white(?:\/|$)/);
    }

    await user.type(screen.getByLabelText(/Tiêu đề ngắn/i), 'Album Đà Lạt');
    await user.type(screen.getByLabelText(/Câu chuyện/i), 'Hai bức ảnh nắng chiều.');
    await user.click(screen.getByRole('button', { name: /Thêm vào dòng thời gian/i }));

    expect(await screen.findByText('Album Đà Lạt')).toBeInTheDocument();
    expect(screen.getByText('2 ảnh')).toBeInTheDocument();
    expect(postedBody).not.toBeNull();
    expect(postedBody!.imageUrl).toBe('/uploads/batch-1.jpg');
    expect(postedBody!.images).toHaveLength(2);
  });

  test('Tab 1 supports uploading mixed photos and videos (.mp4/.mov) into a memory album, renders <video> previews, and submits mediaType video metadata', async () => {
    const user = userEvent.setup();
    let previewSeq = 0;
    vi.stubGlobal('URL', {
      ...URL,
      createObjectURL: vi.fn(() => `blob:mixed-preview-${++previewSeq}`),
      revokeObjectURL: vi.fn(),
    });

    const requestedUploadKinds: string[] = [];
    let postedBody: Record<string, unknown> | null = null;

    fetchSpy.mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.toString();
      const method = init?.method || 'GET';
      if (url === '/api/admin/upload-url' && method === 'POST') {
        const body = JSON.parse(String(init?.body || '{}')) as { kind?: string };
        if (body.kind) requestedUploadKinds.push(body.kind);
        return new Response(
          JSON.stringify({ mode: 'local', uploadEndpoint: '/api/admin/upload' }),
          { status: 200 }
        );
      }
      if (url === '/api/admin/upload' && method === 'POST') {
        const fd = init?.body as FormData;
        const kind = fd.get('kind');
        const publicUrl =
          kind === 'video' ? '/uploads/sunset-moment.mp4' : '/uploads/photo-cover.jpg';
        return new Response(JSON.stringify({ publicUrl }), { status: 200 });
      }
      if (url === '/api/admin/memories' && method === 'POST') {
        postedBody = JSON.parse(String(init?.body || '{}')) as Record<string, unknown>;
        return new Response(
          JSON.stringify({
            memory: {
              id: 'mem-mixed-video',
              memoryDate: String(postedBody.memoryDate),
              title: String(postedBody.title),
              story: String(postedBody.story),
              imageUrl: String(postedBody.imageUrl),
              imageAlt: String(postedBody.imageAlt),
              images: postedBody.images,
              sortOrder: 1,
              createdAt: '2026-11-17T00:00:00.000Z',
            },
          }),
          { status: 201 }
        );
      }
      return new Response(JSON.stringify({ error: 'Unexpected call' }), { status: 500 });
    });

    const { container } = render(
      <AdminDashboard initialData={makeInitialData()} storageStatus={STORAGE_STATUS} />
    );

    const imgFile = new File([new Uint8Array([1, 2])], 'trip-1.jpg', { type: 'image/jpeg' });
    const vidFile = new File([new Uint8Array([3, 4, 5])], 'sunset.mp4', { type: 'video/mp4' });

    fireEvent.drop(screen.getByTestId('memories-quick-dropzone'), {
      dataTransfer: { files: [imgFile, vidFile] },
    });

    const albumGrid = await screen.findByTestId('memory-album-grid');
    expect(within(albumGrid).getByText('trip-1.jpg')).toBeInTheDocument();
    expect(within(albumGrid).getByText('sunset.mp4')).toBeInTheDocument();
    expect(albumGrid.querySelectorAll('video')).toHaveLength(1);

    // Promote video to cover (#1) temporarily -> renders video preview in main dropzone preview
    await user.click(within(albumGrid).getByRole('button', { name: /Đặt làm bìa/i }));
    const dropzone = screen.getByTestId('memory-image-dropzone');
    expect(dropzone.querySelector('video[controls]')).toBeInTheDocument();

    // Move photo back to cover (#1)
    await user.click(within(albumGrid).getByRole('button', { name: /Đặt làm bìa/i }));

    // Theme check
    const classTokens = Array.from(container.querySelectorAll('[class]')).flatMap((el) =>
      (el.getAttribute('class') ?? '').split(/\s+/).filter(Boolean)
    );
    for (const token of classTokens) {
      expect(token).not.toMatch(/^(?:[a-z0-9-]+:)*(?:sky|indigo|blue|violet|purple|slate)-/);
      expect(token).not.toMatch(/^(?:[a-z0-9-]+:)*bg-white(?:\/|$)/);
    }

    await user.type(screen.getByLabelText(/Tiêu đề ngắn/i), 'Hoàng hôn Phú Quốc');
    await user.type(screen.getByLabelText(/Câu chuyện/i), 'Có ảnh và một đoạn video biển.');
    await user.click(screen.getByRole('button', { name: /Thêm vào dòng thời gian/i }));

    expect(await screen.findByText('Hoàng hôn Phú Quốc')).toBeInTheDocument();
    expect(screen.getByText('1 ảnh · 1 video')).toBeInTheDocument();
    expect(requestedUploadKinds).toEqual(['image', 'video']);
    expect(postedBody).not.toBeNull();
    expect(postedBody!.images).toEqual([
      { url: '/uploads/photo-cover.jpg', alt: 'Hoàng hôn Phú Quốc' },
      { url: '/uploads/sunset-moment.mp4', alt: 'Hoàng hôn Phú Quốc', mediaType: 'video' },
    ]);
  });

  test('Tab 1 preserves dropped albumItems when typing into #memory-image-url and syncs cover alt two-way with #memory-alt', async () => {
    const user = userEvent.setup();
    let previewSeq = 0;
    vi.stubGlobal('URL', {
      ...URL,
      createObjectURL: vi.fn(() => `blob:sync-preview-${++previewSeq}`),
      revokeObjectURL: vi.fn(),
    });

    render(<AdminDashboard initialData={makeInitialData()} storageStatus={STORAGE_STATUS} />);

    const fileA = new File([new Uint8Array([1, 2])], 'a.jpg', { type: 'image/jpeg' });
    const fileB = new File([new Uint8Array([3, 4])], 'b.jpg', { type: 'image/jpeg' });
    fireEvent.drop(screen.getByTestId('memories-quick-dropzone'), {
      dataTransfer: { files: [fileA, fileB] },
    });

    const albumGrid = await screen.findByTestId('memory-album-grid');
    expect(within(albumGrid).getByText('a.jpg')).toBeInTheDocument();
    expect(within(albumGrid).getByText('b.jpg')).toBeInTheDocument();

    // Typing into URL field (without clicking + Thêm URL) must NOT clear pending albumItems
    const urlInput = screen.getByLabelText(/Đường dẫn ảnh \/ video/i);
    await user.type(urlInput, 'https://example.com/extra.jpg');
    expect(within(screen.getByTestId('memory-album-grid')).getByText('a.jpg')).toBeInTheDocument();
    expect(within(screen.getByTestId('memory-album-grid')).getByText('b.jpg')).toBeInTheDocument();

    // Editing #memory-alt syncs albumItems[0].alt
    const coverAltInput = screen.getByLabelText(/Mô tả ảnh bìa/i);
    await user.type(coverAltInput, 'Chú thích bìa mới');
    expect(screen.getByLabelText('Chú thích ảnh thứ 1')).toHaveValue('Chú thích bìa mới');

    // Editing albumItem[0].alt directly syncs #memory-alt
    const item1AltInput = screen.getByLabelText('Chú thích ảnh thứ 1');
    await user.clear(item1AltInput);
    await user.type(item1AltInput, 'Sửa trực tiếp tấm 1');
    expect(coverAltInput).toHaveValue('Sửa trực tiếp tấm 1');

    // Editing albumItem[1].alt and clicking "Đặt làm bìa" promotes it to #1 and updates #memory-alt
    const item2AltInput = screen.getByLabelText('Chú thích ảnh thứ 2');
    await user.type(item2AltInput, 'Chú thích tấm 2');
    await user.click(within(screen.getByTestId('memory-album-grid')).getByRole('button', { name: /Đặt làm bìa/i }));
    expect(coverAltInput).toHaveValue('Chú thích tấm 2');
    expect(screen.getByLabelText('Chú thích ảnh thứ 1')).toHaveValue('Chú thích tấm 2');
  });
});
