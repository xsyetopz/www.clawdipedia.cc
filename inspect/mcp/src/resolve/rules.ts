import { type Ty, union } from "./types.ts";

/** The types of a global name that is no variable: `undefined`, `NaN`, and `Infinity`. */
export const globalNameType = (name: string): Ty[] | undefined => {
	if (name === "undefined") {
		return ["absent"];
	}
	return name === "NaN" || name === "Infinity" ? ["number"] : undefined;
};

/** The types of a variable after a write with `operator`: `x+=y` stays a number only for numbers, and a string makes it a string. */
export const writeType = (
	out: Ty[] | undefined,
	operator: string,
	written: Ty[] | undefined,
): Ty[] | undefined => {
	if (["=", "??=", "||=", "&&="].includes(operator)) {
		return union(out, written);
	}
	if (operator === "+=") {
		const one = (k: Ty) =>
			written !== undefined &&
			written.length > 0 &&
			written.every((x) => x === k);
		return one("number") || one("string") ? union(out, written) : undefined;
	}
	return union(out, ["number"]);
};

/** The types of `a op b` for `??`, `||`, and `&&`: `a ?? b` drops the nullish types of `a`. */
export const logicalType = (
	operator: string,
	a: Ty[] | undefined,
	b: Ty[] | undefined,
) =>
	operator === "??"
		? union(
				a?.filter((x) => x !== "null" && x !== "absent"),
				b,
			)
		: union(a, b);

export const isString = (x: Ty[] | undefined) =>
	x?.length === 1 && x[0] === "string";
