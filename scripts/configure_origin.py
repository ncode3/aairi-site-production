"""Inject production Front Door restrictions without committing deployment IDs."""
import json
import os
from pathlib import Path
import re
from uuid import UUID


def configure(path, env):
    if env.get('GITHUB_EVENT_NAME') != 'push' or env.get('GITHUB_REF') != 'refs/heads/main':
        return False
    if env.get('AARI_ORIGIN_LOCK_ENABLED', '').lower() != 'true':
        return False
    fdid = str(UUID(env.get('AARI_FRONT_DOOR_ID', '')))
    hostname = env.get('AARI_FRONT_DOOR_HOSTNAME', '').lower()
    if not re.fullmatch(r'[a-z0-9.-]+\.azurefd\.net', hostname):
        raise ValueError('A valid Front Door hostname is required when origin locking is enabled')
    config = json.loads(path.read_text())
    config['networking'] = {'allowedIpRanges': ['AzureFrontDoor.Backend']}
    gateway = config.setdefault('forwardingGateway', {})
    gateway.setdefault('requiredHeaders', {})['X-Azure-FDID'] = fdid
    gateway['allowedForwardedHosts'] = list(dict.fromkeys(gateway.get('allowedForwardedHosts', []) + [hostname]))
    path.write_text(json.dumps(config, indent=2) + '\n')
    return True


if __name__ == '__main__':
    target = Path(__file__).resolve().parents[1] / 'dist/staticwebapp.config.json'
    enabled = configure(target, os.environ)
    print('Production origin restriction enabled.' if enabled else 'Origin restriction not enabled for this deployment.')
