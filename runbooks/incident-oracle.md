# Incident, oracle drift / staleness

Trigger: `plinth.oracle.disagreement.count` > 5/hour, or any `OracleStaleError` on Plinth.

## Response (in order)

1. **Verify the alert is real.** Open `loadtest.useatrium.me`. If both Chainlink and Pyth show fresh prices, the alert is a false positive, silence and document.
2. **Identify the disagreeing instrument.** Look at the most recent `OracleDisagreement` event on Plinth.
3. **Compare with public oracle dashboards.**
   - Chainlink: https://data.chain.link/
   - Pyth: https://pyth.network/price-feeds
4. **Choose response:**
   - If only one feed is wrong: Praetor multisig pauses that instrument via `Plinth.set_instrument_risk(..., is_active: false)`.
   - If both feeds disagree with consensus markets: pause global Plinth via `Plinth.pause("oracle disagreement")`.
   - If both feeds are fine but the alert keeps firing: tune `oracle_tolerance_bps` via Praetor timelock (48h).
5. **Communicate.** Post a banner on `lantern.useatrium.me`. Tweet the status. Pin a Mirror post.
6. **Resume.** When alignment returns, Praetor unpauses via 48h timelock (instant unpause is multisig-only emergency path; only used for clear false positives).
7. **Post-mortem.** Within 7 days, file `/incidents/YYYYMMDD-oracle-drift.md` with root cause + preventive action + a regression test that would catch it.
