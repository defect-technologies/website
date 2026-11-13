// A repair: the runner makes a founder's notes on the built site as it is, and pictures each note's spot on the
// preview the founder looked at and on the new one. The founder then answers each note from the two pictures.

import type { Device, NoteAnchor } from "./review";

/** One note of a repair as the Review page shows it: what the founder asked for, and its spot before and after. */
export type RepairCheck = {
  id: string;
  text: string;
  device: Device;
  path: string;
  anchor: NoteAnchor | null;
  /** Empty when that picture could not be taken. */
  before: string;
  after: string;
  /** How far across the pictures the note's element starts, from 0 at the left edge to 1 at the right. */
  focus?: number;
};

/** The notes the runner is handed with a repair: the preview the founder looked at, and what each note points at. */
export type RepairNotes = { previewUrl: string; notes: Pick<RepairCheck, "id" | "text" | "device" | "path" | "anchor">[] };

/** A job's stored result holds its repair checks under this key (preview_jobs.result). */
export function repairChecksOf(result: unknown): RepairCheck[] {
  const repairs = (result as { repairs?: unknown } | null)?.repairs;
  return Array.isArray(repairs) ? (repairs as RepairCheck[]) : [];
}
