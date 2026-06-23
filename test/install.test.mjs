import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import test from "node:test";

import { doctorOpenSpecHarness, getOpenCodeConfigPaths, installOpenSpecHarness } from "../lib/install.js";

async function fixtureConfig() {
  const root = await mkdtemp(join(tmpdir(), "openspec-install-"));
  await writeFile(join(root, "opencode.jsonc"), [
    "{",
    "  // existing user plugin",
    "  \"plugin\": [\"existing-plugin\"],",
    "  \"command\": {",
    "    \"user:command\": { \"template\": \"keep me\" },",
    "  },",
    "}"
  ].join("\n"));
  return root;
}

test("installOpenSpecHarness merges OpenCode config and writes wrapper", async () => {
  const configDir = await fixtureConfig();
  const result = installOpenSpecHarness({
    configDir,
    packageSpec: "github:davidyuan1223/openspec-harness#opencode",
    npmInstall: false
  });

  assert.equal(result.ok, true);

  const paths = getOpenCodeConfigPaths(configDir);
  const config = JSON.parse(await readFile(paths.configJsonc, "utf8"));
  const pkg = JSON.parse(await readFile(paths.packageJson, "utf8"));
  const wrapper = await readFile(paths.pluginWrapper, "utf8");

  assert.deepEqual(config.plugin, ["existing-plugin", "./plugins/openspec-harness.js"]);
  assert.equal(config.permission.skill["openspec-harness-*"], "allow");
  assert.equal(config.command["user:command"].template, "keep me");
  assert.ok(config.command["openspec-harness:explore"]);
  assert.equal(pkg.dependencies["@davidyuan1223/openspec-harness-opencode"], "github:davidyuan1223/openspec-harness#opencode");
  assert.match(wrapper, /OpenSpecHarnessPlugin as default/u);
  assert.equal(existsSync(join(paths.skillsDir, "openspec-harness-explore", "SKILL.md")), true);
});

test("installOpenSpecHarness can register package mode", async () => {
  const configDir = await fixtureConfig();
  const result = installOpenSpecHarness({
    configDir,
    packageSpec: "@davidyuan1223/openspec-harness-opencode@0.1.4",
    pluginMode: "package",
    npmInstall: false
  });

  assert.equal(result.ok, true);

  const paths = getOpenCodeConfigPaths(configDir);
  const config = JSON.parse(await readFile(paths.configJsonc, "utf8"));
  assert.deepEqual(config.plugin, ["existing-plugin", "@davidyuan1223/openspec-harness-opencode@0.1.4"]);
});

test("doctorOpenSpecHarness reports installed global integration", async () => {
  const configDir = await fixtureConfig();
  installOpenSpecHarness({
    configDir,
    packageSpec: "file:///tmp/openspec-harness.tgz",
    npmInstall: false
  });

  const result = doctorOpenSpecHarness({ configDir });

  assert.equal(result.ok, true);
  assert.equal(result.pluginRegistered, true);
  assert.equal(result.dependencyInstalled, true);
  assert.equal(result.skillsPresent, true);
  assert.ok(result.commandCount >= 10);
});
