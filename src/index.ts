import * as Path from 'path';
import {Plugin, PayloadData, OptionsSchema, makeAcceptsFlags} from '@drovp/types';

export type FontType = 'ttf' | 'woff' | 'woff2' | 'eot' | 'svg';
type Options = {
	ask: boolean;
	destination: string;
	backup: boolean;
	formats: FontType[];
	subsets: string[];
	customSubset: string;
	hinting: boolean;
};

const optionsSchema: OptionsSchema<Options> = [
	{
		name: 'ask',
		type: 'boolean',
		default: false,
		title: 'Ask for destination',
		description: `Always ask for destination. Also available as a <kbd>ctrl</kbd> drop modifier key.`,
	},
	{
		name: 'destination',
		type: 'path',
		kind: 'directory',
		title: 'Destination',
		description: `Destination where to save generated files. Relative path starts at input file's directory. Lave empty to save in the same directory as input file.`,
		isHidden: (_, {ask}) => ask,
	},
	{
		name: 'backup',
		type: 'boolean',
		default: true,
		title: 'Backup original',
		description: `If original file path matches one of the generated ones, it'll be renamed to <code>&lt;name&gt;.BACKUP.&lt;ext&gt;</code>. Disable to replace original.`,
	},
	{
		name: 'formats',
		type: 'select',
		options: ['ttf', 'woff', 'woff2', 'eot', 'svg'],
		default: [],
		title: 'Generate formats',
		description: `What formats should be generated.`,
	},
	{
		name: 'subsets',
		type: 'select',
		options: ['a-z', 'A-Z', '0-9', 'punctuation', 'custom'],
		default: [],
		title: 'Subsets',
		description: `Select only a specific subsets of characters to save. Deselect all to save all characters.`,
	},
	{
		name: 'customSubset',
		type: 'string',
		rows: 3,
		title: 'Custom subset',
		isHidden: (_, {subsets}) => !subsets.includes('custom'),
		description: `Save only characters occurring in this string (and other selected subsets above).`,
	},
	{
		name: 'hinting',
		type: 'boolean',
		default: true,
		title: 'Hinting',
		description: `Save hinting.`,
	},
];

const acceptsFlags = makeAcceptsFlags<Options>()({
	files: ['ttf', 'woff', 'woff2', 'eot', 'svg', 'otf'],
});

export type Payload = PayloadData<Options, typeof acceptsFlags>;

export default (plugin: Plugin) => {
	plugin.registerProcessor<Payload>('font-generator', {
		main: 'dist/processor.js',
		description: 'Generate ttf, woff, woff2, eot, and svg fonts with optional subsetting.',
		accepts: acceptsFlags,
		threadType: 'cpu',
		parallelize: true,
		options: optionsSchema,
		operationPreparator: async (payload, utils) => {
			if (payload.options.ask || utils.modifiers === 'ctrl') {
				const result = await utils.showOpenDialog({
					title: `Destination directory`,
					defaultPath: Path.dirname(payload.input.path),
					properties: ['openDirectory', 'createDirectory', 'promptToCreate'],
				});

				// Cancel operation
				if (result.canceled) return false;

				const dirname = result.filePaths[0];

				if (typeof dirname === 'string') {
					payload.options.destination = dirname;
				} else {
					throw new Error(`invalid destination folder path ${dirname}`);
				}
			}

			return payload;
		},
		modifierDescriptions: {
			ctrl: `ask for destination folder (overwrites options)`,
		},
	});
};
