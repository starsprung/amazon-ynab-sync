import chalk from 'chalk';

const SUPPORT_NOTICE = `
If you'd like to support this project, please consider donating to Oregon Food Bank: ${chalk.bold(
  'https://oregonfoodbank.org',
)}
Donate more than $50 and send me a screenshot of your donation and I'll add you to a list of supporters!
`;

const supportNotice = (): void => {
  if (process.stdout.isTTY) {
    console.log(SUPPORT_NOTICE);
  }
};

export default supportNotice;
