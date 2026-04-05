import Link from "next/link";
import Image from "next/image";

export default function BrandLogo({ href = "/", compact = false }) {
  const content = (
    <div className="flex items-center gap-3">
      <div className="brand-chip flex h-9 w-9 items-center justify-center rounded-lg text-white neon-purple">
        <Image src="/logo.svg" alt="DocuGyan logo" width={20} height={20} className="h-5 w-5 object-contain" priority />
      </div>
      {!compact && <span className="docu-title text-xl font-bold tracking-tight">DocuGyan</span>}
    </div>
  );

  if (!href) return content;

  return (
    <Link href={href} className="inline-flex items-center">
      {content}
    </Link>
  );
}
