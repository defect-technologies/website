import Image from "next/image";

type AvatarSize = "xs" | "sm" | "md" | "lg" | "xl";

interface AvatarProps {
  src?: string | null;
  name: string;
  size?: AvatarSize;
  className?: string;
}

const sizeMap: Record<AvatarSize, { container: string; text: string; pixels: number }> = {
  xs: { container: "h-6 w-6", text: "text-[0.5rem]", pixels: 24 },
  sm: { container: "h-8 w-8", text: "text-xs", pixels: 32 },
  md: { container: "h-10 w-10", text: "text-sm", pixels: 40 },
  lg: { container: "h-14 w-14", text: "text-lg", pixels: 56 },
  xl: { container: "h-20 w-20", text: "text-2xl", pixels: 80 },
};

function getInitials(name: string) {
  return name
    .split(" ")
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export default function Avatar({ src, name, size = "md", className = "" }: AvatarProps) {
  const { container, text, pixels } = sizeMap[size];

  if (src) {
    return (
      <Image
        src={src}
        alt={name}
        width={pixels}
        height={pixels}
        className={`${container} rounded-full object-cover ${className}`}
      />
    );
  }

  return (
    <div
      className={`${container} rounded-full bg-secondary/20 text-secondary flex items-center justify-center font-medium ${text} ${className}`}
    >
      {getInitials(name || "?")}
    </div>
  );
}
