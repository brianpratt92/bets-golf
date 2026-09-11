import React, { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { supabase, SYNC_ON } from "./supabase";
import underdawgzLogo from "./assets/underdawgz.png";
import lifemaxxingLogo from "./assets/lifemaxxing.png";

/* ─── COURSES ────────────────────────────────────────────────── */
const COURSES = {
  sandhollow: { code:"SH", name:"Sand Hollow Resort", short:"Sand Hollow", sub:"Championship · Hurricane, UT",
    par:[4,5,3,4,4,4,5,3,4,5,3,4,4,4,3,4,5,4],
    hcp:[15,7,17,5,13,1,3,11,9,10,16,2,14,4,8,18,12,6] },
  copperrock: { code:"CR", name:"Copper Rock", short:"Copper Rock", sub:"Hurricane, UT",
    par:[5,4,4,3,5,4,3,4,4,4,4,5,4,4,3,5,3,4],
    hcp:[14,2,16,12,8,18,4,6,10,7,9,13,1,3,17,11,15,5] },
  blackdesert: { code:"BD", name:"Black Desert", short:"Black Desert", sub:"Ivins, UT",
    par:[4,4,3,4,4,4,5,3,5,4,4,4,5,4,3,4,3,5],
    hcp:[9,11,15,1,13,5,3,17,7,14,2,6,10,16,12,4,18,8] },
  ledges: { code:"LG", name:"The Ledges", short:"The Ledges", sub:"St. George, UT",
    par:[4,3,5,4,3,4,5,4,4,3,5,3,4,4,4,5,4,4],
    hcp:[15,7,3,9,17,11,1,13,5,8,4,18,16,14,12,2,6,10] },
  coralcanyon: { code:"CC", name:"Coral Canyon", short:"Coral Canyon", sub:"Washington, UT",
    par:[4,3,4,3,5,4,5,3,5,4,5,3,4,4,3,5,4,4],
    hcp:[9,15,5,7,13,1,17,11,3,6,10,12,8,2,16,18,14,4] },
};

/* ─── TEAMS ──────────────────────────────────────────────────── */
const TEAM_A = { name:"Lifemaxxing", short:"Lifemaxx", logo:lifemaxxingLogo,
                 players:["Mark","Brian","Paul","James"] };
const TEAM_B = { name:"UnderDawgz",  short:"Dawgz",    logo:underdawgzLogo,
                 players:["Adam","Casey","Michael","Timothy"] };
const ALL = [...TEAM_A.players, ...TEAM_B.players];
const teamOf = p => TEAM_A.players.includes(p) ? "A" : "B";

/* ─── FORMATS (locked) ───────────────────────────────────────── */
/* pick  : how a side's counting value is built from its players' net scores
   mode  : "holes" = hole winners drive segments · "points" = totals drive segments
   scope : "group" one match per foursome · "group2" two 1v1s per foursome · "all" one 8-player match */
const FORMATS = {
  bb2:     { label:"2v2 Best Ball Match Play", scope:"group",  mode:"holes",  pick:"best1", segPts:1,
             note:"One 2v2 match per foursome. Lowest net ball on each side wins the hole. Front, back and overall worth 1 point each." },
  agg3:    { label:"4v4 Aggregate Match Play", scope:"all",    mode:"holes",  pick:"best3", segPts:2,
             note:"All eight in one match. Three best net scores per side count each hole; lower total wins the hole. Front, back and overall worth 2 points each." },
  sf2:     { label:"2v2 Aggregate Stableford", scope:"group",  mode:"points", pick:"sfsum", segPts:1,
             note:"One 2v2 pairing per foursome. Both players' net points count and add up — highest aggregate takes the front nine, the back nine and the total, 1 point each." },
  singles: { label:"Singles Match Play",       scope:"group2", mode:"holes",  pick:"best1", segPts:1,
             note:"Two 1v1 matches per foursome. Front, back and overall worth 1 point each, so 3 per match." },
};

const ROUNDS = [
  { n:1, day:"Thu 9/10", time:"7:22 AM", course:"sandhollow",  tee:"Signature", format:"bb2" },
  { n:2, day:"Thu 9/10", time:"2:12 PM", course:"copperrock",  tee:"Gold",      format:"agg3" },
  { n:3, day:"Fri 9/11", time:"3:48 PM", course:"blackdesert", tee:"Weiskopf",  format:"sf2" },
  { n:4, day:"Sat 9/12", time:"7:40 AM", course:"ledges",      tee:"Blue",      format:"bb2" },
  { n:5, day:"Sat 9/12", time:"2:40 PM", course:"coralcanyon", tee:"Blue",      format:"singles" },
];
const roundPts = r => {
  const f = FORMATS[r.format];
  const matches = f.scope==="all" ? 1 : f.scope==="group2" ? 4 : 2;
  return matches * f.segPts * 3;
};
const TOTAL_PTS = ROUNDS.reduce((t,r)=>t+roundPts(r), 0);

const BASE_GROUPS = [["Mark","Brian","Adam","Casey"],["Paul","James","Michael","Timothy"]];
const emptyScores = () => Object.fromEntries(ALL.map(p => [p, Array(18).fill(null)]));
const clone = x => JSON.parse(JSON.stringify(x));
const pairsFromGroups = groups => groups.map(g => {
  const a = g.filter(p=>teamOf(p)==="A"), b = g.filter(p=>teamOf(p)==="B");
  return a.map((p,i) => b[i] ? [p, b[i]] : null).filter(Boolean);
});

/* Saved pairings can drift out of step with the groups — someone moves
   foursome, or the same name gets picked in both dropdowns. This keeps
   whatever is still valid, drops the rest, and pairs off anyone left over,
   so every player in a foursome ends up in exactly one match. */
function resolvePairs(groups, pairs) {
  return groups.map((g, i) => {
    const aPool = g.filter(p => teamOf(p)==="A");
    const bPool = g.filter(p => teamOf(p)==="B");
    const usedA = new Set(), usedB = new Set(), out = [];
    (pairs?.[i] || []).forEach(pr => {
      if (!Array.isArray(pr) || pr.length < 2) return;
      const [x, y] = pr;
      if (aPool.includes(x) && bPool.includes(y) && !usedA.has(x) && !usedB.has(y)) {
        usedA.add(x); usedB.add(y); out.push([x, y]);
      }
    });
    const restA = aPool.filter(p => !usedA.has(p));
    const restB = bPool.filter(p => !usedB.has(p));
    while (restA.length && restB.length) out.push([restA.shift(), restB.shift()]);
    return out;
  });
}

/* ─── HANDICAPS ──────────────────────────────────────────────── */
const ALLOWANCE = 0.9;
const playing = raw => raw==="" || raw==null ? 0 : Math.round(Number(raw) * ALLOWANCE);
const emptyHcp = () => Object.fromEntries(
  Object.keys(COURSES).map(k => [k, Object.fromEntries(ALL.map(p=>[p,""]))]));

/* ─── SCORING ────────────────────────────────────────────────── */
function strokesOnHole(chc, rank) {
  const c = Math.round(Number(chc)||0);
  if (c >= 0) return Math.floor(c/18) + (rank <= c%18 ? 1 : 0);
  const a = -c;
  return -(Math.floor(a/18) + (rank > 18-(a%18) ? 1 : 0));
}
const netOf = (gross, chc, rank) => gross==null ? null : gross - strokesOnHole(chc, rank);
/* Custom Stableford scale (net result against par):
   double bogey or worse -1 · bogey 0 · par 2 · birdie 4 · eagle 7 · albatross 10 */
const SF_TABLE = [
  { d:-3, pts:10, label:"Albatross" },
  { d:-2, pts:7,  label:"Eagle" },
  { d:-1, pts:4,  label:"Birdie" },
  { d: 0, pts:2,  label:"Par" },
  { d: 1, pts:0,  label:"Bogey" },
  { d: 2, pts:-1, label:"Double+" },
];
const sfPts = (net, par) => net==null ? null
  : (net-par <= -3 ? 10 : net-par === -2 ? 7 : net-par === -1 ? 4
     : net-par === 0 ? 2 : net-par === 1 ? 0 : -1);

function sideValue(pick, players, h, ctx) {
  const { scores, chc, course } = ctx;
  if (pick === "sfsum") {
    const pts = players.map(p => sfPts(netOf(scores[p][h], chc[p], course.hcp[h]), course.par[h]))
                       .filter(v=>v!=null);
    return pts.length === players.length ? pts.reduce((a,b)=>a+b,0) : null;
  }
  const nets = players.map(p => netOf(scores[p][h], chc[p], course.hcp[h])).filter(v=>v!=null);
  if (!nets.length) return null;
  const s = [...nets].sort((x,y)=>x-y);
  if (pick === "best1") return s[0];
  if (pick === "best3") return nets.length < 3 ? null : s.slice(0,3).reduce((a,b)=>a+b,0);
  return s[0];
}

function segment(holes, from, to, mode, segPts) {
  let a=0, b=0, played=0;
  for (let i=from; i<to; i++) {
    const h = holes[i];
    if (h.a==null || h.b==null) continue;
    played++;
    if (mode === "holes") { if (h.w==="A") a++; else if (h.w==="B") b++; }
    else { a += h.a; b += h.b; }
  }
  const total = to - from;
  const left = total - played;
  const done = played === total;
  /* match play can end early: more holes up than holes remaining */
  const clinched = mode==="holes" && played>0 && Math.abs(a-b) > left;
  const settled = done || clinched;
  const winner = !played ? null : a===b ? "tie" : a>b ? "A" : "B";
  const aPts = settled ? (winner==="A" ? segPts : winner==="tie" ? segPts/2 : 0) : 0;
  const bPts = settled ? (winner==="B" ? segPts : winner==="tie" ? segPts/2 : 0) : 0;
  /* 3&2 style label once a match segment is clinched */
  const label = clinched && !done ? `${Math.abs(a-b)}&${left}` : null;
  return { a, b, played, total, left, winner, aPts, bPts, done, settled, label };
}

function evalMatch(m, f, ctx) {
  const holes = Array.from({length:18}, (_,h) => {
    const a = sideValue(f.pick, m.a, h, ctx);
    const b = sideValue(f.pick, m.b, h, ctx);
    let w = null;
    if (a!=null && b!=null)
      w = a===b ? "H" : (f.mode==="points" ? (a>b?"A":"B") : (a<b?"A":"B"));
    return { a, b, w };
  });
  const front   = segment(holes, 0, 9,  f.mode, f.segPts);
  const back    = segment(holes, 9, 18, f.mode, f.segPts);
  const overall = segment(holes, 0, 18, f.mode, f.segPts);
  const played  = holes.reduce((t,x,i)=> (x.a!=null&&x.b!=null) ? i+1 : t, 0);
  return { ...m, holes, front, back, overall, played,
           aPts: front.aPts+back.aPts+overall.aPts,
           bPts: front.bPts+back.bPts+overall.bPts };
}

function buildMatches(round, groups, pairs) {
  const f = FORMATS[round.format];
  if (f.scope === "group")
    return groups.map((g,i)=>({ key:`g${i}`, group:i,
      a:g.filter(p=>teamOf(p)==="A"), b:g.filter(p=>teamOf(p)==="B") }));
  if (f.scope === "group2") {
    const fixed = resolvePairs(groups, pairs);
    return groups.flatMap((g,i)=>fixed[i].map((pr,j)=>({
      key:`g${i}m${j}`, group:i, a:[pr[0]], b:[pr[1]] })));
  }
  return [{ key:"all", group:null, a:TEAM_A.players, b:TEAM_B.players }];
}

function evalRound(round, st, hcpTable) {
  const course = COURSES[round.course];
  const f = FORMATS[round.format];
  /* full 90% figure — used for the archive and the Stats tab */
  const chc = Object.fromEntries(ALL.map(p => [p, playing(hcpTable[round.course][p])]));

  /* Every match plays off its own low handicap: the lowest player in the
     match gets zero strokes and everyone else gets the difference.
     2v2 uses the four in that foursome, the 4v4 uses all eight,
     singles uses the two in that match. */
  const rel = {}, oppOf = {};
  const results = buildMatches(round, st.groups, st.pairs).map(m => {
    const roster = [...m.a, ...m.b];
    const low = roster.length ? Math.min(...roster.map(p => chc[p])) : 0;
    const mRel = Object.fromEntries(roster.map(p => [p, chc[p] - low]));
    Object.assign(rel, mRel);
    if (m.a.length === 1 && m.b.length === 1) { oppOf[m.a[0]] = m.b[0]; oppOf[m.b[0]] = m.a[0]; }
    const r = evalMatch(m, f, { scores: st.scores, chc: mRel, course });
    return { ...r, low, rel: mRel };
  });

  return {
    results, chc, rel, oppOf, f, course,
    aPts: results.reduce((t,r)=>t+r.aPts, 0),
    bPts: results.reduce((t,r)=>t+r.bPts, 0),
    played: Math.max(0, ...results.map(r=>r.played)),
  };
}

/* ─── LOCAL PREFS ────────────────────────────────────────────────
   Per-device, not shared. Survives refresh so the app reopens where
   you left it. Wrapped because private browsing can throw. */
const LS = {
  get(k, d) { try { const v = localStorage.getItem(k); return v==null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* ignore */ } },
};

/* ─── WRITE QUEUE ────────────────────────────────────────────────
   Every write goes through here. If a write fails — dead spot on the
   course, phone asleep — it stays queued and retries, so a lost signal
   costs nothing but a delay. */
function useWriteQueue() {
  const q = useRef([]);
  const busy = useRef(false);
  const [pending, setPending] = useState(0);
  const [failing, setFailing] = useState(false);

  const flush = useCallback(async () => {
    if (busy.current || !q.current.length) return;
    busy.current = true;
    while (q.current.length) {
      try {
        const { error } = await q.current[0]();
        if (error) throw error;
        q.current.shift();
        setPending(q.current.length);
        setFailing(false);
      } catch {
        busy.current = false;
        setFailing(true);
        setTimeout(flush, 4000);
        return;
      }
    }
    busy.current = false;
  }, []);

  const push = useCallback(fn => {
    if (!SYNC_ON) return;
    q.current.push(fn);
    setPending(q.current.length);
    flush();
  }, [flush]);

  useEffect(() => {
    const on = () => flush();
    window.addEventListener("online", on);
    return () => window.removeEventListener("online", on);
  }, [flush]);

  return { push, pending, failing };
}

/* ─── APP ────────────────────────────────────────────────────── */
export default function App() {
  const [tab,setTab] = useState(() => LS.get("bets.tab", "live"));
  const [roundN,setRoundN] = useState(() => LS.get("bets.round", 1));
  useEffect(() => { LS.set("bets.round", roundN); }, [roundN]);
  useEffect(() => { LS.set("bets.tab", tab); }, [tab]);
  const [hcpTable,setHcpTable] = useState(emptyHcp);
  const [state,setState] = useState(() => Object.fromEntries(ROUNDS.map(r => {
    const groups = clone(BASE_GROUPS);
    return [r.n, { groups, pairs: pairsFromGroups(groups), scores: emptyScores() }];
  })));
  const [archive,setArchive] = useState([]);
  const [loaded,setLoaded] = useState(!SYNC_ON);
  const { push, pending, failing } = useWriteQueue();

  const round = ROUNDS.find(r=>r.n===roundN);
  const st = state[roundN];
  const ev = useMemo(()=>evalRound(round, st, hcpTable), [round, st, hcpTable]);
  const allEv = useMemo(()=>ROUNDS.map(r=>evalRound(r, state[r.n], hcpTable)), [state, hcpTable]);
  const totals = allEv.reduce((t,r)=>({a:t.a+r.aPts, b:t.b+r.bPts}), {a:0,b:0});

  /* ── initial load ── */
  useEffect(() => {
    if (!SYNC_ON) return;
    let dead = false;
    (async () => {
      const [h, s, g, a] = await Promise.all([
        supabase.from("bets_handicaps").select("*"),
        supabase.from("bets_scores").select("*"),
        supabase.from("bets_groups").select("*"),
        supabase.from("bets_archive").select("*").order("round_n"),
      ]);
      if (dead) return;
      if (h.data?.length) setHcpTable(t => {
        const n = clone(t);
        h.data.forEach(r => { if (n[r.course_key] && r.player in n[r.course_key])
          n[r.course_key][r.player] = r.raw_hcp==null ? "" : Number(r.raw_hcp); });
        return n;
      });
      setState(prev => {
        const n = clone(prev);
        g.data?.forEach(r => { if (n[r.round_n]) { n[r.round_n].groups = r.groups; n[r.round_n].pairs = r.pairs; } });
        s.data?.forEach(r => { if (n[r.round_n]?.scores[r.player]) n[r.round_n].scores[r.player][r.hole] = r.gross; });
        return n;
      });
      if (a.data?.length) setArchive(a.data.map(r => r.payload));
      /* First visit on this device: land on the round being played rather
         than round 1 — the highest-numbered round that has any scores. */
      if (LS.get("bets.round", null) == null && s.data?.length) {
        const live = [...ROUNDS].reverse().find(r => s.data.some(x => x.round_n === r.n));
        if (live) setRoundN(live.n);
      }
      setLoaded(true);
    })();
    return () => { dead = true; };
  }, []);

  /* ── live updates from other phones ── */
  useEffect(() => {
    if (!SYNC_ON) return;
    const ch = supabase.channel("bets-live")
      .on("postgres_changes", { event:"*", schema:"public", table:"bets_scores" }, ({ eventType, new:nw, old }) => {
        const r = eventType === "DELETE" ? old : nw;
        if (!r) return;
        setState(prev => {
          const cur = prev[r.round_n];
          if (!cur?.scores[r.player]) return prev;
          const scores = { ...cur.scores, [r.player]: [...cur.scores[r.player]] };
          scores[r.player][r.hole] = eventType === "DELETE" ? null : r.gross;
          return { ...prev, [r.round_n]: { ...cur, scores } };
        });
      })
      .on("postgres_changes", { event:"*", schema:"public", table:"bets_handicaps" }, ({ new:nw }) => {
        if (!nw) return;
        setHcpTable(t => t[nw.course_key]
          ? { ...t, [nw.course_key]: { ...t[nw.course_key],
              [nw.player]: nw.raw_hcp==null ? "" : Number(nw.raw_hcp) } }
          : t);
      })
      .on("postgres_changes", { event:"*", schema:"public", table:"bets_groups" }, ({ new:nw }) => {
        if (!nw) return;
        setState(prev => prev[nw.round_n]
          ? { ...prev, [nw.round_n]: { ...prev[nw.round_n], groups:nw.groups, pairs:nw.pairs } }
          : prev);
      })
      .on("postgres_changes", { event:"*", schema:"public", table:"bets_archive" }, async () => {
        const { data } = await supabase.from("bets_archive").select("*").order("round_n");
        if (data) setArchive(data.map(r => r.payload));
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  /* ── writes ── */
  const setScore = (p,h,v) => {
    setState(s => {
      const cur = s[roundN];
      const scores = { ...cur.scores, [p]: [...cur.scores[p]] };
      scores[p][h] = v;
      return { ...s, [roundN]: { ...cur, scores } };
    });
    push(() => v == null
      ? supabase.from("bets_scores").delete().match({ round_n:roundN, player:p, hole:h })
      : supabase.from("bets_scores").upsert(
          { round_n:roundN, player:p, hole:h, gross:v, updated_at:new Date().toISOString() },
          { onConflict:"round_n,player,hole" }));
  };

  const setHcp = (courseKey, player, raw) => {
    setHcpTable(t => ({ ...t, [courseKey]: { ...t[courseKey], [player]: raw } }));
    push(() => supabase.from("bets_handicaps").upsert(
      { course_key:courseKey, player, raw_hcp: raw==="" ? null : Number(raw),
        updated_at:new Date().toISOString() },
      { onConflict:"course_key,player" }));
  };

  const saveGroups = (groups, pairs) => {
    setState(s => ({ ...s, [roundN]: { ...s[roundN], groups, pairs } }));
    push(() => supabase.from("bets_groups").upsert(
      { round_n:roundN, groups, pairs, updated_at:new Date().toISOString() },
      { onConflict:"round_n" }));
  };
  const moveToGroup = (player, to) => {
    const groups = st.groups.map(g => g.filter(p => p !== player));
    groups[to] = [...groups[to], player];
    saveGroups(groups, pairsFromGroups(groups));
  };
  const setPairs = pairs => saveGroups(st.groups, pairs);

  const hasScores = ALL.some(p => st.scores[p].some(v => v != null));
  const clearScores = () => {
    if (!window.confirm(`Clear all scores for Round ${roundN}? This clears them for everyone.`)) return;
    setState(s => ({ ...s, [roundN]: { ...s[roundN], scores: emptyScores() } }));
    push(() => supabase.from("bets_scores").delete().eq("round_n", roundN));
  };

  const saveToArchive = () => {
    const payload = { id:Date.now(), roundN, date:new Date().toLocaleString(),
      course:round.course, tee:round.tee, format:round.format,
      groups:clone(st.groups), chc:{...ev.chc}, rel:{...ev.rel},
      raw:Object.fromEntries(ALL.map(p=>[p, hcpTable[round.course][p]])),
      scores:clone(st.scores), aPts:ev.aPts, bPts:ev.bPts,
      results:ev.results.map(r=>({ a:r.a, b:r.b, aPts:r.aPts, bPts:r.bPts,
        front:[r.front.a,r.front.b], back:[r.back.a,r.back.b], overall:[r.overall.a,r.overall.b] })) };
    setArchive(a => [payload, ...a.filter(x=>x.roundN!==roundN)]);
    push(() => supabase.from("bets_archive").upsert(
      { round_n:roundN, payload, saved_at:new Date().toISOString() },
      { onConflict:"round_n" }));
    setTab("archive");
  };
  const removeArchive = roundNum => {
    setArchive(a => a.filter(x => x.roundN !== roundNum));
    push(() => supabase.from("bets_archive").delete().eq("round_n", roundNum));
  };

  const resetAll = () => {
    if (!window.confirm(
      "Clear ALL scores and ALL archived rounds for every round?\n\n" +
      "Handicaps and groups are kept. This affects everyone.")) return;
    if (!window.confirm("Last chance — this cannot be undone. Press OK to wipe.")) return;
    setState(s => Object.fromEntries(
      Object.entries(s).map(([n,r]) => [n, { ...r, scores: emptyScores() }])));
    setArchive([]);
    push(() => supabase.from("bets_scores").delete().gte("round_n", 0));
    push(() => supabase.from("bets_archive").delete().gte("round_n", 0));
  };

  return (<>
    <style>{CSS}</style>
    <div className="app">
      <header className="top">
        <div>
          <div className="wordmark">BETS</div>
          <div className="tag">St. George · Sept 10–13
            <i className={"sync "+(!SYNC_ON?"off":failing?"bad":pending?"wait":"ok")}>
              {!SYNC_ON ? "local only" : failing ? `retrying ${pending}` : pending ? `saving ${pending}` : "live"}
            </i>
          </div>
        </div>
        <div className="tally">
          <img className="tick" src={TEAM_A.logo} alt={TEAM_A.name}/>
          <span className="tA">{fmt(totals.a)}</span><span className="dash">–</span>
          <span className="tB">{fmt(totals.b)}</span>
          <img className="tick" src={TEAM_B.logo} alt={TEAM_B.name}/>
        </div>
      </header>
      <div className="roundbar">
        <select value={roundN} onChange={e=>setRoundN(+e.target.value)}>
          {ROUNDS.map((r,i)=><option key={r.n} value={r.n}>
            R{r.n} · {COURSES[r.course].short} · {FORMATS[r.format].label}
            {allEv[i].played ? ` · thru ${allEv[i].played}` : ""}</option>)}
        </select>
        <div className="rmeta">{round.day} · {round.time} · {round.tee} tees · {roundPts(round)} pts</div>
      </div>
      <nav className="tabs">
        {[["live","Live"],["round","Round"],["hcp","Hcps"],["archive","Archive"],
          ["stats","Stats"],["std","Points"]]
          .map(([id,l])=><button key={id} className={tab===id?"on":""} onClick={()=>setTab(id)}>{l}</button>)}
      </nav>
      {!loaded && <div className="loading">Loading scores…</div>}
      {tab==="live"    && <Live round={round} ev={ev} totals={totals} allEv={allEv}/>}
      {tab==="round"   && <Round key={`${roundN}-${loaded}`} round={round} st={st} ev={ev} setScore={setScore}
                            clearScores={clearScores} moveToGroup={moveToGroup} hasScores={hasScores}
                            setPairs={setPairs} onArchive={saveToArchive}
                            archived={archive.some(a=>a.roundN===roundN)}/>}
      {tab==="hcp"     && <Handicaps hcpTable={hcpTable} setHcp={setHcp}/>}
      {tab==="archive" && <Archive archive={archive} onDelete={removeArchive}/>}
      {tab==="stats"   && <Stats archive={archive}/>}
      {tab==="std"     && <Standings allEv={allEv} totals={totals} resetAll={resetAll}/>}
    </div>
  </>);
}
const fmt = n => Number.isInteger(n) ? n : n.toFixed(1);
const sum = a => a.reduce((t,v)=>t+(v??0), 0);
const cls = (v,par) => v==null ? "" :
  (v-par<=-2?"eagle" : v-par===-1?"birdie" : v-par===0?"parr" : v-par===1?"bogey":"dbl");

/* ─── SHARED ─────────────────────────────────────────────────── */
const Big = ({a,b,mid,sub}) => (
  <div className="bigscore">
    <div className="side sideA">
      <div className="crest"><img src={TEAM_A.logo} alt={TEAM_A.name}/></div>
      <div className="sname">{TEAM_A.name}</div><div className="sval">{fmt(a)}</div>
    </div>
    <div className="mid"><div className="midlabel">{mid}</div>{sub&&<div className="midsub">{sub}</div>}</div>
    <div className="side sideB">
      <div className="crest"><img src={TEAM_B.logo} alt={TEAM_B.name}/></div>
      <div className="sname">{TEAM_B.name}</div><div className="sval">{fmt(b)}</div>
    </div>
  </div>
);

/* three-segment strip for one match */
function Segments({ m, mode, compact }) {
  const rows = [["Front 9", m.front], ["Back 9", m.back], ["Overall", m.overall]];
  const unit = mode==="points" ? "pts" : "holes";
  return (
    <div className={"segs"+(compact?" compact":"")}>
      {rows.map(([label, s]) => (
        <div className="seg" key={label}>
          <div className="seg-l">{label}</div>
          <div className="seg-v">
            <b className={s.winner==="A"?"lead":""}>{s.a}</b>
            <span>–</span>
            <b className={s.winner==="B"?"lead":""}>{s.b}</b>
          </div>
          <div className="seg-u">
            {!s.played ? "—" : s.label ? s.label : `${unit} · ${s.played}/${s.total}`}
          </div>
          <div className={"seg-p"+(!s.settled?" open":s.aPts>s.bPts?" pA":s.bPts>s.aPts?" pB":"")}>
            {!s.played ? "0 – 0" : s.settled ? `${fmt(s.aPts)} – ${fmt(s.bPts)}` : "in play"}
          </div>
        </div>))}
    </div>
  );
}

const Tracker = ({ ev }) => (
  <div className="tracker">
    <div className="trk-h"><span>Live tracker</span>
      <span className="trk-pts">{fmt(ev.aPts)} – {fmt(ev.bPts)} this round</span></div>
    {ev.results.map(m => (
      <div className="trk-m" key={m.key}>
        <div className="trk-r">
          <div className={"trk-t"+(m.aPts>m.bPts?" lead":"")}>{m.a.join(" & ")}</div>
          <div className="trk-s">{m.played ? `thru ${m.played}` : "—"}</div>
          <div className={"trk-t right"+(m.bPts>m.aPts?" lead":"")}>{m.b.join(" & ")}</div>
        </div>
        <Segments m={m} mode={ev.f.mode} compact/>
      </div>))}
  </div>
);

/* ─── LIVE ───────────────────────────────────────────────────── */
function Live({ round, ev, totals, allEv }) {
  const course = COURSES[round.course];
  return (
    <div className="pad">
      <Big a={totals.a} b={totals.b} mid="Cup" sub={`${TOTAL_PTS} points`}/>
      <div className="courseband">
        <div><div className="cname">{course.name}</div><div className="csub">{course.sub}</div></div>
        <div className="fmtpill">{ev.f.label}</div>
      </div>
      <p className="blurb">{ev.f.note}</p>
      <Tracker ev={ev}/>
      <div className="minitable">
        <div className="mt-h">All rounds</div>
        {ROUNDS.map((r,i)=>(
          <div className="mt-r" key={r.n}>
            <span className="mt-n">R{r.n}</span>
            <span className="mt-c">{COURSES[r.course].short}</span>
            <span className="mt-s">{allEv[i].played ? `thru ${allEv[i].played}` : "—"}</span>
            <span className="mt-p">{fmt(allEv[i].aPts)} – {fmt(allEv[i].bPts)}</span>
            <span className="mt-w">/{roundPts(r)}</span>
          </div>))}
      </div>
    </div>
  );
}

/* ─── HANDICAPS ──────────────────────────────────────────────── */
function Handicaps({ hcpTable, setHcp }) {
  const keys = Object.keys(COURSES);
  const set = (ck, p, v) => setHcp(ck, p, v==="" ? "" : +v);
  return (
    <div className="pad">
      <div className="hnote">
        <b>Course handicaps</b>
        <p>Enter each player's full course handicap for all five courses. The app plays everything
           off {Math.round(ALLOWANCE*100)}% of that number, rounded to the nearest stroke, and every
           scorecard pulls its allowance from this table.</p>
      </div>
      <div className="card-wrap"><div className="scroll">
        <table className="hcptable">
          <thead>
            <tr>
              <th className="stick" rowSpan={2}>Player</th>
              <th colSpan={keys.length} className="grp-raw">Full course handicap</th>
              <th colSpan={keys.length} className="grp-play">Playing ({Math.round(ALLOWANCE*100)}%)</th>
            </tr>
            <tr>
              {keys.map(k=><th key={"r"+k} className="grp-raw">{COURSES[k].code}</th>)}
              {keys.map(k=><th key={"p"+k} className="grp-play">{COURSES[k].code}</th>)}
            </tr>
          </thead>
          <tbody>
            {ALL.map(p=>(
              <tr key={p} className={"t"+teamOf(p)}>
                <th className="stick">{p}</th>
                {keys.map(k=>(
                  <td key={"r"+k} className="cell">
                    <input inputMode="numeric" value={hcpTable[k][p]} placeholder="–"
                      onChange={e=>set(k, p, e.target.value.replace(/[^\d.-]/g,""))}/>
                  </td>))}
                {keys.map(k=>(
                  <td key={"p"+k} className="playcell">
                    {hcpTable[k][p]==="" ? "–" : playing(hcpTable[k][p])}
                  </td>))}
              </tr>))}
          </tbody>
        </table>
      </div></div>
      <div className="swipe">Swipe the table sideways for the rest of the courses</div>
      <div className="legend">
        {keys.map(k=><span key={k}><b>{COURSES[k].code}</b> {COURSES[k].short}</span>)}
      </div>
      <p className="note">Blank counts as scratch until a number is entered. Rounding is to the
        nearest whole stroke, so 15 becomes 14 and 17 becomes 15.</p>
    </div>
  );
}

/* ─── ROUND ──────────────────────────────────────────────────── */
function Round({ round, st, ev, setScore, clearScores, moveToGroup, hasScores, setPairs, onArchive, archived }) {
  const [open,setOpen] = useState(!hasScores);
  const [mode,setMode] = useState(() => LS.get("bets.mode", "card"));
  /* Reopen on the hole you were last on. Failing that, the first hole the
     group hasn't finished — which is where you actually are on the course. */
  const [hole,setHole] = useState(() => {
    const saved = LS.get(`bets.hole.${round.n}`, null);
    if (saved != null && saved >= 0 && saved < 18) return saved;
    const roster = st.groups.flat();
    for (let i=0; i<18; i++)
      if (!roster.length || !roster.every(p => st.scores[p][i] != null)) return i;
    return 17;
  });
  useEffect(() => { LS.set(`bets.hole.${round.n}`, hole); }, [hole, round.n]);
  useEffect(() => { LS.set("bets.mode", mode); }, [mode]);
  const f = ev.f, course = ev.course;
  const missing = ALL.filter(p => ev.chc[p] === 0);
  const resolved = useMemo(() => resolvePairs(st.groups, st.pairs), [st.groups, st.pairs]);
  /* Picking a name already used in the other match trades the two players
     rather than leaving someone out of a match entirely. */
  const swapPair = (gi, j, side, value) => {
    const pairs = clone(resolved);
    const other = pairs[gi].findIndex((pr,k) => k !== j && pr[side] === value);
    if (other >= 0) pairs[gi][other][side] = pairs[gi][j][side];
    pairs[gi][j][side] = value;
    setPairs(pairs);
  };

  return (
    <div className="pad">
      <Tracker ev={ev}/>

      <button className="disc" onClick={()=>setOpen(o=>!o)}>
        {open?"▾":"▸"} Groups — Round {round.n}, {COURSES[round.course].short}
      </button>
      {open && (
        <div className="setup">
          <div className="lockrow">
            <span className="lockpill">Locked</span>
            <span>{COURSES[round.course].name} · {round.tee} tees · {f.label} · {roundPts(round)} points</span>
          </div>
          <div className="sethead">Groups</div>
          {st.groups.map((g,gi)=>(
            <div className="grpbox" key={gi}>
              <div className="grpname">Group {gi+1}</div>
              <div className="chips">
                {g.map(p=><button key={p} className={"chip t"+teamOf(p)}
                  onClick={()=>moveToGroup(p, gi===0?1:0)}>{p} <i>⇄</i></button>)}
                {!g.length && <span className="hint">Empty</span>}
              </div>
            </div>))}
          <div className="hint">Tap a name to move it to the other group.</div>

          {f.scope==="group2" && (<>
            <div className="sethead">Singles matchups</div>
            {resolved.map((prs,gi)=>(
              <div className="grpbox" key={gi}>
                <div className="grpname">Group {gi+1}</div>
                {prs.map((pr,j)=>(
                  <div className="pairrow" key={j}>
                    <select className="pA" value={pr[0]}
                      onChange={e=>swapPair(gi, j, 0, e.target.value)}>
                      {st.groups[gi].filter(p=>teamOf(p)==="A").map(p=><option key={p}>{p}</option>)}
                    </select>
                    <span className="vs">v</span>
                    <select className="pB" value={pr[1]}
                      onChange={e=>swapPair(gi, j, 1, e.target.value)}>
                      {st.groups[gi].filter(p=>teamOf(p)==="B").map(p=><option key={p}>{p}</option>)}
                    </select>
                  </div>))}
                {!prs.length && <span className="hint">Needs a player from each team.</span>}
              </div>))}
            <div className="hint">Each match strokes off the lower of its own two handicaps.
              Picking a name that's already in the other match swaps the two.</div>
          </>)}
        </div>
      )}

      {missing.length > 0 &&
        <div className="warn">No course handicap set for {missing.join(", ")} at {COURSES[round.course].short}.
          They're playing scratch until you fill the Hcps tab.</div>}

      <div className="modebar">
        <button className={mode==="card"?"on":""} onClick={()=>setMode("card")}>Full card</button>
        <button className={mode==="hole"?"on":""} onClick={()=>setMode("hole")}>One hole</button>
      </div>

      {mode==="hole"
        ? <HoleEntry st={st} ev={ev} hole={hole} setHole={setHole} setScore={setScore}/>
        : st.groups.map((g,gi)=>(
            <GroupCard key={gi} gi={gi} group={g} st={st} ev={ev} setScore={setScore}/>))}

      {f.scope==="all" && <MatchCard m={ev.results[0]} ev={ev} title="4v4 aggregate — best 3 net"/>}

      <div className="endbar">
        <button className="archivebtn" onClick={onArchive}>
          {archived ? "Update archived round" : "Save round to archive"}
        </button>
        {hasScores &&
          <button className="clearbtn wide" onClick={clearScores}>Clear this round's scores</button>}
      </div>
      <p className="note">Gross scores are what you enter. Every match plays off the lowest
        {" "}{Math.round(ALLOWANCE*100)}% handicap in that match — the low player is scratch and
        everyone else gets the difference. The Stats tab still uses each player's full
        {" "}{Math.round(ALLOWANCE*100)}% handicap, so net averages stay comparable across rounds.</p>
      <p className="note">Clearing wipes this round's scores for everyone and does not touch the
        archive. Removing a round from the Archive tab does not clear these scores either — the two
        are stored separately.</p>
    </div>
  );
}

const SfKey = () => (
  <div className="sfkey">
    {SF_TABLE.map(r => (
      <div className="sfk" key={r.label}>
        <span className="sfk-l">{r.label}</span>
        <span className={"sfk-p"+(r.pts<0?" neg":"")}>{r.pts>0?"+":""}{r.pts}</span>
      </div>))}
  </div>
);

/* one foursome */
function GroupCard({ gi, group, st, ev, setScore }) {
  const f = ev.f, course = ev.course;
  const mine = ev.results.filter(r => r.group === gi);
  const H = Array.from({length:18},(_,i)=>i);
  return (
    <div className="gcard">
      <div className="ghead"><span className="gtitle">Group {gi+1}</span>
        <span className="gsub">{group.join(" · ") || "No players"}</span></div>
      <div className="scroll">
        <table className="card">
          <thead>
            <tr><th className="stick">Hole</th>{H.map(h=><th key={h}>{h+1}</th>)}<th>Out</th><th>In</th><th>Tot</th></tr>
            <tr className="par"><th className="stick">Par</th>{H.map(h=><td key={h}>{course.par[h]}</td>)}
              <td>{sum(course.par.slice(0,9))}</td><td>{sum(course.par.slice(9))}</td><td>{sum(course.par)}</td></tr>
            <tr className="hcp"><th className="stick">SI</th>{H.map(h=><td key={h}>{course.hcp[h]}</td>)}<td/><td/><td/></tr>
          </thead>
          <tbody>
            {group.map(p=>{
              const g = st.scores[p];
              const sk = ev.rel[p];
              const inPlay = sk != null;
              const opp = ev.oppOf?.[p];
              return (
                <tr key={p} className={"t"+teamOf(p)+(inPlay?"":" idle")}>
                  <th className="stick">{p}
                    {opp && <b className="opp">v {opp}</b>}
                    <em className={!inPlay ? "none" : sk===0 ? "scr" : ""}>{inPlay ? sk : "—"}</em></th>
                  {H.map(h=>{
                    const nt = inPlay ? netOf(g[h], sk, course.hcp[h]) : null;
                    return (
                      <td key={h} className={"cell "+cls(g[h],course.par[h])}>
                        <input inputMode="numeric" value={g[h] ?? ""} onChange={e=>{
                          const v=e.target.value.replace(/\D/g,"");
                          setScore(p,h,v===""?null:Math.min(19,+v));}}/>
                        {nt!=null && <i className="netbadge">{nt}</i>}
                        {inPlay && strokesOnHole(sk,course.hcp[h])>0 &&
                          <i className="dots">{"•".repeat(Math.min(strokesOnHole(sk,course.hcp[h]),3))}</i>}
                      </td>);
                  })}
                  <td className="tot">{sum(g.slice(0,9))||"–"}</td>
                  <td className="tot">{sum(g.slice(9))||"–"}</td>
                  <td className="tot">{sum(g)||"–"}</td>
                </tr>);
            })}
            {mine.map(m => <CountRows key={m.key} m={m} ev={ev}/>)}
          </tbody>
        </table>
      </div>
      <div className="legend">
        <span>big = gross</span><span className="lgnet">small = net</span>
        <span>• stroke received</span>
        <span>strokes off the low handicap in the match</span>
        {f.mode==="holes" && <><span>▲ {TEAM_A.short}</span><span>▼ {TEAM_B.short}</span></>}
      </div>
      {f.pick==="sfsum" && <SfKey/>}
      {mine.map(m => (
        <div className="matchfoot" key={m.key}>
          <div className="mf-h">{m.a.join(" & ")} <span>v</span> {m.b.join(" & ")}</div>
          <Segments m={m} mode={f.mode}/>
        </div>))}
    </div>
  );
}

/* the two counting rows + hole result row */
function CountRows({ m, ev }) {
  const H = Array.from({length:18},(_,i)=>i);
  const label = ev.f.pick==="sfsum" ? "pts" : "net";
  return (<>
    <tr className="cntrow tA">
      <th className="stick">{TEAM_A.short} {label}</th>
      {H.map(h=><td key={h} className={m.holes[h].w==="A"?"rA":""}>{m.holes[h].a ?? "·"}</td>)}
      <td className="tot">{segTot(m,0,9,"a")}</td><td className="tot">{segTot(m,9,18,"a")}</td>
      <td className="tot">{segTot(m,0,18,"a")}</td>
    </tr>
    <tr className="cntrow tB">
      <th className="stick">{TEAM_B.short} {label}</th>
      {H.map(h=><td key={h} className={m.holes[h].w==="B"?"rB":""}>{m.holes[h].b ?? "·"}</td>)}
      <td className="tot">{segTot(m,0,9,"b")}</td><td className="tot">{segTot(m,9,18,"b")}</td>
      <td className="tot">{segTot(m,0,18,"b")}</td>
    </tr>
    {ev.f.mode==="holes" && (
      <tr className="resrow">
        <th className="stick">Hole</th>
        {H.map(h=>{
          const w = m.holes[h].w;
          return <td key={h} className={"res "+(w==="A"?"rA":w==="B"?"rB":w==="H"?"rH":"")}>
            {w==="A"?"▲":w==="B"?"▼":w==="H"?"–":""}</td>;
        })}
        <td className="tot">{m.front.a}-{m.front.b}</td>
        <td className="tot">{m.back.a}-{m.back.b}</td>
        <td className="tot">{m.overall.a}-{m.overall.b}</td>
      </tr>)}
  </>);
}
const segTot = (m, from, to, side) => {
  let t=0, any=false;
  for (let i=from;i<to;i++){ const v=m.holes[i][side]; if(v!=null){t+=v;any=true;} }
  return any ? t : "–";
};

/* standalone card for the 4v4 round */
function MatchCard({ m, ev, title }) {
  const H = Array.from({length:18},(_,i)=>i);
  return (
    <div className="gcard">
      <div className="ghead"><span className="gtitle">Match</span><span className="gsub">{title}</span></div>
      <div className="scroll">
        <table className="card">
          <thead><tr><th className="stick">Hole</th>{H.map(h=><th key={h}>{h+1}</th>)}
            <th>Out</th><th>In</th><th>Tot</th></tr></thead>
          <tbody><CountRows m={m} ev={ev}/></tbody>
        </table>
      </div>
      <div className="matchfoot"><Segments m={m} mode={ev.f.mode}/></div>
    </div>
  );
}

/* ─── HOLE ENTRY ─────────────────────────────────────────────── */
const SCORE_CHOICES = Array.from({length:14},(_,i)=>i+1); // 1 through 14

/* Horizontal strip of absolute scores. Opens showing 2 onward, since
   an ace is rare and 2–8 covers nearly every hole. Swipe left for 1,
   right for 9 and up. */
function ScoreStrip({ value, par, onPick }) {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const first = el.querySelector("button");
    if (first) el.scrollLeft = first.offsetWidth + 4;
  }, []);
  return (
    <div className="quick" ref={ref}>
      {SCORE_CHOICES.map(n => (
        <button key={n}
          className={"q "+(value===n ? "on " : "")+cls(n, par)}
          onClick={()=>onPick(value===n ? null : n)}>{n}</button>
      ))}
    </div>
  );
}

function HoleEntry({ st, ev, hole, setHole, setScore }) {
  const course = ev.course, par = course.par[hole];
  return (
    <div>
      <div className="holehead">
        <button className="nav" onClick={()=>setHole(h=>Math.max(0,h-1))} disabled={hole===0}>‹</button>
        <div className="hh"><div className="hnum">Hole {hole+1}</div>
          <div className="hmeta">Par {par} · SI {course.hcp[hole]}</div></div>
        <button className="nav" onClick={()=>setHole(h=>Math.min(17,h+1))} disabled={hole===17}>›</button>
      </div>
      {st.groups.map((g,gi)=>(
        <div key={gi}>
          <div className="ghline">Group {gi+1}</div>
          {g.map(p=>{
            const v = st.scores[p][hole];
            const sk = ev.rel[p];
            const inPlay = sk != null;
            const opp = ev.oppOf?.[p];
            const nt = inPlay ? netOf(v, sk, course.hcp[hole]) : null;
            const sp = ev.f.pick==="sfsum" ? sfPts(nt, par) : null;
            const gets = inPlay ? strokesOnHole(sk, course.hcp[hole]) : 0;
            return (
              <div className={"erow t"+teamOf(p)+(inPlay?"":" idle")} key={p}>
                <div className="ename">{p}{opp && <b className="opp">v {opp}</b>}
                  <em>{!inPlay ? "not in a match"
                    : nt!=null
                      ? `net ${nt}${sp!=null?` · ${sp} pt${Math.abs(sp)===1?"":"s"}`:""}`
                      : `${sk} strokes${gets?` · ${gets} here`:""}`}</em></div>
                <ScoreStrip value={v} par={par} onPick={n=>setScore(p,hole,n)}/>
              </div>);
          })}
          {ev.results.filter(r=>r.group===gi).map(m=>{
            const x = m.holes[hole];
            return <div className="holeres" key={m.key}>
              <span>{m.a.join("/")} v {m.b.join("/")} — {x.a ?? "·"} to {x.b ?? "·"}</span>
              <span className="hr2">{x.w==="A"?`${TEAM_A.short} wins hole`:x.w==="B"?`${TEAM_B.short} wins hole`:x.w==="H"?"Halved":"—"}</span>
            </div>;
          })}
        </div>))}
      {ev.f.scope==="all" && (()=>{
        const x = ev.results[0].holes[hole];
        return <div className="holeres">
          <span>{TEAM_A.short} {x.a ?? "·"} · {TEAM_B.short} {x.b ?? "·"}</span>
          <span className="hr2">{x.w==="A"?`${TEAM_A.short} wins hole`:x.w==="B"?`${TEAM_B.short} wins hole`:x.w==="H"?"Halved":"—"}</span>
        </div>;
      })()}
      <div className="dots18">
        {Array.from({length:18}).map((_,i)=>{
          const roster = st.groups.flat();
          const done = roster.length && roster.every(p=>st.scores[p][i]!=null);
          const some = roster.some(p=>st.scores[p][i]!=null);
          return <button key={i} className={"d "+(i===hole?"cur ":"")+(done?"full":some?"part":"")}
            onClick={()=>setHole(i)}>{i+1}</button>;
        })}
      </div>
    </div>
  );
}

/* ─── ARCHIVE ────────────────────────────────────────────────── */
function Archive({ archive, onDelete }) {
  const [openId,setOpen] = useState(null);
  const [armed,setArmed] = useState(null);

  const confirmDelete = (a) => {
    const c = COURSES[a.course];
    const holes = ALL.reduce((t,p)=>t + (a.scores[p]||[]).filter(v=>v!=null).length, 0);
    if (!window.confirm(
      `Remove Round ${a.roundN} — ${c.name}?\n\n` +
      `This deletes ${holes} entered scores and takes the round out of Stats. ` +
      `It is removed for everyone, not just this phone.`)) { setArmed(null); return; }
    if (!window.confirm(
      `Last chance.\n\nRound ${a.roundN} (${fmt(a.aPts)}–${fmt(a.bPts)}) cannot be recovered ` +
      `once deleted. Press OK only if you are sure.`)) { setArmed(null); return; }
    onDelete(a.roundN);
    setArmed(null);
  };

  if (!archive.length) return (
    <div className="pad"><div className="empty"><b>No rounds archived yet</b>
      <p>Finish a round on the Round tab and save it. Archived cards are what the Stats tab reads.</p>
    </div></div>);
  return (
    <div className="pad">
      {[...archive].sort((a,b)=>a.roundN-b.roundN).map(a=>{
        const c = COURSES[a.course];
        const H = Array.from({length:18},(_,i)=>i);
        return (
          <div className="gcard" key={a.roundN}>
            <div className="ghead click" onClick={()=>setOpen(o=>o===a.roundN?null:a.roundN)}>
              <span className="gtitle">R{a.roundN} · {c.short}</span>
              <span className="gsub">{FORMATS[a.format].label} · {fmt(a.aPts)}–{fmt(a.bPts)}</span>
            </div>
            {openId===a.roundN && (<>
              <div className="scroll">
                <table className="card">
                  <thead>
                    <tr><th className="stick">Hole</th>{H.map(h=><th key={h}>{h+1}</th>)}<th>Gross</th><th>Net</th></tr>
                    <tr className="par"><th className="stick">Par</th>{H.map(h=><td key={h}>{c.par[h]}</td>)}
                      <td>{sum(c.par)}</td><td/></tr>
                  </thead>
                  <tbody>
                    {a.groups.flat().map(p=>{
                      const nets = a.scores[p].map((v,h)=>netOf(v, a.chc[p], c.hcp[h]));
                      return (
                        <tr key={p} className={"t"+teamOf(p)}>
                          <th className="stick">{p} <em>{a.chc[p]}</em></th>
                          {H.map(h=><td key={h} className={cls(a.scores[p][h],c.par[h])}>
                            {a.scores[p][h] ?? "·"}
                            {nets[h]!=null && <i className="netbadge">{nets[h]}</i>}</td>)}
                          <td className="tot">{sum(a.scores[p])||"–"}</td>
                          <td className="tot">{sum(nets)||"–"}</td>
                        </tr>);
                    })}
                  </tbody>
                </table>
              </div>
              <div className="arcfoot">
                <div>{a.results.map((r,i)=>
                  <span key={i} className="rchip">{r.a.join("/")} v {r.b.join("/")} · {fmt(r.aPts)}–{fmt(r.bPts)}</span>)}</div>
                {armed===a.roundN
                  ? <span className="delarm">
                      <button className="del go" onClick={()=>confirmDelete(a)}>Yes, remove</button>
                      <button className="del keep" onClick={()=>setArmed(null)}>Keep</button>
                    </span>
                  : <button className="del" onClick={()=>setArmed(a.roundN)}>Remove</button>}
              </div>
              <div className="hint pad-in">Saved {a.date} · {a.tee} tees · played off {Math.round(ALLOWANCE*100)}%</div>
            </>)}
          </div>);
      })}
    </div>
  );
}

/* ─── STATS ──────────────────────────────────────────────────── */
function Stats({ archive }) {
  const [scope,setScope] = useState("all");
  const [basis,setBasis] = useState("net");
  if (!archive.length) return (
    <div className="pad"><div className="empty"><b>Stats appear once rounds are archived</b>
      <p>This tab reads only from saved scorecards, so nothing here shifts while a round is still in play.</p>
    </div></div>);

  const src = scope==="all" ? archive : archive.filter(a=>String(a.roundN)===scope);
  const rows = ALL.map(p=>{
    let holes=0, gross=0, net=0, toPar=0, sf=0, e=0,b=0,pr=0,bo=0,d=0, rds=0;
    src.forEach(a=>{
      const c = COURSES[a.course]; let any=false;
      (a.scores[p]||[]).forEach((v,h)=>{
        if (v==null) return;
        any=true; holes++; gross+=v;
        const nt = netOf(v, a.chc[p], c.hcp[h]);
        net += nt;
        const ref = basis==="net" ? nt : v;
        sf += sfPts(ref, c.par[h]);
        const diff = ref - c.par[h];
        toPar += diff;
        if(diff<=-2)e++; else if(diff===-1)b++; else if(diff===0)pr++; else if(diff===1)bo++; else d++;
      });
      if(any) rds++;
    });
    return { p, rds, holes, toPar, sf, e,b,pr,bo,d,
             avg: holes ? (basis==="net"?net:gross)/holes*18 : 0 };
  }).filter(r=>r.holes);

  const sorted = [...rows].sort((x,y)=>x.avg-y.avg);
  const L = basis==="net" ? "Net" : "Gross";

  return (
    <div className="pad">
      <div className="filters">
        <select value={scope} onChange={e=>setScope(e.target.value)}>
          <option value="all">All archived rounds</option>
          {[...archive].sort((a,b)=>a.roundN-b.roundN).map(a=>
            <option key={a.roundN} value={String(a.roundN)}>R{a.roundN} · {COURSES[a.course].short}</option>)}
        </select>
        <div className="toggle">
          <button className={basis==="net"?"on":""} onClick={()=>setBasis("net")}>Net</button>
          <button className={basis==="gross"?"on":""} onClick={()=>setBasis("gross")}>Gross</button>
        </div>
      </div>
      <div className="card-wrap"><div className="scroll">
        <table className="std">
          <thead><tr><th>Player</th><th>Rds</th><th>Holes</th><th>{L} 18</th><th>{L} +/–</th>
            <th>{L} Stbl</th><th>Eag</th><th>Bird</th><th>Par</th><th>Bog</th><th>Dbl+</th></tr></thead>
          <tbody>
            {sorted.map(r=>(
              <tr key={r.p} className={"t"+teamOf(r.p)}>
                <td><b>{r.p}</b></td><td>{r.rds}</td><td>{r.holes}</td>
                <td className="hl">{r.avg.toFixed(1)}</td>
                <td>{(r.toPar>0?"+":"")+r.toPar}</td>
                <td>{r.sf}</td>
                <td>{r.e}</td><td>{r.b}</td><td>{r.pr}</td><td>{r.bo}</td><td>{r.d}</td>
              </tr>))}
          </tbody>
        </table>
      </div></div>
      <div className="swipe">Swipe the table sideways for the rest of the columns</div>
      <p className="note">Averages scale to 18 holes so partial rounds stay comparable. Every column
        follows the basis you pick. Stbl uses the trip's own scale — double or worse −1, bogey 0,
        par 2, birdie 4, eagle 7, albatross 10 — so gross totals can run negative.</p>
    </div>
  );
}

/* ─── POINTS ─────────────────────────────────────────────────── */
function Standings({ allEv, totals, resetAll }) {
  return (
    <div className="pad">
      <Big a={totals.a} b={totals.b} mid={`of ${TOTAL_PTS}`}/>
      <div className="card-wrap"><div className="scroll">
        <table className="std">
          <thead><tr><th>Round</th><th>Format</th><th>Avail</th>
            <th>{TEAM_A.short}</th><th>{TEAM_B.short}</th></tr></thead>
          <tbody>
            {ROUNDS.map((r,i)=>(
              <tr key={r.n}>
                <td><b>R{r.n}</b><br/><span className="sm">{COURSES[r.course].short}</span></td>
                <td className="sm">{FORMATS[r.format].label}</td>
                <td>{roundPts(r)}</td>
                <td className={allEv[i].aPts>allEv[i].bPts?"win":""}>{fmt(allEv[i].aPts)}</td>
                <td className={allEv[i].bPts>allEv[i].aPts?"win":""}>{fmt(allEv[i].bPts)}</td>
              </tr>))}
          </tbody>
          <tfoot><tr><td colSpan={2}>Total</td><td>{TOTAL_PTS}</td>
            <td>{fmt(totals.a)}</td><td>{fmt(totals.b)}</td></tr></tfoot>
        </table>
      </div></div>
      <p className="note">Every match splits into front nine, back nine and overall. A tie in any
        segment splits its points. A segment pays out once its holes are played, or earlier if one
        side is up more holes than remain.</p>
      <div className="resetbox">
        <div>
          <b>Start over</b>
          <p>Wipes every round's scores and the whole archive. Handicaps and groups stay. Use this
             to clear out test data before the trip.</p>
        </div>
        <button className="clearbtn" onClick={resetAll}>Reset everything</button>
      </div>
    </div>
  );
}

/* ─── STYLES ─────────────────────────────────────────────────── */
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Saira+Condensed:wght@500;600;700&family=Inter:wght@400;500;600;700&display=swap');
*{box-sizing:border-box;margin:0;padding:0;}
:root{--paper:#F2F2EE;--ink:#0B1F3A;--blue:#1B5FA8;--blueL:#3E86D6;--blueF:#E4ECF6;
 --rust:#A9522E;--rustF:#F3E7E0;--rule:#D8D8D0;--mut:#6C7480;--gold:#B8873B;}
body{background:var(--paper);}
.app{font-family:Inter,system-ui,sans-serif;color:var(--ink);background:var(--paper);
 max-width:880px;margin:0 auto;min-height:100vh;padding-bottom:60px;}
.pad{padding:14px;}
.note{font-size:12px;color:var(--mut);margin-top:12px;line-height:1.5;}
.sm{font-size:11px;color:var(--mut);}
.hint{font-size:11px;color:var(--mut);margin:6px 0 2px;display:block;}
.pad-in{padding:0 12px 10px;}
.warn{background:#FBF3E4;border:1px solid #E6D4AE;color:#7A5B18;border-radius:9px;
 padding:9px 11px;font-size:12px;margin-bottom:10px;line-height:1.45;}

.top{display:flex;align-items:center;justify-content:space-between;padding:13px 16px;
 background:var(--ink);color:var(--paper);}
.wordmark{font-family:'Saira Condensed';font-weight:700;font-size:29px;letter-spacing:6px;line-height:1;}
.tag{font-size:10px;letter-spacing:2.2px;text-transform:uppercase;color:#8FA6C4;margin-top:3px;}
.sync{font-style:normal;letter-spacing:1px;margin-left:7px;padding:1px 6px;border-radius:10px;font-size:9px;}
.sync.ok{background:rgba(110,200,140,.16);color:#8AD8A6;}
.sync.wait{background:rgba(230,190,90,.16);color:#E8C877;}
.sync.bad{background:rgba(230,120,90,.18);color:#F0A184;}
.sync.off{background:rgba(255,255,255,.09);color:#8FA6C4;}
.loading{padding:10px 14px;font-size:12px;color:var(--mut);background:var(--blueF);
 border-bottom:1px solid var(--rule);}
.tally{font-family:'Saira Condensed';font-size:29px;font-weight:700;font-variant-numeric:tabular-nums;
 display:flex;align-items:center;gap:7px;}
.tick{height:26px;width:26px;object-fit:contain;border-radius:5px;background:rgba(255,255,255,.07);padding:1px;}
.sm-crest{height:16px;width:16px;vertical-align:-3px;margin-right:4px;background:none;padding:0;}
.crest{height:46px;display:flex;align-items:center;justify-content:center;margin-bottom:6px;}
.crest img{max-height:46px;max-width:100%;object-fit:contain;}
.tally .tA{color:var(--blueL);}.tally .tB{color:#E08A62;}.tally .dash{color:#4A5F7D;margin:0 2px;}

.roundbar{background:#fff;border-bottom:1px solid var(--rule);padding:9px 14px;}
select{font-family:Inter;font-size:13px;font-weight:600;color:var(--ink);border:1px solid var(--rule);
 border-radius:8px;padding:8px 9px;background:var(--paper);}
.roundbar select{width:100%;}
.rmeta{font-size:11px;color:var(--mut);margin-top:5px;}

.tabs{display:flex;background:#fff;border-bottom:1px solid var(--rule);position:sticky;top:0;z-index:6;}
.tabs button{flex:1;padding:11px 1px;border:0;background:none;cursor:pointer;font-family:'Saira Condensed';
 font-size:12.5px;font-weight:600;letter-spacing:1px;text-transform:uppercase;color:var(--mut);
 border-bottom:3px solid transparent;}
.tabs button.on{color:var(--ink);border-bottom-color:var(--blue);}

.bigscore{display:grid;grid-template-columns:1fr auto 1fr;align-items:center;background:#fff;
 border:1px solid var(--rule);border-radius:14px;padding:16px 10px;margin-bottom:12px;}
.side{text-align:center;}
.sname{font-size:10px;letter-spacing:2px;text-transform:uppercase;color:var(--mut);margin-bottom:3px;}
.sval{font-family:'Saira Condensed';font-size:48px;font-weight:700;line-height:.9;font-variant-numeric:tabular-nums;}
.sideA .sval{color:var(--blue);}.sideB .sval{color:var(--rust);}
.mid{text-align:center;padding:0 12px;}
.midlabel{font-family:'Saira Condensed';font-size:13px;letter-spacing:3px;color:var(--mut);text-transform:uppercase;}
.midsub{font-size:10px;color:var(--mut);}

.courseband{display:flex;justify-content:space-between;align-items:center;gap:10px;margin-bottom:5px;}
.cname{font-family:'Saira Condensed';font-size:21px;font-weight:700;}
.csub{font-size:11px;color:var(--mut);}
.fmtpill{background:var(--ink);color:var(--paper);font-size:10px;letter-spacing:1.3px;
 text-transform:uppercase;padding:6px 10px;border-radius:20px;text-align:center;}
.blurb{font-size:12.5px;color:var(--mut);margin-bottom:12px;line-height:1.5;}

.tracker{background:#fff;border:1px solid var(--rule);border-radius:12px;overflow:hidden;margin-bottom:12px;}
.trk-h{display:flex;justify-content:space-between;align-items:center;padding:9px 12px;background:var(--ink);
 color:var(--paper);font-family:'Saira Condensed';font-size:12px;letter-spacing:2px;text-transform:uppercase;}
.trk-pts{color:#8FA6C4;letter-spacing:1px;}
.trk-m{border-top:1px solid var(--rule);padding:9px 12px;}
.trk-r{display:grid;grid-template-columns:1fr auto 1fr;gap:8px;align-items:center;}
.trk-t{font-size:12.5px;color:var(--mut);}
.trk-t.right{text-align:right;}
.trk-t.lead{color:var(--ink);font-weight:700;}
.trk-s{font-family:'Saira Condensed';font-size:12px;letter-spacing:1px;color:var(--mut);
 background:var(--paper);border-radius:6px;padding:2px 8px;white-space:nowrap;}

/* segment strip */
.segs{display:grid;grid-template-columns:repeat(3,1fr);gap:6px;margin-top:8px;}
.seg{background:var(--paper);border:1px solid var(--rule);border-radius:8px;padding:6px;text-align:center;}
.segs.compact .seg{padding:5px 4px;}
.seg-l{font-family:'Saira Condensed';font-size:10px;letter-spacing:1.4px;text-transform:uppercase;color:var(--mut);}
.seg-v{font-family:'Saira Condensed';font-size:17px;font-weight:700;font-variant-numeric:tabular-nums;
 display:flex;justify-content:center;gap:4px;}
.seg-v b{color:var(--mut);font-weight:700;}
.seg-v b.lead{color:var(--ink);}
.seg-u{font-size:9px;color:var(--mut);}
.seg-p{font-size:11px;font-weight:700;margin-top:3px;border-radius:5px;padding:1px 0;
 background:#fff;color:var(--mut);font-variant-numeric:tabular-nums;}
.seg-p.pA{background:var(--blueF);color:var(--blue);}
.seg-p.pB{background:var(--rustF);color:var(--rust);}
.seg-p.open{background:transparent;border:1px dashed var(--rule);color:var(--mut);
 font-weight:500;font-size:10px;letter-spacing:.5px;}

.disc{width:100%;text-align:left;background:#fff;border:1px solid var(--rule);border-radius:10px;
 padding:11px 12px;font-family:Inter;font-size:13px;font-weight:600;color:var(--ink);cursor:pointer;margin-bottom:10px;}
.setup{background:#fff;border:1px solid var(--rule);border-radius:12px;padding:13px;margin-bottom:12px;}
.lockrow{display:flex;align-items:center;gap:8px;font-size:11.5px;color:var(--mut);
 background:var(--paper);border-radius:8px;padding:8px 10px;flex-wrap:wrap;}
.lockpill{background:var(--ink);color:var(--paper);font-size:9px;letter-spacing:1.4px;text-transform:uppercase;
 padding:3px 7px;border-radius:12px;}
.sethead{font-family:'Saira Condensed';font-size:12px;letter-spacing:2px;text-transform:uppercase;
 color:var(--mut);margin:14px 0 7px;}
.grpbox{border:1px solid var(--rule);border-radius:9px;padding:9px;margin-bottom:7px;}
.grpname{font-size:11px;letter-spacing:1.4px;text-transform:uppercase;color:var(--mut);margin-bottom:6px;}
.chips{display:flex;flex-wrap:wrap;gap:5px;}
.chip{border:1px solid var(--rule);border-radius:20px;padding:5px 10px;font-size:12px;
 font-family:Inter;font-weight:600;cursor:pointer;}
.chip i{font-style:normal;opacity:.4;font-size:10px;}
.chip.tA{background:var(--blueF);color:var(--blue);border-color:#C6D9EE;}
.chip.tB{background:var(--rustF);color:var(--rust);border-color:#E8D2C6;}
.pairrow{display:flex;align-items:center;gap:7px;margin-bottom:5px;}
.pairrow select{flex:1;min-width:0;}
.pairrow .pA{background:var(--blueF);}.pairrow .pB{background:var(--rustF);}
.vs{font-family:'Saira Condensed';color:var(--mut);font-size:13px;}
.clearbtn{width:100%;margin-top:14px;padding:10px;border:1px solid var(--rule);background:var(--paper);
 color:var(--rust);border-radius:8px;font-family:Inter;font-size:12.5px;font-weight:600;cursor:pointer;}
.endbar{margin-top:6px;}
.clearbtn.wide{margin-top:8px;}
.resetbox{margin-top:18px;background:#fff;border:1px dashed var(--rule);border-radius:12px;padding:13px;}
.resetbox b{font-family:'Saira Condensed';font-size:14px;letter-spacing:1.4px;text-transform:uppercase;}
.resetbox p{font-size:11.5px;color:var(--mut);margin-top:4px;line-height:1.5;}
.resetbox .clearbtn{margin-top:10px;}

.modebar{display:flex;gap:6px;margin-bottom:10px;}
.modebar button{flex:1;padding:9px;border:1px solid var(--rule);background:#fff;border-radius:8px;
 font-family:Inter;font-size:12.5px;font-weight:600;color:var(--mut);cursor:pointer;}
.modebar button.on{background:var(--ink);color:var(--paper);border-color:var(--ink);}

.gcard{background:#fff;border:1px solid var(--rule);border-radius:12px;overflow:hidden;margin-bottom:12px;}
.ghead{display:flex;justify-content:space-between;align-items:baseline;gap:10px;padding:10px 12px;
 background:var(--paper);border-bottom:1px solid var(--rule);}
.ghead.click{cursor:pointer;}
.gtitle{font-family:'Saira Condensed';font-size:16px;font-weight:700;letter-spacing:1.4px;text-transform:uppercase;}
.gsub{font-size:11px;color:var(--mut);text-align:right;}
.ghline{font-family:'Saira Condensed';font-size:12px;letter-spacing:2px;text-transform:uppercase;
 color:var(--mut);margin:12px 0 6px;}
.matchfoot{padding:10px 12px 12px;border-top:1px solid var(--rule);}
.mf-h{font-size:12px;font-weight:600;margin-bottom:2px;}
.mf-h span{color:var(--mut);font-weight:400;margin:0 4px;}

.scroll{overflow-x:auto;overflow-y:hidden;-webkit-overflow-scrolling:touch;}
.card-wrap{background:#fff;border:1px solid var(--rule);border-radius:12px;overflow:hidden;}
.swipe{font-size:10.5px;color:var(--mut);margin-top:6px;letter-spacing:.3px;}
@media(min-width:700px){.swipe{display:none;}}
table.card{border-collapse:collapse;font-size:12px;width:100%;font-variant-numeric:tabular-nums;}
table.card th,table.card td{padding:4px 3px;text-align:center;border-bottom:1px solid var(--rule);white-space:nowrap;}
table.card thead th{font-family:'Saira Condensed';font-size:11px;letter-spacing:.8px;color:var(--mut);padding:6px 3px;}
.stick{position:sticky;left:0;background:#fff;text-align:left!important;z-index:2;font-weight:600;
 font-size:11px;padding:4px 8px 4px 6px!important;box-shadow:1px 0 0 var(--rule);}
.stick em{color:var(--mut);font-style:normal;font-size:10px;background:var(--paper);
 border-radius:4px;padding:1px 4px;margin-left:3px;}
.stick em.scr{background:var(--ink);color:var(--paper);}
.stick em.none{background:transparent;color:var(--mut);}
.opp{display:block;font-size:9.5px;font-weight:500;color:var(--mut);letter-spacing:.2px;}
tr.idle input,tr.idle .stick{opacity:.55;}
.erow.idle{opacity:.6;}
tr.par td{background:var(--paper);font-weight:600;}
tr.hcp td{color:var(--mut);font-size:10px;}
tr.tA .stick{border-left:3px solid var(--blue);}
tr.tB .stick{border-left:3px solid var(--rust);}
td.cell{padding:0!important;position:relative;height:34px;}
td.cell input{width:34px;height:34px;border:0;background:transparent;text-align:center;
 font-family:Inter;font-size:13px;font-weight:600;color:inherit;padding:0;}
td.cell input:focus{outline:2px solid var(--blue);outline-offset:-2px;background:#fff;}
.netbadge{position:absolute;bottom:0;right:2px;font-style:normal;font-size:8.5px;font-weight:700;
 color:var(--blue);line-height:1;pointer-events:none;}
tr.tB .netbadge{color:var(--rust);}
td.eagle{background:#F6D98A;font-weight:700;}
td.birdie{background:var(--blueF);}
td.bogey{background:#F6EDE7;}
td.dbl{background:var(--rustF);}
td.tot{font-weight:700;background:var(--paper);}
.dots{position:absolute;top:1px;right:2px;font-style:normal;font-size:7px;color:var(--mut);line-height:1;}
tr.cntrow th,tr.cntrow td{background:#F7F8F5;font-size:11.5px;font-weight:700;}
tr.cntrow.tA th{border-left:3px solid var(--blue);}
tr.cntrow.tB th{border-left:3px solid var(--rust);}
tr.resrow th,tr.resrow td{background:#EFF1EC;border-top:1px solid var(--rule);
 border-bottom:2px solid var(--rule);font-size:11px;}
td.res{font-weight:700;}
td.rA{background:var(--blueF);color:var(--blue);}
td.rB{background:var(--rustF);color:var(--rust);}
td.rH{color:var(--mut);}
.legend{display:flex;gap:11px;flex-wrap:wrap;font-size:10.5px;color:var(--mut);padding:8px 12px;}
.sfkey{display:flex;gap:5px;flex-wrap:wrap;padding:0 12px 12px;}
.sfk{display:flex;align-items:center;gap:5px;background:var(--paper);border:1px solid var(--rule);
 border-radius:6px;padding:4px 8px;font-size:10.5px;}
.sfk-l{color:var(--mut);}
.sfk-p{font-weight:700;font-variant-numeric:tabular-nums;color:var(--blue);}
.sfk-p.neg{color:var(--rust);}
.legend b{color:var(--ink);}
.lgnet{color:var(--blue);}

/* handicap table */
table.hcptable{border-collapse:collapse;width:100%;min-width:620px;font-size:12px;
 font-variant-numeric:tabular-nums;}
table.hcptable th,table.hcptable td{padding:5px 4px;text-align:center;border-bottom:1px solid var(--rule);
 white-space:nowrap;}
table.hcptable thead th{font-family:'Saira Condensed';font-size:11px;letter-spacing:1px;color:var(--mut);}
th.grp-raw{background:var(--paper);}
th.grp-play{background:var(--blueF);color:var(--blue);}
table.hcptable td.cell{padding:0!important;height:34px;}
table.hcptable th.stick{position:sticky;left:0;z-index:3;background:#fff;
 box-shadow:1px 0 0 var(--rule);text-align:left!important;}
table.hcptable thead th.stick{background:var(--paper);}
table.hcptable td.cell input{width:44px;height:34px;border:0;background:transparent;text-align:center;
 font-family:Inter;font-size:13px;font-weight:600;color:var(--ink);}
table.hcptable td.cell input:focus{outline:2px solid var(--blue);outline-offset:-2px;background:#fff;}
td.playcell{background:var(--blueF);color:var(--blue);font-weight:700;min-width:40px;}
.hnote{background:#fff;border:1px solid var(--rule);border-radius:12px;padding:12px;margin-bottom:12px;}
.hnote b{font-family:'Saira Condensed';font-size:15px;letter-spacing:1.2px;text-transform:uppercase;}
.hnote p{font-size:12px;color:var(--mut);margin-top:5px;line-height:1.5;}

.holehead{display:flex;align-items:center;justify-content:space-between;background:var(--ink);
 color:var(--paper);border-radius:12px;padding:11px 8px;margin-bottom:10px;}
.hh{text-align:center;}
.hnum{font-family:'Saira Condensed';font-size:25px;font-weight:700;letter-spacing:2px;}
.hmeta{font-size:11px;color:#8FA6C4;}
.nav{width:44px;height:44px;border:0;background:rgba(255,255,255,.1);color:#fff;border-radius:10px;
 font-size:22px;cursor:pointer;}
.nav:disabled{opacity:.25;}
.erow{display:grid;grid-template-columns:104px minmax(0,1fr);gap:8px;align-items:center;background:#fff;
 border:1px solid var(--rule);border-radius:10px;padding:7px;margin-bottom:6px;}
.erow.tA{border-left:4px solid var(--blue);}.erow.tB{border-left:4px solid var(--rust);}
.ename{font-size:12.5px;font-weight:600;}
.ename em{display:block;font-style:normal;font-size:10px;color:var(--mut);font-weight:400;}
.quick{display:flex;gap:4px;overflow-x:auto;-webkit-overflow-scrolling:touch;
 scroll-snap-type:x proximity;padding-bottom:2px;scrollbar-width:none;}
.quick::-webkit-scrollbar{display:none;}
.q{flex:0 0 40px;height:40px;border:1px solid var(--rule);background:var(--paper);border-radius:8px;
 font-family:Inter;font-size:14px;font-weight:600;color:var(--ink);cursor:pointer;scroll-snap-align:start;}
.q.eagle{background:#FBF0D2;}
.q.birdie{background:var(--blueF);}
.q.bogey{background:#FAF3EF;}
.q.dbl{background:var(--rustF);}
.q.on{background:var(--ink)!important;border-color:var(--ink);color:#fff;}
.holeres{font-size:12px;background:#fff;border:1px solid var(--rule);border-radius:9px;
 padding:8px 10px;margin:2px 0 10px;display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap;}
.hr2{color:var(--mut);}
.dots18{display:flex;flex-wrap:wrap;gap:4px;margin-top:12px;}
.dots18 .d{width:33px;height:29px;border:1px solid var(--rule);background:#fff;border-radius:6px;
 font-size:11px;color:var(--mut);cursor:pointer;font-family:Inter;}
.dots18 .d.part{background:var(--blueF);color:var(--blue);}
.dots18 .d.full{background:var(--blue);color:#fff;border-color:var(--blue);}
.dots18 .d.cur{outline:2px solid var(--ink);outline-offset:1px;}

.archivebtn{width:100%;padding:14px;background:var(--ink);color:var(--paper);border:0;border-radius:10px;
 font-family:'Saira Condensed';font-size:15px;font-weight:600;letter-spacing:2px;text-transform:uppercase;
 cursor:pointer;margin-top:6px;}
.arcfoot{display:flex;justify-content:space-between;align-items:center;gap:10px;padding:10px 12px;flex-wrap:wrap;}
.rchip{display:inline-block;background:var(--paper);border:1px solid var(--rule);border-radius:20px;
 padding:4px 9px;font-size:11px;margin:0 5px 5px 0;}
.del{border:1px solid var(--rule);background:#fff;color:var(--rust);border-radius:7px;padding:6px 12px;
 font-size:12px;font-family:Inter;cursor:pointer;}
.delarm{display:inline-flex;gap:6px;}
.del.go{background:var(--rust);border-color:var(--rust);color:#fff;font-weight:600;}
.del.keep{color:var(--mut);}
.empty{background:#fff;border:1px dashed var(--rule);border-radius:12px;padding:28px 20px;text-align:center;}
.empty b{font-family:'Saira Condensed';font-size:17px;letter-spacing:1px;}
.empty p{font-size:12.5px;color:var(--mut);margin-top:6px;line-height:1.5;}

.filters{display:flex;gap:8px;margin-bottom:10px;align-items:stretch;}
.filters select{flex:1;min-width:0;}
.toggle{display:flex;border:1px solid var(--rule);border-radius:8px;overflow:hidden;background:#fff;}
.toggle button{border:0;background:none;padding:0 14px;font-family:Inter;font-size:12.5px;font-weight:600;
 color:var(--mut);cursor:pointer;}
.toggle button.on{background:var(--ink);color:var(--paper);}
table.std{width:100%;min-width:600px;border-collapse:collapse;font-size:12.5px;background:#fff;
 font-variant-numeric:tabular-nums;}
table.std th:first-child,table.std td:first-child{position:sticky;left:0;z-index:2;
 background:#fff;box-shadow:1px 0 0 var(--rule);}
table.std th:first-child{background:var(--paper);}
table.std tfoot td:first-child{background:var(--paper);}
table.std th{font-family:'Saira Condensed';font-size:11px;letter-spacing:1.1px;text-transform:uppercase;
 color:var(--mut);text-align:left;padding:9px 8px;background:var(--paper);white-space:nowrap;}
table.std td{padding:9px 8px;border-top:1px solid var(--rule);white-space:nowrap;}
table.std td.hl{font-weight:700;color:var(--blue);}
table.std tfoot td{font-weight:700;background:var(--paper);border-top:2px solid var(--ink);}
table.std td.win{color:var(--blue);font-weight:700;}
table.std tr.tA td:first-child{box-shadow:inset 3px 0 0 var(--blue);}
table.std tr.tB td:first-child{box-shadow:inset 3px 0 0 var(--rust);}
.minitable{margin-top:16px;background:#fff;border:1px solid var(--rule);border-radius:12px;overflow:hidden;}
.mt-h{font-family:'Saira Condensed';font-size:12px;letter-spacing:2px;text-transform:uppercase;
 padding:9px 13px;background:var(--paper);color:var(--mut);}
.mt-r{display:flex;align-items:center;gap:9px;padding:9px 13px;border-top:1px solid var(--rule);font-size:12.5px;}
.mt-n{font-family:'Saira Condensed';font-weight:700;color:var(--blue);width:24px;}
.mt-c{flex:1;color:var(--mut);}
.mt-s{font-size:11px;color:var(--mut);}
.mt-p{font-variant-numeric:tabular-nums;font-weight:700;}
.mt-w{font-size:11px;color:var(--mut);}
@media(max-width:480px){
  .sval{font-size:38px;}.erow{grid-template-columns:88px minmax(0,1fr);}
  .q{flex:0 0 38px;height:38px;}
  .tabs button{font-size:11px;letter-spacing:.5px;}
  .seg-v{font-size:15px;}
}
`;
