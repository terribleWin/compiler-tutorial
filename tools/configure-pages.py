"""Configure this public tutorial repo to publish main:/docs.

Uses an existing Git credential (or GITHUB_TOKEN) in memory only; does not
write a credential or echo it. Publishing was requested by the repo owner.
"""
import json
import os
import subprocess
import sys
import urllib.error
import urllib.request

REPOSITORY = 'terribleWin/compiler-tutorial'
API = 'https://api.github.com/repos/' + REPOSITORY + '/pages'


def credential():
    token = os.environ.get('GITHUB_TOKEN')
    if token:
        return token
    env = dict(os.environ, GIT_TERMINAL_PROMPT='0', GCM_INTERACTIVE='Never')
    try:
        result = subprocess.run(['git', 'credential', 'fill'],
                                input='protocol=https\nhost=github.com\n\n',
                                text=True, capture_output=True, env=env, timeout=20)
    except (OSError, subprocess.TimeoutExpired):
        return None
    fields = dict(line.split('=', 1) for line in result.stdout.splitlines() if '=' in line)
    return fields.get('password') if result.returncode == 0 else None


def request(method, token, data=None):
    headers = {'Accept': 'application/vnd.github+json', 'User-Agent': 'SproutCoursePublisher'}
    if token:
        headers['Authorization'] = 'Bearer ' + token
    payload = json.dumps(data).encode() if data is not None else None
    req = urllib.request.Request(API, data=payload, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=30) as response:
            return response.status, json.load(response)
    except urllib.error.HTTPError as error:
        return error.code, json.load(error)


def main():
    token = credential()
    if '--credential-check' in sys.argv:
        print('Existing GitHub credential available' if token else 'No existing GitHub credential available')
        return 0 if token else 3
    status, current = request('GET', token)
    if '--status' not in sys.argv:
        if not token:
            print('No existing GitHub credential available. Configure main:/docs in repository Settings > Pages.')
            return 3
        config = {'build_type': 'legacy', 'source': {'branch': 'main', 'path': '/docs'}}
        if status == 404:
            status, current = request('POST', token, config)
        elif status == 200 and (current.get('source') != config['source'] or current.get('build_type') != 'legacy'):
            status, current = request('PUT', token, config)
    print(json.dumps({'http_status': status, 'status': current.get('status'),
                      'html_url': current.get('html_url'), 'source': current.get('source'),
                      'message': current.get('message')}, ensure_ascii=False))
    return 0 if status in (200, 201, 204) else 1


if __name__ == '__main__':
    raise SystemExit(main())
