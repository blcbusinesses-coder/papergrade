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
const MAILTO = "papergrade@example.com"; // polite-pool identifier — no account needed

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

export async function searchPapers(query: string, limit = 3): Promise<FormattedPaper[]> {
  const trimmedQuery = query.slice(0, 120);

  const params = new URLSearchParams({
    search: trimmedQuery,
    "per-page": String(limit),
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
        console.warn(`OpenAlex rate limited. Retrying in ${wait}ms…`);
        await sleep(wait);
        continue;
      }

      if (!res.ok) {
        console.error("OpenAlex API error:", res.status, await res.text());
        return [];
      }

      const data = await res.json();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const works: any[] = data.results ?? [];

      return works
        .map((w) => {
          const abstract = reconstructAbstract(w.abstract_inverted_index);
          if (!abstract || abstract.length < 50) return null;

          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const authorships: any[] = w.authorships ?? [];
          const authorNames: string[] = authorships.map(
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (a: any) => a.author?.display_name ?? ""
          ).filter(Boolean);

          const authors =
            authorNames.length === 0
              ? "Unknown authors"
              : authorNames.length <= 2
              ? authorNames.join(" & ")
              : `${authorNames[0]} et al.`;

          // Prefer DOI link, fallback to landing page, then OpenAlex URL
          const url =
            w.doi ??
            w.primary_location?.landing_page_url ??
            w.id ??
            "https://openalex.org";

          return {
            title: w.title ?? "Untitled",
            authors,
            year: w.publication_year ?? null,
            url,
            abstract,
          } satisfies FormattedPaper;
        })
        .filter((p): p is FormattedPaper => p !== null)
        .slice(0, limit);

    } catch (err) {
      console.error("OpenAlex fetch failed:", err);
      return [];
    }
  }

  console.warn("OpenAlex: all retries exhausted.");
  return [];
}
