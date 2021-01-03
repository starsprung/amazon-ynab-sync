import { version } from '../package.json';
import envPaths from 'env-paths';
import { readFileSync } from 'fs';
import { join } from 'path';
import yargs from 'yargs';

const CONFIG_FILE = 'config.json';

export interface Config {
  amazonUsername?: string;
  amazonPassword?: string;
  amazonOtpCode?: string;
  amazonOtpSecret?: string;
  cacheDir: string;
  configDir: string;
  debugMode: boolean;
  logLevel: string;
  startDate: string;
  ynabBudgetName: string;
  ynabAccountName: string;
  ynabAccessToken: string;
}

let config: Config;

export const getConfig = (): Config => {
  if (config) {
    return config;
  }

  const { cache: defaultCacheDir, config: defaultConfigDir } = envPaths('amazon-ynab-sync', {
    suffix: '',
  });

  return (config = {
    ...((yargs(process.argv.slice(2))
      .usage('Usage: $0 [options]')
      .env()
      .version(version)
      .option('amazon-otp-code', {
        describe: 'Amazon OTP/2SV code',
        type: 'string',
      })
      .option('amazon-otp-secret', {
        describe: 'Amazon OTP/2SV secret',
        type: 'string',
      })
      .option('amazon-password', {
        describe: 'Amazon account password',
        type: 'string',
      })
      .option('amazon-username', {
        describe: 'Amazon account username',
        type: 'string',
      })
      .option('cache-dir', {
        default: defaultCacheDir,
        describe: 'Location of cache directory',
        type: 'string',
      })
      .option('config-dir', {
        config: true,
        configParser: (path: string): Partial<Config> => {
          try {
            const content = readFileSync(join(path, CONFIG_FILE), { encoding: 'utf-8' });
            return JSON.parse(content);
          } catch {
            return {};
          }
        },
        default: defaultConfigDir,
        describe: 'Location of config directory',
        type: 'string',
      })
      .option('debug-mode', {
        default: false,
        describe: 'Run internal browser in visible mode and run in slo-mo mode',
        type: 'boolean',
      })
      .option('log-level', {
        choices: ['debug', 'info', 'error', 'none', 'silly'],
        default: 'info',
        describe: 'Level of logs to output',
        type: 'string',
      })
      .options('start-date', {
        describe: 'Sync transactions that occur after this date',
        default: (() => {
          const d = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
          return [
            d.getFullYear(),
            `${d.getMonth() + 1}`.padStart(2, '0'),
            `${d.getDate()}`.padStart(2, '0'),
          ].join('-');
        })(),
        type: 'string',
      })
      .option('ynab-access-token', {
        demandOption: true,
        describe: 'YNAB access token for accessing your account',
        type: 'string',
      })
      .option('ynab-account-name', {
        demandOption: true,
        describe: 'Account to use for storing Amazon transactions',
        type: 'string',
      })
      .option('ynab-budget-name', {
        demandOption: true,
        describe: 'Budget to use for storing Amazon transactions',
        type: 'string',
      }).argv as unknown) as Config),
  });
};
