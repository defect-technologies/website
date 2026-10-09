import { botRoute, readBody } from "@/server/bots/http";
import { addNote, NoteBody } from "@/server/bots/leads";

export const POST = botRoute(async ({ key, request, params }) => addNote(key, params.id, await readBody(request, NoteBody)));
