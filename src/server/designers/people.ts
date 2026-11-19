import "server-only";
import { asc, eq, isNull } from "drizzle-orm";
import { founderName } from "@/lib/founders";
import { db } from "../db/client";
import { designers, type Designer } from "../db/schema";

export const normalizeEmail = (email: string) => email.trim().toLowerCase();

export async function allDesigners(): Promise<Designer[]> {
  return (await db()).select().from(designers).orderBy(asc(designers.name));
}

export async function designerById(id: string): Promise<Designer | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const [designer] = await (await db()).select().from(designers).where(eq(designers.id, id));
  return designer ?? null;
}

/** The designer who may sign in with this email: none once a founder deactivated them. */
export async function activeDesignerByEmail(email: string): Promise<Designer | null> {
  const [designer] = await (await db()).select().from(designers).where(eq(designers.email, normalizeEmail(email)));
  return designer && !designer.deactivatedAt ? designer : null;
}

export async function firstActiveDesigner(): Promise<Designer | null> {
  const [designer] = await (await db()).select().from(designers).where(isNull(designers.deactivatedAt)).orderBy(asc(designers.addedAt)).limit(1);
  return designer ?? null;
}

export type AddResult = "added" | "exists";

/** Adds a designer, or answers "exists" when one already has that email (active or not). */
export async function addDesigner(name: string, email: string, addedBy: string): Promise<AddResult> {
  const [row] = await (await db())
    .insert(designers)
    .values({ name: name.trim(), email: normalizeEmail(email), addedBy })
    .onConflictDoNothing()
    .returning({ id: designers.id });
  return row ? "added" : "exists";
}

export async function setDesignerActive(id: string, active: boolean, by: string): Promise<Designer | null> {
  const [designer] = await (await db())
    .update(designers)
    .set(active ? { deactivatedAt: null, deactivatedBy: "" } : { deactivatedAt: new Date(), deactivatedBy: by })
    .where(eq(designers.id, id))
    .returning();
  return designer ?? null;
}

export type Decider = { name: string; role: "founder" | "designer" };

/**
 * Who made a decision, from the email it was recorded under: a designer by their name, anyone else (a founder, or an
 * actor such as the runner) as the founders' code always named them.
 */
export async function deciders(): Promise<(email: string) => Decider> {
  const byEmail = new Map((await allDesigners()).map((designer) => [designer.email, designer.name]));
  return (email) => {
    const designerName = byEmail.get(normalizeEmail(email));
    return designerName ? { name: designerName, role: "designer" } : { name: founderName(email), role: "founder" };
  };
}
