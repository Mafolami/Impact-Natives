import { useState } from "react";

const AVATAR_COLORS = ["#2D6A4F", "#1B4FD8", "#7C3AED", "#E8622A", "#0D9488", "#D97706"];

export function avatarColor(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = id.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

export function initials(name: string): string {
  return name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();
}

interface AvatarProps {
  id: string;
  name: string | null | undefined;
  avatarUrl?: string | null;
  size?: "sm" | "md" | "lg";
  className?: string;
}

const SIZE_MAP = {
  sm: { outer: "w-7 h-7", text: "text-xs" },
  md: { outer: "w-10 h-10", text: "text-sm" },
  lg: { outer: "w-14 h-14", text: "text-lg" },
};

export function UserAvatar({ id, name, avatarUrl, size = "md", className = "" }: AvatarProps) {
  const [imgError, setImgError] = useState(false);
  const { outer, text } = SIZE_MAP[size];
  const color = avatarColor(id);
  const label = initials(name || "?");

  return (
    <div
      className={`${outer} rounded-full flex items-center justify-center shrink-0 overflow-hidden font-bold text-white ${className}`}
      style={{ background: avatarUrl && !imgError ? undefined : color }}
    >
      {avatarUrl && !imgError ? (
        <img
          src={avatarUrl}
          alt={name ?? "Avatar"}
          className="w-full h-full object-cover"
          onError={() => setImgError(true)}
        />
      ) : (
        <span className={text}>{label}</span>
      )}
    </div>
  );
}
