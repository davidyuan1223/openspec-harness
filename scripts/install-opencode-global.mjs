import { execFileSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

const packageRoot = resolve(new URL("..", import.meta.url).pathname);
const opencodeConfigRoot = resolve(process.env.OPENCODE_CONFIG_DIR ?? `${process.env.HOME}/.config/opencode`);
const packageName = "openspec-harness-opencode";

function readJson(path, fallback) {
  if (!existsSync(path)) {
    return fallback;
  }

  return JSON.parse(readFileSync(path, "utf8"));
}

function writeJson(path, value) {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}

function packPackage() {
  const output = execFileSync("npm", ["pack", "--silent"], {
    cwd: packageRoot,
    encoding: "utf8"
  }).trim();

  return join(packageRoot, output.split(/\r?\n/u).at(-1));
}

mkdirSync(opencodeConfigRoot, { recursive: true });
mkdirSync(join(opencodeConfigRoot, "plugins"), { recursive: true });
mkdirSync(join(opencodeConfigRoot, "skills"), { recursive: true });

const tarball = packPackage();
const packageJsonPath = join(opencodeConfigRoot, "package.json");
const packageJson = readJson(packageJsonPath, { dependencies: {} });
packageJson.dependencies ??= {};
packageJson.dependencies["@opencode-ai/plugin"] = "1.17.8";
packageJson.dependencies[packageName] = `file:${tarball}`;
writeJson(packageJsonPath, packageJson);

rmSync(join(opencodeConfigRoot, "node_modules", packageName), {
  force: true,
  recursive: true
});
rmSync(join(opencodeConfigRoot, "package-lock.json"), { force: true });

execFileSync("npm", ["install"], {
  cwd: opencodeConfigRoot,
  stdio: "inherit"
});

writeFileSync(
  join(opencodeConfigRoot, "plugins", "openspec-harness.js"),
  `export { OpenSpecHarnessPlugin as GlobalOpenSpecHarnessPlugin } from "${packageName}";\n`
);

cpSync(join(packageRoot, ".opencode", "skills"), join(opencodeConfigRoot, "skills"), {
  recursive: true
});

const sourceConfig = readJson(join(packageRoot, "opencode.json"), {});
const globalConfigPath = join(opencodeConfigRoot, "opencode.jsonc");
const globalConfig = readJson(globalConfigPath, {
  "$schema": "https://opencode.ai/config.json"
});

globalConfig.permission ??= {};
globalConfig.permission.skill ??= {};
globalConfig.permission.skill["openspec-harness-*"] = "allow";
globalConfig.command ??= {};
Object.assign(globalConfig.command, sourceConfig.command ?? {});
writeJson(globalConfigPath, globalConfig);

process.stdout.write(
  JSON.stringify(
    {
      ok: true,
      packageRoot,
      opencodeConfigRoot,
      tarball,
      plugin: join(opencodeConfigRoot, "plugins", "openspec-harness.js"),
      skills: join(opencodeConfigRoot, "skills")
    },
    null,
    2
  )
);
process.stdout.write("\n");
