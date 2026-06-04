import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "LensArthropoda — Smart Insect Identifier",
  description: "Identifikasi spesies serangga otomatis dengan Machine Learning + Gemini AI Insights.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </head>
      <body>
        {/* Ambient blobs */}
        <div aria-hidden style={{position:"fixed",inset:0,pointerEvents:"none",zIndex:0,overflow:"hidden"}}>
          <div style={{position:"absolute",top:"-100px",left:"-60px",width:"400px",height:"400px",borderRadius:"50%",background:"radial-gradient(circle,rgba(34,197,94,0.07),transparent 70%)"}}/>
          <div style={{position:"absolute",bottom:"-60px",right:"-40px",width:"320px",height:"320px",borderRadius:"50%",background:"radial-gradient(circle,rgba(251,191,36,0.05),transparent 70%)"}}/>
        </div>
        <div style={{position:"relative",zIndex:1}}>{children}</div>
      </body>
    </html>
  );
}
