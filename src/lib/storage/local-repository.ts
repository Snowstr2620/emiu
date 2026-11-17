import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { hashPasscode } from '@/lib/auth';
import { getMemoryImages } from '@/lib/memory-album';
import {
  assertCanModifyActiveAdmin,
  computeTrafficSummary,
  createInitialSeedData,
  ensureSeededUsersAndUpgrade,
  filterActivityLogs,
  LocalDbSchema,
  sanitizeUserForClient,
  shouldBumpSessionVersion,
  sortDiaryEntries,
  stripSettingsForAdmin,
  stripSettingsForPublic,
} from '@/lib/seed-data';
import {
  ALLOWED_AUDIO_EXTENSIONS,
  ALLOWED_IMAGE_EXTENSIONS,
  ALLOWED_VIDEO_EXTENSIONS,
  sanitizeStorageFileName,
  ValidatedCreateUserPayload,
  ValidatedDiaryEntryPayload,
  ValidatedSettingsPayload,
  ValidatedUpdateUserPayload,
} from '@/lib/validation';
import {
  CreateDiaryEntryInput,
  ListActivityLogsFilter,
  MemoryMutationInput,
  RecordActivityInput,
  StorageRepository,
} from '@/lib/storage/types';
import {
  ActivityLogItem,
  AdminSiteData,
  AdminSiteSettings,
  AppUser,
  DiaryEntry,
  MemoryItem,
  PublicSiteData,
  SafeAppUser,
} from '@/types/memories';

export interface LocalStorageOptions {
  dataDir?: string;
  uploadDir?: string;
}

const MAX_LOCAL_ACTIVITY_LOGS = 500;
const RENAME_RETRY_CODES = new Set(['EPERM', 'EBUSY', 'EACCES']);

/**
 * Per-file async mutex shared across all LocalStorageRepository instances in a
 * Node.js server process so concurrent requests never clobber `local-db.json`.
 */
const fileWriteLocks = new Map<string, Promise<void>>();

function runWithFileLock<T>(lockKey: string, task: () => Promise<T> | T): Promise<T> {
  const previous = fileWriteLocks.get(lockKey) ?? Promise.resolve();
  let releaseCurrent!: () => void;
  const currentGate = new Promise<void>((resolve) => {
    releaseCurrent = resolve;
  });
  const chained = previous.then(() => currentGate);
  fileWriteLocks.set(lockKey, chained);

  return previous.then(async () => {
    try {
      return await task();
    } finally {
      releaseCurrent();
      if (fileWriteLocks.get(lockKey) === chained) {
        fileWriteLocks.delete(lockKey);
      }
    }
  });
}

function isReadOnlyFsError(err: unknown): boolean {
  const code = (err as NodeJS.ErrnoException)?.code;
  return code === 'EROFS' || code === 'EACCES' || code === 'EPERM';
}

function isUrlReferencedInDb(db: LocalDbSchema, url: string): boolean {
  const trimmed = url.trim();
  if (!trimmed) return false;
  if (db.settings.musicUrl === trimmed) return true;
  if (db.memories.some((m) => m.imageUrl === trimmed || getMemoryImages(m).some((i) => i.url === trimmed))) {
    return true;
  }
  if (db.diaryEntries.some((d) => d.imageUrl === trimmed)) return true;
  return false;
}

export class LocalStorageRepository implements StorageRepository {
  private readonly dbPath: string;
  private readonly lockKey: string;
  private readonly uploadDir: string;

  constructor(options: LocalStorageOptions = {}) {
    const dataDir =
      options.dataDir || process.env.LOCAL_DATA_DIR || path.join(process.cwd(), 'data');
    this.uploadDir =
      options.uploadDir ||
      process.env.LOCAL_UPLOAD_DIR ||
      path.join(process.cwd(), 'public', 'uploads');
    this.dbPath = path.join(dataDir, 'local-db.json');
    this.lockKey = path.resolve(this.dbPath);
  }

  private withWriteLock<T>(task: () => Promise<T> | T): Promise<T> {
    return runWithFileLock(this.lockKey, task);
  }

  private readDb(): LocalDbSchema {
    if (process.env.VERCEL && !fs.existsSync(this.dbPath)) {
      return createInitialSeedData();
    }

    try {
      fs.mkdirSync(path.dirname(this.dbPath), { recursive: true });
      fs.mkdirSync(this.uploadDir, { recursive: true });

      if (!fs.existsSync(this.dbPath)) {
        const seed = createInitialSeedData();
        this.writeDb(seed);
        return seed;
      }

      const raw = fs.readFileSync(this.dbPath, 'utf8');
      const parsed = JSON.parse(raw) as Partial<LocalDbSchema>;
      const { db, migrated } = ensureSeededUsersAndUpgrade(parsed);

      if (migrated) {
        try {
          this.writeDb(db);
        } catch (err) {
          if (!isReadOnlyFsError(err)) throw err;
        }
      }

      return db;
    } catch (err) {
      if (isReadOnlyFsError(err)) {
        return createInitialSeedData();
      }
      throw err;
    }
  }

  private writeDb(data: LocalDbSchema): void {
    fs.mkdirSync(path.dirname(this.dbPath), { recursive: true });
    const tmpPath = `${this.dbPath}.${process.pid}.${crypto.randomUUID().slice(0, 8)}.tmp`;
    fs.writeFileSync(tmpPath, JSON.stringify(data, null, 2), 'utf8');

    const maxAttempts = 4;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        fs.renameSync(tmpPath, this.dbPath);
        return;
      } catch (err) {
        const code = (err as NodeJS.ErrnoException)?.code ?? '';
        if (attempt === maxAttempts || !RENAME_RETRY_CODES.has(code)) {
          try {
            if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath);
          } catch {
            // Ignore temp cleanup failure
          }
          throw err;
        }
      }
    }
  }

  private writeDbBestEffortOnServerless(data: LocalDbSchema): void {
    try {
      this.writeDb(data);
    } catch (err) {
      if (!(process.env.VERCEL && isReadOnlyFsError(err))) {
        throw err;
      }
    }
  }

  async getPublicData(): Promise<PublicSiteData> {
    const db = this.readDb();
    return {
      settings: stripSettingsForPublic(db.settings),
      memories: db.memories,
      diaryEntries: sortDiaryEntries(db.diaryEntries),
    };
  }

  async getAdminData(currentUserId?: string | null): Promise<AdminSiteData> {
    const db = this.readDb();
    const users = db.users.map(sanitizeUserForClient);
    const currentUser = currentUserId ? (users.find((u) => u.id === currentUserId) ?? null) : null;

    return {
      settings: stripSettingsForAdmin(db.settings),
      memories: db.memories,
      diaryEntries: sortDiaryEntries(db.diaryEntries),
      users,
      activityLogs: db.activityLogs.slice(0, 200),
      trafficSummary: computeTrafficSummary(db.activityLogs, db.users),
      currentUser,
    };
  }

  async updateSettings(input: ValidatedSettingsPayload): Promise<AdminSiteSettings> {
    return this.withWriteLock(async () => {
      const db = this.readDb();
      const previousMusicUrl = db.settings.musicUrl;

      const nextHash = input.viewerPasscode
        ? hashPasscode(input.viewerPasscode)
        : (db.settings.viewerPasscodeHash ?? '');

      db.settings = {
        coupleTitle: input.coupleTitle,
        heroSubtitle: input.heroSubtitle,
        loveStartDate: input.loveStartDate,
        musicUrl: input.musicUrl,
        musicEnabled: input.musicEnabled,
        letterTitle: input.letterTitle,
        letterBody: input.letterBody,
        letterSignature: input.letterSignature,
        viewerPasscodeEnabled: input.viewerPasscodeEnabled,
        viewerPasscodeHash: nextHash,
        updatedAt: new Date().toISOString(),
      };

      this.writeDb(db);

      if (
        previousMusicUrl &&
        previousMusicUrl !== input.musicUrl &&
        !isUrlReferencedInDb(db, previousMusicUrl)
      ) {
        await this.deleteStoredFileByUrl(previousMusicUrl);
      }

      return stripSettingsForAdmin(db.settings);
    });
  }

  async getMemoryById(id: string): Promise<MemoryItem | null> {
    if (!id) return null;
    const db = this.readDb();
    return db.memories.find((m) => m.id === id) ?? null;
  }

  async createMemory(input: MemoryMutationInput): Promise<MemoryItem> {
    return this.withWriteLock(() => {
      const db = this.readDb();
      const maxSort = db.memories.reduce((max, m) => Math.max(max, m.sortOrder), -1);
      const images = getMemoryImages({
        title: input.title,
        imageUrl: input.imageUrl,
        imageAlt: input.imageAlt,
        images: input.images,
      });
      const cover = images[0] ?? { url: input.imageUrl, alt: input.imageAlt };

      const created: MemoryItem = {
        id: crypto.randomUUID(),
        memoryDate: input.memoryDate,
        title: input.title,
        story: input.story,
        imageUrl: cover.url,
        imageAlt: cover.alt,
        images,
        sortOrder: maxSort + 1,
        createdAt: new Date().toISOString(),
      };
      db.memories.push(created);
      this.writeDb(db);
      return created;
    });
  }

  async updateMemory(id: string, input: MemoryMutationInput): Promise<MemoryItem | null> {
    return this.withWriteLock(async () => {
      const db = this.readDb();
      const idx = db.memories.findIndex((m) => m.id === id);
      if (idx === -1) return null;

      const previousUrls = new Set<string>(
        [
          db.memories[idx].imageUrl,
          ...getMemoryImages(db.memories[idx]).map((img) => img.url),
        ].filter(Boolean)
      );
      const images = getMemoryImages({
        title: input.title,
        imageUrl: input.imageUrl,
        imageAlt: input.imageAlt,
        images: input.images,
      });
      const cover = images[0] ?? { url: input.imageUrl, alt: input.imageAlt };

      const updated: MemoryItem = {
        ...db.memories[idx],
        memoryDate: input.memoryDate,
        title: input.title,
        story: input.story,
        imageUrl: cover.url,
        imageAlt: cover.alt,
        images,
      };

      db.memories[idx] = updated;
      this.writeDb(db);

      for (const oldUrl of previousUrls) {
        if (!isUrlReferencedInDb(db, oldUrl)) {
          await this.deleteStoredFileByUrl(oldUrl);
        }
      }

      return updated;
    });
  }

  async deleteMemory(id: string): Promise<boolean> {
    return this.withWriteLock(async () => {
      const db = this.readDb();
      const target = db.memories.find((m) => m.id === id);
      if (!target) return false;

      const targetUrls = new Set<string>(
        [target.imageUrl, ...getMemoryImages(target).map((img) => img.url)].filter(Boolean)
      );

      db.memories = db.memories
        .filter((m) => m.id !== id)
        .map((m, index) => ({ ...m, sortOrder: index }));
      this.writeDb(db);

      for (const oldUrl of targetUrls) {
        if (!isUrlReferencedInDb(db, oldUrl)) {
          await this.deleteStoredFileByUrl(oldUrl);
        }
      }
      return true;
    });
  }

  async reorderMemories(ids: string[]): Promise<MemoryItem[]> {
    return this.withWriteLock(() => {
      const db = this.readDb();
      const map = new Map(db.memories.map((m) => [m.id, m]));
      const reordered: MemoryItem[] = [];

      for (const id of ids) {
        const item = map.get(id);
        if (item) {
          reordered.push(item);
          map.delete(id);
        }
      }
      for (const remaining of map.values()) {
        reordered.push(remaining);
      }

      db.memories = reordered.map((m, index) => ({ ...m, sortOrder: index }));
      this.writeDb(db);
      return db.memories;
    });
  }

  async listDiaryEntries(): Promise<DiaryEntry[]> {
    const db = this.readDb();
    return sortDiaryEntries(db.diaryEntries);
  }

  async getDiaryEntryById(id: string): Promise<DiaryEntry | null> {
    if (!id) return null;
    const db = this.readDb();
    return db.diaryEntries.find((d) => d.id === id) ?? null;
  }

  async createDiaryEntry(input: CreateDiaryEntryInput): Promise<DiaryEntry> {
    return this.withWriteLock(() => {
      const db = this.readDb();
      const now = new Date().toISOString();
      const created: DiaryEntry = {
        id: crypto.randomUUID(),
        entryDate: input.entryDate,
        title: input.title,
        content: input.content,
        mood: input.mood,
        imageUrl: input.imageUrl,
        imageAlt: input.imageAlt,
        authorId: input.authorId,
        authorUsername: input.authorUsername,
        authorDisplayName: input.authorDisplayName,
        authorRole: input.authorRole,
        createdAt: now,
        updatedAt: now,
      };
      db.diaryEntries.push(created);
      db.diaryEntries = sortDiaryEntries(db.diaryEntries);
      this.writeDb(db);
      return created;
    });
  }

  async updateDiaryEntry(
    id: string,
    input: ValidatedDiaryEntryPayload
  ): Promise<DiaryEntry | null> {
    return this.withWriteLock(async () => {
      const db = this.readDb();
      const idx = db.diaryEntries.findIndex((d) => d.id === id);
      if (idx === -1) return null;

      const previousImageUrl = db.diaryEntries[idx].imageUrl;
      const updated: DiaryEntry = {
        ...db.diaryEntries[idx],
        entryDate: input.entryDate,
        title: input.title,
        content: input.content,
        mood: input.mood,
        imageUrl: input.imageUrl,
        imageAlt: input.imageAlt,
        updatedAt: new Date().toISOString(),
      };

      db.diaryEntries[idx] = updated;
      db.diaryEntries = sortDiaryEntries(db.diaryEntries);
      this.writeDb(db);

      if (
        previousImageUrl &&
        previousImageUrl !== input.imageUrl &&
        !isUrlReferencedInDb(db, previousImageUrl)
      ) {
        await this.deleteStoredFileByUrl(previousImageUrl);
      }

      return updated;
    });
  }

  async deleteDiaryEntry(id: string): Promise<boolean> {
    return this.withWriteLock(async () => {
      const db = this.readDb();
      const target = db.diaryEntries.find((d) => d.id === id);
      if (!target) return false;

      db.diaryEntries = db.diaryEntries.filter((d) => d.id !== id);
      this.writeDb(db);

      if (target.imageUrl && !isUrlReferencedInDb(db, target.imageUrl)) {
        await this.deleteStoredFileByUrl(target.imageUrl);
      }
      return true;
    });
  }

  async isMediaUrlReferenced(url: string): Promise<boolean> {
    const db = this.readDb();
    return isUrlReferencedInDb(db, url);
  }

  async listUsers(): Promise<SafeAppUser[]> {
    const db = this.readDb();
    return db.users.map(sanitizeUserForClient);
  }

  async getUserByUsername(username: string): Promise<AppUser | null> {
    const normalized = username.trim().toLowerCase();
    if (!normalized) return null;
    const db = this.readDb();
    return db.users.find((u) => u.username === normalized) ?? null;
  }

  async getUserById(id: string): Promise<AppUser | null> {
    if (!id) return null;
    const db = this.readDb();
    return db.users.find((u) => u.id === id) ?? null;
  }

  async createUser(input: ValidatedCreateUserPayload): Promise<SafeAppUser> {
    return this.withWriteLock(() => {
      const db = this.readDb();
      const username = input.username.trim().toLowerCase();
      if (db.users.some((u) => u.username === username)) {
        throw new Error('Tên đăng nhập này đã tồn tại.');
      }

      const now = new Date().toISOString();
      const created: AppUser = {
        id: crypto.randomUUID(),
        username,
        displayName: input.displayName.trim(),
        role: input.role,
        passwordHash: hashPasscode(input.password),
        otpHash: hashPasscode(input.otpCode),
        otpHint: input.otpHint.trim(),
        isActive: input.isActive,
        sessionVersion: 1,
        lastLoginAt: null,
        createdAt: now,
        updatedAt: now,
      };

      db.users.push(created);
      this.writeDb(db);
      return sanitizeUserForClient(created);
    });
  }

  async updateUser(id: string, input: ValidatedUpdateUserPayload): Promise<SafeAppUser | null> {
    return this.withWriteLock(() => {
      const db = this.readDb();
      const idx = db.users.findIndex((u) => u.id === id);
      if (idx === -1) return null;

      const current = db.users[idx];
      const otherActiveAdminsCount = db.users.filter(
        (u) => u.id !== id && u.role === 'admin' && u.isActive
      ).length;

      assertCanModifyActiveAdmin(
        current,
        otherActiveAdminsCount,
        'update',
        input.role,
        input.isActive
      );

      const nextSessionVersion = shouldBumpSessionVersion(current, input)
        ? current.sessionVersion + 1
        : current.sessionVersion;

      const updated: AppUser = {
        ...current,
        displayName:
          input.displayName !== undefined ? input.displayName.trim() : current.displayName,
        role: input.role ?? current.role,
        passwordHash: input.password ? hashPasscode(input.password) : current.passwordHash,
        otpHash: input.otpCode ? hashPasscode(input.otpCode) : current.otpHash,
        otpHint: input.otpHint !== undefined ? input.otpHint.trim() : current.otpHint,
        isActive: input.isActive ?? current.isActive,
        sessionVersion: nextSessionVersion,
        updatedAt: new Date().toISOString(),
      };

      db.users[idx] = updated;
      this.writeDb(db);
      return sanitizeUserForClient(updated);
    });
  }

  async deleteUser(id: string): Promise<boolean> {
    return this.withWriteLock(() => {
      const db = this.readDb();
      const target = db.users.find((u) => u.id === id);
      if (!target) return false;

      const otherActiveAdminsCount = db.users.filter(
        (u) => u.id !== id && u.role === 'admin' && u.isActive
      ).length;
      assertCanModifyActiveAdmin(target, otherActiveAdminsCount, 'delete');

      db.users = db.users.filter((u) => u.id !== id);
      this.writeDb(db);
      return true;
    });
  }

  async recordUserLoginSuccess(id: string): Promise<void> {
    return this.withWriteLock(() => {
      const db = this.readDb();
      const idx = db.users.findIndex((u) => u.id === id);
      if (idx === -1) return;

      const now = new Date().toISOString();
      db.users[idx] = {
        ...db.users[idx],
        lastLoginAt: now,
        updatedAt: now,
      };
      this.writeDbBestEffortOnServerless(db);
    });
  }

  async recordActivity(input: RecordActivityInput): Promise<ActivityLogItem> {
    return this.withWriteLock(() => {
      const db = this.readDb();
      const item: ActivityLogItem = {
        id: crypto.randomUUID(),
        userId: input.userId,
        username: input.username,
        userRole: input.userRole,
        eventType: input.eventType,
        detail: input.detail.slice(0, 160),
        deviceSummary: input.deviceSummary.slice(0, 48),
        metadata: input.metadata ?? null,
        createdAt: new Date().toISOString(),
      };

      db.activityLogs.unshift(item);
      if (db.activityLogs.length > MAX_LOCAL_ACTIVITY_LOGS) {
        db.activityLogs = db.activityLogs.slice(0, MAX_LOCAL_ACTIVITY_LOGS);
      }
      this.writeDbBestEffortOnServerless(db);
      return item;
    });
  }

  async listActivityLogs(filters?: ListActivityLogsFilter): Promise<ActivityLogItem[]> {
    const db = this.readDb();
    return filterActivityLogs(db.activityLogs, filters);
  }

  async saveLocalUpload(input: {
    fileName: string;
    buffer: Buffer;
  }): Promise<{ publicUrl: string }> {
    const safeName = sanitizeStorageFileName(input.fileName);
    const ext = path.posix.extname(safeName.toLowerCase());
    if (
      !ALLOWED_IMAGE_EXTENSIONS.has(ext) &&
      !ALLOWED_VIDEO_EXTENSIONS.has(ext) &&
      !ALLOWED_AUDIO_EXTENSIONS.has(ext)
    ) {
      throw new Error('Đuôi tệp không thuộc danh sách được phép tải lên.');
    }

    fs.mkdirSync(this.uploadDir, { recursive: true });
    const uniqueName = `${Date.now()}-${crypto.randomUUID().slice(0, 8)}-${safeName}`;
    const targetPath = path.join(this.uploadDir, uniqueName);
    fs.writeFileSync(targetPath, input.buffer);
    return { publicUrl: `/uploads/${uniqueName}` };
  }

  async deleteStoredFileByUrl(url: string): Promise<void> {
    if (!url || !url.startsWith('/uploads/') || url.includes('..')) {
      return;
    }

    const relativePart = url.slice('/uploads/'.length);
    if (!relativePart || relativePart.includes('/') || relativePart.includes('\\')) {
      return;
    }

    const resolvedDir = path.resolve(this.uploadDir);
    const resolvedTarget = path.resolve(resolvedDir, relativePart);
    if (!resolvedTarget.startsWith(`${resolvedDir}${path.sep}`)) {
      return;
    }

    if (fs.existsSync(resolvedTarget)) {
      fs.unlinkSync(resolvedTarget);
    }
  }
}
