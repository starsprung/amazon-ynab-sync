import { API as YnabApi } from 'ynab';
import { getAmazonTransactions } from './amazon';
import { makeCacheDir } from './cache';
import { getConfig } from './config';
import { getAccountId, getBudgetId } from './ynab';
import logger from './logger';
import batch from 'it-batch';

const config = getConfig();

const initialize = async (): Promise<void> => {
  await makeCacheDir();
};

(async () => {
  await initialize();

  const budgetId = await getBudgetId(config.ynabBudgetName);
  const accountId = await getAccountId(config.ynabBudgetName, config.ynabAccountName);
  const ynabApi = new YnabApi(config.ynabAccessToken);

  logger.info('Retrieving reports from Amazon');
  let count = 0;
  for await (const transactionBatch of batch(getAmazonTransactions(), 100)) {
    if (count === 0) {
      logger.info('Submitting transations to YNAB');
    }

    try {
      logger.debug(`Submitting batch of ${transactionBatch.length} transactions`);
      await ynabApi.transactions.createTransactions(budgetId, {
        transactions: transactionBatch.map((t) => ({ ...t, account_id: accountId })),
      });
      count += transactionBatch.length;
    } catch (err) {
      logger.error(`Error during YNAB API call: ${err.error?.detail ?? err.message ?? err.code}`);
      break;
    }
  }

  logger.info(`Submitted ${count} transations to YNAB`);
})();
