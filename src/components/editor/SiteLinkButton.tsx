import { PaperPlaneTilt } from "@phosphor-icons/react/dist/ssr";
import SubmitButton from "@/components/admin/SubmitButton";
import { Notice } from "@/components/admin/ui";

/** Emails the site's owner a sign-in link in one click. Used wherever we already know which site it's for. */
export default function SiteLinkButton({ slug, maskedEmail, problem }: { slug: string; maskedEmail: string; problem?: string }) {
  return (
    <form action="/edit/request-link" method="post" className="flex w-full flex-col gap-3">
      {problem && <Notice tone="bad">{problem}</Notice>}
      <input type="hidden" name="site" value={slug} />
      <SubmitButton variant="solid" icon={<PaperPlaneTilt size={20} weight="bold" aria-hidden="true" />}>
        Email me a sign-in link
      </SubmitButton>
      <p className="text-ink-soft text-sm">It goes to {maskedEmail}.</p>
    </form>
  );
}
