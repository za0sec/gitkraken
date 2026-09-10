"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowDown,
  ArrowDownToLine,
  ArrowRight,
  ArrowUp,
  Check,
  CheckCheck,
  ChevronDown,
  ChevronRight,
  Clock3,
  Cloud,
  Copy,
  ExternalLink,
  FileCode2,
  Files,
  Folder,
  FolderGit2,
  FolderOpen,
  GitBranch,
  GitCommitHorizontal,
  GitFork,
  GitMerge,
  HardDrive,
  Layers,
  ListFilter,
  LoaderCircle,
  LockKeyhole,
  Maximize2,
  PanelLeftClose,
  PanelRightClose,
  Plus,
  RefreshCw,
  Search,
  Settings2,
  ShieldCheck,
  Tag,
  Terminal,
  TreePine,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type {
  Branch,
  ChangedFile,
  CommitDetail,
  GithubAccount,
  GithubRepo,
  RepoData,
  Repository,
} from "@/lib/types";
import { GRAPH_COLORS, layoutGraph } from "@/lib/graph";
import HistoryGraph from "@/components/history-graph";

type Preferences = {
  tabs: Repository[];
  active: string;
  dense: boolean;
  autoRefresh: boolean;
};
declare global {
  interface Window {
    desktop?: {
      getPreferences: () => Promise<Preferences | null>;
      setPreferences: (preferences: Preferences) => Promise<void>;
      chooseDirectory: () => Promise<string | null>;
      reveal: (path: string) => Promise<void>;
      openExternal: (url: string) => Promise<void>;
      platform: string;
    };
  }
}
async function api<T>(
  action: string,
  params: Record<string, unknown> = {},
  signal?: AbortSignal,
): Promise<T> {
  const response = await fetch("/api/git", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, ...params }),
    signal,
  });
  const result = await response.json();
  if (!response.ok)
    throw new Error(result.error || "No se pudo completar la operación.");
  return result;
}
function Github({ size = 16 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M9 19c-4.3 1.3-4.3-2.2-6-2.7m12 5v-3.4c0-1 .1-1.5-.5-2.1 3.3-.4 6.8-1.6 6.8-7.2a5.6 5.6 0 0 0-1.5-3.9c.2-.9.3-2.5-.2-3.7 0 0-1.2-.4-3.9 1.5a13.5 13.5 0 0 0-7.2 0C5.8.6 4.6 1 4.6 1c-.5 1.2-.4 2.8-.2 3.7A5.6 5.6 0 0 0 3 8.6c0 5.6 3.5 6.8 6.8 7.2-.5.5-.8 1.1-.8 2.1v3.4" />
    </svg>
  );
}
function relativeDate(date: string) {
  const days = Math.floor((Date.now() - new Date(date).getTime()) / 86400000);
  if (days < 0)
    return new Date(date).toLocaleDateString("es", {
      day: "numeric",
      month: "short",
    });
  if (days === 0) {
    const hours = Math.floor((Date.now() - new Date(date).getTime()) / 3600000);
    return hours > 0 ? `hace ${hours} h` : "hace un momento";
  }
  return days === 1
    ? "ayer"
    : days < 30
      ? `hace ${days} días`
      : new Date(date).toLocaleDateString("es", {
          day: "numeric",
          month: "short",
          year:
            new Date(date).getFullYear() !== new Date().getFullYear()
              ? "numeric"
              : undefined,
        });
}
function initials(name: string) {
  return name
    .split(/[\s-]+/)
    .map((s) => s[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}
function avatarColor(name: string) {
  return GRAPH_COLORS[
    Array.from(name).reduce((n, c) => n + c.charCodeAt(0), 0) %
      GRAPH_COLORS.length
  ];
}
function Avatar({
  name,
  small = false,
  image,
}: {
  name: string;
  small?: boolean;
  image?: string;
}) {
  return (
    <span
      className={`avatar ${small ? "small" : ""}`}
      style={{ "--avatar-color": avatarColor(name) } as React.CSSProperties}
    >
      {image ? (
        /* Profile images are cached data URLs, not optimizable remote assets. */ <svg
          width="100%"
          height="100%"
          viewBox="0 0 32 32"
          aria-label={name}
        >
          <image href={image} width="32" height="32" />
        </svg>
      ) : (
        initials(name)
      )}
    </span>
  );
}
function IconButton({
  icon: Icon,
  label,
  onClick,
  className = "",
  disabled = false,
}: {
  icon: LucideIcon;
  label: string;
  onClick?: () => void;
  className?: string;
  disabled?: boolean;
}) {
  return (
    <button
      className={`icon-button ${className}`}
      title={label}
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
    >
      <Icon size={16} strokeWidth={1.7} />
    </button>
  );
}
function Section({
  title,
  count,
  icon: Icon,
  children,
  initial = true,
}: {
  title: string;
  count: number;
  icon: LucideIcon;
  children: React.ReactNode;
  initial?: boolean;
}) {
  const [open, setOpen] = useState(initial);
  return (
    <section className="sidebar-section">
      <button
        className="section-title"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
      >
        {open ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        <Icon size={14} />
        <span>{title}</span>
        <span className="count">{count}</span>
      </button>
      {open && <div className="section-content">{children}</div>}
    </section>
  );
}
function Modal({
  title,
  subtitle,
  children,
  onClose,
  wide = false,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  const element = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement;
    element.current?.focus();
    function trap(event: KeyboardEvent) {
      if (event.key !== "Tab") return;
      const elements = element.current?.querySelectorAll<HTMLElement>(
        'button:not(:disabled), input, select, a[href], [tabindex="0"]',
      );
      if (!elements?.length) return;
      const first = elements[0],
        last = elements[elements.length - 1];
      if (
        event.shiftKey &&
        (document.activeElement === first ||
          document.activeElement === element.current)
      ) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
    const node = element.current;
    node?.addEventListener("keydown", trap);
    return () => {
      node?.removeEventListener("keydown", trap);
      previous?.focus();
    };
  }, []);
  return (
    <div
      className="modal-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className={`modal ${wide ? "wide" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        ref={element}
        tabIndex={-1}
      >
        <header className="modal-header">
          <div>
            <h2>{title}</h2>
            {subtitle && <p>{subtitle}</p>}
          </div>
          <IconButton icon={X} label="Cerrar" onClick={onClose} />
        </header>
        {children}
      </div>
    </div>
  );
}

export default function Home() {
  const [repos, setRepos] = useState<Repository[]>([]),
    [tabs, setTabs] = useState<Repository[]>([]),
    [active, setActive] = useState("");
  const [repo, setRepo] = useState<RepoData | null>(null),
    [ready, setReady] = useState(false),
    [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState(""),
    [detail, setDetail] = useState<CommitDetail | null>(null),
    [detailLoading, setDetailLoading] = useState(false);
  const [branchFilter, setBranchFilter] = useState(""),
    [search, setSearch] = useState(""),
    [branchSearch, setBranchSearch] = useState("");
  const [limit, setLimit] = useState(300),
    [refresh, setRefresh] = useState(0),
    [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [modal, setModal] = useState<"open" | "github" | "settings" | null>(
      null,
    ),
    [openPath, setOpenPath] = useState(""),
    [opening, setOpening] = useState(false);
  const [error, setError] = useState(""),
    [toast, setToast] = useState(""),
    [fetching, setFetching] = useState(false);
  const [account, setAccount] = useState<GithubAccount | null>(null),
    [githubChecked, setGithubChecked] = useState(false),
    [githubList, setGithubList] = useState<GithubRepo[]>([]),
    [githubLoading, setGithubLoading] = useState(false),
    [githubSearch, setGithubSearch] = useState(""),
    [cloneTarget, setCloneTarget] = useState(""),
    [cloneDestination, setCloneDestination] = useState("~/Projects");
  const [diffFile, setDiffFile] = useState<string | null>(null),
    [diff, setDiff] = useState<{ patch: string; truncated: boolean } | null>(
      null,
    ),
    [diffLoading, setDiffLoading] = useState(false);
  const [showSidebar, setShowSidebar] = useState(true),
    [showDetails, setShowDetails] = useState(false),
    [dense, setDense] = useState(false),
    [autoRefresh, setAutoRefresh] = useState(true),
    [fileView, setFileView] = useState<"path" | "tree">("path");
  const searchInput = useRef<HTMLInputElement>(null),
    refreshInProgress = useRef(false);
  const notify = useCallback((message: string) => setToast(message), []);
  const checkGithub = useCallback(async () => {
    try {
      const data = await api<{ account: GithubAccount | null }>("github");
      setAccount(data.account);
      return data.account;
    } catch {
      setAccount(null);
      return null;
    } finally {
      setGithubChecked(true);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      api<Repository[]>("discover"),
      window.desktop?.getPreferences().catch(() => null) ||
        Promise.resolve(null),
    ])
      .then(([discovered, preferences]) => {
        if (cancelled) return;
        setRepos(discovered);
        let saved: Repository[] = [];
        let last = "";
        try {
          saved = JSON.parse(localStorage.getItem("gitgrove-tabs") || "[]");
          last = localStorage.getItem("gitgrove-active") || "";
          setDense(localStorage.getItem("gitgrove-dense") === "true");
          setAutoRefresh(localStorage.getItem("gitgrove-auto") !== "false");
        } catch {}
        if (preferences) {
          saved = preferences.tabs;
          last = preferences.active;
          setDense(preferences.dense);
          setAutoRefresh(preferences.autoRefresh);
        }
        const initial = saved.length ? saved : discovered.slice(0, 1);
        setTabs(initial);
        setActive(
          initial.some((r) => r.path === last) ? last : initial[0]?.path || "",
        );
      })
      .catch((e) => {
        if (!cancelled) setError(e.message);
      })
      .finally(() => {
        if (!cancelled) setReady(true);
      });
    api<{ account: GithubAccount | null }>("github")
      .then((data) => {
        if (!cancelled) setAccount(data.account);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setGithubChecked(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);
  useEffect(() => {
    if (ready) {
      localStorage.setItem("gitgrove-tabs", JSON.stringify(tabs));
      localStorage.setItem("gitgrove-active", active);
      localStorage.setItem("gitgrove-dense", String(dense));
      localStorage.setItem("gitgrove-auto", String(autoRefresh));
      if (window.desktop)
        void window.desktop
          .setPreferences({ tabs, active, dense, autoRefresh })
          .catch(() => setError("No se pudieron guardar las preferencias."));
    }
  }, [tabs, active, ready, dense, autoRefresh]);
  useEffect(() => {
    if (!active) return;
    const controller = new AbortController();
    Promise.resolve().then(() => {
      setLoading(true);
      refreshInProgress.current = true;
    });
    api<RepoData>(
      "repo",
      { path: active, limit, ref: branchFilter || undefined },
      controller.signal,
    )
      .then((data) => {
        setRepo(data);
        setError("");
        setLastRefresh(new Date());
        setSelected(
          (previous) => previous || data.commits[0]?.hash || "working",
        );
      })
      .catch((e) => {
        if (e.name !== "AbortError") {
          setError(e.message);
          setRepo(null);
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setLoading(false);
          refreshInProgress.current = false;
        }
      });
    return () => controller.abort();
  }, [active, limit, branchFilter, refresh]);
  useEffect(() => {
    if (!active || !selected || selected === "working") return;
    const controller = new AbortController();
    Promise.resolve().then(() => {
      setDetailLoading(true);
      setDetail(null);
    });
    api<CommitDetail>(
      "commit",
      { path: active, ref: selected },
      controller.signal,
    )
      .then(setDetail)
      .catch((e) => {
        if (e.name !== "AbortError") setError(e.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setDetailLoading(false);
      });
    return () => controller.abort();
  }, [active, selected, refresh]);
  useEffect(() => {
    if (!diffFile || !active || !selected) return;
    const controller = new AbortController();
    Promise.resolve().then(() => {
      setDiffLoading(true);
      setDiff(null);
    });
    api<{ patch: string; truncated: boolean }>(
      "diff",
      { path: active, ref: selected, file: diffFile },
      controller.signal,
    )
      .then(setDiff)
      .catch((e) => {
        if (e.name !== "AbortError")
          setDiff({ patch: e.message, truncated: false });
      })
      .finally(() => {
        if (!controller.signal.aborted) setDiffLoading(false);
      });
    return () => controller.abort();
  }, [diffFile, active, selected, refresh]);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(""), 3500);
    return () => clearTimeout(timer);
  }, [toast]);
  useEffect(() => {
    if (!active || !autoRefresh) return;
    const update = () => {
      if (document.visibilityState === "visible" && !refreshInProgress.current)
        setRefresh((v) => v + 1);
    };
    const interval = setInterval(update, 15000);
    window.addEventListener("focus", update);
    return () => {
      clearInterval(interval);
      window.removeEventListener("focus", update);
    };
  }, [active, autoRefresh]);
  useEffect(() => {
    function keyboard(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "o") {
        e.preventDefault();
        setModal("open");
      }
      if ((e.metaKey || e.ctrlKey) && e.key === "f") {
        e.preventDefault();
        searchInput.current?.focus();
      }
      if ((e.metaKey || e.ctrlKey) && e.key === "1") {
        e.preventDefault();
        setBranchFilter("");
      }
      if ((e.metaKey || e.ctrlKey) && e.key === "r") {
        e.preventDefault();
        setRefresh((v) => v + 1);
      }
      if (e.key === "Escape") {
        setModal(null);
        setDiffFile(null);
        setSearch("");
      }
    }
    window.addEventListener("keydown", keyboard);
    return () => window.removeEventListener("keydown", keyboard);
  }, []);
  const graph = useMemo(
    () => layoutGraph(repo?.commits || []),
    [repo?.commits],
  );
  const [avatars, setAvatars] = useState<Record<string, string>>({});
  const receiveAvatars = useCallback((images: Record<string, string>) => {
    setAvatars((previous) =>
      Object.entries(images).every(
        ([email, image]) => previous[email] === image,
      )
        ? previous
        : { ...previous, ...images },
    );
  }, []);
  const matches = useMemo(
    () =>
      new Set(
        (repo?.commits || [])
          .filter((c) =>
            `${c.subject} ${c.author} ${c.hash} ${c.refs.join(" ")}`
              .toLowerCase()
              .includes(search.toLowerCase()),
          )
          .map((c) => c.hash),
      ),
    [repo?.commits, search],
  );
  const working = selected === "working";
  const commit = !working
    ? detail?.commit.hash === selected
      ? detail.commit
      : repo?.commits.find((c) => c.hash === selected)
    : undefined;
  const files = working
    ? repo?.files || []
    : detail?.commit.hash === selected
      ? detail.files
      : [];
  const additions = files.reduce((n, f) => n + (f.additions || 0), 0),
    deletions = files.reduce((n, f) => n + (f.deletions || 0), 0);
  const currentBranch = repo?.branches.find((b) => b.current);
  const activate = (repository: Repository) => {
    setActive(repository.path);
    setRepo(null);
    setSelected("");
    setDetail(null);
    setBranchFilter("");
    setLimit(300);
    setSearch("");
    setDiffFile(null);
    setError("");
  };
  async function openRepository(input: string) {
    if (!input.trim()) return;
    setOpening(true);
    setError("");
    try {
      const repository = await api<Repository>("open", { path: input });
      setTabs((prev) =>
        prev.some((r) => r.path === repository.path)
          ? prev
          : [...prev, repository],
      );
      setRepos((prev) => [
        repository,
        ...prev.filter((r) => r.path !== repository.path),
      ]);
      activate(repository);
      setModal(null);
      setOpenPath("");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setOpening(false);
    }
  }
  async function chooseFolder() {
    if (!window.desktop) {
      setModal("open");
      setTimeout(() => document.getElementById("repo-path")?.focus(), 50);
      return;
    }
    const chosen = await window.desktop.chooseDirectory();
    if (chosen) await openRepository(chosen);
  }
  function closeTab(repository: Repository) {
    const remaining = tabs.filter((r) => r.path !== repository.path);
    setTabs(remaining);
    if (active === repository.path) {
      if (remaining.length)
        activate(
          remaining[
            Math.max(0, tabs.findIndex((r) => r.path === repository.path) - 1)
          ] || remaining[0],
        );
      else {
        setActive("");
        setRepo(null);
      }
    }
  }
  async function fetchRemote() {
    if (!active || fetching) return;
    setFetching(true);
    try {
      await api("fetch", { path: active });
      setRefresh((v) => v + 1);
      notify("Referencias remotas actualizadas");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setFetching(false);
    }
  }
  async function loadGithub() {
    setModal("github");
    setGithubLoading(true);
    setError("");
    try {
      const connected = await checkGithub();
      setGithubList(connected ? await api<GithubRepo[]>("github-repos") : []);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setGithubLoading(false);
    }
  }
  async function clone() {
    setOpening(true);
    try {
      let destination = cloneDestination;
      if (window.desktop) {
        const chosen = await window.desktop.chooseDirectory();
        if (!chosen) return;
        destination = chosen;
      }
      const repository = await api<Repository>("clone", {
        repository: cloneTarget,
        destination,
      });
      await openRepository(repository.path);
      notify("Repositorio clonado y listo para explorar");
      setCloneTarget("");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setOpening(false);
    }
  }
  async function copy(value: string, message = "Copiado al portapapeles") {
    try {
      await navigator.clipboard.writeText(value);
      notify(message);
    } catch {
      setError("No se pudo acceder al portapapeles.");
    }
  }
  function external(url: string) {
    if (
      !/^https:\/\/(github\.com|docs\.github\.com|cli\.github\.com)(\/|$)/.test(
        url,
      )
    )
      return;
    if (window.desktop) void window.desktop.openExternal(url);
    else window.open(url, "_blank", "noopener,noreferrer");
  }
  function selectCommit(hash: string) {
    setSelected(hash);
    setShowDetails(true);
    setDiffFile(null);
  }
  function focusRef(ref: string) {
    if (ref !== branchFilter) {
      setSelected("");
      setDetail(null);
    }
    setBranchFilter(ref);
    setLimit(300);
    setSearch("");
  }
  const branchItem = (branch: Branch, index: number) => (
    <button
      key={branch.name}
      className={`branch-item ${branch.current ? "current" : ""} ${branchFilter === branch.name ? "filtered" : ""}`}
      onClick={() => focusRef(branch.name)}
      title={`${branch.name}${branch.upstream ? ` → ${branch.upstream}` : ""}`}
    >
      <GitBranch
        size={14}
        style={{
          color:
            graph.rows[
              repo?.commits.findIndex((c) => c.hash === branch.hash) ?? -1
            ]?.color || GRAPH_COLORS[index % GRAPH_COLORS.length],
        }}
      />
      <span>{branch.name}</span>
      {branch.current && <span className="head-dot" />}
      {branch.ahead > 0 && <small>↑{branch.ahead}</small>}
      {branch.behind > 0 && <small>↓{branch.behind}</small>}
    </button>
  );

  return (
    <div className={`app-shell ${dense ? "dense" : ""}`}>
      <header className="titlebar">
        <div className="brand">
          <span className="brand-symbol">
            <GitFork size={20} strokeWidth={2.3} />
          </span>
          <span>
            gitgrove<span className="brand-period">.</span>
          </span>
        </div>
        <div className="titlebar-center">Un lugar para entender tu código</div>
        <div className="titlebar-right">
          <span className="personal-badge">
            <span /> PERSONAL
          </span>
          <IconButton
            icon={Settings2}
            label="Preferencias"
            onClick={() => setModal("settings")}
          />
        </div>
      </header>
      <div className="repo-tabbar">
        <div className="repo-tabs">
          {tabs.map((tab) => (
            <div
              className={`repo-tab ${active === tab.path ? "active" : ""}`}
              key={tab.path}
            >
              <button
                onClick={() => {
                  if (active !== tab.path) activate(tab);
                }}
                title={tab.path}
              >
                <FolderGit2 size={15} />
                <span>{tab.name}</span>
              </button>
              <IconButton
                icon={X}
                label={`Cerrar ${tab.name}`}
                onClick={() => closeTab(tab)}
              />
            </div>
          ))}
          <IconButton
            icon={Plus}
            label="Abrir repositorio (⌘O)"
            onClick={() => setModal("open")}
          />
        </div>
        <button className="github-connection" onClick={loadGithub}>
          <Github size={15} />
          <span>{account ? account.login : "Conectar GitHub"}</span>
          {account && <span className="connection-dot" />}
        </button>
      </div>
      <div className="toolbar">
        <div className="repo-breadcrumb">
          <IconButton
            icon={showSidebar ? PanelLeftClose : FolderGit2}
            label={
              showSidebar ? "Ocultar barra lateral" : "Mostrar barra lateral"
            }
            onClick={() => setShowSidebar(!showSidebar)}
          />
          <span className="toolbar-divider" />
          <FolderGit2 size={17} />
          <strong>
            {repo?.name || (loading ? "Cargando…" : "Tu espacio")}
          </strong>
          <ChevronRight size={13} />
          <span className="branch-breadcrumb">
            <GitBranch size={14} />
            {repo?.branch || "Sin repositorio"}
          </span>
        </div>
        <div className="toolbar-actions">
          <button
            className="text-button"
            onClick={fetchRemote}
            disabled={!repo?.remotes.length || fetching}
            title="Descargar referencias remotas sin modificar tus archivos"
          >
            {fetching ? (
              <LoaderCircle size={15} className="spin" />
            ) : (
              <ArrowDownToLine size={15} />
            )}
            <span>{fetching ? "Actualizando…" : "Fetch"}</span>
          </button>
          <IconButton
            icon={RefreshCw}
            label="Actualizar vista (⌘R)"
            onClick={() => setRefresh((v) => v + 1)}
            className={loading ? "spin-icon" : ""}
            disabled={!active || loading}
          />
          <span className="toolbar-divider" />
          <button
            className="primary-button small-button"
            onClick={chooseFolder}
          >
            <FolderOpen size={15} />
            Abrir repositorio
          </button>
        </div>
      </div>
      {error && !modal && (
        <div className="error-banner" role="alert">
          <span>{error}</span>
          <IconButton
            icon={X}
            label="Cerrar error"
            onClick={() => setError("")}
          />
        </div>
      )}
      <div className="workspace">
        {showSidebar && (
          <aside className="sidebar">
            <div className="sidebar-top">
              <span className="eyebrow">ESPACIO DE TRABAJO</span>
              <button
                className="nav-item active"
                onClick={() => {
                  focusRef("");
                  setSelected(repo?.commits[0]?.hash || "working");
                }}
              >
                <GitFork size={17} />
                <span>Historial de commits</span>
                <span className="nav-shortcut">⌘1</span>
              </button>
              <button
                className={`nav-item ${working ? "selected" : ""}`}
                onClick={() => selectCommit("working")}
                disabled={!repo}
              >
                <Files size={17} />
                <span>Cambios locales</span>
                <span
                  className={`number-badge ${repo?.files.length ? "accent-badge" : ""}`}
                >
                  {repo?.files.length || 0}
                </span>
              </button>
            </div>
            <div className="branch-search">
              <Search size={13} />
              <input
                aria-label="Filtrar ramas"
                placeholder="Filtrar ramas…"
                value={branchSearch}
                onChange={(e) => setBranchSearch(e.target.value)}
              />
              {branchSearch && (
                <button
                  aria-label="Limpiar filtro de ramas"
                  onClick={() => setBranchSearch("")}
                >
                  <X size={12} />
                </button>
              )}
            </div>
            <div className="sidebar-scroll">
              <Section
                initial={false}
                title="LOCALES"
                icon={HardDrive}
                count={repo?.branches.filter((b) => !b.remote).length || 0}
              >
                {repo?.branches
                  .filter(
                    (b) =>
                      !b.remote &&
                      b.name.toLowerCase().includes(branchSearch.toLowerCase()),
                  )
                  .map(branchItem)}
                {!repo?.branches.some((b) => !b.remote) && (
                  <p className="section-empty">Sin ramas locales</p>
                )}
              </Section>
              <Section
                initial={false}
                title="REMOTAS"
                icon={Cloud}
                count={repo?.branches.filter((b) => b.remote).length || 0}
              >
                {repo?.branches
                  .filter(
                    (b) =>
                      b.remote &&
                      b.name.toLowerCase().includes(branchSearch.toLowerCase()),
                  )
                  .map(branchItem)}
                {!repo?.branches.some((b) => b.remote) && (
                  <p className="section-empty">Sin ramas remotas</p>
                )}
              </Section>
              <Section
                initial={false}
                title="WORKTREES"
                icon={Layers}
                count={repo?.worktrees.length || 0}
              >
                {repo?.worktrees.map((tree) => (
                  <button
                    className="branch-item worktree-item"
                    key={tree.path}
                    title={tree.path}
                    onClick={() => openRepository(tree.path)}
                  >
                    <span
                      className={
                        tree.path === active
                          ? "worktree-dot current-dot"
                          : "worktree-dot"
                      }
                    />
                    <span>{tree.branch}</span>
                    {tree.path === active && <small>actual</small>}
                  </button>
                ))}
              </Section>
              <Section
                title="STASHES"
                icon={ArchiveIcon}
                count={repo?.stashes.length || 0}
                initial={false}
              >
                {repo?.stashes.map((stash) => (
                  <button
                    className="branch-item"
                    key={stash.hash}
                    title={stash.subject}
                    onClick={() => selectCommit(stash.hash)}
                  >
                    <Layers size={13} />
                    <span>{stash.subject.replace(/^WIP on /, "")}</span>
                  </button>
                ))}
                {!repo?.stashes.length && (
                  <p className="section-empty">No hay cambios guardados</p>
                )}
              </Section>
              <Section
                title="TAGS"
                icon={Tag}
                count={repo?.tags.length || 0}
                initial={false}
              >
                {repo?.tags
                  .filter((t) =>
                    t.name.toLowerCase().includes(branchSearch.toLowerCase()),
                  )
                  .map((tag) => (
                    <button
                      className="branch-item"
                      key={tag.name}
                      onClick={() => focusRef(`refs/tags/${tag.name}`)}
                    >
                      <Tag size={13} />
                      <span>{tag.name}</span>
                    </button>
                  ))}
                {!repo?.tags.length && (
                  <p className="section-empty">Sin etiquetas</p>
                )}
              </Section>
            </div>
            <div className="sidebar-bottom">
              <div className="local-note">
                <ShieldCheck size={17} />
                <div>
                  <strong>Tu código se queda con vos</strong>
                  <span>Local. Privado. Sin suscripciones.</span>
                </div>
              </div>
              <button
                className="profile-button"
                onClick={() => setModal("settings")}
              >
                <Avatar name={account?.name || account?.login || "Local"} />
                <span>
                  <strong>
                    {account?.name || account?.login || "Mi espacio local"}
                  </strong>
                  <small>
                    {account ? "Conectado con GitHub CLI" : "Hecho para tu Mac"}
                  </small>
                </span>
                <Settings2 size={15} />
              </button>
            </div>
          </aside>
        )}
        <main className="main-panel">
          <div className="history-heading">
            <div>
              <h1>
                Historial<span className="subtle-dot">·</span>
                <span>
                  {repo ? repo.total.toLocaleString("es") : "0"} commits
                </span>
              </h1>
              <p>Cada rama, cada cambio. Todo conectado.</p>
            </div>
            <div className="history-options">
              <div className="branch-select">
                <GitBranch size={14} />
                <select
                  aria-label="Rama del historial"
                  value={branchFilter}
                  onChange={(e) => focusRef(e.target.value)}
                >
                  <option value="">Todas las ramas</option>
                  {repo?.branches.map((b) => (
                    <option key={b.name} value={b.name}>
                      {b.name}
                    </option>
                  ))}
                  {repo?.tags.map((t) => (
                    <option key={`tag-${t.name}`} value={`refs/tags/${t.name}`}>
                      {t.name}
                    </option>
                  ))}
                </select>
                <ChevronDown size={13} />
              </div>
              <IconButton
                icon={PanelRightClose}
                label={showDetails ? "Ocultar detalles" : "Mostrar detalles"}
                onClick={() => setShowDetails(!showDetails)}
              />
            </div>
          </div>
          <div className="history-search">
            <Search size={15} />
            <input
              ref={searchInput}
              aria-label="Buscar commits"
              placeholder="Buscar por mensaje, autor o hash…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <kbd>⌘ F</kbd>
            {search && (
              <>
                <span className="search-count">{matches.size} resultados</span>
                <IconButton
                  icon={ArrowDown}
                  label="Ir a la primera coincidencia"
                  onClick={() => {
                    const hash = [...matches][0];
                    if (hash)
                      document
                        .getElementById(`commit-${hash}`)
                        ?.scrollIntoView({
                          block: "center",
                          behavior: "smooth",
                        });
                  }}
                />
                <IconButton
                  icon={X}
                  label="Limpiar búsqueda"
                  onClick={() => setSearch("")}
                />
              </>
            )}
            <span className="search-divider" />
            <button
              className={`view-toggle ${dense ? "enabled" : ""}`}
              title="Alternar filas compactas"
              aria-label="Alternar filas compactas"
              onClick={() => setDense(!dense)}
            >
              <ListFilter size={15} />
            </button>
          </div>
          {loading && !repo ? (
            <div className="empty-state">
              <LoaderCircle size={28} className="spin" />
              <h2>Leyendo tu repositorio</h2>
              <p>Conectando los puntos de tu historial…</p>
            </div>
          ) : !repo ? (
            <div className="empty-state welcome">
              <div className="welcome-art">
                <GitFork size={58} strokeWidth={1.2} />
                <span className="orbit-dot one" />
                <span className="orbit-dot two" />
                <span className="orbit-dot three" />
              </div>
              <span className="eyebrow">
                UN POCO DE CLARIDAD PARA TU CÓDIGO
              </span>
              <h2>Encontrá tu lugar entre las ramas.</h2>
              <p>
                Abrí un repositorio y descubrí cómo se conecta
                <br />
                cada commit con el resto de tu proyecto.
              </p>
              <button className="primary-button" onClick={chooseFolder}>
                <FolderOpen size={16} />
                Abrir un repositorio local<kbd>⌘ O</kbd>
              </button>
              <button className="text-button" onClick={loadGithub}>
                <Github size={15} />
                Explorar mis repositorios de GitHub
                <ArrowRight size={14} />
              </button>
            </div>
          ) : (
            <>
              <HistoryGraph
                key={`${repo.path}:${branchFilter}`}
                repo={repo}
                graph={graph}
                selected={selected}
                branchFilter={branchFilter}
                search={search}
                matches={matches}
                dense={dense}
                loading={loading}
                limit={limit}
                avatars={avatars}
                onAvatars={receiveAvatars}
                onSelect={selectCommit}
                onLoadMore={() => setLimit((n) => Math.min(n + 500, 10000))}
                formatDate={relativeDate}
              />
              <div className="graph-footer">
                <span>
                  <span className="legend-dot" />
                  Commit
                  <GitMerge size={13} />
                  Merge
                  <span className="legend-ring" />
                  Cambios locales
                </span>
                <span>
                  {branchFilter && (
                    <button onClick={() => focusRef("")}>
                      Quitar filtro <X size={11} />
                    </button>
                  )}
                  {repo.commits.length} de {repo.total.toLocaleString("es")}
                </span>
              </div>
            </>
          )}
        </main>
        {showDetails && (
          <aside className="details-panel">
            <div className="details-tabs">
              <button
                className={!working ? "active" : ""}
                onClick={() => {
                  if (repo?.commits[0]) setSelected(repo.commits[0].hash);
                }}
              >
                <GitCommitHorizontal size={15} />
                Commit
              </button>
              <button
                className={working ? "active" : ""}
                onClick={() => selectCommit("working")}
              >
                <Files size={14} />
                Cambios locales
                <span className="number-badge">{repo?.files.length || 0}</span>
              </button>
            </div>
            {!repo ? (
              <div className="detail-empty">
                <GitCommitHorizontal size={34} strokeWidth={1} />
                <p>Los detalles viven acá</p>
                <span>Seleccioná un commit para explorarlo.</span>
              </div>
            ) : (
              <div className="details-scroll">
                {working ? (
                  <div className="commit-detail-top">
                    <span className="detail-eyebrow">
                      <span className="live-dot" />
                      DIRECTORIO DE TRABAJO
                    </span>
                    <h2>
                      {repo.files.length
                        ? "Tu próximo commit"
                        : "Todo en su lugar."}
                    </h2>
                    <p className="detail-description">
                      {repo.files.length
                        ? `Tenés ${repo.files.length} archivos con cambios en ${repo.branch}.`
                        : "No hay cambios pendientes en este repositorio."}
                    </p>
                    <div className="working-branch">
                      <GitBranch size={14} />
                      {repo.branch}
                      <span>HEAD</span>
                    </div>
                  </div>
                ) : commit ? (
                  <div className="commit-detail-top">
                    <div className="detail-eyebrow">
                      <span>
                        <GitCommitHorizontal size={13} />
                        DETALLES DEL COMMIT
                      </span>
                      <button
                        className="hash-copy"
                        title="Copiar hash completo"
                        onClick={() =>
                          copy(commit.hash, "Hash del commit copiado")
                        }
                      >
                        {commit.hash.slice(0, 7)}
                        <Copy size={12} />
                      </button>
                    </div>
                    <h2>{commit.subject}</h2>
                    {commit.body && (
                      <p className="commit-body">{commit.body}</p>
                    )}
                    <div className="author-card">
                      <Avatar
                        name={commit.author}
                        image={avatars[commit.email]}
                      />
                      <div>
                        <strong>{commit.author}</strong>
                        <span>{commit.email}</span>
                      </div>
                    </div>
                    <dl className="commit-meta">
                      <div>
                        <dt>
                          <Clock3 size={13} />
                          Fecha
                        </dt>
                        <dd>
                          {new Date(commit.date).toLocaleString("es", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </dd>
                      </div>
                      <div>
                        <dt>
                          <GitFork size={13} />
                          Parents
                        </dt>
                        <dd>
                          {commit.parents.length ? (
                            commit.parents.map((parent) => (
                              <button
                                key={parent}
                                className="parent-hash"
                                onClick={() => selectCommit(parent)}
                              >
                                {parent.slice(0, 7)}
                                <ArrowUp size={10} />
                              </button>
                            ))
                          ) : (
                            <span>Commit inicial</span>
                          )}
                        </dd>
                      </div>
                      {commit.refs.length > 0 && (
                        <div>
                          <dt>
                            <GitBranch size={13} />
                            Refs
                          </dt>
                          <dd className="detail-refs">
                            {commit.refs.map((ref) => (
                              <span key={ref}>
                                {ref
                                  .replace("HEAD -> ", "")
                                  .replace("tag: ", "")}
                              </span>
                            ))}
                          </dd>
                        </div>
                      )}
                    </dl>
                  </div>
                ) : detailLoading ? (
                  <div className="detail-empty">
                    <LoaderCircle size={22} className="spin" />
                  </div>
                ) : (
                  <div className="detail-empty">
                    <p>Seleccioná un commit</p>
                  </div>
                )}
                <div className="changed-files">
                  <div className="files-heading">
                    <h3>
                      Archivos modificados <span>{files.length}</span>
                    </h3>
                    <div className="file-view-toggle">
                      <IconButton
                        icon={Files}
                        label="Ver rutas"
                        className={fileView === "path" ? "active" : ""}
                        onClick={() => setFileView("path")}
                      />
                      <IconButton
                        icon={Folder}
                        label="Ver por carpetas"
                        className={fileView === "tree" ? "active" : ""}
                        onClick={() => setFileView("tree")}
                      />
                    </div>
                  </div>
                  {!working && files.length > 0 && (
                    <div className="diff-summary">
                      <span>{files.length} archivos</span>
                      <span className="additions">+{additions}</span>
                      <span className="deletions">−{deletions}</span>
                      <div className="diff-meter">
                        <i style={{ flex: additions || 0.1 }} />
                        <i style={{ flex: deletions || 0.1 }} />
                      </div>
                    </div>
                  )}
                  {detailLoading && !working ? (
                    <div className="files-loading">
                      <LoaderCircle size={16} className="spin" />
                      Leyendo archivos…
                    </div>
                  ) : files.length ? (
                    <FileList
                      files={files}
                      mode={fileView}
                      onSelect={setDiffFile}
                    />
                  ) : (
                    <div className="files-empty">
                      <CheckCheck size={24} />
                      <p>
                        {working
                          ? "Directorio de trabajo limpio"
                          : "Sin cambios de archivos"}
                      </p>
                      <span>
                        {working
                          ? "Podés seguir explorando tu historial."
                          : "Este commit no introduce diferencias."}
                      </span>
                    </div>
                  )}
                </div>
                {files.length > 0 && (
                  <div className="diff-hint">
                    <Maximize2 size={13} />
                    <span>Seleccioná un archivo para ver el diff</span>
                  </div>
                )}
              </div>
            )}
            <div className="detail-bottom">
              <ShieldCheck size={13} />
              <span>Explorá con tranquilidad. Tus archivos están a salvo.</span>
            </div>
          </aside>
        )}
      </div>
      <footer className="statusbar">
        <div>
          <span className="connection-dot" />
          <span>Todo local</span>
          <span className="status-separator" />
          <GitBranch size={12} />
          <span>{repo?.branch || "Gitgrove"}</span>
          {currentBranch &&
            (currentBranch.ahead > 0 || currentBranch.behind > 0) && (
              <span>
                ↑ {currentBranch.ahead} ↓ {currentBranch.behind}
              </span>
            )}
        </div>
        <div>
          {loading ? (
            <>
              <LoaderCircle size={11} className="spin" />
              Actualizando…
            </>
          ) : (
            <>
              <Check size={12} />
              {lastRefresh
                ? `Actualizado ${lastRefresh.toLocaleTimeString("es", { hour: "2-digit", minute: "2-digit" })}`
                : "Listo para explorar"}
            </>
          )}
          <span className="status-separator" />
          <span>
            Gitgrove <span className="version">v1.1.0</span>
          </span>
        </div>
      </footer>
      {toast && (
        <div className="toast" role="status">
          <Check size={16} />
          {toast}
        </div>
      )}
      {modal === "open" && (
        <Modal
          title="Abrir un repositorio"
          subtitle="Tu próximo proyecto, a un clic de distancia."
          onClose={() => setModal(null)}
        >
          <div className="modal-body">
            <div className="open-options">
              <button
                onClick={chooseFolder}
                disabled={!ready || opening}
                className="open-option"
              >
                <FolderOpen size={23} />
                <strong>Carpeta local</strong>
                <span>
                  {typeof window !== "undefined" && window.desktop
                    ? "Elegir en Finder"
                    : "Ingresá la ruta abajo"}
                </span>
              </button>
              <button className="open-option" onClick={loadGithub}>
                <Github size={23} />
                <strong>Desde GitHub</strong>
                <span>Usar tu sesión de la CLI</span>
              </button>
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void openRepository(openPath);
              }}
            >
              <label className="field-label" htmlFor="repo-path">
                Ruta del repositorio
              </label>
              <div className="path-input">
                <Folder size={16} />
                <input
                  id="repo-path"
                  value={openPath}
                  onChange={(e) => setOpenPath(e.target.value)}
                  placeholder="~/Projects/mi-repositorio"
                  autoComplete="off"
                />
                <button
                  className="primary-button"
                  disabled={opening || !openPath.trim()}
                >
                  {opening ? (
                    <LoaderCircle size={15} className="spin" />
                  ) : (
                    <ArrowRight size={16} />
                  )}
                </button>
              </div>
            </form>
            {error && (
              <p className="form-error" role="alert">
                {error}
              </p>
            )}
            <div className="recent-heading">
              <span className="eyebrow">REPOSITORIOS EN TU MAC</span>
              <span>{repos.length}</span>
            </div>
            <div className="recent-repos">
              {repos.map((r) => (
                <button
                  key={r.path}
                  className="recent-repo"
                  onClick={() => openRepository(r.path)}
                  disabled={opening}
                >
                  <span className="repo-folder-icon">
                    <FolderGit2 size={20} />
                  </span>
                  <span>
                    <strong>{r.name}</strong>
                    <small>{r.path}</small>
                  </span>
                  <ArrowUp size={15} className="diagonal-arrow" />
                </button>
              ))}
              {!repos.length && (
                <p className="muted">Abrí una carpeta local para empezar.</p>
              )}
            </div>
          </div>
          <div className="modal-foot">
            <ShieldCheck size={14} />
            No necesitás una cuenta para explorar repositorios locales.
          </div>
        </Modal>
      )}
      {modal === "github" && (
        <Modal
          title="Tus repositorios de GitHub"
          subtitle="Una conexión menos. Usamos la sesión de tu GitHub CLI."
          onClose={() => setModal(null)}
        >
          <div className="modal-body">
            {account ? (
              <div className="github-account">
                <Github size={24} />
                <div>
                  <strong>{account.name || account.login}</strong>
                  <span>@{account.login}</span>
                </div>
                <span className="connected-label">
                  <span className="connection-dot" />
                  Conectado
                </span>
                <IconButton
                  icon={RefreshCw}
                  label="Actualizar GitHub"
                  onClick={loadGithub}
                />
              </div>
            ) : (
              !githubLoading && (
                <div className="connect-instructions">
                  <Terminal size={25} />
                  <h3>Conectá tu cuenta desde Terminal</h3>
                  <p>Si ya tenés la CLI instalada, ejecutá:</p>
                  <button
                    className="code-command"
                    onClick={() => copy("gh auth login")}
                  >
                    gh auth login
                    <Copy size={14} />
                  </button>
                  <p>Después, volvé acá. Gitgrove usará esa misma sesión.</p>
                  <div className="button-row">
                    <button className="primary-button" onClick={loadGithub}>
                      <RefreshCw size={14} />
                      Ya inicié sesión
                    </button>
                    <button
                      className="text-button"
                      onClick={() => external("https://cli.github.com/")}
                    >
                      Instalar GitHub CLI
                      <ExternalLink size={12} />
                    </button>
                  </div>
                </div>
              )
            )}
            {error && account && (
              <p className="form-error" role="alert">
                {error}
              </p>
            )}
            {githubLoading ? (
              <div className="modal-loading">
                <LoaderCircle size={25} className="spin" />
                Buscando tus repositorios…
              </div>
            ) : (
              account && (
                <>
                  <div className="modal-search">
                    <Search size={15} />
                    <input
                      aria-label="Buscar repositorios GitHub"
                      placeholder="Buscar un repositorio…"
                      value={githubSearch}
                      onChange={(e) => setGithubSearch(e.target.value)}
                    />
                  </div>
                  <div className="github-repos">
                    {githubList
                      .filter((r) =>
                        r.nameWithOwner
                          .toLowerCase()
                          .includes(githubSearch.toLowerCase()),
                      )
                      .map((r) => (
                        <button
                          key={r.nameWithOwner}
                          className={`github-repo ${cloneTarget === r.nameWithOwner ? "chosen" : ""}`}
                          onClick={() => setCloneTarget(r.nameWithOwner)}
                        >
                          <FolderGit2 size={19} />
                          <span>
                            <strong>
                              {r.nameWithOwner}
                              {r.isPrivate && <LockKeyhole size={11} />}
                            </strong>
                            <small>{r.description || "Sin descripción"}</small>
                          </span>
                          {cloneTarget === r.nameWithOwner ? (
                            <Check size={15} />
                          ) : (
                            <ChevronRight size={15} />
                          )}
                        </button>
                      ))}
                    {!githubList.length && (
                      <p className="muted">No se encontraron repositorios.</p>
                    )}
                  </div>
                  {cloneTarget && (
                    <div className="clone-form">
                      <p>
                        Clonar <strong>{cloneTarget}</strong> en tu Mac
                      </p>
                      {typeof window !== "undefined" && !window.desktop && (
                        <input
                          aria-label="Carpeta de destino"
                          value={cloneDestination}
                          onChange={(e) => setCloneDestination(e.target.value)}
                        />
                      )}
                      <button
                        className="primary-button"
                        onClick={clone}
                        disabled={opening}
                      >
                        {opening ? (
                          <LoaderCircle size={15} className="spin" />
                        ) : (
                          <ArrowDownToLine size={15} />
                        )}
                        {opening
                          ? "Clonando repositorio…"
                          : "Elegir carpeta y clonar"}
                      </button>
                    </div>
                  )}
                </>
              )
            )}
          </div>
          <div className="modal-foot">
            <LockKeyhole size={13} />
            Tus credenciales las administra GitHub CLI.
          </div>
        </Modal>
      )}
      {modal === "settings" && (
        <Modal
          title="A tu manera"
          subtitle="Un espacio cómodo para explorar tu código."
          onClose={() => setModal(null)}
        >
          <div className="modal-body">
            <div className="settings-brand">
              <span className="brand-symbol">
                <GitFork size={25} />
              </span>
              <div>
                <h3>
                  Gitgrove <span>1.1.0</span>
                </h3>
                <p>Tu historial, con perspectiva.</p>
              </div>
              <span className="personal-badge">PERSONAL</span>
            </div>
            <div className="setting-row">
              <div>
                <strong>Filas compactas</strong>
                <p>Más commits en el mismo espacio.</p>
              </div>
              <button
                className={`switch ${dense ? "on" : ""}`}
                role="switch"
                aria-checked={dense}
                aria-label="Filas compactas"
                onClick={() => setDense(!dense)}
              >
                <span />
              </button>
            </div>
            <div className="setting-row">
              <div>
                <strong>Actualizar automáticamente</strong>
                <p>Revisar los cambios locales cada 15 segundos.</p>
              </div>
              <button
                className={`switch ${autoRefresh ? "on" : ""}`}
                role="switch"
                aria-checked={autoRefresh}
                aria-label="Actualizar automáticamente"
                onClick={() => setAutoRefresh(!autoRefresh)}
              >
                <span />
              </button>
            </div>
            <div className="setting-row">
              <div>
                <strong>
                  <Github size={15} />
                  GitHub CLI
                </strong>
                <p>
                  {account
                    ? `Conectado como ${account.login}`
                    : githubChecked
                      ? "No se detectó una sesión activa."
                      : "Verificando conexión…"}
                </p>
              </div>
              <button className="secondary-button" onClick={loadGithub}>
                {account ? "Ver repositorios" : "Conectar"}
              </button>
            </div>
            <div className="shortcuts">
              <span className="eyebrow">A UN ATAJO DE DISTANCIA</span>
              <div>
                <span>Abrir repositorio</span>
                <kbd>⌘ O</kbd>
              </div>
              <div>
                <span>Buscar commits</span>
                <kbd>⌘ F</kbd>
              </div>
              <div>
                <span>Actualizar vista</span>
                <kbd>⌘ R</kbd>
              </div>
              <div>
                <span>Cerrar panel o búsqueda</span>
                <kbd>esc</kbd>
              </div>
            </div>
          </div>
          <div className="modal-foot">
            <TreePine size={14} />
            Sin planes. Sin límites de repositorios. Sin ruido.
          </div>
        </Modal>
      )}
      {diffFile && (
        <Modal
          wide
          title={diffFile.split("/").pop() || diffFile}
          subtitle={`${working ? "Cambios locales" : selected.slice(0, 7)}  /  ${diffFile}`}
          onClose={() => setDiffFile(null)}
        >
          <div className="diff-modal-toolbar">
            <span>
              <FileCode2 size={14} />
              Diff unificado
            </span>
            <button
              className="text-button"
              onClick={() => copy(diff?.patch || "")}
              disabled={!diff}
            >
              <Copy size={13} />
              Copiar diff
            </button>
          </div>
          <div className="diff-modal-content">
            <nav className="diff-file-sidebar">
              <FileList
                files={files}
                mode="path"
                onSelect={setDiffFile}
                selected={diffFile}
              />
            </nav>
            <div className="diff-code">
              {diffLoading ? (
                <div className="modal-loading">
                  <LoaderCircle size={24} className="spin" />
                  Cargando diferencias…
                </div>
              ) : (
                <DiffContent patch={diff?.patch || ""} />
              )}
            </div>
          </div>
          {diff?.truncated && (
            <div className="modal-foot">
              Vista previa limitada por el tamaño del archivo.
            </div>
          )}
        </Modal>
      )}
    </div>
  );
}
const ArchiveIcon = Layers;
function FileList({
  files,
  mode,
  onSelect,
  selected,
}: {
  files: ChangedFile[];
  mode: "path" | "tree";
  onSelect: (path: string) => void;
  selected?: string;
}) {
  const groups =
    mode === "tree"
      ? Object.groupBy(files, (f) =>
          f.path.includes("/") ? f.path.slice(0, f.path.lastIndexOf("/")) : ".",
        )
      : { "": files };
  return (
    <div className="file-list">
      {Object.entries(groups).map(([folder, group]) => (
        <div key={folder}>
          {mode === "tree" && (
            <div className="file-folder">
              <ChevronDown size={11} />
              <Folder size={13} />
              <span>{folder}</span>
            </div>
          )}
          {group?.map((file) => (
            <button
              className={`file-row ${file.path === selected ? "selected" : ""}`}
              key={file.path}
              onClick={() => onSelect(file.path)}
              title={`${file.oldPath ? `${file.oldPath} → ` : ""}${file.path}${file.staged ? " (en staging)" : ""}`}
            >
              <FileCode2 size={14} />
              <span className="file-path">
                {mode === "tree" ? file.path.split("/").pop() : file.path}
              </span>
              {file.staged && <Check size={11} className="staged-icon" />}
              {file.additions !== undefined ? (
                <span className="file-stats">
                  {file.binary ? (
                    <small>bin</small>
                  ) : (
                    <>
                      <span className="additions">+{file.additions}</span>
                      <span className="deletions">−{file.deletions}</span>
                    </>
                  )}
                </span>
              ) : (
                <span
                  className={`file-status status-${file.status === "?" ? "new" : file.status}`}
                >
                  {file.status === "?" ? "U" : file.status}
                </span>
              )}
            </button>
          ))}
        </div>
      ))}
    </div>
  );
}
function parseDiffLines(patch: string) {
  let oldLine = 0,
    newLine = 0;
  return patch.split("\n").map((line) => {
    const hunk = line.match(/^@@ -(\d+)(?:,\d+)? \+(\d+)/);
    const metadata =
      /^(diff |index |--- |\+\+\+ |new file|deleted file|similarity |rename |Binary |\\)/.test(
        line,
      );
    if (hunk) {
      oldLine = Number(hunk[1]);
      newLine = Number(hunk[2]);
    }
    const addition = !metadata && line.startsWith("+"),
      deletion = !metadata && line.startsWith("-"),
      context = !metadata && !hunk && line.startsWith(" ");
    const old = deletion || context ? oldLine++ : "",
      next = addition || context ? newLine++ : "";
    return {
      line,
      old,
      next,
      kind: hunk
        ? "hunk"
        : metadata
          ? "metadata"
          : addition
            ? "added"
            : deletion
              ? "removed"
              : "",
    };
  });
}
function DiffContent({ patch }: { patch: string }) {
  return (
    <div className="diff-lines">
      {parseDiffLines(patch).map(({ line, old, next, kind }, i) => (
        <div className={`diff-line ${kind}`} key={i}>
          <span className="line-number">{old}</span>
          <span className="line-number">{next}</span>
          <code>{line || " "}</code>
        </div>
      ))}
    </div>
  );
}
