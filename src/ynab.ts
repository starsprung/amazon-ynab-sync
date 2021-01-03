import { API as YnabApi, ErrorResponse } from 'ynab-client';
import { readCache, writeCache } from './cache';
import { AmazonTransaction } from './amazon';
import { getConfig } from './config';
import logger from './logger';

const MAX_YNAB_CACHE_AGE = 60 * 60 * 1000;

const config = getConfig();

type AccountId = string;
const isAccountId = (val: unknown): val is AccountId => typeof val === 'string';

type BudgetId = string;
const isBudgetid = (val: unknown): val is BudgetId => typeof val === 'string';

const isErrorResponse = (val: unknown): val is ErrorResponse =>
  (val as ErrorResponse)?.error?.detail === 'string';

export const getBudgetId = async (budgetName: string): Promise<BudgetId> => {
  const ynabApi = new YnabApi(config.ynabAccessToken);

  const cacheKey = [config.ynabAccessToken, budgetName];
  const cached = await readCache(cacheKey, MAX_YNAB_CACHE_AGE);

  if (isBudgetid(cached)) {
    logger.debug('Using cached budget ID');
    return cached;
  }

  logger.debug('No cached budget ID found');

  const budgetsResponse = await ynabApi.budgets.getBudgets();
  const budgets = budgetsResponse?.data?.budgets ?? [];
  const budget = budgets.find(({ name }) => name === budgetName);

  if (!budget) {
    throw new Error(`Unable to find budget with name: ${budgetName}`);
  }

  await writeCache(cacheKey, budget.id);

  return budget.id;
};

export const getAccountId = async (budgetName: string, accountName: string): Promise<AccountId> => {
  const ynabApi = new YnabApi(config.ynabAccessToken);

  const cacheKey = [config.ynabAccessToken, budgetName, accountName];
  const cached = await readCache(cacheKey, MAX_YNAB_CACHE_AGE);

  if (isAccountId(cached)) {
    logger.debug('Using cached account ID');
    return cached;
  }

  logger.debug('No cached account ID found');

  const budgetId = await getBudgetId(budgetName);

  const accountsResponse = await ynabApi.accounts.getAccounts(budgetId);
  const accounts = accountsResponse?.data?.accounts ?? [];
  const account = accounts.find(({ name }) => name === accountName);

  if (!account) {
    throw new Error(`Unable to find account with name: ${accountName}`);
  }

  await writeCache(cacheKey, account.id);

  return account.id;
};

export const addTransactions = async (transactions: Array<AmazonTransaction>) => {
  const ynabApi = new YnabApi(config.ynabAccessToken);

  const budgetId = await getBudgetId(config.ynabBudgetName);
  const accountId = await getAccountId(config.ynabBudgetName, config.ynabAccountName);

  try {
    await ynabApi.transactions.createTransactions(budgetId, {
      transactions: transactions.map((t) => ({ ...t, account_id: accountId })),
    });
  } catch (err) {
    if (isErrorResponse(err)) {
      logger.error(`Error during YNAB API call: ${err.error.detail}`);
    }

    throw err;
  }
};
