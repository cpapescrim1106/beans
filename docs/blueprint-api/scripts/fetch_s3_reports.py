#!/usr/bin/env python3
"""Download report outputs from S3 using captured S3 pointers.

Usage examples:
  python3 fetch_s3_reports.py \
    --env-file ../.env.aws \
    --capture-file ~/BlueprintRelayReports.jsonl \
    --output-dir ./report_outputs

  python3 fetch_s3_reports.py --bucket bp-temp-us --key <uuid> --env-file ../.env.aws
"""

from __future__ import annotations

import argparse
import json
import os
from pathlib import Path
from typing import Dict, Iterable, Set, Tuple

import boto3


def load_env_file(path: Path) -> None:
    if not path.exists():
        return
    for line in path.read_text().splitlines():
        raw = line.strip()
        if not raw or raw.startswith("#"):
            continue
        if "=" not in raw:
            continue
        key, value = raw.split("=", 1)
        os.environ.setdefault(key.strip(), value.strip())


def read_capture_pointers(path: Path) -> Iterable[Tuple[str, str]]:
    if not path.exists():
        return []
    pointers = []
    for line in path.read_text().splitlines():
        if not line.strip():
            continue
        try:
            payload = json.loads(line)
        except json.JSONDecodeError:
            continue
        if payload.get("type") != "s3Pointer":
            continue
        bucket = payload.get("bucket")
        key = payload.get("key")
        if bucket and key:
            pointers.append((bucket, key))
    return pointers


def ensure_parent(path: Path) -> None:
    parent = path.parent
    parent.mkdir(parents=True, exist_ok=True)


def download_objects(s3, pointers: Iterable[Tuple[str, str]], output_dir: Path) -> int:
    downloaded = 0
    seen: Set[Tuple[str, str]] = set()
    for bucket, key in pointers:
        if (bucket, key) in seen:
            continue
        seen.add((bucket, key))
        out_path = output_dir / key
        ensure_parent(out_path)
        try:
            s3.download_file(bucket, key, str(out_path))
            print(f"Downloaded s3://{bucket}/{key} -> {out_path}")
            downloaded += 1
        except Exception as exc:  # noqa: BLE001
            print(f"Failed to download s3://{bucket}/{key}: {exc}")
    return downloaded


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Fetch report outputs from S3")
    parser.add_argument("--env-file", type=Path, default=Path("../.env.aws"))
    parser.add_argument("--capture-file", type=Path)
    parser.add_argument("--output-dir", type=Path, default=Path("./report_outputs"))
    parser.add_argument("--bucket", type=str)
    parser.add_argument("--key", type=str)
    return parser


def main() -> int:
    parser = build_parser()
    args = parser.parse_args()

    load_env_file(args.env_file)

    region = os.environ.get("AWS_DEFAULT_REGION") or os.environ.get("AWS_REGION")
    if not region:
        print("AWS_DEFAULT_REGION is not set. Provide it in env or --env-file.")
        return 1

    s3 = boto3.client("s3", region_name=region)

    pointers = []
    if args.bucket and args.key:
        pointers = [(args.bucket, args.key)]
    elif args.capture_file:
        pointers = list(read_capture_pointers(args.capture_file))
    else:
        print("Provide either --bucket/--key or --capture-file.")
        return 1

    if not pointers:
        print("No S3 pointers found.")
        return 0

    output_dir = args.output_dir
    output_dir.mkdir(parents=True, exist_ok=True)

    downloaded = download_objects(s3, pointers, output_dir)
    print(f"Downloaded {downloaded} object(s).")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
