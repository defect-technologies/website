import "server-only";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "../db/client";
import { botCalls, type BotKey } from "../db/schema";
import { keyFromRequest } from "./keys";

/** A refusal with a plain-language reason the bot can act on. */
export class BotError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

export type BotContext = { key: BotKey; request: Request; params: Record<string, string> };
type Handler = (context: BotContext) => Promise<unknown>;
type RouteContext = { params: Promise<Record<string, string>> };

const actorOf = (key: BotKey) => `bot:${key.bot}`;
export { actorOf };

export async function readBody<T>(request: Request, schema: z.ZodType<T>): Promise<T> {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) throw new BotError(400, z.prettifyError(parsed.error));
  return parsed.data;
}

function failure(error: unknown) {
  if (error instanceof BotError) return NextResponse.json({ error: error.message }, { status: error.status });
  console.error("[bot api]", error);
  return NextResponse.json({ error: "Something went wrong on our side. Try again on the next run, and flag it if it keeps happening." }, { status: 500 });
}

async function logCall(request: Request, key: BotKey | null, status: number) {
  const path = new URL(request.url).pathname;
  await (await db()).insert(botCalls).values({ keyId: key?.id ?? null, bot: key?.bot ?? null, method: request.method, path, status });
}

/** Wraps a bot API route: checks the key, runs the handler, logs the call. */
export function botRoute(handler: Handler) {
  return async (request: Request, context: RouteContext) => {
    const key = await keyFromRequest(request);
    if (!key) {
      await logCall(request, null, 401);
      return NextResponse.json({ error: "Missing, wrong or revoked key. Send it as Authorization: Bearer <DEFECT_BOT_KEY>." }, { status: 401 });
    }
    let response: NextResponse;
    try {
      response = NextResponse.json(await handler({ key, request, params: (await context.params) ?? {} }));
    } catch (error) {
      response = failure(error);
    }
    await logCall(request, key, response.status);
    return response;
  };
}
