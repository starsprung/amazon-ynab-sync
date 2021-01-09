# amazon-ynab-sync

Automatically syncs Amazon.com transactions to [YNAB](https://www.youneedabudget.com/).

The basic concept is to have a dedicated account within YNAB for Amazon transations. Any bank or credit card payments to Amazon can
then be set as transfers to this Amazon account. This makes categorizing Amazon spending much easier, as every individual item is its
own transaction.

Internally, this runs a headless instance of [Chromium](https://www.chromium.org/) controlled by [Puppeteer](https://github.com/puppeteer/puppeteer)
to login to your Amazon account, retrieve your transations and submits them to YNAB using the YNAB API. This utilizes Amazon's Order History Reports
functionality, which generates e-mails from Amazon, [see below](#email-notifications) a suggestion for handling these.

## Support this project

If you'd like to support this project, please consider donating to the [Oregon Food Bank](https://oregonfoodbank.org/donate). Donate more than $50 and [send me a screenshot of your donation](mailto:s@starsprung.com) and I'll add you to a [list of supporters](SUPPORTERS.md)!

## Pre-requisites

- [Your YNAB personal access token](https://api.youneedabudget.com/#personal-access-tokens)
- Your Amazon.com login credentials
- On Linux, some Puppeteer dependencies [may need to be manually installed](#troubleshooting)

## Installation

### As a pre-built binary

Pre-built binaries for Linux, macOS and Windows can be downloaded from the
[releases page](https://github.com/starsprung/amazon-ynab-sync/releases/). Simply extract
them and run the binary on the command line.

These binaries are packaged with Node.js, so there is no need to download that separately.
They do not include Chromium, but that will be downloaded automatically when the application
is run for the first time.

### As an NPM package

#### Pre-requisites

- [Node.js](https://nodejs.org/) >= 14.4.0
- npm >= 6.9.0

#### Install

```
npm install -g amazon-ynab-sync
```

On some systems if you're installing to a privileged location you may need:

```
sudo npm install -g amazon-ynab-sync --unsafe-perm=true
```

Ensure you have the Node.js `bin` directory in your environment path.

## Usage

Ensure you have created a budget and an unlinked account in YNAB in which you want to record your Amazon transactions
(I generally use a Cash account). In these examples I'll use the following as samples values:

| Option                       | Value                                                            |
| ---------------------------- | ---------------------------------------------------------------- |
| Amazon username              | test@example.com                                                 |
| Amazon password              | password123                                                      |
| YNAB access token            | 437e0a95e9ce155e5deae9d105305988cac9f4664f480650cc18d3327cae36ec |
| YNAB budget name             | My Budget                                                        |
| YNAB Amazon.com account name | Amazon.com                                                       |

### Basic usage

```
amazon-ynab-sync \
--ynab-access-token 437e0a95e9ce155e5dea5b62b5305988cac9f4664f480650cc18d3327cae36ec \
--ynab-budget-name "My Budget" \
--ynab-account-name "Amazon.com" \
--log-level none

? Amazon Username: test@example.com
? Amazon Password: [hidden]
? Amazon OTP Code: 123456
```

After the initial login the application will store the cookies provided by Amazon and will only re-prompt for credentials
when the Amazon.com login session expires.

### Providing login credentials non-interactively

It's possible to provide your Amazon.com credentials as parameters via CLI options or environment variables. In general
it's not secure to provide your password directly in clear text, as they may be logged in your shell history, but many password
managers such as [LastPass](https://github.com/lastpass/lastpass-cli) or [1Password](https://1password.com/downloads/command-line/)
have a CLI tool that can be used to provide the login credentials. You could also save your YNAB personal access token in a password
manager to improve security.

#### LastPass

```
AMAZON_USERNAME="$(lpass show 'amazon.com' -u)" \
AMAZON_PASSWORD="$(lpass show 'amazon.com' -p)" \
amazon-ynab-sync
```

#### 1Password

```
AMAZON_USERNAME="$(op get item amazon.com --fields username)" \
AMAZON_PASSWORD="$(op get item amazon.com --fields password)" \
amazon-ynab-sync
```

#### macOS Keychain

```
AMAZON_USERNAME="$(security find-generic-password -s amazon.com | grep acct | sed -E 's/^.*"acct"\<blob\>="(.*)".*$/\1/')" \
AMAZON_PASSWORD="$(security find-generic-password -s 'amazon.com' -w)" \
amazon-ynab-sync
```

### Providing options in a config file

Options can also be saved in a config file. The location of this file is platform-dependent:

| Plaform | Location                                                                                            |
| ------- | --------------------------------------------------------------------------------------------------- |
| Linux   | $XDG_CONFIG_HOME/amazon-ynab-sync/config.json <br/> or <br/> ~/.config/amazon-ynab-sync/config.json |
| macOS   | ~/Library/Preferences/amazon-ynab-sync/config.json                                                  |
| Windows | %AppData%\amazon-ynab-sync\Config\config.json                                                       |

#### Example config.json

```
{
  "amazonUsername": "test@example.com",
  "ynabAccessToken": "437e0a95e9ce155e5dea5b62b5305988cac9f4664f480650cc18d3327cae36ec",
  "ynabAccountName": "Amazon.com",
  "ynabBudgetName": "My Budget"
}
```

## Options

| Command-line option | Environment Variable | Config file     | Description                                                                                                                                                                                                                                                   | Default                                                                                                                                                                                            |
| ------------------- | -------------------- | --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| --amazon-otp-code   | AMAZON_OTP_CODE      | amazonOtpCode   | Amazon OTP/2SV code                                                                                                                                                                                                                                           |                                                                                                                                                                                                    |
| --amazon-otp-secret | AMAZON_OTP_SECRET    | amazonOtpSecret | Amazon OTP/2SV secret. This is the code you get during the Authenticator App setup on the Amazon 2SV Settings page. If this option is used, care should be taken to store this securely. An insecurely stored OTP secret is the same as not having OTP at all |                                                                                                                                                                                                    |
| --amazon-password   | AMAZON_PASSWORD      | amazonPassword  | Amazon password                                                                                                                                                                                                                                               |                                                                                                                                                                                                    |
| --amazon-username   | AMAZON_USERNAME      | amazonUsername  | Amazon username                                                                                                                                                                                                                                               |                                                                                                                                                                                                    |
| --cache-dir         | CACHE_DIR            | cacheDir        | Directory to use for caching API responses and cookies                                                                                                                                                                                                        | Linux: $XDG_CACHE_HOME/amazon-ynab-sync <br/> or <br/> ~/.cache/amazon-ynab-sync <br/><br/> macOS: ~/Library/Caches/amazon-ynab-sync <br/><br/> Windows: %LocalAppData%\amazon-ynab-sync\Cache     |
| --config-dir        | CONFIG_DIR           | configDir       | Directory to look for config file                                                                                                                                                                                                                             | Linux: $XDG_CONFIG_HOME/amazon-ynab-sync <br/> or <br/> ~/.config/amazon-ynab-sync <br/><br/> macOS: ~/Library/Preferences/amazon-ynab-sync/ <br/><br/> Windows: %AppData%\amazon-ynab-sync\Config |
| --cleared           | CLEARED              | cleared         | Whether transactions should be added as cleared by default                                                                                                                                                                                                    | true                                                                                                                                                                                               |
| --debug-mode        | DEBUG_MODE           | debugMode       | Run the internal browser in visible/slo-mo mode                                                                                                                                                                                                               | false                                                                                                                                                                                              |
| --log-level         | LOG_LEVEL            | logLevel        | Level of logs to output. Possible values: "debug", "info", "error", "none", "silly"                                                                                                                                                                           | info                                                                                                                                                                                               |
| --payee             | PAYEE                | payee           | Override the "Payee" field in YNAB with this value. If unset it will default to the seller name or Amazon.com                                                                                                                                                 |                                                                                                                                                                                                    |
| --start-date        | START_DATE           | startDate       | Only sync transactions which appear after this date.                                                                                                                                                                                                          | 30 days ago                                                                                                                                                                                        |
| --ynab-access-token | YNAB_ACCESS_TOKEN    | ynabAccessToken | [YNAB personal access token](https://api.youneedabudget.com/#personal-access-tokens)                                                                                                                                                                          |                                                                                                                                                                                                    |
| --ynab-account-name | YNAB_ACCOUNT_NAME    | ynabAccountName | Name of YNAB account in which you wish to record Amazon transactions                                                                                                                                                                                          |                                                                                                                                                                                                    |
| --ynab-budget-name  | YNAB_BUDGET_NAME     | ynabBudgetName  | Name of the YNAB budget containing the above account                                                                                                                                                                                                          |                                                                                                                                                                                                    |

## Email notifications

As a side effect of generating an order report, Amazon will send an email notification that the order report is ready.
This can generate a large volume of emails if reports are retrieved frequently. In many mail providers, an e-mail filter
can be used to delete or move these emails. E.g. in Gmail:

```
from:(no-reply@amazon.com) subject:(Your order history report)
```

## Troubleshooting

In some cases on Linux you may need to install some additional Puppeteer dependencies manually. If you get error messages regarding
failure to launch the browser process, see the
[Puppeteer troubleshooting section](https://github.com/puppeteer/puppeteer/blob/main/docs/troubleshooting.md#chrome-headless-doesnt-launch-on-unix).

If you get failed sign-ins or other errors, you might try running with `--log-level silly --debug-mode` to get a better idea of what's happening.
