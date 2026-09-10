import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readdir, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  githubRepository,
  validAvatarUrl,
  resolveAvatars,
} from "../src/lib/avatars";
import type { Commit } from "../src/lib/types";

test("extracts GitHub repositories and allows only GitHub avatar image URLs", () => {
  assert.equal(
    githubRepository("git@github.com:team/project.git"),
    "team/project",
  );
  assert.equal(
    githubRepository("https://github.com/team/project.git"),
    "team/project",
  );
  assert.equal(
    githubRepository("ssh://git@github.com/team/project.git"),
    "team/project",
  );
  assert.equal(githubRepository("https://example.com/team/project"), null);
  assert.equal(
    validAvatarUrl("https://avatars.githubusercontent.com/u/123"),
    true,
  );
  assert.equal(
    validAvatarUrl("https://avatars.githubusercontent.com.evil.test/u/123"),
    false,
  );
  assert.equal(validAvatarUrl("http://localhost/avatar"), false);
});
test("resolves profile photos once and persists a local image cache", async (context) => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "gitgrove-avatars-"));
  let calls = 0;
  context.mock.method(
    globalThis,
    "fetch",
    async () =>
      new Response(new Uint8Array([137, 80, 78, 71]), {
        headers: { "content-type": "image/png" },
      }),
  );
  const contributor: Commit = {
    hash: "a".repeat(40),
    email: "avatar-test@example.com",
    author: "Avatar Test",
    parents: [],
    refs: [],
    date: "2026-09-09",
    subject: "test",
    body: "",
  };
  try {
    const gh = async () => {
      calls++;
      return JSON.stringify({
        avatar_url: "https://avatars.githubusercontent.com/u/123",
      });
    };
    const first = await resolveAvatars(
      "team/project",
      [contributor],
      directory,
      gh,
    );
    const second = await resolveAvatars(
      "team/project",
      [contributor],
      directory,
      async () => {
        throw new Error("offline");
      },
    );
    assert.match(first[contributor.email], /^data:image\/png;base64,/);
    assert.deepEqual(second, first);
    assert.equal(calls, 1);
    assert.equal((await readdir(directory)).length, 1);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
