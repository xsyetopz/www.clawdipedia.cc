import { describe, expect, test } from "bun:test";

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
