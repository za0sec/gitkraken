const { cp, readdir, lstat } = require("node:fs/promises");
const path = require("node:path");
module.exports = async (context) => {
  const source = path.join(context.packager.projectDir, ".next", "standalone");
  const destination = path.join(
    context.appOutDir,
    "Gitgrove.app",
    "Contents",
    "Resources",
    "server",
  );
  // Preserve pnpm's relative symlinks. electron-builder's resource filters omit node_modules.
  await cp(source, destination, {
    recursive: true,
    verbatimSymlinks: true,
    filter: (file) => !path.basename(file).startsWith(".env"),
  });
  async function verify(dir) {
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      const file = path.join(dir, entry.name);
      if (entry.isSymbolicLink()) {
        const resolved = await require("node:fs/promises").realpath(file);
        if (!resolved.startsWith(destination + path.sep))
          throw new Error(`Packaged dependency escapes the app: ${file}`);
        await lstat(resolved);
      } else if (entry.isDirectory()) await verify(file);
    }
  }
  await verify(destination);
};
