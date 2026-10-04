"""Preserve release image digests and promote stable aliases without regression."""

import argparse
import base64
import hashlib
import json
import os
import re
import sys
import urllib.error
import urllib.parse
import urllib.request
from dataclasses import dataclass


class ReleaseError(Exception):
    pass


@dataclass(frozen=True)
class Version:
    text: str
    numbers: tuple
    prerelease: str = ""

    @classmethod
    def parse(cls, text):
        match = re.fullmatch(
            r"(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)(?:-([0-9A-Za-z.-]+))?",
            text,
        )
        if not match or len(text) > 128:
            raise ReleaseError("Expected a Docker-compatible semantic version")
        prerelease = match[4] or ""
        if prerelease:
            for identifier in prerelease.split("."):
                if not re.fullmatch(r"[0-9A-Za-z-]+", identifier):
                    raise ReleaseError("Invalid semantic version prerelease")
                if identifier.isdigit() and len(identifier) > 1 and identifier[0] == "0":
                    raise ReleaseError("Numeric prerelease identifiers cannot have leading zeroes")
        return cls(text, tuple(int(match[i]) for i in (1, 2, 3)), prerelease)

    def aliases(self):
        if self.prerelease:
            return []
        major, minor, _ = self.numbers
        return [f"{major}.{minor}", str(major), "latest"]

    def matches_alias(self, alias):
        return alias in self.aliases()


class SafeRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, request, response, code, message, headers, new_url):
        if urllib.parse.urlparse(new_url).scheme != "https":
            raise ReleaseError("Registry redirected outside HTTPS")
        redirected = super().redirect_request(request, response, code, message, headers, new_url)
        if redirected and urllib.parse.urlparse(request.full_url).netloc != urllib.parse.urlparse(new_url).netloc:
            redirected.remove_header("Authorization")
        return redirected


@dataclass(frozen=True)
class Manifest:
    digest: str
    body: bytes
    media_type: str
    document: dict


class Registry:
    ACCEPT = ", ".join([
        "application/vnd.oci.image.index.v1+json",
        "application/vnd.docker.distribution.manifest.list.v2+json",
        "application/vnd.oci.image.manifest.v1+json",
        "application/vnd.docker.distribution.manifest.v2+json",
    ])

    def __init__(self, image, token, opener=None):
        if not re.fullmatch(r"ghcr\.io/[a-z0-9][a-z0-9_.-]*/kube-phoenix", image):
            raise ReleaseError("Expected this repository's GHCR image")
        self.repository = image.removeprefix("ghcr.io/")
        self.base = f"https://ghcr.io/v2/{self.repository}/"
        self.token = token
        self.opener = opener or urllib.request.build_opener(SafeRedirect())
        self.manifests = {}
        self.identities = {}

    @classmethod
    def authenticated(cls, image):
        registry = cls(image, "")
        username = os.environ["GHCR_USERNAME"]
        password = os.environ["GHCR_TOKEN"]
        credentials = base64.b64encode(f"{username}:{password}".encode()).decode()
        query = urllib.parse.urlencode({"service": "ghcr.io", "scope": f"repository:{registry.repository}:pull,push"})
        request = urllib.request.Request(f"https://ghcr.io/token?{query}", headers={"Authorization": f"Basic {credentials}"})
        try:
            with registry.opener.open(request, timeout=30) as response:
                document = json.load(response)
        except (urllib.error.URLError, TimeoutError, ValueError) as error:
            if isinstance(error, urllib.error.HTTPError):
                error.close()
            raise ReleaseError("Could not authenticate to GHCR") from error
        if not isinstance(document, dict):
            raise ReleaseError("GHCR returned an invalid token document")
        token = document.get("token") or document.get("access_token")
        if not isinstance(token, str) or not token:
            raise ReleaseError("GHCR returned no registry token")
        registry.token = token
        return registry

    def request(self, path, *, method="GET", body=None, media_type=None, missing_ok=False):
        url = urllib.parse.urljoin(self.base, path)
        if not url.startswith(self.base):
            raise ReleaseError("Registry pagination escaped the image repository")
        headers = {"Authorization": f"Bearer {self.token}", "Accept": self.ACCEPT}
        if media_type:
            headers["Content-Type"] = media_type
        request = urllib.request.Request(url, data=body, headers=headers, method=method)
        try:
            with self.opener.open(request, timeout=30) as response:
                return response.read(), response.headers
        except urllib.error.HTTPError as error:
            error.close()
            if error.code == 404 and missing_ok:
                return None
            raise ReleaseError(f"Registry {method} failed: HTTP {error.code}") from error
        except (urllib.error.URLError, TimeoutError) as error:
            raise ReleaseError(f"Registry {method} failed: network error") from error

    @staticmethod
    def document(body):
        try:
            document = json.loads(body)
        except (ValueError, UnicodeDecodeError) as error:
            raise ReleaseError("Registry returned invalid JSON") from error
        if not isinstance(document, dict):
            raise ReleaseError("Registry returned an invalid document")
        return document

    def manifest(self, reference, *, refresh=False):
        if reference in self.manifests and not refresh:
            return self.manifests[reference]
        result = self.request(f"manifests/{urllib.parse.quote(reference, safe=':')}", missing_ok=True)
        if result is None:
            return None
        body, headers = result
        digest = "sha256:" + hashlib.sha256(body).hexdigest()
        if headers.get("Docker-Content-Digest") != digest:
            raise ReleaseError("Registry manifest digest does not match its contents")
        if reference.startswith("sha256:") and reference != digest:
            raise ReleaseError("Registry manifest does not match the requested digest")
        document = self.document(body)
        media_type = document.get("mediaType")
        if document.get("schemaVersion") != 2 or media_type not in self.ACCEPT.split(", "):
            raise ReleaseError("Registry returned an unsupported manifest type")
        manifest = Manifest(digest, body, media_type, document)
        self.manifests[reference] = manifest
        return manifest

    def identity(self, manifest):
        if manifest.digest in self.identities:
            return self.identities[manifest.digest]
        document = manifest.document
        if "manifests" in document:
            entries = document["manifests"]
            if not isinstance(entries, list) or not all(isinstance(child, dict) and isinstance(child.get("platform", {}), dict) for child in entries):
                raise ReleaseError("Registry release index has invalid platform descriptors")
            children = [child for child in entries if child.get("platform", {}).get("os") == "linux" and child.get("platform", {}).get("architecture") == "amd64"]
            if len(children) != 1:
                raise ReleaseError("Expected one Linux amd64 image in the release index")
            child_digest = children[0].get("digest")
            if not isinstance(child_digest, str) or not re.fullmatch(r"sha256:[0-9a-f]{64}", child_digest):
                raise ReleaseError("Registry release index has an invalid platform digest")
            child = self.manifest(child_digest)
            if child is None or "manifests" in child.document:
                raise ReleaseError("Registry release index has an invalid platform manifest")
            document = child.document
        descriptor = document.get("config", {})
        if not isinstance(descriptor, dict):
            raise ReleaseError("Registry image has an invalid configuration descriptor")
        config_digest = descriptor.get("digest", "")
        if not isinstance(config_digest, str) or not re.fullmatch(r"sha256:[0-9a-f]{64}", config_digest):
            raise ReleaseError("Registry image has no valid configuration digest")
        body, _ = self.request(f"blobs/{config_digest}")
        if "sha256:" + hashlib.sha256(body).hexdigest() != config_digest:
            raise ReleaseError("Registry configuration digest does not match its contents")
        config = self.document(body)
        runtime_config = config.get("config", {})
        if not isinstance(runtime_config, dict):
            raise ReleaseError("Registry image configuration is invalid")
        labels = runtime_config.get("Labels")
        if labels is None:
            labels = {}
        if not isinstance(labels, dict):
            raise ReleaseError("Registry image labels are invalid")
        self.identities[manifest.digest] = labels
        return labels

    def tags(self):
        path = "tags/list?n=1000"
        tags = set()
        seen = set()
        while path:
            if path in seen:
                raise ReleaseError("Registry pagination loop")
            seen.add(path)
            body, headers = self.request(path)
            document = self.document(body)
            if document.get("name") != self.repository or "tags" not in document:
                raise ReleaseError("Registry returned an invalid tag listing")
            page = document.get("tags")
            if page is not None and (not isinstance(page, list) or not all(isinstance(tag, str) for tag in page)):
                raise ReleaseError("Registry returned an invalid tag list")
            tags.update(page or [])
            link = headers.get("Link", "")
            if link:
                match = re.fullmatch(r'<([^>]+)>;\s*rel="next"', link)
                if not match:
                    raise ReleaseError("Registry returned unsupported pagination")
                path = match[1]
            else:
                path = ""
        return tags

    def put_alias(self, alias, manifest):
        self.request(f"manifests/{alias}", method="PUT", body=manifest.body, media_type=manifest.media_type)
        published = self.manifest(alias, refresh=True)
        if published is None or published.digest != manifest.digest:
            raise ReleaseError(f"Promoted alias {alias} does not resolve to the signed digest")


def verify_identity(registry, manifest, version, revision, *, require_labels=False):
    labels = registry.identity(manifest)
    for key, expected in [("org.opencontainers.image.version", version.text), ("org.opencontainers.image.revision", revision)]:
        actual = labels.get(key)
        if key in labels and actual != expected:
            raise ReleaseError(f"Existing image {key} conflicts with the checked-out release")
        if key not in labels and require_labels:
            raise ReleaseError(f"Built image is missing {key}")


def resolve(registry, version, revision):
    manifest = registry.manifest(version.text)
    if manifest:
        verify_identity(registry, manifest, version, revision)
    return manifest


def promotion_plan(registry, version, manifest):
    if version.prerelease:
        return []
    published = {version.text: version}
    for tag in registry.tags():
        try:
            tagged_version = Version.parse(tag)
        except ReleaseError:
            continue
        if not tagged_version.prerelease:
            published[tag] = tagged_version
    plan = []
    for alias in version.aliases():
        scoped = {tag: candidate for tag, candidate in published.items() if candidate.matches_alias(alias)}
        if max(candidate.numbers for candidate in scoped.values()) > version.numbers:
            continue
        current = registry.manifest(alias)
        if current is None:
            plan.append(alias)
            continue
        if current.digest == manifest.digest:
            continue
        labels = registry.identity(current)
        label_version = labels.get("org.opencontainers.image.version")
        if "org.opencontainers.image.version" in labels:
            try:
                previous = Version.parse(label_version)
            except (ReleaseError, TypeError) as error:
                raise ReleaseError(f"Alias {alias} has an invalid version label") from error
            if not previous.matches_alias(alias):
                raise ReleaseError(f"Alias {alias} has a conflicting version label")
        else:
            matching = [candidate for tag, candidate in scoped.items() if (tagged := registry.manifest(tag)) and tagged.digest == current.digest]
            if not matching:
                raise ReleaseError(f"Cannot determine the existing version of alias {alias}; refusing to overwrite it")
            previous = max(matching, key=lambda candidate: candidate.numbers)
        if previous.numbers < version.numbers:
            plan.append(alias)
        elif previous.numbers == version.numbers:
            raise ReleaseError(f"Alias {alias} has a different digest for the same immutable version")
    return plan


def promote(registry, version, digest):
    manifest = registry.manifest(version.text)
    if manifest is None or manifest.digest != digest:
        raise ReleaseError("The version tag no longer resolves to the signed digest")
    plan = promotion_plan(registry, version, manifest)
    for alias in plan:
        registry.put_alias(alias, manifest)
        print(f"Promoted {alias} to {version.text} ({manifest.digest})")
    if not plan:
        print("No stable aliases require promotion")


def outputs(values):
    with open(os.environ["GITHUB_OUTPUT"], "a", encoding="utf-8") as target:
        for key, value in values.items():
            target.write(f"{key}={value}\n")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    commands = parser.add_subparsers(dest="command", required=True)
    validate = commands.add_parser("validate")
    validate.add_argument("tag")
    for name in ("resolve", "verify", "promote"):
        command = commands.add_parser(name)
        command.add_argument("image")
        command.add_argument("version")
        if name != "promote":
            command.add_argument("revision")
        if name != "resolve":
            command.add_argument("digest")
        if name == "verify":
            command.add_argument("--allow-legacy", action="store_true")
    args = parser.parse_args()
    if args.command == "validate":
        if not args.tag.startswith("v"):
            raise ReleaseError("Release tags must use canonical vMAJOR.MINOR.PATCH syntax")
        version = Version.parse(args.tag[1:])
        outputs({"tag": args.tag, "ref": f"refs/tags/{args.tag}", "version": version.text})
        return
    version = Version.parse(args.version)
    if args.command != "promote" and not re.fullmatch(r"[0-9a-f]{40}", args.revision):
        raise ReleaseError("Expected the full checked-out Git commit")
    if args.command != "resolve" and not re.fullmatch(r"sha256:[0-9a-f]{64}", args.digest):
        raise ReleaseError("Expected the immutable release digest")
    registry = Registry.authenticated(args.image)
    if args.command == "resolve":
        manifest = resolve(registry, version, args.revision)
        outputs({"exists": "true" if manifest else "false", "digest": manifest.digest if manifest else ""})
        if manifest:
            print(f"Reusing published {version.text} ({manifest.digest})")
    elif args.command == "verify":
        manifest = registry.manifest(version.text)
        if manifest is None or manifest.digest != args.digest:
            raise ReleaseError("Version tag does not resolve to the release digest")
        verify_identity(registry, manifest, version, args.revision, require_labels=not args.allow_legacy)
        outputs({"digest": manifest.digest})
    else:
        promote(registry, version, args.digest)


if __name__ == "__main__":
    try:
        main()
    except (ReleaseError, KeyError) as error:
        print(f"::error::{error}", file=sys.stderr)
        sys.exit(1)
