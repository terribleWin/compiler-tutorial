"""Create a deterministic downloadable source archive using only Python stdlib."""
from pathlib import Path
import zipfile
import argparse

root = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser()
parser.add_argument('--output', default='docs/downloads/sprout-source.zip')
args = parser.parse_args()
target = root / args.output
target.parent.mkdir(parents=True, exist_ok=True)
files = [p for p in (root / 'compiler').rglob('*') if p.is_file()
         and not any(x.startswith('build') or x == '__pycache__' for x in p.relative_to(root / 'compiler').parts)
         and p.suffix not in ('.exe', '.o', '.pyc')]
with zipfile.ZipFile(target, 'w', compression=zipfile.ZIP_DEFLATED) as archive:
    for p in sorted(files):
        info = zipfile.ZipInfo(p.relative_to(root).as_posix(), (2026, 11, 6, 0, 0, 0))
        info.compress_type = zipfile.ZIP_DEFLATED
        info.external_attr = 0o644 << 16
        archive.writestr(info, p.read_bytes())
print(f'Packaged {len(files)} source files: {target.name}')
