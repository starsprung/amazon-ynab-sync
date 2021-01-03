#!/usr/bin/env node

import batch from 'it-batch';
import { getAmazonTransactions } from './amazon';
import { makeCacheDir } from './cache';
import logger from './logger';
import { addTransactions } from './ynab';

const initialize = async (): Promise<void> => {
  await makeCacheDir();
};

(async () => {
  await initialize();

  logger.info('Retrieving reports from Amazon');
  let count = 0;
  for await (const transactionBatch of batch(getAmazonTransactions(), 100)) {
    if (count === 0) {
      logger.info('Submitting transations to YNAB');
    }

    try {
      logger.debug(`Submitting batch of ${transactionBatch.length} transactions`);
      await addTransactions(transactionBatch);
      count += transactionBatch.length;
    } catch (err) {
      break;
    }
  }

  logger.info(`Submitted ${count} transations to YNAB`);
})();
