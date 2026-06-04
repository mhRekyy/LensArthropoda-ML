"use client";

import React, { useState, useCallback, useRef } from "react";
import { Upload, X, Loader2, Bug, Microscope, Cpu, Github, ImageIcon, AlertCircle, Sparkles, Info } from "lucide-react";
import ResultCard, { PredictionResult } from "@/components/ResultCard";

const API_BASE  = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
const MAX_BYTES = 10 * 1024 * 1024;
const ACCEPT    = ["image/jpeg","image/jpg","image/png","image/webp"];
type AppState   = "idle"|"uploading"|"analyzing"|"done"|"error";

function fmtBytes(b: number) {
  if (b < 1024) return `${b} B`;
  if (b < 1048576) return `${(b/1024).toFixed(1)} KB`;
  return `${(b/1048576).toFixed(1)} MB`;
}

/* ── Analyzing overlay ── */
function Analyzing({ state }: { state: AppState }) {
  return (
    <div style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:18,padding:"56px 20px",textAlign:"center"}}>
      <div style={{position:"relative",width:64,height:64}}>
        <div style={{position:"absolute",inset:0,borderRadius:"50%",background:"rgba(74,222,128,0.2)",animation:"pulseRing 1.5s ease-out infinite"}}/>
        <div style={{position:"absolute",inset:8,borderRadius:"50%",background:"var(--green-dim)",display:"flex",alignItems:"center",justifyContent:"center"}}>
          <Bug size={22} color="var(--green)"/>
        </div>
      </div>
      <Loader2 size={16} color="var(--green)" style={{animation:"spin 1s linear infinite"}}/>
      <div>
        <p style={{fontSize:13,color:"var(--text2)",marginBottom:4}}>
          {state==="uploading" ? "Mengunggah gambar…" : "Model ML sedang mengidentifikasi…"}
        </p>
        <p style={{fontSize:11,color:"var(--text3)"}}>Mohon tunggu sebentar</p>
      </div>
    </div>
  );
}

/* ── Drop zone ── */
function DropZone({ onFile, disabled }: { onFile:(f:File)=>void; disabled:boolean }) {
  const ref = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);

  const handle = useCallback((file?:File) => {
    if (!file) return;
    if (!ACCEPT.includes(file.type)) { alert("Format tidak didukung. Gunakan JPG, PNG, atau WebP."); return; }
    if (file.size > MAX_BYTES) { alert("Ukuran file maks. 10 MB."); return; }
    onFile(file);
  }, [onFile]);

  return (
    <div className={`dropzone ${drag?"dropzone-active":""}`}
      style={{padding:"44px 20px",textAlign:"center",opacity:disabled?.5:1,cursor:disabled?"not-allowed":"pointer",position:"relative",overflow:"hidden"}}
      onClick={()=>!disabled&&ref.current?.click()}
      onDragOver={e=>{e.preventDefault();if(!disabled)setDrag(true)}}
      onDragLeave={()=>setDrag(false)}
      onDrop={e=>{e.preventDefault();setDrag(false);if(!disabled)handle(e.dataTransfer.files[0])}}
    >
      {drag && <div style={{position:"absolute",left:0,right:0,height:2,background:"linear-gradient(90deg,transparent,var(--green),transparent)",animation:"scanLine 1.5s ease-in-out infinite"}}/>}
      <input ref={ref} type="file" accept={ACCEPT.join(",")} style={{display:"none"}} disabled={disabled} onChange={e=>handle(e.target.files?.[0])}/>
      <div style={{width:52,height:52,borderRadius:14,background:"var(--green-dim)",border:"1px solid rgba(74,222,128,0.2)",display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 14px"}}>
        <Upload size={22} color="var(--green)"/>
      </div>
      <p style={{fontSize:14,color:"var(--text1)",marginBottom:6,fontWeight:500}}>
        Seret gambar atau <span style={{color:"var(--green)"}}>klik untuk pilih</span>
      </p>
      <p style={{fontSize:12,color:"var(--text3)",marginBottom:14}}>JPG, PNG, WebP — Maks. 10 MB</p>
      <div style={{display:"flex",justifyContent:"center",gap:8,flexWrap:"wrap"}}>
        {["🦋 Kupu-kupu","🪲 Kumbang","🐝 Lebah","🦗 Jangkrik","🐛 Ulat"].map(t=>(
          <span key={t} style={{fontSize:11,color:"var(--text3)",padding:"3px 9px",borderRadius:6,background:"rgba(255,255,255,0.03)",border:"1px solid var(--border)"}}>
            {t}
          </span>
        ))}
      </div>
    </div>
  );
}

/* ── Main page ── */
export default function Home() {
  const [file,    setFile]    = useState<File|null>(null);
  const [preview, setPreview] = useState<string|null>(null);
  const [state,   setState]   = useState<AppState>("idle");
  const [result,  setResult]  = useState<PredictionResult|null>(null);
  const [err,     setErr]     = useState("");
  const [showInfo,setShowInfo]= useState(false);

  const isLoading = state==="uploading"||state==="analyzing";

  const handleFile = useCallback((f:File)=>{
    if (preview) URL.revokeObjectURL(preview);
    setFile(f); setPreview(URL.createObjectURL(f));
    setResult(null); setErr(""); setState("idle");
  },[preview]);

  const clear = ()=>{
    if(preview)URL.revokeObjectURL(preview);
    setFile(null);setPreview(null);setResult(null);setErr("");setState("idle");
  };

  const analyze = async()=>{
    if(!file)return;
    try{
      setState("uploading"); setResult(null); setErr("");
      const form=new FormData(); form.append("file",file);
      setState("analyzing");
      const res=await fetch(`${API_BASE}/predict`,{method:"POST",body:form});
      if(!res.ok){const e=await res.json().catch(()=>({}));throw new Error(e?.detail??`Error ${res.status}`);}
      setResult(await res.json()); setState("done");
    }catch(e:unknown){
      setErr(e instanceof Error?e.message:"Terjadi kesalahan."); setState("error");
    }
  };

  return (
    <main style={{minHeight:"100vh",display:"flex",flexDirection:"column"}}>

      {/* ── Header ── */}
      <header style={{position:"sticky",top:0,zIndex:50,borderBottom:"1px solid var(--border)",backdropFilter:"blur(24px)",WebkitBackdropFilter:"blur(24px)",background:"rgba(8,14,10,0.88)"}}>
        <div style={{maxWidth:1160,margin:"0 auto",padding:"12px 24px",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
          <div style={{display:"flex",alignItems:"center",gap:11}}>
            <div style={{width:36,height:36,borderRadius:10,background:"var(--green-dim)",border:"1px solid rgba(74,222,128,0.22)",display:"flex",alignItems:"center",justifyContent:"center"}}>
              <Microscope size={17} color="var(--green)"/>
            </div>
            <div>
              <h1 style={{fontFamily:"'Playfair Display',Georgia,serif",fontSize:"1.15rem",fontWeight:700,lineHeight:1,color:"var(--text1)"}}>
                Lens<span style={{color:"var(--green)"}}>Arthropoda</span>
              </h1>
              <p style={{fontSize:10,color:"var(--text3)",marginTop:2}}>Smart Insect Identifier & AI Insights</p>
            </div>
          </div>
          <div style={{display:"flex",alignItems:"center",gap:8}}>
            <div style={{display:"flex",alignItems:"center",gap:5,padding:"4px 11px",borderRadius:20,background:"var(--green-dim)",border:"1px solid rgba(74,222,128,0.18)",fontSize:10,color:"var(--green)",fontFamily:"monospace"}}>
              <Cpu size={10}/> EfficientNet-B3
            </div>
            <div style={{display:"flex",alignItems:"center",gap:5,padding:"4px 11px",borderRadius:20,background:"var(--amber-dim)",border:"1px solid rgba(251,191,36,0.18)",fontSize:10,color:"var(--amber)",fontFamily:"monospace"}}>
              <Sparkles size={10}/> Gemini 2.5
            </div>
            <a href="https://github.com" target="_blank" rel="noopener noreferrer"
              style={{color:"var(--text3)",display:"flex",padding:6,borderRadius:8,transition:"color .2s"}} title="GitHub">
              <Github size={16}/>
            </a>
          </div>
        </div>
      </header>

      {/* ── Hero ── */}
      <section style={{maxWidth:1160,margin:"0 auto",padding:"36px 24px 16px",textAlign:"center"}}>
        <p style={{fontFamily:"'Playfair Display',Georgia,serif",fontSize:"clamp(1.1rem,2.2vw,1.45rem)",fontStyle:"italic",color:"var(--text2)",marginBottom:6}}>
          "Setiap serangga menyimpan kisah evolusi jutaan tahun."
        </p>
        <p style={{fontSize:12,color:"var(--text3)"}}>
          Upload gambar serangga — biarkan AI mengungkap identitas &amp; cerita di baliknya.
        </p>
      </section>

      {/* ── Main grid ── */}
      <section style={{maxWidth:1160,margin:"0 auto",padding:"8px 24px 48px",width:"100%",flex:1}}>
        <div style={{display:"grid",gridTemplateColumns:"minmax(0,1fr) minmax(0,1.3fr)",gap:20,alignItems:"start"}}>

          {/* Left */}
          <div style={{display:"flex",flexDirection:"column",gap:12,position:"sticky",top:80}}>

            {/* Preview / drop */}
            {preview ? (
              <div className="glass" style={{overflow:"hidden"}}>
                <div style={{position:"relative",background:"#000",aspectRatio:"4/3",display:"flex",alignItems:"center",justifyContent:"center"}}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={preview} alt="Preview" style={{width:"100%",height:"100%",objectFit:"contain"}}/>
                  <button onClick={clear} disabled={isLoading}
                    style={{position:"absolute",top:10,right:10,width:28,height:28,borderRadius:"50%",background:"rgba(0,0,0,.75)",border:"none",color:"#fff",cursor:isLoading?"not-allowed":"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}>
                    <X size={13}/>
                  </button>
                </div>
                <div style={{padding:"9px 14px",borderTop:"1px solid var(--border)",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                  <div style={{display:"flex",alignItems:"center",gap:7}}>
                    <ImageIcon size={11} color="var(--text3)"/>
                    <span style={{fontSize:11,color:"var(--text2)",maxWidth:180,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{file?.name}</span>
                  </div>
                  <span style={{fontSize:10,fontFamily:"monospace",color:"var(--text3)"}}>{fmtBytes(file?.size??0)}</span>
                </div>
              </div>
            ) : (
              <DropZone onFile={handleFile} disabled={isLoading}/>
            )}

            {/* Analyze btn */}
            <button onClick={analyze} disabled={!file||isLoading}
              style={{width:"100%",padding:"13px",borderRadius:12,border:"none",fontFamily:"inherit",fontSize:14,fontWeight:500,cursor:file&&!isLoading?"pointer":"not-allowed",display:"flex",alignItems:"center",justifyContent:"center",gap:8,transition:"all .2s",
                background:file&&!isLoading?"linear-gradient(135deg,#15803d,#22c55e)":"var(--card)",
                color:file&&!isLoading?"#fff":"var(--text3)",
                boxShadow:file&&!isLoading?"var(--green-glow)":"none"}}>
              {isLoading
                ? <><Loader2 size={15} style={{animation:"spin 1s linear infinite"}}/>{state==="uploading"?"Mengunggah…":"Menganalisis…"}</>
                : <><Bug size={15}/>Analisis Serangga</>
              }
            </button>

            {/* Error */}
            {state==="error"&&err&&(
              <div className="fade-in" style={{padding:"11px 14px",borderRadius:10,background:"rgba(248,113,113,0.07)",border:"1px solid rgba(248,113,113,0.22)",color:"var(--red)",fontSize:12,display:"flex",alignItems:"flex-start",gap:8}}>
                <AlertCircle size={13} style={{marginTop:1,flexShrink:0}}/><span><strong>Error:</strong> {err}</span>
              </div>
            )}

            {/* Info toggle */}
            <button onClick={()=>setShowInfo(v=>!v)}
              style={{display:"flex",alignItems:"center",gap:6,padding:"8px 12px",borderRadius:10,background:"transparent",border:"1px solid var(--border)",color:"var(--text3)",fontSize:11,cursor:"pointer",fontFamily:"inherit",transition:"border-color .2s",textAlign:"left",width:"100%"}}>
              <Info size={12} color="var(--text3)"/>{showInfo?"Sembunyikan tips":"Tips untuk hasil terbaik"}
            </button>

            {showInfo && (
              <div className="glass fade-in" style={{padding:"14px 16px"}}>
                <p style={{fontSize:10,fontFamily:"monospace",color:"var(--amber)",marginBottom:9}}>// tips</p>
                <ul style={{listStyle:"none",display:"flex",flexDirection:"column",gap:7}}>
                  {["Foto fokus dengan pencahayaan cukup","Serangga terlihat jelas di tengah frame","Angle dari atas atau samping lebih optimal","Hindari background yang terlalu ramai","Gunakan foto asli, bukan screenshot"].map((t,i)=>(
                    <li key={i} style={{display:"flex",gap:7,fontSize:12,color:"var(--text2)"}}>
                      <span style={{color:"var(--green)",flexShrink:0}}>›</span>{t}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* Right */}
          <div>
            {isLoading && <Analyzing state={state}/>}
            {!isLoading && !result && state!=="error" && (
              <div className="glass" style={{minHeight:280,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:14,padding:"44px 20px",textAlign:"center"}}>
                <div style={{width:60,height:60,borderRadius:"50%",background:"rgba(255,255,255,0.03)",border:"1px solid var(--border)",display:"flex",alignItems:"center",justifyContent:"center"}}>
                  <Bug size={26} color="var(--text3)"/>
                </div>
                <div>
                  <p style={{fontSize:14,color:"var(--text2)",marginBottom:5,fontWeight:500}}>Hasil akan muncul di sini</p>
                  <p style={{fontSize:12,color:"var(--text3)"}}>Upload gambar &amp; tekan tombol analisis</p>
                </div>
              </div>
            )}
            {!isLoading && result && <ResultCard result={result}/>}
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer style={{borderTop:"1px solid var(--border)",padding:"16px 24px",textAlign:"center",fontSize:11,color:"var(--text3)"}}>
        <p>LensArthropoda &mdash; Final Project Machine Learning Lab &bull; <span style={{color:"var(--green)"}}>EfficientNet-B3</span>{" + "}<span style={{color:"var(--amber)"}}>Gemini 2.5 Flash Lite</span></p>
      </footer>
    </main>
  );
}
