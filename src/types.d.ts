declare module 'code-points' {
	interface CodePoints {
		(value: string, options?: {unique: boolean}): number[];
	}
	const codePoints: CodePoints;
	export = codePoints;
}
