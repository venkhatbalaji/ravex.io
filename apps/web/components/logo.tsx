import Link from "next/link";

type LogoProps = { href?: string; className?: string };

export function Logo({ href = "/", className = "" }: LogoProps) {
  return (
    <Link href={href} className={`brand-logo ${className}`.trim()} aria-label="Ravex home">
      <svg className="brand-mark" viewBox="0 0 112 60" role="img" aria-hidden="true">
        <path className="mark-yellow" d="M79 8h20a8 8 0 0 1 8 8v17a8 8 0 0 1-8 8H79a8 8 0 0 1-8-8V16a8 8 0 0 1 8-8Z" />
        <path className="mark-green" d="M35 29 48.4 6.5a6 6 0 0 1 10.3 0l16.7 28a6 6 0 0 1-5.2 9.1H36.8a6 6 0 0 1-5.2-9.1L35 29Z" />
        <path className="mark-red" d="M65.5 21.5h22a6 6 0 0 1 5.2 9l-14 23.5a6 6 0 0 1-10.4 0l-14-23.5a6 6 0 0 1 5.2-9h6Z" />
        <path className="mark-blue" d="M9 22h20a8 8 0 0 1 8 8v17a8 8 0 0 1-8 8H9a8 8 0 0 1-8-8V30a8 8 0 0 1 8-8Z" />
      </svg>
      <span className="brand-word">RAVEX</span>
    </Link>
  );
}
