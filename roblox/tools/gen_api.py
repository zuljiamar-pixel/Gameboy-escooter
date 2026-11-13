# Erzeugt api.luau (Klassen, Member, Enums) aus den @rbxts/types-Definitionen.
import re, sys
gen = sys.argv[1]
out = sys.argv[2]
classes = {}
cur = None
for line in open(gen + "/None.d.ts", encoding="utf-8"):
    m = re.match(r"^interface (\w+)", line)
    if m:
        cur = m.group(1)
        sm = re.search(r"extends ([\w.]+)(?:<[^{]*>)?\s*\{\s*$", line)
        classes[cur] = {"super": sm.group(1) if sm else None, "m": {}}
        continue
    if line.startswith("}"):
        cur = None
        continue
    if cur:
        mm = re.match(r"^    (readonly )?(\w+)(\??)(\(|: |<)(.*)", line)
        if mm and not mm.group(2).startswith("_nominal"):
            name = mm.group(2)
            ro = bool(mm.group(1))
            rest = mm.group(4) + mm.group(5)
            if rest.startswith("(") or rest.startswith("<"):
                kind, typ = "method", ""
            else:
                typ = mm.group(5).rstrip(";").strip()
                if typ.startswith("RBXScriptSignal"):
                    kind = "signal"
                elif "=>" in typ and typ.startswith("("):
                    kind = "callback"
                else:
                    kind = "prop"
            if name not in classes[cur]["m"]:
                classes[cur]["m"][name] = (kind, typ, ro)
enums = {}
cur = None
for line in open(gen + "/enums.d.ts", encoding="utf-8"):
    m = re.match(r"^    export namespace (\w+) \{", line)
    if m:
        cur = m.group(1); enums.setdefault(cur, [])
        continue
    if re.match(r"^    \}", line):
        cur = None
        continue
    if cur:
        mm = re.match(r"^        export const (\w+): ", line)
        if mm and mm.group(1) not in enums[cur]:
            enums[cur].append(mm.group(1))
def q(s): return '"' + s.replace("\\", "\\\\").replace('"', '\\"') + '"'
with open(out, "w") as f:
    f.write("return {\nclasses = {\n")
    for c, d in classes.items():
        f.write("[%s] = { super = %s, m = {\n" % (q(c), q(d["super"]) if d["super"] else "nil"))
        for n, (k, t, ro) in d["m"].items():
            f.write("[%s] = { %s, %s, %s },\n" % (q(n), q(k), q(t), "true" if ro else "false"))
        f.write("}},\n")
    f.write("},\nenums = {\n")
    for e, items in enums.items():
        f.write("[%s] = { %s },\n" % (q(e), ", ".join(q(i) for i in items)))
    f.write("},\n}\n")
print(len(classes), "classes", len(enums), "enums")
