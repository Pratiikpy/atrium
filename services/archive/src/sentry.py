"""
Sentry shim for the archive service (Python weekly backtest cron).
Phase theta.6 (2026-05-25). Same DSN-or-no-op contract as the
TypeScript service shims under services/vigil-keeper/src/lib/sentry.ts.

Usage:
    from sentry import init_sentry, capture_archive_error
    init_sentry()
    try:
        run_backtest()
    except Exception as exc:
        capture_archive_error(exc, ctx={"strategy": strategy_id})
        raise
"""
import logging
import os
from typing import Any, Dict, Optional

_initialised = False
_sentry: Optional[Any] = None
_log = logging.getLogger("atrium.archive")


def init_sentry() -> None:
    global _initialised, _sentry
    if _initialised:
        return
    dsn = os.environ.get("SENTRY_DSN")
    if not dsn:
        return
    try:
        # Lazy import so the dependency is optional. If sentry_sdk is
        # not installed, the service still runs; events fall back to
        # the local logger.
        import sentry_sdk  # type: ignore

        sentry_sdk.init(
            dsn=dsn,
            environment=os.environ.get("PYTHON_ENV", "production"),
            traces_sample_rate=0.1,
            before_send=_scrub_pii,
        )
        _sentry = sentry_sdk
        _initialised = True
    except Exception:
        # sentry_sdk not installed; honest no-op.
        pass


def _scrub_pii(event: Dict[str, Any], _hint: Dict[str, Any]) -> Dict[str, Any]:
    """Strip request bodies + runtime context before send. Wallet
    addresses pass through (public on-chain identifiers needed for
    triage). Mirrors the TS shims' beforeSend hook."""
    if isinstance(event.get("request"), dict):
        event["request"].pop("data", None)
    if isinstance(event.get("contexts"), dict):
        event["contexts"].pop("runtime", None)
    return event


def capture_archive_error(err: BaseException, ctx: Optional[Dict[str, Any]] = None) -> None:
    if _sentry is not None:
        _sentry.set_tag("service", "archive")
        if ctx:
            for k, v in ctx.items():
                _sentry.set_extra(k, v)
        _sentry.capture_exception(err)
    else:
        _log.exception("[archive] %s", err, extra={"ctx": ctx or {}})


def capture_archive_event(msg: str, ctx: Optional[Dict[str, Any]] = None) -> None:
    if _sentry is not None:
        _sentry.set_tag("service", "archive")
        if ctx:
            for k, v in ctx.items():
                _sentry.set_extra(k, v)
        _sentry.capture_message(msg)
    else:
        _log.info("[archive] %s ctx=%s", msg, ctx or {})
