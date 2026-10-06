import importlib.util
import json
import tempfile
import unittest
from pathlib import Path

spec = importlib.util.spec_from_file_location('origin', Path(__file__).parents[1] / 'configure_origin.py')
origin = importlib.util.module_from_spec(spec)
spec.loader.exec_module(origin)


class OriginConfigTest(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.path = Path(self.temp.name) / 'config.json'
        self.path.write_text(json.dumps({'forwardingGateway': {'allowedForwardedHosts': ['example.org']}}))
        self.env = {'GITHUB_EVENT_NAME': 'push', 'GITHUB_REF': 'refs/heads/main',
                    'AARI_ORIGIN_LOCK_ENABLED': 'true', 'AARI_FRONT_DOOR_ID': '11111111-1111-4111-8111-111111111111',
                    'AARI_FRONT_DOOR_HOSTNAME': 'example.azurefd.net'}

    def test_production_requires_network_and_profile(self):
        self.assertTrue(origin.configure(self.path, self.env))
        config = json.loads(self.path.read_text())
        self.assertEqual(config['networking']['allowedIpRanges'], ['AzureFrontDoor.Backend'])
        self.assertEqual(config['forwardingGateway']['requiredHeaders']['X-Azure-FDID'], self.env['AARI_FRONT_DOOR_ID'])
        self.assertIn('example.org', config['forwardingGateway']['allowedForwardedHosts'])

    def test_preview_is_not_locked(self):
        before = self.path.read_text()
        self.assertFalse(origin.configure(self.path, {**self.env, 'GITHUB_EVENT_NAME': 'pull_request'}))
        self.assertEqual(before, self.path.read_text())

    def test_enabled_production_fails_closed_without_profile_id(self):
        with self.assertRaises(ValueError):
            origin.configure(self.path, {**self.env, 'AARI_FRONT_DOOR_ID': ''})

    def test_enabled_production_rejects_an_unrelated_gateway(self):
        with self.assertRaises(ValueError):
            origin.configure(self.path, {**self.env, 'AARI_FRONT_DOOR_HOSTNAME': 'example.org'})


if __name__ == '__main__':
    unittest.main()
