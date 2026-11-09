// A small app that the clean test minifies two ways. Its names must not matter after cleaning.
const DEFAULT_LIMIT = 25;

const readFlag = (flagName: string, fallback: boolean): boolean => {
	const value = process.env[flagName.toUpperCase()];
	return value === undefined ? fallback : value === "1";
};

export class Monitor {
	readonly description: string;
	constructor(description: string) {
		this.description = description;
	}
	isEnabled(): boolean {
		return readFlag("tengu_example_gate", false);
	}
	static create(description: string): Monitor {
		return new Monitor(description);
	}
}

export const parseSleep = (command: string, limit = DEFAULT_LIMIT) => {
	const match = /^sleep (\d+)/u.exec(command);
	const seconds = match ? Number(match[1]) : 0;
	const blocked = seconds >= limit;
	return { seconds, blocked };
};

export const describe = ({
	description,
	seconds = 0,
}: {
	description: string;
	seconds?: number;
}) => {
	const parts = [description];
	for (const part of [seconds]) {
		const label = `${part}s`;
		parts.push(label);
	}
	try {
		return parts.join(" ");
	} catch (error) {
		return String(error);
	}
};
