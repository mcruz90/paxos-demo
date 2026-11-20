"""Identifiers read by their datatype in a FHIR resource, JSON or XML (decision 0030). Standard library only.

In the style of Microsoft's FHIR anonymizer (`nodesByType`): a HumanName's family, given and text; an Identifier's
value; a ContactPoint's value; an Address below the state; a birth date; Coverage.subscriberId; and the display of
a reference to a person. A letter carries no schema, so a datatype is told by its shape (a HumanName has `family`
or `given`). Its codings, codeable concepts, coverage classes and dispositions are not read: they hold the drug,
diagnosis, plan and denial reason ClearAuth needs.

Both serialisations are read into one tree whose strings keep their offsets in the letter:
    JSON  an object with "resourceType", alone or in a bundle;
    XML   an element that declares the FHIR namespace, as the default or with any prefix, and what it holds (resources
          are the capitalised elements; a prefix is not part of an element's name). A letter holding a DOCTYPE or an
          entity declaration is not read as XML.
"""

import html
import json
import re
from dataclasses import dataclass


@dataclass(frozen=True)
class Leaf:
    value: str
    start: int
    end: int


_STRING = re.compile(r'"(?:[^"\\]|\\.)*"', re.DOTALL)
_SCALAR = re.compile(r"-?\d[\d.eE+-]*|true|false|null")


def _ws(text: str, i: int) -> int:
    """The first position at or after `i` that is not whitespace."""
    while i < len(text) and text[i].isspace():
        i += 1
    return i


def _end(pattern: re.Pattern[str], text: str, i: int) -> re.Match[str]:
    """The match at `i`; the text was already checked as JSON, so there is one."""
    m = pattern.match(text, i)
    if m is None:
        raise ValueError(f"not JSON at {i}")
    return m


def _json(text: str, i: int):
    """The JSON value at `i` as a tree (dicts, lists, Leafs; other scalars None), and where it ends."""
    i = _ws(text, i)
    if text[i] == "{":
        node, i = {}, _ws(text, i + 1)
        while text[i] != "}":
            key, i = _json(text, i)
            value, i = _json(text, _ws(text, i) + 1)
            node[key.value] = value
            i = _ws(text, i)
            i = _ws(text, i + 1) if text[i] == "," else i
        return node, i + 1
    if text[i] == "[":
        items, i = [], _ws(text, i + 1)
        while text[i] != "]":
            item, i = _json(text, i)
            items.append(item)
            i = _ws(text, i)
            i = _ws(text, i + 1) if text[i] == "," else i
        return items, i + 1
    if text[i] == '"':
        m = _end(_STRING, text, i)
        return Leaf(json.loads(m.group()), i + 1, m.end() - 1), m.end()
    return None, _end(_SCALAR, text, i).end()


def _not_json(name: str):
    raise ValueError(
        f"{name} is not JSON"
    )  # NaN, Infinity: Python's decoder takes them, _json does not


def json_trees(text: str) -> list[dict]:
    """Every JSON object in `text` that starts a line and is a FHIR resource. A block that does not parse (or nests
    too deeply to read) is skipped: the models still read it as text."""
    out, decoder, pos = [], json.JSONDecoder(parse_constant=_not_json), 0
    for m in re.finditer(r"^[ \t]*\{", text, re.MULTILINE):
        if m.end() - 1 < pos:
            continue
        try:
            _, end = decoder.raw_decode(text, m.end() - 1)
            tree, pos = _json(text, m.end() - 1)
        except (ValueError, RecursionError):
            continue
        if '"resourceType"' in text[m.start() : end]:
            out.append(tree)
    return out


_ATTR = r"""\s+[\w:.-]+\s*=\s*(?:"[^"]*"|'[^']*')"""
_TAG = re.compile(rf"<(/?)(?:[A-Za-z_][\w.-]*:)?([A-Za-z][\w.-]*)((?:{_ATTR})*)\s*(/?)>")
_VALUE = re.compile(r"""\bvalue\s*=\s*(["'])(.*?)\1""", re.DOTALL)
_XML_REF = re.compile(r"&(?:#(?:[0-9]+|x[0-9a-fA-F]+)|amp|lt|gt|quot|apos);")
_FHIR_NS = re.compile(r"""\sxmlns(?::[A-Za-z_][\w.-]*)?\s*=\s*["']http://hl7\.org/fhir["']""")


def json_value(raw: str) -> str:
    """Decode a JSON string body's escapes once (a backslash, "u0066" is "f"); the body was already checked as JSON."""
    return json.loads(f'"{raw}"')


def xml_value(raw: str) -> str:
    """Decode XML character references once; offsets still address the unmodified raw attribute."""
    return _XML_REF.sub(lambda m: html.unescape(m.group()), raw)


def _close(stack: list) -> None:
    name, node = stack.pop()
    parent = stack[-1][1]
    if name[0].isupper():  # a resource: its fields sit in the enclosing element
        node["resourceType"] = Leaf(name, 0, 0)
    parent.setdefault(name, []).append(node if len(node) != 1 or "#v" not in node else node["#v"])


def xml_trees(text: str) -> list[dict]:
    """Every FHIR XML element tree in `text`, as the JSON tree's shape: each child a list."""
    if "<!DOCTYPE" in text or "<!ENTITY" in text:
        return []
    out, read_to = [], 0
    for declared in _FHIR_NS.finditer(text):
        if declared.start() < read_to:  # inside the tree just read
            continue
        stack: list = [("#root", {})]
        for m in _TAG.finditer(text, max(text.rfind("<", 0, declared.start()), 0)):
            read_to = m.end()
            closing, name, attrs, empty = m.groups()
            if closing:
                if len(stack) > 1:
                    _close(stack)
                if len(stack) == 1:
                    break
                continue
            node = {}
            v = _VALUE.search(attrs)
            if v:
                node["#v"] = Leaf(
                    xml_value(v.group(2)), m.start(3) + v.start(2), m.start(3) + v.end(2)
                )
            stack.append((name, node))
            if empty:
                _close(stack)
        out.append(stack[0][1])
    return out
