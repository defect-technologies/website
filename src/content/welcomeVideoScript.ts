/**
 * The welcome video's voiceover, line by line, from the "Welcome video script" doc. Each line is
 * recorded on its own on the admin's Video page; an id stays the same when its words change, so a
 * take keeps its place.
 */
export type Speaker = "Brendan" | "Boris";

export type VoiceLine = { id: string; speaker: Speaker; onScreen: string; text: string };

export const VOICE_LINES: VoiceLine[] = [
  { id: "hello-brendan", speaker: "Brendan", onScreen: "You two, or the painted wordmark", text: "Hi, I'm Brendan." },
  { id: "hello-boris", speaker: "Boris", onScreen: "You two, or the painted wordmark", text: "And I'm Boris. We're the two people behind defect.tech." },
  {
    id: "how-it-works",
    speaker: "Brendan",
    onScreen: "Their new site preview",
    text: "You've seen the new website we designed for your business, here's how it works as a valued client of Defect Technologies.",
  },
  {
    id: "what-you-get",
    speaker: "Boris",
    onScreen: "The preview scrolling on a laptop and a phone",
    text: "We'll deploy your new site and keep it running. There's no setup fee or contract, and hosting is included.",
  },
  {
    id: "portal",
    speaker: "Brendan",
    onScreen: "Signing in, the visits chart, Edit my website, changing the hours and saving, then the Billing tab",
    text: "You'll get access to your portal on our platform. There you can see how many people visit your site, go in and edit it yourself, and manage your account and subscription. Anything you change goes live as soon as you save.",
  },
  {
    id: "email-changes",
    speaker: "Boris",
    onScreen: "An email asking for new Sunday hours, the review page, then the site with the new hours",
    text: "When you'd like us to change something about your website, just send an email to hello@defect.tech. We'll make the requested changes, send it to you for your review, and then publish it.",
  },
  {
    id: "sign-up",
    speaker: "Brendan",
    onScreen: "The welcome page scrolling to checkout, then the sign-up steps",
    text: "If you'd like to go ahead, sign up below, and our onboarding team will reach out to get you all set up. If you have any questions, look at the Q&A below, or just reply to our email!",
  },
  { id: "thank-you", speaker: "Boris", onScreen: "The painted wordmark", text: "Thank you, and let's build something beautiful, together." },
];
