import { access, readFile, readdir, stat } from "node:fs/promises";
import { join } from "node:path";

export async function pathExists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

export async function readTextIfExists(path) {
  if (!(await pathExists(path))) {
    return null;
  }

  return readFile(path, "utf8");
}

export async function listDirectories(path) {
  if (!(await pathExists(path))) {
    return [];
  }

  const entries = await readdir(path);
  const directories = [];

  for (const entry of entries) {
    const fullPath = join(path, entry);
    if ((await stat(fullPath)).isDirectory()) {
      directories.push(entry);
    }
  }

  return directories.sort();
}
