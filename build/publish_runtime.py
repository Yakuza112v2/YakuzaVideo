"""Publish the verified runtime and remember the commit used for its release tag."""
import base64
import json
import os
from pathlib import Path
import urllib.error
import urllib.request

metadata = json.loads(Path('release-files/build.json').read_text())
name = metadata['runtimeFile']
assert Path(name).name == name
url = 'https://api.github.com/repos/' + os.environ['GH_REPO'] + '/contents/' + name
headers = {'Authorization': 'Bearer ' + os.environ['GH_TOKEN'], 'Accept': 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28'}
data = {'message': 'Publish YakuzaVideo ' + metadata['version'] + ' runtime [skip ci]', 'branch': 'main',
        'content': base64.b64encode(Path('release-files/player.js').read_bytes()).decode()}
try:
    with urllib.request.urlopen(urllib.request.Request(url, headers=headers), timeout=60) as response:
        data['sha'] = json.load(response)['sha']
except urllib.error.HTTPError as error:
    if error.code != 404:
        raise
with urllib.request.urlopen(urllib.request.Request(url, data=json.dumps(data).encode(), headers=headers, method='PUT'), timeout=60) as response:
    result = json.load(response)
Path('runtime-commit.txt').write_text(result['commit']['sha'])
print('Verified runtime published:', name, result['commit']['sha'])
