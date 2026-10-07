"""Offline prerequisite refusals: no postgres/process setup is allowed on these paths."""
import argparse
import importlib.util
from pathlib import Path
import tempfile
from types import SimpleNamespace
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('b5_runner', Path(__file__).with_name('run-cms-integrations.py'))
runner = importlib.util.module_from_spec(spec)
spec.loader.exec_module(runner)


class PrerequisiteSafety(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory(prefix='b5-offline-guards-')
        self.addCleanup(self.directory.cleanup)
        self.root = Path(self.directory.name)
        self.pin = 'a' * 40
        self.options = argparse.Namespace(pg_bin=str(self.root / 'pg'), all_browser=False)
        for name in ('cms', 'gateway', 'accounts', 'infra'):
            repo = self.root / name
            repo.mkdir()
            setattr(self.options, name + '_repo', str(repo))
            setattr(self.options, name + '_revision', self.pin)
        compiler = self.root / 'cms/node_modules/typescript/bin/tsc'
        compiler.parent.mkdir(parents=True)
        compiler.touch()
        tools = self.root / 'pg'
        tools.mkdir()
        for name in ('initdb', 'pg_ctl', 'createdb', 'psql'):
            (tools / name).touch()

    def refuse(self, message, head=None, dirty=0):
        with patch.object(argparse.ArgumentParser, 'parse_args', return_value=self.options), \
                patch.object(runner.subprocess, 'check_output', return_value=head or self.pin), \
                patch.object(runner.subprocess, 'run', return_value=SimpleNamespace(returncode=dirty)) as command, \
                patch.object(runner.tempfile, 'mkdtemp') as allocate:
            with self.assertRaisesRegex(ValueError, message):
                runner.main()
            allocate.assert_not_called()
            self.assertTrue(all(call.args[0][0] == 'git' for call in command.call_args_list))

    def test_nonimmutable_pin_refused_before_database_tooling(self):
        self.options.cms_revision = 'develop'
        self.refuse('Immutable backend revisions')

    def test_checkout_drift_refused_before_database_tooling(self):
        self.refuse('differs from supplied pin', head='b' * 40)

    def test_dirty_runtime_refused_before_database_tooling(self):
        self.refuse('differs from supplied pin', dirty=1)

    def test_missing_installed_compiler_does_not_download_one(self):
        (self.root / 'cms/node_modules/typescript/bin/tsc').unlink()
        self.refuse('Missing installed backend TypeScript')

    def test_missing_postgres_binary_refused_before_database_tooling(self):
        (self.root / 'pg/initdb').unlink()
        self.refuse('Missing local PostgreSQL')

    def test_symlink_fixture_parent_refused_without_writes(self):
        (self.root / 'cms/.tmp').symlink_to(self.root / 'gateway', target_is_directory=True)
        self.refuse('parent cannot be a symlink')



class CleanupSafety(unittest.TestCase):
    def test_dead_frontend_group_still_stops_runtime_and_postgres(self):
        from unittest.mock import Mock
        frontend = Mock(pid=99999)
        runtime, stream = Mock(), Mock()
        with patch.object(runner.os, 'killpg', side_effect=ProcessLookupError), patch.object(runner.subprocess, 'run') as postgres, patch.object(runner.shutil, 'rmtree') as remove:
            try:
                runner.cleanup_owned(frontend, runtime, True, Path('/fixture/pg'), Path('/fixture/cluster'), {}, [stream], Path('/fixture/owned'))
            except ProcessLookupError:
                pass
            runtime.terminate.assert_called_once()
            postgres.assert_called_once()
            stream.close.assert_called_once()
            remove.assert_called_once()

    def test_postgres_stop_failure_still_closes_streams_and_cleans_owned_files(self):
        from unittest.mock import Mock
        stream = Mock()
        with patch.object(runner.subprocess, 'run', side_effect=runner.subprocess.CalledProcessError(1, 'pg_ctl')), patch.object(runner.shutil, 'rmtree') as remove:
            try:
                runner.cleanup_owned(None, None, True, Path('/fixture/pg'), Path('/fixture/cluster'), {}, [stream], Path('/fixture/owned'))
            except (runner.subprocess.CalledProcessError, RuntimeError):
                pass
            stream.close.assert_called_once()
            remove.assert_called_once()

if __name__ == '__main__':
    unittest.main()
