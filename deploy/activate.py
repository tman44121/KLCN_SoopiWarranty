"""Activate a verified release on the Ubuntu VPS; preserve the previous release on failure."""

import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import sys
import time
from urllib.parse import urlsplit
from urllib.request import Request, urlopen
from uuid import uuid4

ROOT = Path("/opt/soopi")
# Newest releases kept on disk (current + rollback targets); v* tagged releases are always kept.
KEEP_RELEASES = 3
RELEASE_ID = re.compile(r"(?:[0-9a-f]{40}-[0-9]+-[0-9]+|v(?:0|[1-9][0-9]*)\.(?:0|[1-9][0-9]*)\.(?:0|[1-9][0-9]*)-[0-9a-f]{40}-[0-9]+-[0-9]+)")


def previous_release():
    current = ROOT / "current"
    if not current.is_symlink():
        if current.exists():
            raise ValueError("current must be a symlink, not a directory")
        return None
    previous = current.resolve(strict=True)
    if previous.parent != (ROOT / "releases").resolve():
        raise ValueError("current points outside the releases directory")
    return previous


def switch_current(release):
    temporary = ROOT / (".current-" + uuid4().hex)
    try:
        temporary.symlink_to(release, target_is_directory=True)
        os.replace(temporary, ROOT / "current")
    finally:
        temporary.unlink(missing_ok=True)


def load_image(release_id, archive):
    subprocess.run(["/usr/bin/docker", "image", "load", "--input", str(archive)], check=True, timeout=180)
    subprocess.run(["/usr/bin/docker", "image", "inspect", "soopi:" + release_id,
                    "--format", "{{.Id}}"], check=True, timeout=15)


def service(action):
    release_id = (ROOT / "current").resolve(strict=True).name
    command = ["/usr/bin/docker", "compose", "--env-file", "/etc/soopi/compose.env",
               "-f", "/etc/soopi/compose.yml"]
    command += ["up", "-d", "--no-deps", "--force-recreate", "app"] if action == "restart" else ["stop", "app"]
    subprocess.run(command, check=True, timeout=60, env={**os.environ, "SOOPI_RELEASE": release_id})


def healthy(url, host=None):
    try:
        request = Request(url, headers={"Host": host} if host else {})
        with urlopen(request, timeout=3) as response:
            body = json.load(response)
            return response.status == 200 and isinstance(body, dict) and body.get("status") == "UP"
    except (OSError, ValueError):
        return False


def wait_healthy(public_url):
    host = urlsplit(public_url).netloc
    for _ in range(15):
        if healthy("http://127.0.0.1:5080/actuator/health", host) and healthy(public_url + "/actuator/health"):
            return True
        time.sleep(2)
    return False


def prune_releases(keep, current, previous=None):
    """Delete old release folders and their images; current, previous and v* releases stay."""
    releases = ROOT / "releases"
    candidates = sorted((path for path in releases.iterdir()
                         if path.is_dir() and not path.is_symlink() and RELEASE_ID.fullmatch(path.name)),
                        key=lambda path: path.stat().st_mtime, reverse=True)
    kept = {path.name for path in candidates[:keep]} | {current.name} | ({previous.name} if previous else set())
    for path in candidates:
        if path.name in kept or path.name.startswith("v"):
            continue
        shutil.rmtree(path)
        # An image still used by a container cannot be removed; that is fine.
        subprocess.run(["/usr/bin/docker", "image", "rm", "soopi:" + path.name],
                       check=False, timeout=60, capture_output=True)
        print("Removed old release: " + path.name)


def activate(release_id, public_url):
    if not RELEASE_ID.fullmatch(release_id):
        raise ValueError("invalid release ID")
    if not re.fullmatch(r"https://[a-zA-Z0-9][a-zA-Z0-9.-]*", public_url):
        raise ValueError("public URL must be an HTTPS origin without a trailing slash")
    release = ROOT / "releases" / release_id
    if release.is_symlink() or release.resolve().parent != (ROOT / "releases").resolve():
        raise ValueError("release points outside the releases directory")
    archive = release / "soopi-image.tar.gz"
    if not archive.is_file() or archive.is_symlink():
        raise ValueError("release must contain a Docker image archive")
    previous = previous_release()
    load_image(release_id, archive)
    switch_current(release)
    try:
        service("restart")
        if not wait_healthy(public_url):
            raise RuntimeError("health checks failed")
    except (OSError, subprocess.SubprocessError, RuntimeError) as error:
        if previous is None:
            service("stop")
            (ROOT / "current").unlink(missing_ok=True)
            raise RuntimeError("first deployment failed; service stopped") from error
        switch_current(previous)
        service("restart")
        if not wait_healthy(public_url):
            raise RuntimeError("deployment failed; previous release also failed its health checks") from error
        raise RuntimeError("deployment failed; previous release restored") from error
    print("Release is healthy: " + release_id)
    try:
        prune_releases(KEEP_RELEASES, release, previous)
    except (OSError, subprocess.SubprocessError) as error:
        print("Warning: could not prune old releases: " + str(error))


if __name__ == "__main__":
    import fcntl

    if len(sys.argv) != 3:
        sys.exit("Usage: python3 activate.py <release-id> <https://domain>")
    with (ROOT / ".deploy.lock").open("a") as lock:
        fcntl.flock(lock, fcntl.LOCK_EX)
        activate(sys.argv[1], sys.argv[2])
