import json
import subprocess
import unittest
from unittest.mock import patch

import smoke_image


class HealthTests(unittest.TestCase):
    def test_waits_for_startup(self):
        states = [
            {"Running": True, "Health": {"Status": "starting"}},
            {"Running": True, "Health": {"Status": "healthy"}},
        ]
        with patch.object(smoke_image, "docker", side_effect=map(json.dumps, states)), \
                patch.object(smoke_image.time, "sleep"):
            smoke_image.wait_healthy("app")

    def test_failed_containers_are_rejected(self):
        for state in (
            {"Running": False, "Health": {"Status": "healthy"}},
            {"Running": True, "Health": {"Status": "unhealthy"}},
        ):
            with self.subTest(state=state), \
                    patch.object(smoke_image, "docker", return_value=json.dumps(state)):
                with self.assertRaises(RuntimeError):
                    smoke_image.wait_healthy("app")

    def test_missing_healthcheck_times_out(self):
        with patch.object(smoke_image, "docker", return_value='{"Running": true}'), \
                patch.object(smoke_image.time, "monotonic", side_effect=[0, 1, 181]), \
                patch.object(smoke_image.time, "sleep"):
            with self.assertRaisesRegex(RuntimeError, "within 180s"):
                smoke_image.wait_healthy("app")


class HTTPTests(unittest.TestCase):
    def setUp(self):
        self.responses = {
            "/readyz": ("application/json", b'{"status":"ok"}'),
            "/api/version": ("application/json", b'{"version":"v1.2.3"}'),
            "/": ("text/html", b'<html><script src="/_next/static/app.js"></script></html>'),
            "/_next/static/app.js": ("text/javascript", b'console.log("loaded")'),
        }

    def check(self):
        with patch.object(smoke_image, "fetch", side_effect=lambda base, path: self.responses[path]):
            smoke_image.check_http("http://127.0.0.1:8080", "v1.2.3")

    def test_healthy_application(self):
        self.check()

    def test_wrong_version(self):
        self.responses["/api/version"] = ("application/json", b'{"version":"dev"}')
        with self.assertRaisesRegex(RuntimeError, "version"):
            self.check()

    def test_failed_readiness(self):
        self.responses["/readyz"] = ("application/json", b'{"status":"error"}')
        with self.assertRaisesRegex(RuntimeError, "readiness"):
            self.check()

    def test_missing_frontend(self):
        self.responses["/"] = ("text/html", b"<html>placeholder</html>")
        with self.assertRaisesRegex(RuntimeError, "no Next.js"):
            self.check()

    def test_asset_fallback_is_not_a_success(self):
        self.responses["/_next/static/app.js"] = self.responses["/"]
        with self.assertRaisesRegex(RuntimeError, "JavaScript"):
            self.check()

    def test_empty_asset_is_not_a_success(self):
        self.responses["/_next/static/app.js"] = ("text/javascript", b"")
        with self.assertRaisesRegex(RuntimeError, "JavaScript"):
            self.check()


class CleanupTests(unittest.TestCase):
    def test_failures_propagate_and_cleanup_runs(self):
        for failure_step in ("docker", "wait_healthy", "check_http"):
            with self.subTest(step=failure_step), \
                    patch.object(smoke_image, "docker") as docker, \
                    patch.object(smoke_image, "wait_healthy") as health, \
                    patch.object(smoke_image, "check_http") as http, \
                    patch.object(smoke_image.subprocess, "run") as cleanup:
                docker.return_value = '{"8080/tcp":[{"HostPort":"12345"}]}'
                failure = subprocess.CalledProcessError(1, "docker")
                {"docker": docker, "wait_healthy": health, "check_http": http}[failure_step].side_effect = failure
                with self.assertRaises(subprocess.CalledProcessError):
                    smoke_image.smoke_image("image@sha256:example", "v1.2.3")
                commands = [call.args[0] for call in cleanup.call_args_list]
                self.assertEqual(commands[-2][:4], ["docker", "rm", "--force", "--volumes"])
                self.assertEqual(commands[-1][:3], ["docker", "network", "rm"])
                self.assertEqual(sum(cmd[1] == "logs" for cmd in commands), 2)


if __name__ == "__main__":
    unittest.main()
