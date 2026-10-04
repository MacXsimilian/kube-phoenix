"""Check database volume selection and execute the rendered upgrade guard."""

import os
from pathlib import Path
import re
import subprocess
import tempfile
import textwrap
import unittest


CHART = Path(__file__).resolve().parents[2] / "helm/kube-phoenix"


def render(*settings):
    return subprocess.run(
        ["helm", "template", "upgrade-check", str(CHART), *settings],
        capture_output=True,
        text=True,
        check=False,
    )


class PostgreSQLChartTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        result = render()
        if result.returncode:
            raise RuntimeError(result.stderr)
        cls.manifests = result.stdout
        cls.postgresql = next(
            document
            for document in cls.manifests.split("---\n")
            if "kind: StatefulSet\n" in document
            and "app.kubernetes.io/component: postgresql\n" in document
        )
        blocks = re.findall(
            r"(?m)^( +)- \|\n((?:\1  .*\n)+)", cls.postgresql
        )
        if len(blocks) != 1:
            raise RuntimeError("Expected one rendered PostgreSQL init script")
        cls.guard = textwrap.dedent(blocks[0][1])

    def test_default_storage_uses_postgresql_18_layout(self):
        self.assertEqual(self.postgresql.count('image: "postgres:18.6-alpine"'), 2)
        self.assertEqual(
            self.postgresql.count("mountPath: /var/lib/postgresql\n"), 2
        )
        self.assertEqual(
            self.postgresql.count("value: /var/lib/postgresql/18/docker\n"), 2
        )
        self.assertIn("volumeClaimTemplates:\n", self.postgresql)
        self.assertIn("runAsNonRoot: true\n", self.postgresql)
        self.assertNotIn("mountPath: /var/lib/postgresql/data\n", self.postgresql)

    def test_existing_claim_is_used_without_creating_another_claim(self):
        result = render(
            "--set-string", "postgresql.persistence.existingClaim=migration-pg18"
        )
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn('claimName: "migration-pg18"', result.stdout)
        self.assertNotIn("volumeClaimTemplates:\n", result.stdout)

    def test_ephemeral_database_uses_empty_dir(self):
        result = render("--set", "postgresql.persistence.enabled=false")
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn("- name: data\n          emptyDir: {}", result.stdout)
        self.assertNotIn("volumeClaimTemplates:\n", result.stdout)

    def test_existing_claim_requires_persistence(self):
        result = render(
            "--set", "postgresql.persistence.enabled=false",
            "--set-string", "postgresql.persistence.existingClaim=migration-pg18",
        )
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("schema", result.stderr.lower())

    def test_maintenance_can_keep_application_stopped(self):
        result = render("--set", "replicaCount=0")
        self.assertEqual(result.returncode, 0, result.stderr)
        application = next(
            document for document in result.stdout.split("---\n")
            if "kind: Deployment\n" in document
        )
        self.assertIn("replicas: 0\n", application)
        self.assertIn("replicas: 1\n", self.postgresql)

    def test_external_database_does_not_create_bundled_storage(self):
        result = render(
            "--set", "postgresql.enabled=false",
            "--set-string", "externalDatabase.host=database.example",
        )
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertNotIn("kind: StatefulSet\n", result.stdout)

    def execute_guard(self, base):
        return subprocess.run(
            ["sh", "-ec", self.guard.replace("/var/lib/postgresql", str(base))],
            env={**os.environ, "PGDATA": str(base / "18/docker")},
            capture_output=True,
            text=True,
            check=False,
        )

    def test_fresh_volume_creates_restricted_data_directory(self):
        with tempfile.TemporaryDirectory(prefix="kp-pg-upgrade-") as temporary:
            base = Path(temporary)
            result = self.execute_guard(base)
            self.assertEqual(result.returncode, 0, result.stderr)
            self.assertEqual((base / "18/docker").stat().st_mode & 0o777, 0o700)

    def test_legacy_volumes_fail_before_creating_new_database(self):
        for location in (".", "pgdata", "data", "data/pgdata", "17/docker"):
            with self.subTest(location=location):
                with tempfile.TemporaryDirectory(prefix="kp-pg-upgrade-") as temporary:
                    base = Path(temporary)
                    legacy = base / location
                    legacy.mkdir(parents=True, exist_ok=True)
                    version = legacy / "PG_VERSION"
                    version.write_text("17\n")
                    sentinel = legacy / "preserved-data"
                    sentinel.write_bytes(b"original database contents")
                    result = self.execute_guard(base)
                    self.assertNotEqual(result.returncode, 0)
                    self.assertIn("migrate", result.stderr)
                    self.assertFalse((base / "18").exists())
                    self.assertEqual(version.read_text(), "17\n")
                    self.assertEqual(sentinel.read_bytes(), b"original database contents")

    def test_postgresql_18_volume_can_restart(self):
        with tempfile.TemporaryDirectory(prefix="kp-pg-upgrade-") as temporary:
            base = Path(temporary)
            data = base / "18/docker"
            data.mkdir(parents=True)
            (data / "PG_VERSION").write_text("18\n")
            result = self.execute_guard(base)
            self.assertEqual(result.returncode, 0, result.stderr)
            self.assertEqual((data / "PG_VERSION").read_text(), "18\n")

    def test_incompatible_target_directory_fails(self):
        with tempfile.TemporaryDirectory(prefix="kp-pg-upgrade-") as temporary:
            base = Path(temporary)
            data = base / "18/docker"
            data.mkdir(parents=True)
            (data / "PG_VERSION").write_text("17\n")
            result = self.execute_guard(base)
            self.assertNotEqual(result.returncode, 0)
            self.assertIn("incompatible", result.stderr)
            self.assertEqual((data / "PG_VERSION").read_text(), "17\n")


if __name__ == "__main__":
    unittest.main()
