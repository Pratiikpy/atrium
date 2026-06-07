import { Bytes } from '@graphprotocol/graph-ts';
import {
  PositionOpenedViaRouter,
  PositionClosedViaRouter,
} from '../generated/AtriumRouter/AtriumRouter';
import { RouterPositionEvent, Position } from '../generated/schema';

/**
 * AtriumRouter event indexer.
 *
 * Plinth still indexes the canonical PositionOpened event (it carries
 * the venue_id discriminator). The Router-specific events captured here
 * surface the orchestration binding the Plinth view can't show alone:
 * plinth_position_id ↔ venue_position_id and the explicit "this happened
 * via the Router" provenance. Used by the verify-app to render the
 * "Router orchestrated N positions this period" stat without joining
 * three event tables client-side.
 */
export function handlePositionOpenedViaRouter(event: PositionOpenedViaRouter): void {
  const id = event.transaction.hash.toHexString() + '-' + event.logIndex.toString();
  const r = new RouterPositionEvent(id);
  r.user = event.params.user;
  r.venueId = event.params.venue_id;
  r.instrumentId = event.params.instrument_id;
  r.notionalSigned = event.params.notional_signed;
  r.plinthPositionId = event.params.plinth_position_id;
  r.venuePositionId = event.params.venue_position_id;
  r.realizedPnlSigned = null;
  r.action = 'open';
  r.blockNumber = event.block.number;
  r.timestamp = event.block.timestamp;
  r.save();

  // Re-attribute the Plinth-side Position to the real trader. Plinth's
  // PositionOpened event fires with owner = msg.sender, which is THIS
  // router when the open is orchestrated through it, so the position
  // would otherwise be filed under the router address and never appear
  // in the user's portfolio (the portfolio query filters positions by
  // owner). The router event carries the real user; rebind to them. The
  // Plinth PositionOpened log precedes this one in the same tx, so the
  // Position entity already exists by the time we run.
  const pos = Position.load(event.params.plinth_position_id.toString());
  if (pos !== null) {
    pos.owner = event.params.user.toHexString();
    pos.save();
  }
}

export function handlePositionClosedViaRouter(event: PositionClosedViaRouter): void {
  const id = event.transaction.hash.toHexString() + '-' + event.logIndex.toString();
  const r = new RouterPositionEvent(id);
  r.user = event.params.user;
  r.venueId = event.params.venue_id;
  // Close event does not carry instrument_id / notional, leave null. The
  // dashboard joins to the corresponding `open` record via plinth_position_id
  // if it needs those fields.
  r.instrumentId = null;
  r.notionalSigned = null;
  r.plinthPositionId = event.params.plinth_position_id;
  r.venuePositionId = event.params.venue_position_id;
  r.realizedPnlSigned = event.params.realized_pnl_signed;
  r.action = 'close';
  r.blockNumber = event.block.number;
  r.timestamp = event.block.timestamp;
  r.save();
}
