#!/usr/bin/env python3
"""Scrape the IAS officer directory from supremo.dopt.gov.in into raw/.

The site (knowyourofficerIAs.aspx) is a classic ASP.NET WebForms page:

  1. A GET yields a form carrying __VIEWSTATE / __EVENTVALIDATION tokens.
  2. POSTing ``txtName=<term>`` + ``btnSubmit`` returns a results grid
     (``rptListOfficer``) of every officer whose name contains the term.
  3. Each grid row is an ``__doPostBack`` link. POSTing that page's view-state
     with ``__EVENTTARGET=rptListOfficer$ctlNN$lniofficerid`` returns the
     officer's full biodata page.

To enumerate everybody we search each letter A-Z and collect the union of rows.
A row has no stable id of its own, so rows are de-duplicated on the composite
(name, service, cadre, allotment year, date of joining); the true identity
number only appears on the biodata page and is used for final de-duplication in
parse.py.

Raw HTML is written verbatim to:

  raw/lists/list_<LETTER>.html   - one results grid per search letter
  raw/details/<hash>.html        - one biodata page per unique officer
  raw/index.jsonl                - provenance: row context for each detail file

The script is resumable: a detail already present on disk is never re-fetched.
"""
from __future__ import annotations

import hashlib
import html
import json
import os
import random
import re
import sys
import time

import requests

BASE_URL = "https://supremo.dopt.gov.in/knowyourofficerIAs.aspx"
LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ"

ROOT = os.path.dirname(os.path.abspath(__file__))
RAW_DIR = os.path.join(ROOT, "raw")
LIST_DIR = os.path.join(RAW_DIR, "lists")
DETAIL_DIR = os.path.join(RAW_DIR, "details")
INDEX_PATH = os.path.join(RAW_DIR, "index.jsonl")

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
    "Origin": "https://supremo.dopt.gov.in",
    "Referer": BASE_URL,
}

HIDDEN_FIELDS = (
    "__VIEWSTATE",
    "__VIEWSTATEGENERATOR",
    "__VIEWSTATEENCRYPTED",
    "__EVENTVALIDATION",
)

# Tunables (override via environment for testing / politeness).
DELAY = float(os.environ.get("FETCH_DELAY", "0.5"))
TIMEOUT = float(os.environ.get("FETCH_TIMEOUT", "120"))
MAX_RETRIES = int(os.environ.get("FETCH_RETRIES", "4"))
# Restrict the run, e.g. FETCH_LETTERS=AB or FETCH_MAX_DETAILS=5 for a smoke test.
RUN_LETTERS = os.environ.get("FETCH_LETTERS", LETTERS)
MAX_DETAILS = int(os.environ.get("FETCH_MAX_DETAILS", "0"))  # 0 = unlimited


# --------------------------------------------------------------------------- #
# HTTP helpers
# --------------------------------------------------------------------------- #
def new_session() -> requests.Session:
    s = requests.Session()
    s.headers.update(HEADERS)
    return s


def request(session: requests.Session, method: str, **kwargs) -> requests.Response:
    last_exc = None
    for attempt in range(1, MAX_RETRIES + 1):
        try:
            resp = session.request(method, BASE_URL, timeout=TIMEOUT, **kwargs)
            resp.raise_for_status()
            return resp
        except Exception as exc:  # noqa: BLE001 - retry on any transport error
            last_exc = exc
            wait = min(30, 2 ** attempt) + random.uniform(0, 1)
            sys.stderr.write(f"  ! {method} attempt {attempt} failed: {exc} "
                             f"(retry in {wait:.1f}s)\n")
            time.sleep(wait)
    raise RuntimeError(f"{method} {BASE_URL} failed after {MAX_RETRIES} tries") from last_exc


def parse_hidden(text: str) -> dict[str, str]:
    """Pull the ASP.NET postback tokens out of a rendered form."""
    fields = {}
    for name in HIDDEN_FIELDS:
        m = re.search(
            rf'name="{re.escape(name)}"[^>]*value="([^"]*)"', text
        )
        fields[name] = html.unescape(m.group(1)) if m else ""
    return fields


def base_payload(hidden: dict[str, str]) -> dict[str, str]:
    return {
        "__EVENTTARGET": "",
        "__EVENTARGUMENT": "",
        "__VIEWSTATE": hidden["__VIEWSTATE"],
        "__VIEWSTATEGENERATOR": hidden["__VIEWSTATEGENERATOR"],
        "__VIEWSTATEENCRYPTED": hidden["__VIEWSTATEENCRYPTED"],
        "__EVENTVALIDATION": hidden["__EVENTVALIDATION"],
        "txtAllotYr": "",
        "watermark_StartBatchYear_ClientState": "",
        "txtName": "",
        "hfName": "",
        "TWE_txtName_ClientState": "",
    }


# --------------------------------------------------------------------------- #
# List grid
# --------------------------------------------------------------------------- #
def fetch_list(session: requests.Session, letter: str) -> str:
    """Search a single letter and return the raw results-grid HTML."""
    landing = request(session, "GET")
    payload = base_payload(parse_hidden(landing.text))
    payload["txtName"] = letter
    payload["btnSubmit"] = "Submit"
    resp = request(session, "POST", data=payload)
    return resp.text


_ROW_LINK = re.compile(
    r'id="rptListOfficer_lniofficerid_(\d+)"[^>]*'
    r'href="javascript:__doPostBack\(&#39;([^&]+?)&#39;,&#39;&#39;\)"[^>]*>(.*?)</a>',
    re.DOTALL,
)


def _field_map(text: str, suffix: str) -> dict[str, str]:
    pat = re.compile(
        rf'id="rptListOfficer_{suffix}_(\d+)"[^>]*>(.*?)</span>', re.DOTALL
    )
    return {m.group(1): _clean(m.group(2)) for m in pat.finditer(text)}


def _clean(value: str) -> str:
    return re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", "", value))).strip()


def parse_list_rows(text: str) -> list[dict[str, str]]:
    services = _field_map(text, "lblService")
    cadres = _field_map(text, "lblCadre")
    batches = _field_map(text, "lblBatch")
    dojs = _field_map(text, "lblDOJ")
    rows = []
    for m in _ROW_LINK.finditer(text):
        idx = m.group(1)
        rows.append(
            {
                "ctl_target": html.unescape(m.group(2)),
                "name": _clean(m.group(3)),
                "service": services.get(idx, ""),
                "cadre": cadres.get(idx, ""),
                "allotment_year": batches.get(idx, ""),
                "date_of_joining": dojs.get(idx, ""),
            }
        )
    return rows


# --------------------------------------------------------------------------- #
# Detail page
# --------------------------------------------------------------------------- #
def fetch_detail(session: requests.Session, hidden: dict[str, str],
                 ctl_target: str, letter: str) -> str:
    payload = base_payload(hidden)
    payload["__EVENTTARGET"] = ctl_target
    payload["txtName"] = letter
    resp = request(session, "POST", data=payload)
    return resp.text


def is_detail_page(text: str) -> bool:
    return "Identity No." in text and "Complete Biodata" in text


def provisional_key(row: dict[str, str]) -> str:
    parts = [row["name"], row["service"], row["cadre"],
             row["allotment_year"], row["date_of_joining"]]
    return hashlib.sha1("|".join(parts).encode("utf-8")).hexdigest()


# --------------------------------------------------------------------------- #
# Driver
# --------------------------------------------------------------------------- #
def load_seen() -> set[str]:
    seen = set()
    if os.path.exists(INDEX_PATH):
        with open(INDEX_PATH, encoding="utf-8") as fh:
            for line in fh:
                line = line.strip()
                if line:
                    seen.add(json.loads(line)["hash"])
    return seen


def main() -> None:
    os.makedirs(LIST_DIR, exist_ok=True)
    os.makedirs(DETAIL_DIR, exist_ok=True)

    seen = load_seen()
    fetched = 0
    print(f"Resuming with {len(seen)} officers already on disk.")

    index_fh = open(INDEX_PATH, "a", encoding="utf-8")
    try:
        for letter in RUN_LETTERS:
            session = new_session()
            print(f"[{letter}] searching ...", flush=True)
            list_html = fetch_list(session, letter)
            with open(os.path.join(LIST_DIR, f"list_{letter}.html"),
                      "w", encoding="utf-8") as fh:
                fh.write(list_html)

            hidden = parse_hidden(list_html)
            rows = parse_list_rows(list_html)
            print(f"[{letter}] {len(rows)} rows", flush=True)

            for row in rows:
                key = provisional_key(row)
                detail_path = os.path.join(DETAIL_DIR, f"{key}.html")
                if key in seen or os.path.exists(detail_path):
                    seen.add(key)
                    continue

                detail_html = fetch_detail(session, hidden, row["ctl_target"], letter)
                if not is_detail_page(detail_html):
                    # View-state likely went stale; refresh the grid once and retry.
                    list_html = fetch_list(session, letter)
                    hidden = parse_hidden(list_html)
                    detail_html = fetch_detail(session, hidden,
                                               row["ctl_target"], letter)
                    if not is_detail_page(detail_html):
                        sys.stderr.write(f"  ! no detail for {row['name']!r}; skipping\n")
                        continue

                with open(detail_path, "w", encoding="utf-8") as fh:
                    fh.write(detail_html)
                index_fh.write(json.dumps({
                    "hash": key,
                    "detail_file": f"details/{key}.html",
                    "source_letter": letter,
                    **{k: row[k] for k in
                       ("name", "service", "cadre", "allotment_year", "date_of_joining")},
                }) + "\n")
                index_fh.flush()
                seen.add(key)
                fetched += 1

                if fetched % 100 == 0:
                    print(f"    ... {fetched} new officers fetched", flush=True)
                if MAX_DETAILS and fetched >= MAX_DETAILS:
                    print(f"Reached FETCH_MAX_DETAILS={MAX_DETAILS}; stopping.")
                    return
                time.sleep(DELAY + random.uniform(0, DELAY))
    finally:
        index_fh.close()
        print(f"Done. {fetched} officers fetched this run; "
              f"{len(seen)} known in total.")


if __name__ == "__main__":
    main()
