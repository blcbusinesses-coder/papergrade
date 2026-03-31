// Uses OpenAlex (https://openalex.org) — completely free, no API key needed.
// Adding a mailto param puts you in the "polite pool" with 10 req/s.

export interface FormattedPaper {
  title: string;
  authors: string;
  year: number | null;
  url: string;
  abstract: string;
}

const BASE_URL = "https://api.openalex.org";
const MAILTO = "papergrade@example.com";

// OpenAlex stores abstracts as an inverted index — reconstruct to plain text
function reconstructAbstract(invertedIndex: Record<string, number[]> | null | undefined): string {
  if (!invertedIndex) return "";
  const words: string[] = [];
  for (const [word, positions] of Object.entries(invertedIndex)) {
    for (const pos of positions) {
      words[pos] = word;
    }
  }
  return words.filter(Boolean).join(" ");
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function searchPapers(query: string, limit = 5): Promise<FormattedPaper[]> {
  if (!query?.trim()) return [];

  // Try up to 2 queries: exact title first, then first 6 words as a broader search
  const queries = [
    query.slice(0, 120),
    query.split(/\s+/).slice(0, 6).join(" "),
  ].filter((q, i, arr) => q.trim() && arr.indexOf(q) === i); // deduplicate

  for (const q of queries) {
    const results = await fetchPapers(q, limit);
    if (results.length > 0) return results;
  }

  return [];
}

async function fetchPapers(query: string, limit: number): Promise<FormattedPaper[]> {
  const params = new URLSearchParams({
    search: query,
    "per-page": String(Math.min(limit * 3, 25)), // fetch extra so filtering doesn't leave us with 0
    mailto: MAILTO,
    select: "id,title,abstract_inverted_index,authorships,publication_year,doi,primary_location",
  });

  const url = `${BASE_URL}/works?${params}`;

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(url, {
        headers: { "Accept": "application/json" },
        cache: "no-store",
      });

      if (res.status === 429) {
        const wait = 3000 * (attempt + 1);
        console.warn(`[PaperGrade] OpenAlex rate limited. Retrying in ${wait}ms…`);
        await sleep(wait);
        continue;
      }

      if (!res.ok) {
        console.error("[PaperGrade] OpenAlex error:", res.status, await res.text());
        return [];
      }

      const data = await res.json();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const works: any[] = data.results ?? [];

      console.log(`[PaperGrade] OpenAlex returned ${works.length} works for query: "${query.slice(0, 60)}"`);

      const papers: FormattedPaper[] = works
        .map((w) => {
          if (!w.title) return null;

          const abstract = reconstructAbstract(w.abstract_inverted_index);

          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const authorships: any[] = w.authorships ?? [];
          const authorNames: string[] = authorships
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            .map((a: any) => a.author?.display_name ?? "")
            .filter(Boolean);

          const authors =
            authorNames.length === 0
              ? "Unknown authors"
              : authorNames.length <= 2
              ? authorNames.join(" & ")
              : `${authorNames[0]} et al.`;

          const url =
            w.doi ??
            w.primary_location?.landing_page_url ??
            w.id ??
            "https://openalex.org";

          return {
            title: w.title,
            authors,
            year: w.publication_year ?? null,
            url,
            abstract, // may be empty string — that's fine for display purposes
          } satisfies FormattedPaper;
        })
        .filter((p): p is FormattedPaper => p !== null)
        .slice(0, limit);

      console.log(`[PaperGrade] Returning ${papers.length} papers after filtering`);
      return papers;

    } catch (err) {
      console.error("[PaperGrade] OpenAlex fetch failed:", err);
      return [];
    }
  }

  console.warn("[PaperGrade] OpenAlex: all retries exhausted.");
  return [];
}
