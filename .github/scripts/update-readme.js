const fs = require('fs');

const USERNAME = process.env.GH_USERNAME || 'shashiazad';
const README_PATH = 'README.md';
const START_MARKER = '<!-- FEATURED-PROJECTS:START -->';
const END_MARKER = '<!-- FEATURED-PROJECTS:END -->';
const TOP_N = 3;
const MEDALS = ['🥇', '🥈', '🥉'];

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

function buildCard(repo, rank) {
  const medal = MEDALS[rank] || '📦';
  const desc = repo.description
    ? repo.description.trim()
    : 'No description provided.';
  const tags = (repo.topics || [])
    .slice(0, 6)
    .map((t) => `\`${t}\``)
    .join(' ');

  const badges = [
    `![Stars](https://img.shields.io/github/stars/${USERNAME}/${repo.name}?style=flat-square&label=%E2%AD%90&color=f0c674)`,
    `![Last Commit](https://img.shields.io/github/last-commit/${USERNAME}/${repo.name}?style=flat-square&label=updated)`,
    repo.language
      ? `![Language](https://img.shields.io/badge/-${encodeURIComponent(
          repo.language
        )}-4c9be8?style=flat-square)`
      : null,
  ]
    .filter(Boolean)
    .join(' ');

  const homepage =
    repo.homepage && repo.homepage.trim()
      ? ` · [🔗 Live Demo](${repo.homepage.trim()})`
      : '';

  return [
    `### ${medal} [${repo.name}](${repo.html_url})${homepage}`,
    desc,
    tags ? tags : null,
    badges,
  ]
    .filter(Boolean)
    .join('\n\n');
}

function buildBlock(repos) {
  return repos.map((r, i) => buildCard(r, i)).join('\n\n---\n\n');
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