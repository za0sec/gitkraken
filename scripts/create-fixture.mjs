// Isolated repository for integration tests; never writes to a user's repository.
import { mkdir, writeFile, access } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import path from "node:path";
export const fixture = path.resolve(".context/fixtures/constellation");
const git = (...args) =>
  execFileSync("git", args, {
    cwd: fixture,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
async function commit(file, content, subject, author = "Alex Rivera") {
  await mkdir(path.dirname(path.join(fixture, file)), { recursive: true });
  await writeFile(path.join(fixture, file), content);
  git("add", "--", file);
  git("-c", `user.name=${author}`, "commit", "-m", subject);
}
let exists = true;
try {
  await access(path.join(fixture, ".git"));
} catch {
  exists = false;
}
if (!exists) {
  await mkdir(fixture, { recursive: true });
  git("init", "-b", "main");
  git("config", "user.name", "Alex Rivera");
  git("config", "user.email", "alex@example.com");
  git("config", "commit.gpgsign", "false");
  git("config", "core.hooksPath", "/dev/null");
  await commit(
    "README.md",
    "# Constellation\n\nA space for great ideas.\n",
    "chore: initialize the workspace",
  );
  await commit(
    "package.json",
    '{"name":"constellation","version":"1.0.0"}\n',
    "chore: configure project dependencies",
  );
  await commit(
    "src/styles/tokens.css",
    ":root {\n  --surface: #202426;\n  --accent: #b2cb8c;\n}\n",
    "style: introduce the design tokens",
    "Sofía Chen",
  );
  git("tag", "v0.1.0");
  await commit(
    "src/app/layout.tsx",
    "export default function Layout({ children }) {\n  return <main>{children}</main>;\n}\n",
    "feat: build the application shell",
  );
  git("switch", "-c", "develop");
  await commit(
    "src/lib/workspace.ts",
    'export const workspace = { name: "Personal", projects: [] };\n',
    "feat: add workspace configuration",
    "Mateo Costa",
  );
  git("switch", "-c", "feature/sidebar");
  await commit(
    "src/components/sidebar.tsx",
    "export function Sidebar() {\n  return <aside>Projects</aside>;\n}\n",
    "feat: create the project sidebar",
    "Sofía Chen",
  );
  await commit(
    "src/components/navigation.tsx",
    'export const items = ["Overview", "Projects", "Activity"];\n',
    "feat: add workspace navigation",
    "Sofía Chen",
  );
  await commit(
    "src/styles/sidebar.css",
    ".sidebar {\n  width: 240px;\n  background: var(--surface);\n}\n",
    "style: refine sidebar spacing and colors",
    "Sofía Chen",
  );
  git("switch", "develop");
  await commit(
    "src/lib/search.ts",
    "export function search(items, query) {\n  return items.filter(item => item.name.includes(query));\n}\n",
    "feat: add project search",
    "Mateo Costa",
  );
  git("switch", "-c", "feature/command-menu");
  await commit(
    "src/components/command-menu.tsx",
    "export function CommandMenu() {\n  return <dialog>Where to next?</dialog>;\n}\n",
    "feat: introduce the command menu",
  );
  await commit(
    "src/hooks/use-shortcuts.ts",
    'export const shortcuts = { search: "meta+k", open: "meta+o" };\n',
    "feat: support keyboard shortcuts",
  );
  git("switch", "develop");
  git(
    "merge",
    "--no-ff",
    "feature/sidebar",
    "-m",
    "Merge branch feature/sidebar into develop",
  );
  await commit(
    "src/components/empty-state.tsx",
    "export function EmptyState() {\n  return <p>Your next idea starts here.</p>;\n}\n",
    "feat: design a calmer empty state",
    "Sofía Chen",
  );
  git("switch", "-c", "feature/activity-feed");
  await commit(
    "src/lib/activity.ts",
    "export const activity = [];\n",
    "feat: track workspace activity",
    "Mateo Costa",
  );
  await commit(
    "src/components/activity.tsx",
    "export function Activity() { return <section>Recent activity</section>; }\n",
    "feat: build the activity timeline",
    "Mateo Costa",
  );
  git("switch", "main");
  git("switch", "-c", "fix/search-focus");
  await commit(
    "src/hooks/use-focus.ts",
    "export function focusInput(ref) {\n  ref.current?.focus();\n}\n",
    "fix: restore focus after closing search",
  );
  git("switch", "main");
  git(
    "merge",
    "--no-ff",
    "fix/search-focus",
    "-m",
    "fix: improve search keyboard navigation (#18)",
  );
  git("switch", "develop");
  git(
    "merge",
    "--no-ff",
    "feature/command-menu",
    "-m",
    "feat: command menu and keyboard shortcuts (#21)",
  );
  await commit(
    "src/styles/tokens.css",
    ":root {\n  --surface: #202426;\n  --accent: #b2cb8c;\n  --border: #303537;\n  --radius: 6px;\n}\n",
    "style: polish borders and component corners",
    "Sofía Chen",
  );
  git("switch", "-c", "feature/project-cards");
  await commit(
    "src/components/project-card.tsx",
    "export function ProjectCard({ name }) {\n  return <article><h2>{name}</h2></article>;\n}\n",
    "feat: create the project card component",
    "Sofía Chen",
  );
  await commit(
    "src/styles/cards.css",
    ".card { padding: 24px; border-radius: 12px; }\n",
    "style: add hover states to project cards",
    "Sofía Chen",
  );
  git("switch", "develop");
  git(
    "merge",
    "--no-ff",
    "feature/activity-feed",
    "-m",
    "feat: workspace activity feed (#24)",
  );
  await commit(
    "src/lib/search.ts",
    "export function search(items, query) {\n  const normalized = query.toLowerCase().trim();\n  return items.filter(item => item.name.toLowerCase().includes(normalized));\n}\n",
    "fix: normalize search queries",
    "Mateo Costa",
  );
  git("switch", "main");
  git(
    "merge",
    "--no-ff",
    "develop",
    "-m",
    "feat: a new home for your projects (#27)",
  );
  git("tag", "v1.0.0");
  git("update-ref", "refs/remotes/origin/main", "HEAD");
  git("update-ref", "refs/remotes/origin/develop", "develop");
  await commit(
    "README.md",
    "# Constellation\n\nA space for great ideas.\n\n## Getting started\n\nOpen a workspace and make something great.\n",
    "docs: update the getting started guide",
  );
  await commit(
    "src/components/sidebar.tsx",
    'export function Sidebar() {\n  return <aside aria-label="Workspace">Projects</aside>;\n}\n',
    "fix: improve sidebar accessibility",
  );
  await writeFile(
    path.join(fixture, "README.md"),
    "# Constellation\n\nA space for great ideas.\n\n## Getting started\n\nOpen a workspace and make something great.\n\nMade with care.\n",
  );
  await writeFile(
    path.join(fixture, "src/styles/sidebar.css"),
    ".sidebar {\n  width: 260px;\n  background: var(--surface);\n  padding: 12px;\n}\n",
  );
  await writeFile(
    path.join(fixture, "notes.md"),
    "# Next steps\n\n- Polish navigation\n",
  );
}
const state = path.resolve(".context/test-state");
await mkdir(state, { recursive: true });
await writeFile(
  path.join(state, "repos.json"),
  JSON.stringify([{ path: fixture, name: "constellation" }]),
);
console.log("Integration fixture ready.");
