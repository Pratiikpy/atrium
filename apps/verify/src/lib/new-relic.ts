/**
 * New Relic Browser Agent, Phase 12 observability.
 *
 * Loads the NR browser agent only when the user has granted analytics consent.
 * Reads NEXT_PUBLIC_NEW_RELIC_LICENSE_KEY and NEXT_PUBLIC_NEW_RELIC_APP_ID from env (Doppler).
 */
import { hasConsent } from './consent';

let loaded = false;

export function loadNewRelicBrowser(): boolean {
  if (typeof window === 'undefined') return false;
  if (loaded) return true;
  if (!hasConsent('analytics')) return false;

  const licenseKey = process.env.NEXT_PUBLIC_NEW_RELIC_LICENSE_KEY;
  const appId = process.env.NEXT_PUBLIC_NEW_RELIC_APP_ID;
  if (!licenseKey || !appId) return false;

  const script = document.createElement('script');
  script.src = `https://js-agent.newrelic.com/nr-loader-spa-current.min.js`;
  script.setAttribute('data-license-key', licenseKey);
  script.setAttribute('data-application-id', appId);
  script.async = true;
  document.head.appendChild(script);

  loaded = true;
  return true;
}
