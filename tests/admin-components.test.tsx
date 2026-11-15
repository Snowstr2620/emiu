import React from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { AdminDashboard } from '@/components/admin/AdminDashboard';
import { AdminLoginForm } from '@/components/admin/AdminLoginForm';
import type {
  ActivityLogItem,
  AdminSiteData,
  SafeAppUser,
  StorageStatus,
} from '@/types/memories';

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

  test('renders 5 responsive tabs, current user header badge, and non-overflowing layout structure', () => {
    const { container } = render(
      <AdminDashboard initialData={makeInitialData()} storageStatus={STORAGE_STATUS} />
    );

    expect(screen.getByText('Anh · Chủ vườn ký ức')).toBeInTheDocument();

    const nav = screen.getByRole('navigation', { name: /Mục quản trị/i });
    expect(within(nav).getByRole('button', { name: /Kỷ niệm & Ảnh/i })).toBeInTheDocument();
    expect(
      within(nav).getByRole('button', { name: /Mở đầu, Nhạc nền & Riêng tư/i })
    ).toBeInTheDocument();
    expect(within(nav).getByRole('button', { name: /Phong thư tâm sự/i })).toBeInTheDocument();
    expect(
      within(nav).getByRole('button', { name: /Tài khoản & Kiểm soát truy cập/i })
    ).toBeInTheDocument();
    expect(
      within(nav).getByRole('button', { name: /Nhật ký ra vào & Hành động/i })
    ).toBeInTheDocument();

    expect(container.firstElementChild).toHaveClass('overflow-x-hidden');

    // Tab 1 (memories) renders existing memory & editor trigger intact
    expect(screen.getByText('Chiều mưa đầu tiên')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Thêm kỷ niệm mới/i })).toBeInTheDocument();
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

    // Next select filter triggers a failing fetch -> displays error alert notice cleanly
    failNextActivity = true;
    await user.selectOptions(screen.getByLabelText(/Loại hành động/i), 'otp_failed');
    expect(await screen.findByRole('alert')).toHaveTextContent('Không thể tải nhật ký lúc này.');

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
});
