// Host-data normalizer shared by render.ts (generated pages) and check/docs.ts
// (hand-written prompt pages). Replaces values that depend on the machine.
export const normalizeHost = (s: string): string =>
	s
		.replaceAll(/- Platform: .*/gu, "- Platform: <platform>")
		.replaceAll(/- Shell: .*/gu, "- Shell: <shell>")
		.replaceAll(/- OS Version: .*/gu, "- OS Version: <os-version>")
		.replaceAll(/cc_version=(\d+\.\d+\.\d+)\.\w+/gu, "cc_version=$1.<build>")
		.replaceAll(/\/private\/var\/folders\/[^\s"'`)]*/gu, "<temp-dir>")
		.replaceAll(/\/tmp\/cap-[^\s"'`)]*/gu, "<temp-dir>");

// Numbers random ids by first use, so equal ids stay equal and each run renders the same text.
export const numberUuids = () => {
	const ids = new Map<string, string>();
	return (s: string): string =>
		s.replaceAll(
			/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/giu,
			(u) => {
				const k = u.toLowerCase();
				const known = ids.get(k);
				if (known !== undefined) {
					return known;
				}
				const id = `<uuid-${ids.size + 1}>`;
				ids.set(k, id);
				return id;
			},
		);
};
