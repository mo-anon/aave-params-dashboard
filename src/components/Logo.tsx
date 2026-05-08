import { useState } from "react";

type Props = {
  src: string | null;
  alt: string;
  size: number;
  rounded?: boolean;
};

export function Logo({ src, alt, size, rounded }: Props) {
  const [failed, setFailed] = useState(false);
  const placeholder = (
    <span
      aria-hidden
      style={{
        display: "inline-block",
        width: size,
        height: size,
        borderRadius: rounded ? "50%" : 2,
        background: "var(--bg-sunken)",
        border: "1px solid var(--border)",
        verticalAlign: "middle",
      }}
    />
  );
  if (!src || failed) return placeholder;
  return (
    <img
      src={src}
      alt={alt}
      width={size}
      height={size}
      style={{
        width: size,
        height: size,
        borderRadius: rounded ? "50%" : 2,
        verticalAlign: "middle",
        objectFit: "contain",
      }}
      onError={() => setFailed(true)}
      loading="lazy"
    />
  );
}
