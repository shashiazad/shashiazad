// .github/scripts/update-readme.js
//
// Fetches this GitHub account's repos, excludes the profile README repo
// itself plus forks/archived/disabled repos, picks the top N by star count
// (falling back to most-recently-pushed), and rewrites the FEATURED-PROJECTS
// block in README.md with plain markdown + shields.io badges.
//
// No third-party image-generation service is used, so this can't break the
// way pin-card / stats-card services have.
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
    .filter(
      (r) =>
        !r.fork &&
        !r.archived &&
        !r.disabled &&
        r.name.toLowerCase() !== USERNAME.toLowerCase() // exclude the profile repo itself
    )
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
      const desc = r.description ? r.description.trim() : 'No description provided.';
      const lang = r.language || null;
      const badges = [
        `![Stars](https://img.shields.io/github/stars/${USERNAME}/${r.name}?style=flat-square&label=%E2%AD%90)`,
        lang
          ? `![Language](https://img.shields.io/badge/-${encodeURIComponent(
              lang
            )}-4c9be8?style=flat-square)`
          : null,
      ]
        .filter(Boolean)
        .join(' ');

      return `**[${r.name}](${r.html_url})**\n${desc}\n\n${badges}`;
    })
    .join('\n\n---\n\n');

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
  const updated = `${before}\n\n${block}\n\n${after}`;

  fs.writeFileSync(README_PATH, updated);
}

async function main() {
  const repos = await fetchRepos();
  const featured = pickFeatured(repos);

  if (featured.length === 0) {
    console.log('No eligible repos found — leaving README unchanged.');
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