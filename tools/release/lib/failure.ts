/** The message of the error a promise rejects with, or undefined when it resolves. For tests that expect a rejection. */
export const failureOf = async (
	p: Promise<unknown>,
): Promise<string | undefined> => {
	try {
		await p;
		return undefined;
	} catch (error) {
		return error instanceof Error ? error.message : String(error);
	}
};
