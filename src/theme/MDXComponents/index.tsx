import * as Badges from "@site/src/components/badge";
import { FileTree } from "@site/src/components/file-tree";
import MDXComponents from "@theme-original/MDXComponents";
import CodeInline from "@theme/CodeInline";
import type { ComponentProps, ComponentType } from "react";

const isRecord = (value: unknown): value is Record<string, unknown> =>
	typeof value === "object" && value !== null;

const isCodeComponent = (
	value: unknown,
): value is ComponentType<ComponentProps<"code">> =>
	typeof value === "function";

const original: unknown = MDXComponents;
const base = isRecord(original) ? original : {};
const OriginalCode = isCodeComponent(base["code"]) ? base["code"] : "code";

// Inline code with <wbr> children (rehype/code-wbr) is still inline code.
const Code = (props: ComponentProps<"code">) =>
	Reflect.get(props, "data-wbr") === "true" ? (
		<CodeInline {...props} />
	) : (
		<OriginalCode {...props} />
	);

const components = {
	...base,
	code: Code,
	...Badges,
	FileTree,
};

export default components;
