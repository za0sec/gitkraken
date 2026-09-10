import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import {
  mkdtemp,
  writeFile,
  mkdir,
  rm,
  realpath,
  symlink,
} from "node:fs/promises";
import { execFileSync } from "node:child_process";
import os from "node:os";
import path from "node:path";
import {
  getRepo,
  getCommit,
  getDiff,
  parseStatus,
  parseNumstat,
} from "../src/lib/git";
import { layoutGraph } from "../src/lib/graph";
let root: string;
const git = (...args: string[]) =>
  execFileSync("git", args, {
    cwd: root,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
before(async () => {
  root = await realpath(
    await mkdtemp(path.join(os.tmpdir(), "gitgrove-test-")),
  );
  git("init", "-b", "main");
  git("config", "user.name", "Test Author");
  git("config", "user.email", "test@example.com");
  git("config", "commit.gpgsign", "false");
  git("config", "core.hooksPath", "/dev/null");
  await writeFile(path.join(root, "hello.txt"), "hello\n");
  git("add", ".");
  git("commit", "-m", "Initial commit");
  git("switch", "-c", "feature");
  await writeFile(path.join(root, "feature.txt"), "feature\n");
  git("add", ".");
  git("commit", "-m", "Add feature");
  git("switch", "main");
  await writeFile(path.join(root, "main.txt"), "main\n");
  git("add", ".");
  git("commit", "-m", "Main work");
  git("merge", "--no-ff", "feature", "-m", "Merge feature");
  git("tag", "v1.0");
});
after(async () => {
  await rm(root, { recursive: true, force: true });
});
test("reads real branches, tags, commits and merge parents", async () => {
  const repo = await getRepo(root);
  assert.equal(repo.branch, "main");
  assert.equal(repo.commits.length, 4);
  assert.equal(repo.total, 4);
  assert.equal(repo.commits[0].parents.length, 2);
  assert.equal(repo.tags[0].name, "v1.0");
  assert.equal(repo.branches.find((b) => b.current)?.name, "main");
  assert.equal(repo.worktrees[0].path, root);
  assert.equal(repo.worktrees[0].branch, "main");
  const detail = await getCommit(root, repo.commits[0].hash);
  assert.equal(detail.files[0].path, "feature.txt");
  assert.equal(detail.files[0].additions, 1);
  const diff = await getDiff(root, repo.commits[0].hash, "feature.txt");
  assert.match(diff.patch, /\+feature/);
});
test("root commits include their files and diff", async () => {
  const repo = await getRepo(root),
    hash = repo.commits.at(-1)!.hash;
  const detail = await getCommit(root, hash);
  assert.equal(detail.files[0].path, "hello.txt");
  assert.match((await getDiff(root, hash, "hello.txt")).patch, /\+hello/);
});
test("branch filters follow ancestry and graph edges preserve parents", async () => {
  const repo = await getRepo(root, 300, "feature");
  assert.equal(repo.commits.length, 2);
  const all = await getRepo(root);
  const graph = layoutGraph(all.commits);
  assert.equal(graph.rows.length, all.commits.length);
  assert.ok(graph.width >= 2);
  graph.rows.forEach((row, index) => {
    assert.equal(row.parents.length, all.commits[index].parents.length);
    row.parents.forEach((parent, p) =>
      assert.equal(row.after[parent.lane], all.commits[index].parents[p]),
    );
    row.before.forEach((hash, lane) => {
      if (hash && hash !== all.commits[index].hash)
        assert.equal(row.after[lane], hash);
    });
  });
});
test("rejects option injection and traversal", async () => {
  await assert.rejects(
    () => getRepo(root, 300, "--output=/tmp/nope"),
    /Referencia inválida/,
  );
  await assert.rejects(
    () => getDiff(root, "HEAD", "../private"),
    /Ruta de archivo inválida/,
  );
});
test("handles working changes, spaces, untracked files, and rename status", async () => {
  await writeFile(path.join(root, "hello.txt"), "hello\nupdated\n");
  await writeFile(path.join(root, "new file.txt"), "new content\n");
  const repo = await getRepo(root);
  assert.equal(repo.files.length, 2);
  assert.match(
    (await getDiff(root, "working", "hello.txt")).patch,
    /\+updated/,
  );
  assert.match(
    (await getDiff(root, "working", "new file.txt")).patch,
    /\+new content/,
  );
  git("mv", "main.txt", "renamed file.txt");
  const renamed = (await getRepo(root)).files.find(
    (f) => f.path === "renamed file.txt",
  );
  assert.equal(renamed?.oldPath, "main.txt");
  assert.equal(renamed?.staged, true);
  assert.match(
    (await getDiff(root, "working", "renamed file.txt")).patch,
    /rename to renamed file.txt/,
  );
});
test("untracked symlinks are not read", async () => {
  await symlink("/etc/hosts", path.join(root, "external-link"));
  assert.match(
    (await getDiff(root, "working", "external-link")).patch,
    /enlaces simbólicos/,
  );
});
test("parses tabs and rename paths in numstat and NUL-delimited status", () => {
  assert.deepEqual(parseNumstat("2\t1\t\0old\tfile.ts\0new\tfile.ts\0"), [
    {
      path: "new\tfile.ts",
      oldPath: "old\tfile.ts",
      status: "R",
      staged: false,
      additions: 2,
      deletions: 1,
      binary: false,
    },
  ]);
  assert.equal(parseStatus("?? a\nfile.txt\0")[0].path, "a\nfile.txt");
});
test("unborn repositories and staged files can be explored", async () => {
  const empty = path.join(root, "empty");
  await mkdir(empty);
  execFileSync("git", ["init", "-b", "main"], { cwd: empty, stdio: "ignore" });
  const repo = await getRepo(empty);
  assert.equal(repo.commits.length, 0);
  assert.equal(repo.branch, "main");
  await writeFile(path.join(empty, "start.txt"), "first\n");
  execFileSync("git", ["add", "."], { cwd: empty });
  assert.match((await getDiff(empty, "working", "start.txt")).patch, /\+first/);
});

test("excludes checkpoint and archive namespaces without deleting real branch history", async () => {
  const before = await getRepo(root);
  const checkpoint = git(
    "commit-tree",
    "HEAD^{tree}",
    "-m",
    "checkpoint:session-internal",
  );
  git("update-ref", "refs/conductor-checkpoints/test-session", checkpoint);
  git("update-ref", "refs/conductor-archive-heads/test-session", checkpoint);
  const repo = await getRepo(root);
  assert.equal(repo.total, before.total);
  assert.deepEqual(
    repo.commits.map((c) => c.hash),
    before.commits.map((c) => c.hash),
  );
  assert.ok(!repo.commits.some((c) => c.hash === checkpoint));
  // A real branch pointing at that commit must still be visible; we filter refs, not messages/authors.
  git("branch", "saved-checkpoint", checkpoint);
  assert.ok((await getRepo(root)).commits.some((c) => c.hash === checkpoint));
});

test("interleaves recent branch tips by date instead of exhausting an older branch first", async () => {
  const tree = git("rev-parse", "HEAD^{tree}");
  function dated(subject: string, date: string, parent?: string) {
    return execFileSync(
      "git",
      ["commit-tree", tree, "-m", subject, ...(parent ? ["-p", parent] : [])],
      {
        cwd: root,
        encoding: "utf8",
        env: {
          ...process.env,
          GIT_AUTHOR_DATE: date,
          GIT_COMMITTER_DATE: date,
        },
      },
    ).trim();
  }
  const base = dated("base", "2020-01-01T12:00:00Z");
  const older = dated("older feature work", "2020-02-01T12:00:00Z", base);
  const feature = dated("latest feature tip", "2020-09-01T12:00:00Z", older);
  const main = dated("recent main tip", "2020-08-01T12:00:00Z", base);
  git("branch", "ordering-feature", feature);
  git("branch", "ordering-main", main);
  const hashes = (await getRepo(root)).commits.map((c) => c.hash);
  assert.ok(hashes.indexOf(feature) < hashes.indexOf(main));
  assert.ok(hashes.indexOf(main) < hashes.indexOf(older));
  assert.ok(hashes.indexOf(older) < hashes.indexOf(base));
});
