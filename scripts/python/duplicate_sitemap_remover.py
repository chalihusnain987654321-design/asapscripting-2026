#!/usr/bin/env python3
"""
Duplicate Sitemap Remover
Accepts a ZIP of XML sitemaps, removes duplicate URLs (first occurrence wins),
and outputs a ZIP containing clean sitemaps + a duplicates report CSV.
"""
import argparse
import csv
import io
import os
import sys
import xml.etree.ElementTree as ET
import zipfile
from collections import defaultdict
from concurrent.futures import ThreadPoolExecutor, as_completed
from urllib.parse import urlparse, urlunparse


def normalize_url(url):
    try:
        parsed = urlparse(url.strip())
        clean = parsed._replace(
            scheme=parsed.scheme.lower(),
            netloc=parsed.netloc.lower(),
            path=parsed.path.rstrip("/"),
            query="",
            fragment=""
        )
        return urlunparse(clean)
    except Exception:
        return url.strip()


def parse_sitemap_bytes(data: bytes, filename: str):
    urls = []
    try:
        for _, elem in ET.iterparse(io.BytesIO(data), events=("end",)):
            if elem.tag.endswith("loc") and elem.text:
                urls.append(normalize_url(elem.text))
            elem.clear()
    except Exception as e:
        print(f"[WARN] Error parsing {filename}: {e}", flush=True)
    return urls


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--zip_file", required=True, help="Path to input ZIP of XML sitemaps")
    parser.add_argument("--output_file", required=True, help="Path for output ZIP")
    args = parser.parse_args()

    if not os.path.exists(args.zip_file):
        print(f"[ERROR] ZIP file not found: {args.zip_file}", flush=True)
        sys.exit(1)

    # ── Read input ZIP ──────────────────────────────────────────────────────────
    with zipfile.ZipFile(args.zip_file, "r") as zin:
        xml_names = [
            f for f in zin.namelist()
            if f.endswith(".xml") and not os.path.basename(f).startswith(".")
            and not f.startswith("__MACOSX")
        ]
        if not xml_names:
            print("[ERROR] No XML files found in the uploaded ZIP.", flush=True)
            sys.exit(1)

        print(f"[INFO] Found {len(xml_names)} sitemap(s) in ZIP", flush=True)
        sitemap_bytes = {name: zin.read(name) for name in xml_names}

    # ── Parse sitemaps ──────────────────────────────────────────────────────────
    print("[INFO] Parsing sitemaps...", flush=True)
    all_data: dict[str, list[str]] = {}

    def parse_one(name):
        return name, parse_sitemap_bytes(sitemap_bytes[name], name)

    with ThreadPoolExecutor(max_workers=10) as exe:
        futures = {exe.submit(parse_one, name): name for name in xml_names}
        for i, fut in enumerate(as_completed(futures), 1):
            name, urls = fut.result()
            all_data[name] = urls
            basename = os.path.basename(name)
            print(f"[INFO] [{i}/{len(xml_names)}] {basename} → {len(urls)} URLs", flush=True)

    # ── Build duplicate map ─────────────────────────────────────────────────────
    print("[INFO] Building duplicate map...", flush=True)
    url_map: dict[str, set] = defaultdict(set)
    for name, urls in all_data.items():
        for url in urls:
            url_map[url].add(os.path.basename(name))

    duplicates = {u: s for u, s in url_map.items() if len(s) > 1}
    print(f"[INFO] Found {len(duplicates)} duplicate URL(s) across sitemaps", flush=True)

    # ── Write output ZIP ────────────────────────────────────────────────────────
    print("[INFO] Cleaning sitemaps...", flush=True)
    seen: set[str] = set()
    total_kept = total_removed = 0

    with zipfile.ZipFile(args.output_file, "w", zipfile.ZIP_DEFLATED) as zout:

        # Clean sitemaps
        for name, urls in all_data.items():
            basename = os.path.basename(name)
            root = ET.Element("urlset")
            root.set("xmlns", "http://www.sitemaps.org/schemas/sitemap/0.9")
            kept = removed = 0

            for url in urls:
                if url in seen:
                    removed += 1
                    continue
                seen.add(url)
                u = ET.SubElement(root, "url")
                ET.SubElement(u, "loc").text = url
                kept += 1

            xml_bytes = ET.tostring(root, encoding="utf-8", xml_declaration=True)
            zout.writestr(f"clean_sitemaps/{basename}", xml_bytes)
            total_kept += kept
            total_removed += removed
            print(f"[INFO] {basename} → kept: {kept}, removed: {removed}", flush=True)

        # Duplicates CSV (batched at 50,000 rows per file)
        if duplicates:
            batch_size = 50000
            items = list(duplicates.items())
            for batch_idx in range(0, len(items), batch_size):
                chunk = items[batch_idx:batch_idx + batch_size]
                file_num = (batch_idx // batch_size) + 1
                buf = io.StringIO()
                writer = csv.writer(buf)
                writer.writerow(["URL", "Duplicate Count", "Sitemaps"])
                for url, sitemaps in chunk:
                    writer.writerow([url, len(sitemaps), ", ".join(sorted(sitemaps))])
                zout.writestr(
                    f"duplicates/duplicates_{file_num}.csv",
                    buf.getvalue().encode("utf-8")
                )
                print(f"[INFO] Duplicates batch {file_num} written ({len(chunk)} rows)", flush=True)
        else:
            print("[INFO] No duplicates found — skipping duplicates CSV", flush=True)

    print(f"\n[INFO] Total URLs kept  : {total_kept}", flush=True)
    print(f"[INFO] Total URLs removed: {total_removed}", flush=True)
    print("[DONE] Output ZIP ready. Contains clean_sitemaps/ + duplicates/", flush=True)


if __name__ == "__main__":
    main()
