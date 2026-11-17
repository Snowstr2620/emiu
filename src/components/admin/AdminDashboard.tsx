'use client';

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ClipboardEvent,
  type FormEvent,
} from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Activity,
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  BookOpen,
  CalendarHeart,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Cloud,
  ExternalLink,
  HardDrive,
  Heart,
  ImagePlus,
  Images,
  KeyRound,
  Lock,
  LogOut,
  Mail,
  Music,
  Pencil,
  Play,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Star,
  Trash2,
  Unlock,
  Upload,
  UserPlus,
  Users,
  Volume2,
  X,
} from 'lucide-react';
import { DailyDiarySection } from '@/components/story/DailyDiarySection';
import {
  cleanupUploadedUrl,
  inferVisualUploadKind,
  UploadAuthError,
  uploadMediaFile,
} from '@/lib/admin-upload';
import {
  CLIENT_AUDIO_RULE,
  createManagedDropHandlers,
  createManagedMultiDropHandlers,
  getDroppedOrPastedFiles,
  validateClientUploadFile,
  validateClientVisualMediaFile,
  VISUAL_MEDIA_ACCEPT,
} from '@/lib/client-dropzone';
import { convertHeicFiles, HEIC_CONVERT_ERROR_MESSAGE, isHeicFile } from '@/lib/heic';
import {
  formatAlbumMediaCountVi,
  getMemoryImages,
  isVideoFile,
  isVideoMediaItem,
  isVideoMediaUrl,
  MAX_ALBUM_IMAGES,
} from '@/lib/memory-album';
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
  DiaryEntry,
  MemoryImageItem,
  MemoryItem,
  SafeAppUser,
  StorageStatus,
  TrafficSummary,
  UserRole,
} from '@/types/memories';

type AdminTab = 'memories' | 'diary' | 'settings' | 'letter' | 'users' | 'activity';

const EMPTY_ADMIN_DIARY_ENTRIES: DiaryEntry[] = [];

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

type AlbumDraftItem =
  | {
    id: string;
    kind: 'file';
    file: File;
    previewUrl: string;
    alt: string;
    mediaType: 'image' | 'video';
  }
  | {
    id: string;
    kind: 'existing';
    url: string;
    alt: string;
    mediaType: 'image' | 'video';
  };

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

const ADMIN_INPUT_CLASS =
  'w-full min-w-0 rounded-2xl border border-amber-300/80 bg-[#FFFDF5] px-3.5 py-2.5 text-base text-stone-900 placeholder:text-stone-500 outline-none transition focus:border-red-500 focus:ring-2 focus:ring-red-500/20 sm:text-sm';

const ADMIN_COMPACT_INPUT_CLASS =
  'w-full min-w-0 rounded-xl border border-amber-300/80 bg-[#FFFDF5] px-3 py-2 text-base text-stone-900 placeholder:text-stone-500 outline-none transition focus:border-red-500 focus:ring-2 focus:ring-red-500/20 sm:text-sm';

const ADMIN_OPTION_CLASS = 'bg-[#FFFBEB] text-stone-900';

const ADMIN_PRIMARY_CTA_CLASS =
  'bg-gradient-to-r from-red-600 via-rose-600 to-red-500 text-white shadow-[0_10px_26px_rgba(220,38,38,0.25)] transition hover:shadow-[0_14px_34px_rgba(220,38,38,0.38)] hover:ring-1 hover:ring-red-300';

const ADMIN_SECONDARY_BTN_CLASS =
  'border border-amber-300/80 bg-amber-100/75 text-stone-800 transition hover:border-amber-400 hover:bg-amber-200/80 hover:text-stone-950';

const ADMIN_CHECKBOX_CLASS =
  'h-4 w-4 rounded border-amber-400 bg-[#FFFDF5] text-red-600 accent-red-600 focus:ring-red-500/30';

const ACTIVITY_EVENT_META: Record<ActivityEventType, { label: string; badgeClass: string }> = {
  page_visit: {
    label: 'Ghé trang',
    badgeClass: 'border-amber-300/80 bg-amber-100/75 text-stone-800',
  },
  page_leave: {
    label: 'Rời trang',
    badgeClass: 'border-amber-300/80 bg-amber-100/75 text-stone-800',
  },
  login_step1_ok: {
    label: 'Đăng nhập bước 1',
    badgeClass: 'border-emerald-300 bg-emerald-50 text-emerald-800',
  },
  login_failed: {
    label: 'Đăng nhập thất bại',
    badgeClass: 'border-red-300 bg-red-50 text-red-800',
  },
  otp_verified: {
    label: 'Xác thực OTP thành công',
    badgeClass: 'border-emerald-300 bg-emerald-50 text-emerald-800',
  },
  otp_failed: {
    label: 'Sai mã OTP',
    badgeClass: 'border-red-300 bg-red-50 text-red-800',
  },
  pixel_heart_viewed: {
    label: 'Ngắm trái tim pixel',
    badgeClass: 'border-red-200 bg-red-50 text-red-700',
  },
  music_toggled: {
    label: 'Bật / tắt nhạc nền',
    badgeClass: 'border-amber-300/80 bg-amber-100/90 text-amber-900',
  },
  memory_viewed: {
    label: 'Xem ảnh kỷ niệm',
    badgeClass: 'border-red-200 bg-red-50 text-red-700',
  },
  letter_opened: {
    label: 'Mở phong thư',
    badgeClass: 'border-amber-300/80 bg-amber-100/90 text-amber-900',
  },
  diary_saved: {
    label: 'Lưu nhật ký ngày',
    badgeClass: 'border-red-200 bg-red-50 text-red-700',
  },
  diary_deleted: {
    label: 'Xoá nhật ký ngày',
    badgeClass: 'border-red-300 bg-red-50 text-red-800',
  },
  logout: {
    label: 'Đăng xuất',
    badgeClass: 'border-amber-300/80 bg-amber-100/75 text-stone-800',
  },
};

const ACTIVITY_EVENT_OPTIONS = Object.entries(ACTIVITY_EVENT_META) as Array<
  [ActivityEventType, { label: string; badgeClass: string }]
>;

const ACTOR_ROLE_META: Record<ActivityActorRole, { label: string; badgeClass: string }> = {
  admin: {
    label: 'Admin',
    badgeClass: 'border-red-300/80 bg-red-50 text-red-800',
  },
  viewer: {
    label: 'Người thương',
    badgeClass: 'border-amber-300/80 bg-amber-100/85 text-amber-900',
  },
  guest: {
    label: 'Khách',
    badgeClass: 'border-stone-300 bg-stone-100 text-stone-700',
  },
};

function getActivityDisplayMeta(log: ActivityLogItem) {
  const eventMeta = ACTIVITY_EVENT_META[log.eventType] ?? {
    label: log.eventType,
    badgeClass: 'border-amber-300/80 bg-amber-100/75 text-stone-800',
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
  const tabButtonRefs = useRef<Partial<Record<AdminTab, HTMLButtonElement | null>>>({});
  const dragDepthRef = useRef<Record<'quick' | 'memory' | 'audio', number>>({
    quick: 0,
    memory: 0,
    audio: 0,
  });

  const [activeTab, setActiveTab] = useState<AdminTab>('memories');

  // Mobile tab strip scrolls horizontally with a hidden scrollbar; show a fade + chevron
  // on the right edge while more tabs are hidden so admins know they can swipe.
  const tabStripRef = useRef<HTMLElement | null>(null);
  const [tabStripHasMoreRight, setTabStripHasMoreRight] = useState(false);

  function updateTabStripOverflow() {
    const strip = tabStripRef.current;
    if (!strip) return;
    setTabStripHasMoreRight(strip.scrollLeft + strip.clientWidth < strip.scrollWidth - 4);
  }

  useEffect(() => {
    updateTabStripOverflow();
    window.addEventListener('resize', updateTabStripOverflow);
    return () => window.removeEventListener('resize', updateTabStripOverflow);
  }, []);

  useEffect(() => {
    const activeBtn = tabButtonRefs.current[activeTab];
    if (activeBtn && typeof activeBtn.scrollIntoView === 'function') {
      const prefersReducedMotion =
        typeof window !== 'undefined' &&
        window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
      activeBtn.scrollIntoView({
        inline: 'center',
        block: 'nearest',
        behavior: prefersReducedMotion ? 'auto' : 'smooth',
      });
    }
  }, [activeTab]);
  const [memories, setMemories] = useState<MemoryItem[]>(initialData.memories);
  const initialAdminDiaryEntries = initialData.diaryEntries ?? EMPTY_ADMIN_DIARY_ENTRIES;
  const [diaryCount, setDiaryCount] = useState<number>(initialAdminDiaryEntries.length);

  useEffect(() => {
    setDiaryCount((initialData.diaryEntries ?? EMPTY_ADMIN_DIARY_ENTRIES).length);
  }, [initialData.diaryEntries]);
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
  const [albumItems, setAlbumItems] = useState<AlbumDraftItem[]>([]);
  const albumItemsRef = useRef<AlbumDraftItem[]>([]);
  albumItemsRef.current = albumItems;
  const [uploadProgressText, setUploadProgressText] = useState<string | null>(null);
  const [isDraggingMemoryImage, setIsDraggingMemoryImage] = useState(false);
  const [isDraggingQuickMemory, setIsDraggingQuickMemory] = useState(false);
  const [savingMemory, setSavingMemory] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deletingMemoryId, setDeletingMemoryId] = useState<string | null>(null);
  const [reordering, setReordering] = useState(false);

  // Audio upload state in Settings tab
  const [pendingAudioFile, setPendingAudioFile] = useState<File | null>(null);
  const [audioPreviewUrl, setAudioPreviewUrl] = useState<string | null>(null);
  const [isDraggingAudio, setIsDraggingAudio] = useState(false);
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
      for (const item of albumItemsRef.current) {
        if (item.kind === 'file') {
          URL.revokeObjectURL(item.previewUrl);
        }
      }
    };
  }, []);

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

  function resetAllAlbumItems() {
    setAlbumItems((prev) => {
      for (const item of prev) {
        if (item.kind === 'file') URL.revokeObjectURL(item.previewUrl);
      }
      return [];
    });
    dragDepthRef.current.memory = 0;
    setIsDraggingMemoryImage(false);
    setUploadProgressText(null);
    if (memoryFileInputRef.current) {
      memoryFileInputRef.current.value = '';
    }
  }

  function clearMemoryFilePreview() {
    setAlbumItems((prev) => {
      const kept: AlbumDraftItem[] = [];
      for (const item of prev) {
        if (item.kind === 'file') {
          URL.revokeObjectURL(item.previewUrl);
        } else {
          kept.push(item);
        }
      }
      return kept;
    });
    dragDepthRef.current.memory = 0;
    setIsDraggingMemoryImage(false);
    if (memoryFileInputRef.current) {
      memoryFileInputRef.current.value = '';
    }
  }

  function clearAudioFilePreview() {
    if (audioPreviewUrl) URL.revokeObjectURL(audioPreviewUrl);
    setAudioPreviewUrl(null);
    setPendingAudioFile(null);
    dragDepthRef.current.audio = 0;
    setIsDraggingAudio(false);
    if (audioFileInputRef.current) {
      audioFileInputRef.current.value = '';
    }
  }

  function applyMemoryImageFiles(files: File[], openFormIfClosed = false): boolean {
    if (!files.length) return false;

    if (files.some(isHeicFile)) {
      setNotice({ type: 'success', text: 'Đang chuyển ảnh HEIC sang JPG...' });
      void convertHeicFiles(files).then(({ files: converted, failed }) => {
        const applied = converted.length > 0 && applyMemoryImageFilesRef.current(converted, openFormIfClosed);
        if (failed > 0) {
          showError(
            applied
              ? `Đã thêm ảnh, nhưng ${failed} ảnh HEIC không chuyển được sang JPG.`
              : HEIC_CONVERT_ERROR_MESSAGE
          );
        }
      });
      return true;
    }

    const validFiles: File[] = [];
    let firstError: string | null = null;
    for (const file of files) {
      const err = validateClientVisualMediaFile(file);
      if (err) {
        if (!firstError) firstError = err;
      } else {
        validFiles.push(file);
      }
    }

    if (validFiles.length === 0) {
      if (firstError) showError(firstError);
      return false;
    }

    const baseList = openFormIfClosed && !isMemoryFormOpen ? [] : albumItems;
    const remainingSlots = Math.max(0, MAX_ALBUM_IMAGES - baseList.length);
    if (remainingSlots === 0) {
      showError(`Mỗi album kỷ niệm hỗ trợ tối đa ${MAX_ALBUM_IMAGES} mục.`);
      return false;
    }

    const accepted = validFiles.slice(0, remainingSlots);
    const createdItems: AlbumDraftItem[] = accepted.map((file, idx) => ({
      id: `draft-file-${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 8)}`,
      kind: 'file',
      file,
      previewUrl: URL.createObjectURL(file),
      alt: '',
      mediaType: isVideoFile(file) ? 'video' : 'image',
    }));

    if (openFormIfClosed && !isMemoryFormOpen) {
      setMemoryForm({
        id: null,
        memoryDate: getTodayVietnamIso(),
        title: '',
        story: '',
        imageUrl: '',
        imageAlt: '',
      });
      setAlbumItems(createdItems);
      setIsMemoryFormOpen(true);
    } else {
      setAlbumItems((prev) => [...prev, ...createdItems]);
    }

    if (firstError) {
      showError(firstError);
    } else if (validFiles.length > remainingSlots) {
      showError(
        `Đã thêm ${accepted.length} tệp đầu tiên (mỗi album tối đa ${MAX_ALBUM_IMAGES} mục).`
      );
    } else {
      setNotice(null);
    }

    return true;
  }

  const applyMemoryImageFilesRef = useRef(applyMemoryImageFiles);
  applyMemoryImageFilesRef.current = applyMemoryImageFiles;

  function handleAddUrlToAlbum() {
    const url = memoryForm.imageUrl.trim();
    if (!url) {
      showError('Vui lòng nhập đường dẫn ảnh hoặc video trước khi thêm vào album.');
      return;
    }
    if (albumItems.length >= MAX_ALBUM_IMAGES) {
      showError(`Mỗi album kỷ niệm hỗ trợ tối đa ${MAX_ALBUM_IMAGES} mục.`);
      return;
    }
    setAlbumItems((prev) => [
      ...prev,
      {
        id: `draft-url-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        kind: 'existing',
        url,
        alt: memoryForm.imageAlt.trim(),
        mediaType: isVideoMediaUrl(url) ? 'video' : 'image',
      },
    ]);
    setMemoryForm((prev) => ({ ...prev, imageUrl: '' }));
    if (memoryFileInputRef.current) {
      memoryFileInputRef.current.value = '';
    }
    setNotice(null);
  }

  function setAlbumItemAsCover(index: number) {
    if (index <= 0 || index >= albumItems.length) return;
    const chosenItem = albumItems[index];
    setAlbumItems((prev) => {
      const next = [...prev];
      const [chosen] = next.splice(index, 1);
      next.unshift(chosen);
      return next;
    });
    if (chosenItem) {
      setMemoryForm((prev) => ({ ...prev, imageAlt: chosenItem.alt }));
    }
  }

  function moveAlbumItem(index: number, direction: -1 | 1) {
    const targetIdx = index + direction;
    if (targetIdx < 0 || targetIdx >= albumItems.length) return;
    const next = [...albumItems];
    const [moved] = next.splice(index, 1);
    next.splice(targetIdx, 0, moved);
    setAlbumItems(next);
    if (index === 0 || targetIdx === 0) {
      setMemoryForm((prev) => ({ ...prev, imageAlt: next[0]?.alt ?? '' }));
    }
  }

  function removeAlbumItem(index: number) {
    const target = albumItems[index];
    if (target?.kind === 'file') {
      URL.revokeObjectURL(target.previewUrl);
    }
    const next = albumItems.filter((_, idx) => idx !== index);
    setAlbumItems(next);
    if (index === 0) {
      setMemoryForm((prev) => ({ ...prev, imageAlt: next[0]?.alt ?? '' }));
    }
  }

  function updateAlbumItemAlt(index: number, alt: string) {
    setAlbumItems((prev) =>
      prev.map((item, idx) => (idx === index ? { ...item, alt } : item))
    );
    if (index === 0) {
      setMemoryForm((prev) => ({ ...prev, imageAlt: alt }));
    }
  }

  function applyAudioFile(file: File): boolean {
    const err = validateClientUploadFile(file, CLIENT_AUDIO_RULE);
    if (err) {
      showError(err);
      return false;
    }

    if (audioPreviewUrl) URL.revokeObjectURL(audioPreviewUrl);
    setPendingAudioFile(file);
    setAudioPreviewUrl(URL.createObjectURL(file));
    setNotice(null);
    return true;
  }

  function createFileDropHandlers(
    zoneKey: 'quick' | 'memory' | 'audio',
    setDragging: (active: boolean) => void,
    onFile: (file: File) => void
  ) {
    return createManagedDropHandlers(dragDepthRef, zoneKey, setDragging, onFile);
  }

  function createMultiFileDropHandlers(
    zoneKey: 'quick' | 'memory',
    setDragging: (active: boolean) => void,
    onFiles: (files: File[]) => void
  ) {
    return createManagedMultiDropHandlers(dragDepthRef, zoneKey, setDragging, onFiles);
  }

  function handleMemoryFormPaste(e: ClipboardEvent<HTMLFormElement>) {
    const pastedFiles = getDroppedOrPastedFiles(e.clipboardData?.files, e.clipboardData?.items);
    if (pastedFiles.length > 0) {
      e.preventDefault();
      applyMemoryImageFiles(pastedFiles);
    }
  }

  function openNewMemoryForm() {
    resetAllAlbumItems();
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
    resetAllAlbumItems();
    const existingImages = getMemoryImages(item);
    setAlbumItems(
      existingImages.map((img, idx) => ({
        id: `existing-${item.id}-${idx}`,
        kind: 'existing',
        url: img.url,
        alt: img.alt,
        mediaType: isVideoMediaItem(img) ? 'video' : 'image',
      }))
    );
    setMemoryForm({
      id: item.id,
      memoryDate: item.memoryDate,
      title: item.title,
      story: item.story,
      imageUrl: '',
      imageAlt: existingImages[0]?.alt || item.imageAlt || '',
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

    const typedManualUrl = memoryForm.imageUrl.trim();
    const effectiveDrafts: AlbumDraftItem[] = [...albumItems];
    if (
      typedManualUrl &&
      !effectiveDrafts.some((item) => item.kind === 'existing' && item.url === typedManualUrl)
    ) {
      effectiveDrafts.push({
        id: `draft-manual-${Date.now()}`,
        kind: 'existing',
        url: typedManualUrl,
        alt: memoryForm.imageAlt.trim(),
        mediaType: isVideoMediaUrl(typedManualUrl) ? 'video' : 'image',
      });
    }

    if (effectiveDrafts.length === 0) {
      showError('Vui lòng tải lên ít nhất một bức ảnh / video hoặc nhập đường dẫn media.');
      return;
    }
    if (effectiveDrafts.length > MAX_ALBUM_IMAGES) {
      showError(`Mỗi album kỷ niệm hỗ trợ tối đa ${MAX_ALBUM_IMAGES} mục.`);
      return;
    }

    setSavingMemory(true);
    setNotice(null);
    setUploadProgressText(null);
    const newlyUploadedUrls: string[] = [];

    try {
      const filesToUploadCount = effectiveDrafts.filter((item) => item.kind === 'file').length;
      let uploadedCount = 0;
      const finalImages: MemoryImageItem[] = [];
      const fallbackAlt = memoryForm.imageAlt.trim() || memoryForm.title.trim() || 'Ảnh kỷ niệm';

      for (let i = 0; i < effectiveDrafts.length; i++) {
        const draft = effectiveDrafts[i];
        const resolvedAlt = (draft.alt.trim() || (i === 0 ? fallbackAlt : memoryForm.title.trim() || 'Ảnh kỷ niệm')).slice(0, 160);
        if (draft.kind === 'file') {
          uploadedCount++;
          if (filesToUploadCount > 1) {
            setUploadProgressText(`Đang tải tệp ${uploadedCount}/${filesToUploadCount}...`);
          }
          const uploadKind = inferVisualUploadKind(draft.file);
          const uploadedUrl = await uploadMediaFile(draft.file, uploadKind);
          newlyUploadedUrls.push(uploadedUrl);
          finalImages.push(
            draft.mediaType === 'video'
              ? { url: uploadedUrl, alt: resolvedAlt, mediaType: 'video' }
              : { url: uploadedUrl, alt: resolvedAlt }
          );
        } else {
          const isVideo = draft.mediaType === 'video' || isVideoMediaUrl(draft.url);
          finalImages.push(
            isVideo
              ? { url: draft.url, alt: resolvedAlt, mediaType: 'video' }
              : { url: draft.url, alt: resolvedAlt }
          );
        }
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
          imageUrl: finalImages[0].url,
          imageAlt: finalImages[0].alt,
          images: finalImages,
        }),
      });

      if (res.status === 401) {
        await Promise.all(newlyUploadedUrls.map((u) => cleanupUploadedUrl(u)));
        handleUnauthorized();
        return;
      }

      const payload = (await res.json().catch(() => ({}))) as {
        memory?: MemoryItem;
        error?: string;
      };

      if (!res.ok || !payload.memory) {
        await Promise.all(newlyUploadedUrls.map((u) => cleanupUploadedUrl(u)));
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

      resetAllAlbumItems();
      setIsMemoryFormOpen(false);
      const summaryLabel = formatAlbumMediaCountVi(finalImages);
      showSuccess(
        memoryForm.id
          ? `Đã cập nhật album kỷ niệm (${summaryLabel}).`
          : `Đã thêm album kỷ niệm mới (${summaryLabel}).`
      );
    } catch (err) {
      await Promise.all(newlyUploadedUrls.map((u) => cleanupUploadedUrl(u)));
      if (err instanceof UploadAuthError) {
        handleUnauthorized();
        return;
      }
      const message = err instanceof Error ? err.message : 'Có lỗi xảy ra khi lưu kỷ niệm.';
      showError(message);
    } finally {
      setSavingMemory(false);
      setUploadProgressText(null);
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
        resetAllAlbumItems();
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
          musicUrl: finalMusicUrl || '/samples/gentle-memories.wav',
          musicEnabled: true,
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

  const pendingFileItems = albumItems.filter(
    (item): item is Extract<AlbumDraftItem, { kind: 'file' }> => item.kind === 'file'
  );
  const hasPendingVideo = pendingFileItems.some((item) => item.mediaType === 'video');
  const coverDraftItem = albumItems[0] ?? null;
  const activeImagePreview = coverDraftItem
    ? coverDraftItem.kind === 'file'
      ? coverDraftItem.previewUrl
      : coverDraftItem.url
    : memoryForm.imageUrl.trim();
  const isActivePreviewVideo = coverDraftItem
    ? coverDraftItem.mediaType === 'video'
    : isVideoMediaUrl(memoryForm.imageUrl.trim());
  const activeAudioPreview = audioPreviewUrl || settingsForm.musicUrl.trim();

  return (
    <div className="min-h-[100dvh] overflow-x-hidden px-3 pb-24 pt-[calc(1rem+env(safe-area-inset-top))] sm:px-6 sm:pt-6 lg:px-8">
      <div className="mx-auto max-w-5xl space-y-5 sm:space-y-6">
        {/* Top bar */}
        <header className="glass-card flex flex-col gap-4 rounded-3xl p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
          <div className="min-w-0 space-y-1.5">
            <div className="flex flex-wrap items-center gap-2 sm:gap-2.5">
              <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl border border-amber-300/80 bg-red-50 text-red-500 shadow-[0_6px_18px_rgba(220,38,38,0.14)]">
                <Heart className="h-4 w-4 fill-red-500 text-red-500" />
              </span>
              <h1 className="font-serif text-xl font-semibold text-stone-900 sm:text-2xl">
                Quản trị kỷ niệm
              </h1>
              {currentUser ? (
                <span className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-amber-300/80 bg-amber-100/80 px-3 py-1 text-xs font-medium text-stone-800">
                  <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-red-600" />
                  <span className="truncate">{currentUser.displayName || currentUser.username}</span>
                </span>
              ) : null}
              {storageStatus.mode === 'supabase' ? (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-300 bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-800">
                  <Cloud className="h-3.5 w-3.5 shrink-0" />
                  Đã kết nối Supabase Cloud
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-300/80 bg-amber-100/75 px-3 py-1 text-xs font-medium text-stone-800">
                  <HardDrive className="h-3.5 w-3.5 shrink-0" />
                  Chế độ lưu cục bộ trên máy
                </span>
              )}
            </div>
            <p className="text-xs text-stone-600">
              Mọi thay đổi được đồng bộ ngay lên trang chính của hai bạn.
            </p>
          </div>

          <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto sm:shrink-0 sm:flex-wrap sm:items-center sm:gap-2.5">
            <Link
              href="/"
              target="_blank"
              rel="noopener noreferrer"
              className={`inline-flex min-h-[42px] items-center justify-center gap-1.5 rounded-2xl px-3.5 py-2 text-xs font-medium sm:min-h-[36px] sm:px-4 sm:text-sm ${ADMIN_SECONDARY_BTN_CLASS}`}
            >
              Xem trang chính
              <ExternalLink className="h-3.5 w-3.5" />
            </Link>
            <button
              type="button"
              onClick={handleLogout}
              className="inline-flex min-h-[42px] items-center justify-center gap-1.5 rounded-2xl border border-red-300/80 bg-red-50 px-3.5 py-2 text-xs font-medium text-red-700 transition hover:border-red-400 hover:bg-red-100 hover:text-red-800 sm:min-h-[36px] sm:px-4 sm:text-sm"
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
            className="flex items-start gap-3 rounded-2xl border border-amber-400/80 bg-amber-100/85 p-4 text-sm text-amber-950"
          >
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" />
            <div className="min-w-0 space-y-1">
              <p className="font-semibold">
                Cảnh báo môi trường serverless chưa kết nối Supabase Cloud
              </p>
              <p className="text-xs leading-relaxed text-amber-900">
                Hệ thống file trên Vercel là chỉ đọc. Vui lòng thiết lập{' '}
                <code className="rounded bg-amber-200/80 px-1 py-0.5 text-amber-950">
                  NEXT_PUBLIC_SUPABASE_URL
                </code>{' '}
                và{' '}
                <code className="rounded bg-amber-200/80 px-1 py-0.5 text-amber-950">
                  SUPABASE_SERVICE_ROLE_KEY
                </code>{' '}
                (sau khi chạy{' '}
                <code className="rounded bg-amber-200/80 px-1 py-0.5 text-amber-950">
                  supabase/schema.sql
                </code>
                ) để tải ảnh và lưu dữ liệu trực tuyến.
              </p>
            </div>
          </div>
        ) : null}

        {storageStatus.usingDefaultAdminPassword || storageStatus.usingDefaultSessionSecret ? (
          <div className="flex items-center gap-2.5 rounded-2xl border border-amber-400/80 bg-amber-100/75 px-4 py-3 text-xs text-amber-900">
            <Lock className="h-4 w-4 shrink-0 text-amber-700" />
            <span>
              Chế độ phát triển đang dùng cấu hình bảo mật mặc định. Hãy đặt{' '}
              <code className="rounded bg-amber-200/80 px-1 py-0.5 text-amber-950">ADMIN_PASSWORD</code>{' '}
              và{' '}
              <code className="rounded bg-amber-200/80 px-1 py-0.5 text-amber-950">
                ADMIN_SESSION_SECRET
              </code>{' '}
              trong biến môi trường trước khi triển khai công khai.
            </span>
          </div>
        ) : null}

        {/* Navigation Tabs: Sticky 1-Row Scrollable Strip on Mobile, Wrapping Pill Deck on md+ */}
        <div className="sticky top-2 z-30 md:static">
        <nav
          ref={tabStripRef}
          onScroll={updateTabStripOverflow}
          aria-label="Mục quản trị"
          className="glass-card no-scrollbar flex flex-nowrap items-center gap-1.5 overflow-x-auto overscroll-x-contain rounded-2xl p-1.5 shadow-[0_10px_28px_rgba(120,53,15,0.08)] sm:gap-2 md:flex-wrap md:p-2"
        >
          {(
            [
              {
                id: 'memories',
                label: `Kỷ niệm & Ảnh (${memories.length})`,
                icon: <ImagePlus className="h-4 w-4 shrink-0" />,
              },
              {
                id: 'diary',
                label: `Nhật ký mỗi ngày (${diaryCount})`,
                icon: <BookOpen className="h-4 w-4 shrink-0" />,
              },
              {
                id: 'settings',
                label: 'Mở đầu, Nhạc nền & Riêng tư',
                icon: <SlidersHorizontal className="h-4 w-4 shrink-0" />,
              },
              {
                id: 'letter',
                label: 'Phong thư tâm sự',
                icon: <Mail className="h-4 w-4 shrink-0" />,
              },
              {
                id: 'users',
                label: `Tài khoản & Kiểm soát truy cập (${users.length})`,
                icon: <Users className="h-4 w-4 shrink-0" />,
              },
              {
                id: 'activity',
                label: 'Nhật ký ra vào & Hành động',
                icon: <Activity className="h-4 w-4 shrink-0" />,
              },
            ] as const
          ).map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                ref={(el) => {
                  tabButtonRefs.current[tab.id] = el;
                }}
                type="button"
                aria-current={isActive ? 'page' : undefined}
                onClick={() => {
                  setActiveTab(tab.id);
                  setNotice(null);
                }}
                className={`inline-flex min-h-[44px] shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-xl px-3.5 py-2 text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 sm:min-h-[42px] sm:px-4 sm:py-2.5 sm:text-sm ${
                  isActive
                    ? ADMIN_PRIMARY_CTA_CLASS
                    : 'text-stone-700 hover:bg-amber-100/80 hover:text-stone-950'
                }`}
              >
                {tab.icon}
                <span>{tab.label}</span>
              </button>
            );
          })}
        </nav>
        {tabStripHasMoreRight ? (
          <div
            aria-hidden="true"
            data-testid="admin-tabs-more-indicator"
            className="pointer-events-none absolute inset-y-px right-px flex w-12 items-center justify-end rounded-r-2xl bg-gradient-to-l from-[#FFFBEB] via-[#FFFBEB]/85 to-transparent pr-1.5 md:hidden"
          >
            <ChevronRight className="h-4 w-4 text-red-600" />
          </div>
        ) : null}
        </div>

        {/* Tab 1: Memories */}
        {activeTab === 'memories' ? (
          <section className="space-y-6">
            <div
              data-testid="memories-quick-dropzone"
              {...createMultiFileDropHandlers('quick', setIsDraggingQuickMemory, (files) =>
                applyMemoryImageFiles(files, true)
              )}
              className={`glass-card flex flex-wrap items-center justify-between gap-3 rounded-3xl border p-5 transition ${isDraggingQuickMemory
                ? 'border-red-500 bg-amber-100/70 ring-2 ring-red-500/35'
                : 'border-transparent'
                }`}
            >
              <div className="min-w-0">
                <h2 className="text-lg font-semibold text-stone-900">Dòng thời gian kỷ niệm</h2>
                <p className="text-xs text-stone-600">
                  {isDraggingQuickMemory
                    ? 'Thả ảnh hoặc video vào đây để mở nhanh khung tạo album mới.'
                    : 'Chọn hoặc kéo thả 1 hay nhiều ảnh / video cùng lúc vào đây để tạo album kỷ niệm.'}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2.5 sm:shrink-0">
                {memories.length > 1 ? (
                  <button
                    type="button"
                    disabled={reordering}
                    onClick={handleSortByDate}
                    className={`inline-flex min-h-[36px] items-center gap-1.5 rounded-2xl px-3.5 py-2 text-xs font-medium disabled:opacity-50 ${ADMIN_SECONDARY_BTN_CLASS}`}
                  >
                    <CalendarHeart className="h-3.5 w-3.5 text-red-500" />
                    Sắp xếp theo ngày tăng dần
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={openNewMemoryForm}
                  className={`inline-flex min-h-[40px] items-center gap-1.5 rounded-2xl px-4 py-2 text-sm font-semibold ${ADMIN_PRIMARY_CTA_CLASS}`}
                >
                  <Plus className="h-4 w-4" />
                  Thêm kỷ niệm mới
                </button>
              </div>
            </div>

            {isMemoryFormOpen ? (
              <div ref={memoryFormRef} className="glass-card rounded-3xl p-4 shadow-glass sm:p-6">
                <div className="mb-5 flex items-center justify-between">
                  <h3 className="font-serif text-2xl font-semibold text-stone-900">
                    {memoryForm.id ? 'Chỉnh sửa kỷ niệm' : 'Thêm kỷ niệm mới'}
                  </h3>
                  <button
                    type="button"
                    onClick={() => {
                      resetAllAlbumItems();
                      setIsMemoryFormOpen(false);
                    }}
                    className={`inline-flex min-h-[36px] items-center rounded-xl px-3 py-1.5 text-sm font-medium ${ADMIN_SECONDARY_BTN_CLASS}`}
                  >
                    Huỷ
                  </button>
                </div>

                <form
                  onSubmit={handleSaveMemory}
                  onPaste={handleMemoryFormPaste}
                  className="grid gap-6 md:grid-cols-[1.15fr_0.85fr]"
                >
                  <div className="min-w-0 space-y-4">
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="min-w-0">
                        <label
                          htmlFor="memory-date"
                          className="mb-1.5 block text-sm font-medium text-stone-800"
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
                          className={`${ADMIN_INPUT_CLASS} [color-scheme:light]`}
                        />
                      </div>

                      <div className="min-w-0">
                        <label
                          htmlFor="memory-title"
                          className="mb-1.5 block text-sm font-medium text-stone-800"
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
                          className={ADMIN_INPUT_CLASS}
                        />
                      </div>
                    </div>

                    <div>
                      <label
                        htmlFor="memory-story"
                        className="mb-1.5 block text-sm font-medium text-stone-800"
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
                        className={`${ADMIN_INPUT_CLASS} leading-relaxed`}
                      />
                    </div>

                    <div>
                      <label
                        htmlFor="memory-image-url"
                        className="mb-1.5 block text-sm font-medium text-stone-800"
                      >
                        Đường dẫn ảnh / video (hoặc chọn tệp bên phải)
                      </label>
                      <div className="flex flex-col gap-2 sm:flex-row">
                        <input
                          id="memory-image-url"
                          type="text"
                          value={memoryForm.imageUrl}
                          onChange={(e) => {
                            if (memoryFileInputRef.current) {
                              memoryFileInputRef.current.value = '';
                            }
                            setMemoryForm((prev) => ({ ...prev, imageUrl: e.target.value }));
                          }}
                          placeholder="/samples/memory-1.svg hoặc https://... (.mp4, .jpg)"
                          className={ADMIN_INPUT_CLASS}
                        />
                        <button
                          type="button"
                          onClick={handleAddUrlToAlbum}
                          className={`inline-flex min-h-[40px] shrink-0 items-center justify-center gap-1 rounded-2xl px-3.5 py-2 text-xs font-medium ${ADMIN_SECONDARY_BTN_CLASS}`}
                        >
                          <Plus className="h-3.5 w-3.5 shrink-0" />
                          <span>Thêm URL</span>
                        </button>
                      </div>
                    </div>

                    <div>
                      <label
                        htmlFor="memory-alt"
                        className="mb-1.5 block text-sm font-medium text-stone-800"
                      >
                        Mô tả ảnh bìa (tuỳ chọn)
                      </label>
                      <input
                        id="memory-alt"
                        type="text"
                        value={memoryForm.imageAlt}
                        onChange={(e) => {
                          const nextAlt = e.target.value;
                          setMemoryForm((prev) => ({ ...prev, imageAlt: nextAlt }));
                          setAlbumItems((prev) =>
                            prev.length > 0
                              ? prev.map((item, idx) =>
                                idx === 0 ? { ...item, alt: nextAlt } : item
                              )
                              : prev
                          );
                        }}
                        placeholder="Mặc định dùng tiêu đề kỷ niệm"
                        className={ADMIN_INPUT_CLASS}
                      />
                    </div>
                  </div>

                  <div
                    data-testid="memory-image-dropzone"
                    {...createMultiFileDropHandlers('memory', setIsDraggingMemoryImage, (files) =>
                      applyMemoryImageFiles(files)
                    )}
                    className={`flex min-w-0 flex-col justify-between gap-4 rounded-2xl border border-dashed p-4 transition ${isDraggingMemoryImage
                      ? 'border-red-500 bg-amber-100/70 ring-2 ring-red-500/35'
                      : 'border-amber-300/80 bg-amber-50/75'
                      }`}
                  >
                    <div className="min-w-0 space-y-3">
                      <label
                        htmlFor="memory-file-upload"
                        className="flex min-w-0 max-w-full cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border border-amber-300/80 bg-[#FFFDF5]/90 px-4 py-5 text-center transition focus-within:border-red-500 focus-within:ring-2 focus-within:ring-red-500/30 hover:border-red-400 hover:bg-amber-100/65"
                      >
                        <Upload className="h-6 w-6 text-red-500" />
                        <span className="max-w-full break-words text-sm font-semibold text-stone-900">
                          {isDraggingMemoryImage
                            ? 'Thả ảnh hoặc video vào đây để xem trước'
                            : pendingFileItems.length > 0
                              ? `Đã chọn ${pendingFileItems.length} tệp mới (kéo thêm hoặc thả để nối tiếp)`
                              : 'Kéo thả ảnh hoặc video vào đây để chọn'}
                        </span>
                        <span className="text-xs text-stone-600">
                          Ảnh (10MB) &amp; Video MP4/WebM/MOV (100MB) • {albumItems.length}/{MAX_ALBUM_IMAGES} mục • Ctrl+V
                        </span>
                        <input
                          ref={memoryFileInputRef}
                          id="memory-file-upload"
                          type="file"
                          multiple
                          accept={VISUAL_MEDIA_ACCEPT}
                          className="sr-only"
                          onChange={(e) => {
                            const selected = Array.from(e.target.files ?? []);
                            if (selected.length === 0) return;
                            if (!applyMemoryImageFiles(selected)) {
                              e.target.value = '';
                            }
                          }}
                        />
                      </label>

                      {pendingFileItems.length > 0 ? (
                        <button
                          type="button"
                          onClick={clearMemoryFilePreview}
                          className={`inline-flex min-h-[36px] w-full items-center justify-center rounded-xl px-3 py-1.5 text-xs font-medium ${ADMIN_SECONDARY_BTN_CLASS}`}
                        >
                          {hasPendingVideo ? 'Bỏ tệp vừa chọn' : 'Bỏ ảnh vừa chọn'}
                        </button>
                      ) : null}

                      {activeImagePreview ? (
                        <div className="overflow-hidden rounded-2xl border border-amber-300/70 bg-[#FEF9C3]/55 p-2">
                          {isActivePreviewVideo ? (
                            <video
                              src={activeImagePreview}
                              controls
                              playsInline
                              preload="metadata"
                              aria-label={memoryForm.imageAlt || memoryForm.title || 'Xem trước video'}
                              className="mx-auto max-h-56 w-auto max-w-full rounded-xl object-contain"
                            />
                          ) : (
                            <img
                              src={activeImagePreview}
                              alt={memoryForm.imageAlt || memoryForm.title || 'Xem trước ảnh'}
                              className="mx-auto max-h-56 w-auto max-w-full rounded-xl object-contain"
                            />
                          )}
                        </div>
                      ) : (
                        <p className="py-6 text-center text-xs text-stone-600">
                          Chưa có ảnh hoặc video xem trước
                        </p>
                      )}

                      {albumItems.length > 0 ? (
                        <div data-testid="memory-album-grid" className="space-y-2 pt-1">
                          <div className="flex items-center justify-between text-xs text-stone-700">
                            <span className="font-semibold">
                              Bộ ảnh &amp; video ({albumItems.length}/{MAX_ALBUM_IMAGES})
                            </span>
                            <span>Mục #1 làm ảnh bìa</span>
                          </div>
                          <div className="grid max-h-64 grid-cols-1 gap-2 overflow-y-auto pr-1 sm:grid-cols-2">
                            {albumItems.map((albumItem, idx) => {
                              const thumbSrc =
                                albumItem.kind === 'file' ? albumItem.previewUrl : albumItem.url;
                              const labelName =
                                albumItem.kind === 'file'
                                  ? albumItem.file.name
                                  : albumItem.url.split('/').pop() || albumItem.url;
                              const isVideoItem = albumItem.mediaType === 'video';

                              return (
                                <div
                                  key={albumItem.id}
                                  className={`flex flex-col gap-2 rounded-2xl border p-2.5 ${idx === 0
                                    ? 'border-red-400 bg-red-50/75'
                                    : 'border-amber-300/80 bg-[#FFFDF5]/95'
                                    }`}
                                >
                                  <div className="flex items-start gap-2.5">
                                    {isVideoItem ? (
                                      <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl border border-amber-300/70 bg-[#FEF9C3]/60">
                                        <video
                                          src={thumbSrc}
                                          muted
                                          playsInline
                                          preload="metadata"
                                          aria-label={`Video thu nhỏ ${idx + 1}`}
                                          className="h-full w-full object-cover"
                                        />
                                        <span
                                          aria-hidden="true"
                                          className="pointer-events-none absolute inset-0 flex items-center justify-center bg-stone-950/35"
                                        >
                                          <Play className="h-4 w-4 fill-white text-white" />
                                        </span>
                                      </div>
                                    ) : (
                                      /* eslint-disable-next-line @next/next/no-img-element */
                                      <img
                                        src={thumbSrc}
                                        alt={`Ảnh thu nhỏ ${idx + 1}`}
                                        className="h-14 w-14 shrink-0 rounded-xl border border-amber-300/70 bg-[#FEF9C3]/60 object-cover"
                                      />
                                    )}
                                    <div className="min-w-0 flex-1 space-y-1">
                                      <div className="flex items-center justify-between gap-1">
                                        {idx === 0 ? (
                                          <span className="inline-flex items-center gap-1 rounded-full bg-red-600 px-2 py-0.5 text-[10px] font-semibold text-white">
                                            <Star className="h-2.5 w-2.5 fill-current" />
                                            <span>{isVideoItem ? 'Video bìa' : 'Ảnh bìa'}</span>
                                          </span>
                                        ) : (
                                          <span className="text-[11px] font-semibold text-stone-600">
                                            #{idx + 1}
                                          </span>
                                        )}
                                        <button
                                          type="button"
                                          aria-label={
                                            isVideoItem
                                              ? `Xoá video thứ ${idx + 1}`
                                              : `Xoá ảnh thứ ${idx + 1}`
                                          }
                                          onClick={() => removeAlbumItem(idx)}
                                          className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-red-300/80 bg-red-50 text-red-700 transition hover:border-red-400 hover:bg-red-100 hover:text-red-800"
                                        >
                                          <X className="h-3.5 w-3.5" />
                                        </button>
                                      </div>
                                      <p className="truncate text-[11px] font-medium text-stone-800">
                                        {labelName}
                                      </p>
                                    </div>
                                  </div>

                                  <input
                                    type="text"
                                    aria-label={
                                      isVideoItem
                                        ? `Chú thích video thứ ${idx + 1}`
                                        : `Chú thích ảnh thứ ${idx + 1}`
                                    }
                                    placeholder="Chú thích riêng (tuỳ chọn)"
                                    value={albumItem.alt}
                                    onChange={(e) => updateAlbumItemAlt(idx, e.target.value)}
                                    className={ADMIN_COMPACT_INPUT_CLASS}
                                  />

                                  <div className="flex flex-wrap items-center justify-between gap-1">
                                    <div className="flex items-center gap-1">
                                      <button
                                        type="button"
                                        aria-label={`Dịch mục thứ ${idx + 1} lên`}
                                        disabled={idx === 0}
                                        onClick={() => moveAlbumItem(idx, -1)}
                                        className={`inline-flex h-7 w-7 items-center justify-center rounded-lg disabled:opacity-35 ${ADMIN_SECONDARY_BTN_CLASS}`}
                                      >
                                        <ChevronLeft className="h-3.5 w-3.5" />
                                      </button>
                                      <button
                                        type="button"
                                        aria-label={`Dịch mục thứ ${idx + 1} xuống`}
                                        disabled={idx === albumItems.length - 1}
                                        onClick={() => moveAlbumItem(idx, 1)}
                                        className={`inline-flex h-7 w-7 items-center justify-center rounded-lg disabled:opacity-35 ${ADMIN_SECONDARY_BTN_CLASS}`}
                                      >
                                        <ChevronRight className="h-3.5 w-3.5" />
                                      </button>
                                    </div>
                                    {idx > 0 ? (
                                      <button
                                        type="button"
                                        onClick={() => setAlbumItemAsCover(idx)}
                                        className={`inline-flex min-h-[28px] items-center rounded-lg px-2 py-1 text-[11px] font-medium ${ADMIN_SECONDARY_BTN_CLASS}`}
                                      >
                                        Đặt làm bìa
                                      </button>
                                    ) : null}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ) : null}
                    </div>

                    <button
                      type="submit"
                      disabled={savingMemory}
                      className={`min-h-[36px] w-full rounded-2xl px-5 py-3 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60 ${ADMIN_PRIMARY_CTA_CLASS}`}
                    >
                      {savingMemory
                        ? uploadProgressText || 'Đang tải lên & lưu...'
                        : memoryForm.id
                          ? 'Lưu thay đổi'
                          : 'Thêm vào dòng thời gian'}
                    </button>
                  </div>
                </form>
              </div>
            ) : null}

            {memories.length === 0 ? (
              <div className="glass-card rounded-3xl p-10 text-center text-sm text-stone-600">
                Chưa có kỷ niệm nào. Nhấn &ldquo;Thêm kỷ niệm mới&rdquo; để bắt đầu câu chuyện của hai bạn.
              </div>
            ) : (
              <div className="space-y-4">
                {memories.map((item, index) => {
                  const albumItemsList = getMemoryImages(item);
                  const coverIsVideo = albumItemsList[0]
                    ? isVideoMediaItem(albumItemsList[0])
                    : isVideoMediaUrl(item.imageUrl);
                  return (
                    <article
                      key={item.id}
                      className="glass-card flex flex-col gap-4 rounded-3xl p-4 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="flex min-w-0 items-start gap-4">
                        {coverIsVideo ? (
                          <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-2xl border border-amber-300/70 bg-[#FEF9C3]/60 shadow-sm">
                            <video
                              src={item.imageUrl}
                              muted
                              playsInline
                              preload="metadata"
                              aria-label={item.imageAlt || item.title || 'Video kỷ niệm'}
                              className="h-full w-full object-cover"
                            />
                            <span
                              aria-hidden="true"
                              className="pointer-events-none absolute inset-0 flex items-center justify-center bg-stone-950/35"
                            >
                              <Play className="h-5 w-5 fill-white text-white" />
                            </span>
                          </div>
                        ) : (
                          <img
                            src={item.imageUrl}
                            alt={item.imageAlt || item.title || 'Ảnh kỷ niệm'}
                            className="h-24 w-24 shrink-0 rounded-2xl border border-amber-300/70 bg-[#FEF9C3]/60 object-cover shadow-sm"
                          />
                        )}
                        <div className="min-w-0 space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="rounded-full border border-amber-300/80 bg-amber-100/85 px-2.5 py-0.5 text-xs font-semibold text-stone-800">
                              {formatMemoryDateVi(item.memoryDate)}
                            </span>
                            <span className="inline-flex items-center gap-1 rounded-full border border-red-200 bg-red-50 px-2.5 py-0.5 text-xs font-semibold text-red-700">
                              <Images className="h-3 w-3 shrink-0" />
                              <span>{formatAlbumMediaCountVi(albumItemsList)}</span>
                            </span>
                            <span className="text-xs text-stone-500">#{index + 1}</span>
                          </div>
                          <h3 className="truncate font-serif text-xl font-semibold text-stone-900">
                            {item.title || 'Khoảnh khắc bình yên'}
                          </h3>
                          <p className="line-clamp-2 break-words [overflow-wrap:anywhere] text-sm text-stone-700">
                            {item.story}
                          </p>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 sm:shrink-0">
                        <Link
                          href={`/memories/${item.id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={`inline-flex min-h-[36px] items-center gap-1 rounded-xl px-3 py-2 text-xs font-medium ${ADMIN_SECONDARY_BTN_CLASS}`}
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                          <span>Xem album</span>
                        </Link>
                        <button
                          type="button"
                          aria-label="Di chuyển lên"
                          disabled={index === 0 || reordering}
                          onClick={() => handleMoveMemory(index, -1)}
                          className={`inline-flex h-9 w-9 items-center justify-center rounded-xl disabled:opacity-35 ${ADMIN_SECONDARY_BTN_CLASS}`}
                        >
                          <ArrowUp className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          aria-label="Di chuyển xuống"
                          disabled={index === memories.length - 1 || reordering}
                          onClick={() => handleMoveMemory(index, 1)}
                          className={`inline-flex h-9 w-9 items-center justify-center rounded-xl disabled:opacity-35 ${ADMIN_SECONDARY_BTN_CLASS}`}
                        >
                          <ArrowDown className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => openEditMemoryForm(item)}
                          className={`inline-flex min-h-[36px] items-center gap-1 rounded-xl px-3 py-2 text-xs font-medium ${ADMIN_SECONDARY_BTN_CLASS}`}
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
                              className="inline-flex min-h-[36px] items-center rounded-xl bg-red-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              {deletingMemoryId === item.id ? 'Đang xoá...' : 'Xác nhận xoá'}
                            </button>
                            <button
                              type="button"
                              disabled={deletingMemoryId === item.id}
                              onClick={() => setConfirmDeleteId(null)}
                              className={`inline-flex min-h-[36px] items-center rounded-xl px-2.5 py-2 text-xs disabled:opacity-60 ${ADMIN_SECONDARY_BTN_CLASS}`}
                            >
                              Huỷ
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteId(item.id)}
                            className="inline-flex min-h-[36px] items-center gap-1 rounded-xl border border-red-300/80 bg-red-50 px-3 py-2 text-xs font-medium text-red-700 transition hover:border-red-400 hover:bg-red-100 hover:text-red-800"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            Xoá
                          </button>
                        )}
                      </div>
                    </article>
                  );
                })}
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
              <h2 className="text-lg font-semibold text-stone-900">
                Thông tin mở đầu, Nhạc nền &amp; Quyền riêng tư
              </h2>
              <p className="text-xs text-stone-600">
                Tuỳ chỉnh lời chào đầu trang, số ngày bên nhau, bản nhạc nền và chế độ bảo vệ đăng
                nhập 2 bước nếu cần.
              </p>
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              <div className="min-w-0">
                <label
                  htmlFor="couple-title"
                  className="mb-1.5 block text-sm font-medium text-stone-800"
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
                  className={ADMIN_INPUT_CLASS}
                />
              </div>

              <div className="min-w-0">
                <label
                  htmlFor="love-start-date"
                  className="mb-1.5 block text-sm font-medium text-stone-800"
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
                  className={`${ADMIN_INPUT_CLASS} [color-scheme:light]`}
                />
                <p className="mt-1.5 text-xs text-stone-600">
                  Tính theo múi giờ Việt Nam (UTC+7): hiện tại là{' '}
                  <strong className="text-red-700">{liveDaysTogether} ngày</strong> bên nhau.
                </p>
              </div>
            </div>

            <div>
              <label
                htmlFor="hero-subtitle"
                className="mb-1.5 block text-sm font-medium text-stone-800"
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
                className={ADMIN_INPUT_CLASS}
              />
            </div>

            {/* Ambient music block */}
            <div
              data-testid="audio-file-dropzone"
              {...createFileDropHandlers('audio', setIsDraggingAudio, (file) =>
                applyAudioFile(file)
              )}
              className={`space-y-4 rounded-2xl border p-3 transition sm:p-4 ${isDraggingAudio
                ? 'border-red-500 bg-amber-100/70 ring-2 ring-red-500/35'
                : 'border-amber-300/80 bg-amber-50/75'
                }`}
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Music className="h-4 w-4 text-red-500" />
                  <span className="text-sm font-semibold text-stone-900">
                    {isDraggingAudio ? 'Thả file nhạc vào đây' : 'Nhạc nền nhẹ nhàng'}
                  </span>
                </div>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-red-200 bg-red-50 px-3 py-1 text-xs font-semibold text-red-800">
                  <Volume2 aria-hidden="true" className="h-3.5 w-3.5 shrink-0 text-red-600" />
                  <span>Luôn phát tự động mặc định</span>
                </span>
              </div>

              <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,auto)]">
                <div className="min-w-0">
                  <label htmlFor="settings-music-url" className="sr-only">
                    Đường dẫn nhạc nền
                  </label>
                  <input
                    id="settings-music-url"
                    type="text"
                    value={settingsForm.musicUrl}
                    onChange={(e) => {
                      clearAudioFilePreview();
                      setSettingsForm((prev) => ({ ...prev, musicUrl: e.target.value }));
                    }}
                    placeholder="/samples/gentle-memories.wav hoặc https://..."
                    className={ADMIN_INPUT_CLASS}
                  />
                </div>
                <div className="flex min-w-0 flex-wrap gap-2">
                  <label className="inline-flex min-h-[36px] min-w-0 max-w-full cursor-pointer items-center gap-1.5 rounded-2xl border border-amber-300/80 bg-[#FFFDF5] px-3.5 py-2.5 text-xs font-semibold text-stone-800 transition focus-within:border-red-500 focus-within:ring-2 focus-within:ring-red-500/30 hover:border-amber-400 hover:bg-amber-100/75">
                    <Upload className="h-3.5 w-3.5 shrink-0" />
                    <span className="min-w-0 max-w-full truncate sm:max-w-[220px]">
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
                        if (!applyAudioFile(file)) {
                          e.target.value = '';
                        }
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
                    className={`inline-flex min-h-[36px] items-center rounded-2xl px-3 py-2.5 text-xs font-medium ${ADMIN_SECONDARY_BTN_CLASS}`}
                  >
                    Dùng nhạc mẫu
                  </button>
                </div>
              </div>

              {activeAudioPreview ? (
                <audio controls src={activeAudioPreview} className="mt-2 w-full min-w-0 max-w-full" />
              ) : null}
            </div>

            {/* Viewer access gate toggle + Tab 4 link */}
            <div className="space-y-3 rounded-2xl border border-amber-300/80 bg-amber-50/75 p-3 sm:p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Lock className="h-4 w-4 shrink-0 text-red-500" />
                  <span className="text-sm font-semibold text-stone-900">
                    Cổng đăng nhập riêng tư cho trang chính
                  </span>
                </div>
                <label className="inline-flex min-h-[36px] cursor-pointer items-center gap-2 py-1 text-sm font-medium text-stone-800">
                  <input
                    type="checkbox"
                    checked={settingsForm.viewerPasscodeEnabled}
                    onChange={(e) =>
                      setSettingsForm((prev) => ({
                        ...prev,
                        viewerPasscodeEnabled: e.target.checked,
                      }))
                    }
                    className={ADMIN_CHECKBOX_CLASS}
                  />
                  <span>Khoá bảo vệ trang kỷ niệm (Đăng nhập + OTP 6 số)</span>
                </label>
              </div>

              <div className="flex flex-col gap-3 rounded-xl border border-amber-300/80 bg-[#FFFDF5]/95 p-3.5 sm:flex-row sm:items-center sm:justify-between">
                <p className="min-w-0 text-xs leading-relaxed text-stone-700">
                  Khi bật khoá bảo vệ, người xem tại{' '}
                  <code className="rounded bg-amber-100 px-1 py-0.5 text-stone-900">/</code> phải
                  đăng nhập bằng tài khoản riêng và xác thực mã OTP 6 chữ số trước khi ngắm trái tim
                  pixel và đọc tâm thư.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab('users');
                    setNotice(null);
                  }}
                  className="inline-flex min-h-[36px] shrink-0 items-center justify-center rounded-xl border border-amber-300/80 bg-amber-100/80 px-3.5 py-2 text-xs font-semibold text-stone-800 shadow-sm transition hover:border-amber-400 hover:bg-amber-200/80 hover:text-stone-950"
                >
                  Đi tới quản lý tài khoản &amp; OTP →
                </button>
              </div>
            </div>

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={savingSettings}
                className={`min-h-[36px] rounded-2xl px-6 py-3 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60 ${ADMIN_PRIMARY_CTA_CLASS}`}
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
                <h2 className="text-lg font-semibold text-stone-900">Soạn bức tâm thư</h2>
                <p className="text-xs text-stone-600">
                  Tách các đoạn bằng một dòng trống để lá thư hiển thị thoáng và giàu cảm xúc hơn.
                </p>
              </div>

              <div>
                <label
                  htmlFor="letter-title"
                  className="mb-1.5 block text-sm font-medium text-stone-800"
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
                  className={ADMIN_INPUT_CLASS}
                />
              </div>

              <div>
                <label
                  htmlFor="letter-body"
                  className="mb-1.5 block text-sm font-medium text-stone-800"
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
                  className={`${ADMIN_INPUT_CLASS} leading-relaxed`}
                />
              </div>

              <div>
                <label
                  htmlFor="letter-signature"
                  className="mb-1.5 block text-sm font-medium text-stone-800"
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
                  className={`${ADMIN_INPUT_CLASS} leading-relaxed`}
                />
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  disabled={savingSettings}
                  className={`min-h-[36px] rounded-2xl px-6 py-3 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60 ${ADMIN_PRIMARY_CTA_CLASS}`}
                >
                  {savingSettings ? 'Đang lưu...' : 'Lưu tâm thư'}
                </button>
              </div>
            </form>

            {/* Live Preview */}
            <aside className="glass-card flex min-w-0 flex-col justify-between rounded-3xl p-4 shadow-glass sm:p-7">
              <div>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-300/80 bg-amber-100/85 px-3 py-1 text-xs font-medium text-red-700">
                  Xem trước giao diện thư
                </span>
                <div className="mt-5 rounded-2xl border border-amber-300/80 bg-[#FFFDF5] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.8),0_10px_28px_rgba(217,119,6,0.1)] sm:p-8">
                  <h3 className="break-words [overflow-wrap:anywhere] font-serif text-3xl font-semibold text-stone-900">
                    {settingsForm.letterTitle || 'Tiêu đề bức thư'}
                  </h3>
                  <div className="mt-5 space-y-4 font-serif text-lg leading-relaxed text-stone-800">
                    {letterPreviewParagraphs.length > 0 ? (
                      letterPreviewParagraphs.map((paragraph, idx) => (
                        <p key={idx} className="whitespace-pre-line break-words [overflow-wrap:anywhere]">
                          {paragraph}
                        </p>
                      ))
                    ) : (
                      <p className="italic text-stone-500">Nội dung bức thư sẽ hiện ở đây...</p>
                    )}
                  </div>
                  {settingsForm.letterSignature ? (
                    <p className="mt-8 whitespace-pre-line break-words [overflow-wrap:anywhere] text-right font-serif text-xl italic text-red-700">
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
                    <UserPlus className="h-4 w-4 text-red-500" />
                    <h2 className="text-lg font-semibold text-stone-900">Tạo tài khoản mới</h2>
                  </div>
                  <p className="text-xs text-stone-600">
                    Cấp tài khoản riêng cho người thương (chỉ xem{' '}
                    <code className="rounded bg-amber-100 px-1 py-0.5 text-stone-900">/</code>)
                    hoặc thêm quản trị viên mới.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <div className="min-w-0">
                  <label
                    htmlFor="new-user-username"
                    className="mb-1.5 block text-sm font-medium text-stone-800"
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
                    className={ADMIN_INPUT_CLASS}
                  />
                </div>

                <div className="min-w-0">
                  <label
                    htmlFor="new-user-display-name"
                    className="mb-1.5 block text-sm font-medium text-stone-800"
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
                    className={ADMIN_INPUT_CLASS}
                  />
                </div>

                <div className="min-w-0">
                  <label
                    htmlFor="new-user-role"
                    className="mb-1.5 block text-sm font-medium text-stone-800"
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
                    className={ADMIN_INPUT_CLASS}
                  >
                    <option value="viewer" className={ADMIN_OPTION_CLASS}>
                      Người thương (chỉ xem /)
                    </option>
                    <option value="admin" className={ADMIN_OPTION_CLASS}>
                      Quản trị &amp; Xem
                    </option>
                  </select>
                </div>

                <div className="min-w-0">
                  <label
                    htmlFor="new-user-password"
                    className="mb-1.5 block text-sm font-medium text-stone-800"
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
                    className={ADMIN_INPUT_CLASS}
                  />
                </div>

                <div className="min-w-0">
                  <label
                    htmlFor="new-user-otp"
                    className="mb-1.5 block text-sm font-medium text-stone-800"
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
                    className={`${ADMIN_INPUT_CLASS} tracking-widest`}
                  />
                </div>

                <div className="min-w-0">
                  <label
                    htmlFor="new-user-otp-hint"
                    className="mb-1.5 block text-sm font-medium text-stone-800"
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
                    className={ADMIN_INPUT_CLASS}
                  />
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                <label className="inline-flex min-h-[36px] cursor-pointer items-center gap-2 py-1 text-sm text-stone-800">
                  <input
                    id="new-user-active"
                    type="checkbox"
                    checked={createUserForm.isActive}
                    onChange={(e) =>
                      setCreateUserForm((prev) => ({ ...prev, isActive: e.target.checked }))
                    }
                    className={ADMIN_CHECKBOX_CLASS}
                  />
                  Kích hoạt ngay
                </label>

                <button
                  type="submit"
                  disabled={creatingUser}
                  className={`inline-flex min-h-[44px] items-center gap-1.5 rounded-2xl px-5 py-2.5 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60 ${ADMIN_PRIMARY_CTA_CLASS}`}
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
                          <h3 className="min-w-0 max-w-full break-words [overflow-wrap:anywhere] font-serif text-xl font-semibold text-stone-900">
                            {u.displayName}
                          </h3>
                          <span className="max-w-full break-all rounded-full border border-amber-300/80 bg-amber-100/80 px-2.5 py-0.5 text-xs font-medium text-stone-800">
                            @{u.username}
                          </span>
                          <span
                            className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${u.role === 'admin'
                              ? 'border-red-300/80 bg-red-50 text-red-800'
                              : 'border-amber-300/80 bg-amber-100/85 text-amber-900'
                              }`}
                          >
                            {u.role === 'admin' ? 'Quản trị' : 'Người thương'}
                          </span>
                          <span
                            className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${u.isActive
                              ? 'border-emerald-300 bg-emerald-50 text-emerald-800'
                              : 'border-red-300 bg-red-50 text-red-800'
                              }`}
                          >
                            {u.isActive ? 'Đang hoạt động' : 'Đã tạm khoá'}
                          </span>
                          {isSelf ? (
                            <span className="rounded-full border border-amber-400/80 bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-900">
                              Đang đăng nhập
                            </span>
                          ) : null}
                        </div>

                        <div className="flex min-w-0 max-w-full flex-wrap items-center gap-x-4 gap-y-1 text-xs text-stone-600">
                          <span className="inline-flex min-w-0 items-center gap-1">
                            <KeyRound className="h-3.5 w-3.5 shrink-0 text-red-500" />
                            Phiên v{u.sessionVersion}
                          </span>
                          <span className="min-w-0 max-w-full [overflow-wrap:anywhere]">
                            Đăng nhập cuối:{' '}
                            <strong className="font-medium text-stone-900">
                              {formatVietnamDateTime(u.lastLoginAt, 'Chưa từng đăng nhập')}
                            </strong>
                          </span>
                          <span className="min-w-0 max-w-full break-words [overflow-wrap:anywhere]">
                            Gợi ý OTP:{' '}
                            <strong className="font-medium text-stone-900">
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
                          className={`inline-flex min-h-[36px] items-center gap-1 rounded-xl px-3 py-2 text-xs font-medium disabled:opacity-50 ${ADMIN_SECONDARY_BTN_CLASS}`}
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
                          className="inline-flex min-h-[36px] items-center gap-1 rounded-xl border border-amber-300/80 bg-amber-100/75 px-3 py-2 text-xs font-medium text-stone-800 transition hover:border-amber-400 hover:bg-amber-200/80 hover:text-stone-950 disabled:cursor-not-allowed disabled:opacity-45"
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
                          className={`inline-flex min-h-[36px] items-center gap-1 rounded-xl px-3 py-2 text-xs font-medium disabled:cursor-not-allowed disabled:opacity-45 ${ADMIN_SECONDARY_BTN_CLASS}`}
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
                              className="inline-flex min-h-[36px] items-center rounded-xl bg-red-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-red-700 disabled:opacity-50"
                            >
                              Xác nhận xoá
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteUserId(null)}
                              className={`inline-flex min-h-[36px] items-center rounded-xl px-2.5 py-2 text-xs ${ADMIN_SECONDARY_BTN_CLASS}`}
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
                            className="inline-flex min-h-[36px] items-center gap-1 rounded-xl border border-red-300/80 bg-red-50 px-3 py-2 text-xs font-medium text-red-700 transition hover:border-red-400 hover:bg-red-100 hover:text-red-800 disabled:cursor-not-allowed disabled:opacity-45"
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
                        className="space-y-4 rounded-2xl border border-amber-300/80 bg-amber-50/85 p-4"
                      >
                        <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
                          <div className="min-w-0">
                            <label
                              htmlFor={`edit-display-${u.id}`}
                              className="mb-1 block text-xs font-medium text-stone-800"
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
                              className={ADMIN_COMPACT_INPUT_CLASS}
                            />
                          </div>

                          <div className="min-w-0">
                            <label
                              htmlFor={`edit-role-${u.id}`}
                              className="mb-1 block text-xs font-medium text-stone-800"
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
                              className={`${ADMIN_COMPACT_INPUT_CLASS} disabled:bg-amber-100/70 disabled:text-stone-500`}
                            >
                              <option value="viewer" className={ADMIN_OPTION_CLASS}>
                                Người thương (chỉ xem /)
                              </option>
                              <option value="admin" className={ADMIN_OPTION_CLASS}>
                                Quản trị &amp; Xem
                              </option>
                            </select>
                            {roleLockedReason ? (
                              <p className="mt-1 text-[11px] leading-snug text-stone-600 [overflow-wrap:anywhere]">
                                {roleLockedReason}
                              </p>
                            ) : null}
                          </div>

                          <div className="min-w-0">
                            <label
                              htmlFor={`edit-otp-hint-${u.id}`}
                              className="mb-1 block text-xs font-medium text-stone-800"
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
                              className={ADMIN_COMPACT_INPUT_CLASS}
                            />
                          </div>

                          <div className="min-w-0">
                            <label
                              htmlFor={`edit-password-${u.id}`}
                              className="mb-1 block text-xs font-medium text-stone-800"
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
                              className={ADMIN_COMPACT_INPUT_CLASS}
                            />
                          </div>

                          <div className="min-w-0">
                            <label
                              htmlFor={`edit-otp-${u.id}`}
                              className="mb-1 block text-xs font-medium text-stone-800"
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
                              className={`${ADMIN_COMPACT_INPUT_CLASS} tracking-widest`}
                            />
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => setEditingUserId(null)}
                            className={`inline-flex min-h-[36px] items-center rounded-xl px-3.5 py-2 text-xs font-medium ${ADMIN_SECONDARY_BTN_CLASS}`}
                          >
                            Huỷ
                          </button>
                          <button
                            type="submit"
                            disabled={busyUserId === u.id}
                            className={`inline-flex min-h-[36px] items-center rounded-xl px-4 py-2 text-xs font-semibold disabled:opacity-50 ${ADMIN_PRIMARY_CTA_CLASS}`}
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
                className="glass-card min-w-0 rounded-2xl p-4 shadow-glass sm:p-5"
              >
                <p className="text-xs font-medium text-stone-600">Ghé trang hôm nay</p>
                <p className="mt-2 font-serif text-3xl font-bold text-stone-900">
                  {trafficSummary.visitsToday}
                </p>
                <p className="mt-1 text-[11px] text-stone-500">Tính theo giờ Việt Nam</p>
              </div>

              <div
                data-testid="stat-otp-verified"
                className="glass-card min-w-0 rounded-2xl p-4 shadow-glass sm:p-5"
              >
                <p className="text-xs font-medium text-emerald-800">Đã xác thực OTP</p>
                <p className="mt-2 font-serif text-3xl font-bold text-emerald-700">
                  {trafficSummary.otpVerifiedToday}
                </p>
                <p className="mt-1 text-[11px] text-emerald-700/85">Mở khoá thành công hôm nay</p>
              </div>

              <div
                data-testid="stat-failed-auth"
                className="glass-card min-w-0 rounded-2xl p-4 shadow-glass sm:p-5"
              >
                <p className="text-xs font-medium text-red-800">Cảnh báo đăng nhập sai</p>
                <p className="mt-2 font-serif text-3xl font-bold text-red-700">
                  {trafficSummary.failedAuthToday}
                </p>
                <p className="mt-1 text-[11px] text-red-700/85">Sai mật khẩu / OTP hôm nay</p>
              </div>

              <div
                data-testid="stat-active-users"
                className="glass-card min-w-0 rounded-2xl p-4 shadow-glass sm:p-5"
              >
                <p className="text-xs font-medium text-amber-900">Tài khoản hoạt động</p>
                <p className="mt-2 font-serif text-3xl font-bold text-stone-900">
                  {trafficSummary.activeUsersCount}
                </p>
                <p className="mt-1 text-[11px] text-stone-600">Đang được phép truy cập</p>
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
                    className="mb-1 block text-xs font-medium text-stone-800"
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
                    className={ADMIN_COMPACT_INPUT_CLASS}
                  >
                    <option value="" className={ADMIN_OPTION_CLASS}>
                      Tất cả
                    </option>
                    {ACTIVITY_EVENT_OPTIONS.map(([eventType, meta]) => (
                      <option key={eventType} value={eventType} className={ADMIN_OPTION_CLASS}>
                        {meta.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="min-w-0">
                  <label
                    htmlFor="activity-user-filter"
                    className="mb-1 block text-xs font-medium text-stone-800"
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
                    className={ADMIN_COMPACT_INPUT_CLASS}
                  >
                    <option value="" className={ADMIN_OPTION_CLASS}>
                      Tất cả tài khoản
                    </option>
                    <option value="khach" className={ADMIN_OPTION_CLASS}>
                      Khách ghé trang
                    </option>
                    {users.map((u) => (
                      <option key={u.id} value={u.username} className={ADMIN_OPTION_CLASS}>
                        {u.displayName} (@{u.username})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="min-w-0">
                  <label
                    htmlFor="activity-search"
                    className="mb-1 block text-xs font-medium text-stone-800"
                  >
                    Tìm kiếm nhật ký
                  </label>
                  <div className="relative min-w-0">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-stone-500" />
                    <input
                      id="activity-search"
                      type="text"
                      value={activitySearch}
                      onChange={(e) => setActivitySearch(e.target.value)}
                      placeholder="Chi tiết, thiết bị..."
                      className={`${ADMIN_COMPACT_INPUT_CLASS} pl-8 pr-3`}
                    />
                  </div>
                </div>

                <div className="min-w-0">
                  <label
                    htmlFor="activity-limit"
                    className="mb-1 block text-xs font-medium text-stone-800"
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
                    className={ADMIN_COMPACT_INPUT_CLASS}
                  >
                    <option value="50" className={ADMIN_OPTION_CLASS}>
                      50 dòng
                    </option>
                    <option value="100" className={ADMIN_OPTION_CLASS}>
                      100 dòng
                    </option>
                    <option value="200" className={ADMIN_OPTION_CLASS}>
                      200 dòng
                    </option>
                  </select>
                </div>

                <div className="flex min-w-0 items-end">
                  <button
                    type="submit"
                    disabled={loadingActivity}
                    className={`inline-flex min-h-[36px] w-full items-center justify-center gap-1.5 rounded-xl px-4 py-2 text-sm font-semibold disabled:opacity-60 ${ADMIN_PRIMARY_CTA_CLASS}`}
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
              <div className="glass-card rounded-3xl p-10 text-center text-sm text-stone-600">
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
                          <span className="text-[11px] font-medium text-stone-600">
                            {formatVietnamDateTime(log.createdAt)}
                          </span>
                        </div>

                        <div className="flex min-w-0 max-w-full flex-wrap items-center gap-2">
                          <span className="min-w-0 max-w-full break-all [overflow-wrap:anywhere] text-xs font-semibold text-stone-900">
                            @{log.username}
                          </span>
                          <span
                            className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${roleMeta.badgeClass}`}
                          >
                            {roleMeta.label}
                          </span>
                        </div>

                        <p className="min-w-0 max-w-full break-words [overflow-wrap:anywhere] text-sm text-stone-800">
                          {log.detail || eventMeta.label}
                        </p>

                        <p className="min-w-0 max-w-full break-words [overflow-wrap:anywhere] text-xs text-stone-600">
                          {log.deviceSummary || 'Không rõ thiết bị'}
                        </p>
                      </article>
                    );
                  })}
                </div>

                {/* Tablet & Desktop overflow-x-auto table (>= md) */}
                <div
                  data-testid="activity-desktop-table"
                  className="glass-card hidden overflow-x-auto rounded-2xl shadow-glass md:block"
                >
                  <table className="min-w-full divide-y divide-amber-200/80 text-left text-sm">
                    <thead className="bg-amber-100/70 text-xs font-semibold uppercase tracking-wide text-stone-700">
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
                    <tbody className="divide-y divide-amber-200/70 bg-[#FFFDF5]/80">
                      {activityLogs.map((log) => {
                        const { eventMeta, roleMeta } = getActivityDisplayMeta(log);

                        return (
                          <tr key={log.id} className="align-top transition hover:bg-amber-100/45">
                            <td className="whitespace-nowrap px-4 py-3 text-xs font-medium text-stone-700">
                              {formatVietnamDateTime(log.createdAt)}
                            </td>
                            <td className="whitespace-nowrap px-4 py-3">
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-semibold text-stone-900">
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
                            <td className="max-w-xs break-words [overflow-wrap:anywhere] px-4 py-3 text-xs text-stone-800">
                              {log.detail || eventMeta.label}
                            </td>
                            <td
                              title={log.deviceSummary || 'Không rõ thiết bị'}
                              className="max-w-[200px] truncate whitespace-nowrap px-4 py-3 text-xs text-stone-600"
                            >
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

        {activeTab === 'diary' ? (
          <DailyDiarySection
            coupleTitle={settingsForm.coupleTitle}
            initialEntries={initialAdminDiaryEntries}
            currentUser={
              currentUser ?? {
                id: 'admin',
                username: 'admin',
                displayName: 'Anh · Quản trị',
                role: 'admin',
                otpHint: '',
                isActive: true,
                sessionVersion: 1,
                hasPassword: true,
                hasOtp: true,
                lastLoginAt: null,
                createdAt: '',
                updatedAt: '',
              }
            }
            embeddedInAdmin
            onEntriesCountChange={setDiaryCount}
            onUnauthorized={handleUnauthorized}
          />
        ) : null}
      </div>

      {/* Persistent live region for floating status / error toast */}
      <div aria-live={notice?.type === 'error' ? 'assertive' : 'polite'} aria-atomic="true">
        {notice ? (
          <div
            role={notice.type === 'error' ? 'alert' : 'status'}
            className={`fixed inset-x-4 bottom-4 z-50 flex items-center justify-between gap-3 rounded-2xl border px-4 py-3 text-sm shadow-lg backdrop-blur-md sm:inset-x-auto sm:bottom-6 sm:right-6 sm:w-full sm:max-w-md ${notice.type === 'success'
              ? 'border-emerald-300 bg-emerald-50 text-emerald-900'
              : 'border-red-300 bg-red-50 text-red-900'
              }`}
          >
            <div className="flex min-w-0 flex-1 items-center gap-2 [overflow-wrap:anywhere]">
              {notice.type === 'success' ? (
                <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
              ) : (
                <AlertTriangle className="h-4 w-4 shrink-0 text-red-600" />
              )}
              <span className="min-w-0 [overflow-wrap:anywhere]">{notice.text}</span>
            </div>
            <button
              type="button"
              onClick={() => setNotice(null)}
              className={`inline-flex min-h-[36px] shrink-0 items-center rounded-xl px-3 py-1.5 text-xs font-medium text-stone-700 transition hover:text-stone-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 ${notice.type === 'success' ? 'hover:bg-emerald-100' : 'hover:bg-red-100'
                }`}
            >
              Đóng
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
