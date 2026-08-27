import type { SVGProps } from "react";

/** Shared stroke defaults so every activity-bar glyph reads at the same weight. */
function Icon({ children, ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={20}
      height={20}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      {children}
    </svg>
  );
}

export function ExplorerIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <path d="M3 6.5A1.5 1.5 0 0 1 4.5 5H9l1.5 2H19.5A1.5 1.5 0 0 1 21 8.5v9A1.5 1.5 0 0 1 19.5 19h-15A1.5 1.5 0 0 1 3 17.5v-11Z" />
    </Icon>
  );
}

export function LogsIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <path d="M4 5h16M4 9.5h16M4 14h10M4 18.5h6" />
    </Icon>
  );
}

export function TerminalIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <rect x="3" y="4" width="18" height="16" rx="1.5" />
      <path d="m7 9 3 3-3 3M13 15h4" />
    </Icon>
  );
}

export function PreviewIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <rect x="3" y="5" width="18" height="14" rx="1.5" />
      <path d="M3 9h18" />
    </Icon>
  );
}
