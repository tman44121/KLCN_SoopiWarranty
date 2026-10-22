import importlib.util
from io import BytesIO
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location("activate", Path(__file__).with_name("activate.py"))
deploy = importlib.util.module_from_spec(spec)
spec.loader.exec_module(deploy)


class ActivationTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.release_id = "a" * 40 + "-12-1"
        self.release = self.root / "releases" / self.release_id
        self.release.mkdir(parents=True)
        (self.release / "soopi-image.tar.gz").touch()
        self.active = None
        root = patch.object(deploy, "ROOT", self.root)
        root.start()
        self.addCleanup(root.stop)
        image = patch.object(deploy, "load_image")
        self.load_image = image.start()
        self.addCleanup(image.stop)

    def switch(self, target):
        self.active = target

    def test_rejects_invalid_release_before_touching_service(self):
        with patch.object(deploy, "service") as service:
            with self.assertRaises(ValueError):
                deploy.activate("../../etc", "https://example.com")
            service.assert_not_called()

    def test_accepts_semver_release_with_commit_and_run_identity(self):
        release_id = "v1.2.3-" + "a" * 40 + "-12-1"
        release = self.root / "releases" / release_id
        release.mkdir()
        (release / "soopi-image.tar.gz").touch()
        with patch.object(deploy, "previous_release", return_value=None), \
             patch.object(deploy, "switch_current", side_effect=self.switch), \
             patch.object(deploy, "service"), \
             patch.object(deploy, "wait_healthy", return_value=True):
            deploy.activate(release_id, "https://example.com")
        self.assertEqual(self.active, release)

    def test_rejects_non_semver_release_prefix(self):
        release_id = "release-1.2.3-" + "a" * 40 + "-12-1"
        with patch.object(deploy, "service") as service:
            with self.assertRaises(ValueError):
                deploy.activate(release_id, "https://example.com")
            service.assert_not_called()

    def test_rejects_package_without_image(self):
        (self.release / "soopi-image.tar.gz").unlink()
        with patch.object(deploy, "service") as service:
            with self.assertRaises(ValueError):
                deploy.activate(self.release_id, "https://example.com")
            service.assert_not_called()

    def test_image_load_failure_does_not_touch_current_or_service(self):
        self.load_image.side_effect = OSError("invalid image archive")
        with patch.object(deploy, "previous_release", return_value=None), \
             patch.object(deploy, "switch_current") as switch, \
             patch.object(deploy, "service") as service:
            with self.assertRaises(OSError):
                deploy.activate(self.release_id, "https://example.com")
            switch.assert_not_called()
            service.assert_not_called()

    def test_rejects_http_origin(self):
        with patch.object(deploy, "service") as service:
            with self.assertRaises(ValueError):
                deploy.activate(self.release_id, "http://example.com")
            service.assert_not_called()

    def test_health_requires_successful_up_json(self):
        for body, status, expected in [(b'{"status":"UP"}', 200, True),
                                       (b'{"status":"DOWN"}', 200, False),
                                       (b'{"status":"UP"}', 503, False),
                                       (b'[]', 200, False), (b'<html>error</html>', 200, False)]:
            with self.subTest(body=body, status=status):
                response = BytesIO(body)
                response.status = status
                with patch.object(deploy, "urlopen", return_value=response):
                    self.assertEqual(deploy.healthy("https://example.com/actuator/health"), expected)

    def test_local_health_probe_uses_public_host(self):
        response = BytesIO(b'{"status":"UP"}')
        response.status = 200
        with patch.object(deploy, "urlopen", return_value=response) as urlopen:
            self.assertTrue(deploy.healthy("http://127.0.0.1:5080/actuator/health", "soopiwarranty.id.vn"))
        self.assertEqual(urlopen.call_args.args[0].get_header("Host"), "soopiwarranty.id.vn")

    def test_update_recreates_only_app_without_database_dependencies(self):
        with patch.object(Path, "resolve", return_value=self.release), \
             patch.object(deploy.subprocess, "run") as run:
            deploy.service("restart")
        command = run.call_args.args[0]
        self.assertIn("--no-deps", command)
        self.assertEqual(command[-1], "app")
        self.assertNotIn("db", command)
        self.assertEqual(run.call_args.kwargs["env"]["SOOPI_RELEASE"], self.release_id)

    def test_healthy_release_becomes_current(self):
        with patch.object(deploy, "previous_release", return_value=None), \
             patch.object(deploy, "switch_current", side_effect=self.switch), \
             patch.object(deploy, "service"), \
             patch.object(deploy, "wait_healthy", return_value=True):
            deploy.activate(self.release_id, "https://example.com")
        self.assertEqual(self.active, self.release)

    def test_unhealthy_release_restores_previous_and_reports_failure(self):
        previous = self.root / "releases" / ("b" * 40 + "-11-1")
        with patch.object(deploy, "previous_release", return_value=previous), \
             patch.object(deploy, "switch_current", side_effect=self.switch), \
             patch.object(deploy, "service"), \
             patch.object(deploy, "wait_healthy", side_effect=[False, True]):
            with self.assertRaisesRegex(RuntimeError, "restored"):
                deploy.activate(self.release_id, "https://example.com")
        self.assertEqual(self.active, previous)

    def test_restart_failure_also_rolls_back(self):
        previous = self.root / "releases" / ("b" * 40 + "-11-1")
        with patch.object(deploy, "previous_release", return_value=previous), \
             patch.object(deploy, "switch_current", side_effect=self.switch), \
             patch.object(deploy, "service", side_effect=[OSError("restart failed"), None]), \
             patch.object(deploy, "wait_healthy", return_value=True):
            with self.assertRaisesRegex(RuntimeError, "restored"):
                deploy.activate(self.release_id, "https://example.com")
        self.assertEqual(self.active, previous)

    def test_failed_first_deploy_stops_service(self):
        with patch.object(deploy, "previous_release", return_value=None), \
             patch.object(deploy, "switch_current", side_effect=self.switch), \
             patch.object(deploy, "service") as service, \
             patch.object(deploy, "wait_healthy", return_value=False):
            with self.assertRaisesRegex(RuntimeError, "stopped"):
                deploy.activate(self.release_id, "https://example.com")
        self.assertEqual(service.call_args.args, ("stop",))


if __name__ == "__main__":
    unittest.main()
