import { NextResponse } from "next/server";

const ENDPOINTS = [
  "GET /me",
  "GET /leads?stage=&email=&q=",
  "GET /leads/<id>",
  "POST /leads/<id>/note",
  "POST /leads/<id>/stage",
  "POST /flags",
  "GET /flags?status=",
  "GET /flags/<id>",
  "GET /activity?since=",
  "POST /heartbeat",
];

/** Lets a bot confirm the API is up before it has a key. Every endpoint below it needs Authorization: Bearer <DEFECT_BOT_KEY>. */
export function GET() {
  return NextResponse.json({
    ok: true,
    api: "Defect Technologies bot API",
    auth: "Send Authorization: Bearer <DEFECT_BOT_KEY> on every call below. Start with GET /me.",
    base: "https://defect.tech/api/bot",
    endpoints: ENDPOINTS,
  });
}
