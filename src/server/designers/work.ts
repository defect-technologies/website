import "server-only";
import { desc, eq, inArray } from "drizzle-orm";
import { isRedrawn, revisedLetter, verdictOf } from "@/lib/boards";
import { type BoardState, monthlyFeeCents, type WorkFacts, type WorkStatus, workStatus } from "@/lib/designerWork";
import { ACTIVE_JOB_STATUSES, isSkipped } from "@/lib/previewJobs";
import type { Turn, TurnPaths } from "@/lib/turn";
import { boardsWaiting, type BoardWithLead } from "../boards/store";
import { db } from "../db/client";
import { businesses, designBoards, designerClaims, previewJobs, type DesignBoard, type PreviewJob } from "../db/schema";
import { reviewQueue, type ReviewItem } from "../review/queue";
import { outreachSettings } from "../settings";
import { turnsOf } from "../turn";

export const DESIGNER_TURN_PATHS: TurnPaths = { design: (id) => `/designer/designs/${id}`, review: (id) => `/designer/review?id=${id}` };

/** What a designer may know of a business they took: never the owner's email, phone or the emails we sent. */
const SAFE_COLUMNS = {
  id: businesses.id,
  businessName: businesses.businessName,
  website: businesses.website,
  niche: businesses.niche,
  area: businesses.area,
  stage: businesses.stage,
  source: businesses.source,
  previewUrl: businesses.previewUrl,
  previewBuiltAt: businesses.previewBuiltAt,
  firstSentAt: businesses.firstSentAt,
  followUpSentAt: businesses.followUpSentAt,
  clickedAt: businesses.clickedAt,
  clickCount: businesses.clickCount,
  repliedAt: businesses.repliedAt,
  paidAt: businesses.paidAt,
  plan: businesses.plan,
  priceArm: businesses.priceArm,
  claimedAt: designerClaims.claimedAt,
};

export type DesignerBusiness = Omit<ClaimedRow, "plan" | "priceArm"> & {
  status: WorkStatus;
  /** One month of the client's fee, in cents, once the business is a paying client. Zero until then. */
  earnedCents: number;
  /** The newest board, for a link to it. */
  boardId: string | null;
};

async function claimedRows(designerId: string) {
  return (await db()).select(SAFE_COLUMNS).from(designerClaims).innerJoin(businesses, eq(businesses.id, designerClaims.businessId)).where(eq(designerClaims.designerId, designerId)).orderBy(desc(designerClaims.claimedAt));
}

type ClaimedRow = Awaited<ReturnType<typeof claimedRows>>[number];

/** The first row per business of rows ordered newest first. */
function newestPer<T extends { businessId: string }>(rows: T[]): Map<string, T> {
  const newest = new Map<string, T>();
  for (const row of rows) if (!newest.has(row.businessId)) newest.set(row.businessId, row);
  return newest;
}

async function newestBoards(ids: string[]): Promise<Map<string, DesignBoard>> {
  if (!ids.length) return new Map();
  return newestPer(await (await db()).select().from(designBoards).where(inArray(designBoards.businessId, ids)).orderBy(desc(designBoards.createdAt)));
}

async function newestJobs(ids: string[]): Promise<Map<string, PreviewJob>> {
  if (!ids.length) return new Map();
  return newestPer(await (await db()).select().from(previewJobs).where(inArray(previewJobs.businessId, ids)).orderBy(desc(previewJobs.createdAt)));
}

export function boardState(board: Pick<DesignBoard, "chosenAt" | "chosenLetter"> | undefined): BoardState {
  if (!board) return "none";
  if (!board.chosenAt) return "waiting";
  if (isRedrawn(board.chosenLetter) || revisedLetter(board.chosenLetter)) return "redrawing";
  return verdictOf(board.chosenLetter)?.verdict === "chose" ? "chosen" : "none";
}

function factsOf(row: ClaimedRow, board: DesignBoard | undefined, job: PreviewJob | undefined, reviewing: Set<string>): WorkFacts {
  return {
    ...row,
    board: boardState(board),
    building: Boolean(job && (ACTIVE_JOB_STATUSES as readonly string[]).includes(job.status)),
    failed: job?.status === "failed" && !isSkipped(job),
    awaitingReview: reviewing.has(row.id),
  };
}

/** Every business the designer took, the newest first, with where it stands and what it earned them. */
export async function designerBusinesses(designerId: string, now = Date.now()): Promise<DesignerBusiness[]> {
  const rows = await claimedRows(designerId);
  const ids = rows.map((row) => row.id);
  const [boards, jobs, reviewing, { followUpAfterDays }] = await Promise.all([newestBoards(ids), newestJobs(ids), reviewQueue(ids.length, ids), outreachSettings()]);
  const waitingReview = new Set(reviewing.map((item) => item.id));
  return rows.map(({ plan, priceArm, ...row }) => {
    const status = workStatus(factsOf({ plan, priceArm, ...row }, boards.get(row.id), jobs.get(row.id), waitingReview), followUpAfterDays, now);
    return { ...row, status, earnedCents: status === "client" ? monthlyFeeCents(plan, priceArm) : 0, boardId: boards.get(row.id)?.id ?? null };
  });
}

/** The designer's own businesses' boards that wait for their choice, the longest waiting first. */
export async function designerBoardsWaiting(ids: string[]): Promise<BoardWithLead[]> {
  const mine = new Set(ids);
  return (await boardsWaiting()).filter((board) => mine.has(board.businessId));
}

export async function claimedIds(designerId: string): Promise<string[]> {
  const rows = await (await db()).select({ id: designerClaims.businessId }).from(designerClaims).where(eq(designerClaims.designerId, designerId));
  return rows.map((row) => row.id);
}

/** The designer's built previews that wait for their review, in the order the founders' Review page takes them. */
export async function designerReviewQueue(designerId: string): Promise<ReviewItem[]> {
  const ids = await claimedIds(designerId);
  return reviewQueue(ids.length, ids);
}

/** Everything that waits for the designer, in the order to take it. */
export async function designerTurns(designerId: string): Promise<Turn[]> {
  const ids = await claimedIds(designerId);
  const [previews, boards] = await Promise.all([reviewQueue(ids.length, ids), designerBoardsWaiting(ids)]);
  return turnsOf(previews, boards, DESIGNER_TURN_PATHS);
}

/** What kind of business each one is and where, such as "Bakery in Pasadena", for a designer choosing one to take. */
export async function placesOf(ids: string[]): Promise<Map<string, string>> {
  if (!ids.length) return new Map();
  const rows = await (await db()).select({ id: businesses.id, niche: businesses.niche, area: businesses.area }).from(businesses).where(inArray(businesses.id, ids));
  return new Map(rows.map((row) => [row.id, [row.niche, row.area].filter(Boolean).join(" in ")]));
}
