// .github/scripts/update-readme.js
//
// Fetches this GitHub account's repos, picks the top N by star count
// (falling back to most-recently-pushed for ties/no stars), and rewrites
// the block between the FEATURED-PROJECTS markers in README.md.
//
// Requires Node 18+ (for global fetch) — GitHub's ubuntu-latest runner has this.

const fs = require('fs');

const USERNAME = process.env.GH_USERNAME || 'shashiazad';
const README_PATH = 'README.md';
const START_MARKER = '<!-- FEATURED-PROJECTS:START -->';
const END_MARKER = '<!-- FEATURED-PROJECTS:END -->';
const TOP_N = 3;

async function fetchRepos() {
  const res = await fetch(
    `https://api.github.com/users/${USERNAME}/repos?per_page=100&type=owner`,
    {
      headers: {
        Accept: 'application/vnd.github+json',
        ...(process.env.GITHUB_TOKEN
          ? { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` }
          : {}),
      },
    }
  );
  if (!res.ok) {
    throw new Error(`GitHub API error ${res.status}: ${await res.text()}`);
  }
  return res.json();
}

function pickFeatured(repos) {
  return repos
    .filter((r) => !r.fork && !r.archived && !r.disabled)
    .sort((a, b) => {
      if (b.stargazers_count !== a.stargazers_count) {
        return b.stargazers_count - a.stargazers_count;
      }
      return new Date(b.pushed_at) - new Date(a.pushed_at);
    })
    .slice(0, TOP_N);
}

function buildBlock(repos) {
  const cards = repos
    .map((r) => {
      const alt = r.name.replace(/"/g, "'");
      return `<a href="${r.html_url}">
  <img src="https://github-readme-stats.vercel.app/api/pin/?username=${USERNAME}&repo=${r.name}&theme=transparent&hide_border=true" alt="${alt}" />
</a>`;
    })
    .join('\n\n');

  return cards;
}

function updateReadme(block) {
  const readme = fs.readFileSync(README_PATH, 'utf8');
  const startIdx = readme.indexOf(START_MARKER);
  const endIdx = readme.indexOf(END_MARKER);

  if (startIdx === -1 || endIdx === -1) {
    throw new Error(
      `Could not find ${START_MARKER} / ${END_MARKER} markers in ${README_PATH}`
    );
  }

  const before = readme.slice(0, startIdx + START_MARKER.length);
  const after = readme.slice(endIdx);
  const updated = `${before}\n${block}\n${after}`;

  fs.writeFileSync(README_PATH, updated);
}

async function main() {
  const repos = await fetchRepos();
  const featured = pickFeatured(repos);

  if (featured.length === 0) {
    console.log('No eligible repos found (all forks/archived/empty) — leaving README unchanged.');
    return;
  }

  const block = buildBlock(featured);
  updateReadme(block);
  console.log(
    `Updated Featured Projects with: ${featured.map((r) => r.name).join(', ')}`
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});