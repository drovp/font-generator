import {promises as FSP} from 'fs';
import * as Path from 'path';
import type {ProcessorUtils} from '@drovp/types';
import type {Payload, FontType} from './';
import {Font, woff2} from 'fonteditor-core';
import * as codePoints from 'code-points';

type InputFontType = FontType | 'otf';

const isWindows = process.platform === 'win32';
const ranges: Record<string, () => number[]> = {
	'a-z': () => makeRange(97, 122),
	'A-Z': () => makeRange(65, 90),
	'0-9': () => makeRange(48, 57),
	punctuation: () => [
		...makeRange(33, 47),
		...makeRange(58, 64),
		...makeRange(91, 96),
		...makeRange(123, 126),
		...makeRange(161, 191),
	],
};

function isInputFontType(value: string): value is InputFontType {
	return ['ttf', 'woff', 'woff2', 'eot', 'svg', 'otf'].includes(value);
}

function normalizePath(path: string) {
	return Path.normalize(path.trim().replace(/[\\\/]+$/, ''));
}

function isSamePath(pathA: string, pathB: string) {
	if (isWindows) {
		pathA = pathA.toLowerCase();
		pathB = pathB.toLowerCase();
	}
	return normalizePath(pathA) === normalizePath(pathB);
}

function makeRange(start: number, end: number) {
	const range = [];
	for (let i = start; i < end; i++) range.push(i);
	return range;
}

export default async (payload: Payload, utils: ProcessorUtils) => {
	const {input, options} = payload;
	const {stage, progress, output} = utils;
	const inputDirectory = Path.dirname(input.path);
	const inputExtension = Path.extname(input.path);
	const inputType = inputExtension.trim().replace('.', '').toLowerCase();
	const inputName = Path.basename(input.path, inputExtension);
	const outputDirectory = Path.resolve(inputDirectory, options.destination);

	if (!isInputFontType(inputType)) throw new Error(`Invalid input file type "${inputType}"."`);

	// Create subset
	let subset: undefined | number[];
	if (options.subsets.length > 0) {
		subset = [32]; // space
		for (const name of options.subsets) {
			if (name === 'custom') {
				subset.push(...codePoints(options.customSubset, {unique: true}));
			} else {
				const range = ranges[name];
				if (range) subset.push(...range());
			}
		}
	}

	const inputContents = await FSP.readFile(input.path);
	const font = Font.create(inputContents, {type: inputType, subset});

	// @ts-ignore another mistyped API, the argument is optional...
	font.optimize();

	progress.total = options.formats.length;

	for (let i = 0; i < options.formats.length; i++) {
		const format = options.formats[i]!;
		stage(format);

		if (format === 'woff2') {
			// @ts-ignore param is optional in node environment
			await woff2.init();
		}

		const fontContents = font.write({toBuffer: true, type: format, hinting: options.hinting});
		const outputPath = Path.join(outputDirectory, `${inputName}.${format}`);

		// Check if we need to backup and do so
		if (isSamePath(input.path, outputPath)) {
			await FSP.rename(input.path, Path.join(inputDirectory, `${inputName}.BACKUP${inputExtension}`));
		}

		// Ensure directory exists
		await FSP.mkdir(outputDirectory, {recursive: true});

		// Write font
		// @ts-ignore again incorrect types, man this types are bad
		await FSP.writeFile(outputPath, fontContents);
		output.file(outputPath);
		progress.completed = i;
	}
};
