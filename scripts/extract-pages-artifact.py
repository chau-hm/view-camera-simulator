#!/usr/bin/env python3
"""Extract a bounded, regular-file-only Actions artifact into a new directory."""
import pathlib
import stat
import sys
import unicodedata
import zipfile

MAX_FILES = 10000
MAX_BYTES = 512 * 1024 * 1024


def extract(archive, destination):
    root = pathlib.Path(destination)
    with zipfile.ZipFile(archive) as source:
        entries = source.infolist()
        if not entries or len(entries) > MAX_FILES:
            raise ValueError("archive entry count out of bounds")
        seen = set()
        portable_paths = {}
        portable_files = set()
        total = 0
        for entry in entries:
            name = entry.filename
            parts = name.split('/')
            if (entry.orig_filename != name or not name or name.startswith('/') or '\\' in name or
                    any(part in ('', '.', '..') for part in parts) or
                    any(ord(c) < 32 or ord(c) == 127 for c in name) or
                    ':' in parts[0]):
                raise ValueError(f"unsafe archive path: {name!r}")
            for part in parts:
                stem = part.split('.', 1)[0].upper()
                if (part.endswith((' ', '.')) or any(c in '<>:"|?*' for c in part) or
                        stem in {'CON', 'PRN', 'AUX', 'NUL'} or
                        (len(stem) == 4 and stem[:3] in {'COM', 'LPT'} and stem[3] in '123456789¹²³')):
                    raise ValueError(f"non-portable archive component: {part!r}")
            for index in range(1, len(parts) + 1):
                prefix = '/'.join(parts[:index])
                key = '/'.join(unicodedata.normalize('NFD', unicodedata.normalize('NFD', part).casefold()) for part in parts[:index])
                if key in portable_paths and portable_paths[key] != prefix:
                    raise ValueError(f"ambiguous archive path: {prefix!r}")
                portable_paths[key] = prefix
                if index == len(parts):
                    if key in portable_files:
                        raise ValueError(f"duplicate portable archive path: {prefix!r}")
                    portable_files.add(key)
            if name in seen:
                raise ValueError(f"duplicate archive path: {name!r}")
            seen.add(name)
            mode = (entry.external_attr >> 16) & 0xFFFF
            kind = stat.S_IFMT(mode)
            if entry.is_dir() or kind not in (0, stat.S_IFREG) or entry.flag_bits & 1:
                raise ValueError(f"unsupported archive entry: {name!r}")
            if entry.file_size < 0 or entry.file_size > MAX_BYTES:
                raise ValueError("archive file size out of bounds")
            total += entry.file_size
            if total > MAX_BYTES:
                raise ValueError("archive expansion out of bounds")
        # Reject file/directory prefix collisions before writing anything.
        for name in seen:
            parts = name.split('/')
            if any('/'.join(parts[:i]) in seen for i in range(1, len(parts))):
                raise ValueError(f"archive path collision: {name!r}")
        for key in portable_files:
            parts = key.split('/')
            if any('/'.join(parts[:i]) in portable_files for i in range(1, len(parts))):
                raise ValueError(f"portable archive path collision: {key!r}")
        root.mkdir(mode=0o700, parents=False, exist_ok=False)
        for entry in entries:
            target = root.joinpath(*entry.filename.split('/'))
            target.parent.mkdir(mode=0o700, parents=True, exist_ok=True)
            count = 0
            with source.open(entry) as inp, open(target, 'xb') as out:
                while chunk := inp.read(1024 * 1024):
                    count += len(chunk)
                    if count > entry.file_size:
                        raise ValueError("archive entry exceeds declared size")
                    out.write(chunk)
            if count != entry.file_size:
                raise ValueError("truncated archive entry")


if __name__ == '__main__':
    try:
        if len(sys.argv) != 3:
            raise ValueError('usage: extract-pages-artifact.py <archive> <new-directory>')
        extract(sys.argv[1], sys.argv[2])
    except (ValueError, OSError, zipfile.BadZipFile, RuntimeError) as exc:
        print(f"archive extraction failed: {exc}", file=sys.stderr)
        sys.exit(1)
