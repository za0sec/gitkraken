export type Commit = {
  hash: string;
  parents: string[];
  author: string;
  email: string;
  date: string;
  subject: string;
  body: string;
  refs: string[];
};
export type Branch = {
  name: string;
  hash: string;
  current: boolean;
  remote: boolean;
  upstream: string;
  ahead: number;
  behind: number;
};
export type ChangedFile = {
  path: string;
  status: string;
  staged: boolean;
  additions?: number;
  deletions?: number;
  binary?: boolean;
  oldPath?: string;
};
export type Repository = { path: string; name: string };
export type RepoData = {
  head: string;
  path: string;
  name: string;
  branch: string;
  commits: Commit[];
  branches: Branch[];
  tags: { name: string; hash: string }[];
  files: ChangedFile[];
  worktrees: { path: string; branch: string; head: string }[];
  stashes: { ref: string; subject: string; hash: string }[];
  remotes: { name: string; url: string }[];
  hasMore: boolean;
  total: number;
};
export type CommitDetail = { commit: Commit; files: ChangedFile[] };
export type GithubAccount = { login: string; name: string; avatar_url: string };
export type GithubRepo = {
  name: string;
  nameWithOwner: string;
  description: string;
  isPrivate: boolean;
  updatedAt: string;
  url: string;
};
