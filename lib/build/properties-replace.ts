import DotProperties from 'dot-properties-loader';
import { __dict_properties_lazy, __plugin_dev_raw_dir } from '../const';
import Bluebird from 'bluebird';
import { SingleBar } from 'cli-progress';
import { console } from 'debug-color2';
import { join } from 'upath2';
import { async as FastGlob } from '@bluelovers/fast-glob/bluebird';
import { outputJSON } from 'fs-extra';
import { createSingleBar } from '../cli-progress';
import { textIncludeCJK } from '../util/include-cjk';

export const LAZY_PROPERTIES = new DotProperties({
	file: __dict_properties_lazy,
});

export const LAZY_PROPERTIES_KEYS = Object.keys(LAZY_PROPERTIES.tree);

export function replaceProperties(lang: string | 'zh')
{
	return Bluebird.resolve()
		.then(async () =>
		{
			let bar: SingleBar;

			console.cyan.log(`update ${lang} properties`);

			const cwd = join(__plugin_dev_raw_dir, lang);

			bar = createSingleBar(100, 0);

			const changedList = [] as string[];
			const maybeRecord = {} as {
				[file: string]: {
					[key: string]: string,
				},
			};

			return FastGlob([
				'**/*.properties',
			], {
				cwd,
			})
				.tap((ls) =>
				{
					bar?.setTotal(ls.length);
				})
				.mapSeries(async (file: string, index) =>
				{
					bar?.update(index, { filename: file });
					const fullpath = join(cwd, file);

					const dp = new DotProperties({
						file: fullpath,
					});

					let _changed = false;

					const tree = dp.tree;

					LAZY_PROPERTIES_KEYS
						.forEach(key =>
						{

							if (key in tree)
							{
								dp.set(key, LAZY_PROPERTIES.get(key) as any);

								_changed = true;
							}

						})
					;

					if (_changed)
					{
						changedList.push(file);
						dp.save({
							file: fullpath,
							options: {
								latin1: false,
								keySep: '=',
							},
						});
					}

					for (let key in dp.tree)
					{
						let value = dp.get(key) as string;

						if (value?.length && !textIncludeCJK(value as string) && !/^\w+$/.test(value))
						{
							maybeRecord[file] ??= {};
							maybeRecord[file][key] = value as string;
						}

					}
				})
				.tap(() =>
				{
					return Promise.all([
						outputJSON(join(__plugin_dev_raw_dir, lang + '.list.properties.changed.json'), changedList, {
							spaces: 2,
						}),
						outputJSON(join(__plugin_dev_raw_dir, lang + '.list.properties.maybe.json'), maybeRecord, {
							spaces: 2,
						}),
					])
				})
				.finally(() =>
				{
					bar?.update(bar.getTotal());
					bar?.stop();
				})
		})
		;
}
