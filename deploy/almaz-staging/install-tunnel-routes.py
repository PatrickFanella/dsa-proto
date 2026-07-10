#!/usr/bin/env python3
import os
import shutil
import sys
import tempfile
from pathlib import Path

HOSTNAMES = (
    "pds-staging.dsaslate.us",
    "api-staging.dsaslate.us",
    "app-staging.dsaslate.us",
)
LEGACY_HOSTNAMES = (
    "pds.staging.dsaslate.us",
    "*.pds.staging.dsaslate.us",
    "api.staging.dsaslate.us",
    "app.staging.dsaslate.us",
)


def main() -> int:
    if len(sys.argv) != 2:
        raise SystemExit("usage: install-tunnel-routes.py /path/to/cloudflared/config.yml")
    path = Path(sys.argv[1])
    text = path.read_text()
    for hostname in LEGACY_HOSTNAMES:
        text = text.replace(f'  - hostname: "{hostname}"\n    service: http://caddy:80\n', "")
        text = text.replace(f'  - hostname: {hostname}\n    service: http://caddy:80\n', "")
    missing = [hostname for hostname in HOSTNAMES if f'hostname: {hostname}' not in text and f'hostname: "{hostname}"' not in text]
    original = path.read_text()
    if not missing and text == original:
        print("DSA Slate tunnel routes already present")
        return 0
    marker = "  - service: http_status:404"
    if marker not in text:
        raise SystemExit("cloudflared catch-all route was not found; refusing to edit")
    routes = "".join(f'  - hostname: "{hostname}"\n    service: http://caddy:80\n' for hostname in missing)
    updated = text.replace(marker, routes + marker, 1)
    with tempfile.NamedTemporaryFile("w", dir=path.parent, delete=False) as handle:
        handle.write(updated)
        temp_path = Path(handle.name)
    shutil.copymode(path, temp_path)
    os.replace(temp_path, path)
    print(f"installed {len(missing)} DSA Slate tunnel routes")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
