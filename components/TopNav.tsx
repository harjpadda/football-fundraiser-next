import Link from "next/link";
import { signOut } from "next-auth/react";

type Props = {
  title?: string;
  subtitle?: string;
  rightSlot?: React.ReactNode; // optional extra buttons/links on the right
};

export default function TopNav({ title, subtitle, rightSlot }: Props) {
  return (
    <div className="sticky top-0 z-30 bg-slate-950/85 backdrop-blur border-b border-slate-800">
      <div className="max-w-6xl mx-auto px-4 py-3">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="min-w-0">
            {title && (
              <div className="text-lg sm:text-xl font-semibold truncate">{title}</div>
            )}
            {subtitle && (
              <div className="text-xs sm:text-sm text-slate-400 truncate">
                {subtitle}
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Link
              href="/my-entries"
              className="flex-1 sm:flex-none text-center text-sm text-slate-200 border border-slate-700 rounded-xl px-3 py-2.5 hover:bg-slate-800 transition"
            >
              My entries
            </Link>

            {rightSlot}

            <button
              onClick={() => signOut({ callbackUrl: "/auth/signin" })}
              className="flex-1 sm:flex-none text-center text-sm text-slate-200 border border-slate-700 rounded-xl px-3 py-2.5 hover:bg-slate-800 transition"
              type="button"
            >
              Sign out
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
