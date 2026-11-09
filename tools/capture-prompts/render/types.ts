import type { PromptGroup, Variant } from "../variants.ts";

export interface ApiBlock {
	type: string;
	text: string;
	input?: unknown;
	content?: unknown;
}
export interface Part {
	label: string;
	text: string;
}
export interface Tool {
	name: string;
	desc: number;
	schema: number;
	text: string;
	schemaText: string;
}
export interface Cap {
	v: Variant;
	text: string;
	parts: Part[];
	chars: number;
	tools: Tool[];
	sections: string[];
	model: string;
	ok: boolean;
}
export interface IndexRow {
	after?: string;
	change: string;
	toggle: string;
	where: string;
	status: string;
	select?: string;
	chars?: number;
	tools?: number;
	sections?: string;
}
export interface HandPage {
	id: string;
	title: string;
	group: PromptGroup;
	row?: IndexRow | undefined;
}
export interface FrontMatter {
	title?: string;
	group?: string;
	generated?: boolean;
	index?: IndexRow;
}
