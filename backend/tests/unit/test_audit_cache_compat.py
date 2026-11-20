"""Exercise Filelock through CacheControl, its installed transitive consumer."""

import pytest
from cachecontrol.caches import FileCache
from cachecontrol.caches.file_cache import url_to_file_path
from filelock import FileLock, Timeout


class BoundedFileLock(FileLock):
    def __init__(self, lock_file):
        super().__init__(lock_file, timeout=1)


def test_audit_file_cache_locks_and_recovers_after_contention(tmp_path):
    cache = FileCache(tmp_path, lock_class=BoundedFileLock)
    key = "https://example.invalid/synthetic-package"
    cache.set(key, b"first")
    assert cache.get(key) == b"first"
    lock_path = url_to_file_path(key, cache) + ".lock"
    with FileLock(lock_path, timeout=1):
        with pytest.raises(Timeout):
            cache.set(key, b"blocked")
    assert cache.get(key) == b"first"
    other = FileCache(tmp_path, lock_class=BoundedFileLock)
    other.set(key, b"second")
    assert cache.get(key) == b"second"
