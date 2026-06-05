import { Router } from 'express';
import { and, asc, desc, eq, inArray } from 'drizzle-orm';
import { noteCreateSchema, noteUpdateSchema } from '@balance/shared';
import { db } from '../db/client.js';
import { notes, noteItems } from '../db/schema/index.js';
import { authedUserId } from '../auth/middleware.js';
import { owned, softDeleteSet } from '../lib/tenancy.js';
import { notFound } from '../lib/errors.js';

export const notesRouter: Router = Router();

type NoteRow = typeof notes.$inferSelect;

/** Attaches the (non-deleted) item list to each note. */
async function withItems(rows: NoteRow[]) {
  if (rows.length === 0) return [];
  const items = await db
    .select()
    .from(noteItems)
    .where(and(inArray(noteItems.noteId, rows.map((r) => r.id))))
    .orderBy(asc(noteItems.sortOrder));
  const byNote = new Map<string, typeof items>();
  for (const it of items) {
    if (it.deletedAt) continue;
    const arr = byNote.get(it.noteId) ?? [];
    arr.push(it);
    byNote.set(it.noteId, arr);
  }
  return rows.map((r) => ({ ...r, items: byNote.get(r.id) ?? [] }));
}

// Replaces a note's items wholesale (the page sends the full list each save).
async function replaceItems(
  tx: Pick<typeof db, 'delete' | 'insert'>,
  noteId: string,
  items: { id?: string; text: string; done: boolean; sortOrder: number }[],
) {
  await tx.delete(noteItems).where(eq(noteItems.noteId, noteId));
  if (items.length) {
    await tx.insert(noteItems).values(items.map((it) => ({ ...it, noteId })));
  }
}

notesRouter.get('/', async (req, res) => {
  const userId = authedUserId(req);
  const rows = await db
    .select()
    .from(notes)
    .where(owned(notes, userId))
    .orderBy(desc(notes.updatedAt));
  res.json(await withItems(rows));
});

notesRouter.post('/', async (req, res) => {
  const userId = authedUserId(req);
  const { items, ...fields } = noteCreateSchema.parse(req.body);
  const created = await db.transaction(async (tx) => {
    const [row] = await tx.insert(notes).values({ ...fields, userId }).returning();
    await replaceItems(tx, row!.id, items);
    return row!;
  });
  const [withIt] = await withItems([created]);
  res.status(201).json(withIt);
});

notesRouter.patch('/:id', async (req, res) => {
  const userId = authedUserId(req);
  const { items, ...fields } = noteUpdateSchema.parse(req.body);
  const updated = await db.transaction(async (tx) => {
    const [row] = await tx
      .update(notes)
      .set(fields)
      .where(and(owned(notes, userId), eq(notes.id, req.params.id)))
      .returning();
    if (!row) return null;
    if (items) await replaceItems(tx, row.id, items);
    return row;
  });
  if (!updated) throw notFound('Note not found');
  const [withIt] = await withItems([updated]);
  res.json(withIt);
});

notesRouter.delete('/:id', async (req, res) => {
  const userId = authedUserId(req);
  const [row] = await db
    .update(notes)
    .set(softDeleteSet())
    .where(and(owned(notes, userId), eq(notes.id, req.params.id)))
    .returning({ id: notes.id });
  if (!row) throw notFound('Note not found');
  res.status(204).end();
});
