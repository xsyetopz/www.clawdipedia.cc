// The fact kinds of release:facts.
/**
 * `hook` (hook events, from diff/hooks.json) and `manual` (program behaviour that no probe checks yet; compare always
 * reports it `not-run`) are additions to the first design list.
 */
export const KINDS = [
	"behaviour",
	"env",
	"flag",
	"command",
	"setting",
	"hook",
	"gate",
	"schema",
	"manual",
	"static",
	"external",
] as const;
export type Kind = (typeof KINDS)[number];
