#!/usr/bin/env python3
"""
Bing IndexNow Submitter
Submits a list of URLs to Bing via the IndexNow protocol for instant indexing.
URLs are sent in batches of 200 to avoid timeouts on large submissions.
"""
import argparse
import json
import sys
import time

import requests

# Shared IndexNow API key for all sites
INDEXNOW_KEY = "be54d4b639b44b8ca5b9cd5d5493a8e6"
BATCH_SIZE = 200


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--host", required=True, help="Website host URL (e.g. https://example.com/)")
    parser.add_argument("--urls", required=True, help="Newline-separated URLs to submit")
    args = parser.parse_args()

    host = args.host.rstrip("/")
    key_location = f"{host}/{INDEXNOW_KEY}.txt"

    url_list = [u.strip() for u in args.urls.splitlines() if u.strip()]

    if not url_list:
        print("[ERROR] No URLs provided.", flush=True)
        sys.exit(1)

    total = len(url_list)
    batches = [url_list[i:i + BATCH_SIZE] for i in range(0, total, BATCH_SIZE)]

    print(f"[INFO] Total URLs  : {total}", flush=True)
    print(f"[INFO] Total batches: {len(batches)} (up to {BATCH_SIZE} URLs each)", flush=True)
    print(f"[INFO] Host        : {host}", flush=True)
    print(f"[INFO] Key Location: {key_location}", flush=True)

    submitted = 0
    for i, batch in enumerate(batches):
        print(f"\n[INFO] Submitting batch {i + 1}/{len(batches)} ({len(batch)} URLs)...", flush=True)

        payload = {
            "host": host,
            "key": INDEXNOW_KEY,
            "keyLocation": key_location,
            "urlList": batch,
        }

        try:
            response = requests.post(
                "https://www.bing.com/indexnow",
                headers={"Content-Type": "application/json; charset=utf-8"},
                data=json.dumps(payload),
                timeout=30,
            )

            print(f"[INFO] Status Code: {response.status_code}", flush=True)
            if response.text.strip():
                print(f"[INFO] Response: {response.text.strip()}", flush=True)

            if response.status_code in (200, 202):
                submitted += len(batch)
                print(f"[INFO] Batch {i + 1} accepted. ({submitted}/{total} submitted so far)", flush=True)
            else:
                print(f"[ERROR] Batch {i + 1} failed with status {response.status_code}", flush=True)
                sys.exit(1)

        except requests.exceptions.Timeout:
            print(f"[ERROR] Batch {i + 1} timed out after 30 seconds.", flush=True)
            sys.exit(1)
        except requests.exceptions.RequestException as e:
            print(f"[ERROR] Batch {i + 1} request failed: {e}", flush=True)
            sys.exit(1)

        # Small delay between batches to avoid rate limiting
        if i < len(batches) - 1:
            time.sleep(1)

    print(f"\n[DONE] SUCCESS - {submitted} URL(s) submitted to Bing IndexNow!", flush=True)


if __name__ == "__main__":
    main()
