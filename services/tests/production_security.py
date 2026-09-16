#!/usr/bin/env python3
"""Exercise the standalone production stack with disposable secrets and storage."""
import json
from datetime import datetime, timedelta, timezone
import os
from pathlib import Path
import subprocess
import tempfile
import time
import urllib.request
import uuid

ROOT = Path(__file__).resolve().parents[2]

def main():
    with tempfile.TemporaryDirectory(prefix='ravex-production-') as temporary:
        directory = Path(temporary) / 'secrets'
        subprocess.run(['python3', 'infra/production/generate_secrets.py', str(directory)], cwd=ROOT, check=True)
        repeated = subprocess.run(['python3', 'infra/production/generate_secrets.py', str(directory)], cwd=ROOT, capture_output=True)
        assert repeated.returncode != 0, 'existing secrets must not be overwritten'
        assert directory.stat().st_mode & 0o777 == 0o700
        assert all(p.stat().st_mode & 0o777 == 0o444 for p in directory.iterdir())
        env = dict(os.environ, RAVEX_SECRETS_DIR=str(directory), ADMIN_BOOTSTRAP_EMAIL='admin@example.com', PLATFORM_ORIGIN='https://play.example.com', ADMIN_ORIGIN='https://admin.example.com', GATEWAY_PORT='0')
        base = ['docker', 'compose', '-p', 'ravex-production-test-' + uuid.uuid4().hex[:10], '-f', 'compose.production.yml']
        def run(*args, check=True):
            result = subprocess.run(base + list(args), cwd=ROOT, env=env, text=True, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, timeout=600)
            if check and result.returncode:
                output = result.stdout
                for secret in directory.iterdir():
                    output = output.replace(secret.read_text().strip(), '[REDACTED]')
                raise AssertionError('Compose operation failed: ' + ' '.join(args[:2]) + '\n' + output[-6000:])
            return result
        config = json.loads(run('config', '--format', 'json').stdout)
        assert config['networks']['backend']['internal']
        for name, service in config['services'].items():
            if name != 'gateway': assert not service.get('ports'), name
            else: assert service['ports'][0]['host_ip'] == '127.0.0.1'
        try:
            run('up', '-d', '--build')
            address = run('port', 'gateway', '8080').stdout.strip()
            for attempt in range(90):
                try:
                    with urllib.request.urlopen('http://' + address + '/health/ready', timeout=3) as response:
                        if response.status == 200: break
                except Exception: pass
                time.sleep(2)
            else:
                output = run('logs', '--tail', '30', check=False).stdout
                for secret in directory.iterdir():
                    output = output.replace(secret.read_text().strip(), '[REDACTED]')
                raise AssertionError('Production readiness failed\n' + output)
            request = urllib.request.Request('http://' + address + '/auth/login', data=json.dumps({'email':env['ADMIN_BOOTSTRAP_EMAIL'], 'password':(directory/'admin_bootstrap_password').read_text().strip()}).encode(), headers={'Content-Type':'application/json'})
            with urllib.request.urlopen(request, timeout=10) as response:
                assert response.status == 200
                token = json.load(response)['accessToken']
            def api(path, body=None, headers=None):
                request = urllib.request.Request('http://' + address + path,
                    data=None if body is None else json.dumps(body).encode(),
                    headers={'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token, **(headers or {})})
                with urllib.request.urlopen(request, timeout=15) as response:
                    return json.load(response)
            api('/wallet/me/earn', {'reason': 'daily_login'})
            assert api('/wallet/me/balance')['balance'] == 50
            market = api('/markets', {'title': 'Production configuration smoke test',
                'eventStartAt': (datetime.now(timezone.utc) + timedelta(days=1)).isoformat(),
                'outcomes': ['Home', 'Away']})
            stake = api(f"/pools/{market['id']}/stakes", {'outcomeId': market['outcomes'][0]['id'], 'amount': 10},
                {'Idempotency-Key': str(uuid.uuid4())})
            assert stake['stake']['state'] == 'accepted'
            assert api('/wallet/me/balance')['balance'] == 40
            api(f"/markets/{market['id']}/cancel", {'reason': 'Production smoke test refund'})
            for attempt in range(30):
                if api('/wallet/me/balance')['balance'] == 50: break
                time.sleep(1)
            else: raise AssertionError('Production refund did not complete')
            api('/operations/settlement')
            api('/branding/theme')
            for role in ['identity', 'wallet', 'market_catalog', 'settlement', 'branding']:
                sql = f"SELECT rolsuper OR rolcreatedb OR rolcreaterole FROM pg_roles WHERE rolname='ravex_{role}'"
                assert run('exec', '-T', 'postgres', 'psql', '-U', 'postgres', '-d', 'ravex', '-Atc', sql).stdout.strip() == 'f'
                other = 'wallet' if role == 'identity' else 'identity'
                sql = f"SET ROLE ravex_{role}; CREATE TABLE {other}.forbidden_probe(id integer);"
                assert run('exec', '-T', 'postgres', 'psql', '-U', 'postgres', '-d', 'ravex', '-v', 'ON_ERROR_STOP=1', '-c', sql, check=False).returncode != 0
                sql = f"SELECT has_schema_privilege('ravex_{role}', '{other}', 'USAGE')"
                assert run('exec', '-T', 'postgres', 'psql', '-U', 'postgres', '-d', 'ravex', '-Atc', sql).stdout.strip() == 'f'
            for service, key in [(name, 'JWT_SIGNING_KEY') for name in ['gateway', 'identity', 'wallet-ledger', 'market-catalog', 'branding']] + [('settlement-engine','INTERNAL_SERVICE_KEY')]:
                result = run('run', '--rm', '--no-deps', '-e', key + '_FILE=', '-e', key + '=dev-only-signing-key-change-me-please-32bytes!', service, check=False)
                assert result.returncode != 0 and key in result.stdout
                assert 'dev-only-signing-key-change-me-please-32bytes!' not in result.stdout
            for service, key in [('gateway', 'JWT_SIGNING_KEY'), ('settlement-engine', 'INTERNAL_SERVICE_KEY')]:
                result = run('run', '--rm', '--no-deps', '-e', key + '=conflicting-value', service, check=False)
                assert result.returncode != 0 and 'cannot be set together' in result.stdout
                result = run('run', '--rm', '--no-deps', '-e', key + '_FILE=', '-e', key + '=', service, check=False)
                assert result.returncode != 0 and key in result.stdout
            for service, key, value in [
                ('wallet-ledger', 'WALLET_DB_CONNECTION', 'Host=postgres;Username=ravex_wallet;Password=weak'),
                ('identity', 'ADMIN_BOOTSTRAP_PASSWORD', 'weak'),
                ('wallet-ledger', 'INTERNAL_SERVICE_KEY', 'weak'),
            ]:
                result = run('run', '--rm', '--no-deps', '-e', key + '_FILE=', '-e', key + '=' + value, service, check=False)
                assert result.returncode != 0 and key in result.stdout
                assert value not in result.stdout
            result = run('run', '--rm', '--no-deps', '-e', 'INTERNAL_SERVICE_KEY_FILE=/run/secrets/jwt_signing_key', 'wallet-ledger', check=False)
            assert result.returncode != 0 and 'must differ' in result.stdout
            print('PASS: production migrations, readiness, authenticated stake/refund flow, private ports, service roles, and rejected development secrets')
        finally:
            run('down', '--volumes', '--remove-orphans')

if __name__ == '__main__':
    main()
