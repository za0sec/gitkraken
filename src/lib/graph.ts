import type { Commit } from "./types";

export const GRAPH_COLORS = [
  "#4695ff",
  "#b45aff",
  "#e84cda",
  "#f06a86",
  "#f39951",
  "#42c4a2",
  "#dfc44b",
  "#798fff",
  "#37b9db",
  "#c778e5",
  "#bbd16e",
  "#e988b0",
];
export const WORKING_COLOR = "#39bdd2";
export const LANE_SPACING = 30;
export const NODE_RADIUS = 10;
export const laneX = (lane: number) => 22 + lane * LANE_SPACING;
export type GraphRow = {
  lane: number;
  color: string;
  incoming: boolean;
  before: (string | null)[];
  after: (string | null)[];
  parents: { lane: number; color: string; hash: string }[];
  joins: { lane: number; color: string }[];
  width: number;
};

/** The input must be topologically ordered (git --date-order).
 * Each active lane is an edge waiting for its actual parent commit.
 * Several lanes may wait for the SAME hash: their lines join at that parent,
 * never prematurely at the last commit on one of the child branches.
 */
export function layoutGraph(commits: Commit[]): {
  rows: GraphRow[];
  width: number;
} {
  const lanes: (string | null)[] = [];
  const priorities: number[] = [];
  let width = 1,
    sequence = 10;
  const color = (lane: number) => GRAPH_COLORS[lane % GRAPH_COLORS.length];
  const rows = commits.map((commit) => {
    const before = [...lanes];
    const arriving = lanes.flatMap((hash, lane) =>
      hash === commit.hash ? [lane] : [],
    );
    arriving.sort((a, b) => priorities[a] - priorities[b] || a - b);
    let lane = arriving[0];
    const incoming = lane !== undefined;
    if (!incoming) {
      lane = lanes.indexOf(null);
      if (lane === -1) lane = lanes.length;
      const names = commit.refs.map((ref) =>
        ref.replace("HEAD -> ", "").replace(/^origin\//, ""),
      );
      priorities[lane] = names.some(
        (name) => name === "main" || name === "master",
      )
        ? 0
        : names.includes("develop")
          ? 1
          : sequence++;
    }
    const joins = arriving
      .filter((index) => index !== lane)
      .map((index) => ({ lane: index, color: color(index) }));
    for (const index of arriving) lanes[index] = null;
    lanes[lane] = null;
    const parents = commit.parents.map((hash, index) => {
      let target = lane;
      if (index > 0) {
        target = lanes.findIndex(
          (value, candidate) =>
            value === null &&
            !arriving.includes(candidate) &&
            candidate !== lane,
        );
        if (target === -1) target = lanes.length;
        priorities[target] = sequence++;
      }
      lanes[target] = hash;
      return { lane: target, color: color(target), hash };
    });
    const after = [...lanes];
    const rowWidth = Math.max(lane + 1, before.length, after.length);
    width = Math.max(width, rowWidth);
    while (lanes.length && lanes.at(-1) === null) lanes.pop();
    return {
      lane,
      color: color(lane),
      incoming,
      before,
      after,
      parents,
      joins,
      width: rowWidth,
    };
  });
  return { rows, width };
}
