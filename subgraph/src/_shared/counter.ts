import { BigInt } from '@graphprotocol/graph-ts';
import { Counter } from '../../generated/schema';

const GLOBAL_ID = 'global';

function loadOrCreate(): Counter {
  let c = Counter.load(GLOBAL_ID);
  if (c == null) {
    c = new Counter(GLOBAL_ID);
    c.openPositionsCount = BigInt.zero();
    c.closedPositionsCount = BigInt.zero();
    c.totalDepositsCount = BigInt.zero();
    c.totalWithdrawalsCount = BigInt.zero();
    c.totalTvlWei = BigInt.zero();
    c.totalLiquidationsCount = BigInt.zero();
    c.activeAgentsCount = BigInt.zero();
    c.cohortPartnersCount = BigInt.zero();
    c.liveKeepersCount = BigInt.zero();
    c.lastUpdated = BigInt.zero();
  }
  return c;
}

export function incrementCounter(field: string, delta: BigInt, timestamp: BigInt): void {
  const c = loadOrCreate();
  if (field == 'openPositionsCount') c.openPositionsCount = c.openPositionsCount.plus(delta);
  else if (field == 'closedPositionsCount') c.closedPositionsCount = c.closedPositionsCount.plus(delta);
  else if (field == 'totalDepositsCount') c.totalDepositsCount = c.totalDepositsCount.plus(delta);
  else if (field == 'totalWithdrawalsCount') c.totalWithdrawalsCount = c.totalWithdrawalsCount.plus(delta);
  else if (field == 'totalTvlWei') {
    c.totalTvlWei = c.totalTvlWei.plus(delta);
    if (c.totalTvlWei.lt(BigInt.zero())) c.totalTvlWei = BigInt.zero();
  }
  else if (field == 'totalLiquidationsCount') c.totalLiquidationsCount = c.totalLiquidationsCount.plus(delta);
  else if (field == 'activeAgentsCount') c.activeAgentsCount = c.activeAgentsCount.plus(delta);
  c.lastUpdated = timestamp;
  c.save();
}

export function setCounterField(field: string, value: BigInt, timestamp: BigInt): void {
  const c = loadOrCreate();
  if (field == 'liveKeepersCount') c.liveKeepersCount = value;
  else if (field == 'activeAgentsCount') c.activeAgentsCount = value;
  else if (field == 'cohortPartnersCount') c.cohortPartnersCount = value;
  c.lastUpdated = timestamp;
  c.save();
}
