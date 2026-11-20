// What one `/context` token count request counts, so two versions' request lists can be compared by subject.
import { isObj } from "../run/types.ts";

const list = (x: unknown): unknown[] => (Array.isArray(x) ? x : []);

const str = (x: unknown): string => (typeof x === "string" ? x : "");

const textOf = (content: unknown): string =>
	typeof content === "string"
		? content
		: list(content)
				.map((b) => (isObj(b) ? str(b["text"]) : ""))
				.join(" ");

/**
 * Labels a count_tokens body as `<tool names>|<message text>`, with the text on one line and cut to 80
 * characters.
 */
export const countSubject = (body: unknown): string => {
	const b = isObj(body) ? body : {};
	const tools = list(b["tools"]).flatMap((t) =>
		isObj(t) && typeof t["name"] === "string" ? [t["name"]] : []
	);
	const text = list(b["messages"])
		.map((m) => (isObj(m) ? textOf(m["content"]) : ""))
		.join(" ")
		.replaceAll(/\s+/gu, " ")
		.trim()
		.slice(0, 80);
	return `${tools.join(",")}|${text}`;
};
