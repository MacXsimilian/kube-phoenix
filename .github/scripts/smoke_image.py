#!/usr/bin/env python3
"""Validate the final image against a disposable database before promotion."""

import argparse
from html.parser import HTMLParser
import json
import subprocess
import time
import urllib.request
import uuid


def docker(*args):
    return subprocess.check_output(["docker", *args], text=True).strip()


def wait_healthy(container, timeout=180):
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        state = json.loads(docker("inspect", "--format", "{{json .State}}", container))
        if not state["Running"]:
            raise RuntimeError(f"{container} exited before becoming healthy")
        status = state.get("Health", {}).get("Status")
        if status == "healthy":
            return
        if status == "unhealthy":
            raise RuntimeError(f"{container} failed its healthcheck")
        time.sleep(2)
    raise RuntimeError(f"{container} did not become healthy within {timeout}s")


class StaticScripts(HTMLParser):
    def __init__(self):
        super().__init__()
        self.paths = []

    def handle_starttag(self, tag, attrs):
        src = dict(attrs).get("src", "")
        if tag == "script" and src.startswith("/_next/static/"):
            self.paths.append(src)


def fetch(base, path):
    with urllib.request.urlopen(base + path, timeout=10) as response:
        if response.status != 200:
            raise RuntimeError(f"{path} returned HTTP {response.status}")
        return response.headers.get_content_type(), response.read()


def check_http(base, expected_version):
    _, health = fetch(base, "/readyz")
    if json.loads(health).get("status") != "ok":
        raise RuntimeError("readiness endpoint did not report ok")
    _, version = fetch(base, "/api/version")
    if json.loads(version).get("version") != expected_version:
        raise RuntimeError("embedded backend version does not match the build")
    content_type, html = fetch(base, "/")
    if content_type != "text/html":
        raise RuntimeError("embedded frontend did not return HTML")
    scripts = StaticScripts()
    scripts.feed(html.decode("utf-8"))
    if not scripts.paths:
        raise RuntimeError("embedded frontend has no Next.js static scripts")
    content_type, script = fetch(base, scripts.paths[0])
    if content_type not in ("text/javascript", "application/javascript") or not script.strip():
        raise RuntimeError("embedded frontend JavaScript is missing or served as HTML")


def smoke_image(image, expected_version):
    suffix = uuid.uuid4().hex[:12]
    network = f"kp-smoke-{suffix}"
    database = f"{network}-db"
    application = f"{network}-app"
    try:
        docker("network", "create", network)
        docker(
            "run", "--detach", "--name", database, "--network", network,
            "--network-alias", "postgres", "--tmpfs", "/var/lib/postgresql",
            "--env", "POSTGRES_USER=kube_phoenix",
            "--env", "POSTGRES_PASSWORD=smoke-only",
            "--env", "POSTGRES_DB=kube_phoenix",
            "--health-cmd", "pg_isready -h 127.0.0.1 -U kube_phoenix -d kube_phoenix",
            "--health-interval", "2s", "--health-timeout", "3s",
            "--health-start-period", "60s", "--health-retries", "5",
            "postgres:18.6-alpine",
        )
        wait_healthy(database)
        docker(
            "run", "--detach", "--name", application, "--network", network,
            "--read-only", "--cap-drop", "ALL",
            "--security-opt", "no-new-privileges=true",
            "--tmpfs", "/tmp:rw,noexec,nosuid,size=16m",
            "--publish", "127.0.0.1::8080",
            "--env", "DATABASE_URL=host=postgres user=kube_phoenix password=smoke-only "
            "dbname=kube_phoenix port=5432 sslmode=disable",
            "--health-interval", "2s", "--health-start-period", "150s",
            image,
        )
        # Exercise the image's own exec-form healthcheck and non-root user.
        # Kubernetes is intentionally absent: readiness requires PostgreSQL.
        wait_healthy(application)
        ports = json.loads(docker(
            "inspect", "--format", "{{json .NetworkSettings.Ports}}", application,
        ))
        port = ports["8080/tcp"][0]["HostPort"]
        check_http(f"http://127.0.0.1:{port}", expected_version)
        print(f"Image smoke test passed: {image}")
    except Exception:
        for container in (database, application):
            subprocess.run(["docker", "logs", container], check=False)
        raise
    finally:
        subprocess.run(
            ["docker", "rm", "--force", "--volumes", application, database], check=False,
        )
        subprocess.run(["docker", "network", "rm", network], check=False)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("image")
    parser.add_argument("expected_version")
    args = parser.parse_args()
    smoke_image(args.image, args.expected_version)
