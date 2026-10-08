"""Render reliability contracts with Helm; no cluster is contacted."""
import unittest
from test_postgresql_chart import render


class ReliabilityChartTests(unittest.TestCase):
    def test_defaults_and_eviction_permission(self):
        result = render()
        self.assertEqual(result.returncode, 0, result.stderr)
        role = next(doc for doc in result.stdout.split("---\n") if "kind: ClusterRole\n" in doc)
        self.assertRegex(role, r'apiGroups: \[""\]\s+resources: \["pods/eviction"\]\s+verbs: \["create"\]')
        self.assertNotRegex(role, r'resources: \["pods"\]\s+verbs:.*"delete"')
        deployment = next(doc for doc in result.stdout.split("---\n") if "kind: Deployment\n" in doc)
        self.assertIn("replicas: 1", deployment)
        self.assertIn("type: Recreate", deployment)
        self.assertNotIn("rollingUpdate:", deployment)

    def test_unsupported_ownership_configurations_are_rejected(self):
        for setting in ["replicaCount=2", "strategy.type=RollingUpdate", "autoscaling.enabled=true", "strategy.rollingUpdate.maxSurge=1"]:
            with self.subTest(setting=setting):
                result = render("--set", setting)
                self.assertNotEqual(result.returncode, 0)

    def test_existing_application_secret_is_preserved(self):
        result = render("--set", "secret.existingSecret=operator-managed")
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn("name: operator-managed", result.stdout)
        self.assertNotRegex(result.stdout, r"(?m)^  ADMIN_PASSWORD:")


if __name__ == "__main__":
    unittest.main()
