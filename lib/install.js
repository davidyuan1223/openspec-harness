import { execFileSync, spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";

function readJson(path, fallback) {
  if (!existsSync(path)) return fallback;
  return JSON.parse(readFileSync(path, "utf8"));
}

function writeJson(path, value) {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}

function stripJsonComments(text) {
  let output = "";
  let inString = false;
  let quote = "";
  let escaped = false;
  let inLineComment = false;
  let inBlockComment = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];

    if (inLineComment) {
      if (char === "\n") {
        inLineComment = false;
        output += char;
      }
      continue;
    }

    if (inBlockComment) {
      if (char === "*" && next === "/") {
        inBlockComment = false;
        index += 1;
      }
      continue;
    }

    if (inString) {
      output += char;
      if (escaped) {
        escaped = false;
      } else if (char === "\\") {
        escaped = true;
      } else if (char === quote) {
        inString = false;
      }
      continue;
    }

    if (char === "\"" || char === "'") {
      inString = true;
      quote = char;
      output += char;
      continue;
    }

    if (char === "/" && next === "/") {
      inLineComment = true;
      index += 1;
      continue;
    }

    if (char === "/" && next === "*") {
      inBlockComment = true;
      index += 1;
      continue;
    }

    output += char;
  }

  return output.replace(/,\s*([}\]])/gu, "$1");
}

function readJsonc(path, fallback) {
  if (!existsSync(path)) return fallback;
  const text = readFileSync(path, "utf8");
  if (!text.trim()) return fallback;
  return JSON.parse(stripJsonComments(text));
}

export function getDefaultOpenCodeConfigDir() {
  const envConfigDir = process.env.OPENCODE_CONFIG_DIR?.trim();
  if (envConfigDir) return resolve(envConfigDir);

  if (process.platform === "win32") {
    const crossPlatformDir = join(homedir(), ".config", "opencode");
    if (existsSync(join(crossPlatformDir, "opencode.json")) || existsSync(join(crossPlatformDir, "opencode.jsonc"))) {
      return crossPlatformDir;
    }

    const appData = process.env.APPDATA || join(homedir(), "AppData", "Roaming");
    const appDataDir = join(appData, "opencode");
    if (existsSync(join(appDataDir, "opencode.json")) || existsSync(join(appDataDir, "opencode.jsonc"))) {
      return appDataDir;
    }

    return crossPlatformDir;
  }

  const xdgConfig = process.env.XDG_CONFIG_HOME || join(homedir(), ".config");
  return join(xdgConfig, "opencode");
}

export function getOpenCodeConfigPaths(configDir = getDefaultOpenCodeConfigDir()) {
  return {
    configDir,
    packageJson: join(configDir, "package.json"),
    configJson: join(configDir, "opencode.json"),
    configJsonc: join(configDir, "opencode.jsonc"),
    pluginsDir: join(configDir, "plugins"),
    skillsDir: join(configDir, "skills"),
    pluginWrapper: join(configDir, "plugins", "openspec-harness.js")
  };
}

function installedPackageInfo(root = packageRoot) {
  const pkg = readJson(join(root, "package.json"), {});
  return {
    name: pkg.name,
    version: pkg.version
  };
}

function packageSpecFromTarball(root) {
  const output = execFileSync(npmCommand, ["pack", "--silent"], {
    cwd: root,
    encoding: "utf8"
  }).trim();
  const tarball = join(root, output.split(/\r?\n/u).at(-1));
  return {
    packageSpec: pathToFileURL(tarball).href,
    tarball
  };
}

function dependencySpec(packageName, packageSpec) {
  const exactVersionPrefix = `${packageName}@`;
  if (packageSpec.startsWith(exactVersionPrefix)) return packageSpec.slice(exactVersionPrefix.length);
  return packageSpec;
}

function configPath(paths) {
  if (existsSync(paths.configJsonc)) return paths.configJsonc;
  if (existsSync(paths.configJson)) return paths.configJson;
  return paths.configJsonc;
}

function normalizeArray(value) {
  if (Array.isArray(value)) return value.filter((item) => typeof item === "string");
  if (typeof value === "string") return [value];
  return [];
}

function addUnique(list, value, predicate = (item) => item === value) {
  return list.some(predicate) ? list : [...list, value];
}

function removePluginEntries(list, packageName) {
  return list.filter((item) => {
    if (item === packageName || item.startsWith(`${packageName}@`)) return false;
    if (item === "openspec-harness-opencode" || item.startsWith("openspec-harness-opencode@")) return false;
    return !item.endsWith("/openspec-harness.js") && item !== "./plugins/openspec-harness.js";
  });
}

function mergeOpenCodeConfig(paths, packageName, sourceConfig, { pluginMode, packageSpec }) {
  const targetPath = configPath(paths);
  const existing = readJsonc(targetPath, { "$schema": "https://opencode.ai/config.json" });
  const next = { ...existing };

  const pluginEntry = pluginMode === "package"
    ? (packageSpec.startsWith(`${packageName}@`) ? packageSpec : packageName)
    : "./plugins/openspec-harness.js";
  next.plugin = addUnique(removePluginEntries(normalizeArray(next.plugin), packageName), pluginEntry);

  next.permission ??= {};
  next.permission.skill ??= {};
  next.permission.skill["openspec-harness-*"] = "allow";

  next.command ??= {};
  Object.assign(next.command, sourceConfig.command ?? {});

  writeJson(targetPath, next);
  return targetPath;
}

function writePackageDependency(paths, packageName, packageSpec) {
  const packageJson = readJson(paths.packageJson, { dependencies: {} });
  packageJson.dependencies ??= {};
  packageJson.dependencies["@opencode-ai/plugin"] ??= "1.17.8";
  delete packageJson.dependencies["openspec-harness-opencode"];
  packageJson.dependencies[packageName] = dependencySpec(packageName, packageSpec);
  writeJson(paths.packageJson, packageJson);
}

function installDependencies(paths) {
  rmSync(join(paths.configDir, "package-lock.json"), { force: true });
  const result = spawnSync(npmCommand, ["install"], {
    cwd: paths.configDir,
    encoding: "utf8"
  });
  const summary = {
    ok: result.status === 0,
    status: result.status
  };
  if (result.status !== 0) {
    summary.stdout = result.stdout ?? "";
    summary.stderr = result.stderr ?? "";
  }
  return summary;
}

function detectOpenCode() {
  const binary = process.platform === "win32" ? "opencode.cmd" : "opencode";
  const result = spawnSync(binary, ["--version"], { encoding: "utf8" });
  return {
    ok: result.status === 0,
    version: result.status === 0 ? result.stdout.trim() : null,
    error: result.status === 0 ? null : (result.stderr || result.error?.message || "opencode not found")
  };
}

export function installOpenSpecHarness({
  root = packageRoot,
  configDir = getDefaultOpenCodeConfigDir(),
  packageSpec,
  pluginMode = "wrapper",
  npmInstall = true,
  syncSkills = true,
  localPack = false
} = {}) {
  const info = installedPackageInfo(root);
  if (!info.name?.startsWith("@")) {
    throw new Error(`Expected a scoped npm package name, got ${info.name ?? "<missing>"}.`);
  }

  const paths = getOpenCodeConfigPaths(resolve(configDir));
  const sourceConfig = readJson(join(root, "opencode.json"), {});
  const pack = localPack ? packageSpecFromTarball(root) : null;
  const resolvedPackageSpec = packageSpec ?? pack?.packageSpec ?? `${info.name}@${info.version}`;

  mkdirSync(paths.configDir, { recursive: true });
  mkdirSync(paths.pluginsDir, { recursive: true });
  mkdirSync(paths.skillsDir, { recursive: true });

  writePackageDependency(paths, info.name, resolvedPackageSpec);
  const npmResult = npmInstall ? installDependencies(paths) : { ok: true, skipped: true };
  if (!npmResult.ok) {
    return {
      ok: false,
      packageName: info.name,
      version: info.version,
      packageSpec: resolvedPackageSpec,
      configDir: paths.configDir,
      tarball: pack?.tarball ?? null,
      npm: npmResult,
      error: "npm install failed in OpenCode config directory"
    };
  }

  writeFileSync(
    paths.pluginWrapper,
    `export { OpenSpecHarnessPlugin as default, OpenSpecHarnessPlugin } from "${info.name}";\n`
  );

  if (syncSkills) {
    for (const entry of readdirSync(paths.skillsDir, { withFileTypes: true })) {
      if (entry.isDirectory() && entry.name.startsWith("openspec-harness-")) {
        rmSync(join(paths.skillsDir, entry.name), { force: true, recursive: true });
      }
    }
    cpSync(join(root, ".opencode", "skills"), paths.skillsDir, { recursive: true });
  }

  const configFile = mergeOpenCodeConfig(paths, info.name, sourceConfig, {
    pluginMode,
    packageSpec: resolvedPackageSpec
  });

  return {
    ok: true,
    packageName: info.name,
    version: info.version,
    packageSpec: resolvedPackageSpec,
    pluginMode,
    configDir: paths.configDir,
    configFile,
    packageJson: paths.packageJson,
    pluginWrapper: paths.pluginWrapper,
    skillsDir: paths.skillsDir,
    tarball: pack?.tarball ?? null,
    npm: npmResult,
    opencode: detectOpenCode()
  };
}

export function doctorOpenSpecHarness({
  configDir = getDefaultOpenCodeConfigDir(),
  root = packageRoot
} = {}) {
  const info = installedPackageInfo(root);
  const paths = getOpenCodeConfigPaths(resolve(configDir));
  const targetPath = configPath(paths);
  const config = readJsonc(targetPath, {});
  const packageJson = readJson(paths.packageJson, {});
  const plugins = normalizeArray(config.plugin);
  const commands = Object.keys(config.command ?? {});
  const skillsPresent = existsSync(join(paths.skillsDir, "openspec-harness-explore", "SKILL.md"));
  const pluginRegistered = plugins.some((entry) =>
    entry === "./plugins/openspec-harness.js" ||
    entry === info.name ||
    entry.startsWith(`${info.name}@`)
  );
  const dependencyInstalled = Boolean(packageJson.dependencies?.[info.name]);
  const opencode = detectOpenCode();
  const findings = [];

  if (!existsSync(targetPath)) findings.push({ severity: "error", message: "OpenCode config file is missing." });
  if (!pluginRegistered) findings.push({ severity: "error", message: "OpenSpec Harness plugin is not registered in OpenCode config." });
  if (!dependencyInstalled) findings.push({ severity: "error", message: "OpenSpec Harness package is not listed in OpenCode config package.json." });
  if (!existsSync(paths.pluginWrapper)) findings.push({ severity: "error", message: "Plugin wrapper is missing." });
  if (!skillsPresent) findings.push({ severity: "error", message: "OpenSpec Harness skills are missing from OpenCode global skills." });
  if (!commands.includes("openspec-harness:explore")) findings.push({ severity: "error", message: "OpenSpec Harness commands are missing from OpenCode config." });
  if (!opencode.ok) findings.push({ severity: "warning", message: "opencode binary was not found on PATH." });

  return {
    ok: !findings.some((finding) => finding.severity === "error"),
    packageName: info.name,
    version: info.version,
    configDir: paths.configDir,
    configFile: targetPath,
    packageJson: paths.packageJson,
    pluginWrapper: paths.pluginWrapper,
    skillsDir: paths.skillsDir,
    pluginRegistered,
    dependencyInstalled,
    skillsPresent,
    commandCount: commands.filter((command) => command.startsWith("openspec-harness:")).length,
    opencode,
    findings
  };
}
