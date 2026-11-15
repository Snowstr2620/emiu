'use client';

import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
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
  Lock,
  LogOut,
  Mail,
  Music,
  Pencil,
  Plus,
  SlidersHorizontal,
  Trash2,
  Upload,
} from 'lucide-react';
import { cleanupUploadedUrl, uploadMediaFile } from '@/lib/admin-upload';
import {
  calculateDaysTogether,
  formatMemoryDateVi,
  getVietnamCalendarDateParts,
} from '@/lib/date-utils';
import type {
  AdminSiteData,
  AdminSiteSettings,
  MemoryItem,
  StorageStatus,
} from '@/types/memories';

type AdminTab = 'memories' | 'settings' | 'letter';

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
  viewerPasscode: string;
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
    viewerPasscode: '',
  };
}

export function AdminDashboard({ initialData, storageStatus }: AdminDashboardProps) {
  const router = useRouter();
  const memoryFormRef = useRef<HTMLDivElement>(null);

  const [activeTab, setActiveTab] = useState<AdminTab>('memories');
  const [memories, setMemories] = useState<MemoryItem[]>(initialData.memories);
  const [settings, setSettings] = useState<AdminSiteSettings>(initialData.settings);
  const [settingsForm, setSettingsForm] = useState<SettingsFormState>(() =>
    toSettingsForm(initialData.settings)
  );

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
  const [reordering, setReordering] = useState(false);

  // Audio upload state in Settings tab
  const [pendingAudioFile, setPendingAudioFile] = useState<File | null>(null);
  const [audioPreviewUrl, setAudioPreviewUrl] = useState<string | null>(null);
  const [savingSettings, setSavingSettings] = useState(false);

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
  }

  function clearAudioFilePreview() {
    if (audioPreviewUrl) URL.revokeObjectURL(audioPreviewUrl);
    setAudioPreviewUrl(null);
    setPendingAudioFile(null);
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
      memoryFormRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
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
    }
  }

  async function handleSaveSettings(event: FormEvent<HTMLFormElement>, successText: string) {
    event.preventDefault();
    if (savingSettings) return;

    const trimmedPin = settingsForm.viewerPasscode.trim();
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
    if (
      settingsForm.viewerPasscodeEnabled &&
      !settings.hasViewerPasscode &&
      trimmedPin.length === 0
    ) {
      showError('Vui lòng đặt mã mở khoá mới (ít nhất 3 ký tự) khi bật khoá riêng tư.');
      return;
    }
    if (trimmedPin.length > 0 && trimmedPin.length < 3) {
      showError('Mã kỷ niệm nên có ít nhất 3 ký tự.');
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
          viewerPasscode: trimmedPin || undefined,
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

      setSettings(payload.settings);
      setSettingsForm(toSettingsForm(payload.settings));
      clearAudioFilePreview();
      showSuccess(successText);
    } catch (err) {
      if (newlyUploadedAudioUrl) await cleanupUploadedUrl(newlyUploadedAudioUrl);
      const message = err instanceof Error ? err.message : 'Có lỗi xảy ra khi lưu cài đặt.';
      showError(message);
    } finally {
      setSavingSettings(false);
    }
  }

  const activeImagePreview = memoryPreviewUrl || memoryForm.imageUrl.trim();
  const activeAudioPreview = audioPreviewUrl || settingsForm.musicUrl.trim();

  return (
    <div className="min-h-screen px-4 pb-20 pt-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl space-y-6">
        {/* Top bar */}
        <header className="glass-card flex flex-col gap-4 rounded-3xl p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-2xl bg-pink-50 text-pink-500">
                <Heart className="h-4 w-4 fill-pink-500/20" />
              </span>
              <h1 className="font-serif text-2xl font-semibold text-slate-900">
                Quản trị kỷ niệm
              </h1>
              {storageStatus.mode === 'supabase' ? (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50/90 px-3 py-1 text-xs font-medium text-emerald-700">
                  <Cloud className="h-3.5 w-3.5" />
                  Đã kết nối Supabase Cloud
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-sky-200 bg-sky-50/90 px-3 py-1 text-xs font-medium text-sky-700">
                  <HardDrive className="h-3.5 w-3.5" />
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
              className="inline-flex items-center gap-1.5 rounded-2xl border border-slate-200 bg-white/90 px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-pink-200 hover:text-pink-600"
            >
              Xem trang chính
              <ExternalLink className="h-3.5 w-3.5" />
            </Link>
            <button
              type="button"
              onClick={handleLogout}
              className="inline-flex items-center gap-1.5 rounded-2xl border border-slate-200 bg-white/80 px-4 py-2 text-sm font-medium text-slate-600 transition hover:border-rose-200 hover:bg-rose-50/70 hover:text-rose-600"
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
            className={`flex items-center justify-between gap-3 rounded-2xl border px-4 py-3 text-sm ${
              notice.type === 'success'
                ? 'border-emerald-200 bg-emerald-50/95 text-emerald-800'
                : 'border-rose-200 bg-rose-50/95 text-rose-800'
            }`}
          >
            <div className="flex items-center gap-2">
              {notice.type === 'success' ? (
                <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
              ) : (
                <AlertTriangle className="h-4 w-4 shrink-0 text-rose-600" />
              )}
              <span>{notice.text}</span>
            </div>
            <button
              type="button"
              onClick={() => setNotice(null)}
              className="text-xs font-medium opacity-70 hover:opacity-100"
            >
              Đóng
            </button>
          </div>
        ) : null}

        {/* Navigation Tabs */}
        <nav
          aria-label="Mục quản trị"
          className="glass-card flex flex-wrap gap-2 rounded-2xl p-2"
        >
          <button
            type="button"
            onClick={() => {
              setActiveTab('memories');
              setNotice(null);
            }}
            className={`inline-flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition sm:flex-none ${
              activeTab === 'memories'
                ? 'bg-gradient-to-r from-pink-500 to-rose-500 text-white shadow-sm'
                : 'text-slate-600 hover:bg-white/80 hover:text-slate-900'
            }`}
          >
            <ImagePlus className="h-4 w-4" />
            Kỷ niệm &amp; Ảnh ({memories.length})
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab('settings');
              setNotice(null);
            }}
            className={`inline-flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition sm:flex-none ${
              activeTab === 'settings'
                ? 'bg-gradient-to-r from-pink-500 to-rose-500 text-white shadow-sm'
                : 'text-slate-600 hover:bg-white/80 hover:text-slate-900'
            }`}
          >
            <SlidersHorizontal className="h-4 w-4" />
            Mở đầu, Nhạc nền &amp; Riêng tư
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab('letter');
              setNotice(null);
            }}
            className={`inline-flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition sm:flex-none ${
              activeTab === 'letter'
                ? 'bg-gradient-to-r from-pink-500 to-rose-500 text-white shadow-sm'
                : 'text-slate-600 hover:bg-white/80 hover:text-slate-900'
            }`}
          >
            <Mail className="h-4 w-4" />
            Phong thư tâm sự
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
                    className="inline-flex items-center gap-1.5 rounded-2xl border border-slate-200 bg-white/90 px-3.5 py-2 text-xs font-medium text-slate-700 transition hover:border-indigo-200 hover:text-indigo-600 disabled:opacity-50"
                  >
                    <CalendarHeart className="h-3.5 w-3.5" />
                    Sắp xếp theo ngày tăng dần
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={openNewMemoryForm}
                  className="inline-flex items-center gap-1.5 rounded-2xl bg-gradient-to-r from-pink-500 to-rose-500 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:brightness-105"
                >
                  <Plus className="h-4 w-4" />
                  Thêm kỷ niệm mới
                </button>
              </div>
            </div>

            {isMemoryFormOpen ? (
              <div ref={memoryFormRef} className="glass-card rounded-3xl p-6 shadow-glass">
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
                    className="rounded-xl px-3 py-1.5 text-sm font-medium text-slate-500 transition hover:bg-slate-100 hover:text-slate-800"
                  >
                    Huỷ
                  </button>
                </div>

                <form onSubmit={handleSaveMemory} className="grid gap-6 md:grid-cols-[1.15fr_0.85fr]">
                  <div className="space-y-4">
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
                          className="w-full rounded-2xl border border-slate-200 bg-white/90 px-3.5 py-2.5 text-sm text-slate-900 outline-none focus:border-pink-400 focus:ring-2 focus:ring-pink-200"
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
                          className="w-full rounded-2xl border border-slate-200 bg-white/90 px-3.5 py-2.5 text-sm text-slate-900 outline-none focus:border-pink-400 focus:ring-2 focus:ring-pink-200"
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
                        className="w-full rounded-2xl border border-slate-200 bg-white/90 px-3.5 py-2.5 text-sm leading-relaxed text-slate-900 outline-none focus:border-pink-400 focus:ring-2 focus:ring-pink-200"
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
                        className="w-full rounded-2xl border border-slate-200 bg-white/90 px-3.5 py-2.5 text-sm text-slate-900 outline-none focus:border-pink-400 focus:ring-2 focus:ring-pink-200"
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
                        className="w-full rounded-2xl border border-slate-200 bg-white/90 px-3.5 py-2.5 text-sm text-slate-900 outline-none focus:border-pink-400 focus:ring-2 focus:ring-pink-200"
                      />
                    </div>
                  </div>

                  <div className="flex flex-col justify-between gap-4 rounded-2xl border border-dashed border-pink-200 bg-white/60 p-4">
                    <div className="space-y-3">
                      <label
                        htmlFor="memory-file-upload"
                        className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl bg-pink-50/70 px-4 py-5 text-center transition hover:bg-pink-50"
                      >
                        <Upload className="h-6 w-6 text-pink-500" />
                        <span className="text-sm font-semibold text-pink-700">
                          {pendingMemoryFile ? pendingMemoryFile.name : 'Chọn ảnh từ thiết bị'}
                        </span>
                        <span className="text-xs text-slate-500">
                          JPG, PNG, WebP, GIF, AVIF • Tối đa 10MB
                        </span>
                        <input
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
                      className="w-full rounded-2xl bg-gradient-to-r from-pink-500 to-rose-500 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60"
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
                        <p className="line-clamp-2 text-sm text-slate-600">{item.story}</p>
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
                        className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white/90 px-3 py-2 text-xs font-medium text-slate-700 transition hover:border-pink-200 hover:text-pink-600"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                        Sửa
                      </button>

                      {confirmDeleteId === item.id ? (
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleDeleteMemory(item.id)}
                            className="rounded-xl bg-rose-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-rose-700"
                          >
                            Xác nhận xoá
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteId(null)}
                            className="rounded-xl border border-slate-200 bg-white px-2.5 py-2 text-xs text-slate-600"
                          >
                            Huỷ
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteId(item.id)}
                          className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white/90 px-3 py-2 text-xs font-medium text-rose-600 transition hover:border-rose-200 hover:bg-rose-50"
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
            className="glass-card space-y-6 rounded-3xl p-6 shadow-glass"
          >
            <div>
              <h2 className="text-lg font-semibold text-slate-900">
                Thông tin mở đầu, Nhạc nền &amp; Quyền riêng tư
              </h2>
              <p className="text-xs text-slate-500">
                Tuỳ chỉnh lời chào đầu trang, số ngày bên nhau, bản nhạc nền và mã riêng tư nếu cần.
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
                  className="w-full rounded-2xl border border-slate-200 bg-white/90 px-3.5 py-2.5 text-sm text-slate-900 outline-none focus:border-pink-400 focus:ring-2 focus:ring-pink-200"
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
                  className="w-full rounded-2xl border border-slate-200 bg-white/90 px-3.5 py-2.5 text-sm text-slate-900 outline-none focus:border-pink-400 focus:ring-2 focus:ring-pink-200"
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
                className="w-full rounded-2xl border border-slate-200 bg-white/90 px-3.5 py-2.5 text-sm text-slate-900 outline-none focus:border-pink-400 focus:ring-2 focus:ring-pink-200"
              />
            </div>

            {/* Ambient music block */}
            <div className="space-y-4 rounded-2xl border border-slate-200/80 bg-white/60 p-4">
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

              <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
                <input
                  type="text"
                  value={settingsForm.musicUrl}
                  onChange={(e) => {
                    clearAudioFilePreview();
                    setSettingsForm((prev) => ({ ...prev, musicUrl: e.target.value }));
                  }}
                  placeholder="/samples/gentle-memories.wav hoặc https://..."
                  className="w-full rounded-2xl border border-slate-200 bg-white/95 px-3.5 py-2.5 text-sm text-slate-900 outline-none focus:border-pink-400 focus:ring-2 focus:ring-pink-200"
                />
                <div className="flex flex-wrap gap-2">
                  <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-2xl border border-pink-200 bg-pink-50 px-3.5 py-2.5 text-xs font-semibold text-pink-700 transition hover:bg-pink-100">
                    <Upload className="h-3.5 w-3.5" />
                    {pendingAudioFile ? pendingAudioFile.name : 'Tải file nhạc (MP3/M4A/WAV)'}
                    <input
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
                    className="rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-xs font-medium text-slate-600 transition hover:text-slate-900"
                  >
                    Dùng nhạc mẫu
                  </button>
                </div>
              </div>

              {activeAudioPreview ? (
                <audio controls src={activeAudioPreview} className="w-full" />
              ) : null}
            </div>

            {/* Viewer passcode block */}
            <div className="space-y-3 rounded-2xl border border-slate-200/80 bg-white/60 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Lock className="h-4 w-4 text-indigo-500" />
                  <span className="text-sm font-semibold text-slate-800">
                    Khoá mã riêng tư cho trang chính
                  </span>
                </div>
                <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-slate-700">
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
                  Bật yêu cầu nhập mã kỷ niệm
                </label>
              </div>

              <p className="text-xs text-slate-500">
                {settings.hasViewerPasscode
                  ? 'Đã có mã mở khoá được lưu. Để trống ô dưới nếu bạn muốn giữ nguyên mã hiện tại.'
                  : 'Chưa thiết lập mã mở khoá. Hãy nhập một mã dễ nhớ cho riêng hai bạn nếu bật tính năng này.'}
              </p>

              <input
                type="password"
                value={settingsForm.viewerPasscode}
                onChange={(e) =>
                  setSettingsForm((prev) => ({ ...prev, viewerPasscode: e.target.value }))
                }
                placeholder={
                  settings.hasViewerPasscode
                    ? 'Nhập mã mới nếu muốn thay đổi (ít nhất 3 ký tự)...'
                    : 'Nhập mã mở khoá (VD: ngày kỷ niệm của hai bạn)...'
                }
                autoComplete="new-password"
                className="w-full rounded-2xl border border-slate-200 bg-white/95 px-3.5 py-2.5 text-sm text-slate-900 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-200"
              />
            </div>

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={savingSettings}
                className="rounded-2xl bg-gradient-to-r from-pink-500 to-rose-500 px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60"
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
              className="glass-card space-y-4 rounded-3xl p-6 shadow-glass"
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
                  className="w-full rounded-2xl border border-slate-200 bg-white/90 px-3.5 py-2.5 text-sm text-slate-900 outline-none focus:border-pink-400 focus:ring-2 focus:ring-pink-200"
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
                  className="w-full rounded-2xl border border-slate-200 bg-white/90 px-3.5 py-2.5 text-sm leading-relaxed text-slate-900 outline-none focus:border-pink-400 focus:ring-2 focus:ring-pink-200"
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
                  className="w-full rounded-2xl border border-slate-200 bg-white/90 px-3.5 py-2.5 text-sm leading-relaxed text-slate-900 outline-none focus:border-pink-400 focus:ring-2 focus:ring-pink-200"
                />
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  disabled={savingSettings}
                  className="rounded-2xl bg-gradient-to-r from-pink-500 to-rose-500 px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {savingSettings ? 'Đang lưu...' : 'Lưu tâm thư'}
                </button>
              </div>
            </form>

            {/* Live Preview */}
            <aside className="glass-card flex flex-col justify-between rounded-3xl p-7 shadow-glass">
              <div>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-pink-50 px-3 py-1 text-xs font-medium text-pink-600">
                  Xem trước giao diện thư
                </span>
                <div className="mt-5 rounded-2xl border border-rose-100/90 bg-white/90 p-6 shadow-sm sm:p-8">
                  <h3 className="font-serif text-3xl font-semibold text-slate-900">
                    {settingsForm.letterTitle || 'Tiêu đề bức thư'}
                  </h3>
                  <div className="mt-5 space-y-4 font-serif text-lg leading-relaxed text-slate-700">
                    {letterPreviewParagraphs.length > 0 ? (
                      letterPreviewParagraphs.map((paragraph, idx) => (
                        <p key={idx} className="whitespace-pre-line">
                          {paragraph}
                        </p>
                      ))
                    ) : (
                      <p className="italic text-slate-400">Nội dung bức thư sẽ hiện ở đây...</p>
                    )}
                  </div>
                  {settingsForm.letterSignature ? (
                    <p className="mt-8 whitespace-pre-line text-right font-serif text-xl italic text-pink-700">
                      {settingsForm.letterSignature}
                    </p>
                  ) : null}
                </div>
              </div>
            </aside>
          </div>
        ) : null}
      </div>
    </div>
  );
}
