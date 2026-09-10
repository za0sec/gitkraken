import { NextRequest, NextResponse } from "next/server";
import {
  cloneRepo,
  discoverRepos,
  fetchRepo,
  getCommit,
  getDiff,
  getRepo,
  getAvatars,
  githubAccount,
  githubRepos,
  rememberRepo,
} from "@/lib/git";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function POST(request: NextRequest) {
  const host = request.headers.get("host") || "";
  if (!/^(localhost|127\.0\.0\.1)(:\d+)?$/.test(host))
    return NextResponse.json(
      { error: "Acceso local únicamente." },
      { status: 403 },
    );
  const origin = request.headers.get("origin");
  if (origin && origin !== `http://${host}`)
    return NextResponse.json({ error: "Origen inválido." }, { status: 403 });
  if (
    process.env.GITGROVE_TOKEN &&
    request.cookies.get("gitgrove-session")?.value !==
      process.env.GITGROVE_TOKEN
  )
    return NextResponse.json({ error: "Sesión inválida." }, { status: 401 });
  try {
    const { action, path, ref, file, limit, repository, destination, hashes } =
      await request.json();
    let data;
    switch (action) {
      case "discover":
        data = await discoverRepos();
        break;
      case "open":
        data = await rememberRepo(path);
        break;
      case "repo":
        data = await getRepo(
          path,
          Math.min(10000, Math.max(100, Number(limit) || 300)),
          ref,
        );
        break;
      case "avatars":
        data = await getAvatars(path, hashes);
        break;
      case "commit":
        data = await getCommit(path, ref);
        break;
      case "diff":
        data = await getDiff(path, ref, file);
        break;
      case "github":
        data = await githubAccount();
        break;
      case "github-repos":
        data = await githubRepos();
        break;
      case "fetch":
        data = await fetchRepo(path);
        break;
      case "clone":
        data = await cloneRepo(repository, destination);
        break;
      default:
        return NextResponse.json(
          { error: "Operación desconocida." },
          { status: 400 },
        );
    }
    return NextResponse.json(data, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Ocurrió un error." },
      { status: 400 },
    );
  }
}
