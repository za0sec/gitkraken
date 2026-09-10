"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowDown,
  CheckCheck,
  Cloud,
  GitBranch,
  GitCommitHorizontal,
  Layers,
  LoaderCircle,
  Tag,
} from "lucide-react";
import {
  GRAPH_COLORS,
  LANE_SPACING,
  NODE_RADIUS,
  WORKING_COLOR,
  laneX,
  type GraphRow,
} from "@/lib/graph";
import type { Commit, RepoData } from "@/lib/types";

type Reference = {
  label: string;
  names: string[];
  kind: "branch" | "tag";
  remote: boolean;
  isHead: boolean;
  worktree: boolean;
};
export function commitReferences(commit: Commit, repo: RepoData): Reference[] {
  const branches = repo.branches.filter(
    (branch) => branch.hash === commit.hash,
  );
  const locals = branches.filter((branch) => !branch.remote);
  const refs: Reference[] = locals.map((branch) => {
    const matching = branches.filter(
      (remote) =>
        remote.remote &&
        (remote.name === branch.upstream ||
          remote.name.split("/").slice(1).join("/") === branch.name),
    );
    return {
      label: branch.name,
      names: [branch.name, ...matching.map((b) => b.name)],
      kind: "branch",
      remote: matching.length > 0,
      isHead: branch.current,
      worktree: repo.worktrees.some((tree) => tree.branch === branch.name),
    };
  });
  for (const branch of branches.filter((branch) => branch.remote)) {
    if (refs.some((ref) => ref.names.includes(branch.name))) continue;
    refs.push({
      label: branch.name.split("/").slice(1).join("/"),
      names: [branch.name],
      kind: "branch",
      remote: true,
      isHead: false,
      worktree: false,
    });
  }
  for (const ref of commit.refs.filter((ref) => ref.startsWith("tag: ")))
    refs.push({
      label: ref.slice(5),
      names: [ref],
      kind: "tag",
      remote: false,
      isHead: false,
      worktree: false,
    });
  if (commit.hash === repo.head && !refs.some((ref) => ref.isHead))
    refs.unshift({
      label: "HEAD",
      names: ["HEAD separado"],
      kind: "branch",
      remote: false,
      isHead: true,
      worktree: false,
    });
  return refs.sort(
    (a, b) =>
      Number(b.isHead) - Number(a.isHead) ||
      Number(a.kind === "tag") - Number(b.kind === "tag"),
  );
}
function ReferenceLabels({
  refs,
  color,
}: {
  refs: Reference[];
  color: string;
}) {
  if (!refs.length) return <span className="commit-references" />;
  const primary = refs[0];
  const title = refs
    .map(
      (ref) => `${ref.names.join(" · ")}${ref.isHead ? " ← HEAD actual" : ""}`,
    )
    .join("\n");
  return (
    <span className="commit-references" title={title}>
      <span
        className={`graph-ref ${primary.kind === "tag" ? "graph-tag" : ""} ${primary.isHead ? "current-ref" : ""}`}
        style={{ "--ref-color": color } as React.CSSProperties}
      >
        {primary.isHead && <GitBranch size={12} />}
        {primary.kind === "tag" && <Tag size={11} />}
        <span className="graph-ref-name">{primary.label}</span>
        {primary.worktree && <Layers size={11} />}
        {primary.remote && <Cloud size={12} />}
      </span>
      {refs.length > 1 && (
        <span className="ref-overflow">+{refs.length - 1}</span>
      )}
    </span>
  );
}
function GraphCell({
  row,
  commit,
  width,
  height,
  avatar,
  working,
  head,
  wipAbove,
}: {
  row: GraphRow;
  commit: Commit;
  width: number;
  height: number;
  avatar?: string;
  working: boolean;
  head: boolean;
  wipAbove: boolean;
}) {
  const offset = working ? LANE_SPACING : 0;
  const x = (lane: number) => laneX(lane) + offset;
  const middle = height / 2,
    center = x(row.lane),
    radius = NODE_RADIUS;
  const clip = `avatar-${commit.hash}`;
  return (
    <svg
      width={width}
      height={height}
      className="graph-cell"
      data-lane={row.lane}
      data-hash={commit.hash}
      aria-label={`${commit.author}: ${commit.subject}`}
    >
      <rect
        className="graph-lane-band"
        x={center}
        y="0"
        width={Math.max(0, width - center)}
        height={height}
        fill={row.color}
        opacity=".09"
      />
      <path
        d={`M${width - 1},0 V${height}`}
        stroke={row.color}
        strokeWidth="2"
        opacity=".8"
      />
      {working && wipAbove && (
        <path
          className="wip-connection"
          data-parent={head ? commit.hash : undefined}
          d={
            head
              ? `M${laneX(0)},0 V${middle - 7} Q${laneX(0)},${middle} ${laneX(0) + 8},${middle} H${center}`
              : `M${laneX(0)},0 V${height}`
          }
          stroke={WORKING_COLOR}
          strokeDasharray="3 3"
          strokeWidth="1.8"
          fill="none"
        />
      )}
      {row.before.map((hash, lane) =>
        hash && hash !== commit.hash ? (
          <path
            key={lane}
            d={`M${x(lane)},0 V${height}`}
            stroke={GRAPH_COLORS[lane % GRAPH_COLORS.length]}
            strokeWidth="2"
            fill="none"
          />
        ) : null,
      )}
      {row.joins.map((join) => (
        <path
          className="branch-join"
          key={join.lane}
          data-parent={commit.hash}
          data-from-lane={join.lane}
          d={`M${x(join.lane)},0 C${x(join.lane)},${middle} ${center},0 ${center},${middle}`}
          stroke={join.color}
          strokeWidth="2"
          fill="none"
        />
      ))}
      {row.incoming && (
        <path
          d={`M${center},0 V${middle}`}
          stroke={row.color}
          strokeWidth="2"
        />
      )}
      {row.parents.map((parent) => (
        <path
          className="parent-edge"
          key={parent.hash}
          data-parent={parent.hash}
          data-parent-lane={parent.lane}
          d={
            parent.lane === row.lane
              ? `M${center},${middle} V${height}`
              : `M${center},${middle} C${center},${height} ${x(parent.lane)},${middle} ${x(parent.lane)},${height}`
          }
          fill="none"
          stroke={parent.color}
          strokeWidth="2"
        />
      ))}
      <circle
        cx={center}
        cy={middle}
        r={radius + 1}
        fill="var(--canvas)"
        stroke={row.color}
        strokeWidth="2"
      />
      {avatar ? (
        <>
          <defs>
            <clipPath id={clip}>
              <circle cx={center} cy={middle} r={radius - 1} />
            </clipPath>
          </defs>
          <image
            className="commit-photo"
            href={avatar}
            x={center - radius + 1}
            y={middle - radius + 1}
            width={(radius - 1) * 2}
            height={(radius - 1) * 2}
            clipPath={`url(#${clip})`}
            preserveAspectRatio="xMidYMid slice"
          />
        </>
      ) : (
        <>
          <circle
            cx={center}
            cy={middle}
            r={radius - 1}
            fill={row.color}
            opacity=".2"
          />
          <text
            x={center}
            y={middle + 0.5}
            dominantBaseline="middle"
            textAnchor="middle"
            fill={row.color}
            fontSize="8"
            fontWeight="600"
          >
            {commit.author
              .split(/\s+/)
              .map((s) => s[0])
              .slice(0, 2)
              .join("")
              .toUpperCase()}
          </text>
        </>
      )}
      {commit.parents.length > 1 && (
        <circle
          className="merge-marker"
          cx={center + 8}
          cy={middle + 7}
          r="3"
          fill={row.color}
          stroke="var(--canvas)"
          strokeWidth="1"
        />
      )}
    </svg>
  );
}

type Props = {
  repo: RepoData;
  graph: { rows: GraphRow[]; width: number };
  selected: string;
  branchFilter: string;
  search: string;
  matches: Set<string>;
  dense: boolean;
  loading: boolean;
  limit: number;
  avatars: Record<string, string>;
  onAvatars: (images: Record<string, string>) => void;
  onSelect: (hash: string) => void;
  onLoadMore: () => void;
  formatDate: (date: string) => string;
};
export default function HistoryGraph({
  repo,
  graph,
  selected,
  branchFilter,
  search,
  matches,
  dense,
  loading,
  limit,
  avatars,
  onAvatars,
  onSelect,
  onLoadMore,
  formatDate,
}: Props) {
  const scroller = useRef<HTMLDivElement>(null);
  const [viewport, setViewport] = useState({ top: 0, height: 720 });
  const rowHeight = dense ? 30 : 36,
    headerHeight = 29;
  const withWorking = !branchFilter;
  const offset = headerHeight + (withWorking ? rowHeight : 0);
  const start = Math.max(0, Math.floor((viewport.top - offset) / rowHeight));
  const end = Math.min(
    repo.commits.length,
    Math.ceil((viewport.top + viewport.height - offset) / rowHeight) + 2,
  );
  // Size the graph to the lanes on screen, not a distant branch hundreds of rows below.
  const visibleWidth = Math.max(
    1,
    ...graph.rows.slice(start, end).map((row) => row.width),
  );
  const width = Math.max(
    180,
    laneX(visibleWidth - 1) + (withWorking ? LANE_SPACING : 0) + 35,
  );
  const headIndex = repo.commits.findIndex(
    (commit) => commit.hash === repo.head,
  );
  const refs = useMemo(
    () => repo.commits.map((commit) => commitReferences(commit, repo)),
    [repo],
  );
  const visibleEmails = [
    ...new Set(repo.commits.slice(start, end).map((commit) => commit.email)),
  ].slice(0, 12);
  const requestHashes = visibleEmails.flatMap((email) =>
    repo.commits
      .filter((commit) => commit.email === email)
      .slice(0, 3)
      .map((commit) => commit.hash),
  );
  const requestKey = requestHashes.join(",");
  useEffect(() => {
    const element = scroller.current;
    if (!element) return;
    const update = () =>
      setViewport((previous) =>
        previous.top === element.scrollTop &&
        previous.height === element.clientHeight
          ? previous
          : { top: element.scrollTop, height: element.clientHeight },
      );
    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    if (
      !requestKey ||
      !repo.remotes.some((remote) => remote.url.includes("github.com"))
    )
      return;
    let cancelled = false;
    fetch("/api/git", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "avatars",
        path: repo.path,
        hashes: requestKey.split(","),
      }),
    })
      .then((response) => (response.ok ? response.json() : {}))
      .then((images) => {
        if (!cancelled && Object.keys(images).length) onAvatars(images);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [repo.path, repo.remotes, requestKey, onAvatars]);
  return (
    <div
      className="commit-scroll"
      ref={scroller}
      onScroll={(event) => {
        const top = event.currentTarget.scrollTop;
        setViewport((previous) =>
          previous.top === top ? previous : { ...previous, top },
        );
      }}
    >
      <div
        className="commit-table branch-graph-table"
        style={
          {
            "--graph-width": `${width}px`,
            "--row-height": `${rowHeight}px`,
          } as React.CSSProperties
        }
      >
        <div className="commit-table-header">
          <span>RAMA / TAG</span>
          <span>GRAFO</span>
          <span>MENSAJE DEL COMMIT</span>
          <span>AUTOR</span>
          <span>COMMIT</span>
          <span>FECHA</span>
        </div>
        {withWorking && (
          <button
            className={`commit-row working-row ${selected === "working" ? "selected" : ""}`}
            onClick={() => onSelect("working")}
            data-parent={repo.head}
          >
            <span className="commit-references">
              <span
                className="working-ref"
                title={`Cambios locales en ${repo.branch}\nHEAD: ${repo.head}`}
              >
                <GitBranch size={12} />
                <span>{repo.branch}</span>
                <span>HEAD</span>
              </span>
            </span>
            <svg
              className="working-cell"
              width={width}
              height={rowHeight}
              aria-hidden="true"
            >
              <rect
                x={laneX(0)}
                width={width - laneX(0)}
                height={rowHeight}
                fill={WORKING_COLOR}
                opacity=".14"
              />
              {repo.head && (
                <path
                  d={`M${laneX(0)},${rowHeight / 2} V${rowHeight}`}
                  stroke={WORKING_COLOR}
                  strokeDasharray="3 3"
                  strokeWidth="1.8"
                />
              )}
              <circle
                cx={laneX(0)}
                cy={rowHeight / 2}
                r={NODE_RADIUS + 1}
                fill="var(--canvas)"
                stroke={WORKING_COLOR}
                strokeWidth="2"
                strokeDasharray="3 2"
              />
            </svg>
            <span className="commit-message">
              <span className="wip-pill">WIP</span>
              <span>
                {repo.files.length
                  ? `${repo.files.length} archivos con cambios`
                  : "Directorio de trabajo limpio"}
              </span>
              {!repo.files.length && <CheckCheck size={14} />}
            </span>
            <span className="commit-author" />
            <span className="commit-hash" />
            <span className="commit-date" />
          </button>
        )}
        {repo.commits.map((commit, index) => (
          <button
            id={`commit-${commit.hash}`}
            key={commit.hash}
            className={`commit-row ${selected === commit.hash ? "selected" : ""} ${search && !matches.has(commit.hash) ? "dimmed" : ""} ${search && matches.has(commit.hash) ? "match" : ""}`}
            onClick={() => onSelect(commit.hash)}
            title={`${commit.subject}\n${commit.author} · ${commit.hash.slice(0, 8)}`}
            style={
              { "--lane-color": graph.rows[index].color } as React.CSSProperties
            }
          >
            <ReferenceLabels
              refs={refs[index]}
              color={graph.rows[index].color}
            />
            <GraphCell
              row={graph.rows[index]}
              commit={commit}
              width={width}
              height={rowHeight}
              avatar={avatars[commit.email]}
              working={withWorking}
              head={index === headIndex}
              wipAbove={
                Boolean(repo.head) && (headIndex < 0 || index <= headIndex)
              }
            />
            <span className="commit-message">
              <span className="commit-subject">{commit.subject}</span>
            </span>
            <span className="commit-author">{commit.author}</span>
            <span className="commit-hash">{commit.hash.slice(0, 7)}</span>
            <span className="commit-date">{formatDate(commit.date)}</span>
          </button>
        ))}
        {!repo.commits.length && (
          <div className="empty-history">
            <GitCommitHorizontal size={30} />
            <h3>Tu historia empieza acá</h3>
            <p>Este repositorio todavía no tiene commits.</p>
          </div>
        )}
        {repo.hasMore && (
          <div className="load-more">
            <button
              className="secondary-button"
              disabled={loading || limit >= 10000}
              onClick={onLoadMore}
            >
              {loading ? (
                <LoaderCircle size={14} className="spin" />
              ) : (
                <ArrowDown size={14} />
              )}
              {limit >= 10000
                ? "Límite de 10.000 commits · filtrá por rama"
                : "Cargar más commits"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
