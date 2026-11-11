"""Paquete de ejecución con lista permitida; nunca incluye bases, pruebas o claves."""
import hashlib
import json
from pathlib import Path
import sys
import zipfile

root = Path(__file__).resolve().parents[1]
destino = Path(sys.argv[1]).resolve()
destino.mkdir(parents=True, exist_ok=True)
package = json.loads((root / 'package.json').read_text(encoding='utf-8'))
package['scripts'] = {k: v for k, v in package['scripts'].items()
                      if k in {'start', 'backup', 'restore', 'crear-taller', 'recuperar-acceso'}}
files = [root / 'servidor.cjs']
for folder in ('server', 'public'):
    files.extend(p for p in (root / folder).rglob('*') if p.is_file())
files.extend(root / 'scripts' / name for name in
             ('backup.js', 'restore.js', 'crear-taller.js', 'recuperar-acceso.js'))
files = sorted(files)
entries = {}
for file in files:
    rel = file.relative_to(root).as_posix()
    if file.is_symlink() or file.suffix in {'.db', '.sqlite', '.sqlite3'} or any(
            part.startswith('.') or part in {'node_modules', 'test', 'data', 'respaldos', 'tmp'}
            for part in Path(rel).parts):
        raise RuntimeError(f'Archivo no publicable: {rel}')
    if any(word in file.name.lower() for word in ('seed', 'revision-v2', '.env', '.db-')):
        raise RuntimeError(f'Archivo local de prueba: {rel}')
    entries[rel] = file.read_bytes()
entries['package.json'] = (json.dumps(package, ensure_ascii=False, indent=2) + '\n').encode()
manifest = {name: hashlib.sha256(data).hexdigest() for name, data in sorted(entries.items())}
entries['entrega.json'] = (json.dumps({'version': package['version'], 'archivos': manifest}, indent=2) + '\n').encode()
zip_path = destino / f"growth-labs-talleres-{package['version']}-hostinger.zip"
with zipfile.ZipFile(zip_path, 'w', compression=zipfile.ZIP_DEFLATED) as archive:
    for name, data in sorted(entries.items()):
        archive.writestr(name, data)
with zipfile.ZipFile(zip_path) as archive:
    assert archive.testzip() is None
    assert set(archive.namelist()) == set(entries)
    assert all(hashlib.sha256(archive.read(n)).hexdigest() == h for n, h in manifest.items())
sha = hashlib.sha256(zip_path.read_bytes()).hexdigest()
(destino / (zip_path.name + '.sha256')).write_text(f'{sha}  {zip_path.name}\n', encoding='utf-8')
print(json.dumps({'archivo': str(zip_path), 'version': package['version'],
                  'entradas': len(entries), 'bytes': zip_path.stat().st_size, 'sha256': sha}))
