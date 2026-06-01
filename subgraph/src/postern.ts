import { KillSwitchActivated, SigilRevokeSkipped } from '../generated/PosternKillSwitch/PosternKillSwitch';
import {
  SessionKeyIssued,
  SessionKeyRevoked,
  SessionKeyExpiredCleaned,
} from '../generated/PosternKeyRegistry/PosternKeyRegistry';
import {
  KillSwitchEvent,
  PosternKeyEvent,
  PosternSessionKey,
  SubsystemDiagnosticEvent,
} from '../generated/schema';

export function handleKillSwitchActivated(event: KillSwitchActivated): void {
  const id = event.transaction.hash.toHexString() + '-' + event.logIndex.toString();
  const k = new KillSwitchEvent(id);
  k.user = event.params.user;
  k.sigilAgentsRevoked = event.params.sigil_agents_revoked;
  k.sessionKeysCancelled = event.params.session_keys_cancelled;
  k.blockNumber = event.block.number;
  k.timestamp = event.block.timestamp;
  k.save();
}

// Tier-2 defensive observability. Partial-failure path of the kill switch:
// per-agent revoke failed (Sigil paused / agent already revoked in stale
// nonce / future upgrade quirk). The user needs to know which agents the
// kill switch did NOT successfully revoke, without this indexing, the
// kill-switch UI would render "everything revoked" when it actually wasn't.
export function handleSigilRevokeSkipped(event: SigilRevokeSkipped): void {
  const id = event.transaction.hash.toHexString() + '-' + event.logIndex.toString();
  const d = new SubsystemDiagnosticEvent(id);
  d.kind = 'sigil_revoke_skipped';
  d.contract = 'PosternKillSwitch';
  d.blockNumber = event.block.number;
  d.timestamp = event.block.timestamp;
  d.user = event.params.user;
  d.agent = event.params.agent;
  d.reasonBytes = event.params.reason;
  d.save();
}

// Audit Month-2 #21 (closes `human_left.md` #21): index every Postern session
// key lifecycle event so Codex `/agents/summary` can return a real
// activeSessionKeys count instead of null.

export function handleSessionKeyIssued(event: SessionKeyIssued): void {
  const evtId = event.transaction.hash.toHexString() + '-' + event.logIndex.toString();
  const evt = new PosternKeyEvent(evtId);
  evt.user = event.params.user;
  evt.sessionKey = event.params.sessionKey;
  evt.kind = 'issued';
  evt.expiresAt = event.params.expiresAt;
  evt.blockNumber = event.block.number;
  evt.timestamp = event.block.timestamp;
  evt.save();

  const skId =
    event.params.user.toHexString() + '-' + event.params.sessionKey.toHexString();
  const sk = new PosternSessionKey(skId);
  sk.user = event.params.user;
  sk.sessionKey = event.params.sessionKey;
  sk.state = 'active';
  sk.issuedAt = event.block.timestamp;
  sk.expiresAt = event.params.expiresAt;
  sk.revokedAt = null;
  sk.save();
}

export function handleSessionKeyRevoked(event: SessionKeyRevoked): void {
  const evtId = event.transaction.hash.toHexString() + '-' + event.logIndex.toString();
  const evt = new PosternKeyEvent(evtId);
  evt.user = event.params.user;
  evt.sessionKey = event.params.sessionKey;
  evt.kind = 'revoked';
  evt.expiresAt = null;
  evt.blockNumber = event.block.number;
  evt.timestamp = event.block.timestamp;
  evt.save();

  const skId =
    event.params.user.toHexString() + '-' + event.params.sessionKey.toHexString();
  const sk = PosternSessionKey.load(skId);
  if (sk !== null) {
    sk.state = 'revoked';
    sk.revokedAt = event.block.timestamp;
    sk.save();
  }
}

export function handleSessionKeyExpiredCleaned(event: SessionKeyExpiredCleaned): void {
  const evtId = event.transaction.hash.toHexString() + '-' + event.logIndex.toString();
  const evt = new PosternKeyEvent(evtId);
  evt.user = event.params.user;
  evt.sessionKey = event.params.sessionKey;
  evt.kind = 'expired_cleaned';
  evt.expiresAt = null;
  evt.blockNumber = event.block.number;
  evt.timestamp = event.block.timestamp;
  evt.save();

  const skId =
    event.params.user.toHexString() + '-' + event.params.sessionKey.toHexString();
  const sk = PosternSessionKey.load(skId);
  if (sk !== null) {
    sk.state = 'expired';
    sk.save();
  }
}
