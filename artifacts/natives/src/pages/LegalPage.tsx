import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import ReactMarkdown from "react-markdown";

const DOCS: Record<string, { title: string; file: string }> = {
  privacy:  { title: "Privacy Policy",  file: "/legal/privacy-policy.md" },
  terms:    { title: "Terms of Service", file: "/legal/terms-of-service.md" },
  cookies:  { title: "Cookie Policy",   file: "/legal/cookie-policy.md" },
};

export default function LegalPage() {
  const [location] = useLocation();
  const slug = location.split("/legal/")[1] ?? "";
  const doc = DOCS[slug];

  const [content, setContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!doc) return;
    setLoading(true);
    fetch(doc.file)
      .then((r) => r.text())
      .then((text) => { setContent(text); setLoading(false); })
      .catch(() => { setContent("Failed to load document."); setLoading(false); });
  }, [slug]);

  return (
    <div className="min-h-screen bg-background">
      {/* Nav */}

      <div className="max-w-3xl mx-auto px-6 py-12">
        {/* Doc switcher */}
        <div className="flex gap-2 mb-10 flex-wrap">
          {Object.entries(DOCS).map(([key, { title }]) => (
            <Link key={key} href={`/legal/${key}`}>
              <span className={`px-4 py-1.5 rounded-full text-sm border transition-colors cursor-pointer ${
                slug === key
                  ? "bg-[#2D6A4F] text-white border-[#2D6A4F]"
                  : "border-border text-muted-foreground hover:border-foreground/30"
              }`}>
                {title}
              </span>
            </Link>
          ))}
        </div>

        {/* Content */}
        {!doc ? (
          <div className="text-center py-20">
            <h1 className="text-2xl font-bold text-foreground mb-4">Legal</h1>
            <p className="text-sm text-muted-foreground mb-8">Choose a document to view.</p>          
            <div className="flex flex-col gap-3 max-w-xs mx-auto">
              {Object.entries(DOCS).map(([key, { title }]) => (
                <Link key={key} href={`/legal/${key}`}>
                  <span className="block px-5 py-3 rounded-xl border border-border hover:border-[#2D6A4F]/40 text-sm font-medium text-foreground transition-colors cursor-pointer">
                    {title} →
                  </span>
                </Link>
              ))}
            </div>
          </div>
        ) : loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-5 h-5 border-2 border-[#2D6A4F] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <article className="prose prose-neutral dark:prose-invert max-w-none
            prose-headings:font-semibold prose-headings:tracking-tight
            prose-h1:text-3xl prose-h1:mb-2
            prose-h2:text-xl prose-h2:mt-8 prose-h2:mb-3
            prose-h3:text-base prose-h3:mt-6
            prose-p:text-foreground prose-p:leading-relaxed
            prose-li:text-foreground
            prose-a:text-[#2D6A4F] prose-a:no-underline hover:prose-a:underline
            prose-strong:text-foreground
            prose-table:text-sm prose-th:text-foreground prose-td:text-foreground
            prose-hr:border-border">
            <ReactMarkdown>{content ?? ""}</ReactMarkdown>
          </article>
        )}
      </div>

      
    </div>
  );
}
