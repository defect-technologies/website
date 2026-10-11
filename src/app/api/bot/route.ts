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
  "POST /flags/<id>/close",
  "GET /activity?since=",
  "GET /inbound?status=&kind=",
  "GET /inbound/<id>",
  "POST /inbound/<id>/sort",
  "POST /inbound/<id>/reply",
  "POST /heartbeat",
];

/** Lets a bot confirm the API is up before it has a key. Every endpoint below it needs Authorization: Bearer <your bot's key, e.g. DEFECT_OUTREACH_KEY>. */
export function GET() {
  return NextResponse.json({
    ok: true,
    api: "Defect Technologies bot API",
    auth: "Send Authorization: Bearer <your bot's key, e.g. DEFECT_OUTREACH_KEY> on every call below. Start with GET /me.",
    base: "https://defect.tech/api/bot",
    endpoints: ENDPOINTS,
  });
}
