'use client';

import React, {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ClipboardEvent,
  type FormEvent,
} from 'react';
import { useRouter } from 'next/navigation';
import {
  BookOpen,
  CalendarHeart,
  CheckCircle2,
  CloudMoon,
  Coffee,
  Feather,
  Flame,
  Heart,
  ImagePlus,
  Lock,
  Pencil,
  Plus,
  Search,
  Smile,
  Sparkles,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import {
  cleanupUploadedUrl,
  inferVisualUploadKind,
  UploadAuthError,
  uploadMediaFile,
} from '@/lib/admin-upload';
import {
  createManagedDropHandlers,
  getDroppedOrPastedFile,
  validateClientVisualMediaFile,
  VISUAL_MEDIA_ACCEPT,
} from '@/lib/client-dropzone';
import { formatMemoryLongDateVi, getVietnamCalendarDateParts } from '@/lib/date-utils';
import { convertHeicFiles, HEIC_CONVERT_ERROR_MESSAGE, isHeicFile } from '@/lib/heic';
import { isVideoFile, isVideoMediaUrl } from '@/lib/memory-album';
import { useModalFocusTrap } from '@/lib/useModalFocusTrap';
import type { DiaryEntry, DiaryMood, SafeAppUser } from '@/types/memories';

export const DIARY_MOOD_META: Record<
  DiaryMood,
  { label: string; badgeClass: string; iconName: DiaryMood }
> = {
  loved: {
    label: 'Được thương',
    badgeClass: 'border-red-200 bg-red-50 text-red-900',
    iconName: 'loved',
  },
  happy: {
    label: 'Hạnh phúc',
    badgeClass: 'border-amber-300 bg-amber-50 text-amber-950',
    iconName: 'happy',
  },
  peaceful: {
    label: 'Bình yên',
    badgeClass: 'border-emerald-300 bg-emerald-50 text-emerald-900',
    iconName: 'peaceful',
  },
  miss_you: {
    label: 'Nhớ nhau',
    badgeClass: 'border-red-300 bg-red-100/75 text-red-950',
    iconName: 'miss_you',
  },
  grateful: {
    label: 'Biết ơn',
    badgeClass: 'border-yellow-300 bg-yellow-100/80 text-amber-950',
    iconName: 'grateful',
  },
  excited: {
    label: 'Háo hức',
    badgeClass: 'border-orange-300 bg-orange-50 text-orange-950',
    iconName: 'excited',
  },
  tired: {
    label: 'Hơi mệt, cần ôm',
    badgeClass: 'border-stone-300 bg-stone-100 text-stone-800',
    iconName: 'tired',
  },
};

export const DIARY_MOOD_ORDER: DiaryMood[] = [
  'loved',
  'happy',
  'peaceful',
  'miss_you',
  'grateful',
  'excited',
  'tired',
];

export function renderDiaryMoodIcon(mood: DiaryMood, className = 'h-3.5 w-3.5 shrink-0') {
  switch (mood) {
    case 'loved':
      return <Heart className={`${className} fill-red-500 text-red-500`} />;
    case 'happy':
      return <Smile className={className} />;
    case 'peaceful':
      return <Coffee className={className} />;
    case 'miss_you':
      return <CloudMoon className={className} />;
    case 'grateful':
      return <Sparkles className={className} />;
    case 'excited':
      return <Flame className={className} />;
    case 'tired':
      return <Feather className={className} />;
  }
}

function getTodayVietnamIso(): string {
  const vn = getVietnamCalendarDateParts();
  return `${vn.year}-${String(vn.month).padStart(2, '0')}-${String(vn.day).padStart(2, '0')}`;
}

function formatVietnamTimeOnly(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Ho_Chi_Minh',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(d);
  const map = Object.fromEntries(parts.map((p) => [p.type, p.value]));
  return `${map.hour}:${map.minute}`;
}

function sortEntriesClient(list: DiaryEntry[]): DiaryEntry[] {
  return [...list].sort(
    (a, b) => b.entryDate.localeCompare(a.entryDate) || b.createdAt.localeCompare(a.createdAt)
  );
}

interface DiaryFormState {
  id: string | null;
  entryDate: string;
  title: string;
  content: string;
  mood: DiaryMood;
  imageUrl: string;
  imageAlt: string;
}

interface DailyDiarySectionProps {
  coupleTitle: string;
  initialEntries: DiaryEntry[];
  currentUser: SafeAppUser | null;
  embeddedInAdmin?: boolean;
  onEntriesCountChange?: (count: number) => void;
  onUnauthorized?: () => void;
}

const INPUT_CLASS =
  'w-full min-w-0 rounded-2xl border border-amber-300/80 bg-[#FFFDF5] px-3.5 py-2.5 text-base text-stone-900 placeholder:text-stone-500 outline-none transition focus:border-red-500 focus:ring-2 focus:ring-red-500/20 sm:text-sm';

const PRIMARY_CTA_CLASS =
  'bg-gradient-to-r from-red-600 via-rose-600 to-red-500 text-white shadow-[0_10px_26px_rgba(220,38,38,0.25)] transition hover:shadow-[0_14px_34px_rgba(220,38,38,0.38)] hover:ring-1 hover:ring-red-300';

const SECONDARY_BTN_CLASS =
  'border border-amber-300/80 bg-amber-100/75 text-stone-800 transition hover:border-amber-400 hover:bg-amber-200/80 hover:text-stone-950';

const OPTION_CLASS = 'bg-[#FFFBEB] text-stone-900';

export function DailyDiarySection({
  coupleTitle,
  initialEntries,
  currentUser,
  embeddedInAdmin = false,
  onEntriesCountChange,
  onUnauthorized,
}: DailyDiarySectionProps) {
  const router = useRouter();
  const handleSessionExpired = () => {
    if (onUnauthorized) {
      onUnauthorized();
      return;
    }
    router.refresh();
  };
  const [entries, setEntries] = useState<DiaryEntry[]>(() => sortEntriesClient(initialEntries));
  const prevInitialRef = useRef(initialEntries);

  useEffect(() => {
    if (prevInitialRef.current !== initialEntries) {
      prevInitialRef.current = initialEntries;
      setEntries(sortEntriesClient(initialEntries));
    }
  }, [initialEntries]);

  useEffect(() => {
    onEntriesCountChange?.(entries.length);
  }, [entries.length, onEntriesCountChange]);

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [form, setForm] = useState<DiaryFormState>(() => ({
    id: null,
    entryDate: getTodayVietnamIso(),
    title: '',
    content: '',
    mood: 'loved',
    imageUrl: '',
    imageAlt: '',
  }));
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isDraggingQuick, setIsDraggingQuick] = useState(false);
  const [isDraggingImage, setIsDraggingImage] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Filters
  const [authorFilter, setAuthorFilter] = useState<'all' | 'admin' | 'viewer'>('all');
  const [moodFilter, setMoodFilter] = useState<'all' | DiaryMood>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Lightbox for diary photos
  const [lightboxEntry, setLightboxEntry] = useState<DiaryEntry | null>(null);
  const lightboxRef = useRef<HTMLDivElement | null>(null);
  const lightboxCloseRef = useRef<HTMLButtonElement | null>(null);

  useModalFocusTrap({
    isOpen: Boolean(lightboxEntry),
    containerRef: lightboxRef,
    initialFocusRef: lightboxCloseRef,
  });

  useEffect(() => {
    if (!lightboxEntry) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setLightboxEntry(null);
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [lightboxEntry]);

  // Inline sign-in state when viewerPasscodeEnabled=false & currentUser=null
  const [showSignInBox, setShowSignInBox] = useState(false);
  const [loginStage, setLoginStage] = useState<'credentials' | 'otp'>('credentials');
  const [loginUsername, setLoginUsername] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginOtp, setLoginOtp] = useState('');
  const [loginOtpHint, setLoginOtpHint] = useState('');
  const [loginBusy, setLoginBusy] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const composerRef = useRef<HTMLFormElement | null>(null);
  const dragDepthRef = useRef<Record<'quick' | 'image', number>>({ quick: 0, image: 0 });

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  function clearPendingPhoto() {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setPendingFile(null);
    dragDepthRef.current.quick = 0;
    dragDepthRef.current.image = 0;
    setIsDraggingQuick(false);
    setIsDraggingImage(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }

  function openNewEntryForm() {
    clearPendingPhoto();
    setForm({
      id: null,
      entryDate: getTodayVietnamIso(),
      title: '',
      content: '',
      mood: 'loved',
      imageUrl: '',
      imageAlt: '',
    });
    setNotice(null);
    setIsFormOpen(true);
  }

  function startEditEntry(entry: DiaryEntry) {
    clearPendingPhoto();
    setForm({
      id: entry.id,
      entryDate: entry.entryDate,
      title: entry.title,
      content: entry.content,
      mood: entry.mood,
      imageUrl: entry.imageUrl,
      imageAlt: entry.imageAlt,
    });
    setNotice(null);
    setIsFormOpen(true);
    setTimeout(() => {
      const prefersReducedMotion =
        typeof window !== 'undefined' &&
        window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
      composerRef.current?.scrollIntoView?.({
        behavior: prefersReducedMotion ? 'auto' : 'smooth',
        block: 'start',
      });
    }, 30);
  }

  function applyImageFile(file: File, openIfClosed = false): boolean {
    if (isHeicFile(file)) {
      setNotice({ type: 'success', text: 'Đang chuyển ảnh HEIC sang JPG...' });
      void convertHeicFiles([file]).then(({ files }) => {
        if (files[0]) {
          applyImageFileRef.current(files[0], openIfClosed);
        } else {
          setNotice({ type: 'error', text: HEIC_CONVERT_ERROR_MESSAGE });
        }
      });
      return true;
    }

    const err = validateClientVisualMediaFile(file);
    if (err) {
      setNotice({ type: 'error', text: err });
      return false;
    }

    if (openIfClosed && !isFormOpen) {
      setForm({
        id: null,
        entryDate: getTodayVietnamIso(),
        title: '',
        content: '',
        mood: 'loved',
        imageUrl: '',
        imageAlt: '',
      });
    }

    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPendingFile(file);
    setPreviewUrl(URL.createObjectURL(file));
    setNotice(null);

    if (openIfClosed && !isFormOpen) {
      setIsFormOpen(true);
    }
    return true;
  }

  const applyImageFileRef = useRef(applyImageFile);
  applyImageFileRef.current = applyImageFile;

  function handleFormPaste(e: ClipboardEvent<HTMLFormElement>) {
    const pasted = getDroppedOrPastedFile(e.clipboardData?.files, e.clipboardData?.items);
    if (pasted) {
      e.preventDefault();
      applyImageFile(pasted, false);
    }
  }

  async function handleSaveEntry(e: FormEvent) {
    e.preventDefault();
    if (saving) return;

    if (!form.content.trim()) {
      setNotice({ type: 'error', text: 'Hãy viết đôi dòng cho ngày hôm nay trước khi lưu nhé.' });
      return;
    }

    setSaving(true);
    setNotice(null);

    let newlyUploadedUrl: string | null = null;

    try {
      let finalImageUrl = form.imageUrl.trim();
      if (pendingFile) {
        const uploadKind = inferVisualUploadKind(pendingFile);
        newlyUploadedUrl = await uploadMediaFile(pendingFile, uploadKind, {
          uploadUrlEndpoint: '/api/diary/upload-url',
        });
        finalImageUrl = newlyUploadedUrl;
      }

      const endpoint = form.id ? `/api/diary/${form.id}` : '/api/diary';
      const method = form.id ? 'PUT' : 'POST';

      const res = await fetch(endpoint, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entryDate: form.entryDate,
          title: form.title,
          content: form.content,
          mood: form.mood,
          imageUrl: finalImageUrl,
          imageAlt: finalImageUrl ? form.imageAlt : '',
        }),
      });

      if (res.status === 401) {
        if (newlyUploadedUrl) {
          await cleanupUploadedUrl(newlyUploadedUrl, '/api/diary/upload');
        }
        handleSessionExpired();
        return;
      }

      const payload = (await res.json().catch(() => ({}))) as {
        entry?: DiaryEntry;
        error?: string;
      };

      if (!res.ok || !payload.entry) {
        if (newlyUploadedUrl) {
          await cleanupUploadedUrl(newlyUploadedUrl, '/api/diary/upload');
        }
        throw new Error(payload.error || 'Không thể lưu trang nhật ký lúc này.');
      }

      const savedEntry = payload.entry;
      setEntries((prev) => {
        const withoutOld = prev.filter((item) => item.id !== savedEntry.id);
        return sortEntriesClient([savedEntry, ...withoutOld]);
      });

      clearPendingPhoto();
      setIsFormOpen(false);
      setNotice({
        type: 'success',
        text: form.id
          ? 'Đã cập nhật trang nhật ký của tụi mình.'
          : 'Đã cất giữ thêm một trang nhật ký ấm áp.',
      });
    } catch (err) {
      if (err instanceof UploadAuthError) {
        handleSessionExpired();
        return;
      }
      setNotice({
        type: 'error',
        text: err instanceof Error ? err.message : 'Không thể lưu trang nhật ký.',
      });
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteEntry(id: string) {
    if (deletingId) return;
    setDeletingId(id);
    setNotice(null);

    try {
      const res = await fetch(`/api/diary/${id}`, { method: 'DELETE' });
      if (res.status === 401) {
        handleSessionExpired();
        return;
      }

      const payload = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setNotice({ type: 'error', text: payload.error || 'Không thể xoá trang nhật ký.' });
        return;
      }

      setEntries((prev) => prev.filter((item) => item.id !== id));
      setConfirmDeleteId(null);
      if (form.id === id) {
        clearPendingPhoto();
        setIsFormOpen(false);
      }
      setNotice({ type: 'success', text: 'Đã xoá trang nhật ký.' });
    } catch {
      setNotice({ type: 'error', text: 'Không thể kết nối máy chủ khi xoá nhật ký.' });
    } finally {
      setDeletingId(null);
    }
  }

  async function handleInlineCredentials(e: FormEvent) {
    e.preventDefault();
    if (loginBusy) return;
    setLoginBusy(true);
    setLoginError(null);

    try {
      const res = await fetch('/api/viewer/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: loginUsername.trim().toLowerCase(),
          password: loginPassword,
        }),
      });
      const payload = (await res.json().catch(() => ({}))) as {
        otpHint?: string;
        error?: string;
      };
      if (!res.ok) {
        setLoginError(payload.error || 'Thông tin đăng nhập chưa khớp.');
        return;
      }
      setLoginOtpHint(payload.otpHint || '');
      setLoginStage('otp');
    } catch {
      setLoginError('Không thể kết nối máy chủ đăng nhập.');
    } finally {
      setLoginBusy(false);
    }
  }

  async function handleInlineOtp(e: FormEvent) {
    e.preventDefault();
    if (loginBusy) return;
    setLoginBusy(true);
    setLoginError(null);

    try {
      const res = await fetch('/api/viewer/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ otp: loginOtp.trim() }),
      });
      const payload = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setLoginError(payload.error || 'Mã OTP 6 số chưa đúng.');
        return;
      }
      setShowSignInBox(false);
      router.refresh();
    } catch {
      setLoginError('Không thể xác thực mã OTP lúc này.');
    } finally {
      setLoginBusy(false);
    }
  }

  const distinctDaysCount = useMemo(
    () => new Set(entries.map((item) => item.entryDate)).size,
    [entries]
  );

  const filteredEntries = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return entries.filter((item) => {
      if (authorFilter !== 'all' && item.authorRole !== authorFilter) return false;
      if (moodFilter !== 'all' && item.mood !== moodFilter) return false;
      if (q) {
        const haystack =
          `${item.title} ${item.content} ${item.authorDisplayName} ${item.entryDate}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [entries, authorFilter, moodFilter, searchQuery]);

  const groupedByDate = useMemo(() => {
    const groups: Array<{ entryDate: string; items: DiaryEntry[] }> = [];
    for (const item of filteredEntries) {
      const last = groups[groups.length - 1];
      if (last && last.entryDate === item.entryDate) {
        last.items.push(item);
      } else {
        groups.push({ entryDate: item.entryDate, items: [item] });
      }
    }
    return groups;
  }, [filteredEntries]);

  const activePhotoPreview = previewUrl || form.imageUrl.trim();
  const isPreviewVideo =
    (pendingFile !== null && isVideoFile(pendingFile)) ||
    (!pendingFile && isVideoMediaUrl(form.imageUrl.trim()));
  const quickDropHandlers = currentUser
    ? createManagedDropHandlers(dragDepthRef, 'quick', setIsDraggingQuick, (file) => {
        applyImageFile(file, true);
      })
    : {};
  const imageDropHandlers = createManagedDropHandlers(
    dragDepthRef,
    'image',
    setIsDraggingImage,
    (file) => {
      applyImageFile(file, false);
    }
  );

  const HeadingTag = embeddedInAdmin ? 'h2' : 'h1';

  return (
    <section
      id="daily-diary"
      aria-label="Nhật ký mỗi ngày của tụi mình"
      className={
        embeddedInAdmin
          ? 'space-y-6'
          : 'mx-auto max-w-5xl px-4 pb-28 pt-20 sm:px-6 sm:pt-24 md:pb-20 lg:px-8'
      }
    >
      {/* Hero / Quick Dropzone Header */}
      <div
        data-testid="diary-quick-dropzone"
        {...quickDropHandlers}
        className={`glass-card relative overflow-hidden rounded-3xl p-4 transition sm:p-8 ${
          isDraggingQuick
            ? 'border-red-500 bg-amber-100/70 ring-2 ring-red-500/35'
            : ''
        }`}
      >
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0 space-y-2">
            <div className="inline-flex max-w-full items-center gap-2 rounded-full border border-amber-300/80 bg-amber-100/85 px-3 py-1 text-xs font-medium text-red-700">
              <BookOpen className="h-3.5 w-3.5 shrink-0 text-red-600" />
              <span className="truncate">Sổ tay thường nhật · {coupleTitle}</span>
            </div>
            <HeadingTag className="font-serif text-2xl font-semibold tracking-tight text-stone-900 sm:text-4xl">
              Nhật Ký Mỗi Ngày Của Tụi Mình
            </HeadingTag>
            <p className="max-w-2xl text-sm leading-relaxed text-stone-700">
              Nơi hai đứa mình ghé vào mỗi ngày để kể nhau nghe chuyện nhỏ hôm nay, lưu lại cảm xúc
              và những tấm hình đời thường giản dị.
            </p>
            <div className="flex flex-wrap items-center gap-2 pt-1 text-xs text-stone-700">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-300/80 bg-[#FFFDF5]/90 px-3 py-1">
                <CalendarHeart className="h-3.5 w-3.5 shrink-0 text-red-500" />
                <span>{distinctDaysCount} ngày được ghi lại</span>
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-300/80 bg-[#FFFDF5]/90 px-3 py-1">
                <Feather className="h-3.5 w-3.5 shrink-0 text-rose-500" />
                <span>{entries.length} trang tâm sự</span>
              </span>
            </div>
          </div>

          <div className="flex shrink-0 flex-col items-stretch gap-2 sm:items-end">
            {currentUser ? (
              <>
                <button
                  type="button"
                  onClick={() => {
                    if (isFormOpen && !form.id) {
                      setIsFormOpen(false);
                    } else {
                      openNewEntryForm();
                    }
                  }}
                  className={`inline-flex min-h-[46px] w-full items-center justify-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 sm:w-auto ${PRIMARY_CTA_CLASS}`}
                >
                  <Plus className="h-4 w-4 shrink-0" />
                  <span>Viết cho hôm nay</span>
                </button>
                <span className="text-center text-[11px] text-stone-600 sm:text-right">
                  {isDraggingQuick
                    ? 'Thả ảnh hoặc video vào đây để mở trang viết mới ngay'
                    : 'Mẹo: kéo-thả ảnh hoặc video thẳng vào khung này để đính kèm nhanh'}
                </span>
              </>
            ) : (
              <button
                type="button"
                onClick={() => setShowSignInBox((prev) => !prev)}
                className={`inline-flex min-h-[46px] w-full items-center justify-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 sm:w-auto ${SECONDARY_BTN_CLASS}`}
              >
                <Lock className="h-4 w-4 shrink-0 text-red-500" />
                <span>Đăng nhập để viết nhật ký</span>
              </button>
            )}
          </div>
        </div>

        {/* Inline sign-in box when site passcode gate is disabled */}
        {!currentUser && showSignInBox && (
          <div className="mt-6 rounded-2xl border border-amber-300/80 bg-[#FFFDF5]/95 p-4 sm:p-5">
            {loginStage === 'credentials' ? (
              <form onSubmit={handleInlineCredentials} className="grid gap-3 sm:grid-cols-3">
                <div className="min-w-0">
                  <label
                    htmlFor="diary-login-username"
                    className="mb-1 block text-xs font-medium text-stone-700"
                  >
                    Tài khoản
                  </label>
                  <input
                    id="diary-login-username"
                    type="text"
                    required
                    value={loginUsername}
                    onChange={(e) => setLoginUsername(e.target.value)}
                    placeholder="admin hoặc nguoithuong"
                    className={INPUT_CLASS}
                  />
                </div>
                <div className="min-w-0">
                  <label
                    htmlFor="diary-login-password"
                    className="mb-1 block text-xs font-medium text-stone-700"
                  >
                    Mật khẩu
                  </label>
                  <input
                    id="diary-login-password"
                    type="password"
                    required
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    placeholder="Nhập mật khẩu"
                    className={INPUT_CLASS}
                  />
                </div>
                <div className="flex items-end">
                  <button
                    type="submit"
                    disabled={loginBusy}
                    className={`inline-flex min-h-[42px] w-full items-center justify-center rounded-2xl px-4 py-2.5 text-sm font-semibold disabled:opacity-60 ${PRIMARY_CTA_CLASS}`}
                  >
                    {loginBusy ? 'Đang kiểm tra...' : 'Tiếp tục nhập OTP'}
                  </button>
                </div>
              </form>
            ) : (
              <form onSubmit={handleInlineOtp} className="flex flex-col gap-3 sm:flex-row sm:items-end">
                <div className="min-w-0 flex-1">
                  <label
                    htmlFor="diary-login-otp"
                    className="mb-1 block text-xs font-medium text-stone-700"
                  >
                    Mã OTP 6 số {loginOtpHint ? `· Gợi ý: ${loginOtpHint}` : ''}
                  </label>
                  <input
                    id="diary-login-otp"
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    required
                    value={loginOtp}
                    onChange={(e) => setLoginOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="Nhập 6 chữ số OTP"
                    className={INPUT_CLASS}
                  />
                </div>
                <button
                  type="submit"
                  disabled={loginBusy}
                  className={`inline-flex min-h-[42px] items-center justify-center rounded-2xl px-5 py-2.5 text-sm font-semibold disabled:opacity-60 ${PRIMARY_CTA_CLASS}`}
                >
                  {loginBusy ? 'Đang mở khoá...' : 'Xác nhận mở sổ nhật ký'}
                </button>
              </form>
            )}
            {loginError && (
              <p role="alert" className="mt-2.5 text-xs text-red-700">
                {loginError}
              </p>
            )}
          </div>
        )}
      </div>

      {/* Feedback Banner */}
      {notice && (
        <div
          role={notice.type === 'error' ? 'alert' : 'status'}
          className={`mt-5 flex items-center justify-between gap-3 rounded-2xl border px-4 py-3 text-sm ${
            notice.type === 'success'
              ? 'border-emerald-300 bg-emerald-50 text-emerald-900'
              : 'border-red-300 bg-red-50 text-red-900'
          }`}
        >
          <div className="flex min-w-0 items-center gap-2.5">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <span className="min-w-0 break-words">{notice.text}</span>
          </div>
          <button
            type="button"
            onClick={() => setNotice(null)}
            aria-label="Đóng thông báo nhật ký"
            className="inline-flex min-h-[36px] shrink-0 items-center rounded-xl px-2.5 text-xs text-stone-700 hover:bg-black/5 hover:text-stone-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
          >
            Đóng
          </button>
        </div>
      )}

      {/* Composer Form */}
      {currentUser && isFormOpen && (
        <form
          ref={composerRef}
          onSubmit={handleSaveEntry}
          onPaste={handleFormPaste}
          className="glass-card mt-6 space-y-5 rounded-3xl p-5 sm:p-7"
        >
          <div className="flex items-center justify-between gap-3 border-b border-amber-300/70 pb-4">
            <div className="min-w-0">
              <h2 className="font-serif text-2xl font-semibold text-stone-900">
                {form.id ? 'Chỉnh sửa trang nhật ký' : 'Viết trang nhật ký mới'}
              </h2>
              <p className="text-xs text-stone-600">
                Đang ghi với tên:{' '}
                <span className="font-semibold text-stone-900">{currentUser.displayName}</span> · Có
                thể dán ảnh trực tiếp bằng Ctrl+V
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                clearPendingPhoto();
                setIsFormOpen(false);
              }}
              className={`min-h-[36px] shrink-0 rounded-full px-3.5 py-1.5 text-xs font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 ${SECONDARY_BTN_CLASS}`}
            >
              Huỷ
            </button>
          </div>

          <div className="grid gap-5 lg:grid-cols-12">
            <div className="space-y-4 lg:col-span-7">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="min-w-0">
                  <label
                    htmlFor="diary-entry-date"
                    className="mb-1.5 block text-xs font-medium text-stone-700"
                  >
                    Ngày viết nhật ký
                  </label>
                  <input
                    id="diary-entry-date"
                    type="date"
                    required
                    value={form.entryDate}
                    onChange={(e) => setForm((f) => ({ ...f, entryDate: e.target.value }))}
                    className={`${INPUT_CLASS} [color-scheme:light]`}
                  />
                </div>
                <div className="min-w-0">
                  <label
                    htmlFor="diary-entry-title"
                    className="mb-1.5 block text-xs font-medium text-stone-700"
                  >
                    Tiêu đề nhỏ hôm nay (tuỳ chọn)
                  </label>
                  <input
                    id="diary-entry-title"
                    type="text"
                    maxLength={120}
                    placeholder="VD: Bữa tối ấm áp bên nhau..."
                    value={form.title}
                    onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                    className={INPUT_CLASS}
                  />
                </div>
              </div>

              <div>
                <span className="mb-1.5 block text-xs font-medium text-stone-700">
                  Tâm trạng hôm nay
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {DIARY_MOOD_ORDER.map((moodKey) => {
                    const meta = DIARY_MOOD_META[moodKey];
                    const selected = form.mood === moodKey;
                    return (
                      <button
                        key={moodKey}
                        type="button"
                        aria-pressed={selected}
                        onClick={() => setForm((f) => ({ ...f, mood: moodKey }))}
                        className={`inline-flex min-h-[36px] items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 ${
                          selected
                            ? PRIMARY_CTA_CLASS + ' border-red-400/60'
                            : 'border-amber-300/80 bg-[#FFFDF5]/90 text-stone-700 hover:border-amber-400 hover:bg-amber-100/75 hover:text-stone-950'
                        }`}
                      >
                        {renderDiaryMoodIcon(moodKey)}
                        <span>{meta.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label
                  htmlFor="diary-entry-content"
                  className="mb-1.5 block text-xs font-medium text-stone-700"
                >
                  Nội dung nhật ký
                </label>
                <textarea
                  id="diary-entry-content"
                  rows={5}
                  required
                  maxLength={4000}
                  placeholder="Hôm nay của mình thế nào, có điều gì dễ thương muốn giữ lại cho hai đứa..."
                  value={form.content}
                  onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))}
                  className={INPUT_CLASS}
                />
              </div>
            </div>

            {/* Optional Photo Attachment Dropzone */}
            <div
              data-testid="diary-image-dropzone"
              {...imageDropHandlers}
              className={`flex flex-col justify-between gap-4 rounded-2xl border border-dashed p-4 transition lg:col-span-5 ${
                isDraggingImage
                  ? 'border-red-500 bg-amber-100/70 ring-2 ring-red-500/35'
                  : 'border-amber-300/80 bg-amber-50/75'
              }`}
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-medium text-stone-800">
                    Ảnh hoặc video đính kèm trong ngày (tuỳ chọn)
                  </span>
                  {(pendingFile || form.imageUrl) && (
                    <button
                      type="button"
                      onClick={() => {
                        clearPendingPhoto();
                        setForm((f) => ({ ...f, imageUrl: '', imageAlt: '' }));
                      }}
                      className="inline-flex min-h-[36px] items-center gap-1 rounded-full border border-amber-300/80 bg-[#FFFDF5] px-2.5 py-1 text-[11px] font-medium text-red-700 transition hover:border-red-400 hover:bg-red-50 hover:text-red-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
                    >
                      <X className="h-3 w-3 shrink-0" />
                      <span>{isPreviewVideo ? 'Bỏ tệp đính kèm' : 'Bỏ ảnh đính kèm'}</span>
                    </button>
                  )}
                </div>

                <label
                  htmlFor="diary-file-upload"
                  className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border px-4 py-5 text-center transition focus-within:border-red-500 focus-within:ring-2 focus-within:ring-red-500/30 ${
                    isDraggingImage
                      ? 'border-red-500 bg-amber-100/85'
                      : 'border-amber-300/80 bg-[#FFFDF5]/90 hover:border-red-400 hover:bg-amber-100/65'
                  }`}
                >
                  <Upload className="h-5 w-5 text-red-500" />
                  <span className="text-xs font-semibold text-stone-900">
                    {isDraggingImage
                      ? 'Thả ảnh hoặc video vào đây ngay nhé'
                      : pendingFile
                        ? `Đã chọn: ${pendingFile.name}`
                        : 'Chọn ảnh / video hoặc kéo-thả vào đây'}
                  </span>
                  <span className="text-[11px] text-stone-600">
                    Ảnh (tối đa 10MB) hoặc Video MP4/WebM/MOV (tối đa 100MB)
                  </span>
                  <input
                    ref={fileInputRef}
                    id="diary-file-upload"
                    type="file"
                    accept={VISUAL_MEDIA_ACCEPT}
                    className="sr-only"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) applyImageFile(f, false);
                    }}
                  />
                </label>

                <div className="flex h-40 items-center justify-center overflow-hidden rounded-2xl border border-amber-300/70 bg-[#FEF9C3]/55">
                  {activePhotoPreview ? (
                    isPreviewVideo ? (
                      <video
                        src={activePhotoPreview}
                        controls
                        playsInline
                        preload="metadata"
                        aria-label="Xem trước video nhật ký"
                        className="h-full max-w-full object-contain"
                      />
                    ) : (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={activePhotoPreview}
                        alt="Xem trước ảnh nhật ký"
                        className="h-full max-w-full object-contain"
                      />
                    )
                  ) : (
                    <div className="flex flex-col items-center gap-1.5 px-4 text-center text-xs text-stone-600">
                      <ImagePlus className="h-5 w-5 text-red-500/75" />
                      <span>Không bắt buộc có ảnh hoặc video — chỉ viết chữ thôi cũng lưu được ngay</span>
                    </div>
                  )}
                </div>

                {activePhotoPreview && (
                  <div className="min-w-0">
                    <label
                      htmlFor="diary-image-alt"
                      className="mb-1 block text-xs font-medium text-stone-700"
                    >
                      Chú thích bức ảnh (tuỳ chọn)
                    </label>
                    <input
                      id="diary-image-alt"
                      type="text"
                      maxLength={160}
                      placeholder="VD: Hai ly trà nóng tối thứ ba"
                      value={form.imageAlt}
                      onChange={(e) => setForm((f) => ({ ...f, imageAlt: e.target.value }))}
                      className={INPUT_CLASS}
                    />
                  </div>
                )}
              </div>

              <button
                type="submit"
                disabled={saving}
                className={`inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-full px-5 py-3 text-sm font-semibold disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 ${PRIMARY_CTA_CLASS}`}
              >
                <span>
                  {saving
                    ? 'Đang tải ảnh & lưu nhật ký...'
                    : form.id
                      ? 'Lưu thay đổi nhật ký'
                      : 'Lưu trang nhật ký'}
                </span>
              </button>
            </div>
          </div>
        </form>
      )}

      {/* Filter & Search Bar */}
      <div className="glass-card mt-6 flex flex-col gap-3 rounded-2xl p-3.5 sm:flex-row sm:items-center sm:justify-between sm:p-4">
        <div className="grid w-full grid-cols-3 gap-1.5 sm:flex sm:w-auto sm:flex-wrap sm:items-center">
          {(
            [
              { id: 'all', label: 'Tất cả tác giả' },
              { id: 'admin', label: 'Anh viết' },
              { id: 'viewer', label: 'Em viết' },
            ] as const
          ).map((item) => {
            const active = authorFilter === item.id;
            return (
              <button
                key={item.id}
                type="button"
                aria-pressed={active}
                onClick={() => setAuthorFilter(item.id)}
                className={`inline-flex min-h-[40px] items-center justify-center rounded-full px-2.5 py-1.5 text-center text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 sm:min-h-[36px] sm:px-3.5 ${
                  active
                    ? PRIMARY_CTA_CLASS
                    : 'border border-amber-300/80 bg-[#FFFDF5]/90 text-stone-700 hover:border-amber-400 hover:bg-amber-100/75 hover:text-stone-950'
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </div>

        <div className="grid gap-2.5 sm:grid-cols-2">
          <div className="min-w-0">
            <label htmlFor="diary-mood-filter" className="sr-only">
              Lọc theo tâm trạng
            </label>
            <select
              id="diary-mood-filter"
              aria-label="Lọc theo tâm trạng"
              value={moodFilter}
              onChange={(e) => setMoodFilter(e.target.value as 'all' | DiaryMood)}
              className="min-h-[44px] w-full min-w-0 rounded-xl border border-amber-300/80 bg-[#FFFDF5] px-3 py-2 text-base text-stone-900 outline-none transition focus:border-red-500 focus:ring-2 focus:ring-red-500/20 sm:min-h-[38px] sm:text-xs"
            >
              <option value="all" className={OPTION_CLASS}>
                Mọi tâm trạng
              </option>
              {DIARY_MOOD_ORDER.map((m) => (
                <option key={m} value={m} className={OPTION_CLASS}>
                  {DIARY_MOOD_META[m].label}
                </option>
              ))}
            </select>
          </div>

          <div className="relative min-w-0">
            <label htmlFor="diary-search-input" className="sr-only">
              Tìm trong nhật ký
            </label>
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-stone-500" />
            <input
              id="diary-search-input"
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Tìm lời nhắn, ngày..."
              className="min-h-[44px] w-full min-w-0 rounded-xl border border-amber-300/80 bg-[#FFFDF5] pl-8 pr-3 py-2 text-base text-stone-900 placeholder:text-stone-500 outline-none transition focus:border-red-500 focus:ring-2 focus:ring-red-500/20 sm:min-h-[38px] sm:text-xs"
            />
          </div>
        </div>
      </div>

      {/* Grouped Daily Diary Stream */}
      {groupedByDate.length === 0 ? (
        <div className="glass-card mt-8 rounded-3xl p-10 text-center">
          <BookOpen className="mx-auto h-9 w-9 text-red-500/75" />
          <h2 className="mt-3 font-serif text-2xl font-semibold text-stone-900">
            {entries.length === 0
              ? 'Cuốn nhật ký đang chờ trang viết đầu tiên của hai đứa'
              : 'Không tìm thấy trang nhật ký phù hợp bộ lọc'}
          </h2>
          <p className="mx-auto mt-1.5 max-w-md text-sm text-stone-600">
            {entries.length === 0
              ? 'Hãy bấm "Viết cho hôm nay" để lưu lại điều bình yên đầu tiên trong ngày nhé.'
              : 'Thử chọn lại tất cả tác giả hoặc xoá từ khoá tìm kiếm nhé.'}
          </p>
        </div>
      ) : (
        <div className="mt-8 space-y-9">
          {groupedByDate.map((group) => {
            const isDualDay = group.items.length >= 2;
            return (
              <div key={group.entryDate} className="space-y-4">
                <div className="flex flex-wrap items-center gap-2.5">
                  <span className="inline-flex items-center gap-2 rounded-full border border-amber-300/80 bg-[#FFFDF5]/95 px-4 py-1.5 text-xs font-semibold text-stone-900 shadow-[0_6px_18px_rgba(217,119,6,0.12)]">
                    <CalendarHeart className="h-3.5 w-3.5 shrink-0 text-red-500" />
                    <span>{formatMemoryLongDateVi(group.entryDate)}</span>
                  </span>
                  {isDualDay && (
                    <span className="inline-flex items-center gap-1 rounded-full border border-red-200 bg-red-50 px-3 py-1 text-[11px] font-medium text-red-800">
                      <Heart className="h-3 w-3 shrink-0 fill-red-500 text-red-500" />
                      <span>Nhật ký đôi trong ngày</span>
                    </span>
                  )}
                </div>

                <div className={isDualDay ? 'grid gap-5 lg:grid-cols-2' : 'space-y-5'}>
                  {group.items.map((entry) => {
                    const moodMeta = DIARY_MOOD_META[entry.mood] ?? DIARY_MOOD_META.loved;
                    const canManage =
                      currentUser?.role === 'admin' ||
                      (Boolean(currentUser?.id) && entry.authorId === currentUser?.id);
                    const timeStr = formatVietnamTimeOnly(entry.createdAt);

                    return (
                      <article
                        key={entry.id}
                        data-testid={`diary-card-${entry.id}`}
                        className="glass-card flex flex-col justify-between gap-4 rounded-3xl p-4 sm:p-6"
                      >
                        <div className="space-y-3.5">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="flex flex-wrap items-center gap-2">
                              <span
                                className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold ${
                                  entry.authorRole === 'admin'
                                    ? 'border-red-300/80 bg-red-50 text-red-800'
                                    : 'border-amber-300/80 bg-amber-100/80 text-stone-800'
                                }`}
                              >
                                <Heart className="h-3 w-3 shrink-0 fill-red-500 text-red-500" />
                                <span>{entry.authorDisplayName}</span>
                              </span>
                              <span
                                className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${moodMeta.badgeClass}`}
                              >
                                {renderDiaryMoodIcon(entry.mood, 'h-3 w-3 shrink-0')}
                                <span>{moodMeta.label}</span>
                              </span>
                            </div>

                            {timeStr && (
                              <span className="text-[11px] text-stone-500">Lúc {timeStr}</span>
                            )}
                          </div>

                          {entry.title && (
                            <h3 className="font-serif text-xl font-semibold text-stone-900 sm:text-2xl">
                              {entry.title}
                            </h3>
                          )}

                          <div className="space-y-2.5 text-sm leading-relaxed text-stone-700">
                            {entry.content.split(/\n{2,}/).map((para, idx) => (
                              <p key={idx} className="whitespace-pre-line break-words">
                                {para}
                              </p>
                            ))}
                          </div>

                          {entry.imageUrl &&
                            (isVideoMediaUrl(entry.imageUrl) ? (
                              <div className="mt-2 overflow-hidden rounded-2xl border border-amber-300/70 bg-[#FEF9C3]/55 p-2">
                                <video
                                  src={entry.imageUrl}
                                  controls
                                  playsInline
                                  preload="metadata"
                                  aria-label={entry.imageAlt || entry.title || 'Video nhật ký'}
                                  className="mx-auto max-h-80 w-auto max-w-full rounded-xl object-contain"
                                />
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => setLightboxEntry(entry)}
                                aria-label={`Phóng to ảnh nhật ký: ${entry.title || entry.entryDate}`}
                                className="group relative mt-2 flex w-full items-center justify-center overflow-hidden rounded-2xl border border-amber-300/70 bg-[#FEF9C3]/55 p-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
                              >
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                  src={entry.imageUrl}
                                  alt={entry.imageAlt || entry.title || 'Ảnh nhật ký'}
                                  loading="lazy"
                                  className="max-h-72 w-auto max-w-full rounded-xl object-contain transition duration-300 group-hover:scale-[1.01] motion-reduce:transition-none"
                                />
                              </button>
                            ))}
                        </div>

                        {canManage && (
                          <div className="flex flex-wrap items-center justify-end gap-2 border-t border-amber-300/70 pt-3">
                            <button
                              type="button"
                              onClick={() => startEditEntry(entry)}
                              className={`inline-flex min-h-[36px] items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 ${SECONDARY_BTN_CLASS}`}
                            >
                              <Pencil className="h-3.5 w-3.5 shrink-0" />
                              <span>Sửa</span>
                            </button>

                            {confirmDeleteId === entry.id ? (
                              <div className="flex items-center gap-1.5">
                                <button
                                  type="button"
                                  disabled={deletingId === entry.id}
                                  onClick={() => handleDeleteEntry(entry.id)}
                                  className="inline-flex min-h-[36px] items-center gap-1 rounded-xl border border-red-500 bg-red-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-red-700 disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
                                >
                                  {deletingId === entry.id ? 'Đang xoá...' : 'Xác nhận xoá'}
                                </button>
                                <button
                                  type="button"
                                  disabled={deletingId === entry.id}
                                  onClick={() => setConfirmDeleteId(null)}
                                  className={`min-h-[36px] rounded-xl px-2.5 py-1.5 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 ${SECONDARY_BTN_CLASS}`}
                                >
                                  Huỷ
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => setConfirmDeleteId(entry.id)}
                                className="inline-flex min-h-[36px] items-center gap-1.5 rounded-xl border border-red-300/80 bg-red-50 px-3 py-1.5 text-xs font-medium text-red-700 transition hover:border-red-400 hover:bg-red-100 hover:text-red-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
                              >
                                <Trash2 className="h-3.5 w-3.5 shrink-0" />
                                <span>Xoá</span>
                              </button>
                            )}
                          </div>
                        )}
                      </article>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Photo Lightbox Modal */}
      {lightboxEntry && lightboxEntry.imageUrl && (
        <div
          ref={lightboxRef}
          role="dialog"
          aria-modal="true"
          aria-label="Xem ảnh nhật ký"
          tabIndex={-1}
          onClick={() => setLightboxEntry(null)}
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto overscroll-contain bg-stone-950/60 p-4 backdrop-blur-md sm:items-center"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="glass-card relative my-auto flex w-full max-w-3xl flex-col overflow-hidden rounded-3xl p-4 sm:p-6"
          >
            <div className="mb-3 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-medium text-stone-600">
                  {formatMemoryLongDateVi(lightboxEntry.entryDate)} · {lightboxEntry.authorDisplayName}
                </p>
                {lightboxEntry.title && (
                  <h3 className="truncate font-serif text-xl font-semibold text-stone-900">
                    {lightboxEntry.title}
                  </h3>
                )}
              </div>
              <button
                ref={lightboxCloseRef}
                type="button"
                onClick={() => setLightboxEntry(null)}
                aria-label="Đóng ảnh nhật ký"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-amber-300/80 bg-[#FFFDF5] text-stone-700 transition hover:border-amber-400 hover:bg-amber-100 hover:text-stone-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex max-h-[70vh] items-center justify-center overflow-hidden rounded-2xl border border-amber-300/70 bg-[#FEF9C3]/55 p-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={lightboxEntry.imageUrl}
                alt={lightboxEntry.imageAlt || lightboxEntry.title || 'Ảnh nhật ký'}
                className="max-h-[66vh] w-auto max-w-full object-contain"
              />
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
