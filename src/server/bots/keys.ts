import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { and, desc, eq, isNull } from "drizzle-orm";
import { BOT_STAGES, type Bot } from "@/lib/bots";
import { db } from "../db/client";
import { botKeys, type BotKey } from "../db/schema";

const KEY_PREFIX = "dbk_";

const hash = (key: string) => createHash("sha256").update(key).digest("hex");

/** Makes a key for one bot. The key itself is returned once and never stored. */
export async function createBotKey(bot: Bot, name: string, createdBy: string): Promise<{ key: string; row: BotKey }> {
  const key = `${KEY_PREFIX}${randomBytes(32).toString("base64url")}`;
  const [row] = await (await db())
    .insert(botKeys)
    .values({ bot, name, keyHash: hash(key), stages: BOT_STAGES[bot], createdBy })
    .returning();
  return { key, row };
}

export async function listBotKeys(): Promise<BotKey[]> {
  return (await db()).select().from(botKeys).orderBy(desc(botKeys.createdAt));
}

export async function revokeBotKey(id: string): Promise<BotKey | null> {
  const [row] = await (await db())
    .update(botKeys)
    .set({ revokedAt: new Date() })
    .where(and(eq(botKeys.id, id), isNull(botKeys.revokedAt)))
    .returning();
  return row ?? null;
}

function bearerKey(request: Request): string {
  const header = request.headers.get("authorization") ?? "";
  return header.startsWith("Bearer ") ? header.slice(7).trim() : "";
}

/** The unrevoked key on this request, or null. Marks it used. */
export async function keyFromRequest(request: Request): Promise<BotKey | null> {
  const key = bearerKey(request);
  if (!key.startsWith(KEY_PREFIX)) return null;
  const [row] = await (await db())
    .update(botKeys)
    .set({ lastUsedAt: new Date() })
    .where(and(eq(botKeys.keyHash, hash(key)), isNull(botKeys.revokedAt)))
    .returning();
  return row ?? null;
}

export async function recordHeartbeat(keyId: string, routine: string) {
  await (await db()).update(botKeys).set({ lastHeartbeatAt: new Date(), lastRoutine: routine }).where(eq(botKeys.id, keyId));
}
