#!/usr/bin/env node

// src/index.ts
import { createRequire } from "module";
import { Command } from "commander";
import { render, useApp } from "ink";
import { HelloWorld } from "@maestro/tui";
import { createElement, useEffect } from "react";

// src/mode.ts
var HELP_FLAGS = /* @__PURE__ */ new Set(["-h", "--help"]);
var VERSION_FLAGS = /* @__PURE__ */ new Set(["-V", "--version"]);
function resolveCliMode(args) {
  if (args.some((arg) => VERSION_FLAGS.has(arg))) {
    return "version";
  }
  if (args.some((arg) => HELP_FLAGS.has(arg))) {
    return "help";
  }
  return "app";
}

// src/index.ts
var CLI_PACKAGE_NAME = "@maestro/cli";
var require2 = createRequire(import.meta.url);
var packageJson = require2("../package.json");
function HelloWorldApp(props) {
  const { autoExit, version } = props;
  const { exit } = useApp();
  useEffect(() => {
    if (!autoExit) {
      return;
    }
    const timer = setTimeout(() => {
      exit();
    }, 0);
    return () => {
      clearTimeout(timer);
    };
  }, [autoExit, exit]);
  return createElement(HelloWorld, { version });
}
function createProgram(version) {
  return new Command().name("maestro").description("Multi-agent coding orchestrator").version(version);
}
function runCli(args) {
  const version = packageJson.version;
  const mode = resolveCliMode(args);
  if (mode !== "app") {
    createProgram(version).parse(["node", "maestro", ...args]);
    return;
  }
  render(
    createElement(HelloWorldApp, {
      autoExit: !process.stdout.isTTY,
      version
    })
  );
}
runCli(process.argv.slice(2));
export {
  CLI_PACKAGE_NAME,
  runCli
};
//# sourceMappingURL=index.js.map