import React, { useState, useMemo } from "react";
import underdawgzLogo from "./assets/underdawgz.png";
import lifemaxxingLogo from "./assets/lifemaxxing.png";

/* ─── COURSES ────────────────────────────────────────────────── */
const COURSES = {
  sandhollow: { name:"Sand Hollow Resort", sub:"Championship · Hurricane, UT",
    par:[4,5,3,4,4,4,5,3,4,5,3,4,4,4,3,4,5,4],
    hcp:[15,7,17,5,13,1,3,11,9,10,16,2,14,4,8,18,12,6],
    tees:[{name:"Championship",yds:6893},{name:"Signature",yds:6462},{name:"Fought Combo",yds:5934}] },
  copperrock: { name:"Copper Rock", sub:"Hurricane, UT",
    par:[5,4,4,3,5,4,3,4,4,4,4,5,4,4,3,5,3,4],
    hcp:[14,2,16,12,8,18,4,6,10,7,9,13,1,3,17,11,15,5],
    tees:[{name:"Black",yds:6685},{name:"Gold",yds:6185},{name:"Silver",yds:5753}] },
  blackdesert: { name:"Black Desert", sub:"Ivins, UT",
    par:[4,4,3,4,4,4,5,3,5,4,4,4,5,4,3,4,3,5],
    hcp:[9,11,15,1,13,5,3,17,7,14,2,6,10,16,12,4,18,8],
    tees:[{name:"Black Desert",yds:6917},{name:"Weiskopf",yds:6474},{name:"Snow Canyon",yds:5634}] },
  ledges: { name:"The Ledges", sub:"St. George, UT",
    par:[4,3,5,4,3,4,5,4,4,3,5,3,4,4,4,5,4,4],
    hcp:[15,7,3,9,17,11,1,13,5,8,4,18,16,14,12,2,6,10],
    tees:[{name:"Black",yds:7145},{name:"Blue",yds:6713},{name:"White",yds:6230}] },
  coralcanyon: { name:"Coral Canyon", sub:"Washington, UT",
    par:[4,3,4,3,5,4,5,3,5,4,5,3,4,4,3,5,4,4],
    hcp:[9,15,5,7,13,1,17,11,3,6,10,12,8,2,16,18,14,4],
    tees:[{name:"Black",yds:7146},{name:"Blue",yds:6580},{name:"Blue/White",yds:6151}] },
};
const COURSE_KEYS = Object.keys(COURSES);

/* ─── TEAMS ──────────────────────────────────────────────────── */
const TEAM_A = { name:"UnderDawgz",  short:"Dawgz",    logo:underdawgzLogo,
                 players:["Mark","Brian","Paul","James"] };
const TEAM_B = { name:"Lifemaxxing", short:"Lifemaxx", logo:lifemaxxingLogo,
                 players:["Adam","Casey","Michael","Timothy"] };
const ALL = [...TEAM_A.players, ...TEAM_B.players];
const teamOf = p => TEAM_A.players.includes(p) ? "A" : "B";

/* ─── FORMATS ────────────────────────────────────────────────── */
const FORMATS = {
  bb_match:     { label:"Best Ball Match Play",    scope:"group",    pts:2,
                  note:"Each foursome is one 2v2 match. Low net ball wins the hole." },
  best2_stroke: { label:"Best 2 Ball Stroke Play", scope:"combined", pts:2,
                  note:"All eight. The two lowest net scores per hole count toward the team total." },
  stableford:   { label:"Aggregate Stableford",    scope:"combined", pts:2, sf:true,
                  note:"All eight. Every net Stableford score counts. Most points wins." },
  bb_stroke:    { label:"Best Ball Stroke Play",   scope:"combined", pts:2, best1:true,
                  note:"All eight. Lowest net ball per hole is the team score." },
  singles:      { label:"Singles Match Play",      scope:"group2",   pts:4,
                  note:"Two 1v1 matches inside each foursome. One point each." },
};

/* ─── PER-ROUND DEFAULTS ─────────────────────────────────────── */
const SEED = [
  { n:1, day:"Thu 9/10", time:"7:22 AM", course:"sandhollow",  tee:"Signature", format:"bb_match" },
  { n:2, day:"Thu 9/10", time:"2:12 PM", course:"copperrock",  tee:"Gold",      format:"best2_stroke" },
  { n:3, day:"Fri 9/11", time:"3:48 PM", course:"blackdesert", tee:"Weiskopf",  format:"stableford" },
  { n:4, day:"Sat 9/12", time:"7:40 AM", course:"ledges",      tee:"Blue",      format:"bb_stroke" },
  { n:5, day:"Sat 9/12", time:"2:40 PM", course:"coralcanyon", tee:"Blue",      format:"singles" },
];
const BASE_GROUPS = [["Mark","Brian","Adam","Casey"],["Paul","James","Michael","Timothy"]];
const BASE_HCP = { Mark:14, Brian:4, Paul:12, James:9, Adam:11, Casey:18, Michael:7, Timothy:16 };

const emptyScores = () => Object.fromEntries(ALL.map(p => [p, Array(18).fill(null)]));
const clone = x => JSON.parse(JSON.stringify(x));
const pairsFromGroups = groups => groups.map(g => {
  const a = g.filter(p=>teamOf(p)==="A"), b = g.filter(p=>teamOf(p)==="B");
  return a.map((p,i) => [p, b[i] ?? b[0] ?? p]).filter(x => x[1] !== x[0]);
});

function makeRound(seed) {
  const groups = clone(BASE_GROUPS);
  return { ...seed, groups, pairs: pairsFromGroups(groups),
           hcp: { ...BASE_HCP }, scores: emptyScores() };
}

/* ─── SCORING ────────────────────────────────────────────────── */
function strokesOnHole(chc, rank) {
  const c = Math.round(Number(chc)||0);
  if (c >= 0) return Math.floor(c/18) + (rank <= c%18 ? 1 : 0);
  const a = -c;
  return -(Math.floor(a/18) + (rank > 18-(a%18) ? 1 : 0));
}
const netOn = (g, chc, rank) => g==null ? null : g - strokesOnHole(chc, rank);
const sfPts = (net, par) => net==null ? null
  : (net-par<=-3?5 : net-par===-2?4 : net-par===-1?3 : net-par===0?2 : net-par===1?1 : 0);

function matchLabel(run, played) {
  for (let i=0;i<played;i++){
    const rem = 17-i;
    if (Math.abs(run[i]) > rem)
      return { winner: run[i]>0?"A":"B", text:`${Math.abs(run[i])}&${rem}`, done:true };
  }
  const cur = played ? run[played-1] : 0;
  if (!played) return { winner:null, text:"Not started", done:false };
  if (played >= 18)
    return cur===0 ? {winner:null,text:"Halved",done:true}
                   : {winner:cur>0?"A":"B", text:`${Math.abs(cur)} up`, done:true};
  return cur===0 ? {winner:null, text:`AS thru ${played}`, done:false}
                 : {winner:cur>0?"A":"B", text:`${Math.abs(cur)} up thru ${played}`, done:false};
}

function buildMatches(R) {
  const f = FORMATS[R.format];
  if (f.scope === "group")
    return R.groups.map((g,i)=>({ key:`g${i}`, group:i, kind:"match",
      a:g.filter(p=>teamOf(p)==="A"), b:g.filter(p=>teamOf(p)==="B") }));
  if (f.scope === "group2")
    return R.groups.flatMap((g,i)=>(R.pairs[i]||[]).map((pr,j)=>({
      key:`g${i}m${j}`, group:i, kind:"match", a:[pr[0]], b:[pr[1]] })));
  return [{ key:"all", group:null, kind:"total", a:TEAM_A.players, b:TEAM_B.players }];
}

function evalRound(R) {
  const c = COURSES[R.course], f = FORMATS[R.format];
  const hc = R.hcp, sc = R.scores;
  const results = buildMatches(R).map(m => {
    if (m.kind === "match") {
      const roster = [...m.a, ...m.b].filter(p => sc[p]);
      if (!roster.length) return { ...m, holes:Array(18).fill({a:null,b:null,w:null}),
                                   run:Array(18).fill(0), played:0, winner:null, text:"—", done:false };
      const low = Math.min(...roster.map(p=>Number(hc[p])||0));
      const ball = side => Array.from({length:18},(_,h)=>{
        const v = side.map(p=>netOn(sc[p][h], (Number(hc[p])||0)-low, c.hcp[h])).filter(x=>x!=null);
        return v.length ? Math.min(...v) : null;
      });
      const aB = ball(m.a), bB = ball(m.b);
      let r=0; const run=[], holes=[];
      for (let h=0;h<18;h++){
        const av=aB[h], bv=bB[h]; let w=null;
        if (av!=null && bv!=null){ if(av<bv){r++;w="A";} else if(bv<av){r--;w="B";} else w="H"; }
        run.push(r); holes.push({a:av,b:bv,w});
      }
      const played = holes.reduce((t,x,i)=>x.w?i+1:t,0);
      return { ...m, run, holes, played, ...matchLabel(run,played) };
    }
    const holes=[]; let aT=0,bT=0;
    for (let h=0;h<18;h++){
      const val = side => {
        const nets = side.map(p=>netOn(sc[p][h], Number(hc[p])||0, c.hcp[h])).filter(x=>x!=null);
        if (!nets.length) return null;
        if (f.sf) return side.map(p=>sfPts(netOn(sc[p][h],Number(hc[p])||0,c.hcp[h]), c.par[h]))
                             .filter(x=>x!=null).reduce((a,b)=>a+b,0);
        const s=[...nets].sort((x,y)=>x-y);
        return f.best1 ? s[0] : s.slice(0,2).reduce((a,b)=>a+b,0);
      };
      const av=val(m.a), bv=val(m.b);
      if(av!=null)aT+=av; if(bv!=null)bT+=bv;
      let w=null;
      if(av!=null&&bv!=null) w = av===bv?"H" : (f.sf ? (av>bv?"A":"B") : (av<bv?"A":"B"));
      holes.push({a:av,b:bv,w});
    }
    const played = holes.reduce((t,x,i)=>x.w?i+1:t,0);
    const tie = aT===bT, aAhead = f.sf ? aT>bT : aT<bT;
    return { ...m, holes, played, aT, bT, sf:!!f.sf, winner: tie?null:(aAhead?"A":"B"),
             text: played?`${aT} – ${bT}`:"Not started", done: played>=18 };
  });

  const per = f.scope==="combined" ? f.pts : 1;
  let aPts=0,bPts=0;
  results.forEach(r=>{
    if(!r.played) return;
    if(r.winner==="A") aPts+=per; else if(r.winner==="B") bPts+=per;
    else if(r.done){ aPts+=per/2; bPts+=per/2; }
  });
  const played = Math.max(0, ...results.map(r=>r.played));
  return { results, aPts, bPts, played, complete: results.every(r=>r.done), fmt:f };
}

/* ─── APP ────────────────────────────────────────────────────── */
export default function App() {
  const [tab,setTab] = useState("live");
  const [roundN,setRoundN] = useState(1);
  const [rounds,setRounds] = useState(() =>
    Object.fromEntries(SEED.map(s => [s.n, makeRound(s)])));
  const [archive,setArchive] = useState([]);

  const R = rounds[roundN];
  const course = COURSES[R.course];
  const ev = useMemo(()=>evalRound(R), [R]);
  const list = SEED.map(s => rounds[s.n]);
  const allEv = useMemo(()=>list.map(evalRound), [rounds]);
  const totals = allEv.reduce((t,r)=>({a:t.a+r.aPts,b:t.b+r.bPts}),{a:0,b:0});

  // every write is scoped to one round id and never touches the others
  const patch = obj => setRounds(rs => ({ ...rs, [roundN]: { ...rs[roundN], ...obj } }));
  const hasScores = ALL.some(p => R.scores[p].some(v => v != null));

  const setScore = (p,h,v) => setRounds(rs => {
    const cur = rs[roundN];
    const scores = { ...cur.scores, [p]: [...cur.scores[p]] };
    scores[p][h] = v;
    return { ...rs, [roundN]: { ...cur, scores } };
  });

  const changeCourse = key => {
    if (hasScores && !window.confirm(
      `Switching to ${COURSES[key].name} clears the scores already entered for Round ${roundN}. Continue?`)) return;
    patch({ course:key, tee:COURSES[key].tees[1].name, scores:emptyScores() });
  };
  const changeFormat = key => {
    const groups = rounds[roundN].groups;
    patch({ format:key, pairs: pairsFromGroups(groups) });
  };
  const clearScores = () => {
    if (!window.confirm(`Clear all scores for Round ${roundN}?`)) return;
    patch({ scores: emptyScores() });
  };
  const moveToGroup = (player, to) => {
    const groups = R.groups.map(g => g.filter(p => p !== player));
    groups[to] = [...groups[to], player];
    patch({ groups, pairs: pairsFromGroups(groups) });
  };

  const saveToArchive = () => {
    setArchive(a => [{ id:Date.now(), roundN, date:new Date().toLocaleString(),
      course:R.course, tee:R.tee, format:R.format,
      groups:clone(R.groups), hcp:{...R.hcp}, scores:clone(R.scores),
      aPts:ev.aPts, bPts:ev.bPts,
      results:ev.results.map(r=>({a:r.a,b:r.b,text:r.text})) },
      ...a.filter(x=>x.roundN!==roundN)]);
    setTab("archive");
  };

  return (<>
    <style>{CSS}</style>
    <div className="app">
      <header className="top">
        <div><div className="wordmark">BETS</div><div className="tag">St. George · Sept 10–13</div></div>
        <div className="tally">
          <img className="tick" src={TEAM_A.logo} alt={TEAM_A.name}/>
          <span className="tA">{fmt(totals.a)}</span>
          <span className="dash">–</span><span className="tB">{fmt(totals.b)}</span>
          <img className="tick" src={TEAM_B.logo} alt={TEAM_B.name}/>
        </div>
      </header>
      <div className="roundbar">
        <select value={roundN} onChange={e=>setRoundN(+e.target.value)}>
          {list.map(r=><option key={r.n} value={r.n}>
            R{r.n} · {COURSES[r.course].name} · {FORMATS[r.format].label}</option>)}
        </select>
        <div className="rmeta">{R.day} · {R.time} · {R.tee} tees</div>
      </div>
      <nav className="tabs">
        {[["live","Live"],["round","Round"],["archive","Archive"],["stats","Stats"],["std","Standings"]]
          .map(([id,l])=><button key={id} className={tab===id?"on":""} onClick={()=>setTab(id)}>{l}</button>)}
      </nav>
      {tab==="live"    && <Live R={R} course={course} ev={ev} totals={totals} list={list} allEv={allEv}/>}
      {tab==="round"   && <Round key={roundN} R={R} course={course} ev={ev} patch={patch}
                            setScore={setScore} changeCourse={changeCourse} changeFormat={changeFormat}
                            clearScores={clearScores} moveToGroup={moveToGroup} hasScores={hasScores}
                            onArchive={saveToArchive} archived={archive.some(a=>a.roundN===roundN)}/>}
      {tab==="archive" && <Archive archive={archive} onDelete={id=>setArchive(a=>a.filter(x=>x.id!==id))}/>}
      {tab==="stats"   && <Stats archive={archive}/>}
      {tab==="std"     && <Standings list={list} allEv={allEv} totals={totals}/>}
    </div>
  </>);
}
const fmt = n => Number.isInteger(n) ? n : n.toFixed(1);
const sum = a => a.reduce((t,v)=>t+(v??0),0);
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
const Tracker = ({ev}) => (
  <div className="tracker">
    <div className="trk-h"><span>Live tracker</span>
      <span className="trk-pts">{fmt(ev.aPts)} – {fmt(ev.bPts)} this round</span></div>
    {ev.results.map(m=>(
      <div className="trk-r" key={m.key}>
        <div className={"trk-t"+(m.winner==="A"?" lead":"")}>{m.a.join(" & ")}</div>
        <div className={"trk-s"+(m.winner==="A"?" aL":m.winner==="B"?" bL":"")}>{m.text}</div>
        <div className={"trk-t right"+(m.winner==="B"?" lead":"")}>{m.b.join(" & ")}</div>
      </div>))}
  </div>
);

/* ─── LIVE ───────────────────────────────────────────────────── */
function Live({R,course,ev,totals,list,allEv}) {
  return (
    <div className="pad">
      <Big a={totals.a} b={totals.b} mid="Cup" sub="12 points"/>
      <div className="courseband">
        <div><div className="cname">{course.name}</div><div className="csub">{course.sub}</div></div>
        <div className="fmtpill">{FORMATS[R.format].label}</div>
      </div>
      <p className="blurb">{FORMATS[R.format].note}</p>
      <Tracker ev={ev}/>
      <div className="minitable">
        <div className="mt-h">All rounds</div>
        {list.map((r,i)=>(
          <div className="mt-r" key={r.n}>
            <span className="mt-n">R{r.n}</span>
            <span className="mt-c">{COURSES[r.course].name}</span>
            <span className="mt-s">{allEv[i].played ? `thru ${allEv[i].played}` : "—"}</span>
            <span className="mt-p">{fmt(allEv[i].aPts)} – {fmt(allEv[i].bPts)}</span>
          </div>))}
      </div>
    </div>
  );
}

/* ─── ROUND ──────────────────────────────────────────────────── */
function Round({R,course,ev,patch,setScore,changeCourse,changeFormat,clearScores,
                moveToGroup,hasScores,onArchive,archived}) {
  const [open,setOpen] = useState(!hasScores);
  const [mode,setMode] = useState("card");
  const [hole,setHole] = useState(0);
  const f = FORMATS[R.format];

  return (
    <div className="pad">
      <Tracker ev={ev}/>
      <button className="disc" onClick={()=>setOpen(o=>!o)}>
        {open?"▾":"▸"} Setup — Round {R.n}: course, groups, handicaps, matchups
      </button>
      {open && (
        <div className="setup">
          <div className="sethead">Course & format</div>
          <div className="row2">
            <select value={R.course} onChange={e=>changeCourse(e.target.value)}>
              {COURSE_KEYS.map(k=><option key={k} value={k}>{COURSES[k].name}</option>)}
            </select>
            <select value={R.tee} onChange={e=>patch({tee:e.target.value})}>
              {course.tees.map(t=><option key={t.name}>{t.name}</option>)}
            </select>
          </div>
          <select className="full" value={R.format} onChange={e=>changeFormat(e.target.value)}>
            {Object.entries(FORMATS).map(([k,v])=><option key={k} value={k}>{v.label}</option>)}
          </select>
          <div className="hint">These settings belong to Round {R.n} only. Changing the course clears this round's scores.</div>

          <div className="sethead">Groups</div>
          {R.groups.map((g,gi)=>(
            <div className="grpbox" key={gi}>
              <div className="grpname">Group {gi+1}</div>
              <div className="chips">
                {g.map(p=><button key={p} className={"chip t"+teamOf(p)}
                  onClick={()=>moveToGroup(p, gi===0?1:0)}>{p} <i>⇄</i></button>)}
                {!g.length && <span className="hint">Empty</span>}
              </div>
            </div>))}
          <div className="hint">Tap a name to move it to the other group.</div>

          <div className="sethead">Course handicaps</div>
          <div className="hgrid">
            {ALL.map(p=>(
              <label key={p} className={"hcell t"+teamOf(p)}>
                <span>{p}</span>
                <input type="number" inputMode="numeric" value={R.hcp[p]}
                  onChange={e=>patch({hcp:{...R.hcp,[p]:e.target.value===""?"":+e.target.value}})}/>
              </label>))}
          </div>

          {f.scope==="group2" && (<>
            <div className="sethead">Singles matchups</div>
            {R.groups.map((g,gi)=>(
              <div className="grpbox" key={gi}>
                <div className="grpname">Group {gi+1}</div>
                {(R.pairs[gi]||[]).map((pr,j)=>(
                  <div className="pairrow" key={j}>
                    <select className="pA" value={pr[0]} onChange={e=>{
                      const pairs=clone(R.pairs); pairs[gi][j][0]=e.target.value; patch({pairs});}}>
                      {g.filter(p=>teamOf(p)==="A").map(p=><option key={p}>{p}</option>)}
                    </select>
                    <span className="vs">v</span>
                    <select className="pB" value={pr[1]} onChange={e=>{
                      const pairs=clone(R.pairs); pairs[gi][j][1]=e.target.value; patch({pairs});}}>
                      {g.filter(p=>teamOf(p)==="B").map(p=><option key={p}>{p}</option>)}
                    </select>
                  </div>))}
                {!(R.pairs[gi]||[]).length && <span className="hint">Needs two players from each team.</span>}
              </div>))}
          </>)}

          {hasScores && <button className="clearbtn" onClick={clearScores}>Clear this round's scores</button>}
        </div>
      )}

      <div className="modebar">
        <button className={mode==="card"?"on":""} onClick={()=>setMode("card")}>Full card</button>
        <button className={mode==="hole"?"on":""} onClick={()=>setMode("hole")}>One hole</button>
      </div>

      {mode==="hole"
        ? <HoleEntry R={R} course={course} hole={hole} setHole={setHole} setScore={setScore} ev={ev}/>
        : R.groups.map((g,gi)=>(
            <GroupCard key={gi} gi={gi} group={g} course={course} R={R} ev={ev} setScore={setScore}/>))}

      {f.scope==="combined" && <CombinedStrip ev={ev} sf={!!f.sf}/>}

      <button className="archivebtn" onClick={onArchive}>
        {archived ? "Update archived round" : "Save round to archive"}
      </button>
      <p className="note">Saving snapshots both cards, the handicaps and the results. The Stats tab reads only from the archive.</p>
    </div>
  );
}

function GroupCard({gi,group,course,R,ev,setScore}) {
  const f = FORMATS[R.format];
  const mine = ev.results.filter(r=>r.group===gi);
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
              const g = R.scores[p];
              return (
                <tr key={p} className={"t"+teamOf(p)}>
                  <th className="stick">{p} <em>{R.hcp[p]}</em></th>
                  {H.map(h=>(
                    <td key={h} className={"cell "+cls(g[h],course.par[h])}>
                      <input inputMode="numeric" value={g[h] ?? ""} onChange={e=>{
                        const v=e.target.value.replace(/\D/g,"");
                        setScore(p,h,v===""?null:Math.min(19,+v));}}/>
                      {strokesOnHole(R.hcp[p],course.hcp[h])>0 &&
                        <i className="dots">{"•".repeat(Math.min(strokesOnHole(R.hcp[p],course.hcp[h]),3))}</i>}
                    </td>))}
                  <td className="tot">{sum(g.slice(0,9))||"–"}</td>
                  <td className="tot">{sum(g.slice(9))||"–"}</td>
                  <td className="tot">{sum(g)||"–"}</td>
                </tr>);
            })}
            {mine.map(m=>(
              <tr className="resrow" key={m.key}>
                <th className="stick">{m.a.join("/")} v {m.b.join("/")}</th>
                {H.map(h=>{
                  const x=m.holes[h];
                  return <td key={h} className={"res "+(x.w==="A"?"rA":x.w==="B"?"rB":x.w==="H"?"rH":"")}>
                    {x.w==="A"?"▲":x.w==="B"?"▼":x.w==="H"?"–":""}</td>;
                })}
                <td colSpan={3} className="restot">{m.text}</td>
              </tr>))}
          </tbody>
        </table>
      </div>
      <div className="legend">
        {(f.scope==="group"||f.scope==="group2") && (<>
          <span>▲ {TEAM_A.short} wins hole</span><span>▼ {TEAM_B.short} wins hole</span><span>– halved</span></>)}
        <span>• stroke received</span>
      </div>
    </div>
  );
}

function CombinedStrip({ev,sf}) {
  const m = ev.results[0];
  const H = Array.from({length:18},(_,i)=>i);
  let ra=0,rb=0;
  const run = H.map(h=>{ ra+=m.holes[h].a??0; rb+=m.holes[h].b??0; return [ra,rb]; });
  return (
    <div className="gcard">
      <div className="ghead"><span className="gtitle">Team totals</span>
        <span className="gsub">{sf?"Stableford points":"Net strokes"} · running</span></div>
      <div className="scroll">
        <table className="card">
          <thead><tr><th className="stick">Hole</th>{H.map(h=><th key={h}>{h+1}</th>)}<th>Tot</th></tr></thead>
          <tbody>
            <tr className="tA"><th className="stick"><img className="tick sm-crest" src={TEAM_A.logo} alt=""/>{TEAM_A.name}</th>
              {H.map(h=><td key={h} className={m.holes[h].w==="A"?"rA":""}>{m.holes[h].a ?? "·"}</td>)}
              <td className="tot">{m.aT}</td></tr>
            <tr className="tB"><th className="stick"><img className="tick sm-crest" src={TEAM_B.logo} alt=""/>{TEAM_B.name}</th>
              {H.map(h=><td key={h} className={m.holes[h].w==="B"?"rB":""}>{m.holes[h].b ?? "·"}</td>)}
              <td className="tot">{m.bT}</td></tr>
            <tr className="resrow"><th className="stick">Running</th>
              {H.map(h=><td key={h} className="res">{h<m.played?`${run[h][0]}-${run[h][1]}`:""}</td>)}
              <td className="restot">{m.text}</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

function HoleEntry({R,course,hole,setHole,setScore,ev}) {
  const par = course.par[hole];
  const f = FORMATS[R.format];
  return (
    <div>
      <div className="holehead">
        <button className="nav" onClick={()=>setHole(h=>Math.max(0,h-1))} disabled={hole===0}>‹</button>
        <div className="hh"><div className="hnum">Hole {hole+1}</div>
          <div className="hmeta">Par {par} · SI {course.hcp[hole]}</div></div>
        <button className="nav" onClick={()=>setHole(h=>Math.min(17,h+1))} disabled={hole===17}>›</button>
      </div>
      {R.groups.map((g,gi)=>(
        <div key={gi}>
          <div className="ghline">Group {gi+1}</div>
          {g.map(p=>{
            const v = R.scores[p][hole];
            const net = netOn(v, R.hcp[p], course.hcp[hole]);
            return (
              <div className={"erow t"+teamOf(p)} key={p}>
                <div className="ename">{p}<em>{net!=null?`net ${net}`:"—"}</em></div>
                <div className="quick">
                  {[par-1,par,par+1,par+2,par+3].map(n=>
                    <button key={n} className={v===n?"q on":"q"}
                      onClick={()=>setScore(p,hole,v===n?null:n)}>{n}</button>)}
                  <button className="q wide" onClick={()=>setScore(p,hole,Math.max(1,(v??par)-1))}>−</button>
                  <button className="q wide" onClick={()=>setScore(p,hole,(v??par)+1)}>+</button>
                </div>
              </div>);
          })}
          {ev.results.filter(r=>r.group===gi).map(m=>{
            const x=m.holes[hole];
            return <div className="holeres" key={m.key}>
              <span>{m.a.join("/")} v {m.b.join("/")} — {x.w==="A"?`${TEAM_A.short} wins`:x.w==="B"?`${TEAM_B.short} wins`:x.w==="H"?"Halved":"—"}</span>
              <span className="hr2">{m.text}</span></div>;
          })}
        </div>))}
      {f.scope==="combined" && (()=>{
        const x = ev.results[0].holes[hole];
        return <div className="holeres">
          <span>Hole {hole+1} — {TEAM_A.short} {x.a ?? "·"} · {TEAM_B.short} {x.b ?? "·"}</span>
          <span className="hr2">{ev.results[0].text}</span></div>;
      })()}
      <div className="dots18">
        {Array.from({length:18}).map((_,i)=>{
          const roster = R.groups.flat();
          const done = roster.length && roster.every(p=>R.scores[p][i]!=null);
          const some = roster.some(p=>R.scores[p][i]!=null);
          return <button key={i} className={"d "+(i===hole?"cur ":"")+(done?"full":some?"part":"")}
            onClick={()=>setHole(i)}>{i+1}</button>;
        })}
      </div>
    </div>
  );
}

/* ─── ARCHIVE ────────────────────────────────────────────────── */
function Archive({archive,onDelete}) {
  const [openId,setOpen] = useState(null);
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
          <div className="gcard" key={a.id}>
            <div className="ghead click" onClick={()=>setOpen(o=>o===a.id?null:a.id)}>
              <span className="gtitle">R{a.roundN} · {c.name}</span>
              <span className="gsub">{FORMATS[a.format].label} · {fmt(a.aPts)}–{fmt(a.bPts)}</span>
            </div>
            {openId===a.id && (<>
              <div className="scroll">
                <table className="card">
                  <thead>
                    <tr><th className="stick">Hole</th>{H.map(h=><th key={h}>{h+1}</th>)}<th>Tot</th></tr>
                    <tr className="par"><th className="stick">Par</th>{H.map(h=><td key={h}>{c.par[h]}</td>)}<td>{sum(c.par)}</td></tr>
                  </thead>
                  <tbody>
                    {a.groups.flat().map(p=>(
                      <tr key={p} className={"t"+teamOf(p)}>
                        <th className="stick">{p} <em>{a.hcp[p]}</em></th>
                        {H.map(h=><td key={h} className={cls(a.scores[p][h],c.par[h])}>{a.scores[p][h] ?? "·"}</td>)}
                        <td className="tot">{sum(a.scores[p])||"–"}</td>
                      </tr>))}
                  </tbody>
                </table>
              </div>
              <div className="arcfoot">
                <div>{a.results.map((r,i)=><span key={i} className="rchip">{r.a.join("/")} v {r.b.join("/")} · {r.text}</span>)}</div>
                <button className="del" onClick={()=>onDelete(a.id)}>Remove</button>
              </div>
              <div className="hint pad-in">Saved {a.date} · {a.tee} tees</div>
            </>)}
          </div>);
      })}
    </div>
  );
}

/* ─── STATS ──────────────────────────────────────────────────── */
function Stats({archive}) {
  const [scope,setScope] = useState("all");
  const [sortK,setSortK] = useState("net");
  if (!archive.length) return (
    <div className="pad"><div className="empty"><b>Stats appear once rounds are archived</b>
      <p>This tab reads only from saved scorecards, so nothing here shifts while a round is still in play.</p>
    </div></div>);

  const src = scope==="all" ? archive : archive.filter(a=>String(a.roundN)===scope);
  const rows = ALL.map(p=>{
    let holes=0,gross=0,net=0,toPar=0,e=0,b=0,pr=0,bo=0,d=0,rds=0;
    src.forEach(a=>{
      const c = COURSES[a.course]; let any=false;
      (a.scores[p]||[]).forEach((v,h)=>{
        if(v==null) return;
        any=true; holes++; gross+=v; toPar+=v-c.par[h];
        net += netOn(v, a.hcp[p], c.hcp[h]);
        const diff=v-c.par[h];
        if(diff<=-2)e++; else if(diff===-1)b++; else if(diff===0)pr++; else if(diff===1)bo++; else d++;
      });
      if(any) rds++;
    });
    return {p,rds,holes,toPar,e,b,pr,bo,d,
            avg: holes?gross/holes*18:0, avgNet: holes?net/holes*18:0};
  }).filter(r=>r.holes);

  const sorted = [...rows].sort((x,y)=>
    sortK==="net" ? x.avgNet-y.avgNet : sortK==="gross" ? x.avg-y.avg : (y.b+y.e)-(x.b+x.e));

  return (
    <div className="pad">
      <div className="filters">
        <select value={scope} onChange={e=>setScope(e.target.value)}>
          <option value="all">All archived rounds</option>
          {[...archive].sort((a,b)=>a.roundN-b.roundN).map(a=>
            <option key={a.id} value={String(a.roundN)}>R{a.roundN} · {COURSES[a.course].name}</option>)}
        </select>
        <select value={sortK} onChange={e=>setSortK(e.target.value)}>
          <option value="net">Sort by net average</option>
          <option value="gross">Sort by gross average</option>
          <option value="birdies">Sort by birdies+</option>
        </select>
      </div>
      <div className="scroll card-wrap">
        <table className="std">
          <thead><tr><th>Player</th><th>Rds</th><th>Holes</th><th>Gross 18</th><th>Net 18</th>
            <th>+/–</th><th>Eag</th><th>Bird</th><th>Par</th><th>Bog</th><th>Dbl+</th></tr></thead>
          <tbody>
            {sorted.map(r=>(
              <tr key={r.p} className={"t"+teamOf(r.p)}>
                <td><b>{r.p}</b></td><td>{r.rds}</td><td>{r.holes}</td>
                <td>{r.avg.toFixed(1)}</td><td className="hl">{r.avgNet.toFixed(1)}</td>
                <td>{(r.toPar>0?"+":"")+r.toPar}</td>
                <td>{r.e}</td><td>{r.b}</td><td>{r.pr}</td><td>{r.bo}</td><td>{r.d}</td>
              </tr>))}
          </tbody>
        </table>
      </div>
      <p className="note">Averages scale to 18 holes so partial rounds stay comparable.</p>
    </div>
  );
}

/* ─── STANDINGS ──────────────────────────────────────────────── */
function Standings({list,allEv,totals}) {
  return (
    <div className="pad">
      <Big a={totals.a} b={totals.b} mid="of 12"/>
      <div className="card-wrap">
        <table className="std">
          <thead><tr><th>Round</th><th>Format</th><th>Pts</th><th>{TEAM_A.name}</th><th>{TEAM_B.name}</th></tr></thead>
          <tbody>
            {list.map((r,i)=>(
              <tr key={r.n}>
                <td><b>R{r.n}</b><br/><span className="sm">{COURSES[r.course].name}</span></td>
                <td className="sm">{FORMATS[r.format].label}</td>
                <td>{FORMATS[r.format].pts}</td>
                <td className={allEv[i].aPts>allEv[i].bPts?"win":""}>{fmt(allEv[i].aPts)}</td>
                <td className={allEv[i].bPts>allEv[i].aPts?"win":""}>{fmt(allEv[i].bPts)}</td>
              </tr>))}
          </tbody>
          <tfoot><tr><td colSpan={3}>Total</td><td>{fmt(totals.a)}</td><td>{fmt(totals.b)}</td></tr></tfoot>
        </table>
      </div>
      <p className="note">Placeholder scheme: 2 points per 4v4 round, 1 per individual match. Send the real one and I'll swap it.</p>
    </div>
  );
}

/* ─── STYLES ─────────────────────────────────────────────────── */
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Saira+Condensed:wght@500;600;700&family=Inter:wght@400;500;600;700&display=swap');
*{box-sizing:border-box;margin:0;padding:0;}
:root{--paper:#F2F2EE;--ink:#0B1F3A;--blue:#1B5FA8;--blueL:#3E86D6;--blueF:#E4ECF6;
 --rust:#A9522E;--rustF:#F3E7E0;--rule:#D8D8D0;--mut:#6C7480;}
body{background:var(--paper);}
.app{font-family:Inter,system-ui,sans-serif;color:var(--ink);background:var(--paper);
 max-width:820px;margin:0 auto;min-height:100vh;padding-bottom:60px;}
.pad{padding:14px;}
.note{font-size:12px;color:var(--mut);margin-top:12px;line-height:1.5;}
.sm{font-size:11px;color:var(--mut);}
.hint{font-size:11px;color:var(--mut);margin:6px 0 2px;display:block;}
.pad-in{padding:0 12px 10px;}

.top{display:flex;align-items:center;justify-content:space-between;padding:13px 16px;
 background:var(--ink);color:var(--paper);}
.wordmark{font-family:'Saira Condensed';font-weight:700;font-size:29px;letter-spacing:6px;line-height:1;}
.tag{font-size:10px;letter-spacing:2.2px;text-transform:uppercase;color:#8FA6C4;margin-top:3px;}
.tally{font-family:'Saira Condensed';font-size:29px;font-weight:700;font-variant-numeric:tabular-nums;
 display:flex;align-items:center;gap:7px;}
.tick{height:26px;width:26px;object-fit:contain;border-radius:5px;background:rgba(255,255,255,.07);padding:1px;}
.sm-crest{height:17px;width:17px;vertical-align:-3px;margin-right:5px;background:none;padding:0;}
.crest{height:46px;display:flex;align-items:center;justify-content:center;margin-bottom:6px;}
.crest img{max-height:46px;max-width:100%;object-fit:contain;}
.tally .tA{color:var(--blueL);}.tally .tB{color:#E08A62;}.tally .dash{color:#4A5F7D;margin:0 6px;}

.roundbar{background:#fff;border-bottom:1px solid var(--rule);padding:9px 14px;}
select{font-family:Inter;font-size:13px;font-weight:600;color:var(--ink);border:1px solid var(--rule);
 border-radius:8px;padding:8px 9px;background:var(--paper);}
.roundbar select{width:100%;}
.rmeta{font-size:11px;color:var(--mut);margin-top:5px;}

.tabs{display:flex;background:#fff;border-bottom:1px solid var(--rule);position:sticky;top:0;z-index:6;}
.tabs button{flex:1;padding:11px 2px;border:0;background:none;cursor:pointer;font-family:'Saira Condensed';
 font-size:13px;font-weight:600;letter-spacing:1.4px;text-transform:uppercase;color:var(--mut);
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
 text-transform:uppercase;padding:6px 10px;border-radius:20px;white-space:nowrap;}
.blurb{font-size:12.5px;color:var(--mut);margin-bottom:12px;line-height:1.5;}

.tracker{background:#fff;border:1px solid var(--rule);border-radius:12px;overflow:hidden;margin-bottom:12px;}
.trk-h{display:flex;justify-content:space-between;align-items:center;padding:9px 12px;background:var(--ink);
 color:var(--paper);font-family:'Saira Condensed';font-size:12px;letter-spacing:2px;text-transform:uppercase;}
.trk-pts{color:#8FA6C4;letter-spacing:1px;}
.trk-r{display:grid;grid-template-columns:1fr auto 1fr;gap:8px;align-items:center;padding:9px 12px;
 border-top:1px solid var(--rule);}
.trk-t{font-size:12.5px;color:var(--mut);}
.trk-t.right{text-align:right;}
.trk-t.lead{color:var(--ink);font-weight:700;}
.trk-s{font-family:'Saira Condensed';font-size:14px;font-weight:600;letter-spacing:.8px;padding:3px 9px;
 border-radius:6px;background:var(--paper);white-space:nowrap;}
.trk-s.aL{background:var(--blueF);color:var(--blue);}
.trk-s.bL{background:var(--rustF);color:var(--rust);}

.disc{width:100%;text-align:left;background:#fff;border:1px solid var(--rule);border-radius:10px;
 padding:11px 12px;font-family:Inter;font-size:13px;font-weight:600;color:var(--ink);cursor:pointer;margin-bottom:10px;}
.setup{background:#fff;border:1px solid var(--rule);border-radius:12px;padding:13px;margin-bottom:12px;}
.sethead{font-family:'Saira Condensed';font-size:12px;letter-spacing:2px;text-transform:uppercase;
 color:var(--mut);margin:14px 0 7px;}
.setup .sethead:first-child{margin-top:0;}
.row2{display:flex;gap:8px;margin-bottom:8px;}
.row2 select{flex:1;min-width:0;}
select.full{width:100%;}
.grpbox{border:1px solid var(--rule);border-radius:9px;padding:9px;margin-bottom:7px;}
.grpname{font-size:11px;letter-spacing:1.4px;text-transform:uppercase;color:var(--mut);margin-bottom:6px;}
.chips{display:flex;flex-wrap:wrap;gap:5px;}
.chip{border:1px solid var(--rule);border-radius:20px;padding:5px 10px;font-size:12px;
 font-family:Inter;font-weight:600;cursor:pointer;}
.chip i{font-style:normal;opacity:.4;font-size:10px;}
.chip.tA{background:var(--blueF);color:var(--blue);border-color:#C6D9EE;}
.chip.tB{background:var(--rustF);color:var(--rust);border-color:#E8D2C6;}
.hgrid{display:grid;grid-template-columns:repeat(auto-fit,minmax(84px,1fr));gap:5px;}
.hcell{display:flex;align-items:center;justify-content:space-between;gap:5px;border:1px solid var(--rule);
 border-radius:8px;padding:5px 7px;font-size:11.5px;}
.hcell.tA{background:var(--blueF);}.hcell.tB{background:var(--rustF);}
.hcell input{width:36px;border:0;background:#fff;border-radius:5px;padding:4px;text-align:center;
 font-family:Inter;font-weight:700;font-size:13px;color:var(--ink);}
.pairrow{display:flex;align-items:center;gap:7px;margin-bottom:5px;}
.pairrow select{flex:1;min-width:0;}
.pairrow .pA{background:var(--blueF);}.pairrow .pB{background:var(--rustF);}
.vs{font-family:'Saira Condensed';color:var(--mut);font-size:13px;}
.clearbtn{width:100%;margin-top:14px;padding:10px;border:1px solid var(--rule);background:var(--paper);
 color:var(--rust);border-radius:8px;font-family:Inter;font-size:12.5px;font-weight:600;cursor:pointer;}

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

.scroll{overflow-x:auto;-webkit-overflow-scrolling:touch;}
.card-wrap{background:#fff;border:1px solid var(--rule);border-radius:12px;overflow:hidden;}
table.card{border-collapse:collapse;font-size:12px;width:100%;font-variant-numeric:tabular-nums;}
table.card th,table.card td{padding:4px 3px;text-align:center;border-bottom:1px solid var(--rule);white-space:nowrap;}
table.card thead th{font-family:'Saira Condensed';font-size:11px;letter-spacing:.8px;color:var(--mut);padding:6px 3px;}
.stick{position:sticky;left:0;background:#fff;text-align:left!important;z-index:2;font-weight:600;
 font-size:11px;padding:4px 8px 4px 6px!important;box-shadow:1px 0 0 var(--rule);}
.stick em{color:var(--mut);font-style:normal;font-size:10px;background:var(--paper);
 border-radius:4px;padding:1px 4px;margin-left:3px;}
tr.par td{background:var(--paper);font-weight:600;}
tr.hcp td{color:var(--mut);font-size:10px;}
tr.tA .stick{border-left:3px solid var(--blue);}
tr.tB .stick{border-left:3px solid var(--rust);}
td.cell{padding:0!important;position:relative;}
td.cell input{width:30px;height:30px;border:0;background:transparent;text-align:center;
 font-family:Inter;font-size:13px;font-weight:600;color:inherit;padding:0;}
td.cell input:focus{outline:2px solid var(--blue);outline-offset:-2px;background:#fff;}
td.eagle{background:#F6D98A;font-weight:700;}
td.birdie{background:var(--blueF);color:var(--blue);}
td.bogey{background:#F6EDE7;}
td.dbl{background:var(--rustF);color:var(--rust);}
td.tot{font-weight:700;background:var(--paper);}
.dots{position:absolute;top:1px;right:2px;font-style:normal;font-size:7px;color:var(--mut);line-height:1;}
tr.resrow th,tr.resrow td{background:#F7F8F5;border-top:2px solid var(--rule);font-size:11px;}
td.res{font-weight:700;}
td.rA{background:var(--blueF);color:var(--blue);}
td.rB{background:var(--rustF);color:var(--rust);}
td.rH{color:var(--mut);}
td.restot{font-family:'Saira Condensed';font-size:12px;letter-spacing:.6px;font-weight:600;}
.legend{display:flex;gap:12px;flex-wrap:wrap;font-size:10.5px;color:var(--mut);padding:8px 12px;}

.holehead{display:flex;align-items:center;justify-content:space-between;background:var(--ink);
 color:var(--paper);border-radius:12px;padding:11px 8px;margin-bottom:10px;}
.hh{text-align:center;}
.hnum{font-family:'Saira Condensed';font-size:25px;font-weight:700;letter-spacing:2px;}
.hmeta{font-size:11px;color:#8FA6C4;}
.nav{width:44px;height:44px;border:0;background:rgba(255,255,255,.1);color:#fff;border-radius:10px;
 font-size:22px;cursor:pointer;}
.nav:disabled{opacity:.25;}
.erow{display:grid;grid-template-columns:96px 1fr;gap:8px;align-items:center;background:#fff;
 border:1px solid var(--rule);border-radius:10px;padding:7px;margin-bottom:6px;}
.erow.tA{border-left:4px solid var(--blue);}.erow.tB{border-left:4px solid var(--rust);}
.ename{font-size:12.5px;font-weight:600;}
.ename em{display:block;font-style:normal;font-size:10px;color:var(--mut);font-weight:400;}
.quick{display:flex;gap:4px;}
.q{flex:1;min-width:0;height:36px;border:1px solid var(--rule);background:var(--paper);border-radius:8px;
 font-family:Inter;font-size:13px;font-weight:600;color:var(--ink);cursor:pointer;}
.q.on{background:var(--blue);border-color:var(--blue);color:#fff;}
.q.wide{flex:.65;color:var(--mut);}
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
.empty{background:#fff;border:1px dashed var(--rule);border-radius:12px;padding:28px 20px;text-align:center;}
.empty b{font-family:'Saira Condensed';font-size:17px;letter-spacing:1px;}
.empty p{font-size:12.5px;color:var(--mut);margin-top:6px;line-height:1.5;}

.filters{display:flex;gap:8px;margin-bottom:10px;}
.filters select{flex:1;min-width:0;}
table.std{width:100%;border-collapse:collapse;font-size:12.5px;background:#fff;
 font-variant-numeric:tabular-nums;}
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
.mt-r{display:flex;align-items:center;gap:10px;padding:9px 13px;border-top:1px solid var(--rule);font-size:12.5px;}
.mt-n{font-family:'Saira Condensed';font-weight:700;color:var(--blue);width:24px;}
.mt-c{flex:1;color:var(--mut);}
.mt-s{font-size:11px;color:var(--mut);}
.mt-p{font-variant-numeric:tabular-nums;font-weight:600;min-width:52px;text-align:right;}
@media(max-width:480px){.sval{font-size:40px;}.erow{grid-template-columns:82px 1fr;}}
`;
