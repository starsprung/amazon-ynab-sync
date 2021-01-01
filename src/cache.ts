import { readFile, writeFile } from 'fs/promises';
import hasha from 'hasha';
import makeDir from 'make-dir';
import { join } from 'path';
import { getConfig } from './config';
import logger from './logger';

// eslint-disable-next-line
type Serializable = string | number | boolean | object | null;

const config = getConfig();

export const makeCacheDir = async (): Promise<void> => {
  logger.debug(`Cache dir is: ${config.cacheDir}`);
  await makeDir(config.cacheDir);
};

const cacheFilePath = (keys: string | Array<string>) => {
  const path = join(config.cacheDir, `${hasha(keys, { algorithm: 'sha256' })}.cache`);
  logger.debug(`Path for ${keys} is ${path}`);
  return path;
};

export const readCache = async (
  keys: string | Array<string>,
  maxAge: number = Number.MAX_SAFE_INTEGER,
): Promise<Serializable> => {
  logger.debug(`Reading ${keys} from cache`);

  try {
    const content = await readFile(cacheFilePath(keys), {
      encoding: 'utf-8',
    });
    if (content) {
      logger.debug(`Found cached value for ${keys}`);
      logger.silly(content);

      const { value, time } = JSON.parse(content);
      const age = Date.now() - parseInt(time);
      logger.debug(`Cached value for ${keys} age is ${age} ms`);
      if (age <= maxAge) {
        return value;
      }

      logger.debug(`Cached value for ${keys} is too old, ignoring`);
    }
  } catch (err) {
    if (err.code !== 'ENOENT') {
      throw err;
    }
  }

  logger.debug(`No cache value found for ${keys}`);

  return null;
};

export const writeCache = async (
  keys: string | Array<string>,
  value: Serializable,
): Promise<void> => {
  logger.debug(`Writing ${keys} to cache`);
  logger.silly(value);

  await writeFile(cacheFilePath(keys), JSON.stringify({ value, time: Date.now() }, null, 2), {
    encoding: 'utf-8',
  });
};
