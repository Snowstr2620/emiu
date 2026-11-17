import fs from 'node:fs';
import path from 'node:path';
import { Readable } from 'node:stream';
import { NextResponse } from 'next/server';
import {
  ALLOWED_AUDIO_EXTENSIONS,
  ALLOWED_IMAGE_EXTENSIONS,
  ALLOWED_VIDEO_EXTENSIONS,
} from '@/lib/validation';

export const dynamic = 'force-dynamic';

const STREAM_THRESHOLD_BYTES = 2 * 1024 * 1024;

const EXTENSION_CONTENT_TYPES: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.avif': 'image/avif',
  '.mp4': 'video/mp4',
  '.m4v': 'video/mp4',
  '.webm': 'video/webm',
  '.mov': 'video/quicktime',
  '.mp3': 'audio/mpeg',
  '.m4a': 'audio/mp4',
  '.wav': 'audio/wav',
};

interface UploadRouteContext {
  params: Promise<{ filename: string }>;
}

function resolveValidatedUploadFile(rawFilename: string):
  | { ok: true; filePath: string; contentType: string }
  | { ok: false; status: 400 | 404; error: string } {
  let decoded = '';
  try {
    decoded = decodeURIComponent(rawFilename || '').trim();
  } catch {
    return { ok: false, status: 400, error: 'Tên tệp không hợp lệ.' };
  }

  if (
    !decoded ||
    decoded.startsWith('.') ||
    decoded.includes('..') ||
    decoded.includes('/') ||
    decoded.includes('\\') ||
    decoded.includes('\0')
  ) {
    return { ok: false, status: 400, error: 'Đường dẫn tệp không hợp lệ.' };
  }

  const ext = path.posix.extname(decoded.toLowerCase());
  if (
    !ALLOWED_IMAGE_EXTENSIONS.has(ext) &&
    !ALLOWED_VIDEO_EXTENSIONS.has(ext) &&
    !ALLOWED_AUDIO_EXTENSIONS.has(ext)
  ) {
    return { ok: false, status: 400, error: 'Định dạng tệp không được hỗ trợ.' };
  }

  const contentType = EXTENSION_CONTENT_TYPES[ext];
  if (!contentType) {
    return { ok: false, status: 400, error: 'Định dạng tệp không được hỗ trợ.' };
  }

  const uploadDir = path.resolve(
    process.env.LOCAL_UPLOAD_DIR || path.join(process.cwd(), 'public', 'uploads')
  );
  const resolvedTarget = path.resolve(uploadDir, decoded);
  if (!resolvedTarget.startsWith(`${uploadDir}${path.sep}`)) {
    return { ok: false, status: 400, error: 'Đường dẫn tệp không hợp lệ.' };
  }

  if (!fs.existsSync(resolvedTarget)) {
    return { ok: false, status: 404, error: 'Không tìm thấy tệp.' };
  }

  const stat = fs.statSync(resolvedTarget);
  if (!stat.isFile()) {
    return { ok: false, status: 404, error: 'Không tìm thấy tệp.' };
  }

  return { ok: true, filePath: resolvedTarget, contentType };
}

function buildBaseHeaders(contentType: string, stat: fs.Stats): Headers {
  const headers = new Headers();
  headers.set('Content-Type', contentType);
  headers.set('X-Content-Type-Options', 'nosniff');
  headers.set('Accept-Ranges', 'bytes');
  headers.set('Cache-Control', 'public, max-age=31536000, immutable');
  headers.set('ETag', `"${stat.size.toString(16)}-${Math.trunc(stat.mtimeMs).toString(16)}"`);
  return headers;
}

export async function HEAD(_request: Request, context: UploadRouteContext) {
  const { filename } = await context.params;
  const resolved = resolveValidatedUploadFile(filename);
  if (!resolved.ok) {
    return NextResponse.json({ error: resolved.error }, { status: resolved.status });
  }

  const stat = fs.statSync(resolved.filePath);
  const headers = buildBaseHeaders(resolved.contentType, stat);
  headers.set('Content-Length', String(stat.size));
  return new NextResponse(null, { status: 200, headers });
}

export async function GET(request: Request, context: UploadRouteContext) {
  const { filename } = await context.params;
  const resolved = resolveValidatedUploadFile(filename);
  if (!resolved.ok) {
    return NextResponse.json({ error: resolved.error }, { status: resolved.status });
  }

  const stat = fs.statSync(resolved.filePath);
  const totalSize = stat.size;
  const headers = buildBaseHeaders(resolved.contentType, stat);
  const rangeHeader = request.headers.get('range');

  if (rangeHeader && totalSize > 0) {
    const match = /^bytes=(\d*)-(\d*)$/i.exec(rangeHeader.trim());
    if (!match || (match[1] === '' && match[2] === '')) {
      headers.set('Content-Range', `bytes */${totalSize}`);
      return new NextResponse(null, { status: 416, headers });
    }

    let start: number;
    let end: number;
    if (match[1] === '') {
      const suffixLength = Number(match[2]);
      start = Math.max(0, totalSize - suffixLength);
      end = totalSize - 1;
    } else {
      start = Number(match[1]);
      end = match[2] !== '' ? Math.min(Number(match[2]), totalSize - 1) : totalSize - 1;
    }

    if (!Number.isInteger(start) || !Number.isInteger(end) || start < 0 || start > end || start >= totalSize) {
      headers.set('Content-Range', `bytes */${totalSize}`);
      return new NextResponse(null, { status: 416, headers });
    }

    const chunkLength = end - start + 1;
    headers.set('Content-Range', `bytes ${start}-${end}/${totalSize}`);
    headers.set('Content-Length', String(chunkLength));

    if (chunkLength > STREAM_THRESHOLD_BYTES) {
      const webStream = Readable.toWeb(
        fs.createReadStream(resolved.filePath, { start, end })
      ) as ReadableStream<Uint8Array>;
      return new NextResponse(webStream, { status: 206, headers });
    }

    const chunk = Buffer.allocUnsafe(chunkLength);
    const fd = fs.openSync(resolved.filePath, 'r');
    try {
      fs.readSync(fd, chunk, 0, chunkLength, start);
    } finally {
      fs.closeSync(fd);
    }

    return new NextResponse(new Uint8Array(chunk), { status: 206, headers });
  }

  if (totalSize > STREAM_THRESHOLD_BYTES) {
    headers.set('Content-Length', String(totalSize));
    const webStream = Readable.toWeb(
      fs.createReadStream(resolved.filePath, { start: 0, end: totalSize - 1 })
    ) as ReadableStream<Uint8Array>;
    return new NextResponse(webStream, { status: 200, headers });
  }

  const buffer = fs.readFileSync(resolved.filePath);
  headers.set('Content-Length', String(buffer.length));
  return new NextResponse(new Uint8Array(buffer), { status: 200, headers });
}
