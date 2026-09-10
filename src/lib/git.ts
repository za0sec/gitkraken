import { execFile } from "node:child_process";
import { promisify } from "node:util";
import {
  readdir,
  readFile,
  writeFile,
  mkdir,
  realpath,
  lstat,
  rename,
} from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import type {
  Branch,
  ChangedFile,
  Commit,
  RepoData,
  Repository,
  GithubAccount,
  GithubRepo,
} from "./types";
const exec = promisify(execFile);
const env = {
  ...process.env,
  PATH: `${process.env.PATH || ""}:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin`,
  GIT_OPTIONAL_LOCKS: "0",
  GIT_TERMINAL_PROMPT: "0",
  GH_PROMPT_DISABLED: "1",
};
const stateDir =
  process.env.GITGROVE_DATA_DIR ||
  path.join(os.homedir(), "Library", "Application Support", "Gitgrove");
async function run(bin: string, args: string[], cwd?: string, timeout = 20000) {
  try {
    return (
      await exec(bin, args, {
        cwd,
        env,
        timeout,
        maxBuffer: 24 * 1024 * 1024,
        encoding: "utf8",
      })
    ).stdout;
  } catch (error) {
    const e = error as { stderr?: string; code?: string };
    throw new Error(
      e.code === "ENOENT"
        ? `No se encontró ${bin}. Instalalo para continuar.`
        : (e.stderr?.trim() || "No se pudo completar la operación.").slice(
            0,
            1500,
          ),
    );
  }
}
const git = (cwd: string, args: string[]) =>
  run("git", ["-c", "core.quotepath=false", "--no-pager", ...args], cwd);
export async function repoRoot(input: string) {
  if (typeof input !== "string" || !input.trim() || input.includes("\0"))
    throw new Error("Elegí la carpeta de un repositorio Git.");
  const resolved = await realpath(
    input.startsWith("~/")
      ? path.join(os.homedir(), input.slice(2))
      : path.resolve(input),
  );
  return (await git(resolved, ["rev-parse", "--show-toplevel"])).trim();
}
async function optional(cwd: string, args: string[]) {
  return git(cwd, args).catch(() => "");
}
const format = "%H%x00%P%x00%an%x00%ae%x00%aI%x00%s%x00%b%x00%D%x00";
export function parseCommits(raw: string): Commit[] {
  const fields = raw.split("\0");
  const commits: Commit[] = [];
  for (let i = 0; i + 7 < fields.length; i += 8) {
    const hash = fields[i].trim();
    if (!hash) continue;
    commits.push({
      hash,
      parents: fields[i + 1].split(" ").filter(Boolean),
      author: fields[i + 2],
      email: fields[i + 3],
      date: fields[i + 4],
      subject: fields[i + 5],
      body: fields[i + 6].trim(),
      refs: fields[i + 7].split(", ").filter(Boolean),
    });
  }
  return commits;
}
export function parseStatus(raw: string): ChangedFile[] {
  const entries = raw.split("\0");
  const files: ChangedFile[] = [];
  for (let i = 0; i < entries.length; i++) {
    const line = entries[i];
    if (!line) continue;
    const index = line[0],
      work = line[1];
    const file: ChangedFile = {
      path: line.slice(3),
      staged: index !== " " && index !== "?",
      status: index === "?" ? "?" : work !== " " ? work : index,
    };
    if (index === "R" || index === "C" || work === "R" || work === "C")
      file.oldPath = entries[++i];
    files.push(file);
  }
  return files;
}
export function parseNumstat(raw: string): ChangedFile[] {
  const items = raw.split("\0");
  const files: ChangedFile[] = [];
  for (let i = 0; i < items.length; i++) {
    if (!items[i]) continue;
    const [add, del, ...rest] = items[i].split("\t");
    let filePath = rest.join("\t");
    let oldPath: string | undefined;
    if (!filePath) {
      oldPath = items[++i];
      filePath = items[++i];
    }
    files.push({
      path: filePath,
      oldPath,
      status: oldPath ? "R" : "M",
      staged: false,
      additions: add === "-" ? 0 : Number(add),
      deletions: del === "-" ? 0 : Number(del),
      binary: add === "-",
    });
  }
  return files;
}
export async function getRepo(
  input: string,
  limit = 300,
  ref?: string,
): Promise<RepoData> {
  const root = await repoRoot(input);
  // Only user-facing refs. --all also walks internal checkpoints/archives and stashes.
  const head = (await optional(root, ["rev-parse", "--verify", "HEAD"])).trim();
  const refArgs = ref
    ? [await resolveRef(root, ref)]
    : ["--branches", "--remotes", "--tags", ...(head ? [head] : [])];
  const [log, refs, status, trees, stash, remote, branch, total] =
    await Promise.all([
      git(root, [
        "log",
        "--date-order",
        `--max-count=${limit + 1}`,
        `--format=${format}`,
        ...refArgs,
        "--",
      ]).catch(async (error) => {
        if (!(await optional(root, ["rev-parse", "--verify", "HEAD"])))
          return "";
        throw error;
      }),
      git(root, [
        "for-each-ref",
        "--format=%(refname)%00%(objectname)%00%(HEAD)%00%(upstream:short)%00%(upstream:track)%00",
        "refs/heads",
        "refs/remotes",
        "refs/tags",
      ]),
      git(root, ["status", "--porcelain=v1", "-z", "--untracked-files=normal"]),
      git(root, ["worktree", "list", "--porcelain", "-z"]),
      optional(root, ["stash", "list", "--format=%gd%x00%s%x00%H"]),
      git(root, ["remote", "-v"]),
      optional(root, ["symbolic-ref", "--short", "HEAD"]),
      optional(root, ["rev-list", "--count", ...refArgs, "--"]),
    ]);
  const branches: Branch[] = [],
    tags: RepoData["tags"] = [];
  for (const line of refs.trim().split("\n")) {
    const [name, hash, head, upstream, track] = line.split("\0");
    if (!name) continue;
    if (name.startsWith("refs/tags/")) {
      tags.push({ name: name.slice(10), hash });
      continue;
    }
    if (name.endsWith("/HEAD")) continue;
    branches.push({
      name: name.replace(/^refs\/(heads|remotes)\//, ""),
      hash,
      current: head === "*",
      remote: name.startsWith("refs/remotes/"),
      upstream,
      ahead: Number(track.match(/ahead (\d+)/)?.[1] || 0),
      behind: Number(track.match(/behind (\d+)/)?.[1] || 0),
    });
  }
  const worktrees = trees
    .split("\0\0")
    .filter(Boolean)
    .map((block) => {
      const fields = block.split("\0");
      const value = (key: string) =>
        fields.find((f) => f.startsWith(key + " "))?.slice(key.length + 1) ||
        "";
      return {
        path: value("worktree"),
        branch: value("branch").replace("refs/heads/", "") || "HEAD separado",
        head: value("HEAD"),
      };
    })
    .filter((tree) => tree.path);
  const commits = parseCommits(log);
  return {
    path: root,
    name: path.basename(root),
    head,
    branch: branch.trim() || (commits.length ? "HEAD separado" : "Sin commits"),
    commits: commits.slice(0, limit),
    branches,
    tags,
    files: parseStatus(status),
    worktrees,
    stashes: stash
      .trim()
      .split("\n")
      .filter(Boolean)
      .map((line) => {
        const [ref, subject, hash] = line.split("\0");
        return { ref, subject, hash };
      }),
    remotes: remote
      .split("\n")
      .filter((line) => line.endsWith("(fetch)"))
      .map((line) => {
        const [name, url] = line.split(/\s+/);
        return { name, url: url.replace(/(https?:\/\/)[^/@]+@/, "$1") };
      }),
    hasMore: commits.length > limit,
    total: Number(total.trim() || 0),
  };
}
async function resolveRef(root: string, ref: string) {
  if (
    typeof ref !== "string" ||
    !ref ||
    ref.startsWith("-") ||
    ref.includes("\0")
  )
    throw new Error("Referencia inválida.");
  return (
    await git(root, [
      "rev-parse",
      "--verify",
      "--end-of-options",
      `${ref}^{commit}`,
    ])
  ).trim();
}
export async function getCommit(input: string, ref: string) {
  const root = await repoRoot(input),
    hash = await resolveRef(root, ref);
  const [raw, stats] = await Promise.all([
    git(root, ["show", "-s", `--format=${format}`, hash, "--"]),
    git(root, [
      "diff-tree",
      "--root",
      "--no-commit-id",
      "--numstat",
      "-z",
      "-r",
      "-M",
      "--first-parent",
      hash,
      "--",
    ]),
  ]);
  const commit = parseCommits(raw)[0];
  const actualStats =
    commit.parents.length > 1
      ? await git(root, [
          "diff",
          "--numstat",
          "-z",
          "-M",
          commit.parents[0],
          hash,
          "--",
        ])
      : stats;
  return { commit, files: parseNumstat(actualStats) };
}
export async function getDiff(input: string, ref: string, file: string) {
  const root = await repoRoot(input);
  if (
    typeof file !== "string" ||
    !file ||
    file.includes("\0") ||
    path.isAbsolute(file) ||
    file.split("/").includes("..")
  )
    throw new Error("Ruta de archivo inválida.");
  let patch: string;
  if (ref === "working") {
    const files = parseStatus(
      await git(root, ["status", "--porcelain=v1", "-z"]),
    );
    const entry = files.find((f) => f.path === file);
    if (!entry)
      throw new Error(
        "Este archivo ya no tiene cambios. Actualizá el repositorio.",
      );
    if (entry.status === "?") {
      const target = path.join(root, file),
        info = await lstat(target);
      if (!info.isFile() || info.isSymbolicLink())
        return {
          patch:
            "Vista previa no disponible para carpetas o enlaces simbólicos.",
          truncated: false,
        };
      if (info.size > 1024 * 1024)
        return {
          patch: "Archivo demasiado grande para la vista previa (más de 1 MB).",
          truncated: true,
        };
      const content = await readFile(target);
      patch = content.includes(0)
        ? "Archivo binario."
        : `--- /dev/null\n+++ b/${file}\n` +
          content
            .toString("utf8")
            .split("\n")
            .map((line) => `+${line}`)
            .join("\n");
    } else {
      const hasHead = await optional(root, ["rev-parse", "--verify", "HEAD"]);
      const args = [
        "diff",
        "--no-ext-diff",
        "--no-textconv",
        "--no-color",
        "--unified=4",
      ];
      patch = hasHead
        ? await git(root, [
            ...args,
            "HEAD",
            "--",
            file,
            ...(entry.oldPath ? [entry.oldPath] : []),
          ])
        : (await git(root, [...args, "--cached", "--", file])) +
          (await git(root, [...args, "--", file]));
    }
  } else {
    const hash = await resolveRef(root, ref);
    const detail = await getCommit(root, hash);
    const parents = detail.commit.parents;
    const entry = detail.files.find((f) => f.path === file);
    const paths = [file, ...(entry?.oldPath ? [entry.oldPath] : [])];
    patch = parents.length
      ? await git(root, [
          "diff",
          "--no-ext-diff",
          "--no-textconv",
          "--no-color",
          "--unified=4",
          parents[0],
          hash,
          "--",
          ...paths,
        ])
      : await git(root, [
          "show",
          "--format=",
          "--no-ext-diff",
          "--no-textconv",
          "--no-color",
          "--unified=4",
          hash,
          "--",
          ...paths,
        ]);
  }
  return {
    patch:
      patch.slice(0, 500000) || "No hay diferencias de contenido para mostrar.",
    truncated: patch.length > 500000,
  };
}
export async function recentRepos(): Promise<Repository[]> {
  try {
    return JSON.parse(
      await readFile(path.join(stateDir, "repos.json"), "utf8"),
    );
  } catch {
    return [];
  }
}
let saveQueue = Promise.resolve();
export async function rememberRepo(input: string) {
  const root = await repoRoot(input);
  saveQueue = saveQueue
    .catch(() => {})
    .then(async () => {
      const repos = await recentRepos();
      await mkdir(stateDir, { recursive: true });
      const file = path.join(stateDir, "repos.json");
      await writeFile(
        `${file}.tmp`,
        JSON.stringify(
          [
            { path: root, name: path.basename(root) },
            ...repos.filter((r) => r.path !== root),
          ].slice(0, 30),
        ),
        { mode: 0o600 },
      );
      await rename(`${file}.tmp`, file);
    });
  await saveQueue;
  return { path: root, name: path.basename(root) };
}
export async function discoverRepos() {
  const found = new Map<string, Repository>(
    (await recentRepos()).map((r) => [r.path, r]),
  );
  let visited = 0;
  const scan = async (dir: string, depth: number): Promise<void> => {
    if (visited++ > 1200) return;
    const entries = await readdir(dir, { withFileTypes: true }).catch(() => []);
    if (entries.some((e) => e.name === ".git")) {
      found.set(dir, { path: dir, name: path.basename(dir) });
      return;
    }
    if (depth <= 0) return;
    for (const entry of entries)
      if (
        entry.isDirectory() &&
        !entry.name.startsWith(".") &&
        !["node_modules", "Library", "Applications", "dist", "build"].includes(
          entry.name,
        )
      )
        await scan(path.join(dir, entry.name), depth - 1);
  };
  if (!process.env.GITGROVE_DATA_DIR) {
    try {
      const root = await repoRoot(process.cwd());
      found.set(root, { path: root, name: path.basename(root) });
    } catch {}
  }
  for (const dir of [
    "Developer",
    "Projects",
    "Repos",
    "code",
    "github",
    "Documents/GitHub",
    "conductor/workspaces",
  ])
    await scan(path.join(/* turbopackIgnore: true */ os.homedir(), dir), 3);
  return [...found.values()];
}
export async function githubAccount(): Promise<{
  account: GithubAccount | null;
  error?: string;
}> {
  try {
    const account = JSON.parse(await run("gh", ["api", "user"]));
    return {
      account: {
        login: account.login,
        name: account.name,
        avatar_url: account.avatar_url,
      },
    };
  } catch {
    return {
      account: null,
      error:
        "Para conectar tu cuenta, ejecutá gh auth login en Terminal y volvé a intentar.",
    };
  }
}
export async function githubRepos(): Promise<GithubRepo[]> {
  return JSON.parse(
    await run("gh", [
      "repo",
      "list",
      "--limit",
      "100",
      "--json",
      "name,nameWithOwner,description,isPrivate,updatedAt,url",
    ]),
  );
}
export async function fetchRepo(input: string) {
  const root = await repoRoot(input);
  await run(
    "git",
    ["-c", "core.hooksPath=/dev/null", "fetch", "--all", "--prune"],
    root,
    120000,
  );
  return { ok: true };
}
export async function cloneRepo(repository: string, destination: string) {
  if (!/^[\w.-]+\/[\w.-]+$/.test(repository))
    throw new Error("Repositorio de GitHub inválido.");
  const folder = await realpath(
    destination.startsWith("~/")
      ? path.join(os.homedir(), destination.slice(2))
      : destination,
  );
  const target = path.join(folder, repository.split("/")[1]);
  await run(
    "gh",
    [
      "repo",
      "clone",
      repository,
      target,
      "--",
      "-c",
      "core.hooksPath=/dev/null",
    ],
    undefined,
    180000,
  );
  return rememberRepo(target);
}

export async function getAvatars(input: string, hashes: unknown) {
  if (
    !Array.isArray(hashes) ||
    hashes.length > 36 ||
    !hashes.every(
      (hash) => typeof hash === "string" && /^[a-f0-9]{40,64}$/.test(hash),
    )
  )
    throw new Error("Commits inválidos.");
  if (!hashes.length) return {};
  const root = await repoRoot(input);
  const { githubRepository, resolveAvatars } = await import("./avatars");
  const remotes = (await git(root, ["remote", "-v"]))
    .split("\n")
    .filter((line) => line.endsWith("(fetch)"));
  const repository = remotes
    .map((line) => githubRepository(line.split(/\s+/)[1] || ""))
    .find(Boolean);
  if (!repository) return {};
  const commits = parseCommits(
    await git(root, [
      "log",
      "--no-walk=unsorted",
      `--format=${format}`,
      ...hashes,
      "--",
    ]),
  );
  return resolveAvatars(
    repository,
    commits,
    path.join(stateDir, "avatars"),
    (args) => run("gh", args, undefined, 8000),
  );
}
