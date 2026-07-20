#!/usr/bin/env node

/**
 * Custom startup message for Next.js dev server
 * Improves developer experience with helpful information
 */

import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const colors = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    dim: '\x1b[2m',
    blue: '\x1b[34m',
    cyan: '\x1b[36m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    magenta: '\x1b[35m'
};

const packageJson = JSON.parse(readFileSync(join(__dirname, '../package.json'), 'utf-8'));
const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };
// Major from a semver range ("^16.2.10" -> "16") so the banner never goes stale on upgrade.
const major = (range) => (String(range).match(/\d+/) || ['?'])[0];

function printStartupMessage() {
    console.log('\n');
    console.log(
        `${colors.cyan}${colors.bright}╔═══════════════════════════════════════════════════════════╗${colors.reset}`
    );
    // Display name — rename on fork (see README "Forking — rename checklist").
    console.log(
        `${colors.cyan}${colors.bright}║${colors.reset}  ${colors.bright}Next.js SEO Template${colors.reset} ${colors.dim}v${packageJson.version}${colors.reset}                    ${colors.cyan}${colors.bright}║${colors.reset}`
    );
    console.log(
        `${colors.cyan}${colors.bright}╚═══════════════════════════════════════════════════════════╝${colors.reset}`
    );
    console.log('');
    console.log(
        `${colors.green}${colors.bright}✓${colors.reset} ${colors.bright}Architecture:${colors.reset} Feature-Sliced Design (FSD)`
    );
    console.log(
        `${colors.green}${colors.bright}✓${colors.reset} ${colors.bright}Stack:${colors.reset} Next.js ${major(deps.next)} | React ${major(deps.react)} | TypeScript`
    );
    console.log(
        `${colors.green}${colors.bright}✓${colors.reset} ${colors.bright}Performance:${colors.reset} ISR + vendor-split + Web Vitals`
    );
    console.log('');
    console.log(`${colors.blue}${colors.bright}📚 Useful Links:${colors.reset}`);
    console.log(`   ${colors.dim}•${colors.reset} Local:        http://localhost:3000`);
    console.log(`   ${colors.dim}•${colors.reset} Health Check: http://localhost:3000/api/health`);
    console.log(`   ${colors.dim}•${colors.reset} Dev UI:        http://localhost:3000/dev/ui`);
    console.log('');
    console.log(`${colors.yellow}${colors.bright}💡 Tips:${colors.reset}`);
    console.log(
        `   ${colors.dim}•${colors.reset} Using ${colors.green}${colors.bright}Turbopack${colors.reset} (faster HMR) by default`
    );
    console.log(
        `   ${colors.dim}•${colors.reset} Use ${colors.cyan}npm run dev:webpack${colors.reset} to use Webpack instead`
    );
    console.log(
        `   ${colors.dim}•${colors.reset} Use ${colors.cyan}npm run build:analyze${colors.reset} to analyze bundle`
    );
    console.log(
        `   ${colors.dim}•${colors.reset} Check ${colors.cyan}.cursor/rules/${colors.reset} for development guidelines`
    );
    console.log('');
    console.log(`${colors.magenta}${colors.bright}🚀 Starting Next.js...${colors.reset}\n`);
}

printStartupMessage();
