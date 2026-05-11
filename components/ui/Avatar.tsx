import Image from "next/image";
import { clsx } from "clsx";

interface AvatarProps {
  src: string | null;
  name: string;
  size?: number;
  className?: string;
}

export function Avatar({ src, name, size = 40, className }: AvatarProps) {
  const initials = name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase();

  return (
    <div
      className={clsx("rounded-full overflow-hidden flex-shrink-0 bg-amber/15 flex items-center justify-center", className)}
      style={{ width: size, height: size }}
    >
      {src ? (
        <Image src={src} alt={name} width={size} height={size} className="object-cover w-full h-full" />
      ) : (
        <span className="text-amber font-bold" style={{ fontSize: size * 0.38 }}>{initials}</span>
      )}
    </div>
  );
}
