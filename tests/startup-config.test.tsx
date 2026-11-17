import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import AdminPage from '@/app/admin/page';
import AdminLoginPage from '@/app/admin/login/page';
import { POST as adminLoginPost } from '@/app/api/admin/login/route';
import { POST as viewerLoginPost } from '@/app/api/viewer/login/route';
import GlobalErrorPage from '@/app/error';
import HomePage from '@/app/page';
import { buildInitialUsers, ProductionSetupError } from '@/lib/seed-data';

vi.mock('next/headers', () => ({
  cookies: vi.fn(async () => ({
    get: () => undefined,
  })),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    refresh: vi.fn(),
    push: vi.fn(),
    replace: vi.fn(),
  }),
}));

describe('Production startup & setup error handling', () => {
  let tempRoot: string;
  let origEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    origEnv = { ...process.env };
    tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'ny-startup-test-'));
    process.env.LOCAL_DATA_DIR = path.join(tempRoot, 'data');
    process.env.LOCAL_UPLOAD_DIR = path.join(tempRoot, 'uploads');
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    delete process.env.ADMIN_PASSWORD;
    delete process.env.ADMIN_SESSION_SECRET;
    delete process.env.ADMIN_DEFAULT_OTP;
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify({ ok: true }), { status: 200 }))
    );
  });

  afterEach(() => {
    process.env = origEnv;
    fs.rmSync(tempRoot, { recursive: true, force: true });
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  test('buildInitialUsers throws ProductionSetupError in production when ADMIN_PASSWORD is missing or default', () => {
    (process.env as Record<string, string | undefined>).NODE_ENV = 'production';
    delete process.env.ADMIN_PASSWORD;

    expect(() => buildInitialUsers()).toThrow(ProductionSetupError);
    expect(() => buildInitialUsers()).toThrow(
      /ADMIN_PASSWORD is required when initializing production database/
    );

    process.env.ADMIN_PASSWORD = 'love2026';
    expect(() => buildInitialUsers()).toThrow(ProductionSetupError);
  });

  test('HomePage renders actionable Vietnamese setup guide in production when ADMIN_PASSWORD is missing instead of crashing', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    (process.env as Record<string, string | undefined>).NODE_ENV = 'production';
    delete process.env.ADMIN_PASSWORD;
    delete process.env.ADMIN_SESSION_SECRET;

    const jsx = await HomePage();
    render(jsx);

    expect(screen.getByRole('heading', { name: /Chưa hoàn tất cấu hình khởi động/i })).toBeInTheDocument();
    expect(screen.getAllByText(/ADMIN_PASSWORD/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/ADMIN_SESSION_SECRET/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/\.env\.local/).length).toBeGreaterThan(0);
    expect(errorSpy).toHaveBeenCalled();
  });

  test('HomePage renders setup guide in production when ADMIN_PASSWORD is valid but ADMIN_SESSION_SECRET is missing', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    (process.env as Record<string, string | undefined>).NODE_ENV = 'production';
    process.env.ADMIN_PASSWORD = 'MyStrongProdPassword!2026';
    delete process.env.ADMIN_SESSION_SECRET;

    const jsx = await HomePage();
    render(jsx);

    expect(screen.getByRole('heading', { name: /Chưa hoàn tất cấu hình khởi động/i })).toBeInTheDocument();
    expect(screen.getAllByText(/ADMIN_SESSION_SECRET/).length).toBeGreaterThan(0);
    expect(errorSpy).toHaveBeenCalled();
  });

  test('HomePage renders normal viewer login gate in production when ADMIN_PASSWORD and ADMIN_SESSION_SECRET are configured', async () => {
    (process.env as Record<string, string | undefined>).NODE_ENV = 'production';
    process.env.ADMIN_PASSWORD = 'MyStrongProdPassword!2026';
    process.env.ADMIN_SESSION_SECRET = 'prod-strong-random-secret-key-32-chars';

    const jsx = await HomePage();
    render(jsx);

    expect(screen.getByLabelText(/Tài khoản của mình/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Mật khẩu yêu thương/i)).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: /Chưa hoàn tất cấu hình khởi động/i })).not.toBeInTheDocument();
  });

  test('login APIs return explicit 500 JSON mentioning ADMIN_PASSWORD if production DB is uninitialized without ADMIN_PASSWORD', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    (process.env as Record<string, string | undefined>).NODE_ENV = 'production';
    process.env.ADMIN_SESSION_SECRET = 'prod-strong-random-secret-key-32-chars';
    delete process.env.ADMIN_PASSWORD;

    const adminReq = new Request('http://192.168.1.91/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'anything' }),
    });
    const adminRes = await adminLoginPost(adminReq);
    expect(adminRes.status).toBe(500);
    const adminBody = (await adminRes.json()) as { error: string };
    expect(adminBody.error).toContain('ADMIN_PASSWORD');

    const viewerReq = new Request('http://192.168.1.91/api/viewer/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'nguoithuong', password: 'anything' }),
    });
    const viewerRes = await viewerLoginPost(viewerReq);
    expect(viewerRes.status).toBe(500);
    const viewerBody = (await viewerRes.json()) as { error: string };
    expect(viewerBody.error).toContain('ADMIN_PASSWORD');
    expect(errorSpy).toHaveBeenCalled();
  });

  test('app error boundary renders Dark Velvet Crimson-Rose Vietnamese recovery UI with digest and retry action', () => {
    const resetFn = vi.fn();
    const err = Object.assign(new Error('Boom'), { digest: '412374021' });
    const { container } = render(<GlobalErrorPage error={err} reset={resetFn} />);

    expect(screen.getByRole('heading', { name: /Không thể tải trang lúc này/i })).toBeInTheDocument();
    expect(screen.getByText(/412374021/)).toBeInTheDocument();
    const retryBtn = screen.getByRole('button', { name: /Thử tải lại/i });
    fireEvent.click(retryBtn);
    expect(resetFn).toHaveBeenCalledTimes(1);
    expect(container.innerHTML).not.toMatch(/\b(sky|indigo|blue|violet|purple|slate)-|bg-white\b/);
  });

  test('AdminLoginPage and AdminPage render ProductionSetupNotice cleanly in production when ADMIN_SESSION_SECRET or ADMIN_PASSWORD is missing', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    (process.env as Record<string, string | undefined>).NODE_ENV = 'production';
    process.env.ADMIN_PASSWORD = 'MyStrongProdPassword!2026';
    delete process.env.ADMIN_SESSION_SECRET;

    const loginJsx = await AdminLoginPage();
    const { unmount } = render(loginJsx);
    expect(screen.getByRole('heading', { name: /Chưa hoàn tất cấu hình khởi động/i })).toBeInTheDocument();
    expect(screen.getAllByText(/ADMIN_SESSION_SECRET/).length).toBeGreaterThan(0);
    unmount();

    const adminJsx = await AdminPage();
    render(adminJsx);
    expect(screen.getByRole('heading', { name: /Chưa hoàn tất cấu hình khởi động/i })).toBeInTheDocument();
    expect(errorSpy).toHaveBeenCalled();
  });
});
