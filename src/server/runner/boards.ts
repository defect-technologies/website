import "server-only";
import { z } from "zod";
import { BOARD_LETTERS, boardLessonsMarkdown, boardPreferences, pickAgreement } from "@/lib/boards";
import { BOARDS_STEP } from "@/lib/previewJobs";
import { record } from "../activity";
import { BotError } from "../bots/http";
import { isBoardPicture, MAX_PICTURE_BYTES, pictureName, storeBoardPicture } from "../boards/pictures";
import { decisions, saveBoards } from "../boards/store";
import type { PreviewJob } from "../db/schema";
import { isActive, jobById, leadForJob, updateJob } from "./jobs";

const ACTOR = "bot:runner";
const short = (most: number) => z.string().trim().max(most);

const Option = z.object({
  letter: z.enum(BOARD_LETTERS),
  boldness: z.number().int().min(1).max(3).default(2),
  name: short(60).min(1),
  idea: short(300).default(""),
  palette: z.record(short(20), short(20)),
  fonts: z.object({ heading: short(80), body: short(80) }),
  layout: short(40),
  controls: z.object({ shape: short(20).nullable(), fill: short(20), case: short(20).nullable(), weight: short(20).nullable(), link: short(30) }),
  motif: z.object({ name: short(60), from: short(300) }),
  headline: short(120).default(""),
  line: short(240).default(""),
  photoTreatment: short(20).default("plain"),
  texture: short(20).default("none"),
  explores: z.boolean().default(false),
  pictures: z.object({ board: z.string().url().max(500), desktop: z.string().url().max(500), phone: z.string().url().max(500) }),
});

export const BoardsBody = z.object({
  options: z.array(Option).length(BOARD_LETTERS.length),
  pick: z.object({ letter: z.enum(BOARD_LETTERS), reason: short(400).default("") }).nullable().default(null),
});

/** The job a runner is building right now: boards and their pictures are only taken from that. */
async function buildingJob(id: string): Promise<PreviewJob> {
  const job = await jobById(id);
  if (!job) throw new BotError(404, "No preview job has that ID.");
  if (!isActive(job.status) || job.status === "queued" || job.kind !== "preview") throw new BotError(409, `That job is ${job.status}, not a preview being built.`);
  return job;
}

/** PUT /api/runner/:job/boards/:picture, the JPEG as the body. The picture is "a-board", "a-desktop" or "a-phone" (and b, c). */
export async function uploadBoardPicture(id: string, name: string, request: Request) {
  const job = await buildingJob(id);
  if (!pictureName(name)) throw new BotError(400, `"${name}" is not a board picture. Send a-board, a-desktop or a-phone, and the same for b and c.`);
  const bytes = await request.arrayBuffer();
  if (bytes.byteLength === 0 || bytes.byteLength > MAX_PICTURE_BYTES) throw new BotError(413, "A board picture is a JPEG of 4 MB at most.");
  return { url: await storeBoardPicture(job.businessId, job.id, name, bytes) };
}

/**
 * POST /api/runner/:job/boards: the three options, with the addresses their pictures were stored at. The job ends
 * here: a founder's choice queues the job that builds the site.
 */
export async function reportBoards(id: string, body: z.infer<typeof BoardsBody>) {
  const job = await buildingJob(id);
  if (new Set(body.options.map((option) => option.letter)).size !== body.options.length) throw new BotError(400, "Every option needs its own letter.");
  const strangers = body.options.flatMap((option) => Object.values(option.pictures)).filter((url) => !isBoardPicture(url, job.businessId));
  if (strangers.length) throw new BotError(400, "Every picture has to be one this job uploaded with PUT /api/runner/:job/boards/:picture.");
  const lead = await leadForJob(job);
  const board = await saveBoards({ businessId: lead.id, jobId: job.id, options: body.options, pick: body.pick });
  await updateJob(job.id, { status: "done", step: BOARDS_STEP, finishedAt: new Date() });
  await record(ACTOR, "sent three design boards", { businessId: lead.id, detail: body.options.map((option) => `${option.letter.toUpperCase()}: ${option.name}`).join("; ") });
  return { ok: true, board: board.id };
}

/**
 * GET /api/runner/boards: what the founders' choices so far teach the next build. `preferences` leans site-kit's draw
 * (lead/board-preferences.json), and `markdown` is what the option writer reads (lead/board-lessons.md).
 */
export async function boardMemory() {
  const decided = await decisions();
  return { preferences: boardPreferences(decided), markdown: boardLessonsMarkdown(decided), agreement: pickAgreement(decided), decided: decided.length };
}
