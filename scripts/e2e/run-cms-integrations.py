"""Explicit B5 isolation: owns a fresh PG cluster, backend runner and frontend server."""
import argparse
import json
import os
from pathlib import Path
import re
import secrets
import shutil
import socket
import subprocess
import tempfile
import time


def free_port():
    with socket.socket() as handle:
        handle.bind(('127.0.0.1', 0))
        return handle.getsockname()[1]


def stop_owned_process(process, group=False):
    import signal
    def send(force=False):
        try:
            if group:
                os.killpg(process.pid, signal.SIGKILL if force else signal.SIGTERM)
            elif force:
                process.kill()
            else:
                process.terminate()
        except ProcessLookupError:
            pass
    send()
    try:
        process.wait(timeout=10)
    except subprocess.TimeoutExpired:
        send(force=True)
        process.wait(timeout=10)


def cleanup_owned(frontend, runtime, started, pg_bin, cluster, env, streams, owned):
    errors = []
    def attempt(action):
        try:
            action()
        except Exception as error:
            errors.append(error)
    if frontend:
        attempt(lambda: stop_owned_process(frontend, group=True))
    if runtime:
        attempt(lambda: stop_owned_process(runtime))
    if started:
        attempt(lambda: subprocess.run([str(pg_bin / 'pg_ctl'), '-D', str(cluster / 'data'), '-m', 'fast', '-w', 'stop'], env=env, capture_output=True, check=True))
    for stream in streams:
        attempt(stream.close)
    attempt(lambda: shutil.rmtree(owned))
    if errors:
        raise RuntimeError('Owned fixture cleanup failed after every cleanup was attempted') from errors[0]


def main():
    parser = argparse.ArgumentParser()
    for name in ('cms', 'gateway', 'accounts', 'infra'):
        parser.add_argument('--' + name + '-repo', required=True)
        parser.add_argument('--' + name + '-revision', required=True)
    parser.add_argument('--pg-bin', required=True)
    parser.add_argument('--all-browser', action='store_true')
    options = parser.parse_args()
    repos = {}
    for name in ('cms', 'gateway', 'accounts', 'infra'):
        path = Path(getattr(options, name + '_repo')).resolve()
        revision = getattr(options, name + '_revision')
        if not re.fullmatch('[0-9a-f]{40}', revision):
            raise ValueError('Immutable backend revisions required')
        actual = subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=path, text=True).strip()
        if actual != revision or subprocess.run(['git', 'diff', '--quiet', 'HEAD', '--'], cwd=path).returncode:
            raise ValueError('Backend source differs from supplied pin: ' + name)
        # Dependency/output links are not revision-pinned source; runtime inputs are.
        # Do not apply ignore rules: ignored SQL/modules can also affect the fixture.
        untracked = subprocess.check_output(['git', 'ls-files', '--others', '-z', '--', 'src', 'drizzle', 'supabase/migrations'], cwd=path, text=True)
        if untracked:
            raise ValueError('Untracked backend runtime inputs: ' + name)
        repos[name] = path
    compiler = repos['cms'] / 'node_modules/typescript/bin/tsc'
    if not compiler.is_file():
        raise ValueError('Missing installed backend TypeScript compiler')
    root = Path(__file__).resolve().parents[2]
    pg_bin = Path(options.pg_bin).resolve()
    for tool in ('initdb', 'pg_ctl', 'createdb', 'psql'):
        if not (pg_bin / tool).is_file():
            raise ValueError('Missing local PostgreSQL tooling')
    parent = repos['cms'] / '.tmp'
    if parent.is_symlink():
        raise ValueError('Fixture parent cannot be a symlink')
    parent.mkdir(exist_ok=True)
    owned = Path(tempfile.mkdtemp(prefix='cms-int-b5-', dir=parent))
    cluster = Path(tempfile.mkdtemp(prefix='cms-int-b5-pg-'))
    evidence = Path(tempfile.mkdtemp(prefix='cms-int-b5-evidence-'))
    evidence.chmod(0o700)
    pg_port, frontend_port = free_port(), free_port()
    database_name = 'cms_int_b5_' + secrets.token_hex(4)
    # Forward process/tool basics only. Never load personal frontend/backend env files.
    env = {key: value for key, value in os.environ.items() if key in ('PATH', 'HOME', 'TMPDIR', 'LANG', 'LC_ALL')}
    env.update(NODE_ENV='test', RUN_CMS_INTEGRATIONS_BROWSER='1', DATABASE_URL=f'postgres://cms@127.0.0.1:{pg_port}/{database_name}', PGHOST='127.0.0.1', PGPORT=str(pg_port), PGUSER='cms', PGDATABASE=database_name,
               CMS_B5_READY_FILE=str(owned / 'ready.json'), CMS_INTEGRATIONS_FIXTURE_CONTROL_TOKEN=secrets.token_hex(32), XYNES_BUILD_VERSION='cms-int-b5-local', INTERNAL_AUTH_MODE='hybrid', INTERNAL_SERVICE_TOKEN=secrets.token_hex(32), INTERNAL_JWT_SIGNING_KEY='', NEXT_PUBLIC_ENABLE_E2E_FIXTURES='1', NEXT_PUBLIC_CMS_CONTENT_INTEGRATIONS_ENABLED='1', NEXT_PUBLIC_SUPABASE_URL='https://fixtures.supabase.local', NEXT_PUBLIC_SUPABASE_ANON_KEY='fixture-anon-key', NEXT_PUBLIC_AUTH_APP_URL='http://127.0.0.1:3100', NEXT_PUBLIC_API_URL=f'http://127.0.0.1:{frontend_port}/api/e2e', NEXT_PUBLIC_APP_URL=f'http://127.0.0.1:{frontend_port}', NEXT_PUBLIC_ALLOWED_REDIRECT_DOMAINS=f'127.0.0.1:{frontend_port},localhost:{frontend_port}', NEXT_API_URL='http://127.0.0.1:4100', PLAYWRIGHT_E2E_PORT=str(frontend_port), CMS_B5_EVIDENCE_DIR=str(evidence))
    for name, path in repos.items():
        env['XYNES_' + name.upper() + '_REPO'] = str(path)
    runtime = frontend = None
    started = False
    streams = []
    try:
        shutil.copyfile(root / 'e2e/fixtures/cms-delivery-runtime.ts.fixture', owned / 'runtime.ts')
        subprocess.run(['bun', str(compiler), '--noEmit', '--strict', '--target', 'esnext', '--lib', 'esnext', '--module', 'esnext', '--moduleResolution', 'bundler', '--allowImportingTsExtensions', '--types', 'bun-types', '--skipLibCheck', str(owned / 'runtime.ts')], cwd=repos['cms'], env=env, check=True)
        subprocess.run([str(pg_bin / 'initdb'), '-D', str(cluster / 'data'), '-U', 'cms', '-A', 'trust', '--no-locale', '-E', 'UTF8'], env=env, check=True, capture_output=True)
        subprocess.run([str(pg_bin / 'pg_ctl'), '-D', str(cluster / 'data'), '-l', str(cluster / 'postgres.log'), '-o', f'-h 127.0.0.1 -p {pg_port} -k {cluster} -c max_connections=20 -c shared_buffers=16MB', '-w', 'start'], env=env, check=True, capture_output=True)
        started = True
        subprocess.run([str(pg_bin / 'createdb'), database_name], env=env, check=True, capture_output=True)
        scaffold = 'CREATE EXTENSION IF NOT EXISTS pgcrypto; CREATE SCHEMA identity; CREATE TABLE identity.users(id uuid PRIMARY KEY,email text NOT NULL,display_name text,avatar_url text,created_at timestamptz DEFAULT now(),updated_at timestamptz DEFAULT now()); CREATE SCHEMA platform; CREATE TABLE platform.workspaces(id uuid PRIMARY KEY);'
        sql = scaffold
        for path in sorted((repos['cms'] / 'drizzle').glob('*.sql')):
            if int(path.name[:4]) <= 9:
                sql += '\n' + path.read_text()
        for name in ('20251229100000_create_platform_routes.sql', '20260424090000_workspace_admin_integrations.sql', '20261005090000_seed_cms_delivery_routes.sql', '20260427090000_seed_cms_dashboard_routes.sql'):
            sql += '\n' + re.sub(r'GRANT\s+[^;]+;', '', (repos['infra'] / 'supabase/migrations' / name).read_text(), flags=re.I)
        subprocess.run([str(pg_bin / 'psql'), '-X', '-v', 'ON_ERROR_STOP=1'], input=sql, text=True, env=env, check=True, capture_output=True)
        runtime_log = (evidence / 'runtime.log').open('w'); streams.append(runtime_log)
        runtime = subprocess.Popen(['bun', 'run', str(owned / 'runtime.ts')], cwd=owned, env=env, stdout=runtime_log, stderr=runtime_log)
        deadline = time.monotonic() + 45
        ready_path = owned / 'ready.json'
        while not ready_path.is_file():
            if runtime.poll() is not None or time.monotonic() > deadline:
                raise ValueError('Owned backend fixture did not become ready; inspect retained evidence')
            time.sleep(.2)
        ready = json.loads(ready_path.read_text())
        env.update(CMS_INTEGRATIONS_FIXTURE_CONTEXT=json.dumps(ready['context']), CMS_INTEGRATIONS_FIXTURE_CONTROL_ORIGIN=ready['controlOrigin'])
        frontend_log = (evidence / 'frontend.log').open('w'); streams.append(frontend_log)
        frontend = subprocess.Popen(['pnpm', 'exec', 'next', 'dev', '--webpack', '--hostname', '127.0.0.1', '--port', str(frontend_port)], cwd=root, env={**env, 'NODE_ENV': 'development'}, stdout=frontend_log, stderr=frontend_log, start_new_session=True)
        import urllib.request
        deadline = time.monotonic() + 60
        while True:
            if frontend.poll() is not None or time.monotonic() > deadline:
                raise ValueError('Owned frontend did not become ready')
            try:
                with urllib.request.urlopen(f'http://127.0.0.1:{frontend_port}/', timeout=2) as response:
                    if response.status == 200: break
            except (OSError, TimeoutError):
                time.sleep(.2)
        # Compile the finite fixture surfaces before connecting browser HMR clients.
        for route in ('/api/e2e/flags', '/e2e/cms-content-integrations?host=list', '/e2e/content-integrations?target=entry&long=1', '/e2e/content-integration-hosts?host=editor', '/e2e/cms-dashboard-scroll', '/e2e/cms-dashboard-scroll-empty'):
            with urllib.request.urlopen(f'http://127.0.0.1:{frontend_port}{route}', timeout=30) as response:
                if response.status != 200:
                    raise ValueError('Owned fixture warmup failed')
        command = ['pnpm', 'exec', 'playwright', 'test']
        if not options.all_browser:
            command += ['e2e/cms-content-integrations.spec.ts']
        result = subprocess.run(command, cwd=root, env=env)
        (evidence / 'sources.json').write_text(json.dumps({name: {'path': str(path), 'revision': getattr(options, name + '_revision')} for name, path in repos.items()}, indent=2))
        print('B5 browser result:', result.returncode, '; retained evidence:', evidence)
        return result.returncode
    finally:
        cleanup_owned(frontend, runtime, started, pg_bin, cluster, env, streams, owned)
        print('Owned fixture stopped; retained cluster:', cluster, '; evidence:', evidence)

if __name__ == '__main__':
    raise SystemExit(main())
