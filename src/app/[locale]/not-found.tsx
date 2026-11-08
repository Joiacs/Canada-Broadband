import Link from "next/link";
import { getDictionary } from "@/i18n/dictionary";

// not-found can't read params; English with a French line keeps both audiences covered.
export default function NotFound() {
  const en = getDictionary("en");
  const fr = getDictionary("fr");
  return (
    <div className="mx-auto flex max-w-xl flex-1 flex-col items-center justify-center gap-3 px-4 py-24 text-center">
      <h1 className="text-2xl font-semibold">{en.notFound.title}</h1>
      <p className="text-muted">
        {en.notFound.body} <span lang="fr">{fr.notFound.body}</span>
      </p>
      <div className="flex gap-3">
        <Link href="/en" className="rounded-md bg-brand px-4 py-2 text-sm font-medium text-brand-contrast">
          {en.notFound.home}
        </Link>
        <Link href="/fr" lang="fr" className="rounded-md border border-border px-4 py-2 text-sm font-medium">
          {fr.notFound.home}
        </Link>
      </div>
    </div>
  );
}
