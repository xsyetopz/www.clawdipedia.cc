// The choice of the check for one item: the kind of the item and the reason of the exclusion decide.
import { mapSeq } from "../../inspect/mcp/src/seq.ts";
import type { SurfaceItem } from "../../inspect/mcp/src/surface/common.ts";
import {
	commandCheck,
	endpointCalled,
	flagCheck,
	gateCheck,
	internalError,
	rowCheck,
	settingCheck,
	toolCheck,
} from "./audit-checks.ts";
import { envEffect, envListed, sweepOf } from "./audit-env.ts";
import { libCheck } from "./audit-libcheck.ts";
import { bundledName, LIBS } from "./audit-libs.ts";
import { allText, type Ctx, reEscape, type Verdict } from "./audit-types.ts";

type Picked = [string, () => Promise<Verdict> | Verdict];

const fileCheck = (c: Ctx, i: SurfaceItem, named: boolean): Verdict => {
	// The name as a whole path part inside a sentence: after `.claude/`, `~/`, `CLAUDE_CONFIG_DIR/` or a `${…}/` hole, or before a `/`, for a plain word; any boundary for a dotted file name.
	const n = reEscape(i.name);
	const token = i.name.includes(".")
		? `(?<![\\w.-])${n}(?![\\w-])`
		: `(?:(?:\\.claude|~|CLAUDE_CONFIG_DIR|\\})/${n}(?![\\w.-])|(?<![\\w./-])${n}/[\\w.{$])`;
	const re = new RegExp(`["'\`][^"'\`\\n]*${token}[^"'\`\\n]*["'\`]`, "gu");
	const hits: string[] = [];
	for (const m of allText(c)) {
		for (const h of m.text.matchAll(re)) {
			if (h[0].includes(" ")) {
				hits.push(`${m.name}@${h.index}: ${h[0].slice(0, 100)}`);
			}
		}
	}
	return {
		ok: named ? hits.length > 0 : hits.length === 0,
		evidence: { textsNamingIt: hits.length, first: hits.slice(0, 2) },
	};
};

type Mod = NonNullable<Awaited<ReturnType<Ctx["bundle"]["get"]>>>;

const objectAround = (m: Mod, start: ReturnType<Mod["nodeAt"]>) => {
	let row: ReturnType<Mod["parent"]> = start;
	while (row !== undefined && row.type !== "ObjectExpression") {
		row = m.parent(row);
	}
	return row;
};

const modelCheck = async (c: Ctx, i: SurfaceItem): Promise<Verdict> => {
	const bad: string[] = [];
	let n = 0;
	await mapSeq(allText(c), async (t) => {
		if (!t.text.includes(i.name)) {
			return;
		}
		const m = await c.bundle.get(t.name);
		if (m === undefined) {
			return;
		}
		for (
			let at = m.text.indexOf(i.name);
			at >= 0;
			at = m.text.indexOf(i.name, at + 1)
		) {
			n++;
			const node = m.nodeAt(at);
			// A table row is an object with `status:"retired"`; prose says "retired" in its own text.
			const row = objectAround(m, node);
			const retired =
				/retired/iu.test(m.src(node)) ||
				(row !== undefined && /\bstatus:"retired"/u.test(m.src(row)));
			if (
				(node.type !== "Literal" && node.type !== "TemplateElement") ||
				!retired
			) {
				bad.push(`${m.name}@${at}`);
			}
		}
	});
	return {
		ok: n > 0 && bad.length === 0,
		evidence: { occurrences: n, outsideRetiredText: bad.slice(0, 3) },
	};
};

const ENV_LISTED =
	/^Variable of the OS or another tool\. Claude Code only names|^Named in the program's table|^Only a name/u;

const pickEnv = (
	c: Ctx,
	reason: string,
	i: SurfaceItem,
	all: string[],
): Picked => {
	if (reason.includes("Read only by a library bundled")) {
		return ["library-text", () => libCheck(c, all, i.name)];
	}
	if (reason.startsWith("Changes ")) {
		return [
			"env-sweep-changed",
			() => {
				const sweep = sweepOf(c, i.name);
				return { ok: sweep.state === "changed", evidence: { sweep } };
			},
		];
	}
	return ENV_LISTED.test(reason)
		? ["env-listed", () => envListed(c, i)]
		: ["env-effect", () => envEffect(c, i)];
};

const pickEndpoint = (
	c: Ctx,
	reason: string,
	i: SurfaceItem,
	lib: string[] | undefined,
): Picked => {
	if (lib !== undefined) {
		return ["library-text", () => libCheck(c, lib, i.name)];
	}
	const row = /^Covered by the `([^`]+)` row/u.exec(reason)?.[1];
	if (row !== undefined && row !== "") {
		return ["docs-row", () => rowCheck(c, row)];
	}
	return ["endpoint-not-called", () => endpointCalled(c, i)];
};

const pickOther = (c: Ctx, reason: string, i: SurfaceItem): Picked => {
	if (i.kind === "file") {
		// A reason that starts "Named in a message" claims the opposite of "only a name": a sentence of the program names the file.
		const named = reason.startsWith("Named in a message");
		return [
			named ? "file-named-in-text" : "file-unmentioned",
			() => fileCheck(c, i, named),
		];
	}
	if (i.kind === "model") {
		return ["model-only-in-retired-text", () => modelCheck(c, i)];
	}
	if (i.kind === "setting") {
		return ["setting-unread", () => settingCheck(c, i)];
	}
	if (i.kind === "flag") {
		return ["flag-unread", () => flagCheck(c, i)];
	}
	if (i.kind === "slash-command") {
		return ["command-state", () => commandCheck(reason, i)];
	}
	if (i.kind === "tool") {
		return ["tool-not-defined", () => toolCheck(c, i)];
	}
	if (i.kind === "gate") {
		return ["gate-read-site", () => gateCheck(i)];
	}
	return ["unknown-kind", () => ({ ok: false, evidence: { kind: i.kind } })];
};

/** The check of one item: [name, run]. `reason` and the kind decide. */
export const pick = (c: Ctx, reason: string, i: SurfaceItem): Picked => {
	const lib = LIBS.find(([re]) => re.test(reason))?.[1] ?? bundledName(reason);
	// The Agent SDK ships the program's own code, so every text of the program is in it.
	const all = [...new Set(LIBS.flatMap(([, p]) => p))].filter(
		(p) => p !== "@anthropic-ai/claude-agent-sdk",
	);
	if (i.kind === "error") {
		return lib === undefined
			? ["internal-error", () => internalError(c, i, all)]
			: ["library-text", () => libCheck(c, lib, i.name)];
	}
	if (i.kind === "endpoint") {
		return pickEndpoint(c, reason, i, lib);
	}
	return i.kind === "env"
		? pickEnv(c, reason, i, all)
		: pickOther(c, reason, i);
};
