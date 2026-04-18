'use client';
import { motion, useMotionValue, useSpring, useTransform, useScroll, useInView, animate, AnimatePresence } from 'framer-motion';
import { useEffect, useRef, useState, useMemo, useCallback } from 'react';

/* ── tokens ── */
const BG='#030308', IND='#6366f1', VIO='#8b5cf6', ACC='#e0e7ff';
const SURF='rgba(255,255,255,0.03)', BOR='rgba(255,255,255,0.08)';
const GRAD=`linear-gradient(135deg,${IND},${VIO})`;
const glow=(c,s=20)=>`0 0 ${s}px ${c}, 0 0 ${s*2}px ${c}88`;

/* ── reduced motion ── */
function useRM(){
  const[v,s]=useState(false);
  useEffect(()=>{
    if(typeof window==='undefined')return;
    const mq=window.matchMedia('(prefers-reduced-motion:reduce)');
    s(mq.matches);const h=()=>s(mq.matches);
    mq.addEventListener('change',h);return()=>mq.removeEventListener('change',h);
  },[]);return v;
}

/* ── repulsion hook ── */
function useRepulse(mx,my,strength=70,radius=160){
  const ref=useRef(null);
  const rx=useMotionValue(0),ry=useMotionValue(0);
  const sx=useSpring(rx,{stiffness:150,damping:15});
  const sy=useSpring(ry,{stiffness:150,damping:15});
  useEffect(()=>{
    function upd(){
      const el=ref.current;if(!el)return;
      const r=el.getBoundingClientRect();
      const cx=r.left+r.width/2,cy=r.top+r.height/2;
      const dx=mx.get()-cx,dy=my.get()-cy;
      const d=Math.sqrt(dx*dx+dy*dy);
      if(d<radius&&d>0){const f=(1-d/radius)*strength;rx.set(-dx/d*f);ry.set(-dy/d*f);}
      else{rx.set(0);ry.set(0);}
    }
    const uX=mx.on('change',upd),uY=my.on('change',upd);
    return()=>{uX();uY();};
  },[mx,my,strength,radius,rx,ry]);
  return{ref,style:{x:sx,y:sy}};
}

/* ── magnet hook ── */
function useMagnet(str=0.4,rad=130){
  const ref=useRef(null);
  const rx=useMotionValue(0),ry=useMotionValue(0);
  const sx=useSpring(rx,{stiffness:200,damping:20});
  const sy=useSpring(ry,{stiffness:200,damping:20});
  const onMove=useCallback(e=>{
    const el=ref.current;if(!el)return;
    const r=el.getBoundingClientRect();
    const dx=e.clientX-(r.left+r.width/2);
    const dy=e.clientY-(r.top+r.height/2);
    if(Math.sqrt(dx*dx+dy*dy)<rad){rx.set(dx*str);ry.set(dy*str);}
  },[str,rad,rx,ry]);
  const onLeave=useCallback(()=>{rx.set(0);ry.set(0);},[rx,ry]);
  return{ref,style:{x:sx,y:sy},onMouseMove:onMove,onMouseLeave:onLeave};
}

/* ── animated counter ── */
function Counter({to,label,unit,inView}){
  const[val,setVal]=useState(0);
  useEffect(()=>{
    if(!inView)return;
    const c=animate(0,to,{duration:2.2,ease:'easeOut',onUpdate:v=>setVal(v)});
    return()=>c.stop();
  },[inView,to]);
  const fmt=v=>to>=1000?Math.round(v).toLocaleString():v.toFixed(1);
  return(
    <div style={{textAlign:'center'}}>
      <div style={{fontSize:42,fontWeight:800,color:ACC,letterSpacing:'-0.03em',fontFamily:'system-ui'}}>
        {fmt(val)}<span style={{fontSize:18,color:IND,marginLeft:4}}>{unit}</span>
      </div>
      <div style={{fontSize:11,color:'rgba(255,255,255,0.4)',letterSpacing:'0.2em',textTransform:'uppercase',marginTop:6}}>{label}</div>
      {/* progress bar */}
      <div style={{height:3,background:'rgba(255,255,255,0.06)',borderRadius:100,marginTop:14,overflow:'hidden'}}>
        <motion.div style={{height:'100%',background:GRAD,borderRadius:100,boxShadow:glow(IND,8)}}
          initial={{width:0}} animate={inView?{width:'100%'}:{width:0}}
          transition={{duration:2.2,ease:'easeOut'}}/>
      </div>
    </div>
  );
}

/* ── particle ── */
function Ptcl({x,y,size,dur,delay,dx,rm}){
  if(rm)return null;
  return(
    <motion.div style={{position:'absolute',left:`${x}%`,bottom:`${y}%`,width:size,height:size,borderRadius:'50%',background:'rgba(99,102,241,0.55)',pointerEvents:'none',willChange:'transform,opacity'}}
      animate={{y:[-0,-800],x:[0,dx],opacity:[0,0.75,0.75,0]}}
      transition={{duration:dur,delay,repeat:Infinity,ease:'linear',opacity:{times:[0,0.08,0.92,1]}}}/>
  );
}

/* ── glass card ── */
const GCard=({children,style={},hover=true,...p})=>(
  <motion.div style={{background:SURF,border:`1px solid ${BOR}`,borderRadius:20,backdropFilter:'blur(20px)',WebkitBackdropFilter:'blur(20px)',willChange:'transform',...style}}
    whileHover={hover?{scale:1.04,borderColor:'rgba(99,102,241,0.45)',boxShadow:'inset 0 0 30px rgba(99,102,241,0.08), 0 20px 60px rgba(0,0,0,0.5)',y:-6}:{}}
    transition={{type:'spring',stiffness:200,damping:20}} {...p}>
    {children}
  </motion.div>
);

/* ── orbit node ── */
function OrbitNode({radius,dur,dir,label,rm}){
  return(
    <motion.div style={{position:'absolute',top:'50%',left:'50%',width:0,height:0,willChange:'transform'}}
      animate={rm?{}:{rotate:dir*360}} transition={{duration:dur,repeat:Infinity,ease:'linear'}}>
      <motion.div style={{position:'absolute',top:-radius,left:0,transform:'translateX(-50%)'}}
        animate={rm?{}:{rotate:dir*-360}} transition={{duration:dur,repeat:Infinity,ease:'linear'}}>
        <div style={{background:GRAD,borderRadius:100,padding:'6px 14px',fontSize:10,fontWeight:700,letterSpacing:'0.18em',color:'#fff',textTransform:'uppercase',boxShadow:glow(IND,12),whiteSpace:'nowrap'}}>
          {label}
        </div>
      </motion.div>
    </motion.div>
  );
}

/* ── feature card data ── */
const FEATURES=[
  {icon:'⚡',title:'Detect Anomalies',desc:'Rolling 2× historical average spike detection across all models.'},
  {icon:'🔍',title:'Explain WHY',desc:'AI causation engine cites exact tokens, share %, and cost delta.'},
  {icon:'💰',title:'Financial Impact',desc:'Real dollar savings — per run, daily, and monthly estimates.'},
  {icon:'🎯',title:'Ranked Actions',desc:'Highest-savings actions ranked first. No guesswork needed.'},
  {icon:'🔄',title:'Auto Monitoring',desc:'Live ingestion pipeline runs every 6s. No manual input.'},
  {icon:'📉',title:'Cost Optimization',desc:'Model migration paths with exact savings projections.'},
];

/* ══════════════════════════════════════════════
   MAIN COMPONENT
══════════════════════════════════════════════ */
export default function AntigravityUI(){
  const rm=useRM();

  /* cursor */
  const curX=useMotionValue(-200),curY=useMotionValue(-200);
  const scx=useSpring(curX,{stiffness:120,damping:18});
  const scy=useSpring(curY,{stiffness:120,damping:18});
  const[curBig,setCurBig]=useState(false);
  useEffect(()=>{
    const h=e=>{curX.set(e.clientX);curY.set(e.clientY);};
    window.addEventListener('mousemove',h);return()=>window.removeEventListener('mousemove',h);
  },[curX,curY]);

  /* scroll */
  const{scrollY}=useScroll();
  const heroY=useTransform(scrollY,[0,600],[0,-120]);
  const partY=useTransform(scrollY,[0,600],[0,-60]);

  /* particles */
  const particles=useMemo(()=>Array.from({length:60},(_,i)=>({
    id:i,x:Math.random()*100,y:Math.random()*30,
    size:2+Math.random()*4,dur:20+Math.random()*40,
    delay:Math.random()*20,dx:(Math.random()-0.5)*120,
  })),[]);

  /* stat cards mouse */
  const heroMX=useMotionValue(0),heroMY=useMotionValue(0);
  const heroRef=useRef(null);
  const onHeroMouse=useCallback(e=>{heroMX.set(e.clientX);heroMY.set(e.clientY);},[heroMX,heroMY]);

  /* orbit wave rings */
  const rings=useMemo(()=>[0,1,2,3],[]);

  /* inView refs */
  const orbitRef=useRef(null);
  const featRef=useRef(null);
  const metricRef=useRef(null);
  const footRef=useRef(null);
  const orbitInView=useInView(orbitRef,{once:true,margin:'-100px'});
  const featInView=useInView(featRef,{once:true,margin:'-80px'});
  const metricInView=useInView(metricRef,{once:true,margin:'-80px'});

  /* repulsion for stat cards */
  const r1=useRepulse(heroMX,heroMY);
  const r2=useRepulse(heroMX,heroMY);
  const r3=useRepulse(heroMX,heroMY);
  const reps=[r1,r2,r3];

  /* magnetic buttons */
  const mb1=useMagnet();const mb2=useMagnet();const mb3=useMagnet();
  const mbs=[mb1,mb2,mb3];
  const BTNS=[
    {label:'Connect AI',    href:'/connect',   bg:GRAD,   color:'#fff'},
    {label:'View Dashboard',href:'/dashboard', bg:'transparent', color:ACC, border:`1px solid ${BOR}`},
    {label:'Run Analysis',  href:'/analyze',   bg:`linear-gradient(135deg,#f43f5e,#e11d48)`,color:'#fff'},
  ];

  const STATS=[
    {label:'∞',sub:'Auto Detection'},
    {label:'WHY',sub:'Real Causation'},
    {label:'$0',sub:'Cost Wasted'},
  ];

  const METRICS=[
    {to:47280,label:'Total Cost Saved',unit:'$'},
    {to:94.7,label:'Detection Accuracy',unit:'%'},
    {to:1284,label:'Anomalies Caught',unit:''},
  ];

  return(
    <div style={{background:BG,minHeight:'100vh',overflow:'hidden',fontFamily:'system-ui,sans-serif',position:'relative'}}>

      {/* ── custom cursor ── */}
      {!rm&&(
        <motion.div style={{position:'fixed',top:0,left:0,zIndex:9999,pointerEvents:'none',x:scx,y:scy,translateX:'-50%',translateY:'-50%'}}>
          <motion.div animate={{width:curBig?56:20,height:curBig?56:20,opacity:curBig?0.6:0.9}}
            transition={{type:'spring',stiffness:300,damping:25}}
            style={{borderRadius:'50%',background:'rgba(99,102,241,0.35)',border:`1px solid ${IND}`,boxShadow:glow(IND,curBig?24:10),mixBlendMode:'screen'}}/>
        </motion.div>
      )}

      {/* ═══ SECTION 1 — HERO ═══ */}
      <motion.section ref={heroRef} onMouseMove={onHeroMouse}
        style={{position:'relative',minHeight:'100vh',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',overflow:'hidden',padding:'0 24px'}}
        onMouseEnter={()=>setCurBig(false)}>

        {/* particles */}
        <motion.div style={{position:'absolute',inset:0,pointerEvents:'none',y:partY}}>
          {particles.map(p=><Ptcl key={p.id} {...p} rm={rm}/>)}
        </motion.div>

        {/* glow blob */}
        <div style={{position:'absolute',top:'20%',left:'50%',transform:'translateX(-50%)',width:600,height:400,background:`radial-gradient(ellipse,rgba(99,102,241,0.18) 0%,transparent 70%)`,pointerEvents:'none'}}/>

        <motion.div style={{position:'relative',textAlign:'center',y:heroY}} initial={{opacity:0}} animate={{opacity:1}} transition={{duration:1}}>

          {/* badge */}
          <motion.div animate={rm?{}:{y:[0,-10,0]}} transition={{duration:3,repeat:Infinity,ease:'easeInOut'}}
            style={{display:'inline-flex',alignItems:'center',gap:8,padding:'7px 18px',borderRadius:100,background:SURF,border:`1px solid ${BOR}`,boxShadow:glow(IND,14),marginBottom:32}}>
            <span style={{width:6,height:6,borderRadius:'50%',background:IND,display:'block',boxShadow:glow(IND)}}/>
            <span style={{fontSize:11,fontWeight:700,letterSpacing:'0.25em',textTransform:'uppercase',color:ACC}}>AI Cost WHY Engine</span>
          </motion.div>

          {/* headline */}
          <motion.h1 initial={{opacity:0,y:30}} animate={{opacity:1,y:0}} transition={{delay:0.3,duration:0.8}}
            style={{fontSize:'clamp(36px,7vw,80px)',fontWeight:900,lineHeight:1.08,letterSpacing:'-0.04em',color:ACC,margin:'0 0 16px'}}>
            Beyond Visibility
          </motion.h1>
          <motion.div initial={{opacity:0,y:30}} animate={{opacity:1,y:0}} transition={{delay:0.5,duration:0.8}}
            style={{fontSize:'clamp(28px,5vw,60px)',fontWeight:900,letterSpacing:'-0.03em',margin:'0 0 24px',
              background:`linear-gradient(135deg,${IND},${VIO},#c4b5fd)`,WebkitBackgroundClip:'text',WebkitTextFillColor:'transparent'}}>
            Real Decisions
          </motion.div>
          <motion.p initial={{opacity:0}} animate={{opacity:1}} transition={{delay:0.9}}
            style={{fontSize:16,color:'rgba(255,255,255,0.5)',maxWidth:480,margin:'0 auto 40px',lineHeight:1.7}}>
            Detect AI cost anomalies, understand why they happened, and get ranked actions — automatically.
          </motion.p>

          {/* CTA */}
          <motion.a href="/analyze" initial={{opacity:0,y:16}} animate={{opacity:1,y:0}} transition={{delay:1.1}}
            onMouseEnter={()=>setCurBig(true)} onMouseLeave={()=>setCurBig(false)}
            whileHover={{scale:1.06,boxShadow:glow(IND,30)}} whileTap={{scale:0.96}}
            style={{display:'inline-flex',alignItems:'center',gap:8,padding:'14px 36px',borderRadius:100,background:GRAD,
              color:'#fff',fontWeight:700,fontSize:15,letterSpacing:'0.06em',textDecoration:'none',
              boxShadow:glow(IND,16),willChange:'transform'}}>
            Start Monitoring
            <motion.span animate={rm?{}:{x:[0,4,0]}} transition={{duration:1.5,repeat:Infinity}}>→</motion.span>
          </motion.a>

          {/* stat cards */}
          <div style={{display:'flex',gap:16,justifyContent:'center',marginTop:52,flexWrap:'wrap'}}>
            {STATS.map(({label,sub},i)=>(
              <motion.div key={i} ref={reps[i].ref} style={{...reps[i].style,willChange:'transform'}}
                animate={rm?{}:{y:[0,-14,0]}} transition={{duration:3+i*0.7,repeat:Infinity,ease:'easeInOut',delay:i*0.6}}>
                <GCard style={{padding:'18px 26px',textAlign:'center',minWidth:120}} hover={false}>
                  <div style={{fontSize:22,fontWeight:800,color:ACC}}>{label}</div>
                  <div style={{fontSize:10,color:'rgba(255,255,255,0.4)',letterSpacing:'0.18em',textTransform:'uppercase',marginTop:5}}>{sub}</div>
                </GCard>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* scroll hint */}
        <motion.div style={{position:'absolute',bottom:32,left:'50%',transform:'translateX(-50%)'}}
          animate={rm?{}:{y:[0,8,0],opacity:[0.4,0.8,0.4]}} transition={{duration:2,repeat:Infinity}}>
          <div style={{width:1,height:40,background:`linear-gradient(${IND},transparent)`,margin:'0 auto'}}/>
        </motion.div>
      </motion.section>

      {/* ═══ SECTION 2 — ORBIT ═══ */}
      <section ref={orbitRef} style={{height:640,display:'flex',alignItems:'center',justifyContent:'center',position:'relative',overflow:'hidden'}}>

        {/* wave rings */}
        {rings.map(i=>(
          <motion.div key={i} style={{position:'absolute',borderRadius:'50%',border:`1px solid rgba(99,102,241,0.3)`,pointerEvents:'none'}}
            animate={rm?{}:{scale:[0.2,3],opacity:[0.5,0]}}
            transition={{duration:4,delay:i*1,repeat:Infinity,ease:'easeOut'}}
            initial={{width:120,height:120}}/>
        ))}

        {/* orbit paths */}
        {[240,400,560].map((d,i)=>(
          <div key={i} style={{position:'absolute',width:d,height:d,borderRadius:'50%',border:`1px dashed rgba(255,255,255,0.07)`}}/>
        ))}

        {/* center orb */}
        <motion.div animate={rm?{}:{scale:[1,1.08,1],boxShadow:[glow(IND,20),glow(IND,40),glow(IND,20)]}}
          transition={{duration:3,repeat:Infinity,ease:'easeInOut'}}
          style={{width:110,height:110,borderRadius:'50%',background:`radial-gradient(circle,${IND} 0%,${VIO} 60%,transparent 100%)`,
            display:'flex',alignItems:'center',justifyContent:'center',zIndex:2,position:'relative',cursor:'default'}}>
          <div style={{textAlign:'center'}}>
            <div style={{fontSize:9,fontWeight:800,letterSpacing:'0.2em',color:'#fff',textTransform:'uppercase'}}>WHY</div>
            <div style={{fontSize:9,fontWeight:800,letterSpacing:'0.2em',color:'#fff',textTransform:'uppercase'}}>CORE</div>
          </div>
        </motion.div>

        {/* satellites */}
        <OrbitNode radius={120} dur={8}  dir={1}  label="Detect"   rm={rm}/>
        <OrbitNode radius={200} dur={14} dir={-1} label="Explain"  rm={rm}/>
        <OrbitNode radius={280} dur={20} dir={1}  label="Optimize" rm={rm}/>
      </section>

      {/* ═══ SECTION 3 — FEATURE CARDS ═══ */}
      <section ref={featRef} style={{maxWidth:1100,margin:'0 auto',padding:'80px 24px'}}>
        <motion.div initial={{opacity:0,y:30}} animate={featInView?{opacity:1,y:0}:{}} transition={{duration:0.7}}
          style={{textAlign:'center',marginBottom:48}}>
          <p style={{fontSize:10,fontWeight:700,letterSpacing:'0.3em',textTransform:'uppercase',color:'rgba(255,255,255,0.3)',marginBottom:12}}>Capabilities</p>
          <h2 style={{fontSize:36,fontWeight:800,color:ACC,letterSpacing:'-0.03em',margin:0}}>Every angle of your AI spend</h2>
        </motion.div>
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(300px,1fr))',gap:16}}>
          {FEATURES.map(({icon,title,desc},i)=>(
            <motion.div key={i} initial={{opacity:0,y:48,rotateX:16}} animate={featInView?{opacity:1,y:0,rotateX:0}:{}}
              transition={{delay:i*0.09,duration:0.65,type:'spring',stiffness:120,damping:18}}>
              <GCard style={{padding:'28px 24px'}} onMouseEnter={()=>setCurBig(true)} onMouseLeave={()=>setCurBig(false)}>
                <motion.div animate={rm?{}:{y:[0,-6,0]}} transition={{duration:2+i*0.3,repeat:Infinity,ease:'easeInOut'}}
                  style={{width:46,height:46,borderRadius:14,background:GRAD,display:'flex',alignItems:'center',justifyContent:'center',fontSize:22,marginBottom:16,boxShadow:glow(IND,10)}}>
                  {icon}
                </motion.div>
                <h3 style={{fontSize:15,fontWeight:700,color:ACC,margin:'0 0 8px'}}>{title}</h3>
                <p style={{fontSize:13,color:'rgba(255,255,255,0.45)',margin:0,lineHeight:1.7}}>{desc}</p>
              </GCard>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ═══ SECTION 4 — MAGNETIC BUTTONS ═══ */}
      <section style={{padding:'60px 24px',display:'flex',justifyContent:'center',gap:24,flexWrap:'wrap'}}>
        {BTNS.map(({label,href,bg,color,border},i)=>(
          <motion.a key={i} href={href} ref={mbs[i].ref} style={{...mbs[i].style,willChange:'transform',textDecoration:'none',display:'block'}}
            onMouseMove={mbs[i].onMouseMove} onMouseLeave={mbs[i].onMouseLeave}
            onMouseEnter={()=>setCurBig(true)}>
            <motion.div whileHover={{scale:1.08,boxShadow:glow(IND,24)}} whileTap={{scale:0.94}}
              style={{width:180,height:60,borderRadius:100,background:bg,border:border||'none',
                display:'flex',alignItems:'center',justifyContent:'center',
                fontSize:13,fontWeight:700,letterSpacing:'0.08em',color,cursor:'pointer'}}>
              <motion.span whileHover={{y:-3}} transition={{type:'spring',stiffness:300,damping:20}}>{label}</motion.span>
            </motion.div>
          </motion.a>
        ))}
      </section>

      {/* ═══ SECTION 5 — METRICS ═══ */}
      <section ref={metricRef} style={{maxWidth:960,margin:'0 auto',padding:'80px 24px'}}>
        <motion.p initial={{opacity:0}} animate={metricInView?{opacity:1}:{}} transition={{duration:0.7}}
          style={{textAlign:'center',fontSize:10,fontWeight:700,letterSpacing:'0.3em',textTransform:'uppercase',color:'rgba(255,255,255,0.3)',marginBottom:48}}>
          Live Metrics
        </motion.p>
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(240px,1fr))',gap:20}}>
          {METRICS.map(({to,label,unit},i)=>(
            <motion.div key={i} animate={rm?{}:{y:[0,-18,0],rotate:[-0.5,0.5,-0.5]}}
              transition={{duration:5+i*1.2,repeat:Infinity,ease:'easeInOut',delay:i*0.8}}>
              <GCard style={{padding:'36px 28px'}}>
                <Counter to={to} label={label} unit={unit} inView={metricInView}/>
              </GCard>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ═══ SECTION 6 — FOOTER ═══ */}
      <footer ref={footRef} style={{position:'relative',borderTop:`1px solid ${BOR}`,padding:'80px 24px 48px',textAlign:'center',overflow:'hidden'}}>
        {/* mini particles */}
        {!rm&&Array.from({length:20},(_,i)=>(
          <motion.div key={i} style={{position:'absolute',width:3,height:3,borderRadius:'50%',background:'rgba(99,102,241,0.4)',
            left:`${Math.random()*100}%`,bottom:`${Math.random()*60}%`,pointerEvents:'none'}}
            animate={{y:[0,-400],opacity:[0,0.6,0]}}
            transition={{duration:10+Math.random()*10,delay:Math.random()*10,repeat:Infinity,ease:'linear'}}/>
        ))}
        <motion.div initial={{opacity:0,y:20}} whileInView={{opacity:1,y:0}} viewport={{once:true}} transition={{duration:0.8}}>
          <div style={{fontSize:32,fontWeight:900,letterSpacing:'-0.03em',background:`linear-gradient(135deg,${IND},${VIO},#c4b5fd)`,
            WebkitBackgroundClip:'text',WebkitTextFillColor:'transparent',marginBottom:8}}>
            AI Cost Autopilot
          </div>
          <p style={{fontSize:13,color:'rgba(255,255,255,0.3)',marginBottom:32}}>Know the WHY. Cut the waste. Act on evidence.</p>
          <div style={{display:'flex',gap:24,justifyContent:'center',flexWrap:'wrap',marginBottom:40}}>
            {[['Home','/'],['Analyze','/analyze'],['Dashboard','/dashboard'],['Connect','/connect'],['Pricing','/pricing']].map(([l,h])=>(
              <motion.a key={l} href={h} whileHover={{color:ACC,y:-2}} style={{fontSize:12,color:'rgba(255,255,255,0.35)',textDecoration:'none',fontWeight:600,letterSpacing:'0.1em',textTransform:'uppercase',display:'block'}}>
                {l}
              </motion.a>
            ))}
          </div>
          <p style={{fontSize:11,color:'rgba(255,255,255,0.18)',letterSpacing:'0.08em'}}>© 2026 WHY ENGINE · AI COST INTELLIGENCE</p>
        </motion.div>
      </footer>
    </div>
  );
}
