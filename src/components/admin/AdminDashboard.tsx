'use client';

import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Activity,
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  CalendarHeart,
  CheckCircle2,
  Cloud,
  ExternalLink,
  HardDrive,
  Heart,
  ImagePlus,
  KeyRound,
  Lock,
  LogOut,
  Mail,
  Music,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Trash2,
  Unlock,
  Upload,
  UserPlus,
  Users,
} from 'lucide-react';
import { cleanupUploadedUrl, UploadAuthError, uploadMediaFile } from '@/lib/admin-upload';
import {
  calculateDaysTogether,
  formatMemoryDateVi,
  getVietnamCalendarDateParts,
} from '@/lib/date-utils';
import type {
  ActivityActorRole,
  ActivityEventType,
  ActivityLogItem,
  AdminSiteData,
  AdminSiteSettings,
  MemoryItem,
  SafeAppUser,
  StorageStatus,
  TrafficSummary,
  UserRole,
} from '@/types/memories';

type AdminTab = 'memories' | 'settings' | 'letter' | 'users' | 'activity';

interface AdminDashboardProps {
  initialData: AdminSiteData;
  storageStatus: StorageStatus;
}

interface MemoryFormState {
  id: string | null;
  memoryDate: string;
  title: string;
  story: string;
  imageUrl: string;
  imageAlt: string;
}

interface SettingsFormState {
  coupleTitle: string;
  heroSubtitle: string;
  loveStartDate: string;
  musicUrl: string;
  musicEnabled: boolean;
  letterTitle: string;
  letterBody: string;
  letterSignature: string;
  viewerPasscodeEnabled: boolean;
}

interface CreateUserFormState {
  username: string;
  displayName: string;
  role: UserRole;
  password: string;
  otpCode: string;
  otpHint: string;
  isActive: boolean;
}

interface EditUserFormState {
  displayName: string;
  role: UserRole;
  password: string;
  otpCode: string;
  otpHint: string;
}

const ACTIVITY_EVENT_META: Record<ActivityEventType, { label: string; badgeClass: string }> = {
  page_visit: {
    label: 'Ghé trang',
    badgeClass: 'border-slate-200 bg-slate-100 text-slate-700',
  },
  page_leave: {
    label: 'Rời trang',
    badgeClass: 'border-slate-200 bg-slate-100 text-slate-700',
  },
  login_step1_ok: {
    label: 'Đăng nhập bước 1',
    badgeClass: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  },
  login_failed: {
    label: 'Đăng nhập thất bại',
    badgeClass: 'border-rose-200 bg-rose-50 text-rose-700',
  },
  otp_verified: {
    label: 'Xác thực OTP thành công',
    badgeClass: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  },
  otp_failed: {
    label: 'Sai mã OTP',
    badgeClass: 'border-rose-200 bg-rose-50 text-rose-700',
  },
  pixel_heart_viewed: {
    label: 'Ngắm trái tim pixel',
    badgeClass: 'border-pink-200 bg-pink-50 text-pink-700',
  },
  music_toggled: {
    label: 'Bật / tắt nhạc nền',
    badgeClass: 'border-indigo-200 bg-indigo-50 text-indigo-700',
  },
  memory_viewed: {
    label: 'Xem ảnh kỷ niệm',
    badgeClass: 'border-pink-200 bg-pink-50 text-pink-700',
  },
  letter_opened: {
    label: 'Mở phong thư',
    badgeClass: 'border-pink-200 bg-pink-50 text-pink-700',
  },
  logout: {
    label: 'Đăng xuất',
    badgeClass: 'border-slate-200 bg-slate-100 text-slate-700',
  },
};

const ACTIVITY_EVENT_OPTIONS = Object.entries(ACTIVITY_EVENT_META) as Array<
  [ActivityEventType, { label: string; badgeClass: string }]
>;

const ACTOR_ROLE_META: Record<ActivityActorRole, { label: string; badgeClass: string }> = {
  admin: {
    label: 'Admin',
    badgeClass: 'border-indigo-200 bg-indigo-50 text-indigo-700',
  },
  viewer: {
    label: 'Người thương',
    badgeClass: 'border-pink-200 bg-pink-50 text-pink-700',
  },
  guest: {
    label: 'Khách',
    badgeClass: 'border-slate-200 bg-slate-100 text-slate-600',
  },
};

function getActivityDisplayMeta(log: ActivityLogItem) {
  const eventMeta = ACTIVITY_EVENT_META[log.eventType] ?? {
    label: log.eventType,
    badgeClass: 'border-slate-200 bg-slate-100 text-slate-700',
  };
  const roleMeta = ACTOR_ROLE_META[log.userRole] ?? ACTOR_ROLE_META.guest;
  return { eventMeta, roleMeta };
}

function formatVietnamDateTime(iso: string | null | undefined, emptyLabel = 'Chưa có'): string {
  if (!iso) return emptyLabel;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return String(iso);
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  const map = Object.fromEntries(parts.map((p) => [p.type, p.value]));
  return `${map.hour}:${map.minute}:${map.second} ${map.day}/${map.month}/${map.year}`;
}

function getTodayVietnamIso(): string {
  const vn = getVietnamCalendarDateParts();
  return `${vn.year}-${String(vn.month).padStart(2, '0')}-${String(vn.day).padStart(2, '0')}`;
}

function toSettingsForm(settings: AdminSiteSettings): SettingsFormState {
  return {
    coupleTitle: settings.coupleTitle,
    heroSubtitle: settings.heroSubtitle,
    loveStartDate: settings.loveStartDate,
    musicUrl: settings.musicUrl,
    musicEnabled: settings.musicEnabled,
    letterTitle: settings.letterTitle,
    letterBody: settings.letterBody,
    letterSignature: settings.letterSignature,
    viewerPasscodeEnabled: settings.viewerPasscodeEnabled,
  };
}

function createInitialUserForm(): CreateUserFormState {
  return {
    username: '',
    displayName: '',
    role: 'viewer',
    password: '',
    otpCode: '',
    otpHint: '',
    isActive: true,
  };
}

/** Validate user account fields in sync with server-side `validation.ts` rules. */
function validateUserFormFields(input: {
  displayName: string;
  password: string;
  otpCode: string;
  otpHint: string;
  requirePasswordAndOtp: boolean;
}): string | null {
  const trimmedDisplay = input.displayName.trim();
  const trimmedOtp = input.otpCode.trim();
  const trimmedHint = input.otpHint.trim();

  if (!trimmedDisplay) {
    return input.requirePasswordAndOtp
      ? 'Vui lòng nhập tên hiển thị cho tài khoản.'
      : 'Tên hiển thị không được để trống.';
  }
  if (trimmedDisplay.length > 60) {
    return 'Tên hiển thị tối đa 60 ký tự.';
  }

  if (input.requirePasswordAndOtp || input.password.length > 0) {
    if (!input.password.trim() || input.password.length < 6 || input.password.length > 128) {
      return 'Mật khẩu mới cần từ 6–128 ký tự và không chỉ chứa khoảng trắng.';
    }
  }

  if (trimmedHint.length > 120) {
    return 'Gợi ý OTP tối đa 120 ký tự.';
  }

  if (input.requirePasswordAndOtp || trimmedOtp.length > 0) {
    if (!/^\d{6}$/.test(trimmedOtp)) {
      return input.requirePasswordAndOtp
        ? 'Mã OTP phải gồm đúng 6 chữ số.'
        : 'Mã OTP mới phải gồm đúng 6 chữ số.';
    }
  }

  return null;
}

export function AdminDashboard({ initialData, storageStatus }: AdminDashboardProps) {
  const router = useRouter();
  const memoryFormRef = useRef<HTMLDivElement>(null);
  const memoryFileInputRef = useRef<HTMLInputElement>(null);
  const audioFileInputRef = useRef<HTMLInputElement>(null);
  const activityRequestSeqRef = useRef(0);

  const [activeTab, setActiveTab] = useState<AdminTab>('memories');
  const [memories, setMemories] = useState<MemoryItem[]>(initialData.memories);
  const [settingsForm, setSettingsForm] = useState<SettingsFormState>(() =>
    toSettingsForm(initialData.settings)
  );
  const [users, setUsers] = useState<SafeAppUser[]>(initialData.users ?? []);
  const currentUser = useMemo(() => {
    const initialCurrent = initialData.currentUser ?? null;
    if (!initialCurrent) return null;
    return users.find((u) => u.id === initialCurrent.id) ?? initialCurrent;
  }, [initialData.currentUser, users]);
  const [activityLogs, setActivityLogs] = useState<ActivityLogItem[]>(
    initialData.activityLogs ?? []
  );
  const [trafficSummary, setTrafficSummary] = useState<TrafficSummary>(() => ({
    visitsToday: initialData.trafficSummary?.visitsToday ?? 0,
    otpVerifiedToday: initialData.trafficSummary?.otpVerifiedToday ?? 0,
    failedAuthToday: initialData.trafficSummary?.failedAuthToday ?? 0,
    activeUsersCount:
      initialData.trafficSummary?.activeUsersCount ??
      (initialData.users ?? []).filter((u) => u.isActive).length,
  }));

  const [notice, setNotice] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Memory editor state
  const [isMemoryFormOpen, setIsMemoryFormOpen] = useState(false);
  const [memoryForm, setMemoryForm] = useState<MemoryFormState>(() => ({
    id: null,
    memoryDate: getTodayVietnamIso(),
    title: '',
    story: '',
    imageUrl: '',
    imageAlt: '',
  }));
  const [pendingMemoryFile, setPendingMemoryFile] = useState<File | null>(null);
  const [memoryPreviewUrl, setMemoryPreviewUrl] = useState<string | null>(null);
  const [savingMemory, setSavingMemory] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deletingMemoryId, setDeletingMemoryId] = useState<string | null>(null);
  const [reordering, setReordering] = useState(false);

  // Audio upload state in Settings tab
  const [pendingAudioFile, setPendingAudioFile] = useState<File | null>(null);
  const [audioPreviewUrl, setAudioPreviewUrl] = useState<string | null>(null);
  const [savingSettings, setSavingSettings] = useState(false);

  // Tab 4: Users state
  const [createUserForm, setCreateUserForm] = useState<CreateUserFormState>(createInitialUserForm);
  const [creatingUser, setCreatingUser] = useState(false);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [editUserForm, setEditUserForm] = useState<EditUserFormState>({
    displayName: '',
    role: 'viewer',
    password: '',
    otpCode: '',
    otpHint: '',
  });
  const [busyUserId, setBusyUserId] = useState<string | null>(null);
  const [confirmDeleteUserId, setConfirmDeleteUserId] = useState<string | null>(null);

  // Tab 5: Activity filters state
  const [activityEventFilter, setActivityEventFilter] = useState<string>('');
  const [activityUsernameFilter, setActivityUsernameFilter] = useState<string>('');
  const [activitySearch, setActivitySearch] = useState<string>('');
  const [activityLimit, setActivityLimit] = useState<string>('100');
  const [loadingActivity, setLoadingActivity] = useState(false);

  useEffect(() => {
    return () => {
      if (memoryPreviewUrl) URL.revokeObjectURL(memoryPreviewUrl);
    };
  }, [memoryPreviewUrl]);

  useEffect(() => {
    return () => {
      if (audioPreviewUrl) URL.revokeObjectURL(audioPreviewUrl);
    };
  }, [audioPreviewUrl]);

  const liveDaysTogether = useMemo(
    () => calculateDaysTogether(settingsForm.loveStartDate),
    [settingsForm.loveStartDate]
  );

  const letterPreviewParagraphs = useMemo(
    () =>
      settingsForm.letterBody
        .split(/\n\s*\n/)
        .map((p) => p.trim())
        .filter(Boolean),
    [settingsForm.letterBody]
  );

  function showSuccess(text: string) {
    setNotice({ type: 'success', text });
  }

  function showError(text: string) {
    setNotice({ type: 'error', text });
  }

  function clearMemoryFilePreview() {
    if (memoryPreviewUrl) URL.revokeObjectURL(memoryPreviewUrl);
    setMemoryPreviewUrl(null);
    setPendingMemoryFile(null);
    if (memoryFileInputRef.current) {
      memoryFileInputRef.current.value = '';
    }
  }

  function clearAudioFilePreview() {
    if (audioPreviewUrl) URL.revokeObjectURL(audioPreviewUrl);
    setAudioPreviewUrl(null);
    setPendingAudioFile(null);
    if (audioFileInputRef.current) {
      audioFileInputRef.current.value = '';
    }
  }

  function openNewMemoryForm() {
    clearMemoryFilePreview();
    setMemoryForm({
      id: null,
      memoryDate: getTodayVietnamIso(),
      title: '',
      story: '',
      imageUrl: '',
      imageAlt: '',
    });
    setIsMemoryFormOpen(true);
    setNotice(null);
  }

  function openEditMemoryForm(item: MemoryItem) {
    clearMemoryFilePreview();
    setMemoryForm({
      id: item.id,
      memoryDate: item.memoryDate,
      title: item.title,
      story: item.story,
      imageUrl: item.imageUrl,
      imageAlt: item.imageAlt,
    });
    setIsMemoryFormOpen(true);
    setNotice(null);
    requestAnimationFrame(() => {
      const prefersReducedMotion =
        typeof window !== 'undefined' &&
        window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
      memoryFormRef.current?.scrollIntoView({
        behavior: prefersReducedMotion ? 'auto' : 'smooth',
        block: 'start',
      });
    });
  }

  async function handleLogout() {
    await fetch('/api/admin/logout', { method: 'POST' }).catch(() => undefined);
    router.push('/admin/login');
    router.refresh();
  }

  function handleUnauthorized() {
    router.push('/admin/login');
    router.refresh();
  }

  async function handleSaveMemory(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (savingMemory) return;

    if (!memoryForm.memoryDate) {
      showError('Vui lòng chọn ngày kỷ niệm.');
      return;
    }
    if (!memoryForm.story.trim()) {
      showError('Vui lòng viết đôi dòng câu chuyện cho kỷ niệm này.');
      return;
    }
    if (!pendingMemoryFile && !memoryForm.imageUrl.trim()) {
      showError('Vui lòng tải lên một bức ảnh hoặc nhập đường dẫn ảnh.');
      return;
    }

    setSavingMemory(true);
    setNotice(null);
    let newlyUploadedUrl: string | null = null;

    try {
      let finalImageUrl = memoryForm.imageUrl.trim();
      if (pendingMemoryFile) {
        newlyUploadedUrl = await uploadMediaFile(pendingMemoryFile, 'image');
        finalImageUrl = newlyUploadedUrl;
      }

      const endpoint = memoryForm.id
        ? `/api/admin/memories/${memoryForm.id}`
        : '/api/admin/memories';
      const method = memoryForm.id ? 'PUT' : 'POST';

      const res = await fetch(endpoint, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          memoryDate: memoryForm.memoryDate,
          title: memoryForm.title,
          story: memoryForm.story,
          imageUrl: finalImageUrl,
          imageAlt: memoryForm.imageAlt,
        }),
      });

      if (res.status === 401) {
        if (newlyUploadedUrl) await cleanupUploadedUrl(newlyUploadedUrl);
        handleUnauthorized();
        return;
      }

      const payload = (await res.json().catch(() => ({}))) as {
        memory?: MemoryItem;
        error?: string;
      };

      if (!res.ok || !payload.memory) {
        if (newlyUploadedUrl) await cleanupUploadedUrl(newlyUploadedUrl);
        showError(payload.error || 'Không thể lưu kỷ niệm.');
        return;
      }

      const savedMemory = payload.memory;
      setMemories((prev) => {
        if (memoryForm.id) {
          return prev.map((m) => (m.id === savedMemory.id ? savedMemory : m));
        }
        return [...prev, savedMemory];
      });

      clearMemoryFilePreview();
      setIsMemoryFormOpen(false);
      showSuccess(memoryForm.id ? 'Đã cập nhật kỷ niệm.' : 'Đã thêm kỷ niệm mới.');
    } catch (err) {
      if (newlyUploadedUrl) await cleanupUploadedUrl(newlyUploadedUrl);
      if (err instanceof UploadAuthError) {
        handleUnauthorized();
        return;
      }
      const message = err instanceof Error ? err.message : 'Có lỗi xảy ra khi lưu kỷ niệm.';
      showError(message);
    } finally {
      setSavingMemory(false);
    }
  }

  async function handleReorderIds(orderedIds: string[], successMessage: string) {
    if (reordering) return;
    setReordering(true);
    setNotice(null);

    try {
      const res = await fetch('/api/admin/memories/reorder', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: orderedIds }),
      });

      if (res.status === 401) {
        handleUnauthorized();
        return;
      }

      const payload = (await res.json().catch(() => ({}))) as {
        memories?: MemoryItem[];
        error?: string;
      };

      if (!res.ok || !payload.memories) {
        showError(payload.error || 'Không thể cập nhật thứ tự kỷ niệm.');
        return;
      }

      setMemories(payload.memories);
      showSuccess(successMessage);
    } catch {
      showError('Không thể kết nối máy chủ khi sắp xếp kỷ niệm.');
    } finally {
      setReordering(false);
    }
  }

  async function handleMoveMemory(index: number, direction: -1 | 1) {
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= memories.length) return;
    const next = [...memories];
    const [moved] = next.splice(index, 1);
    next.splice(targetIndex, 0, moved);
    await handleReorderIds(
      next.map((m) => m.id),
      'Đã cập nhật thứ tự dòng thời gian.'
    );
  }

  async function handleSortByDate() {
    if (memories.length < 2) return;
    const sorted = [...memories].sort((a, b) => a.memoryDate.localeCompare(b.memoryDate));
    await handleReorderIds(
      sorted.map((m) => m.id),
      'Đã sắp xếp các kỷ niệm theo ngày tăng dần.'
    );
  }

  async function handleDeleteMemory(id: string) {
    if (deletingMemoryId) return;
    setDeletingMemoryId(id);
    setNotice(null);
    try {
      const res = await fetch(`/api/admin/memories/${id}`, { method: 'DELETE' });
      if (res.status === 401) {
        handleUnauthorized();
        return;
      }
      const payload = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        showError(payload.error || 'Không thể xoá kỷ niệm.');
        return;
      }
      setMemories((prev) => prev.filter((m) => m.id !== id));
      if (memoryForm.id === id) {
        clearMemoryFilePreview();
        setIsMemoryFormOpen(false);
      }
      setConfirmDeleteId(null);
      showSuccess('Đã xoá kỷ niệm khỏi dòng thời gian.');
    } catch {
      showError('Không thể kết nối máy chủ khi xoá kỷ niệm.');
    } finally {
      setDeletingMemoryId(null);
    }
  }

  async function handleSaveSettings(event: FormEvent<HTMLFormElement>, successText: string) {
    event.preventDefault();
    if (savingSettings) return;

    if (!settingsForm.coupleTitle.trim()) {
      showError('Vui lòng nhập tên hai bạn.');
      return;
    }
    if (!settingsForm.loveStartDate) {
      showError('Vui lòng chọn ngày bắt đầu yêu.');
      return;
    }
    if (!settingsForm.letterTitle.trim() || !settingsForm.letterBody.trim()) {
      showError('Tiêu đề và nội dung bức tâm thư không được để trống.');
      return;
    }

    setSavingSettings(true);
    setNotice(null);
    let newlyUploadedAudioUrl: string | null = null;

    try {
      let finalMusicUrl = settingsForm.musicUrl.trim();
      if (pendingAudioFile) {
        newlyUploadedAudioUrl = await uploadMediaFile(pendingAudioFile, 'audio');
        finalMusicUrl = newlyUploadedAudioUrl;
      }

      const res = await fetch('/api/admin/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          coupleTitle: settingsForm.coupleTitle,
          heroSubtitle: settingsForm.heroSubtitle,
          loveStartDate: settingsForm.loveStartDate,
          musicUrl: finalMusicUrl,
          musicEnabled: settingsForm.musicEnabled,
          letterTitle: settingsForm.letterTitle,
          letterBody: settingsForm.letterBody,
          letterSignature: settingsForm.letterSignature,
          viewerPasscodeEnabled: settingsForm.viewerPasscodeEnabled,
        }),
      });

      if (res.status === 401) {
        if (newlyUploadedAudioUrl) await cleanupUploadedUrl(newlyUploadedAudioUrl);
        handleUnauthorized();
        return;
      }

      const payload = (await res.json().catch(() => ({}))) as {
        settings?: AdminSiteSettings;
        error?: string;
      };

      if (!res.ok || !payload.settings) {
        if (newlyUploadedAudioUrl) await cleanupUploadedUrl(newlyUploadedAudioUrl);
        showError(payload.error || 'Không thể lưu cài đặt.');
        return;
      }

      setSettingsForm(toSettingsForm(payload.settings));
      clearAudioFilePreview();
      showSuccess(successText);
    } catch (err) {
      if (newlyUploadedAudioUrl) await cleanupUploadedUrl(newlyUploadedAudioUrl);
      if (err instanceof UploadAuthError) {
        handleUnauthorized();
        return;
      }
      const message = err instanceof Error ? err.message : 'Có lỗi xảy ra khi lưu cài đặt.';
      showError(message);
    } finally {
      setSavingSettings(false);
    }
  }

  function syncUsers(nextUsers: SafeAppUser[]) {
    setUsers(nextUsers);
    const activeCount = nextUsers.filter((u) => u.isActive).length;
    setTrafficSummary((prev) => ({ ...prev, activeUsersCount: activeCount }));
  }

  async function handleCreateUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (creatingUser) return;

    const normalizedUsername = createUserForm.username.trim().toLowerCase();
    const trimmedDisplay = createUserForm.displayName.trim();
    const trimmedOtp = createUserForm.otpCode.trim();

    if (!/^[a-z0-9._-]{3,32}$/.test(normalizedUsername)) {
      showError('Tên đăng nhập gồm 3–32 ký tự chữ thường, số hoặc dấu . _ -.');
      return;
    }
    if (normalizedUsername === 'khach') {
      showError('Tên tài khoản "khach" được hệ thống dành riêng cho khách ghé trang.');
      return;
    }

    const fieldError = validateUserFormFields({
      displayName: createUserForm.displayName,
      password: createUserForm.password,
      otpCode: createUserForm.otpCode,
      otpHint: createUserForm.otpHint,
      requirePasswordAndOtp: true,
    });
    if (fieldError) {
      showError(fieldError);
      return;
    }

    setCreatingUser(true);
    setNotice(null);

    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: normalizedUsername,
          displayName: trimmedDisplay,
          role: createUserForm.role,
          password: createUserForm.password,
          otpCode: trimmedOtp,
          otpHint: createUserForm.otpHint.trim(),
          isActive: createUserForm.isActive,
        }),
      });

      if (res.status === 401) {
        handleUnauthorized();
        return;
      }

      const payload = (await res.json().catch(() => ({}))) as {
        user?: SafeAppUser;
        error?: string;
      };

      if (!res.ok || !payload.user) {
        showError(payload.error || 'Không thể tạo tài khoản mới.');
        return;
      }

      syncUsers([...users, payload.user]);
      setCreateUserForm(createInitialUserForm());
      showSuccess(`Đã tạo tài khoản @${payload.user.username}.`);
    } catch {
      showError('Không thể kết nối máy chủ khi tạo tài khoản.');
    } finally {
      setCreatingUser(false);
    }
  }

  function openEditUserForm(targetUser: SafeAppUser) {
    setConfirmDeleteUserId(null);
    setEditingUserId(targetUser.id);
    setEditUserForm({
      displayName: targetUser.displayName,
      role: targetUser.role,
      password: '',
      otpCode: '',
      otpHint: targetUser.otpHint,
    });
    setNotice(null);
  }

  async function patchUserRecord(
    targetUser: SafeAppUser,
    patchBody: Record<string, unknown>,
    options: {
      fallbackError: string;
      networkError: string;
      onSuccess: (updated: SafeAppUser) => void;
    }
  ) {
    if (busyUserId) return;
    setBusyUserId(targetUser.id);
    setNotice(null);

    try {
      const res = await fetch(`/api/admin/users/${targetUser.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patchBody),
      });

      if (res.status === 401) {
        handleUnauthorized();
        return;
      }

      const payload = (await res.json().catch(() => ({}))) as {
        user?: SafeAppUser;
        error?: string;
      };

      if (!res.ok || !payload.user) {
        showError(payload.error || options.fallbackError);
        return;
      }

      syncUsers(users.map((u) => (u.id === targetUser.id ? payload.user! : u)));
      options.onSuccess(payload.user);
    } catch {
      showError(options.networkError);
    } finally {
      setBusyUserId(null);
    }
  }

  async function handleSaveEditUser(event: FormEvent<HTMLFormElement>, targetUser: SafeAppUser) {
    event.preventDefault();
    if (busyUserId) return;

    const trimmedDisplay = editUserForm.displayName.trim();
    const trimmedOtp = editUserForm.otpCode.trim();
    const fieldError = validateUserFormFields({
      displayName: editUserForm.displayName,
      password: editUserForm.password,
      otpCode: editUserForm.otpCode,
      otpHint: editUserForm.otpHint,
      requirePasswordAndOtp: false,
    });
    if (fieldError) {
      showError(fieldError);
      return;
    }

    const patchBody: Record<string, unknown> = {
      displayName: trimmedDisplay,
      otpHint: editUserForm.otpHint.trim(),
    };
    if (targetUser.id !== currentUser?.id && editUserForm.role !== targetUser.role) {
      patchBody.role = editUserForm.role;
    }
    if (editUserForm.password.length > 0) {
      patchBody.password = editUserForm.password;
    }
    if (trimmedOtp.length > 0) {
      patchBody.otpCode = trimmedOtp;
    }

    await patchUserRecord(targetUser, patchBody, {
      fallbackError: 'Không thể cập nhật tài khoản.',
      networkError: 'Không thể kết nối máy chủ khi cập nhật tài khoản.',
      onSuccess: (updated) => {
        setEditingUserId(null);
        showSuccess(`Đã cập nhật tài khoản @${updated.username}.`);
      },
    });
  }

  async function handleToggleUserActive(targetUser: SafeAppUser) {
    await patchUserRecord(
      targetUser,
      { isActive: !targetUser.isActive },
      {
        fallbackError: 'Không thể thay đổi trạng thái tài khoản.',
        networkError: 'Không thể kết nối máy chủ khi đổi trạng thái tài khoản.',
        onSuccess: (updated) => {
          showSuccess(
            updated.isActive
              ? `Đã mở khoá tài khoản @${updated.username}.`
              : `Đã tạm khoá tài khoản @${updated.username}.`
          );
        },
      }
    );
  }

  async function handleRevokeUserSession(targetUser: SafeAppUser) {
    await patchUserRecord(
      targetUser,
      { revokeSession: true },
      {
        fallbackError: 'Không thể thu hồi phiên đăng nhập.',
        networkError: 'Không thể kết nối máy chủ khi thu hồi phiên.',
        onSuccess: (updated) => {
          showSuccess(`Đã thu hồi toàn bộ phiên của @${updated.username}.`);
        },
      }
    );
  }

  async function handleDeleteUser(targetUser: SafeAppUser) {
    if (busyUserId) return;
    setBusyUserId(targetUser.id);
    setNotice(null);

    try {
      const res = await fetch(`/api/admin/users/${targetUser.id}`, {
        method: 'DELETE',
      });

      if (res.status === 401) {
        handleUnauthorized();
        return;
      }

      const payload = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        showError(payload.error || 'Không thể xoá tài khoản.');
        return;
      }

      syncUsers(users.filter((u) => u.id !== targetUser.id));
      setConfirmDeleteUserId(null);
      if (editingUserId === targetUser.id) {
        setEditingUserId(null);
      }
      if (targetUser.username === activityUsernameFilter) {
        setActivityUsernameFilter('');
      }
      showSuccess(`Đã xoá tài khoản @${targetUser.username}.`);
    } catch {
      showError('Không thể kết nối máy chủ khi xoá tài khoản.');
    } finally {
      setBusyUserId(null);
    }
  }

  async function fetchActivityLogs(overrides?: {
    eventType?: string;
    username?: string;
    search?: string;
    limit?: string;
  }) {
    const requestSeq = ++activityRequestSeqRef.current;
    setLoadingActivity(true);
    setNotice(null);

    const eventType = overrides?.eventType ?? activityEventFilter;
    const username = overrides?.username ?? activityUsernameFilter;
    const search = overrides?.search ?? activitySearch;
    const limit = overrides?.limit ?? activityLimit;

    const params = new URLSearchParams();
    if (eventType) params.set('eventType', eventType);
    if (username) params.set('username', username);
    if (search.trim()) params.set('search', search.trim());
    if (limit) params.set('limit', limit);

    try {
      const res = await fetch(`/api/admin/activity?${params.toString()}`, {
        method: 'GET',
        cache: 'no-store',
      });

      if (res.status === 401) {
        handleUnauthorized();
        return;
      }

      const payload = (await res.json().catch(() => ({}))) as {
        logs?: ActivityLogItem[];
        trafficSummary?: TrafficSummary;
        error?: string;
      };

      if (requestSeq !== activityRequestSeqRef.current) return;

      if (!res.ok || !Array.isArray(payload.logs)) {
        showError(payload.error || 'Không thể tải nhật ký hoạt động.');
        return;
      }

      setActivityLogs(payload.logs);
      if (payload.trafficSummary) {
        setTrafficSummary(payload.trafficSummary);
      }
    } catch {
      if (requestSeq === activityRequestSeqRef.current) {
        showError('Không thể kết nối máy chủ khi tải nhật ký.');
      }
    } finally {
      if (requestSeq === activityRequestSeqRef.current) {
        setLoadingActivity(false);
      }
    }
  }

  const activeAdminsCount = useMemo(
    () => users.filter((u) => u.role === 'admin' && u.isActive).length,
    [users]
  );

  const activeImagePreview = memoryPreviewUrl || memoryForm.imageUrl.trim();
  const activeAudioPreview = audioPreviewUrl || settingsForm.musicUrl.trim();

  return (
    <div className="min-h-screen overflow-x-hidden px-4 pb-24 pt-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl space-y-6">
        {/* Top bar */}
        <header className="glass-card flex flex-col gap-4 rounded-3xl p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0 space-y-1.5">
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-pink-50 text-pink-500">
                <Heart className="h-4 w-4 fill-pink-500/20" />
              </span>
              <h1 className="font-serif text-2xl font-semibold text-slate-900">
                Quản trị kỷ niệm
              </h1>
              {currentUser ? (
                <span className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-pink-200 bg-pink-50/90 px-3 py-1 text-xs font-medium text-pink-700">
                  <ShieldCheck className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">{currentUser.displayName || currentUser.username}</span>
                </span>
              ) : null}
              {storageStatus.mode === 'supabase' ? (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50/90 px-3 py-1 text-xs font-medium text-emerald-700">
                  <Cloud className="h-3.5 w-3.5 shrink-0" />
                  Đã kết nối Supabase Cloud
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-sky-200 bg-sky-50/90 px-3 py-1 text-xs font-medium text-sky-700">
                  <HardDrive className="h-3.5 w-3.5 shrink-0" />
                  Chế độ lưu cục bộ trên máy
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500">
              Mọi thay đổi được đồng bộ ngay lên trang chính của hai bạn.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <Link
              href="/"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-[36px] items-center gap-1.5 rounded-2xl border border-slate-200 bg-white/90 px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-pink-200 hover:text-pink-600"
            >
              Xem trang chính
              <ExternalLink className="h-3.5 w-3.5" />
            </Link>
            <button
              type="button"
              onClick={handleLogout}
              className="inline-flex min-h-[36px] items-center gap-1.5 rounded-2xl border border-slate-200 bg-white/80 px-4 py-2 text-sm font-medium text-slate-600 transition hover:border-rose-200 hover:bg-rose-50/70 hover:text-rose-600"
            >
              <LogOut className="h-4 w-4" />
              Đăng xuất
            </button>
          </div>
        </header>

        {/* Serverless read-only warning */}
        {storageStatus.readOnlyServerlessWarning ? (
          <div
            role="alert"
            className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50/95 p-4 text-sm text-amber-900"
          >
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
            <div className="space-y-1">
              <p className="font-semibold">
                Cảnh báo môi trường serverless chưa kết nối Supabase Cloud
              </p>
              <p className="text-xs leading-relaxed text-amber-800">
                Hệ thống file trên Vercel là chỉ đọc. Vui lòng thiết lập{' '}
                <code>NEXT_PUBLIC_SUPABASE_URL</code> và <code>SUPABASE_SERVICE_ROLE_KEY</code>{' '}
                (sau khi chạy <code>supabase/schema.sql</code>) để tải ảnh và lưu dữ liệu trực tuyến.
              </p>
            </div>
          </div>
        ) : null}

        {storageStatus.usingDefaultAdminPassword || storageStatus.usingDefaultSessionSecret ? (
          <div className="flex items-center gap-2.5 rounded-2xl border border-indigo-200/80 bg-indigo-50/80 px-4 py-3 text-xs text-indigo-800">
            <Lock className="h-4 w-4 shrink-0 text-indigo-600" />
            <span>
              Chế độ phát triển đang dùng cấu hình bảo mật mặc định. Hãy đặt{' '}
              <code>ADMIN_PASSWORD</code> và <code>ADMIN_SESSION_SECRET</code> trong biến môi
              trường trước khi triển khai công khai.
            </span>
          </div>
        ) : null}

        {/* Status Toast / Banner */}
        {notice ? (
          <div
            role={notice.type === 'error' ? 'alert' : 'status'}
            className={`fixed inset-x-4 bottom-4 z-50 flex items-center justify-between gap-3 rounded-2xl border px-4 py-3 text-sm shadow-lg backdrop-blur-md sm:inset-x-auto sm:bottom-6 sm:right-6 sm:w-full sm:max-w-md ${
              notice.type === 'success'
                ? 'border-emerald-200 bg-emerald-50/95 text-emerald-800'
                : 'border-rose-200 bg-rose-50/95 text-rose-800'
            }`}
          >
            <div className="flex min-w-0 flex-1 items-center gap-2 [overflow-wrap:anywhere]">
              {notice.type === 'success' ? (
                <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
              ) : (
                <AlertTriangle className="h-4 w-4 shrink-0 text-rose-600" />
              )}
              <span className="min-w-0 [overflow-wrap:anywhere]">{notice.text}</span>
            </div>
            <button
              type="button"
              onClick={() => setNotice(null)}
              className="inline-flex min-h-[36px] shrink-0 items-center rounded-xl px-3 py-1.5 text-xs font-medium opacity-75 transition hover:bg-black/5 hover:opacity-100"
            >
              Đóng
            </button>
          </div>
        ) : null}

        {/* Navigation Tabs */}
        <nav
          aria-label="Mục quản trị"
          className="glass-card flex flex-wrap gap-1.5 rounded-2xl p-2 sm:gap-2"
        >
          <button
            type="button"
            onClick={() => {
              setActiveTab('memories');
              setNotice(null);
            }}
            className={`inline-flex min-h-[40px] min-w-0 items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-xs font-medium transition sm:min-h-[42px] sm:px-4 sm:py-2.5 sm:text-sm ${
              activeTab === 'memories'
                ? 'bg-gradient-to-r from-pink-500 to-rose-500 text-white shadow-sm'
                : 'text-slate-600 hover:bg-white/80 hover:text-slate-900'
            }`}
          >
            <ImagePlus className="h-4 w-4 shrink-0" />
            <span>Kỷ niệm &amp; Ảnh ({memories.length})</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab('settings');
              setNotice(null);
            }}
            className={`inline-flex min-h-[40px] min-w-0 items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-xs font-medium transition sm:min-h-[42px] sm:px-4 sm:py-2.5 sm:text-sm ${
              activeTab === 'settings'
                ? 'bg-gradient-to-r from-pink-500 to-rose-500 text-white shadow-sm'
                : 'text-slate-600 hover:bg-white/80 hover:text-slate-900'
            }`}
          >
            <SlidersHorizontal className="h-4 w-4 shrink-0" />
            <span>Mở đầu, Nhạc nền &amp; Riêng tư</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab('letter');
              setNotice(null);
            }}
            className={`inline-flex min-h-[40px] min-w-0 items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-xs font-medium transition sm:min-h-[42px] sm:px-4 sm:py-2.5 sm:text-sm ${
              activeTab === 'letter'
                ? 'bg-gradient-to-r from-pink-500 to-rose-500 text-white shadow-sm'
                : 'text-slate-600 hover:bg-white/80 hover:text-slate-900'
            }`}
          >
            <Mail className="h-4 w-4 shrink-0" />
            <span>Phong thư tâm sự</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab('users');
              setNotice(null);
            }}
            className={`inline-flex min-h-[40px] min-w-0 items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-xs font-medium transition sm:min-h-[42px] sm:px-4 sm:py-2.5 sm:text-sm ${
              activeTab === 'users'
                ? 'bg-gradient-to-r from-pink-500 to-rose-500 text-white shadow-sm'
                : 'text-slate-600 hover:bg-white/80 hover:text-slate-900'
            }`}
          >
            <Users className="h-4 w-4 shrink-0" />
            <span>Tài khoản &amp; Kiểm soát truy cập ({users.length})</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab('activity');
              setNotice(null);
            }}
            className={`inline-flex min-h-[40px] min-w-0 items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-xs font-medium transition sm:min-h-[42px] sm:px-4 sm:py-2.5 sm:text-sm ${
              activeTab === 'activity'
                ? 'bg-gradient-to-r from-pink-500 to-rose-500 text-white shadow-sm'
                : 'text-slate-600 hover:bg-white/80 hover:text-slate-900'
            }`}
          >
            <Activity className="h-4 w-4 shrink-0" />
            <span>Nhật ký ra vào &amp; Hành động</span>
          </button>
        </nav>

        {/* Tab 1: Memories */}
        {activeTab === 'memories' ? (
          <section className="space-y-6">
            <div className="glass-card flex flex-wrap items-center justify-between gap-3 rounded-3xl p-5">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Dòng thời gian kỷ niệm</h2>
                <p className="text-xs text-slate-500">
                  Thêm ảnh kỷ niệm thật của hai bạn và sắp xếp thứ tự xuất hiện.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2.5">
                {memories.length > 1 ? (
                  <button
                    type="button"
                    disabled={reordering}
                    onClick={handleSortByDate}
                    className="inline-flex min-h-[36px] items-center gap-1.5 rounded-2xl border border-slate-200 bg-white/90 px-3.5 py-2 text-xs font-medium text-slate-700 transition hover:border-indigo-200 hover:text-indigo-600 disabled:opacity-50"
                  >
                    <CalendarHeart className="h-3.5 w-3.5" />
                    Sắp xếp theo ngày tăng dần
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={openNewMemoryForm}
                  className="inline-flex min-h-[36px] items-center gap-1.5 rounded-2xl bg-gradient-to-r from-pink-500 to-rose-500 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:brightness-105"
                >
                  <Plus className="h-4 w-4" />
                  Thêm kỷ niệm mới
                </button>
              </div>
            </div>

            {isMemoryFormOpen ? (
              <div ref={memoryFormRef} className="glass-card rounded-3xl p-4 shadow-glass sm:p-6">
                <div className="mb-5 flex items-center justify-between">
                  <h3 className="font-serif text-2xl font-semibold text-slate-900">
                    {memoryForm.id ? 'Chỉnh sửa kỷ niệm' : 'Thêm kỷ niệm mới'}
                  </h3>
                  <button
                    type="button"
                    onClick={() => {
                      clearMemoryFilePreview();
                      setIsMemoryFormOpen(false);
                    }}
                    className="inline-flex min-h-[36px] items-center rounded-xl px-3 py-1.5 text-sm font-medium text-slate-500 transition hover:bg-slate-100 hover:text-slate-800"
                  >
                    Huỷ
                  </button>
                </div>

                <form onSubmit={handleSaveMemory} className="grid gap-6 md:grid-cols-[1.15fr_0.85fr]">
                  <div className="min-w-0 space-y-4">
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div>
                        <label
                          htmlFor="memory-date"
                          className="mb-1.5 block text-sm font-medium text-slate-700"
                        >
                          Ngày kỷ niệm
                        </label>
                        <input
                          id="memory-date"
                          type="date"
                          required
                          value={memoryForm.memoryDate}
                          onChange={(e) =>
                            setMemoryForm((prev) => ({ ...prev, memoryDate: e.target.value }))
                          }
                          className="w-full rounded-2xl border border-slate-200 bg-white/90 px-3.5 py-2.5 text-base text-slate-900 outline-none focus:border-pink-400 focus:ring-2 focus:ring-pink-200 sm:text-sm"
                        />
                      </div>

                      <div>
                        <label
                          htmlFor="memory-title"
                          className="mb-1.5 block text-sm font-medium text-slate-700"
                        >
                          Tiêu đề ngắn
                        </label>
                        <input
                          id="memory-title"
                          type="text"
                          value={memoryForm.title}
                          onChange={(e) =>
                            setMemoryForm((prev) => ({ ...prev, title: e.target.value }))
                          }
                          placeholder="VD: Buổi chiều Đà Lạt sương mù"
                          className="w-full rounded-2xl border border-slate-200 bg-white/90 px-3.5 py-2.5 text-base text-slate-900 outline-none focus:border-pink-400 focus:ring-2 focus:ring-pink-200 sm:text-sm"
                        />
                      </div>
                    </div>

                    <div>
                      <label
                        htmlFor="memory-story"
                        className="mb-1.5 block text-sm font-medium text-slate-700"
                      >
                        Câu chuyện / lời nhắn cho bức ảnh
                      </label>
                      <textarea
                        id="memory-story"
                        rows={4}
                        required
                        value={memoryForm.story}
                        onChange={(e) =>
                          setMemoryForm((prev) => ({ ...prev, story: e.target.value }))
                        }
                        placeholder="Kể lại khoảnh khắc hôm đó, điều khiến bạn nhớ nhất..."
                        className="w-full rounded-2xl border border-slate-200 bg-white/90 px-3.5 py-2.5 text-base leading-relaxed text-slate-900 outline-none focus:border-pink-400 focus:ring-2 focus:ring-pink-200 sm:text-sm"
                      />
                    </div>

                    <div>
                      <label
                        htmlFor="memory-image-url"
                        className="mb-1.5 block text-sm font-medium text-slate-700"
                      >
                        Đường dẫn ảnh (hoặc chọn tệp bên phải)
                      </label>
                      <input
                        id="memory-image-url"
                        type="text"
                        value={memoryForm.imageUrl}
                        onChange={(e) => {
                          clearMemoryFilePreview();
                          setMemoryForm((prev) => ({ ...prev, imageUrl: e.target.value }));
                        }}
                        placeholder="/samples/memory-1.svg hoặc https://..."
                        className="w-full rounded-2xl border border-slate-200 bg-white/90 px-3.5 py-2.5 text-base text-slate-900 outline-none focus:border-pink-400 focus:ring-2 focus:ring-pink-200 sm:text-sm"
                      />
                    </div>

                    <div>
                      <label
                        htmlFor="memory-alt"
                        className="mb-1.5 block text-sm font-medium text-slate-700"
                      >
                        Mô tả ảnh (tuỳ chọn)
                      </label>
                      <input
                        id="memory-alt"
                        type="text"
                        value={memoryForm.imageAlt}
                        onChange={(e) =>
                          setMemoryForm((prev) => ({ ...prev, imageAlt: e.target.value }))
                        }
                        placeholder="Mặc định dùng tiêu đề kỷ niệm"
                        className="w-full rounded-2xl border border-slate-200 bg-white/90 px-3.5 py-2.5 text-base text-slate-900 outline-none focus:border-pink-400 focus:ring-2 focus:ring-pink-200 sm:text-sm"
                      />
                    </div>
                  </div>

                  <div className="flex min-w-0 flex-col justify-between gap-4 rounded-2xl border border-dashed border-pink-200 bg-white/60 p-4">
                    <div className="min-w-0 space-y-3">
                      <label
                        htmlFor="memory-file-upload"
                        className="flex min-w-0 max-w-full cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl bg-pink-50/70 px-4 py-5 text-center transition hover:bg-pink-50"
                      >
                        <Upload className="h-6 w-6 text-pink-500" />
                        <span className="max-w-full break-all text-sm font-semibold text-pink-700">
                          {pendingMemoryFile ? pendingMemoryFile.name : 'Chọn ảnh từ thiết bị'}
                        </span>
                        <span className="text-xs text-slate-500">
                          JPG, PNG, WebP, GIF, AVIF • Tối đa 10MB
                        </span>
                        <input
                          ref={memoryFileInputRef}
                          id="memory-file-upload"
                          type="file"
                          accept="image/jpeg,image/png,image/webp,image/gif,image/avif"
                          className="sr-only"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (!file) return;
                            if (memoryPreviewUrl) URL.revokeObjectURL(memoryPreviewUrl);
                            setPendingMemoryFile(file);
                            setMemoryPreviewUrl(URL.createObjectURL(file));
                          }}
                        />
                      </label>

                      {activeImagePreview ? (
                        <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-2">
                          <img
                            src={activeImagePreview}
                            alt={memoryForm.imageAlt || memoryForm.title || 'Xem trước ảnh'}
                            className="mx-auto max-h-56 w-auto rounded-xl object-contain"
                          />
                        </div>
                      ) : (
                        <p className="py-6 text-center text-xs text-slate-400">
                          Chưa có ảnh xem trước
                        </p>
                      )}
                    </div>

                    <button
                      type="submit"
                      disabled={savingMemory}
                      className="min-h-[36px] w-full rounded-2xl bg-gradient-to-r from-pink-500 to-rose-500 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {savingMemory
                        ? 'Đang tải lên & lưu...'
                        : memoryForm.id
                          ? 'Lưu thay đổi'
                          : 'Thêm vào dòng thời gian'}
                    </button>
                  </div>
                </form>
              </div>
            ) : null}

            {memories.length === 0 ? (
              <div className="glass-card rounded-3xl p-10 text-center text-sm text-slate-500">
                Chưa có kỷ niệm nào. Nhấn &ldquo;Thêm kỷ niệm mới&rdquo; để bắt đầu câu chuyện của hai bạn.
              </div>
            ) : (
              <div className="space-y-4">
                {memories.map((item, index) => (
                  <article
                    key={item.id}
                    className="glass-card flex flex-col gap-4 rounded-3xl p-4 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="flex min-w-0 items-start gap-4">
                      <img
                        src={item.imageUrl}
                        alt={item.imageAlt}
                        className="h-24 w-24 shrink-0 rounded-2xl border border-white bg-slate-50 object-cover shadow-sm"
                      />
                      <div className="min-w-0 space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded-full bg-pink-50 px-2.5 py-0.5 text-xs font-semibold text-pink-600">
                            {formatMemoryDateVi(item.memoryDate)}
                          </span>
                          <span className="text-xs text-slate-400">#{index + 1}</span>
                        </div>
                        <h3 className="truncate font-serif text-xl font-semibold text-slate-900">
                          {item.title || 'Khoảnh khắc bình yên'}
                        </h3>
                        <p className="line-clamp-2 break-words [overflow-wrap:anywhere] text-sm text-slate-600">
                          {item.story}
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 sm:shrink-0">
                      <button
                        type="button"
                        aria-label="Di chuyển lên"
                        disabled={index === 0 || reordering}
                        onClick={() => handleMoveMemory(index, -1)}
                        className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white/90 text-slate-600 transition hover:border-indigo-200 hover:text-indigo-600 disabled:opacity-35"
                      >
                        <ArrowUp className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        aria-label="Di chuyển xuống"
                        disabled={index === memories.length - 1 || reordering}
                        onClick={() => handleMoveMemory(index, 1)}
                        className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white/90 text-slate-600 transition hover:border-indigo-200 hover:text-indigo-600 disabled:opacity-35"
                      >
                        <ArrowDown className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => openEditMemoryForm(item)}
                        className="inline-flex min-h-[36px] items-center gap-1 rounded-xl border border-slate-200 bg-white/90 px-3 py-2 text-xs font-medium text-slate-700 transition hover:border-pink-200 hover:text-pink-600"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                        Sửa
                      </button>

                      {confirmDeleteId === item.id ? (
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            disabled={deletingMemoryId === item.id}
                            onClick={() => handleDeleteMemory(item.id)}
                            className="inline-flex min-h-[36px] items-center rounded-xl bg-rose-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {deletingMemoryId === item.id ? 'Đang xoá...' : 'Xác nhận xoá'}
                          </button>
                          <button
                            type="button"
                            disabled={deletingMemoryId === item.id}
                            onClick={() => setConfirmDeleteId(null)}
                            className="inline-flex min-h-[36px] items-center rounded-xl border border-slate-200 bg-white px-2.5 py-2 text-xs text-slate-600 disabled:opacity-60"
                          >
                            Huỷ
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteId(item.id)}
                          className="inline-flex min-h-[36px] items-center gap-1 rounded-xl border border-slate-200 bg-white/90 px-3 py-2 text-xs font-medium text-rose-600 transition hover:border-rose-200 hover:bg-rose-50"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          Xoá
                        </button>
                      )}
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        ) : null}

        {/* Tab 2: Opening, Music & Privacy */}
        {activeTab === 'settings' ? (
          <form
            onSubmit={(e) => handleSaveSettings(e, 'Đã lưu cài đặt mở đầu, nhạc nền & riêng tư.')}
            className="glass-card space-y-6 rounded-3xl p-4 shadow-glass sm:p-6"
          >
            <div>
              <h2 className="text-lg font-semibold text-slate-900">
                Thông tin mở đầu, Nhạc nền &amp; Quyền riêng tư
              </h2>
              <p className="text-xs text-slate-500">
                Tuỳ chỉnh lời chào đầu trang, số ngày bên nhau, bản nhạc nền và chế độ bảo vệ đăng
                nhập 2 bước nếu cần.
              </p>
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              <div>
                <label
                  htmlFor="couple-title"
                  className="mb-1.5 block text-sm font-medium text-slate-700"
                >
                  Tên hai bạn
                </label>
                <input
                  id="couple-title"
                  type="text"
                  required
                  value={settingsForm.coupleTitle}
                  onChange={(e) =>
                    setSettingsForm((prev) => ({ ...prev, coupleTitle: e.target.value }))
                  }
                  placeholder="VD: Minh & Linh"
                  className="w-full rounded-2xl border border-slate-200 bg-white/90 px-3.5 py-2.5 text-base text-slate-900 outline-none focus:border-pink-400 focus:ring-2 focus:ring-pink-200 sm:text-sm"
                />
              </div>

              <div>
                <label
                  htmlFor="love-start-date"
                  className="mb-1.5 block text-sm font-medium text-slate-700"
                >
                  Ngày bắt đầu yêu
                </label>
                <input
                  id="love-start-date"
                  type="date"
                  required
                  value={settingsForm.loveStartDate}
                  onChange={(e) =>
                    setSettingsForm((prev) => ({ ...prev, loveStartDate: e.target.value }))
                  }
                  className="w-full rounded-2xl border border-slate-200 bg-white/90 px-3.5 py-2.5 text-base text-slate-900 outline-none focus:border-pink-400 focus:ring-2 focus:ring-pink-200 sm:text-sm"
                />
                <p className="mt-1.5 text-xs text-pink-600">
                  Tính theo múi giờ Việt Nam (UTC+7): hiện tại là{' '}
                  <strong>{liveDaysTogether} ngày</strong> bên nhau.
                </p>
              </div>
            </div>

            <div>
              <label
                htmlFor="hero-subtitle"
                className="mb-1.5 block text-sm font-medium text-slate-700"
              >
                Lời dẫn mở đầu
              </label>
              <textarea
                id="hero-subtitle"
                rows={2}
                value={settingsForm.heroSubtitle}
                onChange={(e) =>
                  setSettingsForm((prev) => ({ ...prev, heroSubtitle: e.target.value }))
                }
                placeholder="Gửi em/anh — người luôn ở đây cùng tụi mình qua từng mùa thương nhớ."
                className="w-full rounded-2xl border border-slate-200 bg-white/90 px-3.5 py-2.5 text-base text-slate-900 outline-none focus:border-pink-400 focus:ring-2 focus:ring-pink-200 sm:text-sm"
              />
            </div>

            {/* Ambient music block */}
            <div className="space-y-4 rounded-2xl border border-slate-200/80 bg-white/60 p-3 sm:p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Music className="h-4 w-4 text-pink-500" />
                  <span className="text-sm font-semibold text-slate-800">Nhạc nền nhẹ nhàng</span>
                </div>
                <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={settingsForm.musicEnabled}
                    onChange={(e) =>
                      setSettingsForm((prev) => ({ ...prev, musicEnabled: e.target.checked }))
                    }
                    className="h-4 w-4 rounded border-slate-300 text-pink-500 focus:ring-pink-400"
                  />
                  Hiển thị nút bật/tắt nhạc
                </label>
              </div>

              <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
                <input
                  type="text"
                  value={settingsForm.musicUrl}
                  onChange={(e) => {
                    clearAudioFilePreview();
                    setSettingsForm((prev) => ({ ...prev, musicUrl: e.target.value }));
                  }}
                  placeholder="/samples/gentle-memories.wav hoặc https://..."
                  className="min-w-0 w-full rounded-2xl border border-slate-200 bg-white/95 px-3.5 py-2.5 text-base text-slate-900 outline-none focus:border-pink-400 focus:ring-2 focus:ring-pink-200 sm:text-sm"
                />
                <div className="flex min-w-0 flex-wrap gap-2">
                  <label className="inline-flex min-h-[36px] min-w-0 max-w-full cursor-pointer items-center gap-1.5 rounded-2xl border border-pink-200 bg-pink-50 px-3.5 py-2.5 text-xs font-semibold text-pink-700 transition hover:bg-pink-100">
                    <Upload className="h-3.5 w-3.5 shrink-0" />
                    <span className="min-w-0 max-w-full break-all">
                      {pendingAudioFile ? pendingAudioFile.name : 'Tải file nhạc (MP3/M4A/WAV)'}
                    </span>
                    <input
                      ref={audioFileInputRef}
                      type="file"
                      accept="audio/mpeg,audio/mp3,audio/mp4,audio/m4a,audio/wav,.mp3,.m4a,.wav"
                      className="sr-only"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        if (audioPreviewUrl) URL.revokeObjectURL(audioPreviewUrl);
                        setPendingAudioFile(file);
                        setAudioPreviewUrl(URL.createObjectURL(file));
                      }}
                    />
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      clearAudioFilePreview();
                      setSettingsForm((prev) => ({
                        ...prev,
                        musicUrl: '/samples/gentle-memories.wav',
                      }));
                    }}
                    className="inline-flex min-h-[36px] items-center rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-xs font-medium text-slate-600 transition hover:text-slate-900"
                  >
                    Dùng nhạc mẫu
                  </button>
                </div>
              </div>

              {activeAudioPreview ? (
                <audio controls src={activeAudioPreview} className="w-full min-w-0 max-w-full" />
              ) : null}
            </div>

            {/* Viewer access gate toggle + Tab 4 link */}
            <div className="space-y-3 rounded-2xl border border-indigo-100/90 bg-white/70 p-3 sm:p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Lock className="h-4 w-4 shrink-0 text-indigo-500" />
                  <span className="text-sm font-semibold text-slate-800">
                    Cổng đăng nhập riêng tư cho trang chính
                  </span>
                </div>
                <label className="inline-flex cursor-pointer items-center gap-2 text-sm font-medium text-slate-700">
                  <input
                    type="checkbox"
                    checked={settingsForm.viewerPasscodeEnabled}
                    onChange={(e) =>
                      setSettingsForm((prev) => ({
                        ...prev,
                        viewerPasscodeEnabled: e.target.checked,
                      }))
                    }
                    className="h-4 w-4 rounded border-slate-300 text-indigo-500 focus:ring-indigo-400"
                  />
                  <span>Khoá bảo vệ trang kỷ niệm (Đăng nhập + OTP 6 số)</span>
                </label>
              </div>

              <div className="flex flex-col gap-3 rounded-xl border border-indigo-100 bg-indigo-50/70 p-3.5 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs leading-relaxed text-indigo-900">
                  Khi bật khoá bảo vệ, người xem tại <code>/</code> phải đăng nhập bằng tài khoản
                  riêng và xác thực mã OTP 6 chữ số trước khi ngắm trái tim pixel và đọc tâm thư.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab('users');
                    setNotice(null);
                  }}
                  className="inline-flex min-h-[36px] shrink-0 items-center justify-center rounded-xl border border-indigo-200 bg-white px-3.5 py-2 text-xs font-semibold text-indigo-700 shadow-sm transition hover:border-indigo-300 hover:bg-indigo-50"
                >
                  Đi tới quản lý tài khoản &amp; OTP →
                </button>
              </div>
            </div>

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={savingSettings}
                className="min-h-[36px] rounded-2xl bg-gradient-to-r from-pink-500 to-rose-500 px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {savingSettings ? 'Đang lưu...' : 'Lưu cài đặt'}
              </button>
            </div>
          </form>
        ) : null}

        {/* Tab 3: Love Letter & Live Preview */}
        {activeTab === 'letter' ? (
          <div className="grid gap-6 lg:grid-cols-2">
            <form
              onSubmit={(e) => handleSaveSettings(e, 'Đã cập nhật bức tâm thư gửi người thương.')}
              className="glass-card min-w-0 space-y-4 rounded-3xl p-4 shadow-glass sm:p-6"
            >
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Soạn bức tâm thư</h2>
                <p className="text-xs text-slate-500">
                  Tách các đoạn bằng một dòng trống để lá thư hiển thị thoáng và giàu cảm xúc hơn.
                </p>
              </div>

              <div>
                <label
                  htmlFor="letter-title"
                  className="mb-1.5 block text-sm font-medium text-slate-700"
                >
                  Tiêu đề bức thư
                </label>
                <input
                  id="letter-title"
                  type="text"
                  required
                  value={settingsForm.letterTitle}
                  onChange={(e) =>
                    setSettingsForm((prev) => ({ ...prev, letterTitle: e.target.value }))
                  }
                  className="w-full rounded-2xl border border-slate-200 bg-white/90 px-3.5 py-2.5 text-base text-slate-900 outline-none focus:border-pink-400 focus:ring-2 focus:ring-pink-200 sm:text-sm"
                />
              </div>

              <div>
                <label
                  htmlFor="letter-body"
                  className="mb-1.5 block text-sm font-medium text-slate-700"
                >
                  Nội dung tâm thư
                </label>
                <textarea
                  id="letter-body"
                  rows={10}
                  required
                  value={settingsForm.letterBody}
                  onChange={(e) =>
                    setSettingsForm((prev) => ({ ...prev, letterBody: e.target.value }))
                  }
                  className="w-full rounded-2xl border border-slate-200 bg-white/90 px-3.5 py-2.5 text-base leading-relaxed text-slate-900 outline-none focus:border-pink-400 focus:ring-2 focus:ring-pink-200 sm:text-sm"
                />
              </div>

              <div>
                <label
                  htmlFor="letter-signature"
                  className="mb-1.5 block text-sm font-medium text-slate-700"
                >
                  Chữ ký cuối thư
                </label>
                <textarea
                  id="letter-signature"
                  rows={2}
                  value={settingsForm.letterSignature}
                  onChange={(e) =>
                    setSettingsForm((prev) => ({ ...prev, letterSignature: e.target.value }))
                  }
                  placeholder="VD: Thương em thật nhiều,&#10;Anh của em ♥"
                  className="w-full rounded-2xl border border-slate-200 bg-white/90 px-3.5 py-2.5 text-base leading-relaxed text-slate-900 outline-none focus:border-pink-400 focus:ring-2 focus:ring-pink-200 sm:text-sm"
                />
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  disabled={savingSettings}
                  className="min-h-[36px] rounded-2xl bg-gradient-to-r from-pink-500 to-rose-500 px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {savingSettings ? 'Đang lưu...' : 'Lưu tâm thư'}
                </button>
              </div>
            </form>

            {/* Live Preview */}
            <aside className="glass-card flex min-w-0 flex-col justify-between rounded-3xl p-4 shadow-glass sm:p-7">
              <div>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-pink-50 px-3 py-1 text-xs font-medium text-pink-600">
                  Xem trước giao diện thư
                </span>
                <div className="mt-5 rounded-2xl border border-rose-100/90 bg-white/90 p-4 shadow-sm sm:p-8">
                  <h3 className="break-words [overflow-wrap:anywhere] font-serif text-3xl font-semibold text-slate-900">
                    {settingsForm.letterTitle || 'Tiêu đề bức thư'}
                  </h3>
                  <div className="mt-5 space-y-4 font-serif text-lg leading-relaxed text-slate-700">
                    {letterPreviewParagraphs.length > 0 ? (
                      letterPreviewParagraphs.map((paragraph, idx) => (
                        <p key={idx} className="whitespace-pre-line break-words [overflow-wrap:anywhere]">
                          {paragraph}
                        </p>
                      ))
                    ) : (
                      <p className="italic text-slate-400">Nội dung bức thư sẽ hiện ở đây...</p>
                    )}
                  </div>
                  {settingsForm.letterSignature ? (
                    <p className="mt-8 whitespace-pre-line break-words [overflow-wrap:anywhere] text-right font-serif text-xl italic text-pink-700">
                      {settingsForm.letterSignature}
                    </p>
                  ) : null}
                </div>
              </div>
            </aside>
          </div>
        ) : null}

        {/* Tab 4: Users & Access Control */}
        {activeTab === 'users' ? (
          <section className="space-y-6">
            {/* Create user form */}
            <form
              onSubmit={handleCreateUser}
              className="glass-card space-y-5 rounded-3xl p-5 shadow-glass sm:p-6"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <UserPlus className="h-4 w-4 text-pink-500" />
                    <h2 className="text-lg font-semibold text-slate-900">Tạo tài khoản mới</h2>
                  </div>
                  <p className="text-xs text-slate-500">
                    Cấp tài khoản riêng cho người thương (chỉ xem <code>/</code>) hoặc thêm quản trị
                    viên mới.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <div className="min-w-0">
                  <label
                    htmlFor="new-user-username"
                    className="mb-1.5 block text-sm font-medium text-slate-700"
                  >
                    Tên đăng nhập
                  </label>
                  <input
                    id="new-user-username"
                    type="text"
                    required
                    maxLength={32}
                    value={createUserForm.username}
                    onChange={(e) =>
                      setCreateUserForm((prev) => ({ ...prev, username: e.target.value }))
                    }
                    placeholder="VD: emyeu"
                    className="w-full min-w-0 rounded-2xl border border-slate-200 bg-white/90 px-3.5 py-2.5 text-base text-slate-900 outline-none focus:border-pink-400 focus:ring-2 focus:ring-pink-200 sm:text-sm"
                  />
                </div>

                <div className="min-w-0">
                  <label
                    htmlFor="new-user-display-name"
                    className="mb-1.5 block text-sm font-medium text-slate-700"
                  >
                    Tên hiển thị ngọt ngào
                  </label>
                  <input
                    id="new-user-display-name"
                    type="text"
                    required
                    maxLength={60}
                    value={createUserForm.displayName}
                    onChange={(e) =>
                      setCreateUserForm((prev) => ({ ...prev, displayName: e.target.value }))
                    }
                    placeholder="VD: Em bé thương yêu"
                    className="w-full min-w-0 rounded-2xl border border-slate-200 bg-white/90 px-3.5 py-2.5 text-base text-slate-900 outline-none focus:border-pink-400 focus:ring-2 focus:ring-pink-200 sm:text-sm"
                  />
                </div>

                <div className="min-w-0">
                  <label
                    htmlFor="new-user-role"
                    className="mb-1.5 block text-sm font-medium text-slate-700"
                  >
                    Vai trò
                  </label>
                  <select
                    id="new-user-role"
                    value={createUserForm.role}
                    onChange={(e) =>
                      setCreateUserForm((prev) => ({
                        ...prev,
                        role: e.target.value as UserRole,
                      }))
                    }
                    className="w-full min-w-0 rounded-2xl border border-slate-200 bg-white/90 px-3.5 py-2.5 text-base text-slate-900 outline-none focus:border-pink-400 focus:ring-2 focus:ring-pink-200 sm:text-sm"
                  >
                    <option value="viewer">Người thương (chỉ xem /)</option>
                    <option value="admin">Quản trị &amp; Xem</option>
                  </select>
                </div>

                <div className="min-w-0">
                  <label
                    htmlFor="new-user-password"
                    className="mb-1.5 block text-sm font-medium text-slate-700"
                  >
                    Mật khẩu
                  </label>
                  <input
                    id="new-user-password"
                    type="password"
                    required
                    maxLength={128}
                    value={createUserForm.password}
                    onChange={(e) =>
                      setCreateUserForm((prev) => ({ ...prev, password: e.target.value }))
                    }
                    placeholder="Ít nhất 6 ký tự..."
                    autoComplete="new-password"
                    className="w-full min-w-0 rounded-2xl border border-slate-200 bg-white/90 px-3.5 py-2.5 text-base text-slate-900 outline-none focus:border-pink-400 focus:ring-2 focus:ring-pink-200 sm:text-sm"
                  />
                </div>

                <div className="min-w-0">
                  <label
                    htmlFor="new-user-otp"
                    className="mb-1.5 block text-sm font-medium text-slate-700"
                  >
                    Mã OTP 6 số
                  </label>
                  <input
                    id="new-user-otp"
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    required
                    value={createUserForm.otpCode}
                    onChange={(e) =>
                      setCreateUserForm((prev) => ({
                        ...prev,
                        otpCode: e.target.value.replace(/\D/g, '').slice(0, 6),
                      }))
                    }
                    placeholder="VD: 654321"
                    className="w-full min-w-0 rounded-2xl border border-slate-200 bg-white/90 px-3.5 py-2.5 text-base tracking-widest text-slate-900 outline-none focus:border-pink-400 focus:ring-2 focus:ring-pink-200 sm:text-sm"
                  />
                </div>

                <div className="min-w-0">
                  <label
                    htmlFor="new-user-otp-hint"
                    className="mb-1.5 block text-sm font-medium text-slate-700"
                  >
                    Gợi ý OTP
                  </label>
                  <input
                    id="new-user-otp-hint"
                    type="text"
                    maxLength={120}
                    value={createUserForm.otpHint}
                    onChange={(e) =>
                      setCreateUserForm((prev) => ({ ...prev, otpHint: e.target.value }))
                    }
                    placeholder="VD: Ngày đầu tiên nắm tay nhau"
                    className="w-full min-w-0 rounded-2xl border border-slate-200 bg-white/90 px-3.5 py-2.5 text-base text-slate-900 outline-none focus:border-pink-400 focus:ring-2 focus:ring-pink-200 sm:text-sm"
                  />
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-slate-700">
                  <input
                    id="new-user-active"
                    type="checkbox"
                    checked={createUserForm.isActive}
                    onChange={(e) =>
                      setCreateUserForm((prev) => ({ ...prev, isActive: e.target.checked }))
                    }
                    className="h-4 w-4 rounded border-slate-300 text-pink-500 focus:ring-pink-400"
                  />
                  Kích hoạt ngay
                </label>

                <button
                  type="submit"
                  disabled={creatingUser}
                  className="inline-flex min-h-[36px] items-center gap-1.5 rounded-2xl bg-gradient-to-r from-pink-500 to-rose-500 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <Plus className="h-4 w-4" />
                  {creatingUser ? 'Đang tạo...' : 'Tạo tài khoản'}
                </button>
              </div>
            </form>

            {/* User cards list */}
            <div className="space-y-4">
              {users.map((u) => {
                const isSelf = Boolean(currentUser && u.id === currentUser.id);
                const isSoleActiveAdmin =
                  u.role === 'admin' && u.isActive && activeAdminsCount <= 1;
                const lockDisabled = isSelf || isSoleActiveAdmin || busyUserId === u.id;
                const revokeDisabled = isSelf || busyUserId === u.id;
                const deleteDisabled = isSelf || isSoleActiveAdmin || busyUserId === u.id;
                const roleLockedReason = isSelf
                  ? 'Không thể tự đổi vai trò của tài khoản đang đăng nhập.'
                  : isSoleActiveAdmin
                    ? 'Không thể hạ quyền tài khoản quản trị hoạt động cuối cùng.'
                    : undefined;
                const isEditing = editingUserId === u.id;

                return (
                  <article
                    key={u.id}
                    data-testid={`user-card-${u.id}`}
                    className="glass-card min-w-0 max-w-full space-y-4 rounded-3xl p-5 shadow-glass"
                  >
                    <div className="flex min-w-0 flex-col gap-4 md:flex-row md:items-start md:justify-between">
                      <div className="min-w-0 max-w-full flex-1 space-y-2">
                        <div className="flex min-w-0 max-w-full flex-wrap items-center gap-2">
                          <h3 className="min-w-0 max-w-full break-words [overflow-wrap:anywhere] font-serif text-xl font-semibold text-slate-900">
                            {u.displayName}
                          </h3>
                          <span className="max-w-full break-all rounded-full border border-slate-200 bg-white/90 px-2.5 py-0.5 text-xs font-medium text-slate-600">
                            @{u.username}
                          </span>
                          <span
                            className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${u.role === 'admin'
                              ? 'border-indigo-200 bg-indigo-50 text-indigo-700'
                              : 'border-pink-200 bg-pink-50 text-pink-700'
                              }`}
                          >
                            {u.role === 'admin' ? 'Quản trị' : 'Người thương'}
                          </span>
                          <span
                            className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${u.isActive
                              ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                              : 'border-rose-200 bg-rose-50 text-rose-700'
                              }`}
                          >
                            {u.isActive ? 'Đang hoạt động' : 'Đã tạm khoá'}
                          </span>
                          {isSelf ? (
                            <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-700">
                              Đang đăng nhập
                            </span>
                          ) : null}
                        </div>

                        <div className="flex min-w-0 max-w-full flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
                          <span className="inline-flex min-w-0 items-center gap-1">
                            <KeyRound className="h-3.5 w-3.5 shrink-0 text-pink-400" />
                            Phiên v{u.sessionVersion}
                          </span>
                          <span className="min-w-0 max-w-full [overflow-wrap:anywhere]">
                            Đăng nhập cuối:{' '}
                            <strong className="font-medium text-slate-700">
                              {formatVietnamDateTime(u.lastLoginAt, 'Chưa từng đăng nhập')}
                            </strong>
                          </span>
                          <span className="min-w-0 max-w-full break-words [overflow-wrap:anywhere]">
                            Gợi ý OTP:{' '}
                            <strong className="font-medium text-slate-700">
                              {u.otpHint || 'Chưa thiết lập'}
                            </strong>
                          </span>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 md:shrink-0 md:justify-end">
                        <button
                          type="button"
                          onClick={() =>
                            isEditing ? setEditingUserId(null) : openEditUserForm(u)
                          }
                          disabled={busyUserId === u.id}
                          className="inline-flex min-h-[36px] items-center gap-1 rounded-xl border border-slate-200 bg-white/90 px-3 py-2 text-xs font-medium text-slate-700 transition hover:border-pink-200 hover:text-pink-600 disabled:opacity-50"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                          {isEditing ? 'Đóng sửa' : 'Sửa'}
                        </button>

                        <button
                          type="button"
                          disabled={lockDisabled}
                          title={
                            isSelf
                              ? 'Không thể tự khoá tài khoản đang đăng nhập'
                              : isSoleActiveAdmin
                                ? 'Không thể khoá tài khoản quản trị hoạt động cuối cùng'
                                : undefined
                          }
                          onClick={() => handleToggleUserActive(u)}
                          className="inline-flex min-h-[36px] items-center gap-1 rounded-xl border border-slate-200 bg-white/90 px-3 py-2 text-xs font-medium text-slate-700 transition hover:border-amber-200 hover:text-amber-700 disabled:cursor-not-allowed disabled:opacity-45"
                        >
                          {u.isActive ? (
                            <>
                              <Lock className="h-3.5 w-3.5" />
                              Khoá
                            </>
                          ) : (
                            <>
                              <Unlock className="h-3.5 w-3.5" />
                              Mở khoá
                            </>
                          )}
                        </button>

                        <button
                          type="button"
                          disabled={revokeDisabled}
                          title={
                            isSelf
                              ? 'Không thể tự thu hồi phiên đang đăng nhập; hãy dùng nút Đăng xuất'
                              : 'Thu hồi phiên đăng nhập từ xa'
                          }
                          onClick={() => handleRevokeUserSession(u)}
                          className="inline-flex min-h-[36px] items-center gap-1 rounded-xl border border-slate-200 bg-white/90 px-3 py-2 text-xs font-medium text-indigo-700 transition hover:border-indigo-200 hover:bg-indigo-50 disabled:cursor-not-allowed disabled:opacity-45"
                        >
                          <RefreshCw className="h-3.5 w-3.5" />
                          Thu hồi phiên
                        </button>

                        {confirmDeleteUserId === u.id ? (
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              disabled={busyUserId === u.id}
                              onClick={() => handleDeleteUser(u)}
                              className="inline-flex min-h-[36px] items-center rounded-xl bg-rose-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-rose-700 disabled:opacity-50"
                            >
                              Xác nhận xoá
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteUserId(null)}
                              className="inline-flex min-h-[36px] items-center rounded-xl border border-slate-200 bg-white px-2.5 py-2 text-xs text-slate-600"
                            >
                              Huỷ
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            disabled={deleteDisabled}
                            title={
                              isSelf
                                ? 'Không thể tự xoá tài khoản đang đăng nhập'
                                : isSoleActiveAdmin
                                  ? 'Không thể xoá tài khoản quản trị hoạt động cuối cùng'
                                  : undefined
                            }
                            onClick={() => setConfirmDeleteUserId(u.id)}
                            className="inline-flex min-h-[36px] items-center gap-1 rounded-xl border border-slate-200 bg-white/90 px-3 py-2 text-xs font-medium text-rose-600 transition hover:border-rose-200 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-45"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            Xoá
                          </button>
                        )}
                      </div>
                    </div>

                    {isEditing ? (
                      <form
                        onSubmit={(e) => handleSaveEditUser(e, u)}
                        className="space-y-4 rounded-2xl border border-pink-100 bg-white/80 p-4"
                      >
                        <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
                          <div className="min-w-0">
                            <label
                              htmlFor={`edit-display-${u.id}`}
                              className="mb-1 block text-xs font-medium text-slate-700"
                            >
                              Tên hiển thị
                            </label>
                            <input
                              id={`edit-display-${u.id}`}
                              type="text"
                              required
                              maxLength={60}
                              value={editUserForm.displayName}
                              onChange={(e) =>
                                setEditUserForm((prev) => ({
                                  ...prev,
                                  displayName: e.target.value,
                                }))
                              }
                              className="w-full min-w-0 rounded-xl border border-slate-200 bg-white px-3 py-2 text-base text-slate-900 outline-none focus:border-pink-400 focus:ring-2 focus:ring-pink-200 sm:text-sm"
                            />
                          </div>

                          <div className="min-w-0">
                            <label
                              htmlFor={`edit-role-${u.id}`}
                              className="mb-1 block text-xs font-medium text-slate-700"
                            >
                              Vai trò
                            </label>
                            <select
                              id={`edit-role-${u.id}`}
                              disabled={isSelf || isSoleActiveAdmin}
                              title={roleLockedReason}
                              value={editUserForm.role}
                              onChange={(e) =>
                                setEditUserForm((prev) => ({
                                  ...prev,
                                  role: e.target.value as UserRole,
                                }))
                              }
                              className="w-full min-w-0 rounded-xl border border-slate-200 bg-white px-3 py-2 text-base text-slate-900 outline-none focus:border-pink-400 focus:ring-2 focus:ring-pink-200 disabled:bg-slate-100 disabled:text-slate-500 sm:text-sm"
                            >
                              <option value="viewer">Người thương (chỉ xem /)</option>
                              <option value="admin">Quản trị &amp; Xem</option>
                            </select>
                            {roleLockedReason ? (
                              <p className="mt-1 text-[11px] leading-snug text-slate-500 [overflow-wrap:anywhere]">
                                {roleLockedReason}
                              </p>
                            ) : null}
                          </div>

                          <div className="min-w-0">
                            <label
                              htmlFor={`edit-otp-hint-${u.id}`}
                              className="mb-1 block text-xs font-medium text-slate-700"
                            >
                              Gợi ý OTP
                            </label>
                            <input
                              id={`edit-otp-hint-${u.id}`}
                              type="text"
                              maxLength={120}
                              value={editUserForm.otpHint}
                              onChange={(e) =>
                                setEditUserForm((prev) => ({
                                  ...prev,
                                  otpHint: e.target.value,
                                }))
                              }
                              className="w-full min-w-0 rounded-xl border border-slate-200 bg-white px-3 py-2 text-base text-slate-900 outline-none focus:border-pink-400 focus:ring-2 focus:ring-pink-200 sm:text-sm"
                            />
                          </div>

                          <div className="min-w-0">
                            <label
                              htmlFor={`edit-password-${u.id}`}
                              className="mb-1 block text-xs font-medium text-slate-700"
                            >
                              Mật khẩu mới (để trống nếu giữ nguyên)
                            </label>
                            <input
                              id={`edit-password-${u.id}`}
                              type="password"
                              maxLength={128}
                              value={editUserForm.password}
                              onChange={(e) =>
                                setEditUserForm((prev) => ({
                                  ...prev,
                                  password: e.target.value,
                                }))
                              }
                              placeholder="Tối thiểu 6 ký tự..."
                              autoComplete="new-password"
                              className="w-full min-w-0 rounded-xl border border-slate-200 bg-white px-3 py-2 text-base text-slate-900 outline-none focus:border-pink-400 focus:ring-2 focus:ring-pink-200 sm:text-sm"
                            />
                          </div>

                          <div className="min-w-0">
                            <label
                              htmlFor={`edit-otp-${u.id}`}
                              className="mb-1 block text-xs font-medium text-slate-700"
                            >
                              Mã OTP 6 số mới (để trống nếu giữ nguyên)
                            </label>
                            <input
                              id={`edit-otp-${u.id}`}
                              type="text"
                              inputMode="numeric"
                              maxLength={6}
                              value={editUserForm.otpCode}
                              onChange={(e) =>
                                setEditUserForm((prev) => ({
                                  ...prev,
                                  otpCode: e.target.value.replace(/\D/g, '').slice(0, 6),
                                }))
                              }
                              placeholder="6 chữ số..."
                              className="w-full min-w-0 rounded-xl border border-slate-200 bg-white px-3 py-2 text-base tracking-widest text-slate-900 outline-none focus:border-pink-400 focus:ring-2 focus:ring-pink-200 sm:text-sm"
                            />
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => setEditingUserId(null)}
                            className="inline-flex min-h-[36px] items-center rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-medium text-slate-600"
                          >
                            Huỷ
                          </button>
                          <button
                            type="submit"
                            disabled={busyUserId === u.id}
                            className="inline-flex min-h-[36px] items-center rounded-xl bg-gradient-to-r from-pink-500 to-rose-500 px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:brightness-105 disabled:opacity-50"
                          >
                            {busyUserId === u.id ? 'Đang lưu...' : 'Lưu thay đổi'}
                          </button>
                        </div>
                      </form>
                    ) : null}
                  </article>
                );
              })}
            </div>
          </section>
        ) : null}

        {/* Tab 5: Activity & Traffic Logs */}
        {activeTab === 'activity' ? (
          <section className="space-y-6">
            {/* 4 Summary Cards */}
            <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
              <div
                data-testid="stat-visits-today"
                className="glass-card rounded-2xl p-4 shadow-glass sm:p-5"
              >
                <p className="text-xs font-medium text-slate-500">Ghé trang hôm nay</p>
                <p className="mt-2 font-serif text-3xl font-bold text-slate-900">
                  {trafficSummary.visitsToday}
                </p>
                <p className="mt-1 text-[11px] text-slate-400">Tính theo giờ Việt Nam</p>
              </div>

              <div
                data-testid="stat-otp-verified"
                className="glass-card rounded-2xl p-4 shadow-glass sm:p-5"
              >
                <p className="text-xs font-medium text-emerald-700">Đã xác thực OTP</p>
                <p className="mt-2 font-serif text-3xl font-bold text-emerald-700">
                  {trafficSummary.otpVerifiedToday}
                </p>
                <p className="mt-1 text-[11px] text-emerald-600/80">Mở khoá thành công hôm nay</p>
              </div>

              <div
                data-testid="stat-failed-auth"
                className="glass-card rounded-2xl p-4 shadow-glass sm:p-5"
              >
                <p className="text-xs font-medium text-rose-700">Cảnh báo đăng nhập sai</p>
                <p className="mt-2 font-serif text-3xl font-bold text-rose-600">
                  {trafficSummary.failedAuthToday}
                </p>
                <p className="mt-1 text-[11px] text-rose-500/80">Sai mật khẩu / OTP hôm nay</p>
              </div>

              <div
                data-testid="stat-active-users"
                className="glass-card rounded-2xl p-4 shadow-glass sm:p-5"
              >
                <p className="text-xs font-medium text-indigo-700">Tài khoản hoạt động</p>
                <p className="mt-2 font-serif text-3xl font-bold text-indigo-700">
                  {trafficSummary.activeUsersCount}
                </p>
                <p className="mt-1 text-[11px] text-indigo-500/80">Đang được phép truy cập</p>
              </div>
            </div>

            {/* Filter + Refresh Bar */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                fetchActivityLogs();
              }}
              className="glass-card space-y-4 rounded-3xl p-4 shadow-glass sm:p-5"
            >
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
                <div className="min-w-0">
                  <label
                    htmlFor="activity-event-filter"
                    className="mb-1 block text-xs font-medium text-slate-700"
                  >
                    Loại hành động
                  </label>
                  <select
                    id="activity-event-filter"
                    value={activityEventFilter}
                    onChange={(e) => {
                      const next = e.target.value;
                      setActivityEventFilter(next);
                      fetchActivityLogs({ eventType: next });
                    }}
                    className="w-full min-w-0 rounded-xl border border-slate-200 bg-white/95 px-3 py-2 text-base text-slate-900 outline-none focus:border-pink-400 focus:ring-2 focus:ring-pink-200 sm:text-sm"
                  >
                    <option value="">Tất cả</option>
                    {ACTIVITY_EVENT_OPTIONS.map(([eventType, meta]) => (
                      <option key={eventType} value={eventType}>
                        {meta.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="min-w-0">
                  <label
                    htmlFor="activity-user-filter"
                    className="mb-1 block text-xs font-medium text-slate-700"
                  >
                    Lọc tài khoản
                  </label>
                  <select
                    id="activity-user-filter"
                    value={activityUsernameFilter}
                    onChange={(e) => {
                      const next = e.target.value;
                      setActivityUsernameFilter(next);
                      fetchActivityLogs({ username: next });
                    }}
                    className="w-full min-w-0 rounded-xl border border-slate-200 bg-white/95 px-3 py-2 text-base text-slate-900 outline-none focus:border-pink-400 focus:ring-2 focus:ring-pink-200 sm:text-sm"
                  >
                    <option value="">Tất cả tài khoản</option>
                    <option value="khach">Khách ghé trang</option>
                    {users.map((u) => (
                      <option key={u.id} value={u.username}>
                        {u.displayName} (@{u.username})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="min-w-0">
                  <label
                    htmlFor="activity-search"
                    className="mb-1 block text-xs font-medium text-slate-700"
                  >
                    Tìm kiếm nhật ký
                  </label>
                  <div className="relative min-w-0">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                    <input
                      id="activity-search"
                      type="text"
                      value={activitySearch}
                      onChange={(e) => setActivitySearch(e.target.value)}
                      placeholder="Chi tiết, thiết bị..."
                      className="w-full min-w-0 rounded-xl border border-slate-200 bg-white/95 py-2 pl-8 pr-3 text-base text-slate-900 outline-none focus:border-pink-400 focus:ring-2 focus:ring-pink-200 sm:text-sm"
                    />
                  </div>
                </div>

                <div className="min-w-0">
                  <label
                    htmlFor="activity-limit"
                    className="mb-1 block text-xs font-medium text-slate-700"
                  >
                    Giới hạn dòng
                  </label>
                  <select
                    id="activity-limit"
                    value={activityLimit}
                    onChange={(e) => {
                      const next = e.target.value;
                      setActivityLimit(next);
                      fetchActivityLogs({ limit: next });
                    }}
                    className="w-full min-w-0 rounded-xl border border-slate-200 bg-white/95 px-3 py-2 text-base text-slate-900 outline-none focus:border-pink-400 focus:ring-2 focus:ring-pink-200 sm:text-sm"
                  >
                    <option value="50">50 dòng</option>
                    <option value="100">100 dòng</option>
                    <option value="200">200 dòng</option>
                  </select>
                </div>

                <div className="flex min-w-0 items-end">
                  <button
                    type="submit"
                    disabled={loadingActivity}
                    className="inline-flex min-h-[36px] w-full items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-pink-500 to-rose-500 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:brightness-105 disabled:opacity-60"
                  >
                    <RefreshCw
                      className={`h-4 w-4 ${loadingActivity ? 'animate-spin motion-reduce:animate-none' : ''}`}
                    />
                    {loadingActivity ? 'Đang tải...' : 'Làm mới'}
                  </button>
                </div>
              </div>
            </form>

            {/* Responsive Activity Feed */}
            {activityLogs.length === 0 ? (
              <div className="glass-card rounded-3xl p-10 text-center text-sm text-slate-500">
                Chưa có bản ghi nhật ký phù hợp với bộ lọc hiện tại.
              </div>
            ) : (
              <>
                {/* Mobile stacked glass cards (< md) */}
                <div data-testid="activity-mobile-list" className="space-y-3 md:hidden">
                  {activityLogs.map((log) => {
                    const { eventMeta, roleMeta } = getActivityDisplayMeta(log);

                    return (
                      <article
                        key={log.id}
                        className="glass-card min-w-0 max-w-full space-y-2.5 rounded-2xl p-4 shadow-glass"
                      >
                        <div className="flex min-w-0 max-w-full flex-wrap items-center justify-between gap-2">
                          <span
                            className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${eventMeta.badgeClass}`}
                          >
                            {eventMeta.label}
                          </span>
                          <span className="text-[11px] font-medium text-slate-500">
                            {formatVietnamDateTime(log.createdAt)}
                          </span>
                        </div>

                        <div className="flex min-w-0 max-w-full flex-wrap items-center gap-2">
                          <span className="min-w-0 max-w-full break-all [overflow-wrap:anywhere] text-xs font-semibold text-slate-800">
                            @{log.username}
                          </span>
                          <span
                            className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${roleMeta.badgeClass}`}
                          >
                            {roleMeta.label}
                          </span>
                        </div>

                        <p className="min-w-0 max-w-full break-words [overflow-wrap:anywhere] text-sm text-slate-700">
                          {log.detail || eventMeta.label}
                        </p>

                        <p className="min-w-0 max-w-full break-words [overflow-wrap:anywhere] text-xs text-slate-400">
                          {log.deviceSummary || 'Không rõ thiết bị'}
                        </p>
                      </article>
                    );
                  })}
                </div>

                {/* Tablet & Desktop overflow-x-auto table (>= md) */}
                <div
                  data-testid="activity-desktop-table"
                  className="hidden overflow-x-auto rounded-2xl border border-slate-200/80 bg-white/80 shadow-glass md:block"
                >
                  <table className="min-w-full divide-y divide-slate-200/80 text-left text-sm">
                    <thead className="bg-slate-50/90 text-xs font-semibold uppercase tracking-wide text-slate-500">
                      <tr>
                        <th scope="col" className="whitespace-nowrap px-4 py-3">
                          Thời gian (VN)
                        </th>
                        <th scope="col" className="whitespace-nowrap px-4 py-3">
                          Tài khoản
                        </th>
                        <th scope="col" className="whitespace-nowrap px-4 py-3">
                          Hành động
                        </th>
                        <th scope="col" className="px-4 py-3">
                          Chi tiết
                        </th>
                        <th scope="col" className="whitespace-nowrap px-4 py-3">
                          Thiết bị
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white/60">
                      {activityLogs.map((log) => {
                        const { eventMeta, roleMeta } = getActivityDisplayMeta(log);

                        return (
                          <tr key={log.id} className="align-top transition hover:bg-pink-50/30">
                            <td className="whitespace-nowrap px-4 py-3 text-xs font-medium text-slate-600">
                              {formatVietnamDateTime(log.createdAt)}
                            </td>
                            <td className="whitespace-nowrap px-4 py-3">
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-semibold text-slate-800">
                                  @{log.username}
                                </span>
                                <span
                                  className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${roleMeta.badgeClass}`}
                                >
                                  {roleMeta.label}
                                </span>
                              </div>
                            </td>
                            <td className="whitespace-nowrap px-4 py-3">
                              <span
                                className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${eventMeta.badgeClass}`}
                              >
                                {eventMeta.label}
                              </span>
                            </td>
                            <td className="max-w-xs break-words [overflow-wrap:anywhere] px-4 py-3 text-xs text-slate-700">
                              {log.detail || eventMeta.label}
                            </td>
                            <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-500">
                              {log.deviceSummary || 'Không rõ thiết bị'}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </section>
        ) : null}
      </div>
    </div>
  );
}
