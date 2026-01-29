#!/usr/bin/env python3
"""Extract S3 pointers and report responses from BlueprintRelay.log into JSONL."""

from __future__ import annotations

import argparse
import json
import re
from pathlib import Path
from typing import Dict, Iterable, List

S3_PATTERN = re.compile(r'"s3BucketName"\s*:\s*"(?P<bucket>[^"]+)"\s*,\s*"s3Key"\s*:\s*"(?P<key>[^"]+)"')
REPORT_NAME_PATTERN = re.compile(r'"reportName"\s*:\s*"(?P<name>[^"]+)"')
REPORT_XML_PATTERN = re.compile(r'"reportResultXml"\s*:\s*"(?P<xml>[^"]+)"')


def iter_lines(path: Path) -> Iterable[str]:
    if not path.exists():
        return []
    return path.read_text(errors="ignore").splitlines()


def extract_entries(lines: Iterable[str]) -> List[Dict[str, str]]:
    entries: List[Dict[str, str]] = []
    for line in lines:
        for match in S3_PATTERN.finditer(line):
            entries.append({
                "type": "s3Pointer",
                "bucket": match.group("bucket"),
                "key": match.group("key"),
            })

        if "reportName" in line or "reportResultXml" in line:
            name_match = REPORT_NAME_PATTERN.search(line)
            xml_match = REPORT_XML_PATTERN.search(line)
            if name_match or xml_match:
                entries.append({
                    "type": "reportResponse",
                    "reportName": name_match.group("name") if name_match else "",
                    "reportResultXml": xml_match.group("xml") if xml_match else "",
                })
    return entries


def write_jsonl(entries: Iterable[Dict[str, str]], out_path: Path) -> int:
    out_path.parent.mkdir(parents=True, exist_ok=True)
    count = 0
    with out_path.open("w", encoding="utf-8") as handle:
        for entry in entries:
            handle.write(json.dumps(entry) + "\n")
            count += 1
    return count


def main() -> int:
    parser = argparse.ArgumentParser(description="Extract S3 pointers from BlueprintRelay.log")
    parser.add_argument("--relay-log", type=Path, required=True)
    parser.add_argument("--out", type=Path, required=True)
    args = parser.parse_args()

    lines = iter_lines(args.relay_log)
    entries = extract_entries(lines)
    count = write_jsonl(entries, args.out)
    print(f"Wrote {count} entries to {args.out}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
