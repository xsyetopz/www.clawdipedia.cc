import { describe, expect, test } from "bun:test";

import { Bundle } from "../../src/ast.ts";
import { surface } from "../../src/surface/index.ts";
import { byName, names } from "./util.ts";

describe("flag", () => {
	test("option, requiredOption, and addOption with hideHelp", async () => {
		const src = `
var p=new C();
p.option("-d, --debug [filter]","Enable debug");
p.requiredOption("--issuer <url>","Issuer");
p.addOption(new O("--init","Run init").hideHelp());
p.addOption(new O("--shown","Shown"));
`;
		const by = await byName("flag", src);
		expect([...by.keys()].toSorted((a, b) => a.localeCompare(b))).toEqual([
			"--debug",
			"--init",
			"--issuer",
			"--shown",
		]);
		expect(by.get("--debug")?.detail).toBe(
			"-d, --debug [filter] | Enable debug",
		);
		expect(by.get("--init")?.gate).toBe("hidden");
		expect(by.get("--shown")?.gate).toBeUndefined();
	});

	test("a flag on a subcommand gets the command path", async () => {
		const src = `
var p=new C();
var m=p.command("mcp");
m.command("add <name>").option("--transport <t>","Transport");
`;
		expect(await names("flag", src)).toEqual(["mcp add --transport"]);
	});

	test("an option in a variable and a conditional one", async () => {
		const src = `
var p=new C();
let h=new O("--var-opt","V");
p.addOption(h);
var h2=new O("--cond-opt","C");
p.addOption(k?h2:h2.hideHelp());
`;
		const by = await byName("flag", src);
		expect(by.has("--var-opt")).toBe(true);
		expect(by.get("--cond-opt")?.gate).toBe("hidden unless k");
	});

	test("a subcommand built in a function through its parameter", async () => {
		const src = `
var p=new C();
function E(C){C.command("add <n>").option("--transport <t>","T")}
var m=p.command("mcp");
E(m);
`;
		expect(await names("flag", src)).toEqual(["mcp add --transport"]);
		expect(await names("subcommand", src)).toEqual(["mcp", "mcp add"]);
	});

	// Claude Code 2.1.321 names both the `xaa` command and the `mcp` argument `a`, in other scopes.
	test("a parameter whose argument has the name of a variable on the path", async () => {
		const src = `
var p=new C();
function T(C){let a=C.command("xaa");a.command("setup")}
function U(){let a=p.command("mcp");T(a)}
`;
		expect(await names("subcommand", src)).toContain("mcp xaa setup");
	});

	test("a non-flag first argument is dropped", async () => {
		expect(
			await names("flag", 'o.option("plain","x");o.option(1,"y");'),
		).toEqual([]);
	});
});

describe("subcommand", () => {
	test("paths, args, and hidden", async () => {
		const src = `
var p=new C();
var m=p.command("mcp");
m.command("add <name> [args...]");
p.command("secret",{hidden:!0});
p.command("auth").command("login");
`;
		const by = await byName("subcommand", src);
		expect([...by.keys()].toSorted((a, b) => a.localeCompare(b))).toEqual([
			"auth",
			"auth login",
			"mcp",
			"mcp add",
			"secret",
		]);
		expect(by.get("mcp add")?.detail).toBe("<name> [args...]");
		expect(by.get("secret")?.gate).toBe("hidden");
		expect(by.get("mcp")?.gate).toBeUndefined();
	});

	test("a name that starts with a dash or is not constant is dropped", async () => {
		expect(
			await names("subcommand", 'p.command("-x");p.command(f());'),
		).toEqual([]);
	});
});

// Claude Code 2.1.321 parses the arguments of `remote-control`, `self-hosted-runner`, and `rm` by hand.
describe("a hand-written help text", () => {
	const src = `
var p=new C();
p.command("remote-control",{hidden:!0});
var a=\`USAGE
  claude remote-control [options]
OPTIONS
  --settings <file>                JSON settings file for \${s}.
                                   Read once.
  --[no-]chrome                    Claude in Chrome
  -d, --debug[=<filter>]           Enable debug mode
  -h, --help                       Show this help
\`;
var b=\`Usage: claude self-hosted-runner decode-token [token] [options]

Options:
  --environment-secret-file <path>
                              Path to environment secret file
  --help, -h         Show this help.
\`;
var c="Usage: claude rm <id> [--discard-unpushed <commit>]";
var d=\`Usage: claude \${u}\`, e="Usage: claude -p --resume <id>";
`;
	test("gives its subcommand, also a hidden one", async () => {
		const by = await byName("subcommand", src);
		expect([...by.keys()].toSorted((x, y) => x.localeCompare(y))).toEqual([
			"remote-control",
			"rm",
			"self-hosted-runner decode-token",
		]);
		expect(by.get("remote-control")?.gate).toBe("hidden");
		expect(by.get("rm")?.detail).toBe("<id> [--discard-unpushed <commit>]");
	});
	test("gives the flags of its option lines and its usage line", async () => {
		const by = await byName("flag", src);
		expect([...by.keys()].toSorted((x, y) => x.localeCompare(y))).toEqual([
			"remote-control --chrome",
			"remote-control --debug",
			"remote-control --help",
			"remote-control --settings",
			"rm --discard-unpushed",
			"self-hosted-runner decode-token --environment-secret-file",
			"self-hosted-runner decode-token --help",
		]);
		expect(by.get("remote-control --settings")?.detail).toBe(
			`--settings <file> | JSON settings file for \${…}.`,
		);
		expect(by.get("remote-control --chrome")?.detail).toBe(
			"--[no-]chrome | Claude in Chrome",
		);
		expect(by.get("remote-control --debug")?.detail).toBe(
			"--debug[=<filter>] | Enable debug mode",
		);
		expect(
			by.get("self-hosted-runner decode-token --environment-secret-file")
				?.detail,
		).toBe(
			"--environment-secret-file <path> | Path to environment secret file",
		);
	});

	test("a one-space description, a multi-part argument, and a joined options literal", async () => {
		const joined = `
var a=\`Usage: claude self-hosted-runner orchestrator [options]

Options:
  --scm-connector-ca-file <path> Extra CA bundle
  --git-host-rewrite <from>=<to_host:to_port>  Rewrite a host
\`;
var rn="Usage: claude daemon [options]\\n", ln=\`Options:
  --json-path <p>   Write JSON here
\`;
var t=rn+(c?x:y)+ln;
`;
		const by = await byName("flag", joined);
		expect(
			by.get("self-hosted-runner orchestrator --scm-connector-ca-file")?.detail,
		).toBe("--scm-connector-ca-file <path> | Extra CA bundle");
		expect(
			by.get("self-hosted-runner orchestrator --git-host-rewrite")?.detail,
		).toBe("--git-host-rewrite <from>=<to_host:to_port> | Rewrite a host");
		expect(by.get("daemon --json-path")?.detail).toBe(
			"--json-path <p> | Write JSON here",
		);
	});

	test("a parser that shares most flags with a help text gives its other flags as hidden", async () => {
		const parsed = `
var h=\`Usage: claude respawn [options]
Options:
  --all     All
  --force   Force
  --quiet   Quiet
  --[no-]color  Color
\`;
function parse(a){for(let x of a){if(x==="--all");else if(x.startsWith("--quiet="));else if(x==="--no-color");else switch(x){case"--secret":case"--late":break}}}
function git(a){if(a==="--all"||a==="--other")return 1}
`;
		const by = await byName("flag", parsed);
		expect(by.get("respawn --secret")?.gate).toBe("hidden");
		expect(by.get("respawn --late")?.gate).toBe("hidden");
		expect(by.has("respawn --other")).toBe(false);
		expect(by.has("respawn --no-color")).toBe(false);
		expect(by.get("respawn --all")?.gate).toBeUndefined();
	});

	test("a parser in another module needs 3 shared flags", async () => {
		const help = `var h=\`USAGE
  claude remote-control [options]
  --resume <id>   Resume
  --continue      Continue
  --name <n>      Name
\`;`;
		const parsers = `
function rc(a){if(a==="--resume"||a==="--continue"||a==="--name"||a==="--sandbox")return 1}
function filter(a){if(a==="--resume"||a==="--continue"||a==="--fork-session")return 1}
`;
		const found = await surface(
			await Bundle.parse([
				{ name: "/$bunfs/root/a.js", text: help },
				{ name: "/$bunfs/root/b.js", text: parsers },
			]),
			"flag",
		);
		const hidden = found.filter((i) => i.gate === "hidden").map((i) => i.name);
		expect(hidden).toEqual(["remote-control --sandbox"]);
	});
});

describe("slash-command", () => {
	test("local, local-jsx, and prompt objects", async () => {
		const src = `
var a={type:"local",name:"compact",description:"Free up context",aliases:["c","sq"],isEnabled:()=>!0};
var b={type:"local-jsx",name:"hid",description:"H",isHidden:!0};
var c={type:"prompt",name:"avail",description:"A",availability:["claude-ai","console"]};
`;
		const by = await byName("slash-command", src);
		expect([...by.keys()].toSorted((a, b) => a.localeCompare(b))).toEqual([
			"/avail",
			"/compact",
			"/hid",
		]);
		expect(by.get("/compact")?.detail).toBe(
			"local (aliases c, sq) | Free up context",
		);
		expect(by.get("/compact")?.gate).toBe("isEnabled ()=>!0");
		expect(by.get("/hid")?.gate).toBe("hidden");
		expect(by.get("/avail")?.gate).toBe("availability claude-ai, console");
	});

	test("a builder that makes a prompt command from its name", async () => {
		const src = `
function build({name:e}){return{type:"prompt",name:e,description:"d"}}
build({name:"security-review",description:"Review"});
`;
		expect(await names("slash-command", src)).toContain("/security-review");
	});

	// Claude Code 2.1.311 registers `/claude-api` as `reg(make(o))`, with the object returned by `make`.
	test("a factory whose returned object a builder registers", async () => {
		const src = `
function reg(p){return{type:"prompt",name:p.name,description:p.description}}
function make({disabled:a=!1}={}){let m=new Map();return(m.clear(),{name:"claude-api",description:"d",isEnabled:()=>!a})}
function register(o){reg(make(o))}
`;
		const by = await byName("slash-command", src);
		expect([...by.keys()]).toEqual(["/claude-api"]);
		expect(by.get("/claude-api")?.detail).toBe("prompt | d");
	});

	test("negatives: other types, run-time names, and bad names", async () => {
		const src = `
var a={type:"tool",name:"bash"};
var b={type:"local",name:e.name};
var c={type:"local",name:"Bad Name"};
var d={name:"notype"};
`;
		expect(await names("slash-command", src)).toEqual([]);
	});
});
