# Stub for fighthealthinsurance/context_utils.py
# Only truncate_at_boundary is needed by generate_appeal.py.


def truncate_at_boundary(text: str, max_chars: int) -> str:
    """Truncate text at a word boundary to stay within max_chars."""
    if len(text) <= max_chars:
        return text
    truncated = text[:max_chars]
    last_space = truncated.rfind(" ")
    if last_space > max_chars // 2:
        return truncated[:last_space]
    return truncated
