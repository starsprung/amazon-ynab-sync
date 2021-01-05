import { init as licenseChecker, ModuleInfo } from 'license-checker';
import { promisify } from 'util';
import { readFile } from 'fs/promises';
import { join } from 'path';

const licenseCheckerPromise = promisify(licenseChecker);

const separator = `\n\n${''.padEnd(80, '=')}\n\n`;

(async () => {
  const seen = {};
  const packages = Object.entries(
    await licenseCheckerPromise({ production: true, start: __dirname }),
  )
    .map(([packageNameVersion, details]): [string, ModuleInfo] => [
      packageNameVersion.replace(/^(.+)@.*$/, '$1'),
      details,
    ])
    .reverse()
    .filter(([packageName]) => {
      const s = seen[packageName];
      seen[packageName] = true;
      return !s;
    })
    .reverse();

  packages.unshift([
    'Node.js',
    {
      licenseFile: join(__dirname, 'licenses', 'NODE'),
      repository: 'https://github.com/nodejs/node',
    },
  ]);

  const licenseList = [await readFile(join(__dirname, 'LICENSE'), { encoding: 'utf-8' })];
  for (const [packageName, { licenses, licenseFile, repository }] of packages) {
    licenseList.push(
      [
        `This application includes a copy of ${packageName}`,
        repository ? `Source code is available from: ${repository}` : [],
        `${packageName} is provided under the following license:`,
        '',
        licenseFile ? await readFile(licenseFile, { encoding: 'utf-8' }) : licenses,
      ]
        .flat()
        .join('\n'),
    );
  }

  console.log(licenseList.join(separator));
})();
