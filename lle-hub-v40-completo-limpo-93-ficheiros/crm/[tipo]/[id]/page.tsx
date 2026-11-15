"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { getCRMPageData } from "../../../crm-actions";

// Ligações antigas do CRM redirecionam para a única ficha no módulo original.
export default function CRMLegacyRedirect() {
  const params = useParams();
  const router = useRouter();
  const tipo = String(params.tipo || "");
  const id = Number(params.id);
  useEffect(() => {
    let cancelled = false;
    const go = async () => {
      const base=tipo === "evento" ? "agenda" : tipo === "lead" ? "leads" : tipo === "cliente" ? "clientes" : "";
      if (!base || !Number.isSafeInteger(id) || id <= 0) {router.replace("/agenda");return;}
      let month = "";
      try {
        const u=JSON.parse(localStorage.getItem("lle_user")||"null");
        if(!u?.name) { router.replace("/"); return; }
        const detail=await getCRMPageData(tipo,id,u.name);
        if(!detail.success){router.replace(`/${base}`);return;}
        const date=String(detail.data?.resumo?.data || "");
        if(/^\d{4}-\d{2}/.test(date))month=`&mes=${date.slice(0,7)}`;
      } catch { /* a ficha continua acessível no mês atual */ }
      if(!cancelled)router.replace(`/${base}?ficha=${id}&aba=crm${month}`);
    };
    void go();
    return ()=>{cancelled=true;};
  },[tipo,id,router]);
  return <div className="crm-loading">A abrir ficha…</div>;
}
