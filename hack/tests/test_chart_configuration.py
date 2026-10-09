"""Check chart configuration contracts by rendering Helm without a cluster."""

import json
import re
import tempfile
import unittest

from test_postgresql_chart import render


class ChartConfigurationTests(unittest.TestCase):
    def manifests(self, values=None, *args):
        # JSON is also valid YAML and preserves literal credential characters.
        with tempfile.NamedTemporaryFile(mode="w", suffix=".json") as values_file:
            json.dump(values or {}, values_file)
            values_file.flush()
            result = render("-f", values_file.name, *args)
        self.assertEqual(result.returncode, 0, result.stderr)
        return result.stdout.split("---\n")

    def document(self, documents, kind, component=None):
        return next(
            doc for doc in documents
            if f"kind: {kind}\n" in doc
            and (component is None or f"app.kubernetes.io/component: {component}\n" in doc)
        )

    def database_url(self, documents):
        secret = next(doc for doc in documents if "  DATABASE_URL:" in doc)
        # Helm's quoted ASCII string is JSON-compatible; decode YAML escaping
        # before checking the connection string the application actually sees.
        return json.loads(re.search(r"(?m)^  DATABASE_URL: (.+)$", secret)[1])

    def test_service_monitor_selects_only_application_service(self):
        docs = self.manifests({"metrics": {"serviceMonitor": {"enabled": True}}})
        monitor = self.document(docs, "ServiceMonitor")
        labels = re.search(r"    matchLabels:\n((?:      .+\n)+)", monitor)[1]
        required = [line.strip() for line in labels.splitlines()]
        services = [doc for doc in docs if "kind: Service\n" in doc]
        matches = []
        for service in services:
            metadata = service.split("spec:\n", 1)[0]
            actual = {line.strip() for line in metadata.splitlines()}
            if all(label in actual for label in required):
                matches.append(service)
        self.assertEqual(len(matches), 1)
        self.assertIn("app.kubernetes.io/component: server", matches[0])
        self.assertIn("name: http", matches[0])

    def test_service_monitor_discovers_application_namespace(self):
        for monitor_ns, override in [("", ""), ("monitoring", ""), ("monitoring", "workloads")]:
            with self.subTest(monitor_namespace=monitor_ns, namespace_override=override):
                docs = self.manifests({
                    "namespaceOverride": override,
                    "metrics": {"serviceMonitor": {"enabled": True, "namespace": monitor_ns}},
                }, "--namespace", "phoenix")
                app_ns = override or "phoenix"
                monitor = self.document(docs, "ServiceMonitor")
                self.assertIn(f"  namespace: {monitor_ns or app_ns}\n", monitor)
                self.assertIn(f'  namespaceSelector:\n    matchNames:\n      - "{app_ns}"\n', monitor)
                service = self.document(docs, "Service", "server")
                self.assertIn(f"  namespace: {app_ns}\n", service)

    def test_disruption_budget_preserves_zero_and_percentage_values(self):
        cases = [
            ({}, "maxUnavailable: 1"),
            ({"maxUnavailable": 0}, "maxUnavailable: 0"),
            ({"maxUnavailable": "0%"}, "maxUnavailable: 0%"),
            ({"maxUnavailable": None}, "maxUnavailable: 1"),
            ({"minAvailable": 0}, "minAvailable: 0"),
            ({"minAvailable": 1}, "minAvailable: 1"),
            ({"minAvailable": "100%"}, "minAvailable: 100%"),
        ]
        for settings, expected in cases:
            with self.subTest(settings=settings):
                docs = self.manifests({"podDisruptionBudget": {"enabled": True, **settings}})
                pdb = self.document(docs, "PodDisruptionBudget")
                budgets = re.findall(r"(?m)^  (?:minAvailable|maxUnavailable): .+$", pdb)
                self.assertEqual(budgets, ["  " + expected])

    def test_database_credentials_are_quoted_for_both_database_modes(self):
        for bundled in [True, False]:
            for password, quoted in [("s p'a\\ss", r"'s p\'a\\ss'"), ("", "''")]:
                with self.subTest(bundled=bundled, password=password):
                    auth = {"username": "user name", "password": password, "database": "team's db"}
                    values = {"postgresql": {"enabled": bundled}}
                    if bundled:
                        values["postgresql"]["auth"] = auth
                        host = "upgrade-check-kube-phoenix-postgresql"
                        sslmode = "disable"
                    else:
                        host = "database.example"
                        values["externalDatabase"] = {"host": host, **auth}
                        sslmode = "'require'"
                    self.assertEqual(
                        self.database_url(self.manifests(values)),
                        f"host='{host}' user='user name' password={quoted} "
                        + r"dbname='team\'s db' " + f"port=5432 sslmode={sslmode}",
                    )

    def test_explicit_database_url_is_preserved(self):
        url = r"host=database.example user='user name' password='s p\'a\\ss' dbname=custom"
        docs = self.manifests({"postgresql": {"enabled": False}, "externalDatabase": {"url": url}})
        self.assertEqual(self.database_url(docs), url)

    def test_postgresql_names_fit_service_limit_and_references_match(self):
        for override in ["", "a" * 52, "a" * 53, "a" * 60, "a" * 63, "a" * 80, "a" * 51 + "-long"]:
            with self.subTest(fullname=override):
                docs = self.manifests({"fullnameOverride": override})
                service = self.document(docs, "Service", "postgresql")
                name = re.search(r"(?m)^  name: (.+)$", service)[1]
                self.assertLessEqual(len(name), 63)
                self.assertRegex(name, r"^[a-z][a-z0-9-]*-postgresql$")
                if not override:
                    self.assertEqual(name, "upgrade-check-kube-phoenix-postgresql")
                statefulset = self.document(docs, "StatefulSet")
                secret = self.document(docs, "Secret", "postgresql")
                self.assertIn(f"  name: {name}\n", statefulset)
                self.assertIn(f"  name: {name}\n", secret)
                self.assertIn(f"  serviceName: {name}\n", statefulset)
                references = re.findall(r"secretKeyRef:\n +name: (.+)", statefulset)
                self.assertEqual(references, [name] * 3)
                deployment = self.document(docs, "Deployment")
                self.assertIn(f"pg_isready -h {name} -p 5432", deployment)
                self.assertTrue(self.database_url(docs).startswith(f"host='{name}' "))


if __name__ == "__main__":
    unittest.main()
