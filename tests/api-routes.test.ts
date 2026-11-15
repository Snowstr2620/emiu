// @vitest-environment node
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { POST as loginPost } from '@/app/api/admin/login/route';
import { POST as logoutPost } from '@/app/api/admin/logout/route';
import { GET as settingsGet, PUT as settingsPut } from '@/app/api/admin/settings/route';
import { GET as memoriesGet, POST as memoriesPost } from '@/app/api/admin/memories/route';
import { PUT as reorderPut } from '@/app/api/admin/memories/reorder/route';
import {
  DELETE as memoryDelete,
  PUT as memoryPut,
} from '@/app/api/admin/memories/[id]/route';
import { POST as uploadUrlPost } from '@/app/api/admin/upload-url/route';
import { DELETE as uploadDelete, POST as uploadPost } from '@/app/api/admin/upload/route';
import { POST as unlockPost } from '@/app/api/viewer/unlock/route';

describe('API route handlers', () => {
  let tempRoot: string;
  let origEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    origEnv = { ...process.env };
    tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'ny-api-test-'));
    process.env.LOCAL_DATA_DIR = path.join(tempRoot, 'data');
    process.env.LOCAL_UPLOAD_DIR = path.join(tempRoot, 'uploads');
    process.env.ADMIN_PASSWORD = 'secret-test-password';
    process.env.ADMIN_SESSION_SECRET = 'test-hmac-secret-123456';
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  });

  afterEach(() => {
    process.env = origEnv;
    fs.rmSync(tempRoot, { recursive: true, force: true });
  });

  async function loginAsAdmin(): Promise<string> {
    const res = await loginPost(
      new Request('http://localhost/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: 'secret-test-password' }),
      })
    );
    expect(res.status).toBe(200);
    const cookie = res.cookies.get('ny_admin_session');
    expect(cookie?.value).toBeTruthy();
    return `ny_admin_session=${cookie!.value}`;
  }

  test('rejects unauthenticated access to protected admin routes with 401', async () => {
    const r1 = await settingsGet(new Request('http://localhost/api/admin/settings'));
    expect(r1.status).toBe(401);

    const r2 = await memoriesPost(
      new Request('http://localhost/api/admin/memories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
    );
    expect(r2.status).toBe(401);

    const r3 = await uploadUrlPost(
      new Request('http://localhost/api/admin/upload-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kind: 'image',
          mimeType: 'image/jpeg',
          size: 1024,
          fileName: 'a.jpg',
        }),
      })
    );
    expect(r3.status).toBe(401);

    const r4 = await memoryDelete(
      new Request('http://localhost/api/admin/memories/123', { method: 'DELETE' }),
      { params: Promise.resolve({ id: '123' }) }
    );
    expect(r4.status).toBe(401);
  });

  test('login fails with wrong password and succeeds with right password + logout clears cookie', async () => {
    const badRes = await loginPost(
      new Request('http://localhost/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: 'wrong' }),
      })
    );
    expect(badRes.status).toBe(401);

    const cookieHeader = await loginAsAdmin();
    const okRes = await settingsGet(
      new Request('http://localhost/api/admin/settings', {
        headers: { cookie: cookieHeader },
      })
    );
    expect(okRes.status).toBe(200);
    const body = await okRes.json();
    expect(body.settings.coupleTitle).toBeTruthy();
    expect('viewerPasscodeHash' in body.settings).toBe(false);

    const outRes = await logoutPost();
    expect(outRes.status).toBe(200);
    expect(outRes.cookies.get('ny_admin_session')?.value).toBe('');
  });

  test('authenticated upload, CRUD, reorder, and orphan cleanup work end-to-end', async () => {
    const cookieHeader = await loginAsAdmin();

    // Ask upload-url in local mode
    const urlRes = await uploadUrlPost(
      new Request('http://localhost/api/admin/upload-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', cookie: cookieHeader },
        body: JSON.stringify({
          kind: 'image',
          mimeType: 'image/jpeg',
          size: 2048,
          fileName: 'trip.jpg',
        }),
      })
    );
    expect(urlRes.status).toBe(200);
    const urlPayload = await urlRes.json();
    expect(urlPayload.mode).toBe('local');
    expect(urlPayload.uploadEndpoint).toBe('/api/admin/upload');

    // Reject SVG in upload-url
    const badMimeRes = await uploadUrlPost(
      new Request('http://localhost/api/admin/upload-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', cookie: cookieHeader },
        body: JSON.stringify({
          kind: 'image',
          mimeType: 'image/svg+xml',
          size: 512,
          fileName: 'evil.svg',
        }),
      })
    );
    expect(badMimeRes.status).toBe(400);

    // Upload real bytes via FormData
    const form = new FormData();
    form.append('kind', 'image');
    form.append('file', new File([new Uint8Array([1, 2, 3, 4])], 'trip.jpg', { type: 'image/jpeg' }));

    const upRes = await uploadPost(
      new Request('http://localhost/api/admin/upload', {
        method: 'POST',
        headers: { cookie: cookieHeader },
        body: form,
      })
    );
    expect(upRes.status).toBe(200);
    const { publicUrl } = await upRes.json();
    expect(publicUrl).toMatch(/^\/uploads\/.+\.jpg$/);

    // Create memory
    const createRes = await memoriesPost(
      new Request('http://localhost/api/admin/memories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', cookie: cookieHeader },
        body: JSON.stringify({
          memoryDate: '2025-08-20',
          title: 'Biển chiều',
          story: 'Sóng nhẹ và nắng ấm.',
          imageUrl: publicUrl,
          imageAlt: 'Biển chiều',
        }),
      })
    );
    expect(createRes.status).toBe(201);
    const createdMemory = (await createRes.json()).memory;

    // Update memory
    const updateRes = await memoryPut(
      new Request(`http://localhost/api/admin/memories/${createdMemory.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', cookie: cookieHeader },
        body: JSON.stringify({
          memoryDate: '2025-08-21',
          title: 'Biển chiều cập nhật',
          story: 'Sóng nhẹ và gió mát.',
          imageUrl: publicUrl,
          imageAlt: 'Biển chiều',
        }),
      }),
      { params: Promise.resolve({ id: createdMemory.id }) }
    );
    expect(updateRes.status).toBe(200);

    // List & Reorder
    const listRes = await memoriesGet(
      new Request('http://localhost/api/admin/memories', {
        headers: { cookie: cookieHeader },
      })
    );
    const { memories } = await listRes.json();
    const reversedIds = [...memories].reverse().map((m: { id: string }) => m.id);

    const reorderRes = await reorderPut(
      new Request('http://localhost/api/admin/memories/reorder', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', cookie: cookieHeader },
        body: JSON.stringify({ ids: reversedIds }),
      })
    );
    expect(reorderRes.status).toBe(200);
    const reorderedData = await reorderRes.json();
    expect(reorderedData.memories[0].id).toBe(reversedIds[0]);

    // Delete memory -> removes uploaded file
    const delRes = await memoryDelete(
      new Request(`http://localhost/api/admin/memories/${createdMemory.id}`, {
        method: 'DELETE',
        headers: { cookie: cookieHeader },
      }),
      { params: Promise.resolve({ id: createdMemory.id }) }
    );
    expect(delRes.status).toBe(200);

    // Orphan upload + DELETE cleanup
    const orphanForm = new FormData();
    orphanForm.append('kind', 'image');
    orphanForm.append(
      'file',
      new File([new Uint8Array([9, 8, 7])], 'orphan.jpg', { type: 'image/jpeg' })
    );
    const orphanRes = await uploadPost(
      new Request('http://localhost/api/admin/upload', {
        method: 'POST',
        headers: { cookie: cookieHeader },
        body: orphanForm,
      })
    );
    const { publicUrl: orphanUrl } = await orphanRes.json();
    const orphanFile = path.join(process.env.LOCAL_UPLOAD_DIR!, path.basename(orphanUrl));
    expect(fs.existsSync(orphanFile)).toBe(true);

    const cleanupRes = await uploadDelete(
      new Request('http://localhost/api/admin/upload', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', cookie: cookieHeader },
        body: JSON.stringify({ url: orphanUrl }),
      })
    );
    expect(cleanupRes.status).toBe(200);
    expect(fs.existsSync(orphanFile)).toBe(false);
  });

  test('viewer passcode gate verifies PIN and sets viewer cookie', async () => {
    const cookieHeader = await loginAsAdmin();

    const saveRes = await settingsPut(
      new Request('http://localhost/api/admin/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', cookie: cookieHeader },
        body: JSON.stringify({
          coupleTitle: 'Minh & Lan',
          heroSubtitle: 'Câu chuyện của hai đứa',
          loveStartDate: '2024-10-12',
          musicUrl: '/samples/gentle-memories.wav',
          musicEnabled: true,
          letterTitle: 'Gửi Lan',
          letterBody: 'Cảm ơn em đã đến.',
          letterSignature: 'Minh',
          viewerPasscodeEnabled: true,
          viewerPasscode: '1210',
        }),
      })
    );
    expect(saveRes.status).toBe(200);

    const failUnlock = await unlockPost(
      new Request('http://localhost/api/viewer/unlock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ passcode: '0000' }),
      })
    );
    expect(failUnlock.status).toBe(401);

    const okUnlock = await unlockPost(
      new Request('http://localhost/api/viewer/unlock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ passcode: '1210' }),
      })
    );
    expect(okUnlock.status).toBe(200);
    expect(okUnlock.cookies.get('ny_viewer_unlocked')?.value).toBeTruthy();
  });
});
