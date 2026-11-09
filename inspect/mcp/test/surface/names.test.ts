import { describe, expect, test } from "bun:test";

import { byCode, byName, items, names } from "./util.ts";

describe("model", () => {
	test("ids and aliases", async () => {
		const src = `
var t=[["claude-sonnet-4-5","R1"],["claude-3-5-haiku-20241022","R2"],["claude-opus-4-1@20250805","R3"]];
var al=["sonnet","opus","opusplan"];
`;
		const by = await byName("model", src);
		expect(by.get("claude-sonnet-4-5")?.detail).toBe("id");
		expect(by.get("claude-3-5-haiku-20241022")?.detail).toBe("id");
		expect(by.get("claude-opus-4-1@20250805")?.detail).toBe("id");
		expect(by.get("opusplan")?.detail).toBe("alias");
	});

	test("text that holds an id, a prefix, and other claude names are not ids", async () => {
		const src = `
var a="use claude-opus-4-6 here",b="claude-3-",c="claude-code",d="claude-ai-oauth";
var e=["sonnet","opus"];
`;
		expect(await names("model", src)).toEqual([]);
	});
});

describe("beta", () => {
	test("dated names, with the registry key as the detail", async () => {
		const src = `
v("long_context","context-1m-2025-08-07");
v("claude_code","claude-code-20250219");
var o="oauth-2025-04-20";
`;
		const by = await byName("beta", src);
		expect(by.get("context-1m-2025-08-07")?.detail).toBe("long_context");
		expect(by.get("claude-code-20250219")?.detail).toBe("claude_code");
		expect(by.get("oauth-2025-04-20")?.detail).toBeUndefined();
	});

	test("API versions, dated model ids, and plain dates are not betas", async () => {
		const src = `
var a="bedrock-2023-05-31",b="vertex-2023-10-16",c="2023-06-01";
var d="claude-opus-4-5-20251101";
f("model","claude-opus-4-5-20251101");
`;
		expect(await names("beta", src)).toEqual([]);
	});
});

describe("endpoint", () => {
	test("Anthropic URLs and BASE_API_URL paths", async () => {
		const src = `
var u={BASE_API_URL:"https://api.anthropic.com",X:"https://platform.claude.com/v1/oauth/token"};
f(\`\${an().BASE_API_URL}/api/oauth/profile\`);
f(\`\${an().BASE_API_URL}/v1/code/sessions/\${e}/events\`);
`;
		const by = await byName("endpoint", src);
		expect(by.get("https://api.anthropic.com")?.detail).toBe("url");
		expect(by.get("https://platform.claude.com/v1/oauth/token")?.detail).toBe(
			"url",
		);
		expect(by.get("/api/oauth/profile")?.detail).toBe("path");
		expect(by.has(`/v1/code/sessions/\${…}/events`)).toBe(true);
		expect(by.get("/v1/oauth/token")?.detail).toBe("path");
	});

	test("path literals and templates with an API prefix", async () => {
		const src = `
var d="/v1/messages/count_tokens";
f(\`\${base}/v1/traces\`);
f(\`/model/\${m}/invoke\`);
`;
		expect(await names("endpoint", src)).toEqual([
			`/model/\${…}/invoke`,
			"/v1/messages/count_tokens",
			"/v1/traces",
		]);
	});

	test("third-party URLs, other paths, and variable paths are dropped", async () => {
		const src = `
var a="https://login.microsoftonline.com/common",b="https://example.com";
var c="http://api.anthropic.com",d="/usr/v1/x",e="/v1/has space";
f(\`\${an().BASE_API_URL}\${h}\`);
f(\`\${an().OTHER}/x\`);
`;
		expect(await names("endpoint", src)).toEqual([]);
	});
});

describe("file", () => {
	test("names joined to the config folder, found by the two anchors", async () => {
		const src = `
var Le=memo(()=>home());
join(Le(),"history.jsonl");
join(Le(),"keybindings.json");
join(Le(),"settings.json");
join(other(),"nope.json");
join(proj,"project.json");
`;
		expect(await names("file", src)).toEqual([
			"history.jsonl",
			"keybindings.json",
			"settings.json",
		]);
	});

	test("a base without both anchors gives nothing", async () => {
		expect(
			await names(
				"file",
				'var B=f();join(B(),"history.jsonl");join(B(),"a.json");',
			),
		).toEqual([]);
	});
});

describe("permission-rule", () => {
	test("the modes of the described enum", async () => {
		const src = `
var m=f(()=>z(Iy,B(["default","plan","auto"])).describe("Permission mode for controlling how tool executions are handled. 'default' - x"));
var o=["other","list"];
`;
		const out = await items("permission-rule", src);
		expect(out.map((i) => i.name)).toEqual(["auto", "default", "plan"]);
		expect(out.every((i) => i.detail === "mode")).toBe(true);
	});

	test("an enum with another description gives nothing", async () => {
		expect(
			await names(
				"permission-rule",
				'z(B(["default","plan"])).describe("Other");',
			),
		).toEqual([]);
	});
});

describe("error", () => {
	test("a throw inside a CommonJS library wrapper is left out", async () => {
		const src = `
var L=x((e,n)=>{function f(){throw Error("library text inside")}n.exports=f});
var M=x((e,n)=>{function g(){throw Error("wrapper with no exports")}g()});
function h(){throw Error("app text outside")}
`;
		expect(await names("error", src)).toEqual([
			"app text outside",
			"wrapper with no exports",
		]);
	});

	test("throws of Error types and subclasses, and stderr writes", async () => {
		const src = `
class A extends Error{}
class B extends A{}
var C=class extends TypeError{};
throw Error("Not connected to server");
throw new TypeError("Invalid mode value");
throw new B("Subclass of subclass fails");
throw new C("Class expression fails");
throw new RangeError(\`Out of range: \${x}\`);
throw new SyntaxError("Bad " + name + " syntax");
process.stderr.write("Cloud gateway session expired\\n");
process.stderr.write(\`Cloud gateway \${n} is not trusted\`);
`;
		const by = await byName("error", src);
		expect([...by.keys()].toSorted(byCode)).toEqual([
			`Bad \${…} syntax`,
			"Class expression fails",
			`Cloud gateway \${…} is not trusted`,
			"Cloud gateway session expired",
			"Invalid mode value",
			"Not connected to server",
			`Out of range: \${…}`,
			"Subclass of subclass fails",
		]);
		expect(by.get("Not connected to server")?.detail).toBe("throw Error");
		expect(by.get("Subclass of subclass fails")?.detail).toBe("throw Error");
		expect(by.get("Class expression fails")?.detail).toBe("throw TypeError");
		expect(by.get("Cloud gateway session expired")?.detail).toBe("stderr");
	});

	test("each branch of a conditional throw gives its own text", async () => {
		const src = `
class R extends Error{}
function f(a,p){throw a.some(g)?new R(\`read not allowed under --restricted: \${p}\`,"x"):new R(\`read not allowed under the read block: \${p}\`,"y")}
throw ok?Error("First branch message"):dyn("Factory branch text");
`;
		const found = await names("error", src);
		expect(found.toSorted(byCode)).toEqual([
			"First branch message",
			`read not allowed under --restricted: \${…}`,
			`read not allowed under the read block: \${…}`,
		]);
	});

	test("factory throws, other classes, short texts, and codes are dropped", async () => {
		const src = `
throw dyn("Cloud gateway failed here");
class Own{}
throw new Own("Not an error class");
throw new Error("aborted");
throw new Error("not JSON");
throw new Error("unreachable_state_code");
throw new Error("12345 67890 - 12");
console.error("Printed by a library only");
function f(Error){throw new Error("Shadowed Error is local")}
`;
		expect(await names("error", src)).toEqual([]);
	});
});
