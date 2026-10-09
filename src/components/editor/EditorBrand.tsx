import KnifeStroke from "@/components/admin/KnifeStroke";

/** The defect.tech wordmark over a knife stroke, as on the admin sign-in. */
export default function EditorBrand() {
  return (
    <div className="relative isolate px-6">
      <KnifeStroke className="text-vermilion/20 absolute inset-x-0 top-1/2 -z-10 h-10 w-full -translate-y-1/3" />
      <p className="font-script text-ink text-6xl leading-[1.4]">defect.tech</p>
    </div>
  );
}
