#!/usr/bin/env python3
"""Trains the embedding model used by scoring.js and writes embedding_weights.js.

  user tower      : answers (128 agreements + 128 'category touched' flags) -> MLP -> vector u
  ideology tower  : e_i = Ws . stance_i   (stance_i comes from ideologyScores in data.js)
                    An ideology has no vector of its own, so a new ideology needs its stances only, not retraining.
  score           : logit_i = scale * cos(u, e_i), softmax over all ideologies

It learns from simulated users generated from the definitions: noisy answers of each ideology, with categories
skipped, stray picks, flipped signs, a second ideology mixed in and related values picked from neighbouring
ideologies. Run it from the repo root after changing ideologyScores or the values in data.js:

  node tools/export_data.js          # data.js -> tools/data.json
  python3 tools/train_embedding.py   # tools/data.json -> embedding_weights.js (a minute or two, needs numpy)

Adding an ideology to data.js needs neither step: scoring.js builds its point from its stances.
Adding or removing a value changes the shape of the model, so it needs both steps.
"""
import argparse, json, math
import numpy as np

ap = argparse.ArgumentParser()
ap.add_argument('--steps', type=int, default=12000)
ap.add_argument('--batch', type=int, default=256)
ap.add_argument('--hidden', type=int, default=64)
ap.add_argument('--dim', type=int, default=32)
ap.add_argument('--scale', type=float, default=20.0, help='multiplies the cosines before the softmax')
ap.add_argument('--seed', type=int, default=1)
ap.add_argument('--out', default='embedding_weights.js')
args = ap.parse_args()
rng = np.random.default_rng(args.seed)

d = json.load(open('tools/data.json'))
values, valueCat, labels = d['values'], np.array(d['valueCat']), d['labels']
V, N, C = len(values), len(labels), len(d['categories'])
vidx = {v: i for i, v in enumerate(values)}
lidx = {l: i for i, l in enumerate(labels)}
S = np.zeros((N, V))
for l, st in d['stances'].items():
    for v, s in st.items():
        S[lidx[l], vidx[v]] = s
catValues = [np.where(valueCat == c)[0] for c in range(C)]

def unit(a):
    return a / (np.linalg.norm(a, axis=-1, keepdims=True) + 1e-9)

# ---------------------------------------------------------------- simulated users
# Users who hold ideology y, generated from its stances. They answer only some categories, pick most of the values the
# ideology holds and mark some of the values it opposes as opposite; then the answers get noise: stray picks, flipped
# signs, a second ideology mixed in, and related values picked from neighbouring ideologies.
catmat = np.zeros((C, V)); catmat[valueCat, np.arange(V)] = 1
Sn = S / np.linalg.norm(S, axis=1, keepdims=True)
simil = Sn @ Sn.T; np.fill_diagonal(simil, -1)
NB = np.argsort(-simil, axis=1)[:, :5]                     # the 5 ideologies with the most similar stances

def uni(r, lo, hi, shape):
    return r.uniform(lo, hi, shape)

def gen(y, cfg, r):
    """Agreements (B x V) of simulated users who identify with the ideologies y."""
    B = len(y); st = S[y]
    if cfg.get('mix_p', 0) > 0:                             # some categories are answered like a second ideology
        mixed = r.random(B) < cfg['mix_p']
        j = np.where(r.random(B) < .5, NB[y, r.integers(0, 5, B)], r.integers(0, N, B))
        lam = uni(r, *cfg.get('mix_lam', (.6, 1)), B)
        mine = (r.random((B, C)) < lam[:, None]) | ~mixed[:, None]
        st = np.where(mine[:, valueCat], st, S[j])
    d = uni(r, *cfg['dil'], (B, 1))
    pt = cfg['p_touch']; pt = uni(r, *pt, (B, 1)) if isinstance(pt, tuple) else pt
    touched = r.random((B, C)) < pt
    pb = cfg['pick_base']; pb = uni(r, *pb, (B, 1)) if isinstance(pb, tuple) else pb
    pick = (st > 0) & (r.random((B, V)) < d * (pb + (1 - pb) * st))
    agree = np.where(r.random((B, V)) < cfg['agree_one'], 1.0, uni(r, .4, 1, (B, V)))
    X = np.where(pick, agree, 0.0)
    orate = cfg['opp']; orate = uni(r, *orate, (B, 1)) if isinstance(orate, tuple) else orate
    opp = (st < 0) & (r.random((B, V)) < orate * np.abs(st) * d)
    X = np.where(opp, -uni(r, .5, 1, (B, V)), X)
    if cfg.get('overpick', 0) > 0:
        for k in range(2):
            near = S[NB[y, k]]
            add = (near > 0) & (r.random((B, V)) < cfg['overpick'])
            X = np.where((X == 0) & add, uni(r, .4, 1, (B, V)), X)
    X = X * touched[:, valueCat]
    if cfg.get('eps', 0) > 0:
        X = np.where((X == 0) & touched[:, valueCat] & (r.random((B, V)) < cfg['eps']), uni(r, .4, 1, (B, V)), X)
    if cfg.get('flip', 0) > 0:
        X = np.where(r.random((B, V)) < cfg['flip'], -X, X)
    if cfg.get('single'):                                   # only n random answers
        keys = np.where(X != 0, r.random((B, V)), -1)
        thr = -np.sort(-keys, axis=1)[:, cfg['single'] - 1:cfg['single']]
        X = np.where((keys >= thr) & (X != 0), X, 0.0)
    return X

def to_features(X):
    t = ((X != 0) @ catmat.T > 0).astype(float)[:, valueCat]    # 'category touched' flag of every value
    return np.concatenate([X, t], 1)

TRAIN = dict(dil=(.4, 1), p_touch=(.3, 1), pick_base=(.5, .8), agree_one=.6, opp=(.2, .6), mix_p=.3, mix_lam=(.6, 1),
             overpick=.1, eps=.01, flip=.03)
TEST = {   # harder or different from TRAIN on purpose, to see how the model copes
    'complete answers': dict(dil=(.8, 1), p_touch=1.0, pick_base=.9, agree_one=.8, opp=.6),
    'half the categories': dict(dil=(.8, 1), p_touch=.45, pick_base=.9, agree_one=.8, opp=.6),
    'noisy answers': dict(dil=(.5, 1), p_touch=.8, pick_base=.7, agree_one=.7, opp=.4, eps=.03, flip=.12),
    'two ideologies mixed': dict(dil=(.7, 1), p_touch=.8, pick_base=.8, agree_one=.7, opp=.5, mix_p=1.0, mix_lam=(.55, .8)),
    'many related values': dict(dil=(.8, 1), p_touch=1.0, pick_base=.9, agree_one=.8, opp=.6, overpick=.5),
    'only 3 values': dict(dil=(.8, 1), p_touch=1.0, pick_base=.95, agree_one=.8, opp=.0, single=3),
    'everything at once': dict(dil=(.5, 1), p_touch=.5, pick_base=.7, agree_one=.7, opp=.4, eps=.03, flip=.1, mix_p=1.0, mix_lam=(.55, .8)),
}

def simulate(y, r, cfg=None):
    X = gen(y, TRAIN if cfg is None else cfg, r)
    for b in np.where(~(X != 0).any(1))[0]:                 # nobody answers nothing: give them one held value
        j = np.where(S[y[b]] > 0)[0]
        if len(j):
            X[b, r.choice(j)] = 1.0
    return to_features(X)

# ---------------------------------------------------------------- model
F, H, D = 2 * V, args.hidden, args.dim
P = {
    'W1': rng.normal(0, math.sqrt(2 / F), (F, H)), 'b1': np.zeros(H),
    'W2': rng.normal(0, math.sqrt(1 / H), (H, D)), 'b2': np.zeros(D),
    'Ws': rng.normal(0, 1 / math.sqrt(V), (V, D)),
}
adam_m = {k: np.zeros_like(v) for k, v in P.items()}
adam_v = {k: np.zeros_like(v) for k, v in P.items()}
WD = {'W1': 1e-4, 'W2': 1e-4, 'Ws': 1e-4}

def forward(X, Pm=None, Sm=None):
    Pm = P if Pm is None else Pm
    Sm = S if Sm is None else Sm
    Z1 = X @ Pm['W1'] + Pm['b1']
    Hh = np.maximum(Z1, 0)
    U = Hh @ Pm['W2'] + Pm['b2']
    E = Sm @ Pm['Ws']
    return Z1, Hh, U, E, args.scale * unit(U) @ unit(E).T

def softmax(L):
    L = L - L.max(1, keepdims=True)
    e = np.exp(L)
    return e / e.sum(1, keepdims=True)

def step(X, y, w, lr, t):
    Z1, Hh, U, E, L = forward(X)
    nU = np.linalg.norm(U, axis=1, keepdims=True) + 1e-9
    nE = np.linalg.norm(E, axis=1, keepdims=True) + 1e-9
    Un, En = U / nU, E / nE
    Pr = softmax(L)
    Y = np.zeros_like(Pr); Y[np.arange(len(y)), y] = 1
    Y = 0.97 * Y + 0.03 / N                            # label smoothing
    dL = (Pr - Y) * (w[:, None] / w.sum())
    dUn = args.scale * dL @ En
    dEn = args.scale * dL.T @ Un
    dU = (dUn - Un * (Un * dUn).sum(1, keepdims=True)) / nU
    dE = (dEn - En * (En * dEn).sum(1, keepdims=True)) / nE
    g = {'Ws': S.T @ dE + WD['Ws'] * P['Ws']}
    g['W2'] = Hh.T @ dU + WD['W2'] * P['W2']; g['b2'] = dU.sum(0)
    dZ = (dU @ P['W2'].T) * (Z1 > 0)
    g['W1'] = X.T @ dZ + WD['W1'] * P['W1']; g['b1'] = dZ.sum(0)
    for k in P:
        adam_m[k] = 0.9 * adam_m[k] + 0.1 * g[k]
        adam_v[k] = 0.999 * adam_v[k] + 0.001 * g[k] ** 2
        mh = adam_m[k] / (1 - 0.9 ** t); vh = adam_v[k] / (1 - 0.999 ** t)
        P[k] -= lr * mh / (np.sqrt(vh) + 1e-8)
    return -np.log(Pr[np.arange(len(y)), y] + 1e-12).mean()

def evaluate(X, y, Pm=None, Sm=None):
    L = forward(X, Pm, Sm)[4]
    order = np.argsort(-L, 1)
    top1 = (order[:, 0] == y).mean()
    top3 = np.mean([y[i] in order[i, :3] for i in range(len(y))])
    return top1, top3, -np.log(softmax(L)[np.arange(len(y)), y] + 1e-12).mean()

test_rng = np.random.default_rng(999)
yt = test_rng.integers(0, N, 3000)
Xt = simulate(yt, test_rng)

for t in range(1, args.steps + 1):
    lr = 3e-3 * 0.5 * (1 + math.cos(math.pi * t / args.steps)) + 1e-4
    ys = rng.integers(0, N, args.batch)
    Xs = simulate(ys, rng)
    ws = np.ones(args.batch)
    loss = step(Xs, ys, ws, lr, t)
    if t % 500 == 0 or t == args.steps:
        a1, a3, ll = evaluate(Xt, yt)
        print('step %5d  train loss %.3f | simulated test: top1 %.3f top3 %.3f log-loss %.3f' % (t, loss, a1, a3, ll), flush=True)

# ---------------------------------------------------------------- export (rounded, then re-checked)
def r3(a): return np.round(a, 3).tolist()
KEYS = ['W1', 'b1', 'W2', 'b2', 'Ws']
W = {'version': 2, 'hidden': H, 'dim': D, 'scale': args.scale, 'values': values, 'labels': labels}
for k in KEYS:
    W[k] = r3(P[k])
for k in KEYS:
    P[k] = np.array(W[k])
a1, a3, ll = evaluate(Xt, yt)
print('after rounding to 3 decimals: top1 %.3f top3 %.3f log-loss %.3f' % (a1, a3, ll))
print('harder simulated cases (top1 / top3), %d users each:' % (N * 12))
rt = np.random.default_rng(4242)
for name, cfg in TEST.items():
    yy = np.repeat(np.arange(N), 12); Xx = simulate(yy, rt, cfg)
    t1, t3, _ = evaluate(Xx, yy)
    print('  %-22s %.0f / %.0f' % (name, 100 * t1, 100 * t3))
with open(args.out, 'w') as f:
    f.write('// Generated by tools/train_embedding.py - do not edit by hand.\nconst EMBEDDING_WEIGHTS = ' +
            json.dumps(W, separators=(',', ':')) + ';\n')
print('wrote', args.out)
