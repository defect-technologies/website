import "server-only";
import { and, asc, desc, eq, isNotNull, isNull } from "drizzle-orm";
import { MAX_NOTE_TEXT, tasteMarkdown } from "@/lib/review";
import { db } from "../db/client";
import { tasteLessons, type TasteLesson } from "../db/schema";

export async function activeTasteLessons(): Promise<TasteLesson[]> {
  return (await db()).select().from(tasteLessons).where(isNull(tasteLessons.retiredAt)).orderBy(asc(tasteLessons.createdAt));
}

export async function retiredTasteLessons(limit = 30): Promise<TasteLesson[]> {
  return (await db()).select().from(tasteLessons).where(isNotNull(tasteLessons.retiredAt)).orderBy(desc(tasteLessons.retiredAt)).limit(limit);
}

/** Each founder's lessons are theirs: only the founder who wrote one restores, edits or retires it. */
const theirs = (id: string, by: string) => and(eq(tasteLessons.id, id), eq(tasteLessons.createdBy, by));

export async function restoreTasteLesson(id: string, by: string): Promise<void> {
  await (await db()).update(tasteLessons).set({ retiredAt: null }).where(theirs(id, by));
}

export async function addTasteLessons(texts: string[], createdBy: string, sourceBusinessId: string | null = null): Promise<void> {
  const rows = texts.map((text) => text.trim().slice(0, MAX_NOTE_TEXT)).filter(Boolean);
  if (!rows.length) return;
  await (await db()).insert(tasteLessons).values(rows.map((text) => ({ text, createdBy, sourceBusinessId })));
}

export async function updateTasteLesson(id: string, text: string, by: string): Promise<void> {
  const trimmed = text.trim().slice(0, MAX_NOTE_TEXT);
  if (!trimmed) return;
  await (await db()).update(tasteLessons).set({ text: trimmed }).where(and(theirs(id, by), isNull(tasteLessons.retiredAt)));
}

export async function retireTasteLesson(id: string, by: string): Promise<void> {
  await (await db()).update(tasteLessons).set({ retiredAt: new Date() }).where(theirs(id, by));
}

/** What GET /api/runner/taste hands the runner: the lessons, and the file the builder reads as lead/taste.md, each founder's apart. */
export async function tasteForRunner() {
  const lessons = await activeTasteLessons();
  return {
    lessons: lessons.map((lesson) => ({ id: lesson.id, text: lesson.text, createdAt: lesson.createdAt.toISOString(), createdBy: lesson.createdBy })),
    markdown: tasteMarkdown(lessons),
  };
}
