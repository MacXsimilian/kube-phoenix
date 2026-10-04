import contextlib
import hashlib
import io
import json
import os
import subprocess
import sys
import tempfile
import unittest
import urllib.error
import urllib.request
from pathlib import Path

from release_images import Registry, ReleaseError, SafeRedirect, Version, promote, resolve, verify_identity


IMAGE = "ghcr.io/owner/kube-phoenix"
REVISION = "a" * 40
MANIFEST_TYPE = "application/vnd.oci.image.manifest.v1+json"
INDEX_TYPE = "application/vnd.oci.image.index.v1+json"


def document(value):
    return json.dumps(value, separators=(",", ":"), sort_keys=True).encode()


def digest(body):
    return "sha256:" + hashlib.sha256(body).hexdigest()


class Response(io.BytesIO):
    def __init__(self, body, headers=None):
        super().__init__(body)
        self.headers = headers or {}


class RegistryServer:
    """In-memory HTTP boundary; no Docker daemon or registry writes."""

    def __init__(self):
        self.tags = {}
        self.blobs = {}
        self.manifests = {}
        self.failures = {}
        self.responses = {}
        self.requests = []
        self.writes = []

    def add_image(self, tag, *, version=None, revision=None, index=True):
        labels = {}
        if version is not None:
            labels["org.opencontainers.image.version"] = version
        if revision is not None:
            labels["org.opencontainers.image.revision"] = revision
        config = document({"config": {"Labels": labels}, "created": tag})
        self.blobs[digest(config)] = config
        leaf = document({"schemaVersion": 2, "mediaType": MANIFEST_TYPE, "config": {"digest": digest(config)}, "layers": []})
        self.manifests[digest(leaf)] = leaf
        body = leaf
        if index:
            body = document({"schemaVersion": 2, "mediaType": INDEX_TYPE, "manifests": [
                {"digest": digest(leaf), "platform": {"os": "linux", "architecture": "amd64"}},
                {"digest": "sha256:" + "f" * 64, "platform": {"os": "unknown", "architecture": "unknown"}},
            ]})
        self.manifests[digest(body)] = body
        self.tags[tag] = body
        return digest(body)

    def alias(self, alias, tag):
        self.tags[alias] = self.tags[tag]

    def open(self, request, timeout):
        self.assert_request(request, timeout)
        path = request.full_url.removeprefix("https://ghcr.io/v2/owner/kube-phoenix/")
        method = request.get_method()
        self.requests.append((method, path))
        failure = self.failures.get((method, path))
        if failure:
            if isinstance(failure, Exception):
                raise failure
            raise urllib.error.HTTPError(request.full_url, failure, "fixture failure", {}, None)
        if (method, path) in self.responses:
            return Response(*self.responses[(method, path)])
        if path.startswith("manifests/"):
            reference = path.removeprefix("manifests/")
            if method == "PUT":
                self.tags[reference] = request.data
                self.writes.append((reference, request.data, request.get_header("Content-type")))
                return Response(b"", {"Docker-Content-Digest": digest(request.data)})
            body = self.tags.get(reference) or self.manifests.get(reference)
            if body is None:
                raise urllib.error.HTTPError(request.full_url, 404, "missing", {}, None)
            return Response(body, {"Docker-Content-Digest": digest(body)})
        if path.startswith("blobs/"):
            return Response(self.blobs[path.removeprefix("blobs/")])
        if path == "tags/list?n=1000":
            return Response(document({"name": "owner/kube-phoenix", "tags": sorted(self.tags)}))
        raise AssertionError(f"Unexpected fixture request: {method} {path}")

    @staticmethod
    def assert_request(request, timeout):
        if request.get_header("Authorization") != "Bearer fixture-token" or timeout != 30:
            raise AssertionError("Registry request lost authentication or its timeout")

    def client(self):
        return Registry(IMAGE, "fixture-token", opener=self)


class ReleaseImageTests(unittest.TestCase):
    def setUp(self):
        self.server = RegistryServer()

    def candidate(self, version="0.7.10", **options):
        return self.server.add_image(version, version=version, revision=REVISION, **options)

    def promote(self, version, expected_digest):
        with contextlib.redirect_stdout(io.StringIO()):
            promote(self.server.client(), Version.parse(version), expected_digest)

    def test_validate_tags_rejects_shell_text_refs_build_metadata_and_invalid_semver(self):
        script = Path(__file__).with_name("release_images.py")
        for tag in ["master", "0.7.10", "v01.2.3", "v1.2", "v1.2.3+metadata", "v1.2.3-01", "v1.2.3-a..b", "v1.2.3;echo bad", "refs/tags/v1.2.3"]:
            with self.subTest(tag=tag), tempfile.TemporaryDirectory() as directory:
                output = Path(directory) / "output"
                result = subprocess.run([sys.executable, str(script), "validate", tag], env={**os.environ, "GITHUB_OUTPUT": str(output)}, capture_output=True, text=True)
                self.assertNotEqual(result.returncode, 0)
                self.assertFalse(output.exists())
        with tempfile.TemporaryDirectory() as directory:
            output = Path(directory) / "output"
            result = subprocess.run([sys.executable, str(script), "validate", "v1.2.3-rc.1"], env={**os.environ, "GITHUB_OUTPUT": str(output)}, capture_output=True, text=True)
            self.assertEqual(result.returncode, 0, result.stderr)
            self.assertEqual(output.read_text(), "tag=v1.2.3-rc.1\nref=refs/tags/v1.2.3-rc.1\nversion=1.2.3-rc.1\n")

    def test_existing_digest_is_reused_and_attestation_children_are_ignored(self):
        expected = self.candidate()
        registry = self.server.client()
        existing = resolve(registry, Version.parse("0.7.10"), REVISION)
        self.assertEqual(existing.digest, expected)
        self.assertFalse(self.server.writes)
        self.assertFalse(any("f" * 64 in path for _, path in self.server.requests))

    def test_legacy_single_manifest_is_reusable_without_relabeling(self):
        expected = self.server.add_image("0.7.9", index=False)
        registry = self.server.client()
        existing = resolve(registry, Version.parse("0.7.9"), REVISION)
        self.assertEqual(existing.digest, expected)
        with self.assertRaises(ReleaseError):
            verify_identity(registry, existing, Version.parse("0.7.9"), REVISION, require_labels=True)
        self.assertFalse(self.server.writes)

    def test_existing_image_identity_conflicts_abort(self):
        for version, revision in [("0.7.8", REVISION), ("0.7.9", "b" * 40)]:
            with self.subTest(version=version, revision=revision):
                self.server = RegistryServer()
                self.server.add_image("0.7.9", version=version, revision=revision)
                with self.assertRaises(ReleaseError):
                    resolve(self.server.client(), Version.parse("0.7.9"), REVISION)
                self.assertFalse(self.server.writes)

    def test_only_manifest_404_allows_a_new_build(self):
        self.assertIsNone(resolve(self.server.client(), Version.parse("0.7.9"), REVISION))
        for failure in [401, 403, 429, 500, 503, urllib.error.URLError("offline"), TimeoutError()]:
            with self.subTest(failure=failure):
                self.server.failures[("GET", "manifests/0.7.9")] = failure
                with self.assertRaises(ReleaseError):
                    resolve(self.server.client(), Version.parse("0.7.9"), REVISION)

    def test_malformed_manifest_and_config_abort(self):
        self.server.tags["0.7.9"] = b"invalid json"
        with self.assertRaises(ReleaseError):
            resolve(self.server.client(), Version.parse("0.7.9"), REVISION)
        self.server = RegistryServer()
        self.server.add_image("0.7.9")
        config_digest = next(iter(self.server.blobs))
        self.server.blobs[config_digest] = b"changed content"
        with self.assertRaises(ReleaseError):
            resolve(self.server.client(), Version.parse("0.7.9"), REVISION)

    def test_index_child_response_must_match_requested_digest(self):
        self.candidate()
        root = json.loads(self.server.tags["0.7.10"])
        requested = root["manifests"][0]["digest"]
        replacement = document({"schemaVersion": 2, "mediaType": MANIFEST_TYPE, "config": {"digest": "sha256:" + "e" * 64}, "layers": []})
        self.server.manifests[requested] = replacement
        with self.assertRaisesRegex(ReleaseError, "requested digest"):
            resolve(self.server.client(), Version.parse("0.7.10"), REVISION)

    def test_numerical_version_order_and_digest_preserving_promotion(self):
        for index in [True, False]:
            with self.subTest(index=index):
                self.server = RegistryServer()
                self.server.add_image("0.7.9", index=index)
                for alias in ["0.7", "0", "latest"]:
                    self.server.alias(alias, "0.7.9")
                expected = self.candidate(index=index)
                body = self.server.tags["0.7.10"]
                self.promote("0.7.10", expected)
                self.assertEqual([alias for alias, _, _ in self.server.writes], ["0.7", "0", "latest"])
                self.assertTrue(all(written == body for _, written, _ in self.server.writes))
                self.assertTrue(all(digest(self.server.tags[alias]) == expected for alias in ["0.7", "0", "latest"]))
                self.assertTrue(all(media_type == (INDEX_TYPE if index else MANIFEST_TYPE) for _, _, media_type in self.server.writes))

    def test_old_same_minor_replay_never_regresses_aliases(self):
        self.candidate()
        for alias in ["0.7", "0", "latest"]:
            self.server.alias(alias, "0.7.10")
        older = self.server.add_image("0.7.9", version="0.7.9", revision=REVISION)
        self.promote("0.7.9", older)
        self.assertFalse(self.server.writes)

    def test_old_minor_recovery_only_promotes_its_minor_alias(self):
        self.server.add_image("0.8.1", version="0.8.1", revision=REVISION)
        for alias in ["0.8", "0", "latest"]:
            self.server.alias(alias, "0.8.1")
        expected = self.candidate()
        self.promote("0.7.10", expected)
        self.assertEqual([alias for alias, _, _ in self.server.writes], ["0.7"])

    def test_old_major_recovery_only_promotes_its_scoped_aliases(self):
        self.server.add_image("2.0.0", version="2.0.0", revision=REVISION)
        self.server.alias("latest", "2.0.0")
        expected = self.candidate("1.5.1")
        self.promote("1.5.1", expected)
        self.assertEqual([alias for alias, _, _ in self.server.writes], ["1.5", "1"])

    def test_deleted_latest_alias_does_not_allow_an_old_replay(self):
        self.candidate()
        older = self.server.add_image("0.7.9")
        self.promote("0.7.9", older)
        self.assertFalse(self.server.writes)

    def test_prerelease_never_updates_stable_aliases(self):
        expected = self.candidate("1.0.0-rc.1")
        self.promote("1.0.0-rc.1", expected)
        self.assertFalse(self.server.writes)
        self.assertNotIn(("GET", "tags/list?n=1000"), self.server.requests)

    def test_current_alias_version_still_prevents_regression_if_full_tag_was_deleted(self):
        self.candidate()
        for alias in ["0.7", "0", "latest"]:
            self.server.alias(alias, "0.7.10")
        del self.server.tags["0.7.10"]
        older = self.server.add_image("0.7.9", version="0.7.9", revision=REVISION)
        self.promote("0.7.9", older)
        self.assertFalse(self.server.writes)

    def test_unknown_legacy_alias_is_rejected_before_any_alias_is_written(self):
        self.server.add_image("unrelated")
        self.server.alias("latest", "unrelated")
        expected = self.candidate()
        with self.assertRaises(ReleaseError):
            self.promote("0.7.10", expected)
        self.assertFalse(self.server.writes)

    def test_conflicting_alias_version_and_digest_are_rejected(self):
        expected = self.candidate()
        self.server.add_image("conflict", version="0.7.10", revision=REVISION)
        self.server.alias("latest", "conflict")
        with self.assertRaises(ReleaseError):
            self.promote("0.7.10", expected)
        self.assertFalse(self.server.writes)

    def test_changed_version_tag_is_rejected_before_alias_writes(self):
        expected = self.candidate()
        with self.assertRaises(ReleaseError):
            self.promote("0.7.10", "sha256:" + "0" * 64)
        self.assertFalse(self.server.writes)
        self.assertNotEqual(expected, "sha256:" + "0" * 64)

    def test_partial_promotion_failure_can_resume_same_digest(self):
        expected = self.candidate()
        self.server.failures[("PUT", "manifests/0")] = 503
        with self.assertRaises(ReleaseError):
            self.promote("0.7.10", expected)
        self.assertEqual([alias for alias, _, _ in self.server.writes], ["0.7"])
        del self.server.failures[("PUT", "manifests/0")]
        self.promote("0.7.10", expected)
        self.assertEqual([alias for alias, _, _ in self.server.writes], ["0.7", "0", "latest"])

    def test_registry_read_failure_before_promotion_never_writes(self):
        expected = self.candidate()
        for failure in [401, 404, 503]:
            with self.subTest(failure=failure):
                self.server.failures[("GET", "tags/list?n=1000")] = failure
                with self.assertRaises(ReleaseError):
                    self.promote("0.7.10", expected)
        self.assertFalse(self.server.writes)

    def test_paginated_newer_version_prevents_old_alias_promotion(self):
        expected = self.candidate("0.7.9")
        self.candidate()
        self.server.responses[("GET", "tags/list?n=1000")] = (
            document({"name": "owner/kube-phoenix", "tags": ["0.7.9"]}),
            {"Link": '</v2/owner/kube-phoenix/tags/list?n=1000&last=0.7.9>; rel="next"'},
        )
        self.server.responses[("GET", "tags/list?n=1000&last=0.7.9")] = (
            document({"name": "owner/kube-phoenix", "tags": ["0.7.10"]}), {},
        )
        self.promote("0.7.9", expected)
        self.assertIn(("GET", "tags/list?n=1000&last=0.7.9"), self.server.requests)
        self.assertFalse(self.server.writes)

    def test_pagination_loops_and_repository_escapes_abort_without_writes(self):
        expected = self.candidate()
        for target in ["tags/list?n=1000", "/v2/other/image/tags/list?n=1000", "https://other.example/tags/list"]:
            with self.subTest(target=target):
                self.server.responses[("GET", "tags/list?n=1000")] = (
                    document({"name": "owner/kube-phoenix", "tags": ["0.7.10"]}),
                    {"Link": f'<{target}>; rel="next"'},
                )
                with self.assertRaises(ReleaseError):
                    self.promote("0.7.10", expected)
        self.assertFalse(self.server.writes)

    def test_missing_configuration_does_not_allow_rebuilding_an_existing_tag(self):
        self.candidate()
        config_digest = next(iter(self.server.blobs))
        self.server.failures[("GET", f"blobs/{config_digest}")] = 404
        with self.assertRaises(ReleaseError):
            resolve(self.server.client(), Version.parse("0.7.10"), REVISION)
        self.assertFalse(self.server.writes)

    def test_redirects_do_not_send_registry_credentials_to_blob_storage(self):
        request = urllib.request.Request("https://ghcr.io/blob", headers={"Authorization": "Bearer secret"})
        redirected = SafeRedirect().redirect_request(request, None, 302, "redirect", {}, "https://storage.example/blob")
        self.assertIsNone(redirected.get_header("Authorization"))
        with self.assertRaises(ReleaseError):
            SafeRedirect().redirect_request(request, None, 302, "redirect", {}, "http://storage.example/blob")


if __name__ == "__main__":
    unittest.main()
