import * as winston from 'winston';
import { getConfig } from './config';

const config = getConfig();

const logger = winston.createLogger({
  format: winston.format.combine(
    winston.format.metadata(),
    winston.format.timestamp(),
    winston.format.json()
  )
});

logger.add(
  new winston.transports.Console(
    config.logLevel === 'none' || process.env.NODE_ENV === 'test'
      ? { silent: true }
      : {
          level: config.logLevel
        }
  )
);

export default logger;
