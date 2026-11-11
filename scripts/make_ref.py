"""Generate tests/fixtures/ref.json: reference values from scikit-learn, krippendorff and statsmodels.

Development only - CI and `npm test` do not need Python. Regenerate with:

    uv run --with scikit-learn==1.9.1 --with krippendorff==0.9.0 --with statsmodels==0.15.0 \
        python scripts/make_ref.py tests/fixtures/ref.json

The two practice samples in src/samples/ are read from disk, so run this again after
`node scripts/make-samples.mjs`.
"""
import json
import sys
import warnings
from importlib.metadata import version
from pathlib import Path

import numpy as np
import krippendorff
import sklearn
import statsmodels
from sklearn.metrics import cohen_kappa_score, confusion_matrix, matthews_corrcoef
from statsmodels.stats.contingency_tables import mcnemar

ROOT = Path(__file__).resolve().parent.parent
MISSING = {"", "na", "n/a", "null"}

out = {
    "versions": {
        "sklearn": sklearn.__version__,
        "krippendorff": version("krippendorff"),
        "statsmodels": statsmodels.__version__,
        "numpy": np.__version__,
    }
}


def nan_to_none(x):
    x = float(x)
    return None if np.isnan(x) else x


# 1) Cohen kappa: binary pass/fail (skewed) and ordinal 1..5 (weighted)
rng = np.random.default_rng(7)
human_bin = rng.choice(["pass", "fail"], size=200, p=[0.85, 0.15])
judge_bin = np.where(rng.random(200) < 0.88, human_bin, np.where(human_bin == "pass", "fail", "pass"))
human_ord = rng.integers(1, 6, size=150)
judge_ord = np.clip(human_ord + rng.choice([-2, -1, 0, 0, 0, 1, 1], size=150), 1, 5)

out["binary"] = {
    "human": human_bin.tolist(),
    "judge": judge_bin.tolist(),
    "kappa": cohen_kappa_score(human_bin, judge_bin),
    "accuracy": float(np.mean(human_bin == judge_bin)),
    "mcc": matthews_corrcoef(human_bin, judge_bin),
    "labels": ["fail", "pass"],
    "confusion": confusion_matrix(human_bin, judge_bin, labels=["fail", "pass"]).tolist(),
}
out["ordinal"] = {
    "human": human_ord.tolist(),
    "judge": judge_ord.tolist(),
    "accuracy": float(np.mean(human_ord == judge_ord)),
    "kappa": cohen_kappa_score(human_ord, judge_ord),
    "kappa_linear": cohen_kappa_score(human_ord, judge_ord, weights="linear"),
    "kappa_quadratic": cohen_kappa_score(human_ord, judge_ord, weights="quadratic"),
    "confusion": confusion_matrix(human_ord, judge_ord, labels=[1, 2, 3, 4, 5]).tolist(),
}

# Three nominal classes (kappa + multiclass MCC)
cls = np.array(["a", "b", "c"])
h3 = rng.choice(cls, size=120, p=[0.5, 0.3, 0.2])
j3 = np.where(rng.random(120) < 0.7, h3, rng.choice(cls, size=120))
out["multiclass"] = {
    "human": h3.tolist(),
    "judge": j3.tolist(),
    "kappa": cohen_kappa_score(h3, j3),
    "mcc": matthews_corrcoef(h3, j3),
    "labels": cls.tolist(),
    "confusion": confusion_matrix(h3, j3, labels=cls).tolist(),
}

# String ordinal labels: low < mid < high. Weighted kappa must use the user's order, not alphabetical order.
rank = {"low": 0, "mid": 1, "high": 2}
hs = rng.choice(["low", "mid", "high"], size=90, p=[0.3, 0.4, 0.3])
js = np.array([["low", "mid", "high"][int(np.clip(rank[v] + d, 0, 2))] for v, d in zip(hs, rng.choice([-1, 0, 0, 1], size=90))])
hi = [rank[v] for v in hs]
ji = [rank[v] for v in js]
out["string_ordinal"] = {
    "human": hs.tolist(),
    "judge": js.tolist(),
    "order": ["low", "mid", "high"],
    "kappa_linear_ordered": cohen_kappa_score(hi, ji, weights="linear"),
    "kappa_quadratic_ordered": cohen_kappa_score(hi, ji, weights="quadratic"),
    "kappa_quadratic_alphabetical": cohen_kappa_score(hs, js, weights="quadratic"),
}

# 2) Krippendorff (2011) "Computing Krippendorff's Alpha-Reliability" worked example
nan = np.nan
reliability = [
    [1, 2, 3, 3, 2, 1, 4, 1, 2, nan, nan, nan],
    [1, 2, 3, 3, 2, 2, 4, 1, 2, 5, nan, 3],
    [nan, 3, 3, 3, 2, 3, 4, 2, 2, 5, 1, nan],
    [1, 2, 3, 3, 2, 4, 4, 1, 2, 5, 1, nan],
]
out["kripp"] = {"data": [[None if np.isnan(v) else v for v in row] for row in reliability]}
for lvl in ["nominal", "ordinal", "interval", "ratio"]:
    out["kripp"][lvl] = krippendorff.alpha(reliability_data=reliability, level_of_measurement=lvl)

# 3) McNemar: two judge versions, correctness against the human label on the same items
v1_correct = rng.random(120) < 0.72
v2_correct = np.where(rng.random(120) < 0.8, v1_correct, ~v1_correct) | (rng.random(120) < 0.15)
table = [
    [int(np.sum(v1_correct & v2_correct)), int(np.sum(v1_correct & ~v2_correct))],
    [int(np.sum(~v1_correct & v2_correct)), int(np.sum(~v1_correct & ~v2_correct))],
]
ex = mcnemar(table, exact=True)
cc = mcnemar(table, exact=False, correction=True)
out["mcnemar"] = {
    "v1": v1_correct.tolist(),
    "v2": v2_correct.tolist(),
    "table": table,
    "exact_p": float(ex.pvalue),
    "chi2_cc": float(cc.statistic),
    "chi2_cc_p": float(cc.pvalue),
}

# 4) Bootstrap percentile CI for kappa (numpy RNG differs from ours, so tests compare loosely)
idx = np.arange(200)
boots = []
brng = np.random.default_rng(1)
for _ in range(2000):
    s = brng.choice(idx, size=200, replace=True)
    boots.append(cohen_kappa_score(human_bin[s], judge_bin[s]))
out["binary"]["boot_ci95"] = [float(np.percentile(boots, 2.5)), float(np.percentile(boots, 97.5))]

# 5) Boundary cases: what scikit-learn does where we must report NA / 0 explicitly
with warnings.catch_warnings():
    warnings.simplefilter("ignore")
    out["edge"] = {
        "same_single_label_kappa": nan_to_none(cohen_kappa_score(["pass"] * 6, ["pass"] * 6)),
        "judge_single_label_kappa": nan_to_none(cohen_kappa_score(["pass", "fail", "pass", "fail"], ["pass"] * 4)),
        "judge_single_label_mcc": nan_to_none(matthews_corrcoef(["pass", "fail", "pass", "fail"], ["pass"] * 4)),
    }

# 6) The two practice samples, read the way the app reads them (trim, lower-case, drop blank/NA)
def clean(v):
    v = str(v).strip().lower()
    return None if v in MISSING else v


import csv

with open(ROOT / "src/samples/binary-pass-fail.csv", newline="", encoding="utf-8") as f:
    rows = list(csv.DictReader(f))
pairs = [(clean(r["human"]), clean(r["judge"])) for r in rows]
pairs = [(h, j) for h, j in pairs if h is not None and j is not None]
sh = [h for h, _ in pairs]
sj = [j for _, j in pairs]
out["samples"] = {
    "binary": {
        "total": len(rows),
        "n": len(pairs),
        "human": sh,
        "judge": sj,
        "labels": ["fail", "pass"],
        "kappa": cohen_kappa_score(sh, sj),
        "accuracy": float(np.mean(np.array(sh) == np.array(sj))),
        "mcc": matthews_corrcoef(sh, sj),
        "confusion": confusion_matrix(sh, sj, labels=["fail", "pass"]).tolist(),
        "lenient": sum(1 for h, j in pairs if h == "fail" and j == "pass"),
        "strict": sum(1 for h, j in pairs if h == "pass" and j == "fail"),
    }
}

with open(ROOT / "src/samples/ordinal-3raters.jsonl", encoding="utf-8") as f:
    recs = [json.loads(line) for line in f if line.strip()]
humans = np.array([[r["scores"]["human_a"], r["scores"]["human_b"], r["scores"]["human_c"]] for r in recs])
judge = np.array([r["scores"]["judge"] for r in recs])
maj = []
for row in humans:
    vals, counts = np.unique(row, return_counts=True)
    assert counts.max() >= 2, "sample must not contain three-way ties"
    maj.append(int(vals[counts.argmax()]))
maj = np.array(maj)
alpha = {}
for lvl in ["nominal", "ordinal", "interval"]:
    alpha[lvl] = {
        "humans": krippendorff.alpha(reliability_data=humans.T.astype(float), level_of_measurement=lvl),
        "with_judge": krippendorff.alpha(
            reliability_data=np.vstack([humans.T, judge]).astype(float), level_of_measurement=lvl
        ),
    }
out["samples"]["ordinal"] = {
    "n": len(recs),
    "human": maj.tolist(),
    "judge": judge.tolist(),
    "accuracy": float(np.mean(maj == judge)),
    "kappa": cohen_kappa_score(maj, judge),
    "kappa_linear": cohen_kappa_score(maj, judge, weights="linear"),
    "kappa_quadratic": cohen_kappa_score(maj, judge, weights="quadratic"),
    "confusion": confusion_matrix(maj, judge, labels=[1, 2, 3, 4, 5]).tolist(),
    "alpha": alpha,
    "per_rater_kappa": [cohen_kappa_score(humans[:, i], judge) for i in range(3)],
    "mean_diff": float(np.mean(judge - maj)),
}

# 7) Human-only alpha on ALL rows (not only rows that survive the majority/judge filters).
#    Two humans (every disagreement is a 1-1 tie), three humans with ties and gaps, judge missing on some rows.
def alpha_case(name, humans_cols, judge_col, labels):
    code = {l: i for i, l in enumerate(labels)}
    enc = lambda col: [None if v is None else code[v] for v in col]
    hd = np.array([[np.nan if v is None else v for v in enc(c)] for c in humans_cols], dtype=float)
    jd = np.array([[np.nan if v is None else v for v in enc(judge_col)]], dtype=float)
    out[name] = {
        "humans": [list(c) for c in humans_cols],
        "judge": list(judge_col),
        "labels": labels,
        "alpha_humans": krippendorff.alpha(reliability_data=hd, level_of_measurement="nominal"),
        "alpha_with_judge": krippendorff.alpha(reliability_data=np.vstack([hd, jd]), level_of_measurement="nominal"),
    }


arng = np.random.default_rng(11)
n2 = 100
a1 = arng.choice(["pass", "fail"], size=n2, p=[0.6, 0.4])
a2 = np.where(arng.random(n2) < 0.6, a1, np.where(a1 == "pass", "fail", "pass"))
aj = np.where(arng.random(n2) < 0.8, a1, np.where(a1 == "pass", "fail", "pass"))
aj_list = [None if i % 9 == 4 else str(v) for i, v in enumerate(aj)]
alpha_case("alpha_two_humans", [a1.tolist(), a2.tolist()], aj_list, ["fail", "pass"])

n3 = 90
cls3 = np.array(["a", "b", "c"])
b = [[None if arng.random() < 0.07 else v for v in col] for col in [arng.choice(cls3, size=n3).tolist() for _ in range(3)]]
bj = [None if arng.random() < 0.1 else str(v) for v in arng.choice(cls3, size=n3)]
alpha_case("alpha_three_humans", b, bj, ["a", "b", "c"])

# One line per top-level key keeps the diff readable.
dest = Path(sys.argv[1])
dest.parent.mkdir(parents=True, exist_ok=True)
with open(dest, "w", encoding="utf-8") as f:
    f.write("{\n")
    keys = list(out.keys())
    for i, k in enumerate(keys):
        f.write(f"{json.dumps(k)}: {json.dumps(out[k], default=float)}{',' if i < len(keys) - 1 else ''}\n")
    f.write("}\n")
print(out["versions"])
print("binary sample", out["samples"]["binary"]["kappa"], "ordinal sample", out["samples"]["ordinal"]["kappa_quadratic"])
print("edge", out["edge"])
