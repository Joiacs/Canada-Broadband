export default function ContentPage({ title, lead, children }: { title: string; lead?: string; children: React.ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-10 sm:py-14">
      <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
        <span className="text-gradient">{title}</span>
      </h1>
      {lead && <p className="mt-3 text-lg text-muted">{lead}</p>}
      <div className="prose-page mt-6">{children}</div>
    </div>
  );
}
