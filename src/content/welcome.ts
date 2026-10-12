/**
 * The welcome page an interested owner gets: what happens after they sign up, what the plan
 * includes, and their questions. Every promise here has to match the Terms and the onboarding
 * docs in defect-tech/02-system.
 */

export type Step = { title: string; detail: string };

/** In the order onboarding runs: the portal opens at payment, then changes, then the launch at their domain. */
export function afterSignUp(domain: string | null): Step[] {
  return [
    { title: "Sign in to your portal", detail: "We'll email you a link right away. Your portal shows each step to putting your website live and what we need from you." },
    { title: "Tell us what to change", detail: "Let us know anything you'd like changed on the website. We'll get right to work on it!" },
    { title: "Your website goes live", detail: `We'll put your website online. Your portal will show you how to connect ${domain ?? "your domain"} to it.` },
  ];
}

export type Included = { title: string; detail: string };

export const INCLUDED: Included[] = [
  { title: "Changes by email", detail: "Send us new hours, prices or photos. We'll usually publish them the same business day." },
  { title: "Editing it yourself", detail: "Change the wording, photos, hours and prices from your portal whenever you like. You can always go back to an earlier version." },
  { title: "Hosting and upkeep", detail: "We host your website. Once a year, we also check that its links work and that people with disabilities can use it." },
  { title: "A monthly report", detail: "Each month's report shows how many people called you, asked for directions or emailed you from your website." },
  { title: "No setup fee or contract", detail: "You can cancel anytime from your portal. To give you time to move your website, we'll keep it up for at least 30 days after you cancel." },
];

export type Question = { question: string; answer: string };

export const QUESTIONS: Question[] = [
  {
    question: "What if I don't like something on the new website?",
    answer: "Tell us after you sign up. Changes like that are part of setting up your website. We'll make them before it goes live.",
  },
  {
    question: "Who owns the website?",
    answer:
      "Your domain stays registered to you. The words, photos and logo you give us stay yours too. If you leave after twelve months with us, we'll send you the website's files at no charge.",
  },
  {
    question: "What if I want something bigger, like a new page or an online store?",
    answer: "Email us what you have in mind. Before we start anything, we'll tell you whether it's part of your plan.",
  },
  {
    question: "Can I pay yearly instead?",
    answer: "Yes! Once you've signed up, you can switch between monthly and yearly billing from your portal. The price is the same either way.",
  },
];

/** The explainer video, once it's made. The page leaves the section out until then. */
export type WelcomeVideo = { src: string; poster: string; captions: string };

export const WELCOME_VIDEO: WelcomeVideo | null = null;
