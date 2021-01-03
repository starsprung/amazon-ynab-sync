import { stat } from 'fs/promises';
import { join } from 'path';
import puppeteer from 'puppeteer';
import { getConfig } from './config';
import logger from './logger';

const config = getConfig();

const getExternalPuppeteer = async (): Promise<string> => {
  const version = ((puppeteer as unknown) as { _preferredRevision: string })._preferredRevision;
  const chromiumDir = join(config.cacheDir, 'chromium');

  const fetcher = puppeteer.createBrowserFetcher({
    path: chromiumDir,
  });

  const { executablePath } = fetcher.revisionInfo(version);

  logger.debug(`Chromium path is: ${executablePath}`);

  try {
    if (await stat(executablePath)) {
      logger.debug('Using chromium executable found in cache');
      return executablePath;
    }
  } catch (err) {
    if (err.code !== 'ENOENT') {
      throw err;
    }
  }

  logger.info('Chromium not found, downloading it');
  const download = await fetcher.download(version);
  logger.info('Finished downloading Chromium');
  return download.executablePath;
};

export const getPuppeteerExecutable = async (): Promise<string> => {
  if (process.env.PUPPETEER_EXECUTABLE_PATH) {
    return process.env.PUPPETEER_EXECUTABLE_PATH;
  }

  if ((process as { pkg?: unknown }).pkg) {
    logger.debug('Packaged mode, using external chromium');
    return await getExternalPuppeteer();
  }

  return puppeteer.executablePath();
};
