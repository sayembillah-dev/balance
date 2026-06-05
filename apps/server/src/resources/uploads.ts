import { Router } from 'express';
import multer from 'multer';
import { and, eq } from 'drizzle-orm';
import { newId } from '@balance/shared';
import { db } from '../db/client.js';
import { uploads } from '../db/schema/index.js';
import { authedUserId } from '../auth/middleware.js';
import { storage } from '../storage/index.js';
import { AppError, notFound } from '../lib/errors.js';

export const uploadsRouter: Router = Router();

const MAX_BYTES = 10 * 1024 * 1024; // 10 MB
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_BYTES } });

// Validate by content (magic bytes), never the client-supplied Content-Type.
function detectImage(buf: Buffer): string | null {
  if (buf.length < 12) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg';
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return 'image/png';
  if (buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') return 'image/webp';
  return null;
}

// POST /uploads — multipart form field `file`. Returns the new upload id.
uploadsRouter.post('/', upload.single('file'), async (req, res) => {
  const userId = authedUserId(req);
  const file = req.file;
  if (!file) throw new AppError('VALIDATION_ERROR', 'No file provided');
  const contentType = detectImage(file.buffer);
  if (!contentType) {
    throw new AppError('VALIDATION_ERROR', 'Only JPEG, PNG, or WebP images are allowed');
  }

  const id = newId();
  await storage().put(id, file.buffer, contentType);
  await db.insert(uploads).values({ id, userId, storageKey: id, contentType, sizeBytes: file.size });
  res.status(201).json({ id, contentType, sizeBytes: file.size });
});

// GET /uploads/:id — streams the blob, but only to its owner (private data).
uploadsRouter.get('/:id', async (req, res) => {
  const userId = authedUserId(req);
  const row = await db.query.uploads.findFirst({
    where: and(eq(uploads.id, req.params.id), eq(uploads.userId, userId)),
  });
  if (!row) throw notFound('Upload not found');

  res.setHeader('Content-Type', row.contentType);
  res.setHeader('Cache-Control', 'private, max-age=86400');
  const stream = storage().getStream(row.storageKey);
  stream.on('error', () => {
    if (!res.headersSent) res.status(404).end();
    else res.destroy();
  });
  stream.pipe(res);
});
