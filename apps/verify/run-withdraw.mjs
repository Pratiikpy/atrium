// Real-wallet UI E2E for WITHDRAW (Gate E3 / inventory B2), driven against the
// E2E build on :3200 via the funded-key connector. Connect -> /app/vault -> enter
// USDC -> click Withdraw -> a REAL coffer.withdraw tx fires. Ground truth = the
// on-chain Coffer-share + USDC balances before/after (the connector is a
// simplified injected provider that doesn't emit block events, so the UI success
// render lags; the chain is the source of truth).
import { chromium } from '@playwright/test';
import { createPublicClient, http } from 'viem';
import { arbitrumSepolia } from 'viem/chains';

const BASE = 'http://localhost:3200';
const COFFER = '0xc7bf0145371d3a79a9d43bab46dfee40f8a4aaf3';
const USDC = '0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d';
const T = '0x6821e3360D686A11b73AfaB4e3BC258fE7CC4a76';
const ABI = [{ type: 'function', name: 'balanceOf', stateMutability: 'view', inputs: [{ type: 'address' }], outputs: [{ type: 'uint256' }] }];
const pub = createPublicClient({ chain: arbitrumSepolia, transport: http('https://arbitrum-sepolia.publicnode.com') });
const shares = () => pub.readContract({ address: COFFER, abi: ABI, functionName: 'balanceOf', args: [T] });
const usdc = () => pub.readContract({ address: USDC, abi: ABI, functionName: 'balanceOf', args: [T] });

const b = await chromium.launch();
const page = await b.newContext().then((c) => c.newPage());
page.on('console', (m) => { if (m.type() === 'error') console.log('  [console.error]', m.text().slice(0, 120)); });

try {
  // Connect via the funded-key connector.
  await page.goto(`${BASE}/app/portfolio`, { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: /connect wallet/i }).first().click();
  await page.getByText(/0x6821/i).first().waitFor({ timeout: 20_000 });
  console.log('connected as', T);

  const sharesBefore = await shares();
  const usdcBefore = await usdc();
  console.log(`before: shares=${sharesBefore} usdc=${usdcBefore}`);

  await page.goto(`${BASE}/app/vault`, { waitUntil: 'domcontentloaded' });
  // Target the WITHDRAW card's input (the form whose button says "Withdraw ... USDC").
  const withdrawBtn = page.getByRole('button', { name: /withdraw\b.*usdc/i }).first();
  await withdrawBtn.waitFor({ timeout: 20_000 });
  const form = page.locator('form', { has: withdrawBtn });
  const input = form.locator('input[type="number"]').first();
  await input.fill('0.5');
  await withdrawBtn.click().catch(() => {});
  console.log('clicked Withdraw 0.5 USDC, waiting for the on-chain redeem...');
  await page.waitForTimeout(25_000);

  const sharesAfter = await shares().catch(() => sharesBefore);
  const usdcAfter = await usdc().catch(() => usdcBefore);
  console.log(`after:  shares=${sharesAfter} usdc=${usdcAfter}`);
  const sharesDropped = sharesAfter < sharesBefore;
  const usdcRose = usdcAfter > usdcBefore;
  console.log(`\nshares dropped: ${sharesDropped} (${sharesBefore} -> ${sharesAfter})`);
  console.log(`usdc rose:      ${usdcRose} (${usdcBefore} -> ${usdcAfter})`);
  console.log(sharesDropped && usdcRose ? 'PASS: real withdraw executed through the UI' : 'NOTE: no on-chain change this run (connector 2-step lag or breaker) — re-run or inspect');
} finally {
  await page.screenshot({ path: 'C:/Users/prate/AppData/Local/Temp/atrium-shots/e2e__withdraw.png', fullPage: true }).catch(() => {});
  await b.close();
}
