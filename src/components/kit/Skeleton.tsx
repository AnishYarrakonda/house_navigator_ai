// Skeleton — a quiet, non-punishing loading placeholder (shimmering surface
// block, see .wp-skeleton in tokens.css). Used while data hooks are loading. No
// spinners, no urgency.

interface SkeletonProps {
  /** Tailwind height/width/extra classes. */
  className?: string;
  /** Accessible label for the loading region. */
  label?: string;
}

export default function Skeleton({ className = "", label }: SkeletonProps) {
  return (
    <div
      className={"wp-skeleton " + className}
      role="status"
      aria-label={label}
      aria-busy="true"
    />
  );
}
