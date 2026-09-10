import { test } from "node:test";
import assert from "node:assert/strict";
import { layoutGraph } from "../src/lib/graph";
import type { Commit } from "../src/lib/types";
const commit = (
  hash: string,
  parents: string[],
  refs: string[] = [],
): Commit => ({
  hash,
  parents,
  refs,
  author: "Author",
  email: "a@example.com",
  date: "2026-09-09",
  subject: hash,
  body: "",
});
test("keeps each branch in its own lane until the actual shared parent row", () => {
  const commits = [
    commit("feature-tip", ["base"], ["feature"]),
    commit("main-tip", ["main-previous"], ["origin/main"]),
    commit("main-previous", ["base"]),
    commit("base", []),
  ];
  const graph = layoutGraph(commits);
  const feature = graph.rows[0].lane,
    main = graph.rows[1].lane;
  assert.notEqual(feature, main);
  assert.equal(graph.rows[2].lane, main);
  assert.equal(graph.rows[2].after[feature], "base");
  assert.equal(graph.rows[2].after[main], "base");
  assert.equal(
    graph.rows[3].lane,
    main,
    "main preserves its lane at convergence",
  );
  assert.deepEqual(
    graph.rows[3].joins.map((join) => join.lane),
    [feature],
  );
});
test("draws octopus merges and every incoming edge without premature joins", () => {
  const commits = [
    commit("merge", ["main", "a", "b"], ["master"]),
    commit("a", ["base"]),
    commit("b", ["base"]),
    commit("main", ["base"]),
    commit("base", []),
  ];
  const graph = layoutGraph(commits);
  assert.equal(graph.rows[0].parents.length, 3);
  assert.equal(graph.rows[4].joins.length, 2);
  const indexByHash = new Map(commits.map((c, i) => [c.hash, i]));
  graph.rows.forEach((row, index) => {
    row.parents.forEach((edge) => {
      const target = indexByHash.get(edge.hash)!;
      for (let middle = index + 1; middle < target; middle++)
        assert.equal(graph.rows[middle].before[edge.lane], edge.hash);
      assert.equal(graph.rows[target].before[edge.lane], edge.hash);
    });
  });
});
test("retains continuation lanes when history is paginated", () => {
  const commits = [
    commit("new", ["old"]),
    commit("other", ["older"]),
    commit("old", ["base"]),
    commit("older", ["base"]),
    commit("base", []),
  ];
  assert.deepEqual(
    layoutGraph(commits.slice(0, 3)).rows,
    layoutGraph(commits).rows.slice(0, 3),
  );
});
