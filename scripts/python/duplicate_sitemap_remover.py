#!/usr/bin/env python3
"""
Duplicate Sitemap Remover
Accepts a directory of XML sitemaps, removes duplicate URLs (first occurrence wins),
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


def parse_sitemap_file(file_path: str):
    urls = []
    try:
        for _, elem in ET.iterparse(file_path, events=("end",)):
            if elem.tag.endswith("loc") and elem.text:
                urls.append(normalize_url(elem.text))
            elem.clear()
    except Exception as e:
        print(f"[WARN] Error parsing {os.path.basename(file_path)}: {e}", flush=True)
    return urls


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--sitemap_files", required=True, help="Directory containing XML sitemap files")
    parser.add_argument("--output_file", required=True, help="Path for output ZIP")
    args = parser.parse_args()

    sitemap_dir = args.sitemap_files

    if not os.path.isdir(sitemap_dir):
        print(f"[ERROR] Directory not found: {sitemap_dir}", flush=True)
        sys.exit(1)

    xml_files = [
        os.path.join(sitemap_dir, f)
        for f in os.listdir(sitemap_dir)
        if f.endswith(".xml")
    ]

    if not xml_files:
        print("[ERROR] No XML files found in the uploaded folder.", flush=True)
        sys.exit(1)

    print(f"[INFO] Found {len(xml_files)} sitemap(s)", flush=True)

    # ── Parse sitemaps ──────────────────────────────────────────────────────────
    print("[INFO] Parsing sitemaps...", flush=True)
    all_data: dict = {}

    def parse_one(path):
        return path, parse_sitemap_file(path)

    with ThreadPoolExecutor(max_workers=10) as exe:
        futures = {exe.submit(parse_one, path): path for path in xml_files}
        for i, fut in enumerate(as_completed(futures), 1):
            path, urls = fut.result()
            all_data[path] = urls
            print(f"[INFO] [{i}/{len(xml_files)}] {os.path.basename(path)} → {len(urls)} URLs", flush=True)

    # ── Build duplicate map ─────────────────────────────────────────────────────
    print("[INFO] Building duplicate map...", flush=True)
    url_map = defaultdict(set)
    for path, urls in all_data.items():
        for url in urls:
            url_map[url].add(os.path.basename(path))

    duplicates = {u: s for u, s in url_map.items() if len(s) > 1}
    print(f"[INFO] Found {len(duplicates)} duplicate URL(s) across sitemaps", flush=True)

    # ── Write output ZIP ────────────────────────────────────────────────────────
    print("[INFO] Cleaning sitemaps...", flush=True)
    seen: set = set()
    total_kept = total_removed = 0

    with zipfile.ZipFile(args.output_file, "w", zipfile.ZIP_DEFLATED) as zout:

        # Clean sitemaps
        for path, urls in all_data.items():
            basename = os.path.basename(path)
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
