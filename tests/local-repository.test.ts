import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
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
      musicPlaylist: [savedSong.publicUrl],
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
      musicPlaylist: ['/samples/gentle-memories.wav'],
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

  test('saves a multi-track playlist and only deletes uploaded songs removed from it', async () => {
    const songA = await repo.saveLocalUpload({ fileName: 'a.mp3', buffer: Buffer.from('a') });
    const songB = await repo.saveLocalUpload({ fileName: 'b.mp3', buffer: Buffer.from('b') });
    const diskA = path.join(uploadDir, path.basename(songA.publicUrl));
    const diskB = path.join(uploadDir, path.basename(songB.publicUrl));
    const base = {
      coupleTitle: 'Anh & Em',
      heroSubtitle: 'Mãi bên nhau',
      loveStartDate: '2024-10-12',
      musicEnabled: true,
      letterTitle: 'Gửi em',
      letterBody: 'Thương em.',
      letterSignature: 'Anh',
      viewerPasscodeEnabled: true,
    };

    const saved = await repo.updateSettings({
      ...base,
      musicUrl: songA.publicUrl,
      musicPlaylist: [songA.publicUrl, songB.publicUrl],
    });
    expect(saved.musicPlaylist).toEqual([songA.publicUrl, songB.publicUrl]);
    expect((await repo.getPublicData()).settings.musicPlaylist).toEqual([
      songA.publicUrl,
      songB.publicUrl,
    ]);

    await repo.updateSettings({ ...base, musicUrl: songB.publicUrl, musicPlaylist: [songB.publicUrl] });
    expect(fs.existsSync(diskA)).toBe(false);
    expect(fs.existsSync(diskB)).toBe(true);
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
      musicPlaylist: ['/samples/gentle-memories.wav'],
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
            musicPlaylist: ['/samples/gentle-memories.wav'],
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
      musicPlaylist: ['/samples/gentle-memories.wav'],
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
  }, 20000);

  test('upgrades existing local-db.json lacking diaryEntries without losing data, supports dual-author diary CRUD sorted newest-first, and protects shared uploaded images', async () => {
    // Seed initial DB then strip diaryEntries from disk to simulate upgrading current local-db.json
    await repo.getPublicData();
    const dbPath = path.join(dataDir, 'local-db.json');
    const existingRaw = JSON.parse(fs.readFileSync(dbPath, 'utf8')) as Record<string, unknown>;
    delete existingRaw.diaryEntries;
    fs.writeFileSync(dbPath, JSON.stringify(existingRaw, null, 2), 'utf8');

    const upgradedPub = await repo.getPublicData();
    expect(upgradedPub.memories).toHaveLength(4);
    expect(upgradedPub.diaryEntries).toEqual([]);

    const sharedImg = await repo.saveLocalUpload({
      fileName: 'shared-photo.jpg',
      buffer: Buffer.from('shared-bytes'),
    });
    const exclusiveImg = await repo.saveLocalUpload({
      fileName: 'diary-only.webp',
      buffer: Buffer.from('exclusive-bytes'),
    });
    const sharedDiskPath = path.join(uploadDir, path.basename(sharedImg.publicUrl));
    const exclusiveDiskPath = path.join(uploadDir, path.basename(exclusiveImg.publicUrl));

    // Attach sharedImg to a memory first
    await repo.createMemory({
      memoryDate: '2026-11-16',
      title: 'Kỷ niệm dùng chung ảnh',
      story: 'Giữ ảnh này kể cả khi xoá nhật ký.',
      imageUrl: sharedImg.publicUrl,
      imageAlt: 'Ảnh chung',
    });

    const entryOlder = await repo.createDiaryEntry({
      entryDate: '2026-11-16',
      title: 'Nhật ký của Em',
      content: 'Hôm nay đi ăn kem cùng anh vui lắm.',
      mood: 'happy',
      imageUrl: sharedImg.publicUrl,
      imageAlt: 'Kem tối',
      authorId: '00000000-0000-4000-8000-000000000002',
      authorUsername: 'nguoithuong',
      authorDisplayName: 'Em bé thương yêu',
      authorRole: 'viewer',
    });

    const entryNewer = await repo.createDiaryEntry({
      entryDate: '2026-11-17',
      title: 'Nhật ký của Anh',
      content: 'Nhìn em cười là hết mệt cả ngày dài.',
      mood: 'loved',
      imageUrl: exclusiveImg.publicUrl,
      imageAlt: 'Nụ cười của em',
      authorId: '00000000-0000-4000-8000-000000000001',
      authorUsername: 'admin',
      authorDisplayName: 'Anh',
      authorRole: 'admin',
    });

    const listed = await repo.listDiaryEntries();
    expect(listed.map((e) => e.id)).toEqual([entryNewer.id, entryOlder.id]);
    expect((await repo.getDiaryEntryById(entryOlder.id))?.authorUsername).toBe('nguoithuong');
    expect(await repo.isMediaUrlReferenced(sharedImg.publicUrl)).toBe(true);
    expect(await repo.isMediaUrlReferenced('/uploads/non-existent.jpg')).toBe(false);

    // Deleting diary entry that shares an image with a memory MUST keep sharedImg on disk
    expect(await repo.deleteDiaryEntry(entryOlder.id)).toBe(true);
    expect(fs.existsSync(sharedDiskPath)).toBe(true);

    // Updating entryNewer to text-only cleans up unreferenced exclusiveImg on disk
    const updatedNewer = await repo.updateDiaryEntry(entryNewer.id, {
      entryDate: '2026-11-17',
      title: 'Nhật ký của Anh (đã sửa)',
      content: 'Chỉ giữ lại lời nhắn dịu dàng.',
      mood: 'peaceful',
      imageUrl: '',
      imageAlt: '',
    });
    expect(updatedNewer?.title).toBe('Nhật ký của Anh (đã sửa)');
    expect(updatedNewer?.mood).toBe('peaceful');
    expect(updatedNewer?.authorUsername).toBe('admin');
    expect(fs.existsSync(exclusiveDiskPath)).toBe(false);
  });

  test('serializes concurrent diary & activity writes across repository instances and retries transient Windows EPERM on rename', async () => {
    await repo.getPublicData();
    const secondRepoInstance = new LocalStorageRepository({ dataDir, uploadDir });

    const realRenameSync = fs.renameSync;
    let simulatedTransientFailure = false;
    const renameSpy = vi.spyOn(fs, 'renameSync').mockImplementation((oldPath, newPath) => {
      if (!simulatedTransientFailure) {
        simulatedTransientFailure = true;
        const eperm = Object.assign(new Error('EPERM: operation not permitted, rename'), {
          code: 'EPERM',
        });
        throw eperm;
      }
      return realRenameSync(oldPath, newPath);
    });

    try {
      await Promise.all([
        ...Array.from({ length: 4 }, (_, i) =>
          repo.createDiaryEntry({
            entryDate: '2026-11-17',
            title: `Anh #${i}`,
            content: `Bài viết song song của anh ${i}`,
            mood: 'loved',
            imageUrl: '',
            imageAlt: '',
            authorId: '00000000-0000-4000-8000-000000000001',
            authorUsername: 'admin',
            authorDisplayName: 'Anh',
            authorRole: 'admin',
          })
        ),
        ...Array.from({ length: 4 }, (_, i) =>
          secondRepoInstance.createDiaryEntry({
            entryDate: '2026-11-17',
            title: `Em #${i}`,
            content: `Bài viết song song của em ${i}`,
            mood: 'happy',
            imageUrl: '',
            imageAlt: '',
            authorId: '00000000-0000-4000-8000-000000000002',
            authorUsername: 'nguoithuong',
            authorDisplayName: 'Em',
            authorRole: 'viewer',
          })
        ),
        ...Array.from({ length: 4 }, (_, i) =>
          secondRepoInstance.recordActivity({
            userId: null,
            username: 'nguoithuong',
            userRole: 'viewer',
            eventType: 'page_visit',
            detail: `Truy cập đồng thời ${i}`,
            deviceSummary: 'Safari · iPhone',
          })
        ),
      ]);

      expect(simulatedTransientFailure).toBe(true);
      const entries = await repo.listDiaryEntries();
      const logs = await repo.listActivityLogs({ limit: 50 });
      expect(entries).toHaveLength(8);
      expect(logs).toHaveLength(4);

      const leftoverTmpFiles = fs.readdirSync(dataDir).filter((f) => f.endsWith('.tmp'));
      expect(leftoverTmpFiles).toEqual([]);
    } finally {
      renameSpy.mockRestore();
    }
  });

  test('upgrades legacy memories without images[], supports multi-photo album CRUD via getMemoryById, and deletes only dropped unreferenced photos', async () => {
    // Seed initial DB then strip images[] from existing memory to simulate legacy local-db.json
    const seedPub = await repo.getPublicData();
    const firstId = seedPub.memories[0].id;
    const dbPath = path.join(dataDir, 'local-db.json');
    const rawDb = JSON.parse(fs.readFileSync(dbPath, 'utf8')) as {
      memories: Array<Record<string, unknown>>;
    };
    delete rawDb.memories[0].images;
    fs.writeFileSync(dbPath, JSON.stringify(rawDb, null, 2), 'utf8');

    const upgradedMem = await repo.getMemoryById(firstId);
    expect(upgradedMem?.images).toEqual([
      {
        url: upgradedMem!.imageUrl,
        alt: upgradedMem!.imageAlt,
      },
    ]);

    const p1 = await repo.saveLocalUpload({ fileName: 'album-1.jpg', buffer: Buffer.from('1') });
    const p2 = await repo.saveLocalUpload({ fileName: 'album-2.jpg', buffer: Buffer.from('2') });
    const p3 = await repo.saveLocalUpload({ fileName: 'album-3.jpg', buffer: Buffer.from('3') });
    const sharedPhoto = await repo.saveLocalUpload({
      fileName: 'shared-diary.jpg',
      buffer: Buffer.from('shared'),
    });

    await repo.createDiaryEntry({
      entryDate: '2026-11-17',
      title: 'Nhật ký dùng chung ảnh',
      content: 'Giữ ảnh này kể cả khi sửa/xoá album.',
      mood: 'loved',
      imageUrl: sharedPhoto.publicUrl,
      imageAlt: 'Shared',
      authorId: '00000000-0000-4000-8000-000000000001',
      authorUsername: 'admin',
      authorDisplayName: 'Anh',
      authorRole: 'admin',
    });

    const createdAlbum = await repo.createMemory({
      memoryDate: '2026-04-05',
      title: 'Chuyến đi cùng em',
      story: 'Album gồm 3 bức ảnh và 1 ảnh dùng chung.',
      imageUrl: p1.publicUrl,
      imageAlt: 'Bìa album',
      images: [
        { url: p1.publicUrl, alt: 'Bìa album' },
        { url: p2.publicUrl, alt: 'Khoảnh khắc 2' },
        { url: p3.publicUrl, alt: 'Khoảnh khắc 3' },
        { url: sharedPhoto.publicUrl, alt: 'Ảnh dùng chung' },
      ],
    });

    expect(createdAlbum.images).toHaveLength(4);
    expect(createdAlbum.imageUrl).toBe(p1.publicUrl);
    expect(await repo.isMediaUrlReferenced(p2.publicUrl)).toBe(true);
    expect(await repo.isMediaUrlReferenced(p3.publicUrl)).toBe(true);

    // Update album: reorder p2 as new cover, keep p3, drop p1 and sharedPhoto
    const updatedAlbum = await repo.updateMemory(createdAlbum.id, {
      memoryDate: '2026-04-05',
      title: 'Chuyến đi cùng em (đổi bìa)',
      story: 'Đổi ảnh 2 lên làm ảnh bìa.',
      imageUrl: p2.publicUrl,
      imageAlt: 'Bìa mới',
      images: [
        { url: p2.publicUrl, alt: 'Bìa mới' },
        { url: p3.publicUrl, alt: 'Khoảnh khắc 3' },
      ],
    });

    expect(updatedAlbum?.imageUrl).toBe(p2.publicUrl);
    expect(updatedAlbum?.images).toHaveLength(2);
    expect(fs.existsSync(path.join(uploadDir, path.basename(p1.publicUrl)))).toBe(false);
    expect(fs.existsSync(path.join(uploadDir, path.basename(p2.publicUrl)))).toBe(true);
    expect(fs.existsSync(path.join(uploadDir, path.basename(p3.publicUrl)))).toBe(true);
    expect(fs.existsSync(path.join(uploadDir, path.basename(sharedPhoto.publicUrl)))).toBe(true);

    // Delete album -> removes remaining p2 & p3
    expect(await repo.deleteMemory(createdAlbum.id)).toBe(true);
    expect(fs.existsSync(path.join(uploadDir, path.basename(p2.publicUrl)))).toBe(false);
    expect(fs.existsSync(path.join(uploadDir, path.basename(p3.publicUrl)))).toBe(false);
    expect(await repo.getMemoryById(createdAlbum.id)).toBeNull();
  });
});
