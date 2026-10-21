"use client";
export default function Dialog({ titulo, onClose, children }: { titulo:string; onClose:()=>void; children:React.ReactNode }) {
  return (
    <div className="dlg-back" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="dlg" role="dialog" aria-label={titulo}><h2>{titulo}</h2>{children}</div>
    </div>
  );
}
