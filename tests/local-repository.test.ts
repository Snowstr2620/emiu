import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { verifyPasscode } from '@/lib/auth';
import { computeTrafficSummary } from '@/lib/seed-data';
import { LocalStorageRepository } from '@/lib/storage/local-repository';
import { ActivityLogItem } from '@/types/memories';

describe('LocalStorageRepository', () => {
  let tempRoot: string;
  let dataDir: string;
  let uploadDir: string;
  let repo: LocalStorageRepository;

  beforeEach(() => {
    tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'ny-repo-test-'));
    dataDir = path.join(tempRoot, 'data');
    uploadDir = path.join(tempRoot, 'uploads');
    repo = new LocalStorageRepository({ dataDir, uploadDir });
  });

  afterEach(() => {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  });

  test('auto-seeds default romantic Vietnamese settings, 4 memories, 2 users, and enables auth gate without leaking hashes', async () => {
    const pub = await repo.getPublicData();
    expect(pub.memories).toHaveLength(4);
    expect(pub.settings.coupleTitle).toBeTruthy();
    expect(pub.settings.viewerPasscodeEnabled).toBe(true);
    expect('viewerPasscodeHash' in pub.settings).toBe(false);

    const admin = await repo.getAdminData('00000000-0000-4000-8000-000000000001');
    expect('hasViewerPasscode' in admin.settings).toBe(false);
    expect('viewerPasscodeHash' in admin.settings).toBe(false);
    expect(admin.users).toHaveLength(2);
    expect(admin.currentUser?.username).toBe('admin');
    expect(admin.activityLogs).toEqual([]);
    expect(admin.trafficSummary.activeUsersCount).toBe(2);

    for (const user of admin.users) {
      expect('passwordHash' in user).toBe(false);
      expect('otpHash' in user).toBe(false);
      expect(user.hasPassword).toBe(true);
      expect(user.hasOtp).toBe(true);
    }

    const seededAdmin = await repo.getUserByUsername('admin');
    const seededViewer = await repo.getUserByUsername('nguoithuong');
    expect(seededAdmin?.role).toBe('admin');
    expect(seededAdmin?.isActive).toBe(true);
    expect(verifyPasscode('love2026', seededAdmin!.passwordHash)).toBe(true);
    expect(verifyPasscode('140226', seededAdmin!.otpHash)).toBe(true);

    expect(seededViewer?.role).toBe('viewer');
    expect(seededViewer?.isActive).toBe(true);
    expect(verifyPasscode('love2026', seededViewer!.passwordHash)).toBe(true);
    expect(verifyPasscode('121024', seededViewer!.otpHash)).toBe(true);
  });

  test('updates settings and cleans old uploaded music when replaced', async () => {
    const savedSong = await repo.saveLocalUpload({
      fileName: 'our-song.mp3',
      buffer: Buffer.from('fake-mp3-bytes'),
    });
    const uploadedSongDiskPath = path.join(uploadDir, path.basename(savedSong.publicUrl));
    expect(fs.existsSync(uploadedSongDiskPath)).toBe(true);

    const firstUpdate = await repo.updateSettings({
      coupleTitle: 'Hùng & Thảo',
      heroSubtitle: 'Chặng đường hai đứa mình',
      loveStartDate: '2024-10-12',
      musicUrl: savedSong.publicUrl,
      musicEnabled: true,
      letterTitle: 'Gửi em',
      letterBody: 'Cảm ơn em đã luôn ở bên anh.',
      letterSignature: 'Thương em, Hùng',
      viewerPasscodeEnabled: true,
    });
    expect(firstUpdate.coupleTitle).toBe('Hùng & Thảo');
    expect(firstUpdate.musicUrl).toBe(savedSong.publicUrl);

    // Replace musicUrl with sample -> old uploaded song file is removed
    const secondUpdate = await repo.updateSettings({
      coupleTitle: 'Hùng & Thảo 2026',
      heroSubtitle: 'Chặng đường hai đứa mình',
      loveStartDate: '2024-10-12',
      musicUrl: '/samples/gentle-memories.wav',
      musicEnabled: true,
      letterTitle: 'Gửi em',
      letterBody: 'Cảm ơn em rất nhiều.',
      letterSignature: 'Hùng',
      viewerPasscodeEnabled: false,
    });

    expect(secondUpdate.coupleTitle).toBe('Hùng & Thảo 2026');
    expect(secondUpdate.viewerPasscodeEnabled).toBe(false);
    expect(fs.existsSync(uploadedSongDiskPath)).toBe(false);
  });

  test('creates, updates, reorders, and deletes memories while safely cleaning uploaded files', async () => {
    const img1 = await repo.saveLocalUpload({
      fileName: 'pic1.jpg',
      buffer: Buffer.from('img-1'),
    });
    const img2 = await repo.saveLocalUpload({
      fileName: 'pic2.jpg',
      buffer: Buffer.from('img-2'),
    });

    const created = await repo.createMemory({
      memoryDate: '2026-01-15',
      title: 'Chuyến đi Đà Lạt',
      story: 'Sáng sớm sương mù phủ kín đồi thông.',
      imageUrl: img1.publicUrl,
      imageAlt: 'Đồi thông Đà Lạt',
    });

    const path1 = path.join(uploadDir, path.basename(img1.publicUrl));
    const path2 = path.join(uploadDir, path.basename(img2.publicUrl));
    expect(fs.existsSync(path1)).toBe(true);
    expect(fs.existsSync(path2)).toBe(true);

    // Replace image -> old uploaded img1 should be removed
    await repo.updateMemory(created.id, {
      memoryDate: '2026-01-15',
      title: 'Đà Lạt sáng sớm',
      story: 'Hai ly sữa đậu nành nóng hổi.',
      imageUrl: img2.publicUrl,
      imageAlt: 'Đà Lạt',
    });
    expect(fs.existsSync(path1)).toBe(false);
    expect(fs.existsSync(path2)).toBe(true);

    // Reorder: put newly created memory first
    const allBefore = (await repo.getPublicData()).memories;
    const reorderedIds = [
      created.id,
      ...allBefore.filter((m) => m.id !== created.id).map((m) => m.id),
    ];
    await repo.reorderMemories(reorderedIds);
    const allAfter = (await repo.getPublicData()).memories;
    expect(allAfter[0].id).toBe(created.id);

    // Delete memory -> uploaded img2 should be removed
    const deleted = await repo.deleteMemory(created.id);
    expect(deleted).toBe(true);
    expect(fs.existsSync(path2)).toBe(false);

    // Path traversal & /samples/ deletion attempts must be no-ops
    const outsideFile = path.join(tempRoot, 'secret.txt');
    fs.writeFileSync(outsideFile, 'keep-me');
    await repo.deleteStoredFileByUrl('/uploads/../secret.txt');
    await repo.deleteStoredFileByUrl('/samples/memory-1.svg');
    expect(fs.existsSync(outsideFile)).toBe(true);
  });

  test('falls back safely to in-memory seed data on Vercel read-only filesystem without crashing', async () => {
    const origVercel = process.env.VERCEL;
    try {
      process.env.VERCEL = '1';
      // Point to an uncreatable nested path to verify it does not write or crash
      const readOnlyRepo = new LocalStorageRepository({
        dataDir: path.join(tempRoot, 'vercel-ro-blocked', 'nested', 'data'),
        uploadDir: path.join(tempRoot, 'vercel-ro-blocked', 'nested', 'uploads'),
      });
      const pub = await readOnlyRepo.getPublicData();
      const admin = await readOnlyRepo.getAdminData();
      expect(pub.memories).toHaveLength(4);
      expect(admin.memories).toHaveLength(4);
      expect(fs.existsSync(path.join(tempRoot, 'vercel-ro-blocked'))).toBe(false);
    } finally {
      if (origVercel === undefined) {
        delete process.env.VERCEL;
      } else {
        process.env.VERCEL = origVercel;
      }
    }
  });

  test('allows enabling viewerPasscodeEnabled without legacy PIN because auth uses app_users', async () => {
    const updated = await repo.updateSettings({
      coupleTitle: 'Hùng & Thảo',
      heroSubtitle: 'Câu chuyện của hai đứa',
      loveStartDate: '2024-10-12',
      musicUrl: '/samples/gentle-memories.wav',
      musicEnabled: true,
      letterTitle: 'Gửi em',
      letterBody: 'Cảm ơn em rất nhiều.',
      letterSignature: 'Thương em',
      viewerPasscodeEnabled: true,
    });
    expect(updated.viewerPasscodeEnabled).toBe(true);
  });

  test('fails closed in production when ADMIN_PASSWORD is missing or default, and disables sample viewer when configured', async () => {
    const origNodeEnv = process.env.NODE_ENV;
    const origAdminPass = process.env.ADMIN_PASSWORD;
    try {
      (process.env as Record<string, string | undefined>).NODE_ENV = 'production';
      delete process.env.ADMIN_PASSWORD;

      const prodRepo1 = new LocalStorageRepository({
        dataDir: path.join(tempRoot, 'prod-missing'),
        uploadDir: path.join(tempRoot, 'prod-missing-uploads'),
      });
      await expect(prodRepo1.getPublicData()).rejects.toThrow(
        /ADMIN_PASSWORD is required when initializing production database/
      );

      process.env.ADMIN_PASSWORD = 'love2026';
      const prodRepo2 = new LocalStorageRepository({
        dataDir: path.join(tempRoot, 'prod-default'),
        uploadDir: path.join(tempRoot, 'prod-default-uploads'),
      });
      await expect(prodRepo2.getPublicData()).rejects.toThrow(
        /ADMIN_PASSWORD is required when initializing production database/
      );

      process.env.ADMIN_PASSWORD = 'MyStrongProdPassword!2026';
      const prodRepo3 = new LocalStorageRepository({
        dataDir: path.join(tempRoot, 'prod-ok'),
        uploadDir: path.join(tempRoot, 'prod-ok-uploads'),
      });
      const adminUser = await prodRepo3.getUserByUsername('admin');
      const viewerUser = await prodRepo3.getUserByUsername('nguoithuong');
      expect(adminUser?.isActive).toBe(true);
      expect(verifyPasscode('MyStrongProdPassword!2026', adminUser!.passwordHash)).toBe(true);
      expect(viewerUser?.isActive).toBe(false);
    } finally {
      (process.env as Record<string, string | undefined>).NODE_ENV = origNodeEnv;
      if (origAdminPass === undefined) {
        delete process.env.ADMIN_PASSWORD;
      } else {
        process.env.ADMIN_PASSWORD = origAdminPass;
      }
    }
  });

  test('migrates legacy local-db.json lacking users once (enabling gate once, then preserving explicit false)', async () => {
    fs.mkdirSync(dataDir, { recursive: true });
    const legacyDbPath = path.join(dataDir, 'local-db.json');
    fs.writeFileSync(
      legacyDbPath,
      JSON.stringify(
        {
          settings: {
            coupleTitle: 'Kỷ niệm cũ của hai đứa',
            heroSubtitle: 'Giữ nguyên tiêu đề cũ',
            loveStartDate: '2023-05-01',
            musicUrl: '/samples/gentle-memories.wav',
            musicEnabled: true,
            letterTitle: 'Thư cũ',
            letterBody: 'Nội dung thư cũ vẫn nguyên vẹn.',
            letterSignature: 'Anh',
            viewerPasscodeEnabled: false,
            viewerPasscodeHash: '',
            updatedAt: '2025-01-01T00:00:00.000Z',
          },
          memories: [
            {
              id: 'legacy-mem-1',
              memoryDate: '2023-05-01',
              title: 'Kỷ niệm cũ',
              story: 'Câu chuyện cũ',
              imageUrl: '/samples/memory-1.svg',
              imageAlt: 'Ảnh cũ',
              sortOrder: 0,
              createdAt: '2025-01-01T00:00:00.000Z',
            },
          ],
        },
        null,
        2
      ),
      'utf8'
    );

    const pub = await repo.getPublicData();
    expect(pub.settings.coupleTitle).toBe('Kỷ niệm cũ của hai đứa');
    expect(pub.settings.viewerPasscodeEnabled).toBe(true);
    expect(pub.memories).toHaveLength(1);
    expect(pub.memories[0].id).toBe('legacy-mem-1');

    const users = await repo.listUsers();
    expect(users).toHaveLength(2);

    // Admin explicitly disables gate -> subsequent reads must preserve false!
    await repo.updateSettings({
      coupleTitle: 'Kỷ niệm cũ của hai đứa',
      heroSubtitle: 'Giữ nguyên tiêu đề cũ',
      loveStartDate: '2023-05-01',
      musicUrl: '/samples/gentle-memories.wav',
      musicEnabled: true,
      letterTitle: 'Thư cũ',
      letterBody: 'Nội dung thư cũ vẫn nguyên vẹn.',
      letterSignature: 'Anh',
      viewerPasscodeEnabled: false,
    });

    const pubAfterDisable = await repo.getPublicData();
    expect(pubAfterDisable.settings.viewerPasscodeEnabled).toBe(false);
  });

  test('supports user CRUD, sessionVersion revocation, and blocks locking/demoting/deleting the last active admin', async () => {
    const initialUsers = await repo.listUsers();
    const adminUser = initialUsers.find((u) => u.username === 'admin')!;
    const viewerUser = initialUsers.find((u) => u.username === 'nguoithuong')!;

    // Cannot lock, demote, or delete the only active admin
    await expect(repo.updateUser(adminUser.id, { isActive: false })).rejects.toThrow(
      /quản trị hoạt động cuối cùng/
    );
    await expect(repo.updateUser(adminUser.id, { role: 'viewer' })).rejects.toThrow(
      /quản trị hoạt động cuối cùng/
    );
    await expect(repo.deleteUser(adminUser.id)).rejects.toThrow(/quản trị hoạt động cuối cùng/);

    // Creating duplicate username throws
    await expect(
      repo.createUser({
        username: 'admin',
        displayName: 'Trùng tên',
        role: 'viewer',
        password: 'password123',
        otpCode: '111222',
        otpHint: '',
        isActive: true,
      })
    ).rejects.toThrow(/đã tồn tại/);

    // Updating non-sensitive fields preserves sessionVersion
    const renamedViewer = await repo.updateUser(viewerUser.id, {
      displayName: 'Công chúa nhỏ',
      otpHint: 'Gợi ý mới',
    });
    expect(renamedViewer?.displayName).toBe('Công chúa nhỏ');
    expect(renamedViewer?.sessionVersion).toBe(1);

    // Changing password / OTP / role / revoking session / locking increments sessionVersion
    const revokedViewer = await repo.updateUser(viewerUser.id, { revokeSession: true });
    expect(revokedViewer?.sessionVersion).toBe(2);

    const passwordChangedViewer = await repo.updateUser(viewerUser.id, {
      password: 'newpassword123',
    });
    expect(passwordChangedViewer?.sessionVersion).toBe(3);
    expect(
      verifyPasscode('newpassword123', (await repo.getUserById(viewerUser.id))!.passwordHash)
    ).toBe(true);

    const otpChangedViewer = await repo.updateUser(viewerUser.id, { otpCode: '654321' });
    expect(otpChangedViewer?.sessionVersion).toBe(4);
    const rawViewer = await repo.getUserById(viewerUser.id);
    expect(verifyPasscode('654321', rawViewer!.otpHash)).toBe(true);

    const promotedViewer = await repo.updateUser(viewerUser.id, { role: 'admin' });
    expect(promotedViewer?.sessionVersion).toBe(5);
    expect(promotedViewer?.role).toBe('admin');

    // Demote back to viewer (adminUser is active so this succeeds, bumping version again)
    const demotedViewer = await repo.updateUser(viewerUser.id, { role: 'viewer' });
    expect(demotedViewer?.sessionVersion).toBe(6);

    await repo.recordUserLoginSuccess(viewerUser.id);
    expect((await repo.getUserById(viewerUser.id))?.lastLoginAt).toBeTruthy();

    // An INACTIVE second admin must NOT allow locking or deleting the sole active admin
    const inactiveAdmin = await repo.createUser({
      username: 'inactive.admin',
      displayName: 'Admin tạm khoá',
      role: 'admin',
      password: 'password123',
      otpCode: '111222',
      otpHint: '',
      isActive: false,
    });
    expect(inactiveAdmin.isActive).toBe(false);
    await expect(repo.updateUser(adminUser.id, { isActive: false })).rejects.toThrow(
      /quản trị hoạt động cuối cùng/
    );
    await expect(repo.deleteUser(adminUser.id)).rejects.toThrow(/quản trị hoạt động cuối cùng/);

    // Create second active admin -> now locking/deleting the first admin succeeds
    const secondAdmin = await repo.createUser({
      username: 'em.admin',
      displayName: 'Em quản trị',
      role: 'admin',
      password: 'password123',
      otpCode: '999888',
      otpHint: 'Sinh nhật em',
      isActive: true,
    });
    expect(secondAdmin.role).toBe('admin');

    const lockedFirstAdmin = await repo.updateUser(adminUser.id, { isActive: false });
    expect(lockedFirstAdmin?.isActive).toBe(false);
    expect(lockedFirstAdmin?.sessionVersion).toBe(2);

    expect(await repo.deleteUser(adminUser.id)).toBe(true);
    expect(await repo.getUserById(adminUser.id)).toBeNull();
  });

  test('records activity logs with 500-cap pruning, supports filtering, and computes Vietnam-day traffic summary', async () => {
    for (let i = 0; i < 510; i++) {
      await repo.recordActivity({
        userId: null,
        username: i % 2 === 0 ? 'khach' : 'nguoithuong',
        userRole: i % 2 === 0 ? 'guest' : 'viewer',
        eventType: i === 509 ? 'memory_viewed' : 'page_visit',
        detail: `Sự kiện số ${i}`,
        deviceSummary: i % 2 === 0 ? 'Safari · iPhone' : 'Chrome · macOS',
        metadata: i === 509 ? { memoryId: 'm1' } : null,
      });
    }

    const allLogs = await repo.listActivityLogs({ limit: 500 });
    expect(allLogs).toHaveLength(500);
    expect(allLogs[0].detail).toBe('Sự kiện số 509');
    expect(allLogs[0].eventType).toBe('memory_viewed');

    const filteredByEvent = await repo.listActivityLogs({ eventType: 'memory_viewed' });
    expect(filteredByEvent).toHaveLength(1);
    expect(filteredByEvent[0].username).toBe('nguoithuong');

    const filteredBySearch = await repo.listActivityLogs({ search: '508' });
    expect(filteredBySearch).toHaveLength(1);
    expect(filteredBySearch[0].deviceSummary).toBe('Safari · iPhone');

    const filteredByUser = await repo.listActivityLogs({ username: 'khach', limit: 10 });
    expect(filteredByUser).toHaveLength(10);
    expect(filteredByUser.every((l) => l.username === 'khach')).toBe(true);

    // Non-finite / NaN limit falls back safely to default (100) instead of returning []
    const nanLimitLogs = await repo.listActivityLogs({ limit: Number.NaN });
    expect(nanLimitLogs).toHaveLength(100);

    // Vietnam calendar day test (UTC+7):
    // Reference now: 2026-11-15T01:00:00+07:00 = 2026-11-14T18:00:00Z
    // Today in VN starts at 2026-11-14T17:00:00Z.
    const refNow = new Date('2026-11-14T18:00:00.000Z');
    const logs: ActivityLogItem[] = [
      {
        id: '1',
        userId: null,
        username: 'khach',
        userRole: 'guest',
        eventType: 'page_visit',
        detail: 'Today VN',
        deviceSummary: 'Safari · iPhone',
        metadata: null,
        createdAt: '2026-11-14T17:15:00.000Z', // 00:15 on 2026-11-15 VN (TODAY!)
      },
      {
        id: '2',
        userId: 'u2',
        username: 'nguoithuong',
        userRole: 'viewer',
        eventType: 'otp_verified',
        detail: 'Today VN',
        deviceSummary: 'Safari · iPhone',
        metadata: null,
        createdAt: '2026-11-14T17:30:00.000Z',
      },
      {
        id: '3',
        userId: null,
        username: 'khach',
        userRole: 'guest',
        eventType: 'login_failed',
        detail: 'Today VN',
        deviceSummary: 'Safari · iPhone',
        metadata: null,
        createdAt: '2026-11-14T17:45:00.000Z',
      },
      {
        id: '4',
        userId: null,
        username: 'khach',
        userRole: 'guest',
        eventType: 'otp_failed',
        detail: 'Yesterday VN',
        deviceSummary: 'Safari · iPhone',
        metadata: null,
        createdAt: '2026-11-14T16:59:00.000Z', // 23:59 on 2026-11-14 VN (YESTERDAY!)
      },
    ];
    const summary = computeTrafficSummary(logs, [], refNow);
    expect(summary).toEqual({
      visitsToday: 1,
      otpVerifiedToday: 1,
      failedAuthToday: 1,
      activeUsersCount: 0,
    });
  });
});
