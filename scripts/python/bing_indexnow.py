#!/usr/bin/env python3
"""
Bing IndexNow Submitter
Submits a list of URLs to Bing via the IndexNow protocol for instant indexing.
"""
import argparse
import json
import sys

import requests


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--host", required=True, help="Website host URL (e.g. https://example.com/)")
    parser.add_argument("--key", required=True, help="IndexNow API key")
    parser.add_argument("--key_location", required=True, help="Public URL of the key file")
    parser.add_argument("--urls", required=True, help="Newline-separated URLs to submit")
    args = parser.parse_args()

    url_list = [u.strip() for u in args.urls.splitlines() if u.strip()]

    if not url_list:
        print("[ERROR] No URLs provided.", flush=True)
        sys.exit(1)

    print(f"[INFO] Total URLs to submit: {len(url_list)}", flush=True)
    print(f"[INFO] Host: {args.host}", flush=True)
    print(f"[INFO] Key Location: {args.key_location}", flush=True)
    print("[INFO] Sending request to Bing IndexNow...", flush=True)

    payload = {
        "host": args.host.rstrip("/"),
        "key": args.key,
        "keyLocation": args.key_location,
        "urlList": url_list,
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
            print(f"\n[DONE] SUCCESS - {len(url_list)} URL(s) submitted to Bing IndexNow!", flush=True)
        else:
            print(f"\n[ERROR] Submission failed. Status: {response.status_code}", flush=True)
            sys.exit(1)

    except requests.exceptions.Timeout:
        print("[ERROR] Request timed out after 30 seconds.", flush=True)
        sys.exit(1)
    except requests.exceptions.RequestException as e:
        print(f"[ERROR] Request failed: {e}", flush=True)
        sys.exit(1)


if __name__ == "__main__":
    main()
