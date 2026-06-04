"use client";

import React, { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { TrendingUp, AlertTriangle, Zap, BookOpen, MapPin, Microscope, Star, ChevronDown, ChevronUp } from "lucide-react";

export interface TopPrediction { class_name: string; confidence: number; }

export interface PredictionResult {
  predicted_class: string;
  confidence: number;
  top_predictions: TopPrediction[];
  ai_insights: string | null;
  ai_available: boolean;
  message: string | null;
}

function fmt(raw: string) {
  return raw.split(/[_\-\s]+/).map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(" ");
}

function confColor(v: number) {
  if (v >= 80) return "var(--green)";
  if (v >= 50) return "var(--amber)";
  return "var(--red)";
}

function ConfBadge({ value }: { value: number }) {
  const c = confColor(value);
  return (
    <span style={{display:"inline-flex",alignItems:"center",gap:4,padding:"2px 10px",borderRadius:999,fontSize:11,fontFamily:"'JetBrains Mono',monospace",fontWeight:600,color:c,background:`${c}1a`,border:`1px solid ${c}33`}}>
      <TrendingUp size={9}/>{value.toFixed(1)}%
    </span>
  );
}

function TopKChart({ preds }: { preds: TopPrediction[] }) {
  return (
    <div style={{display:"flex",flexDirection:"column",gap:10}}>
      {preds.map((p, i) => (
        <div key={p.class_name}>
          <div style={{display:"flex",justifyContent:"space-between",marginBottom:5}}>
            <div style={{display:"flex",alignItems:"center",gap:7}}>
              {i === 0 && (
                <span style={{fontSize:9,fontFamily:"monospace",padding:"1px 6px",borderRadius:4,background:"var(--green-dim)",color:"var(--green)",fontWeight:600}}>TOP</span>
              )}
              <span style={{fontSize:13,color: i===0 ? "var(--text1)" : "var(--text2)",fontWeight: i===0 ? 500 : 400}}>
                {fmt(p.class_name)}
              </span>
            </div>
            <span style={{fontSize:12,fontFamily:"monospace",color:confColor(p.confidence)}}>{p.confidence.toFixed(1)}%</span>
          </div>
          <div className="conf-track">
            <div className="conf-fill" style={{width:`${p.confidence}%`,background:`linear-gradient(90deg,${confColor(p.confidence)},${confColor(p.confidence)}88)`}}/>
          </div>
        </div>
      ))}
    </div>
  );
}

function Skeleton() {
  return (
    <div style={{display:"flex",flexDirection:"column",gap:9,marginTop:8}}>
      {[100,72,88,55,78].map((w,i)=>(
        <div key={i} className="shimmer" style={{height:11,width:`${w}%`,animationDelay:`${i*.12}s`}}/>
      ))}
    </div>
  );
}

/* ── Parsed section tabs ── */
function parseSections(md: string) {
  const sections: {title:string; icon:React.ReactNode; content:string}[] = [];
  const lines = md.split("\n");
  let current: {title:string; icon:React.ReactNode; content:string}|null = null;

  const iconFor = (title: string) => {
    const t = title.toLowerCase();
    if (t.includes("ilmiah") || t.includes("taksonomi") || t.includes("klasifi")) return <Microscope size={13}/>;
    if (t.includes("habitat") || t.includes("persebaran")) return <MapPin size={13}/>;
    if (t.includes("fun") || t.includes("fakta") || t.includes("fact")) return <Star size={13}/>;
    return <BookOpen size={13}/>;
  };

  for (const line of lines) {
    if (line.startsWith("## ")) {
      if (current) sections.push(current);
      const title = line.replace(/^##\s+/, "").replace(/🎉/g,"").trim();
      current = { title, icon: iconFor(title), content: "" };
    } else if (line.startsWith("# ")) {
      // skip h1 (usually just repeats the name)
    } else if (current) {
      current.content += line + "\n";
    }
  }
  if (current) sections.push(current);
  return sections.filter(s => s.content.trim().length > 0);
}

export default function ResultCard({ result }: { result: PredictionResult }) {
  const { predicted_class, confidence, top_predictions, ai_insights, ai_available, message } = result;
  const [activeTab, setActiveTab] = useState(0);
  const [expanded, setExpanded] = useState(false);

  const sections = ai_insights ? parseSections(ai_insights) : [];
  const hasTabbed = sections.length > 0;

  return (
    <div style={{display:"flex",flexDirection:"column",gap:14}} className="fade-in">

      {/* ── Prediction card ── */}
      <div className="glass" style={{padding:22,borderColor:"rgba(74,222,128,0.18)"}}>
        <div style={{display:"flex",alignItems:"center",gap:7,marginBottom:16}}>
          <div style={{padding:6,borderRadius:8,background:"var(--green-dim)",display:"flex"}}>
            <Microscope size={14} color="var(--green)"/>
          </div>
          <span style={{fontSize:10,fontFamily:"monospace",textTransform:"uppercase",letterSpacing:"0.13em",color:"var(--green)",fontWeight:600}}>Hasil Prediksi Utama</span>
        </div>

        <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:12,marginBottom:16}}>
          <div>
            <h2 style={{fontFamily:"'Playfair Display',Georgia,serif",fontSize:"1.9rem",fontWeight:700,color:"var(--text1)",lineHeight:1.15,marginBottom:8}}>
              {fmt(predicted_class)}
            </h2>
            <ConfBadge value={confidence}/>
          </div>
          {/* Circular confidence */}
          <div style={{flexShrink:0,position:"relative",width:64,height:64}}>
            <svg width="64" height="64" viewBox="0 0 64 64">
              <circle cx="32" cy="32" r="27" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="5"/>
              <circle cx="32" cy="32" r="27" fill="none"
                stroke={confColor(confidence)} strokeWidth="5"
                strokeDasharray={`${(confidence/100)*169.6} 169.6`}
                strokeLinecap="round"
                transform="rotate(-90 32 32)"
                style={{transition:"stroke-dasharray 1.2s cubic-bezier(.34,1.56,.64,1)"}}
              />
            </svg>
            <span style={{position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontFamily:"monospace",fontWeight:700,color:confColor(confidence)}}>
              {Math.round(confidence)}%
            </span>
          </div>
        </div>

        <div style={{borderTop:"1px solid var(--border)",paddingTop:14}}>
          <p style={{fontSize:10,color:"var(--text3)",marginBottom:10,display:"flex",alignItems:"center",gap:5}}>
            <span style={{color:"var(--green)"}}>▸</span> Kandidat lainnya
          </p>
          <TopKChart preds={top_predictions}/>
        </div>
      </div>

      {/* ── AI Insights card ── */}
      <div className="glass" style={{padding:22,overflow:"hidden"}}>
        {/* Header */}
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:16}}>
          <div style={{display:"flex",alignItems:"center",gap:7}}>
            <div style={{padding:6,borderRadius:8,background:"var(--amber-dim)",display:"flex"}}>
              <BookOpen size={14} color="var(--amber)"/>
            </div>
            <span style={{fontSize:10,fontFamily:"monospace",textTransform:"uppercase",letterSpacing:"0.13em",color:"var(--amber)",fontWeight:600}}>Informasi Spesies (AI Insights)</span>
          </div>
          {ai_available && (
            <span style={{fontSize:10,color:"var(--green)",display:"flex",alignItems:"center",gap:4,padding:"2px 8px",borderRadius:999,background:"var(--green-dim)",border:"1px solid rgba(74,222,128,0.2)"}}>
              <Zap size={9}/>Gemini
            </span>
          )}
        </div>

        {/* Fallback warning */}
        {!ai_available && message && (
          <div style={{display:"flex",alignItems:"flex-start",gap:9,padding:"10px 13px",borderRadius:10,background:"rgba(251,191,36,0.07)",border:"1px solid rgba(251,191,36,0.18)",marginBottom:14,fontSize:12,color:"var(--amber)"}}>
            <AlertTriangle size={13} style={{marginTop:1,flexShrink:0}}/>
            <span>{message}</span>
          </div>
        )}

        {/* Tabbed sections */}
        {hasTabbed ? (
          <>
            {/* Tab bar */}
            <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:16,paddingBottom:12,borderBottom:"1px solid var(--border)"}}>
              {sections.map((s, i) => (
                <button key={i} onClick={()=>setActiveTab(i)}
                  style={{display:"flex",alignItems:"center",gap:5,padding:"5px 11px",borderRadius:8,border:"1px solid",fontSize:11,fontWeight:500,cursor:"pointer",background:"transparent",transition:"all .18s",fontFamily:"inherit"}}
                  className={activeTab===i ? "tab-active" : "tab-inactive"}
                >
                  {s.icon}
                  {s.title.length > 22 ? s.title.slice(0,20)+"…" : s.title}
                </button>
              ))}
            </div>

            {/* Active tab content */}
            {sections[activeTab] && (
              <div key={activeTab} className="md slide-up" style={{position:"relative"}}>
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {sections[activeTab].content}
                </ReactMarkdown>
              </div>
            )}

            {/* Show raw toggle */}
            <button onClick={()=>setExpanded(v=>!v)}
              style={{display:"flex",alignItems:"center",gap:5,marginTop:14,fontSize:11,color:"var(--text3)",background:"none",border:"none",cursor:"pointer",fontFamily:"inherit",padding:"4px 0"}}>
              {expanded ? <ChevronUp size={12}/> : <ChevronDown size={12}/>}
              {expanded ? "Sembunyikan teks lengkap" : "Lihat teks lengkap"}
            </button>

            {expanded && (
              <div className="md fade-in" style={{marginTop:12,paddingTop:12,borderTop:"1px solid var(--border)",maxHeight:340,overflowY:"auto",paddingRight:4}}>
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{ai_insights!}</ReactMarkdown>
              </div>
            )}
          </>
        ) : ai_insights ? (
          <div className="md"><ReactMarkdown remarkPlugins={[remarkGfm]}>{ai_insights}</ReactMarkdown></div>
        ) : ai_available ? (
          <Skeleton/>
        ) : (
          <p style={{fontSize:13,color:"var(--text3)",fontStyle:"italic"}}>AI Insights tidak tersedia. Hasil identifikasi tetap dapat dilihat di atas.</p>
        )}
      </div>
    </div>
  );
}
