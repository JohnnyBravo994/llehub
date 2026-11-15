import { NextResponse } from "next/server";

// Desativado: a versao anterior eliminava a tabela agenda num pedido GET publico.
export async function GET() {
  return NextResponse.json({ error: "Operacao de setup desativada por seguranca." }, { status: 410 });
}
