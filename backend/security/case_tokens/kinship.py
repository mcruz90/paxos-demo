"""Words that name a relation or a role, never a person: "my father, Anneliese Young". Standard library only.

Decision 0030. A model may label "father" a last name (GLiNER2 did, at 0.448), and a name span that takes it in
spreads the wrong surname across the letter. So a name span's first or last word on these lists is cut off, and a
span of nothing else is dropped. The lists come from published or general sources, never from the letters:

    KINSHIP     HL7 v3 RoleCode 4.0.0, the 111 codes under _PersonalRelationshipRoleType (family members and other
                personal relations): each display's kinship noun, without its modifiers (adopted, natural, foster,
                maternal, paternal, fraternal, identical, gestational, extended, unrelated, former, domestic,
                significant, other) and without "self"; with their English plurals
    INFORMAL    informal English forms of the parent, grandparent and sibling words, from general dictionaries;
                "Ma", "Pa" and "Pop" are left out, as Ma is a common surname
    HONORIFICS  English honorifics, and the Spanish and Portuguese forms
    ROLES       roles the HIPAA transactions and CMS appeals name

A surname on a list ("Parent") is cut too: known identity still covers the patient's own name.
"""

import re

KINSHIP = frozenset(
    "aunt brother brother-in-law child child-in-law cousin daughter daughter-in-law father father-in-law friend "
    "grandchild granddaughter grandfather grandmother grandparent grandson great-grandfather great-grandmother "
    "great-grandparent half-brother half-sibling half-sister husband in-law inlaw member mother mother-in-law "
    "neighbor nephew niece parent parent-in-law partner roommate sibling sibling-in-law sister sister-in-law son "
    "son-in-law spouse stepbrother stepchild stepdaughter stepfather stepmother stepparent stepsibling stepsister "
    "stepson twin uncle wife".split()
)
_PLURALS = {"child": "children", "wife": "wives"}
INFORMAL = frozenset(
    "mom mommy mum mummy mama mamma dad daddy papa grandma grandpa granny gran nana grandad granddad gramps hubby "
    "sis bro".split()
)
HONORIFICS = frozenset("mr mrs ms miss mx dr prof rev sir dame sr sra srta dona".split())
ROLES = frozenset(
    "patient member enrollee subscriber dependent insured cardholder beneficiary caregiver guardian "
    "representative".split()
)


def _plural(word: str) -> str:
    return _PLURALS.get(word) or (
        word.replace("-in-law", "s-in-law") if "-in-law" in word else word + "s"
    )


WORDS = frozenset(
    KINSHIP
    | {_plural(w) for w in KINSHIP}
    | INFORMAL
    | {w + "s" for w in INFORMAL}
    | HONORIFICS
    | ROLES
    | {w + "s" for w in ROLES}
)
_WORD = re.compile(r"[^\W\d_](?:[\w'\-]*\w)?\.?")


def is_relation(word: str) -> bool:
    """Whether `word` names a relation or role: any case, with or without a possessive "'s" or a period."""
    w = word.casefold().rstrip(".")
    for ending in ("'s", "\N{RIGHT SINGLE QUOTATION MARK}s", "s'"):
        if w.endswith(ending) and len(w) > len(ending):
            w = w[: -len(ending)] + ("s" if ending == "s'" else "")
            break
    return w in WORDS


def trim(text: str, start: int, end: int) -> tuple[int, int] | None:
    """`text[start:end]` without relation or role words at either end, and the separators they leave; None when
    nothing else is left. The word right after an honorific is a name, whatever it is ("Mr. Parent")."""
    words = list(_WORD.finditer(text, start, end))
    first = 0
    while first < len(words) and is_relation(words[first].group()):
        first += 1
        if _honorific(words[first - 1].group()) and first < len(words):
            break
    last = len(words)
    while last > first + 1 and is_relation(words[last - 1].group()):
        last -= 1
    if first == last or (
        last == first + 1 and is_relation(words[first].group()) and not _after_title(words, first)
    ):
        return None
    return words[first].start(), words[last - 1].end()


def _honorific(word: str) -> bool:
    return word.casefold().rstrip(".") in HONORIFICS


def _after_title(words: list, i: int) -> bool:
    return i > 0 and _honorific(words[i - 1].group())
