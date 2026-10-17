"""The public Pages artifact must never use environment credentials or working data."""
import json
import os
from pathlib import Path
import subprocess
import sys


def test_export_uses_only_fresh_public_seed(tmp_path):
    root = Path(__file__).resolve().parents[2]
    private_db = tmp_path / 'must-not-be-created.db'
    output = tmp_path / 'demo.json'
    env = {**os.environ, 'DATABASE_URL': f'sqlite:///{private_db.as_posix()}',
           'ADMIN_EMAIL': 'private-setting@example.com', 'ADMIN_PASSWORD': 'PRIVATE_TEST_SENTINEL'}
    subprocess.run([sys.executable, str(root / 'scripts/pages/export_demo.py'), '--output', str(output)],
                   env=env, check=True, capture_output=True)
    data = json.loads(output.read_text(encoding='utf-8'))
    assert not private_db.exists()
    assert {user['email'] for user in data['users']} == {'demo@barber.kz', 'admin@barber.kz'}
    assert {user['password'] for user in data['users']} == {'demo123', 'admin123'}
    assert len(data['barbershops']) == 6 and len(data['products']) == 10
    assert data['orders'] == []
    text = output.read_text(encoding='utf-8')
    assert 'password_hash' not in text and 'PRIVATE_TEST_SENTINEL' not in text
    assert 'private-setting@example.com' not in text
