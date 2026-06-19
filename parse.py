#!/usr/bin/env python3
"""Parse the raw biodata HTML in raw/ into tidy data files under data/.

Each officer's biodata page is a stack of HTML tables. They are matched by the
section title they carry rather than by position, so the parser is tolerant of
missing/empty sections.

The headline dataset is one self-contained nested document per officer,
published in two equivalent forms:

  data/combined.jsonl      JSON Lines, one officer object per line
  data/combined.parquet    the identical structure as nested Parquet
                           (list<struct> columns)

Every normalised table is a building block under data/partial/, written twice
(<table>.csv.zip and <table>.parquet):

  officers                 ias profile bio block + central-deputation extras
  education                III.  Educational Qualifications
  experience               IV.   Experience Details
  mid_career_training      V.    Mid Career Training Details
  in_service_training      VI.   In-Service Training Details
  domestic_training        VII.  Domestic Training Details
  foreign_training         VIII. Foreign Training Details
  awards_publications      IX.   Awards / Publications
"""
from __future__ import annotations

import glob
import json
import os
import re

import pandas as pd
import pyarrow as pa
import pyarrow.parquet as pq
from bs4 import BeautifulSoup

ROOT = os.path.dirname(os.path.abspath(__file__))
RAW_DIR = os.path.join(ROOT, "raw")
DETAIL_DIR = os.path.join(RAW_DIR, "details")
INDEX_PATH = os.path.join(RAW_DIR, "index.jsonl")
DATA_DIR = os.path.join(ROOT, "data")
PARTIAL_DIR = os.path.join(DATA_DIR, "partial")

# Child-section title -> (table key, ordered output columns, source column count).
# The source count is how many leading cells of each data row to keep (some
# rows render a trailing spacer cell).
CHILD_SECTIONS = {
    "Educational Qualifications": (
        "education",
        ["sno", "qualification_university_institute", "subject", "division"],
    ),
    "Experience Details": (
        "experience",
        ["sno", "designation_level", "ministry_dept_office_location",
         "organisation", "experience_major_minor", "period"],
    ),
    "Mid Career Training": (
        "mid_career_training",
        ["sno", "year", "training_name", "date_from", "date_to"],
    ),
    "In-Service Training": (
        "in_service_training",
        ["sno", "year", "training_name", "institute", "city", "duration_weeks"],
    ),
    "Domestic Training": (
        "domestic_training",
        ["sno", "year", "name", "subject", "duration"],
    ),
    "Foreign Training": (
        "foreign_training",
        ["sno", "year", "name", "subject", "duration", "country"],
    ),
    "Awards / Publications": (
        "awards_publications",
        ["sno", "type", "area", "year", "award_name_book_title",
         "awards_given_by_publisher", "subject", "level"],
    ),
}

HEADER_LABELS = {
    "Identity No.": "identity_no",
    "Source of Recruitment": "source_of_recruitment",
    "Date of Birth": "date_of_birth",
    "Gender": "gender",
    "Place of Domicile": "place_of_domicile",
    "Mother Tongue": "mother_tongue",
    "Languages Known": "languages_known",
    "Retirement Reason": "retirement_reason",
}

DEPUTATION_LABELS = {
    "Whether Presently on deputation to GOI": "on_central_deputation",
    "Date of Start of Central Deputation": "deputation_start_date",
    "Expiry Date of tenure of Central Deputation": "deputation_expiry_date",
    "Tenure Type": "deputation_tenure_type",
}

OFFICER_RENAME = {
    "identity_no": "ID",
    "name": "Name",
    "service": "Service",
    "cadre": "Cadre",
    "allotment_year": "Allotment_Year",
    "date_of_birth": "Date_of_Birth",
    "date_of_joining": "Date_of_Joining",
    "source_of_recruitment": "Source_of_Recruitment",
    "gender": "Gender",
    "place_of_domicile": "Place_of_Domicile",
    "mother_tongue": "Mother_Tongue",
    "languages_known": "Languages_Known",
    "retirement_reason": "Retirement_Reason",
    "on_central_deputation": "On_Central_Deputation",
    "deputation_start_date": "Deputation_Start_Date",
    "deputation_expiry_date": "Deputation_Expiry_Date",
    "deputation_tenure_type": "Deputation_Tenure_Type",
}

IAS_BIO_COLUMNS = [
    "ID", "Name", "Cadre", "Allotment_Year", "Date_of_Birth",
    "Date_of_Joining", "Source_of_Recruitment", "Gender", "Place_of_Domicile",
    "Mother_Tongue", "Languages_Known", "Retired", "Retirement_Reason",
]

OFFICER_EXTRA_COLUMNS = [
    "Service", "On_Central_Deputation", "Deputation_Start_Date",
    "Deputation_Expiry_Date", "Deputation_Tenure_Type",
]


def retired_flag(reason: str) -> str:
    """``Retired`` flag: 0 for serving, 1 once retired."""
    if not reason:
        return ""
    return "0" if reason == "Serving" else "1"


def norm(text: str) -> str:
    text = re.sub(r"\s+", " ", text or "").strip()
    return "" if text in ("--", "-", "") else text


def cells(row) -> list[str]:
    return [norm(c.get_text(" ", strip=True)) for c in row.find_all(["td", "th"])]


def table_title(table) -> str:
    first = table.find("tr")
    return first.get_text(" ", strip=True) if first else ""


def is_data_row(values: list[str]) -> bool:
    """Data rows start with a numeric S.No.; skip headers / 'N I L' rows."""
    return bool(values) and values[0].isdigit()


def parse_header(table, officer: dict) -> None:
    rows = table.find_all("tr")
    if rows:
        officer["name"] = norm(rows[0].get_text(" ", strip=True))
    for row in rows[1:]:
        cs = cells(row)
        if len(cs) < 2:
            continue
        label, value = cs[0].rstrip(" :"), cs[1]
        if label.startswith("Service/"):
            parts = [p.strip() for p in value.split("/")]
            officer["service"] = parts[0] if len(parts) > 0 else ""
            officer["cadre"] = parts[1] if len(parts) > 1 else ""
            officer["allotment_year"] = parts[2] if len(parts) > 2 else ""
            continue
        for needle, key in HEADER_LABELS.items():
            if label.startswith(needle):
                # Languages render as a run of space-separated tokens.
                officer[key] = " ".join(value.split()) if key == "languages_known" else value
                break


def parse_deputation(table, officer: dict) -> None:
    for row in table.find_all("tr"):
        cs = cells(row)
        if len(cs) < 2:
            continue
        for needle, key in DEPUTATION_LABELS.items():
            if needle in cs[0]:
                officer[key] = cs[1]
                break


def parse_child(table, columns: list[str]) -> list[list[str]]:
    out = []
    for row in table.find_all("tr"):
        values = cells(row)
        if not is_data_row(values):
            continue
        values = (values + [""] * len(columns))[: len(columns)]
        out.append(values)
    return out


def parse_detail(html: str) -> tuple[dict, dict[str, list[list[str]]]]:
    soup = BeautifulSoup(html, "lxml")
    officer: dict = {}
    children: dict[str, list[list[str]]] = {}

    for table in soup.find_all("table"):
        title = table_title(table)
        if "Identity No." in title or table.get("id") == "one-column-emphasis":
            parse_header(table, officer)
        elif "Central Deputation" in title:
            parse_deputation(table, officer)
        else:
            for needle, (key, columns) in CHILD_SECTIONS.items():
                if needle in title:
                    children[key] = parse_child(table, columns)
                    break
    return officer, children


def load_index() -> dict[str, dict]:
    by_hash = {}
    if os.path.exists(INDEX_PATH):
        with open(INDEX_PATH, encoding="utf-8") as fh:
            for line in fh:
                line = line.strip()
                if line:
                    rec = json.loads(line)
                    by_hash[rec["hash"]] = rec
    return by_hash


def write_outputs(name: str, df: pd.DataFrame, target_dir: str = DATA_DIR) -> None:
    os.makedirs(target_dir, exist_ok=True)
    csv_path = os.path.join(target_dir, f"{name}.csv.zip")
    df.to_csv(
        csv_path,
        index=False,
        compression={"method": "zip", "archive_name": f"{name}.csv"},
    )
    df.to_parquet(os.path.join(target_dir, f"{name}.parquet"), index=False)
    print(f"  {os.path.relpath(target_dir, ROOT)}/{name}: {len(df)} rows")


# The four training sections are grouped under a single nested ``training``
# object, keyed by these short names.
TRAINING_KEYS = {
    "mid_career_training": "mid_career",
    "in_service_training": "in_service",
    "domestic_training": "domestic",
    "foreign_training": "foreign",
}


def _item_fields(df: pd.DataFrame) -> list[str]:
    """Columns of a child record once the join key and positional index drop."""
    return [c for c in df.columns if c not in ("identity_no", "sno")]


CHILD_ORDER = [key for key, _ in CHILD_SECTIONS.values()]


def officer_table(officers_df: pd.DataFrame) -> pd.DataFrame:
    """Officers renamed to match the required schema (bio block + extras)."""
    df = officers_df.rename(columns=OFFICER_RENAME)
    df["Retired"] = df["Retirement_Reason"].map(retired_flag)
    return df.reindex(columns=IAS_BIO_COLUMNS + OFFICER_EXTRA_COLUMNS).fillna("")


def build_documents(officers_df: pd.DataFrame,
                    child_dfs: dict[str, pd.DataFrame]) -> list[dict]:
    """One self-contained nested document per officer (a biodata digital twin)."""
    grouped: dict[str, dict[str, list[dict]]] = {}
    for key, df in child_dfs.items():
        fields = _item_fields(df)
        by_id: dict[str, list[dict]] = {}
        if not df.empty:
            for ident, sub in df.groupby("identity_no"):
                by_id[ident] = sub[fields].to_dict("records")
        grouped[key] = by_id

    docs = []
    for rec in officers_df.to_dict("records"):
        ident = rec["identity_no"]
        docs.append({
            "ID": ident,
            "Name": rec["name"],
            "Service": rec["service"],
            "Cadre": rec["cadre"],
            "Allotment_Year": rec["allotment_year"],
            "Date_of_Birth": rec["date_of_birth"],
            "Date_of_Joining": rec["date_of_joining"],
            "Source_of_Recruitment": rec["source_of_recruitment"],
            "Gender": rec["gender"],
            "Place_of_Domicile": rec["place_of_domicile"],
            "Mother_Tongue": rec["mother_tongue"],
            "Languages_Known": [l for l in rec["languages_known"].split() if l],
            "Retired": retired_flag(rec["retirement_reason"]),
            "Retirement_Reason": rec["retirement_reason"],
            "central_deputation": {
                "on_deputation": rec["on_central_deputation"],
                "start_date": rec["deputation_start_date"],
                "expiry_date": rec["deputation_expiry_date"],
                "tenure_type": rec["deputation_tenure_type"],
            },
            "education": grouped["education"].get(ident, []),
            "experience": grouped["experience"].get(ident, []),
            "training": {
                tkey: grouped[ckey].get(ident, [])
                for ckey, tkey in TRAINING_KEYS.items()
            },
            "awards_publications": grouped["awards_publications"].get(ident, []),
        })
    return docs


def _struct(fields: list[str]) -> pa.DataType:
    return pa.struct([(f, pa.string()) for f in fields])


def _list_of(fields: list[str]) -> pa.DataType:
    return pa.list_(_struct(fields))


def nested_schema(child_dfs: dict[str, pd.DataFrame]) -> pa.Schema:
    """Explicit schema so empty sections still get correct nested types."""
    scalars = [
        "ID", "Name", "Service", "Cadre", "Allotment_Year", "Date_of_Birth",
        "Date_of_Joining", "Source_of_Recruitment", "Gender",
        "Place_of_Domicile", "Mother_Tongue",
    ]
    return pa.schema(
        [(f, pa.string()) for f in scalars]
        + [
            ("Languages_Known", pa.list_(pa.string())),
            ("Retired", pa.string()),
            ("Retirement_Reason", pa.string()),
            ("central_deputation",
             _struct(["on_deputation", "start_date", "expiry_date", "tenure_type"])),
            ("education", _list_of(_item_fields(child_dfs["education"]))),
            ("experience", _list_of(_item_fields(child_dfs["experience"]))),
            ("training", pa.struct([
                (tkey, _list_of(_item_fields(child_dfs[ckey])))
                for ckey, tkey in TRAINING_KEYS.items()
            ])),
            ("awards_publications",
             _list_of(_item_fields(child_dfs["awards_publications"]))),
        ]
    )


def write_documents(docs: list[dict],
                    child_dfs: dict[str, pd.DataFrame],
                    target_dir: str = DATA_DIR) -> None:
    """Publish the nested per-officer documents as JSONL and nested Parquet."""
    os.makedirs(target_dir, exist_ok=True)
    rel = os.path.relpath(target_dir, ROOT)
    jsonl_path = os.path.join(target_dir, "combined.jsonl")
    with open(jsonl_path, "w", encoding="utf-8") as fh:
        for doc in docs:
            fh.write(json.dumps(doc, ensure_ascii=False) + "\n")
    print(f"  {rel}/combined.jsonl: {len(docs)} officers")

    table = pa.Table.from_pylist(docs, schema=nested_schema(child_dfs))
    pq.write_table(table, os.path.join(target_dir, "combined.parquet"))
    print(f"  {rel}/combined.parquet: {len(docs)} officers")


def main() -> None:
    os.makedirs(DATA_DIR, exist_ok=True)
    os.makedirs(PARTIAL_DIR, exist_ok=True)
    index = load_index()

    officers: list[dict] = []
    child_rows: dict[str, list[dict]] = {k: [] for k, _ in CHILD_SECTIONS.values()}
    seen_ids: set[str] = set()

    files = sorted(glob.glob(os.path.join(DETAIL_DIR, "*.html")))
    print(f"Parsing {len(files)} biodata pages ...")
    for path in files:
        file_hash = os.path.splitext(os.path.basename(path))[0]
        with open(path, encoding="utf-8") as fh:
            officer, children = parse_detail(fh.read())

        identity = officer.get("identity_no", "")
        if not identity or identity in seen_ids:
            continue
        seen_ids.add(identity)

        meta = index.get(file_hash, {})
        officer["date_of_joining"] = meta.get("date_of_joining", "")
        officers.append(officer)

        for key, columns in ((k, c) for k, c in CHILD_SECTIONS.values()):
            for values in children.get(key, []):
                child_rows[key].append(
                    {"identity_no": identity, **dict(zip(columns, values))}
                )

    officer_columns = [
        "identity_no", "name", "service", "cadre", "allotment_year",
        "date_of_birth", "gender", "place_of_domicile", "mother_tongue",
        "languages_known", "source_of_recruitment", "retirement_reason",
        "on_central_deputation", "deputation_start_date",
        "deputation_expiry_date", "deputation_tenure_type", "date_of_joining",
    ]
    officers_df = pd.DataFrame(officers).reindex(columns=officer_columns).fillna("")

    child_dfs: dict[str, pd.DataFrame] = {}
    for key, columns in ((k, c) for k, c in CHILD_SECTIONS.values()):
        df = pd.DataFrame(child_rows[key]).reindex(
            columns=["identity_no", *columns]
        ).fillna("")
        if key == "experience" and "period" in df.columns:
            split = df["period"].str.split(r"\s*-\s*", n=1, expand=True)
            df["period_from"] = split[0].fillna("") if 0 in split else ""
            df["period_to"] = split[1].fillna("") if 1 in split else ""
            df = df.drop(columns=["period"])
        child_dfs[key] = df

    # combined.* (one self-contained nested document per officer) is the
    # headline dataset in data/; every other table is a building block under
    # data/partial/.
    print("Writing data files ...")
    write_documents(build_documents(officers_df, child_dfs), child_dfs, DATA_DIR)

    print("Writing partial data files ...")
    write_outputs("officers", officer_table(officers_df), PARTIAL_DIR)
    for key in CHILD_ORDER:
        write_outputs(key, child_dfs[key], PARTIAL_DIR)

    print(f"Done. {len(officers_df)} unique officers.")


if __name__ == "__main__":
    main()
