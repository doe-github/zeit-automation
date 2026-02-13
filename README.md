# zeit-automation

Automation for ZEIT time tracking system using Node.js and Playwright.

## Overview

This project automates interactions with the ZEIT time tracking system (https://zeit.niceshops.cloud/). It supports the following actions:
- **toggle**: Clock in/out
- **break**: Take a lunch break

## Prerequisites

- Node.js 18 or higher
- npm

## Setup

1. Clone the repository:
```bash
git clone https://github.com/doe-github/zeit-automation.git
cd zeit-automation
```

2. Install dependencies:
```bash
npm install
```

3. Install Playwright browsers:
```bash
npx playwright install chromium
```

## Configuration

The automation requires the following environment variables:

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `ZEIT_USER` | Yes | - | Your ZEIT username |
| `ZEIT_PASS` | Yes | - | Your ZEIT password |
| `ZEIT_BASE_URL` | No | `https://zeit.niceshops.cloud/` | The ZEIT instance URL |
| `ACTION` | No | `toggle` | Action to perform: `toggle` or `break` |

## Local Usage

Set the required environment variables and run:

```bash
export ZEIT_USER="your-username"
export ZEIT_PASS="your-password"
export ACTION="toggle"  # or "break"
npm start
```

## GitHub Actions Usage

This repository includes a GitHub Actions workflow that can be manually triggered.

### Setup Secrets

Before using the workflow, configure the following secrets in your repository settings:

1. Go to Settings > Secrets and variables > Actions
2. Add the following secrets:
   - `ZEIT_USER`: Your ZEIT username
   - `ZEIT_PASS`: Your ZEIT password
   - `ZEIT_BASE_URL` (optional): Custom ZEIT URL if different from default

### Running the Workflow

1. Go to the Actions tab in your GitHub repository
2. Select "ZEIT Automation" workflow
3. Click "Run workflow"
4. Choose the action:
   - `toggle`: Clock in/out
   - `break`: Take a lunch break
5. Click "Run workflow"

### Failure Artifacts

If the automation fails, the workflow automatically captures and uploads:
- Screenshot of the page at the time of failure
- HTML content of the page for debugging

You can download these artifacts from the workflow run page.

## Development

### TODO: Update Selectors

The current implementation uses placeholder selectors that need to be updated based on the actual ZEIT login page structure:

1. **Login form selectors** in `scripts/run.js`:
   - `input[name="username"]` - Update with actual username field selector
   - `input[name="password"]` - Update with actual password field selector
   - `button[type="submit"]` - Update with actual login button selector

2. **Action button selectors** in `scripts/run.js`:
   - `button[data-action="toggle"]` - Update with actual toggle button selector
   - `button[data-action="break"]` - Update with actual break button selector

To find the correct selectors:
1. Open https://zeit.niceshops.cloud/ in a browser
2. Use browser DevTools (F12) to inspect the elements
3. Update the selectors in `scripts/run.js`

## Project Structure

```
zeit-automation/
├── .github/
│   └── workflows/
│       └── zeit.yml          # GitHub Actions workflow
├── scripts/
│   └── run.js                # Main automation script
├── package.json              # Node.js dependencies
└── README.md                 # This file
```

## Troubleshooting

### Authentication Issues
- Verify that `ZEIT_USER` and `ZEIT_PASS` are correctly set
- Check if the login page URL has changed

### Selector Issues
- Update the selectors in `scripts/run.js` based on the actual ZEIT page structure
- Use browser DevTools to find the correct element selectors

### Workflow Failures
- Check the workflow logs in the Actions tab
- Download the error artifacts (screenshot and HTML) for debugging

## License

MIT