import type { WelcomeVideo as Video } from "@/content/welcome";

export default function WelcomeVideo({ video }: { video: Video }) {
  return (
    <video controls preload="metadata" poster={video.poster} playsInline className="bg-ink shadow-lifted aspect-video w-full rounded-2xl">
      <source src={video.src} type="video/mp4" />
      <track kind="captions" src={video.captions} srcLang="en" label="English" default />
    </video>
  );
}
