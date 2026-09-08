"""catalogs/health.json — the ingestion heartbeat behind the site's /health
page. Each job (sync-catalogs, sync-incidents) publishes its own section at
the end of a run plus a rolling shared history.

Two kinds of run reach here: a completed run replaces its job section
wholesale (`merge_health`), and a run that could not do its work at all —
the FTP host down, say — records the outage without discarding the last
good run's numbers (`merge_failure`): the section keeps answering "how stale
is the data?" while `last_failure` and an ok=false history row explain why
nothing newer arrived. A run that crashes for any other reason still writes
nothing, which the page surfaces as staleness (and the GitHub Actions API,
fetched client-side, shows the red run itself).
"""

from __future__ import annotations

from .b2 import Storage
from .catalogs import now_iso

SCHEMA_VERSION = 1
HISTORY_MAX = 40
KEY = "catalogs/health.json"


def _append_history(doc: dict, job: str, at: str, ok: bool, note) -> None:
    history = list(doc.get("history") or [])
    history.append({"job": job, "at": at, "ok": ok, "note": note})
    doc["history"] = history[-HISTORY_MAX:]


def merge_health(existing: dict | None, job: str, entry: dict) -> dict:
    """Fold one job's completed-run entry into the shared doc (other sections
    kept). Replacing the section wholesale also clears any `last_failure`
    left by an earlier outage — a success is the all-clear."""
    doc = dict(existing or {})
    doc["schema_version"] = SCHEMA_VERSION
    doc["updated_at"] = now_iso()
    doc[job] = entry
    _append_history(doc, job, entry.get("finished_at") or now_iso(),
                    bool(entry.get("ok", True)), entry.get("note"))
    return doc


def merge_failure(existing: dict | None, job: str, failure: dict,
                  defaults: dict | None = None) -> dict:
    """Record a run that did no work. `failure` carries started_at,
    finished_at, note (human-readable cause) and error (a stable code).

    The job section is preserved as the last completed run and gains
    `last_failure`; if the job has never completed, `defaults` (a zeroed
    entry) seeds the section with ok=false so the page has a shape to draw.
    """
    doc = dict(existing or {})
    doc["schema_version"] = SCHEMA_VERSION
    doc["updated_at"] = now_iso()
    section = dict(doc.get(job) or {})
    if not section:
        section = dict(defaults or {})
        section.update({
            "started_at": failure.get("started_at"),
            "finished_at": failure.get("finished_at"),
            "ok": False,
            "note": failure.get("note"),
        })
    section["last_failure"] = {
        "started_at": failure.get("started_at"),
        "finished_at": failure.get("finished_at") or now_iso(),
        "note": failure.get("note"),
        "error": failure.get("error"),
    }
    doc[job] = section
    _append_history(doc, job, section["last_failure"]["finished_at"], False,
                    failure.get("note"))
    return doc


def publish(storage: Storage, job: str, entry: dict, log=print) -> None:
    """Best-effort: a health hiccup must never fail the job itself."""
    try:
        doc = merge_health(storage.get_json(KEY), job, entry)
        storage.put_json(KEY, doc)
        log(f"[health] published {job} heartbeat")
    except Exception as exc:  # noqa: BLE001 — deliberately broad
        log(f"[health] publish failed (ignored): {exc}")


def publish_failure(storage: Storage, job: str, failure: dict,
                    defaults: dict | None = None, log=print) -> None:
    """Best-effort outage record (see merge_failure)."""
    try:
        doc = merge_failure(storage.get_json(KEY), job, failure, defaults)
        storage.put_json(KEY, doc)
        log(f"[health] recorded {job} failure: {failure.get('note')}")
    except Exception as exc:  # noqa: BLE001 — deliberately broad
        log(f"[health] failure record failed (ignored): {exc}")
