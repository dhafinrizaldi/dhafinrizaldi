// Aggregates language byte counts across the C-Cube Dashboard repos (private,
// owned by the C-Cube-International org) and renders them as an SVG bar,
// since GitHub's language stats never include org-owned repos on a personal
// profile.
const REPOS = [
  "C-Cube-International/C-Cube-Dashboard-Frontend",
  "C-Cube-International/C-Cube-Dashboard-Backend",
  "C-Cube-International/C-Cube-Dashboard-Local",
  "C-Cube-International/LLM4ECM",
];

const TOKEN = process.env.GH_TOKEN;
if (!TOKEN) {
  console.error("GH_TOKEN env var is required");
  process.exit(1);
}

// GitHub linguist colors for common languages; unlisted languages fall back to gray.
const LANG_COLORS = {
  TypeScript: "#3178c6",
  JavaScript: "#f1e05a",
  Python: "#3572A5",
  HTML: "#e34c26",
  CSS: "#563d7c",
  SCSS: "#c6538c",
  Dockerfile: "#384d54",
  Shell: "#89e051",
  "Jupyter Notebook": "#DA5B0B",
  Vue: "#41b883",
  Mako: "#7e858d",
  PLpgSQL: "#336790",
  Makefile: "#427819",
  Procfile: "#c7bd97",
};
const FALLBACK_COLOR = "#8b949e";

async function fetchLanguages(repo) {
  const res = await fetch(`https://api.github.com/repos/${repo}/languages`, {
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
    },
  });
  if (!res.ok) {
    throw new Error(`GitHub API error for ${repo}: ${res.status} ${await res.text()}`);
  }
  return res.json();
}

function renderSvg(langs) {
  const total = langs.reduce((sum, l) => sum + l.bytes, 0);
  const width = 480;
  const barHeight = 22;
  const rowHeight = 26;
  const padding = 16;
  const legendCols = 2;
  const legendRows = Math.ceil(langs.length / legendCols);
  const height = padding * 2 + barHeight + 16 + legendRows * rowHeight;

  let x = padding;
  const barWidth = width - padding * 2;
  const segments = langs
    .map((l) => {
      const w = (l.bytes / total) * barWidth;
      const rect = `<rect x="${x.toFixed(2)}" y="0" width="${w.toFixed(2)}" height="${barHeight}" fill="${l.color}" />`;
      x += w;
      return rect;
    })
    .join("\n    ");

  const legend = langs
    .map((l, i) => {
      const col = i % legendCols;
      const row = Math.floor(i / legendCols);
      const lx = padding + col * (barWidth / legendCols);
      const ly = barHeight + 32 + row * rowHeight;
      const pct = ((l.bytes / total) * 100).toFixed(1);
      return `<g transform="translate(${lx}, ${ly})">
      <circle cx="6" cy="-4" r="6" fill="${l.color}" />
      <text x="18" y="0" font-family="-apple-system,BlinkMacSystemFont,Segoe UI,Helvetica,Arial,sans-serif" font-size="13" fill="#c9d1d9">${l.name} ${pct}%</text>
    </g>`;
    })
    .join("\n    ");

  return `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Language breakdown across the C-Cube Dashboard repositories">
  <rect width="${width}" height="${height}" rx="8" fill="#1a1b27" />
  <g transform="translate(${padding}, ${padding})">
    <clipPath id="bar-clip"><rect x="0" y="0" width="${barWidth}" height="${barHeight}" rx="6" /></clipPath>
    <g clip-path="url(#bar-clip)">
    ${segments}
    </g>
    ${legend}
  </g>
</svg>`;
}

const perRepo = await Promise.all(REPOS.map(fetchLanguages));

const totals = new Map();
for (const langs of perRepo) {
  for (const [name, bytes] of Object.entries(langs)) {
    totals.set(name, (totals.get(name) ?? 0) + bytes);
  }
}

const sorted = [...totals.entries()]
  .sort((a, b) => b[1] - a[1])
  .map(([name, bytes]) => ({ name, bytes, color: LANG_COLORS[name] ?? FALLBACK_COLOR }));

const fs = await import("node:fs/promises");
await fs.mkdir("assets", { recursive: true });
await fs.writeFile("assets/org-langs.svg", renderSvg(sorted));

console.log("Wrote assets/org-langs.svg with", sorted.length, "languages across", REPOS.length, "repos");
