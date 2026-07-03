import { createClient } from "@libsql/client";
import { NextResponse } from "next/server";

const turso = createClient({
  url: process.env.TURSO_DATABASE_URL!,
  authToken: process.env.TURSO_AUTH_TOKEN!,
});

export async function GET() {
  try {
    await turso.batch([
  "DROP TABLE IF EXISTS agenda",
  "CREATE TABLE agenda (" +
    "id INTEGER PRIMARY KEY AUTOINCREMENT, " +
    "event_name TEXT NOT NULL, " +
    "event_date DATE NOT NULL, " +
    "start_time TEXT, " +
    "end_time TEXT, " +
    "location TEXT, " +
    "venue TEXT, " +
    "staff_needed TEXT, " +
    "client_cachet REAL DEFAULT 0, " + // Valor que o cliente paga
    "staff_costs REAL DEFAULT 0, " +   // O que a LLE paga (a ti ou a outros)
    "status TEXT CHECK(status IN ('Pendente', 'Confirmado', 'Adjudicado', 'Faturado', 'Pago')) DEFAULT 'Pendente', " +
    "visibility TEXT DEFAULT 'Public', " + // 'Public', 'João', 'Tânia'
    "is_company_profit BOOLEAN DEFAULT 1, " + // 1 para casamentos LLE, 0 para os teus sets no SUD
    "notes TEXT" +
  ")"
], "write");

    return NextResponse.json({ message: "✅ Base de Dados atualizada com sucesso!" });
  } catch (error) {
    return NextResponse.json({ error: String(error) });
  }
}