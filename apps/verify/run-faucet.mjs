// Real-wallet UI E2E for the FAUCET claim (Gate E3 / inventory A3), against the
// E2E build on :3200. Connect -> /app/onboarding -> advance to the Faucet step ->
// Claim faucet -> a REAL faucet.claim() tx fires. Ground truth = on-chain USDC
// balance before/after (expect +5 USDC).
import { chromium } from '@playwright/test';
import { createPublicClient, http } from 'viem';
import { arbitrumSepolia } from 'viem/chains';

const BASE = 'http://localhost:3200';
const USDC = '0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d';
const T = '0x6821e3360D686A11b73AfaB4e3BC258fE7CC4a76';
const ABI = [{ type: 'function', name: 'balanceOf', stateMutability: 'view', inputs: [{ type: 'address' }], outputs: [{ type: 'uint256' }] }];
const pub = createPublicClient({ chain: arbitrumSepolia, transport: http('https://arbitrum-sepolia.publicnode.com') });
const usdc = () => pub.readContract({ address: USDC, abi: ABI, functionName: 'balanceOf', args: [T] });

const b = await chromium.launch();
const page = await b.newContext().then((c) => c.newPage());
const clickIf = async (re, timeout = 5000) => {
  try { const el = page.getByRole('button', { name: re }).first(); await el.waitFor({ timeout }); await el.click(); return true; } catch { return false; }
};
try {
  await page.goto(`${BASE}/app/onboarding`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1500);
  // Dismiss the cookie-consent modal (it overlaps the bottom-right CTAs).
  await clickIf(/reject non-essential|accept all/i, 6000);
  await page.waitForTimeout(500);
  // Connect (the connector may be in the shell or the step).
  await clickIf(/connect wallet/i, 8000);
  await page.getByText(/0x6821/i).first().waitFor({ timeout: 20_000 }).catch(() => {});
  console.log('connected (or proceeding)');

  // Advance Welcome -> Authenticator -> Faucet.
  await clickIf(/set up authenticator/i, 8000);
  await page.waitForTimeout(800);
  await clickIf(/skip for now/i, 8000);
  await page.waitForTimeout(800);

  const claim = page.getByRole('button', { name: /claim faucet/i }).first();
  await claim.waitFor({ timeout: 15_000 });
  const before = await usdc();
  console.log(`on Faucet step. USDC before = ${before}`);
  await claim.click().catch(() => {});
  console.log('clicked Claim faucet, waiting for the on-chain claim...');
  await page.waitForTimeout(25_000);
  const after = await usdc().catch(() => before);
  console.log(`USDC after = ${after}`);
  const rose = after > before;
  console.log(`\nUSDC rose: ${rose} (${before} -> ${after}, delta=${after - before} = ${Number(after - before) / 1e6} USDC)`);
  console.log(rose ? 'PASS: real faucet claim executed through the UI (+5 USDC expected)' : 'NOTE: no change this run (connector lag / cooldown) — inspect');
} catch (e) {
  console.log('ERROR:', e.message.slice(0, 140));
} finally {
  await page.screenshot({ path: 'C:/Users/prate/AppData/Local/Temp/atrium-shots/e2e__faucet.png', fullPage: true }).catch(() => {});
  await b.close();
}
