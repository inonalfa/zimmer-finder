"""A small JSON Schema validator (the subset used by schema/*.json), so validation needs no pip install.

Supports: type (incl. lists and "integer"), enum, required, properties, additionalProperties (bool),
items, minLength, minimum, maximum, pattern, $ref to "#/$defs/...".
"""
from __future__ import annotations

import re

TYPES = {
    "string": lambda v: isinstance(v, str),
    "number": lambda v: isinstance(v, (int, float)) and not isinstance(v, bool),
    "integer": lambda v: isinstance(v, int) and not isinstance(v, bool),
    "boolean": lambda v: isinstance(v, bool),
    "array": lambda v: isinstance(v, list),
    "object": lambda v: isinstance(v, dict),
    "null": lambda v: v is None,
}


def _resolve(schema: dict, root: dict) -> dict:
    while "$ref" in schema:
        ref = schema["$ref"]
        if not ref.startswith("#/"):
            raise ValueError(f"unsupported $ref {ref}")
        node = root
        for part in ref[2:].split("/"):
            node = node[part]
        schema = node
    return schema


def errors(value, schema: dict, root: dict | None = None, path: str = "$") -> list[str]:
    root = root or schema
    schema = _resolve(schema, root)
    out: list[str] = []
    t = schema.get("type")
    if t is not None:
        types = t if isinstance(t, list) else [t]
        if not any(TYPES[x](value) for x in types):
            return [f"{path}: expected {'/'.join(types)}, got {type(value).__name__}"]
    if "enum" in schema and value not in schema["enum"]:
        out.append(f"{path}: {value!r} is not one of {schema['enum']}")
    if isinstance(value, str):
        if len(value) < schema.get("minLength", 0):
            out.append(f"{path}: shorter than {schema['minLength']}")
        if "pattern" in schema and not re.search(schema["pattern"], value):
            out.append(f"{path}: {value!r} does not match {schema['pattern']}")
    if TYPES["number"](value):
        if "minimum" in schema and value < schema["minimum"]:
            out.append(f"{path}: {value} < {schema['minimum']}")
        if "maximum" in schema and value > schema["maximum"]:
            out.append(f"{path}: {value} > {schema['maximum']}")
    if isinstance(value, list) and "items" in schema:
        for i, item in enumerate(value):
            out += errors(item, schema["items"], root, f"{path}[{i}]")
    if isinstance(value, dict):
        for k in schema.get("required", []):
            if k not in value:
                out.append(f"{path}: missing required '{k}'")
        props = schema.get("properties", {})
        for k, v in value.items():
            if k in props:
                out += errors(v, props[k], root, f"{path}.{k}")
            elif schema.get("additionalProperties") is False:
                out.append(f"{path}: unexpected property '{k}'")
    return out


def validate_records(records: list, schema: dict) -> list[str]:
    errs = errors(records, schema)
    seen: dict[str, int] = {}
    for i, r in enumerate(records if isinstance(records, list) else []):
        s = isinstance(r, dict) and r.get("slug")
        if s:
            if s in seen:
                errs.append(f"$[{i}]: duplicate slug '{s}' (also at [{seen[s]}])")
            seen[s] = i
        if isinstance(r, dict) and r.get("check_in") and r.get("check_out") and r["check_out"] <= r["check_in"]:
            errs.append(f"$[{i}]: check_out must be after check_in")
    return errs
