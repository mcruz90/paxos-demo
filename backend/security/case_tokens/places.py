"""Joining a format's pieces into places (decision 0034, section 13). Standard library only."""

import re

from security.case_tokens.tokens import TOKEN, Span

Piece = tuple[str, int]  # a piece's text and its offset in the letter


def runs(pieces: list[Piece], chosen: set[int]) -> list[tuple[int, int]]:
    """Each run of adjacent chosen pieces as one place, from the first piece's start to the last one's end, the
    separators between them included: a span over "20261027*0915" lies inside the place of two pieces."""
    out: list[tuple[int, int]] = []
    last = -2
    for i in sorted(chosen):
        value, at = pieces[i]
        if i == last + 1 and out:
            out[-1] = (out[-1][0], at + len(value))
        else:
            out.append((at, at + len(value)))
        last = i
    return out


def shaped(pieces: list[Piece], shapes: dict[int, str]) -> set[int]:
    """The indices of `pieces` whose whole text has the shape `shapes` gives for its index."""
    return {
        i for i, shape in shapes.items() if i < len(pieces) and re.fullmatch(shape, pieces[i][0])
    }


def copies(text: str, spans: list[Span], places: list[tuple[int, int]]) -> list[Span]:
    """A span, of the same kind, for every whole copy of each of `spans`' values inside `places` (itself included):
    a control number is written twice (GS06 and GE02), and each copy must be tokenized alike. A copy is whole when
    no letter or digit touches it, so "66102" is not found in "000066102"."""
    out: dict[tuple[int, int], Span] = {}
    for s in spans:
        value = re.compile(rf"(?<![A-Za-z0-9]){re.escape(text[s.start : s.end])}(?![A-Za-z0-9])")
        for a, b in places:
            for m in value.finditer(text, a, b):
                out.setdefault((m.start(), m.end()), Span(m.start(), m.end(), s.kind))
    return list(out.values())


def in_output(
    places: list[tuple[int, int]], output: str, mapping: dict[str, str]
) -> list[tuple[int, int]]:
    """Each place of the source, moved to `output` (the source tokenized with `mapping`): an offset moves by every
    issued token before it, by the token's length less its value's."""
    marks, delta = [], 0  # (the source offset after a token, the shift from there on)
    for m in TOKEN.finditer(output):
        value = mapping.get(m.group())
        if value is None:
            continue
        start = m.start() - delta
        delta += len(m.group()) - len(value)
        marks.append((start + len(value), delta))

    def moved(at: int) -> int:
        return at + next((d for end, d in reversed(marks) if end <= at), 0)

    return [(moved(a), moved(b)) for a, b in places]
