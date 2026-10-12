/**
 * The welcome page an interested owner gets: what happens after they sign up, what the plan
 * includes, and their questions. Every promise here has to match the Terms and the onboarding
 * docs in defect-tech/02-system.
 */

export type Step = { title: string; detail: string };

/** In the order onboarding runs: changes, then the launch at their domain, which also sets up their portal. */
export function afterSignUp(domain: string | null): Step[] {
  return [
    { title: "Tell us what to change", detail: "Let us know if you'd like any changes to the website, and we'll get right to work!" },
    { title: "Your site goes live", detail: `We'll put it online and walk you through connecting your domain${domain ? `, ${domain}` : ""}.` },
    { title: "Activate your portal", detail: "Sign into your portal at defect.tech to see your visits, edit your site and manage your plan." },
  ];
}

export type Included = { title: string; detail: string };

export const INCLUDED: Included[] = [
  { title: "Changes by email", detail: "Send us new hours, prices or photos and we'll publish them, usually the same business day." },
  { title: "Editing it yourself", detail: "Change the wording, photos, hours and prices from your portal whenever you like. Every save is kept, so you can undo one." },
  { title: "Hosting and upkeep", detail: "We host the site and check its links and accessibility every year." },
  { title: "A monthly report", detail: "It shows how many people called you, asked for directions or emailed you from the site." },
  { title: "No setup fee or contract", detail: "You can cancel anytime from your portal. Your site stays up for at least 30 days afterward, so you have time to move it." },
];

export type Question = { question: string; answer: string };

export const QUESTIONS: Question[] = [
  {
    question: "What if I don't like something on the new site?",
    answer: "Tell us after you sign up and we'll change it before the site goes live. It's all part of getting set up.",
  },
  {
    question: "Who owns the website?",
    answer:
      "Your domain stays registered to you, and the words, photos and logo you give us stay yours. If you leave after twelve months with us, we send you the site's files at no charge.",
  },
  {
    question: "What if I want something bigger, like a new page or an online store?",
    answer: "Email us about it. We'll tell you whether it's part of your plan before we start anything.",
  },
  {
    question: "Can I pay yearly instead?",
    answer: "Yes. Once you've signed up, you can switch between monthly and yearly billing from your portal at the same price.",
  },
];

/** The explainer video, once it's made. The page leaves the section out until then. */
export type WelcomeVideo = { src: string; poster: string; captions: string };

export const WELCOME_VIDEO: WelcomeVideo | null = null;
