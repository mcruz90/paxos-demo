"""Static compiled patterns and allowlists for EHR evidence extraction."""

from __future__ import annotations

import re

from etl.ehr_extract.models import ThresholdOperator

_DATE_TOKEN = r"\d{4}-\d{2}-\d{2}|\d{2}/\d{2}/\d{4}"

ICD10_CODE = re.compile(r"(?<![\w.])[A-Z][0-9][0-9A-Z](?:\.[0-9A-Z]{1,4})?(?!\w|\.[A-Z0-9])")
DATED_TRIAL = re.compile(
    rf"^(?:step\s+therapy:\s*)?(?P<drug>[A-Za-z0-9][A-Za-z0-9\s./()-]{{1,80}}?):\s*"
    rf"(?P<start>{_DATE_TOKEN})\s*(?:to|[-–—])\s*(?P<end>{_DATE_TOKEN})\s*"
    r"[;,\-–—]\s*(?P<outcome>failure|intolerance|contraindication|inadequate response|"
    r"completed|discontinued)(?:\s*:\s*(?P<reason>.+?))?\.?$",
    re.IGNORECASE,
)
PEDIATRIC_TRIAL = re.compile(
    r"^(prescription omeprazole|pantoprazole|rabeprazole):\s*"
    r"(?:(failure|contraindication|intolerance)(?::\s*(.{1,300}))?|prescribed)\.?$",
    re.IGNORECASE | re.ASCII,
)
AMBIGUOUS_TRIAL = re.compile(
    r"\b(?:trial|step\s+therapy|started|initiated|ursodiol|methotrexate|"
    r"omeprazole|pantoprazole|rabeprazole|leflunomide)\b",
    re.IGNORECASE,
)
LAB_LINE = re.compile(
    r"^(?P<analyte>[A-Za-z][A-Za-z0-9\s/_-]{0,40}?)\s*:\s*"
    r"(?P<val>\d+(?:\.\d+)?)\s*(?P<unit>[A-Za-z%]+(?:/[A-Za-z0-9]+)?)"
    r"(?:\s*\((?:(?:ref|threshold)\s*)?(?P<op><=|>=|<|>|ULN)\s*"
    r"(?P<tval>\d+(?:\.\d+)?)\s*(?P<tunit>[A-Za-z%]+(?:/[A-Za-z0-9]+)?)?\))?"
    rf"(?:\s+on\s+(?P<obs_date>{_DATE_TOKEN}))?\.?$",
    re.IGNORECASE,
)
LAB_ANALYTES = frozenset(
    {
        "a1c",
        "albumin",
        "alkaline phosphatase",
        "alp",
        "alt",
        "ast",
        "bilirubin",
        "calprotectin",
        "creatinine",
        "crp",
        "egfr",
        "esr",
        "fasting glucose",
        "fecal calprotectin",
        "ferritin",
        "glucose",
        "hba1c",
        "hdl",
        "hemoglobin",
        "hgb",
        "inr",
        "ldl",
        "meld",
        "platelets",
        "plt",
        "potassium",
        "sodium",
        "total bilirubin",
        "triglycerides",
        "tsh",
        "wbc",
    }
)
THRESHOLD_OPS: dict[str, ThresholdOperator] = {
    "<": "<",
    "<=": "<=",
    ">": ">",
    ">=": ">=",
    "ULN": "ULN",
}
SPECIALIST_PRESCRIBER = re.compile(
    rf"^prescriber:\s*(?P<clinician>[^—\-|]+?)\s*[—\-|]\s*(?P<specialty>[^.]+?)(?:\s+on\s+(?P<dt>{_DATE_TOKEN}))?\.?$",
    re.IGNORECASE,
)
SPECIALIST_SIGNER = re.compile(
    rf"^signed\s+by:\s*(?P<clinician>[^(]+?)\s*\((?P<specialty>[^)]+)\)(?:\s+on\s+(?P<dt>{_DATE_TOKEN}))?\.?$",
    re.IGNORECASE,
)
SPECIALIST_CONSULT = re.compile(
    rf"^consultant:\s*(?P<clinician>[^,]+?),\s*(?P<specialty>[^.]+?)(?:\s+on\s+(?P<dt>{_DATE_TOKEN}))?\.?$",
    re.IGNORECASE,
)
DIAGNOSIS_LINE = re.compile(
    rf"^(?:confirmed\s+)?(?:diagnosis|icd-10)\s*:\s*(?P<body>.+?)(?:\s+on\s+(?P<dt>{_DATE_TOKEN}))?\.?$",
    re.IGNORECASE,
)
CLINICAL_CUES = re.compile(
    r"\b(?:adverse|allergic|allergy|alp|alt|ast|hba1c|egfr|bmi|diagnosis|icd-10|trial|"
    r"step\s+therapy|failure|intolerance|contraindication|prescribed|medication|crushed|"
    r"ppi|ppis|reaction|swallow|dysphagia|feeding\s+tube|attestation|decompensation|"
    r"ascites|encephalopathy|bleeding|biopsy|elevated|labs|pending|interpretation|"
    r"unclear|conflict|chart|specialist|hepatology|gastroenterology|rheumatology)\b",
    re.IGNORECASE,
)
