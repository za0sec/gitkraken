import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { Commit } from "./types";

type Entry = { image: string; expires: number };
const memory = new Map<string, Entry>();
const pending = new Map<string, Promise<string | null>>();
export function githubRepository(remote: string): string | null {
  const match = remote.match(
    /^(?:https:\/\/github\.com\/|git@github\.com:|ssh:\/\/git@github\.com\/)([\w.-]+\/[\w.-]+?)(?:\.git)?\/?$/,
  );
  return match?.[1] || null;
}
export function validAvatarUrl(value: unknown): value is string {
  if (typeof value !== "string") return false;
  try {
    const url = new URL(value);
    return (
      url.protocol === "https:" &&
      url.hostname === "avatars.githubusercontent.com"
    );
  } catch {
    return false;
  }
}
export async function resolveAvatars(
  repository: string,
  commits: Commit[],
  directory: string,
  gh: (args: string[]) => Promise<string>,
): Promise<Record<string, string>> {
  const authors = new Map<string, Commit[]>();
  for (const commit of commits) {
    const candidates = authors.get(commit.email) || [];
    if (candidates.length < 3) candidates.push(commit);
    authors.set(commit.email, candidates);
  }
  async function lookup(email: string, candidates: Commit[]) {
    const key = createHash("sha256")
      .update(`${repository}:${email}`)
      .digest("hex");
    const remembered = memory.get(key);
    if (remembered && remembered.expires > Date.now())
      return remembered.image || null;
    if (pending.has(key)) return pending.get(key)!;
    const request = (async () => {
      const file = path.join(directory, `${key}.json`);
      let stale: Entry | null = null;
      try {
        stale = JSON.parse(await readFile(file, "utf8")) as Entry;
        if (
          stale &&
          typeof stale.image === "string" &&
          stale.image.startsWith("data:image/") &&
          stale.expires > Date.now()
        ) {
          memory.set(key, stale);
          return stale.image;
        }
      } catch {}
      try {
        let url: string | null = null;
        // GitHub's commit API resolves author identity, even when their Git email is private.
        for (const commit of candidates) {
          try {
            const author = JSON.parse(
              await gh([
                "api",
                `repos/${repository}/commits/${commit.hash}`,
                "--jq",
                ".author | {avatar_url}",
              ]),
            );
            if (validAvatarUrl(author.avatar_url)) {
              url = author.avatar_url;
              break;
            }
          } catch {}
        }
        if (!url) throw new Error("Author has no linked GitHub profile");
        const avatarUrl = new URL(url);
        avatarUrl.searchParams.set("s", "64");
        const response = await fetch(avatarUrl, {
          signal: AbortSignal.timeout(6000),
          redirect: "error",
        });
        const mime = response.headers.get("content-type")?.split(";")[0] || "";
        if (
          !response.ok ||
          !["image/png", "image/jpeg", "image/webp", "image/gif"].includes(mime)
        )
          throw new Error("Invalid profile image");
        const buffer = Buffer.from(await response.arrayBuffer());
        if (buffer.length > 256000) throw new Error("Profile image too large");
        const entry = {
          image: `data:${mime};base64,${buffer.toString("base64")}`,
          expires: Date.now() + 7 * 86400000,
        };
        memory.set(key, entry);
        await mkdir(directory, { recursive: true });
        await writeFile(file, JSON.stringify(entry), { mode: 0o600 }).catch(
          () => {},
        );
        return entry.image;
      } catch {
        const fallback = stale?.image?.startsWith("data:image/")
          ? stale.image
          : "";
        memory.set(key, { image: fallback, expires: Date.now() + 300000 });
        return fallback || null;
      }
    })();
    pending.set(key, request);
    try {
      return await request;
    } finally {
      pending.delete(key);
    }
  }
  const result: Record<string, string> = {};
  const queue = [...authors.entries()].slice(0, 12);
  await Promise.all(
    Array.from({ length: Math.min(3, queue.length) }, async () => {
      while (queue.length) {
        const [email, candidates] = queue.shift()!;
        const image = await lookup(email, candidates);
        if (image) result[email] = image;
      }
    }),
  );
  return result;
}
