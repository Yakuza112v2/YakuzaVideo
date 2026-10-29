"""Check the exact immutable runtime URL embedded in this APK."""
import hashlib
import json
from pathlib import Path
import time
import urllib.request

metadata = json.loads(Path('release-files/build.json').read_text())
url = metadata['scriptUrl']
assert '@v' + metadata['version'] + '/' in url
expected = hashlib.sha256(Path('release-files/player.js').read_bytes()).digest()
for attempt in range(4):
    try:
        with urllib.request.urlopen(url, timeout=60) as response:
            actual = hashlib.sha256(response.read()).digest()
        assert actual == expected, 'Runtime URL delivered a different version'
        print('Version-specific runtime URL and checksum verified:', url)
        break
    except Exception:
        if attempt == 3:
            raise
        time.sleep(5)
