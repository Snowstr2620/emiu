import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { LocalStorageRepository } from '@/lib/storage/local-repository';

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

  test('auto-seeds default Vietnamese settings and 4 sample memories without leaking passcode hash', async () => {
    const pub = await repo.getPublicData();
    expect(pub.memories).toHaveLength(4);
    expect(pub.settings.coupleTitle).toBeTruthy();
    expect('viewerPasscodeHash' in pub.settings).toBe(false);

    const admin = await repo.getAdminData();
    expect(admin.settings.hasViewerPasscode).toBe(false);
    expect('viewerPasscodeHash' in admin.settings).toBe(false);
  });

  test('updates settings, preserves passcode when omitted, and cleans old uploaded music only', async () => {
    const savedSong = await repo.saveLocalUpload({
      fileName: 'our-song.mp3',
      buffer: Buffer.from('fake-mp3-bytes'),
    });
    const uploadedSongDiskPath = path.join(uploadDir, path.basename(savedSong.publicUrl));
    expect(fs.existsSync(uploadedSongDiskPath)).toBe(true);

    await repo.updateSettings({
      coupleTitle: 'Hùng & Thảo',
      heroSubtitle: 'Chặng đường hai đứa mình',
      loveStartDate: '2024-10-12',
      musicUrl: savedSong.publicUrl,
      musicEnabled: true,
      letterTitle: 'Gửi em',
      letterBody: 'Cảm ơn em đã luôn ở bên anh.',
      letterSignature: 'Thương em, Hùng',
      viewerPasscodeEnabled: true,
      viewerPasscode: '1210',
    });

    expect(await repo.verifyViewerPasscode('1210')).toBe(true);
    expect(await repo.verifyViewerPasscode('9999')).toBe(false);

    // Update settings again WITHOUT passing viewerPasscode -> must keep old passcode
    await repo.updateSettings({
      coupleTitle: 'Hùng & Thảo 2026',
      heroSubtitle: 'Chặng đường hai đứa mình',
      loveStartDate: '2024-10-12',
      musicUrl: '/samples/gentle-memories.wav',
      musicEnabled: true,
      letterTitle: 'Gửi em',
      letterBody: 'Cảm ơn em rất nhiều.',
      letterSignature: 'Hùng',
      viewerPasscodeEnabled: true,
    });

    expect(await repo.verifyViewerPasscode('1210')).toBe(true);
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
});
