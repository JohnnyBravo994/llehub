"use server";

import { createClient } from "@libsql/client";
import { ARTIST_TIPOS, SERVICOS_VENDIDOS, AUTO_BUDGET_PACK_SERVICES, isMaterialValueService, isMaterialEquipmentService, normalizeColaboradorSkill, normalizeColaboradorSkills, expandColaboradorSkill } from "./constants";

const turso = createClient({
  url: process.env.TURSO_DATABASE_URL!,
  authToken: process.env.TURSO_AUTH_TOKEN!,
});

const DEFAULT_FUNCOES_VALORES = [...ARTIST_TIPOS];


type ValorMasterSeed = {
  servico: string;
  duracao_formato: string;
  contexto: string;
  cliente_nome?: string;
  custo_interno: number;
  valor_parceiro: number;
  valor_sud?: number;
  valor_cliente_final: number;
  notas?: string;
};

const DEFAULT_VALORES_MASTER: ValorMasterSeed[] = [
  // Serviços gerais LLE
  { servico: "DJ s/ AV", duracao_formato: "até 4h", contexto: "Normal", custo_interno: 200, valor_parceiro: 400, valor_cliente_final: 500, notas: "Tabela LLE 2026 · Serviços gerais" },
  { servico: "DJ todo o dia", duracao_formato: "evento", contexto: "Normal", custo_interno: 425, valor_parceiro: 750, valor_cliente_final: 900, notas: "Tabela LLE 2026 · Serviços gerais" },
  { servico: "Karaoke s/ AV", duracao_formato: "até 2h", contexto: "Normal", custo_interno: 350, valor_parceiro: 550, valor_cliente_final: 650, notas: "Tabela LLE 2026 · Serviços gerais" },
  { servico: "Karaoke s/ AV", duracao_formato: "até 4h", contexto: "Normal", custo_interno: 400, valor_parceiro: 600, valor_cliente_final: 750, notas: "Tabela LLE 2026 · Serviços gerais" },
  { servico: "Som 1 PA", duracao_formato: "sistema", contexto: "Normal", custo_interno: 125, valor_parceiro: 150, valor_cliente_final: 250, notas: "Tabela LLE 2026 · Serviços gerais" },
  { servico: "Som 2 PAs", duracao_formato: "sistema", contexto: "Normal", custo_interno: 155, valor_parceiro: 200, valor_cliente_final: 300, notas: "Tabela LLE 2026 · Serviços gerais" },
  { servico: "AV base evento", duracao_formato: "mesa de som", contexto: "Normal", custo_interno: 0, valor_parceiro: 30, valor_cliente_final: 45, notas: "Tabela LLE 2026 · Custo interno por definir" },
  { servico: "AV Base", duracao_formato: "PA + luz base", contexto: "Normal", custo_interno: 175, valor_parceiro: 300, valor_cliente_final: 450, notas: "Tabela LLE 2026 · Serviços gerais" },
  { servico: "AV Premium", duracao_formato: "PA + luz premium", contexto: "Normal", custo_interno: 225, valor_parceiro: 300, valor_cliente_final: 450, notas: "Tabela LLE 2026 · Serviços gerais" },
  { servico: "Sax", duracao_formato: "1 momento", contexto: "Normal", custo_interno: 250, valor_parceiro: 375, valor_cliente_final: 450, notas: "Tabela LLE 2026 · Serviços gerais" },
  { servico: "Violinista", duracao_formato: "1 momento", contexto: "Normal", custo_interno: 300, valor_parceiro: 400, valor_cliente_final: 500, notas: "Tabela LLE 2026 · Serviços gerais" },
  { servico: "Acordionista", duracao_formato: "1 momento", contexto: "Normal", custo_interno: 300, valor_parceiro: 400, valor_cliente_final: 500, notas: "Tabela LLE 2026 · Serviços gerais" },
  { servico: "Cantor(a)", duracao_formato: "1h30 ou 5 entradas", contexto: "Normal", custo_interno: 350, valor_parceiro: 500, valor_cliente_final: 750, notas: "Tabela LLE 2026 · Serviços gerais" },
  { servico: "Bailarinos s/ receção", duracao_formato: "4 entradas", contexto: "Normal", custo_interno: 200, valor_parceiro: 350, valor_cliente_final: 500, notas: "Tabela LLE 2026 · Serviços gerais" },
  { servico: "Bailarinos c/ receção", duracao_formato: "4 entradas", contexto: "Normal", custo_interno: 250, valor_parceiro: 350, valor_cliente_final: 500, notas: "Tabela LLE 2026 · Serviços gerais" },
  { servico: "Asas Isis (2 bailarinos)", duracao_formato: "2 entradas", contexto: "Normal", custo_interno: 0, valor_parceiro: 0, valor_cliente_final: 400, notas: "Tabela LLE 2026 · Custos internos/parceiro por definir" },
  { servico: "Artista de Fogo", duracao_formato: "2 entradas", contexto: "Normal", custo_interno: 250, valor_parceiro: 0, valor_cliente_final: 400, notas: "Tabela LLE 2026 · Valor parceiro por definir" },
  { servico: "Artista de Malabares", duracao_formato: "2 entradas", contexto: "Normal", custo_interno: 0, valor_parceiro: 0, valor_cliente_final: 0, notas: "Tabela LLE 2026 · Valores por definir" },
  { servico: "Anão", duracao_formato: "1 entrada", contexto: "Normal", custo_interno: 0, valor_parceiro: 0, valor_cliente_final: 350, notas: "Tabela LLE 2026 · Custos internos/parceiro por definir" },
  { servico: "Show Bolas de Sabão", duracao_formato: "1 entrada", contexto: "Normal", custo_interno: 0, valor_parceiro: 0, valor_cliente_final: 550, notas: "Tabela LLE 2026 · Custos internos/parceiro por definir" },
  { servico: "Mágico(a)", duracao_formato: "1 entrada", contexto: "Normal", custo_interno: 0, valor_parceiro: 0, valor_cliente_final: 0, notas: "Tabela LLE 2026 · Valores por definir" },
  { servico: "Cubo (a partir de 3m)", duracao_formato: "5 a 6 minutos", contexto: "Normal", custo_interno: 0, valor_parceiro: 0, valor_cliente_final: 500, notas: "Tabela LLE 2026 · Custos internos/parceiro por definir" },
  { servico: "Forças Combinadas - dueto", duracao_formato: "atuação", contexto: "Normal", custo_interno: 900, valor_parceiro: 0, valor_cliente_final: 1000, notas: "Tabela LLE 2026 · Valor parceiro por definir" },
  { servico: "Acro - dueto", duracao_formato: "atuação", contexto: "Normal", custo_interno: 900, valor_parceiro: 0, valor_cliente_final: 1000, notas: "Tabela LLE 2026 · Valor parceiro por definir" },
  { servico: "Acro Aéreos - solo", duracao_formato: "atuação", contexto: "Normal", custo_interno: 450, valor_parceiro: 0, valor_cliente_final: 550, notas: "Tabela LLE 2026 · Valor parceiro por definir" },
  { servico: "Lyra Aéreos - dueto", duracao_formato: "atuação", contexto: "Normal", custo_interno: 900, valor_parceiro: 0, valor_cliente_final: 1000, notas: "Tabela LLE 2026 · Valor parceiro por definir" },
  { servico: "Straps Aéreos - solo", duracao_formato: "atuação", contexto: "Normal", custo_interno: 450, valor_parceiro: 0, valor_cliente_final: 550, notas: "Tabela LLE 2026 · Valor parceiro por definir" },
  { servico: "Straps Aéreos - dueto", duracao_formato: "atuação", contexto: "Normal", custo_interno: 900, valor_parceiro: 0, valor_cliente_final: 1000, notas: "Tabela LLE 2026 · Valor parceiro por definir" },
  { servico: "Pórtico Aéreos", duracao_formato: "atuação", contexto: "Normal", custo_interno: 900, valor_parceiro: 0, valor_cliente_final: 1000, notas: "Tabela LLE 2026 · Valor parceiro por definir" },
  { servico: "Spiral - plataforma", duracao_formato: "atuação", contexto: "Normal", custo_interno: 600, valor_parceiro: 0, valor_cliente_final: 0, notas: "Tabela LLE 2026 · Custo interno: 600€ + rigagem. Preencher preço cliente." },
  { servico: "Lollipop - plataforma", duracao_formato: "atuação", contexto: "Normal", custo_interno: 450, valor_parceiro: 0, valor_cliente_final: 550, notas: "Tabela LLE 2026 · Valor parceiro por definir" },
  { servico: "Chandelier - plataforma", duracao_formato: "atuação", contexto: "Normal", custo_interno: 450, valor_parceiro: 0, valor_cliente_final: 550, notas: "Tabela LLE 2026 · Valor parceiro por definir" },
  { servico: "Diamante - plataforma", duracao_formato: "atuação", contexto: "Normal", custo_interno: 450, valor_parceiro: 0, valor_cliente_final: 550, notas: "Tabela LLE 2026 · Valor parceiro por definir" },
  { servico: "Animador / Host", duracao_formato: "evento", contexto: "Normal", custo_interno: 250, valor_parceiro: 350, valor_cliente_final: 450, notas: "Tabela LLE 2026 · Serviços gerais" },
  { servico: "Animador Infantil c/ jogos", duracao_formato: "2h30 (2pax)", contexto: "Normal", custo_interno: 170, valor_parceiro: 250, valor_cliente_final: 300, notas: "Tabela LLE 2026 · Serviços gerais" },
  { servico: "Animador Infantil c/ jogos", duracao_formato: "4h (2pax)", contexto: "Normal", custo_interno: 230, valor_parceiro: 350, valor_cliente_final: 400, notas: "Tabela LLE 2026 · Serviços gerais" },
  { servico: "Make-up & Hair", duracao_formato: "evento", contexto: "Normal", custo_interno: 250, valor_parceiro: 300, valor_cliente_final: 350, notas: "Tabela LLE 2026 · Serviços gerais" },
  { servico: "Guarda Roupa", duracao_formato: "evento", contexto: "Normal", custo_interno: 0, valor_parceiro: 25, valor_cliente_final: 50, notas: "Tabela LLE 2026 · Custo interno por definir" },
  { servico: "Produtor", duracao_formato: "evento", contexto: "Normal", custo_interno: 0, valor_parceiro: 0, valor_cliente_final: 0, notas: "Tabela LLE 2026 · Valores por definir" },
  { servico: "Trio Fado", duracao_formato: "1h", contexto: "Normal", custo_interno: 550, valor_parceiro: 900, valor_cliente_final: 1250, notas: "Tabela LLE 2026 · Serviços gerais" },
  { servico: "Trio Fado", duracao_formato: "1h30", contexto: "Normal", custo_interno: 850, valor_parceiro: 1200, valor_cliente_final: 1550, notas: "Tabela LLE 2026 · Serviços gerais" },

  // Residências fixas/regulares. Nesta tabela, valor_parceiro = Residência e valor_cliente_final = Evento Residência.
  { servico: "DJ", duracao_formato: "4h", contexto: "Residência", custo_interno: 100, valor_parceiro: 150, valor_cliente_final: 250, notas: "Tabela LLE 2026 · Residências. Coluna Parceiro = Residência; Cliente Final = Evento Residência" },
  { servico: "DJ", duracao_formato: "5h", contexto: "Residência", custo_interno: 100, valor_parceiro: 180, valor_cliente_final: 300, notas: "Tabela LLE 2026 · Residências. Coluna Parceiro = Residência; Cliente Final = Evento Residência" },
  { servico: "DJ todo o dia", duracao_formato: "evento", contexto: "Residência", custo_interno: 425, valor_parceiro: 0, valor_cliente_final: 750, notas: "Tabela LLE 2026 · Residências. Valor de residência por definir; Cliente Final = Evento Residência" },
  { servico: "Sax", duracao_formato: "1 momento", contexto: "Residência", custo_interno: 120, valor_parceiro: 150, valor_cliente_final: 375, notas: "Tabela LLE 2026 · Residências. Coluna Parceiro = Residência; Cliente Final = Evento Residência" },
  { servico: "Cantor(a)", duracao_formato: "1 momento", contexto: "Residência", custo_interno: 120, valor_parceiro: 150, valor_cliente_final: 350, notas: "Tabela LLE 2026 · Residências. Coluna Parceiro = Residência; Cliente Final = Evento Residência" },
  { servico: "Bailarinos s/ receção", duracao_formato: "4 entradas", contexto: "Residência", custo_interno: 150, valor_parceiro: 0, valor_cliente_final: 250, notas: "Tabela LLE 2026 · Residências. Valor de residência por definir; Cliente Final = Evento Residência" },
  { servico: "Bailarinos c/ receção", duracao_formato: "4 entradas", contexto: "Residência", custo_interno: 200, valor_parceiro: 0, valor_cliente_final: 250, notas: "Tabela LLE 2026 · Residências. Valor de residência por definir; Cliente Final = Evento Residência" },

  // Priceless Band / Annia. Valor parceiro = tabela parceiro; valor cliente final = preço 2026.
  { servico: "Annia Solo", duracao_formato: "até 1h30", contexto: "Priceless Band", custo_interno: 0, valor_parceiro: 575, valor_cliente_final: 800, notas: "Priceless Band 2026 · Parceiro + Preço 2026" },
  { servico: "Annia Solo", duracao_formato: "até 1h30", contexto: "SUD", cliente_nome: "SUD", custo_interno: 0, valor_parceiro: 0, valor_cliente_final: 500, notas: "Priceless Band 2026 · Valor SUD" },
  { servico: "Annia Solo c/ AVs", duracao_formato: "até 1h30", contexto: "Priceless Band", custo_interno: 0, valor_parceiro: 775, valor_cliente_final: 1000, notas: "Priceless Band 2026 · Parceiro + Preço 2026" },
  { servico: "Banda Duo s/ AV", duracao_formato: "até 1h30", contexto: "Priceless Band", custo_interno: 0, valor_parceiro: 850, valor_cliente_final: 1000, notas: "Priceless Band 2026 · Parceiro + Preço 2026" },
  { servico: "Banda Duo s/ AV", duracao_formato: "até 1h30", contexto: "SUD", cliente_nome: "SUD", custo_interno: 0, valor_parceiro: 0, valor_cliente_final: 700, notas: "Priceless Band 2026 · Valor SUD" },
  { servico: "Banda Duo c/ AVs", duracao_formato: "até 1h30", contexto: "Priceless Band", custo_interno: 0, valor_parceiro: 1150, valor_cliente_final: 1300, notas: "Priceless Band 2026 · Parceiro + Preço 2026" },
  { servico: "Banda Trio s/ AV", duracao_formato: "até 1h30", contexto: "Priceless Band", custo_interno: 0, valor_parceiro: 1200, valor_cliente_final: 1350, notas: "Priceless Band 2026 · Parceiro + Preço 2026" },
  { servico: "Banda Trio s/ AV", duracao_formato: "até 1h30", contexto: "SUD", cliente_nome: "SUD", custo_interno: 0, valor_parceiro: 0, valor_cliente_final: 1050, notas: "Priceless Band 2026 · Valor SUD" },
  { servico: "Banda Trio c/ AVs", duracao_formato: "até 1h30", contexto: "Priceless Band", custo_interno: 0, valor_parceiro: 1500, valor_cliente_final: 1650, notas: "Priceless Band 2026 · Parceiro + Preço 2026" },
  { servico: "Banda quarteto s/ AV", duracao_formato: "até 1h30", contexto: "Priceless Band", custo_interno: 0, valor_parceiro: 1550, valor_cliente_final: 1700, notas: "Priceless Band 2026 · Parceiro + Preço 2026" },
  { servico: "Banda quarteto s/ AV", duracao_formato: "até 1h30", contexto: "SUD", cliente_nome: "SUD", custo_interno: 0, valor_parceiro: 0, valor_cliente_final: 1300, notas: "Priceless Band 2026 · Valor SUD" },
  { servico: "Banda quarteto c/ AVs", duracao_formato: "até 1h30", contexto: "Priceless Band", custo_interno: 0, valor_parceiro: 1950, valor_cliente_final: 2100, notas: "Priceless Band 2026 · Parceiro + Preço 2026" },
  { servico: "Banda quinteto s/ AV", duracao_formato: "até 1h30", contexto: "Priceless Band", custo_interno: 0, valor_parceiro: 1875, valor_cliente_final: 2000, notas: "Priceless Band 2026 · Parceiro + Preço 2026" },
  { servico: "Banda quinteto s/ AV", duracao_formato: "até 1h30", contexto: "SUD", cliente_nome: "SUD", custo_interno: 0, valor_parceiro: 0, valor_cliente_final: 1500, notas: "Priceless Band 2026 · Valor SUD" },
  { servico: "Banda quinteto c/ AVs", duracao_formato: "até 1h30", contexto: "Priceless Band", custo_interno: 0, valor_parceiro: 2375, valor_cliente_final: 2500, notas: "Priceless Band 2026 · Parceiro + Preço 2026" },
  { servico: "Banda quinteto + Cantor", duracao_formato: "até 1h30", contexto: "Priceless Band", custo_interno: 0, valor_parceiro: 2200, valor_cliente_final: 2400, notas: "Priceless Band 2026 · Parceiro + Preço 2026" },
  { servico: "Banda quinteto + Cantor", duracao_formato: "até 1h30", contexto: "SUD", cliente_nome: "SUD", custo_interno: 0, valor_parceiro: 0, valor_cliente_final: 1800, notas: "Priceless Band 2026 · Valor SUD" },
  { servico: "Banda quinteto + Cantor c/ AVs", duracao_formato: "até 1h30", contexto: "Priceless Band", custo_interno: 0, valor_parceiro: 2700, valor_cliente_final: 2900, notas: "Priceless Band 2026 · Parceiro + Preço 2026" },
  { servico: "Banda quinteto + 2 Back Vocals", duracao_formato: "até 1h30", contexto: "Priceless Band", custo_interno: 0, valor_parceiro: 2500, valor_cliente_final: 2700, notas: "Priceless Band 2026 · Parceiro + Preço 2026" },
  { servico: "Banda quinteto + 2 Back Vocals", duracao_formato: "até 1h30", contexto: "SUD", cliente_nome: "SUD", custo_interno: 0, valor_parceiro: 0, valor_cliente_final: 2100, notas: "Priceless Band 2026 · Valor SUD" },
  { servico: "Banda quinteto + 2 BVs c/ AVs", duracao_formato: "até 1h30", contexto: "Priceless Band", custo_interno: 0, valor_parceiro: 3000, valor_cliente_final: 3200, notas: "Priceless Band 2026 · Parceiro + Preço 2026" },

  // Equipamento avulso. Custo equipamento fica em notas; custo interno operacional = 0 quando não indicado.
  { servico: "DJ Booth LED - branco", duracao_formato: "equipamento", contexto: "Equipamento avulso", custo_interno: 0, valor_parceiro: 60, valor_cliente_final: 90, notas: "Equipamento LLE · Custo equipamento: 300€" },
  { servico: "DJ Booth LED - preto", duracao_formato: "equipamento", contexto: "Equipamento avulso", custo_interno: 0, valor_parceiro: 60, valor_cliente_final: 80, notas: "Equipamento LLE · Custo equipamento: 300€" },
  { servico: "1 PA Mackie Thump 212 12\"", duracao_formato: "equipamento", contexto: "Equipamento avulso", custo_interno: 0, valor_parceiro: 160, valor_cliente_final: 240, notas: "Equipamento LLE · Custo equipamento: 800€" },
  { servico: "Mixer Behringer Xenyx 1202SFX", duracao_formato: "mesa de mistura", contexto: "Equipamento avulso", custo_interno: 0, valor_parceiro: 30, valor_cliente_final: 45, notas: "Equipamento LLE · Custo equipamento: 150€" },
  { servico: "Controller Pioneer Rekordbox DJ DDJ-400", duracao_formato: "controladora", contexto: "Equipamento avulso", custo_interno: 0, valor_parceiro: 60, valor_cliente_final: 90, notas: "Equipamento LLE · Custo equipamento: 300€" },
  { servico: "Stairville LED Bar 240/8 RGB DMX 30º", duracao_formato: "luz", contexto: "Equipamento avulso", custo_interno: 0, valor_parceiro: 15, valor_cliente_final: 25, notas: "Equipamento LLE · Custo equipamento: 70€" },
  { servico: "4 Baterias LEDs Uking RGBWA + UV Par Light", duracao_formato: "pack luz", contexto: "Equipamento avulso", custo_interno: 0, valor_parceiro: 240, valor_cliente_final: 360, notas: "Equipamento LLE · Custo equipamento: 1200€ · inclui referência a 2 luzes UV" },
  { servico: "8 LEDs Wash 7x12 RGBW", duracao_formato: "pack luz", contexto: "Equipamento avulso", custo_interno: 0, valor_parceiro: 60, valor_cliente_final: 90, notas: "Equipamento LLE · Custo equipamento: 300€" },
  { servico: "4 LEDs Uking 105W 7x15W RGBW", duracao_formato: "pack luz", contexto: "Equipamento avulso", custo_interno: 0, valor_parceiro: 57, valor_cliente_final: 85.5, notas: "Equipamento LLE · Custo equipamento: 285€" },
  { servico: "LED efeito flor Eurolite FE-700", duracao_formato: "luz", contexto: "Equipamento avulso", custo_interno: 0, valor_parceiro: 40, valor_cliente_final: 60, notas: "Equipamento LLE · Custo equipamento: 200€" },
  { servico: "Máquina de fumo Ibiza LSM900W", duracao_formato: "efeito", contexto: "Equipamento avulso", custo_interno: 0, valor_parceiro: 14, valor_cliente_final: 21, notas: "Equipamento LLE · Custo equipamento: 70€" },
  { servico: "Microfone c/ fio Sennheiser e835", duracao_formato: "microfone", contexto: "Equipamento avulso", custo_interno: 0, valor_parceiro: 16, valor_cliente_final: 24, notas: "Equipamento LLE · Custo equipamento: 80€" },
  { servico: "2 Microfones dual UHF s/ fios GLXD2", duracao_formato: "microfones", contexto: "Equipamento avulso", custo_interno: 0, valor_parceiro: 10, valor_cliente_final: 15, notas: "Equipamento LLE · Custo equipamento: 30€" },
  { servico: "1 Shure SM58 s/ fios", duracao_formato: "microfone", contexto: "Equipamento avulso", custo_interno: 0, valor_parceiro: 100, valor_cliente_final: 150, notas: "Equipamento LLE · Custo equipamento: 500€" },
  { servico: "Cablagem completa XLR", duracao_formato: "3m, 6m, 10m, 20m", contexto: "Equipamento avulso", custo_interno: 0, valor_parceiro: 25, valor_cliente_final: 25, notas: "Equipamento LLE · Custo equipamento inestimável · taxa fixa" },

  // Packs AV. Valores internos/equipamento não indicados; custo operacional/técnico fica nas notas.
  { servico: "Discurso", duracao_formato: "1 PA + mesa + 2 micros sem fio", contexto: "Pack AV", custo_interno: 0, valor_parceiro: 450, valor_cliente_final: 500, notas: "Inclui 1 PA Mackie Thump 212, Behringer Xenyx 1202SFX, 2 microfones sem fio e cablagem completa. Inclui técnico montagem/desmontagem; deslocação à parte." },
  { servico: "DJ Basic", duracao_formato: "1 PA + mesa + booth + DDJ-400 + 2 micros", contexto: "Pack AV", custo_interno: 0, valor_parceiro: 370, valor_cliente_final: 680, notas: "Inclui 1 PA Mackie Thump 212, Behringer Xenyx 1202SFX, DJ Booth LED B/P, DDJ-400, 2 microfones sem fio e cablagem completa. Inclui técnico montagem/desmontagem; deslocação à parte." },
  { servico: "Let's Party", duracao_formato: "PA + SUB + luz + fumo", contexto: "Pack AV", custo_interno: 0, valor_parceiro: 500, valor_cliente_final: 1000, notas: "Inclui 1 PA Mackie Thump 212, SUB a especificar, mesa, DJ Booth LED B/P, DDJ-400, 2 microfones sem fio, 4 Moving Heads, Eurolite FE-700, Stairville LED Bar, 4 pares LED bateria Uking RGBWA + UV, máquina de fumo e cablagem completa. Preço pode ajustar conforme SUB/Moving Heads. Fazer soma para desconto se necessário." },
  { servico: "Premium", duracao_formato: "2 PAs + 2 SUB + luz premium + fumo", contexto: "Pack AV", custo_interno: 0, valor_parceiro: 750, valor_cliente_final: 1500, notas: "Inclui 2 PAs Mackie Thump 212, 2 SUB a especificar, mesa, DJ Booth LED B/P, DDJ-400, 2 microfones sem fio, 12 Moving Heads, Eurolite FE-700, Stairville LED Bar, máquina de fumo e cablagem completa. Preço pode ajustar conforme SUB/Moving Heads. Incluir técnico de luz além do técnico de som." },

  // Custos operacionais. Valores sob consulta ficam a 0 para não inventar preço.
  { servico: "Serviço sob consulta", duracao_formato: "operacional", contexto: "Operacional", custo_interno: 0, valor_parceiro: 0, valor_cliente_final: 0, notas: "Custos operacionais · sob consulta" },
  { servico: "Técnico de Som", duracao_formato: "serviço", contexto: "Operacional", custo_interno: 175, valor_parceiro: 0, valor_cliente_final: 0, notas: "Custo operacional interno" },
  { servico: "Técnico de Luz", duracao_formato: "serviço", contexto: "Operacional", custo_interno: 175, valor_parceiro: 0, valor_cliente_final: 0, notas: "Custo operacional interno" },
  { servico: "Deslocações", duracao_formato: "operacional", contexto: "Operacional", custo_interno: 0, valor_parceiro: 0, valor_cliente_final: 0, notas: "Custos operacionais · sob consulta" },
  { servico: "Aluguer de Carrinha", duracao_formato: "operacional", contexto: "Operacional", custo_interno: 0, valor_parceiro: 0, valor_cliente_final: 0, notas: "Custos operacionais · sob consulta" },

];

async function ensureColaboradoresExtendedColumns() {
  try { await turso.execute("ALTER TABLE colaboradores ADD COLUMN nome_artistico TEXT DEFAULT ''"); } catch { }
  try { await turso.execute("ALTER TABLE colaboradores ADD COLUMN nome_pessoal TEXT DEFAULT ''"); } catch { }
  try { await turso.execute("ALTER TABLE colaboradores ADD COLUMN restricoes_alimentares TEXT DEFAULT ''"); } catch { }
  try { await turso.execute("ALTER TABLE colaboradores ADD COLUMN tamanho_cima TEXT DEFAULT ''"); } catch { }
  try { await turso.execute("ALTER TABLE colaboradores ADD COLUMN tamanho_baixo TEXT DEFAULT ''"); } catch { }
  try { await turso.execute("ALTER TABLE colaboradores ADD COLUMN calcado TEXT DEFAULT ''"); } catch { }
  try {
    await turso.execute("UPDATE colaboradores SET nome_artistico = nome WHERE COALESCE(nome_artistico, '') = ''");
  } catch { }
  await turso.execute(`
    CREATE TABLE IF NOT EXISTS colaborador_skill_profiles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      colaborador_id INTEGER NOT NULL,
      skill TEXT NOT NULL,
      valor REAL NOT NULL DEFAULT 0,
      custo_interno REAL NOT NULL DEFAULT 0,
      custo_evento REAL NOT NULL DEFAULT 0,
      custo_residencia REAL NOT NULL DEFAULT 0,
      valor_sud REAL NOT NULL DEFAULT 0,
      valor_residencia REAL NOT NULL DEFAULT 0,
      valor_evento_residencia REAL NOT NULL DEFAULT 0,
      valor_parceria REAL NOT NULL DEFAULT 0,
      valor_cliente_final REAL NOT NULL DEFAULT 0,
      custo_sud REAL NOT NULL DEFAULT 0,
      custo_evento_residencia REAL NOT NULL DEFAULT 0,
      custo_parceria REAL NOT NULL DEFAULT 0,
      custo_cliente_final REAL NOT NULL DEFAULT 0,
      rating INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT DEFAULT (datetime('now')),
      UNIQUE(colaborador_id, skill)
    )
  `);
  const cols = [
    "custo_interno REAL NOT NULL DEFAULT 0",
    "custo_evento REAL NOT NULL DEFAULT 0",
    "custo_residencia REAL NOT NULL DEFAULT 0",
    "valor_sud REAL NOT NULL DEFAULT 0",
    "valor_residencia REAL NOT NULL DEFAULT 0",
    "valor_evento_residencia REAL NOT NULL DEFAULT 0",
    "valor_parceria REAL NOT NULL DEFAULT 0",
    "valor_cliente_final REAL NOT NULL DEFAULT 0",
    // Legado mantido para compatibilidade com versões anteriores.
    "custo_sud REAL NOT NULL DEFAULT 0",
    "custo_evento_residencia REAL NOT NULL DEFAULT 0",
    "custo_parceria REAL NOT NULL DEFAULT 0",
    "custo_cliente_final REAL NOT NULL DEFAULT 0",
  ];
  for (const col of cols) {
    try { await turso.execute(`ALTER TABLE colaborador_skill_profiles ADD COLUMN ${col}`); } catch { }
  }
  // Migração sem perda. A partir da v16, custos do artista e faturação são conceitos separados.
  try { await turso.execute("UPDATE colaborador_skill_profiles SET custo_interno=valor WHERE COALESCE(custo_interno,0)=0 AND COALESCE(valor,0)>0"); } catch { }
  try { await turso.execute("UPDATE colaborador_skill_profiles SET custo_evento=custo_interno WHERE COALESCE(custo_evento,0)=0 AND COALESCE(custo_interno,0)>0"); } catch { }
  try { await turso.execute("UPDATE colaborador_skill_profiles SET valor_sud=custo_sud WHERE COALESCE(valor_sud,0)=0 AND COALESCE(custo_sud,0)>0"); } catch { }
  try { await turso.execute("UPDATE colaborador_skill_profiles SET valor_evento_residencia=custo_evento_residencia WHERE COALESCE(valor_evento_residencia,0)=0 AND COALESCE(custo_evento_residencia,0)>0"); } catch { }
  try { await turso.execute("UPDATE colaborador_skill_profiles SET valor_parceria=custo_parceria WHERE COALESCE(valor_parceria,0)=0 AND COALESCE(custo_parceria,0)>0"); } catch { }
  try { await turso.execute("UPDATE colaborador_skill_profiles SET valor_cliente_final=custo_cliente_final WHERE COALESCE(valor_cliente_final,0)=0 AND COALESCE(custo_cliente_final,0)>0"); } catch { }
}


async function normalizeExistingColaboradorSkills() {
  try {
    const [cols, profiles] = await Promise.all([
      turso.execute("SELECT id, skills FROM colaboradores"),
      turso.execute(`SELECT colaborador_id, skill, valor, custo_interno, custo_evento,
                            valor_sud, valor_evento_residencia, valor_parceria, valor_cliente_final,
                            custo_sud, custo_evento_residencia, custo_parceria, custo_cliente_final, rating
                     FROM colaborador_skill_profiles`),
    ]);

    for (const row of cols.rows as any[]) {
      const raw = String(row.skills || '');
      const canonical = normalizeColaboradorSkills(raw.split(',').map((s: string) => s.trim()).filter(Boolean));
      const next = canonical.join(', ');
      if (next !== raw) {
        await turso.execute({ sql: "UPDATE colaboradores SET skills=? WHERE id=?", args: [next, Number(row.id)] });
      }
    }

    // Agrupa variantes da mesma skill por colaborador. Ao colidir, preservamos o
    // maior valor/rating preenchido para não perder informação histórica.
    const grouped = new Map<string, any[]>();
    for (const row of profiles.rows as any[]) {
      const canonicals = expandColaboradorSkill(String(row.skill || ''));
      for (const canonical of canonicals) {
        if (!canonical) continue;
        const key = `${Number(row.colaborador_id)}::${canonical}`;
        if (!grouped.has(key)) grouped.set(key, []);
        grouped.get(key)!.push({ ...row, canonical, original_skill: String(row.skill || '') });
      }
    }

    const fields = [
      'valor','custo_interno','custo_evento','valor_sud','valor_evento_residencia',
      'valor_parceria','valor_cliente_final','custo_sud','custo_evento_residencia',
      'custo_parceria','custo_cliente_final','rating'
    ];
    for (const rows of grouped.values()) {
      const colaboradorId = Number(rows[0].colaborador_id);
      const canonical = String(rows[0].canonical);
      const merged: Record<string, number> = {};
      for (const field of fields) merged[field] = Math.max(0, ...rows.map(r => Number(r[field] || 0)));
      await turso.execute({
        sql: `INSERT INTO colaborador_skill_profiles
              (colaborador_id, skill, valor, custo_interno, custo_evento,
               valor_sud, valor_evento_residencia, valor_parceria, valor_cliente_final,
               custo_sud, custo_evento_residencia, custo_parceria, custo_cliente_final, rating, updated_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
              ON CONFLICT(colaborador_id, skill) DO UPDATE SET
                valor=MAX(valor, excluded.valor),
                custo_interno=MAX(custo_interno, excluded.custo_interno),
                custo_evento=MAX(custo_evento, excluded.custo_evento),
                valor_sud=MAX(valor_sud, excluded.valor_sud),
                valor_evento_residencia=MAX(valor_evento_residencia, excluded.valor_evento_residencia),
                valor_parceria=MAX(valor_parceria, excluded.valor_parceria),
                valor_cliente_final=MAX(valor_cliente_final, excluded.valor_cliente_final),
                custo_sud=MAX(custo_sud, excluded.custo_sud),
                custo_evento_residencia=MAX(custo_evento_residencia, excluded.custo_evento_residencia),
                custo_parceria=MAX(custo_parceria, excluded.custo_parceria),
                custo_cliente_final=MAX(custo_cliente_final, excluded.custo_cliente_final),
                rating=MAX(rating, excluded.rating), updated_at=datetime('now')`,
        args: [
          colaboradorId, canonical, merged.valor, merged.custo_interno, merged.custo_evento,
          merged.valor_sud, merged.valor_evento_residencia, merged.valor_parceria, merged.valor_cliente_final,
          merged.custo_sud, merged.custo_evento_residencia, merged.custo_parceria, merged.custo_cliente_final, merged.rating,
        ],
      });
      const variants = Array.from(new Set(rows.map(r => String(r.original_skill ?? r.skill ?? '')).filter(s => s && s !== canonical)));
      for (const variant of variants) {
        await turso.execute({ sql: "DELETE FROM colaborador_skill_profiles WHERE colaborador_id=? AND skill=?", args: [colaboradorId, variant] });
      }
    }
  } catch (error) {
    console.error("Erro a normalizar skills de colaboradores:", error);
  }
}

async function ensureArtistasAssociacaoIgnoradosTable() {
  await turso.execute(`
    CREATE TABLE IF NOT EXISTS artistas_associacao_ignorados (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nome_key TEXT NOT NULL UNIQUE,
      nome_original TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now'))
    )
  `);
}

async function ensureValoresFuncoesTable() {
  const g = globalThis as typeof globalThis & {
    __lle_ensure_valores_funcoes_done?: boolean;
    __lle_ensure_valores_funcoes_promise?: Promise<void>;
  };
  if (g.__lle_ensure_valores_funcoes_done) return;
  if (g.__lle_ensure_valores_funcoes_promise) return g.__lle_ensure_valores_funcoes_promise;
  g.__lle_ensure_valores_funcoes_promise = (async () => {
  await turso.execute(`
    CREATE TABLE IF NOT EXISTS valores_funcoes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      funcao TEXT NOT NULL UNIQUE,
      custo_padrao REAL NOT NULL DEFAULT 0,
      valor_cliente_padrao REAL NOT NULL DEFAULT 0,
      notas TEXT DEFAULT '',
      ativo INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now'))
    )
  `);
  for (const funcao of DEFAULT_FUNCOES_VALORES) {
    try {
      await turso.execute({
        sql: "INSERT OR IGNORE INTO valores_funcoes (funcao, custo_padrao, valor_cliente_padrao, notas, ativo) VALUES (?, 0, 0, '', 1)",
        args: [funcao],
      });
    } catch { }
  }

  })();
  try {
    await g.__lle_ensure_valores_funcoes_promise;
    g.__lle_ensure_valores_funcoes_done = true;
  } catch (error) {
    g.__lle_ensure_valores_funcoes_promise = undefined;
    throw error;
  }
}


type ConsolidatedValorMasterSeed = ValorMasterSeed & { valor_sud: number };

function consolidatedValoresMasterSeeds(): ConsolidatedValorMasterSeed[] {
  const grouped = new Map<string, ConsolidatedValorMasterSeed>();
  for (const seed of DEFAULT_VALORES_MASTER) {
    if (seed.contexto === "Residência" || isMaterialValueService(seed.servico)) continue;
    const key = `${seed.servico.trim().toLowerCase()}||${seed.duracao_formato.trim().toLowerCase()}`;
    if (seed.contexto === "SUD") {
      const current = grouped.get(key);
      if (current) current.valor_sud = Number(seed.valor_cliente_final || 0);
      else grouped.set(key, {
        ...seed,
        contexto: "Normal",
        cliente_nome: "",
        custo_interno: 0,
        valor_parceiro: 0,
        valor_sud: Number(seed.valor_cliente_final || 0),
        valor_cliente_final: 0,
      });
      continue;
    }
    const current = grouped.get(key);
    grouped.set(key, {
      ...seed,
      valor_sud: current?.valor_sud || Number(seed.valor_sud || 0),
    });
  }
  return [...grouped.values()];
}

async function ensureLleMetaTable() {
  await turso.execute(`
    CREATE TABLE IF NOT EXISTS lle_meta (
      chave TEXT PRIMARY KEY,
      valor TEXT DEFAULT '',
      updated_at TEXT DEFAULT (datetime('now'))
    )
  `);
}

async function hasMigration(chave: string) {
  const result = await turso.execute({ sql: "SELECT 1 FROM lle_meta WHERE chave=? LIMIT 1", args: [chave] });
  return result.rows.length > 0;
}

async function markMigration(chave: string) {
  await turso.execute({
    sql: "INSERT OR REPLACE INTO lle_meta (chave, valor, updated_at) VALUES (?, '1', datetime('now'))",
    args: [chave],
  });
}

function normalizeValorMasterKey(value: unknown) {
  return String(value || '').trim().toLocaleLowerCase('pt-PT');
}

function isResidenceValorRow(row: any) {
  const context = normalizeValorMasterKey(row?.contexto);
  return context === 'residência' || context === 'residencia' || context === 'evento residência' || context === 'evento residencia';
}

function isGeneralValorMasterRow(row: any) {
  return !isResidenceValorRow(row) && !isMaterialValueService(String(row?.servico || ''));
}

function valorMasterContextKind(row: any) {
  const context = normalizeValorMasterKey(row?.contexto);
  const client = normalizeValorMasterKey(row?.cliente_nome);
  if (context === 'sud' || client === 'sud') return 'sud';
  if (context === 'parceiro' || client === 'parceiro') return 'partner';
  if (context === 'cliente final' || client === 'cliente final') return 'final';
  return 'base';
}

function firstPositive(rows: any[], getter: (row: any) => unknown) {
  for (const row of rows) {
    const value = Number(getter(row) || 0);
    if (value !== 0) return value;
  }
  return 0;
}

async function consolidateExistingValoresMasterRows() {
  const result = await turso.execute(`
    SELECT * FROM valores_master
    WHERE LOWER(TRIM(COALESCE(contexto, 'Normal'))) NOT IN ('residência', 'residencia')
      AND merged_into_id IS NULL
    ORDER BY ativo DESC, id ASC
  `);
  const groups = new Map<string, any[]>();
  for (const row of result.rows as any[]) {
    const key = `${normalizeValorMasterKey(row.servico)}||${normalizeValorMasterKey(row.duracao_formato)}`;
    const current = groups.get(key) || [];
    current.push(row);
    groups.set(key, current);
  }

  for (const group of groups.values()) {
    const sorted = [...group].sort((a, b) => {
      const activeDiff = Number(b.ativo || 0) - Number(a.ativo || 0);
      if (activeDiff) return activeDiff;
      const rank = (row: any) => ({ base: 0, final: 1, partner: 2, sud: 3 }[valorMasterContextKind(row)] ?? 4);
      const rankDiff = rank(a) - rank(b);
      return rankDiff || Number(a.id) - Number(b.id);
    });
    const base = sorted[0];
    const partnerRows = sorted.filter(row => valorMasterContextKind(row) === 'partner');
    const sudRows = sorted.filter(row => valorMasterContextKind(row) === 'sud');
    const finalRows = sorted.filter(row => valorMasterContextKind(row) === 'final');
    const normalRows = sorted.filter(row => valorMasterContextKind(row) === 'base');
    const baseKind = valorMasterContextKind(base);

    const custoInterno = Number(base.custo_interno || 0) || firstPositive(sorted, row => row.custo_interno);
    const valorParceiro = firstPositive(partnerRows, row => Number(row.valor_parceiro || 0) || Number(row.valor_cliente_final || 0))
      || (baseKind === 'partner' ? Number(base.valor_parceiro || base.valor_cliente_final || 0) : Number(base.valor_parceiro || 0))
      || firstPositive(normalRows, row => row.valor_parceiro);
    const valorSud = firstPositive(sudRows, row => Number(row.valor_sud || 0) || Number(row.valor_cliente_final || 0) || Number(row.valor_parceiro || 0))
      || Number(base.valor_sud || 0);
    const valorClienteFinal = firstPositive(finalRows, row => Number(row.valor_cliente_final || 0) || Number(row.valor_parceiro || 0))
      || (baseKind === 'sud' ? 0 : Number(base.valor_cliente_final || 0))
      || firstPositive(normalRows, row => row.valor_cliente_final);
    const contexto = baseKind === 'base' ? String(base.contexto || 'Normal') : 'Normal';
    const notas = String(base.notas || '').replace(/\s*·\s*Migrado para coluna SUD/g, '').trim();

    await turso.execute({
      sql: `UPDATE valores_master
            SET contexto=?, cliente_nome='', custo_interno=?, valor_parceiro=?, valor_sud=?, valor_cliente_final=?, notas=?, merged_into_id=NULL
            WHERE id=?`,
      args: [contexto, custoInterno, valorParceiro, valorSud, valorClienteFinal, notas, Number(base.id)],
    });

    for (const duplicate of sorted.slice(1)) {
      await turso.execute({
        sql: `UPDATE valores_master
              SET ativo=0, merged_into_id=?,
                  notas=CASE WHEN INSTR(COALESCE(notas,''), 'Consolidado na linha') > 0 THEN notas ELSE TRIM(COALESCE(notas,'') || ' · Consolidado na linha ' || ?) END
              WHERE id=?`,
        args: [Number(base.id), Number(base.id), Number(duplicate.id)],
      });
    }
  }
}

async function ensureValoresMasterTable() {
  const g = globalThis as typeof globalThis & {
    __lle_ensure_valores_master_done?: boolean;
    __lle_ensure_valores_master_promise?: Promise<void>;
  };
  if (g.__lle_ensure_valores_master_done) return;
  if (g.__lle_ensure_valores_master_promise) return g.__lle_ensure_valores_master_promise;
  g.__lle_ensure_valores_master_promise = (async () => {
    await turso.execute(`
      CREATE TABLE IF NOT EXISTS valores_master (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        servico TEXT NOT NULL,
        duracao_formato TEXT DEFAULT '',
        contexto TEXT DEFAULT 'Normal',
        cliente_nome TEXT DEFAULT '',
        custo_interno REAL NOT NULL DEFAULT 0,
        valor_parceiro REAL NOT NULL DEFAULT 0,
        valor_sud REAL NOT NULL DEFAULT 0,
        valor_cliente_final REAL NOT NULL DEFAULT 0,
        notas TEXT DEFAULT '',
        ativo INTEGER DEFAULT 1,
        merged_into_id INTEGER DEFAULT NULL,
        created_at TEXT DEFAULT (datetime('now'))
      )
    `);

    const tableInfo = await turso.execute("PRAGMA table_info(valores_master)");
    const existingColumns = new Set(tableInfo.rows.map((row: any) => String(row.name)));
    const columns: Array<[string, string]> = [
      ["servico", "TEXT NOT NULL DEFAULT ''"],
      ["duracao_formato", "TEXT DEFAULT ''"],
      ["contexto", "TEXT DEFAULT 'Normal'"],
      ["cliente_nome", "TEXT DEFAULT ''"],
      ["custo_interno", "REAL NOT NULL DEFAULT 0"],
      ["valor_parceiro", "REAL NOT NULL DEFAULT 0"],
      ["valor_sud", "REAL NOT NULL DEFAULT 0"],
      ["valor_cliente_final", "REAL NOT NULL DEFAULT 0"],
      ["notas", "TEXT DEFAULT ''"],
      ["ativo", "INTEGER DEFAULT 1"],
      ["merged_into_id", "INTEGER DEFAULT NULL"],
    ];
    for (const [name, definition] of columns) {
      if (!existingColumns.has(name)) await turso.execute(`ALTER TABLE valores_master ADD COLUMN ${name} ${definition}`);
    }

    await ensureLleMetaTable();
    const migrationKey = "valores_master_v3_consolidado_20260715";
    if (!(await hasMigration(migrationKey))) {
      await seedValoresMasterLLE2026();

      // Só corre uma vez na base de dados, em vez de dezenas de queries em cada cold start.
      for (const servico of SERVICOS_VENDIDOS) {
        if (isMaterialValueService(servico)) continue;
        const exists = await turso.execute({
          sql: "SELECT id FROM valores_master WHERE LOWER(TRIM(servico)) = LOWER(TRIM(?)) AND merged_into_id IS NULL LIMIT 1",
          args: [servico],
        });
        if (exists.rows.length === 0) {
          await turso.execute({
            sql: "INSERT INTO valores_master (servico, duracao_formato, contexto, cliente_nome, custo_interno, valor_parceiro, valor_sud, valor_cliente_final, notas, ativo, merged_into_id) VALUES (?, '', 'Normal', '', 0, 0, 0, 0, 'Serviço base LLE — preencher valores', 1, NULL)",
            args: [servico],
          });
        }
      }

      // Consolida linhas antigas de Parceiro, Cliente Final e SUD numa só linha por serviço/formato.
      await consolidateExistingValoresMasterRows();
      await markMigration(migrationKey);
    }

    // Valores de material e residência pertencem aos respetivos módulos, não à Master geral.
    await migrateSeparatedModuleValues();
  })();
  try {
    await g.__lle_ensure_valores_master_promise;
    g.__lle_ensure_valores_master_done = true;
  } catch (error) {
    g.__lle_ensure_valores_master_promise = undefined;
    throw error;
  }
}

function isBlankOrDefaultValorMasterRow(row: any) {
  const notas = String(row?.notas || '');
  const numericBlank = Number(row?.custo_interno || 0) === 0
    && Number(row?.valor_parceiro || 0) === 0
    && Number(row?.valor_sud || 0) === 0
    && Number(row?.valor_cliente_final || 0) === 0;
  return numericBlank || notas.includes('Serviço base LLE') || notas.includes('Criado a partir dos serviços');
}

async function updateValorMasterSeedRow(id: number, row: any, seed: ConsolidatedValorMasterSeed) {
  const keepManual = !isBlankOrDefaultValorMasterRow(row);
  const custoInterno = keepManual && Number(row?.custo_interno || 0) !== 0 ? Number(row.custo_interno) : seed.custo_interno;
  const valorParceiro = keepManual && Number(row?.valor_parceiro || 0) !== 0 ? Number(row.valor_parceiro) : seed.valor_parceiro;
  const valorSud = keepManual && Number(row?.valor_sud || 0) !== 0 ? Number(row.valor_sud) : seed.valor_sud;
  const valorClienteFinal = keepManual && Number(row?.valor_cliente_final || 0) !== 0 ? Number(row.valor_cliente_final) : seed.valor_cliente_final;
  const notas = keepManual && String(row?.notas || '').trim() ? String(row.notas) : (seed.notas || 'Tabela LLE 2026');

  await turso.execute({
    sql: "UPDATE valores_master SET servico=?, duracao_formato=?, contexto=?, cliente_nome='', custo_interno=?, valor_parceiro=?, valor_sud=?, valor_cliente_final=?, notas=? WHERE id=?",
    args: [seed.servico, seed.duracao_formato, seed.contexto, custoInterno, valorParceiro, valorSud, valorClienteFinal, notas, id],
  });
}

async function insertValorMasterSeed(seed: ConsolidatedValorMasterSeed) {
  await turso.execute({
    sql: "INSERT INTO valores_master (servico, duracao_formato, contexto, cliente_nome, custo_interno, valor_parceiro, valor_sud, valor_cliente_final, notas, ativo) VALUES (?, ?, ?, '', ?, ?, ?, ?, ?, 1)",
    args: [seed.servico, seed.duracao_formato, seed.contexto, seed.custo_interno, seed.valor_parceiro, seed.valor_sud, seed.valor_cliente_final, seed.notas || 'Tabela LLE 2026'],
  });
}

async function seedValoresMasterLLE2026() {
  for (const seed of consolidatedValoresMasterSeeds()) {
    const exact = await turso.execute({
      sql: `
        SELECT * FROM valores_master
        WHERE LOWER(TRIM(servico)) = LOWER(TRIM(?))
          AND LOWER(TRIM(COALESCE(duracao_formato, ''))) = LOWER(TRIM(?))
          AND LOWER(TRIM(COALESCE(contexto, 'Normal'))) NOT IN ('sud', 'residência', 'residencia')
          AND merged_into_id IS NULL
        ORDER BY ativo DESC, id ASC
        LIMIT 1
      `,
      args: [seed.servico, seed.duracao_formato],
    });
    if (exact.rows.length > 0) {
      await updateValorMasterSeedRow(Number((exact.rows[0] as any).id), exact.rows[0], seed);
      continue;
    }

    const reusableDefault = await turso.execute({
      sql: `
        SELECT * FROM valores_master
        WHERE LOWER(TRIM(servico)) = LOWER(TRIM(?))
          AND TRIM(COALESCE(duracao_formato, '')) = ''
          AND LOWER(TRIM(COALESCE(contexto, 'Normal'))) NOT IN ('sud', 'residência', 'residencia')
          AND merged_into_id IS NULL
        ORDER BY ativo DESC, id ASC
        LIMIT 1
      `,
      args: [seed.servico],
    });
    if (reusableDefault.rows.length > 0 && isBlankOrDefaultValorMasterRow(reusableDefault.rows[0])) {
      await updateValorMasterSeedRow(Number((reusableDefault.rows[0] as any).id), reusableDefault.rows[0], seed);
      continue;
    }

    await insertValorMasterSeed(seed);
  }
}

async function ensureResidenciasAtivasTable() {
  const g = globalThis as typeof globalThis & {
    __lle_ensure_residencias_done?: boolean;
    __lle_ensure_residencias_promise?: Promise<void>;
  };
  if (g.__lle_ensure_residencias_done) return;
  if (g.__lle_ensure_residencias_promise) return g.__lle_ensure_residencias_promise;
  g.__lle_ensure_residencias_promise = (async () => {
  await turso.execute(`
    CREATE TABLE IF NOT EXISTS residencias_ativas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nome TEXT NOT NULL,
      cliente_id INTEGER,
      cliente_nome TEXT DEFAULT '',
      local TEXT DEFAULT '',
      servico TEXT DEFAULT 'DJ',
      duracao_formato TEXT DEFAULT '',
      custo_interno REAL NOT NULL DEFAULT 0,
      custo_evento REAL NOT NULL DEFAULT 0,
      valor_cliente REAL NOT NULL DEFAULT 0,
      valor_evento REAL NOT NULL DEFAULT 0,
      performer_padrao_id INTEGER,
      performer_padrao_nome TEXT DEFAULT '',
      notas TEXT DEFAULT '',
      ativo INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now'))
    )
  `);
  const cols = [
    "nome TEXT NOT NULL DEFAULT ''",
    "cliente_id INTEGER",
    "cliente_nome TEXT DEFAULT ''",
    "local TEXT DEFAULT ''",
    "servico TEXT DEFAULT 'DJ'",
    "duracao_formato TEXT DEFAULT ''",
    "custo_interno REAL NOT NULL DEFAULT 0",
    "custo_evento REAL NOT NULL DEFAULT 0",
    "valor_cliente REAL NOT NULL DEFAULT 0",
    "valor_evento REAL NOT NULL DEFAULT 0",
    "performer_padrao_id INTEGER",
    "performer_padrao_nome TEXT DEFAULT ''",
    "notas TEXT DEFAULT ''",
    "ativo INTEGER DEFAULT 1",
  ];
  for (const col of cols) {
    try { await turso.execute(`ALTER TABLE residencias_ativas ADD COLUMN ${col}`); } catch { }
  }

  })();
  try {
    await g.__lle_ensure_residencias_promise;
    g.__lle_ensure_residencias_done = true;
  } catch (error) {
    g.__lle_ensure_residencias_promise = undefined;
    throw error;
  }
}


// ── PACKS COMERCIAIS ────────────────────────────────────────────────────────
// Packs são produtos comerciais compostos. Não substituem as skills dos colaboradores.
// O preço do pack é definido comercialmente; o custo estimado pode ser derivado dos
// componentes (skills + materiais), enquanto o custo real continua a ser o do evento.
async function ensurePacksComerciaisTables() {
  await turso.execute(`
    CREATE TABLE IF NOT EXISTS packs_comerciais (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nome TEXT NOT NULL UNIQUE,
      descricao TEXT DEFAULT '',
      valor_sud REAL NOT NULL DEFAULT 0,
      valor_residencia REAL NOT NULL DEFAULT 0,
      valor_evento_residencia REAL NOT NULL DEFAULT 0,
      valor_parceria REAL NOT NULL DEFAULT 0,
      valor_cliente_final REAL NOT NULL DEFAULT 0,
      notas TEXT DEFAULT '',
      ativo INTEGER NOT NULL DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    )
  `);
  await turso.execute(`
    CREATE TABLE IF NOT EXISTS pack_comercial_componentes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      pack_id INTEGER NOT NULL,
      tipo TEXT NOT NULL DEFAULT 'skill',
      referencia TEXT NOT NULL DEFAULT '',
      material_id INTEGER,
      quantidade REAL NOT NULL DEFAULT 1,
      notas TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now'))
    )
  `);

  // Migração inicial: mantém os packs que já existiam no Auto Budget.
  const count = await turso.execute("SELECT COUNT(*) AS n FROM packs_comerciais");
  if (Number((count.rows[0] as any)?.n || 0) === 0) {
    for (const packName of AUTO_BUDGET_PACK_SERVICES) {
      const rows = DEFAULT_VALORES_MASTER.filter(v => v.servico === packName);
      const normal = rows.find(v => ["Normal", "Priceless Band", "Pack AV"].includes(v.contexto)) || rows[0];
      const sud = rows.find(v => v.contexto === "SUD");
      const residencia = rows.find(v => v.contexto === "Residência");
      await turso.execute({
        sql: `INSERT OR IGNORE INTO packs_comerciais
          (nome, descricao, valor_sud, valor_residencia, valor_evento_residencia, valor_parceria, valor_cliente_final, notas, ativo)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)`,
        args: [
          packName,
          normal?.duracao_formato || '',
          Number(sud?.valor_cliente_final || normal?.valor_sud || 0),
          Number(residencia?.valor_parceiro || 0),
          Number(residencia?.valor_cliente_final || 0),
          Number(normal?.valor_parceiro || 0),
          Number(normal?.valor_cliente_final || 0),
          normal?.notas || 'Migrado da tabela anterior; confirmar composição do pack.',
        ],
      });
    }
  }
}

export type PackComercialComponenteInput = {
  tipo: 'skill' | 'material';
  referencia: string;
  material_id?: number | null;
  quantidade?: number;
  notas?: string;
};

export async function getAllPacksComerciais() {
  try {
    await ensurePacksComerciaisTables();
    try { await setupMateriais(); } catch { }
    const packs = await turso.execute(`SELECT * FROM packs_comerciais ORDER BY ativo DESC, nome COLLATE NOCASE ASC, id ASC`);
    const components = await turso.execute(`
      SELECT pc.*, COALESCE(m.nome, pc.referencia) AS material_nome,
             COALESCE(m.imagem, '') AS material_imagem,
             COALESCE(m.custo_interno, 0) AS material_custo_interno
      FROM pack_comercial_componentes pc
      LEFT JOIN materiais m ON m.id = pc.material_id
      ORDER BY pc.pack_id ASC, pc.tipo ASC, pc.id ASC
    `);
    const byPack = new Map<number, any[]>();
    for (const r of components.rows as any[]) {
      const pid = Number(r.pack_id);
      const arr = byPack.get(pid) || [];
      arr.push({
        id: Number(r.id), pack_id: pid, tipo: String(r.tipo || 'skill'), referencia: String(r.referencia || ''),
        material_id: r.material_id == null ? null : Number(r.material_id), quantidade: Number(r.quantidade || 1),
        notas: String(r.notas || ''), material_nome: String(r.material_nome || ''), material_imagem: String(r.material_imagem || ''),
        material_custo_interno: Number(r.material_custo_interno || 0),
      });
      byPack.set(pid, arr);
    }
    return {
      success: true,
      data: (packs.rows as any[]).map(r => ({
        id: Number(r.id), nome: String(r.nome || ''), descricao: String(r.descricao || ''),
        valor_sud: Number(r.valor_sud || 0), valor_residencia: Number(r.valor_residencia || 0),
        valor_evento_residencia: Number(r.valor_evento_residencia || 0), valor_parceria: Number(r.valor_parceria || 0),
        valor_cliente_final: Number(r.valor_cliente_final || 0), notas: String(r.notas || ''),
        ativo: Number(r.ativo || 0), componentes: byPack.get(Number(r.id)) || [],
      })),
    };
  } catch (error) {
    console.error('Erro getAllPacksComerciais:', error);
    return { success: false, data: [] };
  }
}

async function savePackComercialComponentes(packId: number, componentes: PackComercialComponenteInput[] = []) {
  await turso.execute({ sql: 'DELETE FROM pack_comercial_componentes WHERE pack_id=?', args: [packId] });
  for (const item of componentes) {
    const tipo = item.tipo === 'material' ? 'material' : 'skill';
    const referencia = String(item.referencia || '').trim();
    if (!referencia) continue;
    await turso.execute({
      sql: `INSERT INTO pack_comercial_componentes (pack_id, tipo, referencia, material_id, quantidade, notas)
            VALUES (?, ?, ?, ?, ?, ?)`,
      args: [packId, tipo, referencia, item.material_id ?? null, Math.max(1, Number(item.quantidade || 1)), item.notas || ''],
    });
  }
}

export async function createPackComercial(data: {
  nome: string; descricao?: string; valor_sud?: number; valor_residencia?: number; valor_evento_residencia?: number;
  valor_parceria?: number; valor_cliente_final?: number; notas?: string; ativo?: number; componentes?: PackComercialComponenteInput[];
}) {
  try {
    await ensurePacksComerciaisTables();
    const nome = String(data.nome || '').trim();
    if (!nome) return { success: false, message: 'Nome obrigatório.' };
    await turso.execute({
      sql: `INSERT INTO packs_comerciais
            (nome, descricao, valor_sud, valor_residencia, valor_evento_residencia, valor_parceria, valor_cliente_final, notas, ativo)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [nome, data.descricao || '', Number(data.valor_sud || 0), Number(data.valor_residencia || 0), Number(data.valor_evento_residencia || 0), Number(data.valor_parceria || 0), Number(data.valor_cliente_final || 0), data.notas || '', data.ativo ?? 1],
    });
    const last = await turso.execute('SELECT last_insert_rowid() AS id');
    const id = Number((last.rows[0] as any).id);
    await savePackComercialComponentes(id, data.componentes || []);
    return { success: true, id };
  } catch (error: any) {
    console.error('Erro createPackComercial:', error);
    return { success: false, message: String(error?.message || 'Erro ao criar pack.') };
  }
}

export async function updatePackComercial(id: number, data: {
  nome: string; descricao?: string; valor_sud?: number; valor_residencia?: number; valor_evento_residencia?: number;
  valor_parceria?: number; valor_cliente_final?: number; notas?: string; ativo?: number; componentes?: PackComercialComponenteInput[];
}) {
  try {
    await ensurePacksComerciaisTables();
    await turso.execute({
      sql: `UPDATE packs_comerciais SET nome=?, descricao=?, valor_sud=?, valor_residencia=?, valor_evento_residencia=?,
            valor_parceria=?, valor_cliente_final=?, notas=?, ativo=?, updated_at=datetime('now') WHERE id=?`,
      args: [String(data.nome || '').trim(), data.descricao || '', Number(data.valor_sud || 0), Number(data.valor_residencia || 0), Number(data.valor_evento_residencia || 0), Number(data.valor_parceria || 0), Number(data.valor_cliente_final || 0), data.notas || '', data.ativo ?? 1, id],
    });
    await savePackComercialComponentes(id, data.componentes || []);
    return { success: true };
  } catch (error) {
    console.error('Erro updatePackComercial:', error);
    return { success: false };
  }
}

export async function togglePackComercialAtivo(id: number, ativo: number) {
  try {
    await ensurePacksComerciaisTables();
    await turso.execute({ sql: `UPDATE packs_comerciais SET ativo=?, updated_at=datetime('now') WHERE id=?`, args: [ativo, id] });
    return { success: true };
  } catch (error) {
    console.error('Erro togglePackComercialAtivo:', error);
    return { success: false };
  }
}


export async function syncPacksComerciaisMateriaisEvento(eventoId: number, packNames: string[], reservadoPor: string = '') {
  try {
    await ensurePacksComerciaisTables();
    await setupMateriais();
    const names = Array.from(new Set((packNames || []).map(x => String(x || '').trim()).filter(Boolean)));

    // Reservas automáticas anteriores deste sistema são reconstruídas em cada gravação.
    // Valor unitário = 0 porque o material já está incluído no preço comercial do pack;
    // custo unitário é mantido para entrar no custo real do evento.
    await turso.execute({
      sql: `UPDATE material_reservas SET ativo=0, encerrada_sem_fluxo=1, encerrada_por=?, encerrada_em=datetime('now')
            WHERE evento_id=? AND origem='Pack Comercial' AND ativo=1`,
      args: [reservadoPor || 'Auto Budget', eventoId],
    });
    if (names.length === 0) return { success: true, count: 0 };

    let inserted = 0;
    for (const packName of names) {
      const packRes = await turso.execute({ sql: `SELECT id, nome FROM packs_comerciais WHERE LOWER(TRIM(nome))=LOWER(TRIM(?)) AND ativo=1 LIMIT 1`, args: [packName] });
      if (!packRes.rows.length) continue;
      const pack = packRes.rows[0] as any;
      const comps = await turso.execute({
        sql: `SELECT pc.material_id, pc.quantidade, pc.notas, m.nome, m.imagem, m.custo_interno
              FROM pack_comercial_componentes pc
              JOIN materiais m ON m.id=pc.material_id AND m.ativo=1
              WHERE pc.pack_id=? AND pc.tipo='material'`,
        args: [Number(pack.id)],
      });
      for (const row of comps.rows as any[]) {
        const qty = Math.max(1, Number(row.quantidade || 1));
        await turso.execute({
          sql: `INSERT INTO material_reservas
            (evento_id, material_id, material_nome, material_imagem, quantidade, origem, origem_detalhe, notas, reservado_por,
             custo_unitario, valor_unitario, valor_contexto, contabilizar, ativo)
            VALUES (?, ?, ?, ?, ?, 'Pack Comercial', ?, ?, ?, ?, 0, 'Incluído no Pack', 1, 1)`,
          args: [eventoId, Number(row.material_id), String(row.nome || ''), String(row.imagem || ''), qty, String(pack.nome || packName), row.notas || `Incluído no pack ${pack.nome || packName}`, reservadoPor || '', Number(row.custo_interno || 0)],
        });
        inserted += 1;
      }
    }
    return { success: true, count: inserted };
  } catch (error) {
    console.error('Erro syncPacksComerciaisMateriaisEvento:', error);
    return { success: false, count: 0 };
  }
}

async function ensureCommercialColumns() {
  const g = globalThis as typeof globalThis & {
    __lle_ensure_commercial_cols_done?: boolean;
    __lle_ensure_commercial_cols_promise?: Promise<void>;
  };
  if (g.__lle_ensure_commercial_cols_done) return;
  if (g.__lle_ensure_commercial_cols_promise) return g.__lle_ensure_commercial_cols_promise;
  g.__lle_ensure_commercial_cols_promise = (async () => {
  try { await turso.execute("ALTER TABLE agenda ADD COLUMN residencia_id INTEGER"); } catch { }
  try { await turso.execute("ALTER TABLE leads ADD COLUMN residencia_id INTEGER"); } catch { }
  const cols = [
    "tipo_comercial TEXT DEFAULT 'Evento'",
    "servico_comercial TEXT DEFAULT ''",
    "valor_contexto TEXT DEFAULT 'Cliente Final'",
    "autobudget_snapshot TEXT DEFAULT ''",
  ];
  for (const col of cols) {
    try { await turso.execute(`ALTER TABLE agenda ADD COLUMN ${col}`); } catch { }
    try { await turso.execute(`ALTER TABLE leads ADD COLUMN ${col}`); } catch { }
  }

  })();
  try {
    await g.__lle_ensure_commercial_cols_promise;
    g.__lle_ensure_commercial_cols_done = true;
  } catch (error) {
    g.__lle_ensure_commercial_cols_promise = undefined;
    throw error;
  }
}

function extractField(details: string, field: string): string {
  if (!details) return '';
  const regex = new RegExp(`${field}:\\s*([^|]+)`);
  const match = details.match(regex);
  return match ? match[1].trim() : '';
}

// UUID v4 simples (não requer lib externa)
function uuidv4(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
  });
}

// ── SYNC CENTRAL por event_id ─────────────────────────────────────────────────
// Propaga campos partilhados para todos os registos com o mesmo event_id.
// Não sobrescreve event_id nem id; só os campos de conteúdo.
async function propagateByEventId(event_id: string, fields: {
  title?: string; event_date?: string; value?: number; status?: string;
  cliente_id?: number | null; cliente_nome?: string; modalidade?: string;
  tipo_comercial?: string; servico_comercial?: string; valor_contexto?: string; autobudget_snapshot?: string;
  local?: string; contacto?: string; notas?: string; residencia_id?: number | null;
  valor_recebido?: number;
}) {
  if (!event_id) return;
  const f = fields;
  // Agenda: actualizar todos os campos presentes
  const agendaUpdates: string[] = [];
  const agendaArgs: (string | number | null)[] = [];
  if (f.title !== undefined)         { agendaUpdates.push('event_name=?');    agendaArgs.push(f.title); }
  if (f.event_date !== undefined)    { agendaUpdates.push('event_date=?');    agendaArgs.push(f.event_date); }
  if (f.value !== undefined)         { agendaUpdates.push('client_cachet=?'); agendaArgs.push(f.value); }
  if (f.status !== undefined)        { agendaUpdates.push('billing_status=?');agendaArgs.push(f.status); }
  if (f.cliente_id !== undefined)    { agendaUpdates.push('cliente_id=?');    agendaArgs.push(f.cliente_id ?? null); }
  if (f.cliente_nome !== undefined)  { agendaUpdates.push('cliente_nome=?');  agendaArgs.push(f.cliente_nome); }
  if (f.modalidade !== undefined)    { agendaUpdates.push('modalidade=?');    agendaArgs.push(f.modalidade); }
  if (f.tipo_comercial !== undefined){ agendaUpdates.push('tipo_comercial=?');agendaArgs.push(f.tipo_comercial); }
  if (f.servico_comercial !== undefined){ agendaUpdates.push('servico_comercial=?');agendaArgs.push(f.servico_comercial); }
  if (f.valor_contexto !== undefined){ agendaUpdates.push('valor_contexto=?');agendaArgs.push(f.valor_contexto); }
  if (f.autobudget_snapshot !== undefined){ agendaUpdates.push('autobudget_snapshot=?');agendaArgs.push(f.autobudget_snapshot); }
  if (f.local !== undefined)         { agendaUpdates.push('venue=?');         agendaArgs.push(f.local); }
  if (f.contacto !== undefined)      { agendaUpdates.push('contacto=?');      agendaArgs.push(f.contacto); }
  if (f.notas !== undefined)         { agendaUpdates.push('notas=?');         agendaArgs.push(f.notas); }
  if (f.residencia_id !== undefined) { agendaUpdates.push('residencia_id=?'); agendaArgs.push(f.residencia_id ?? null); }
  if (f.valor_recebido !== undefined){ agendaUpdates.push('valor_recebido=?');agendaArgs.push(f.valor_recebido); }
  if (agendaUpdates.length > 0) {
    agendaArgs.push(event_id);
    await turso.execute({ sql: `UPDATE agenda SET ${agendaUpdates.join(',')} WHERE event_id=?`, args: agendaArgs });
  }

  // Leads: mesmos campos (com mapeamento de nomes de colunas diferentes)
  const leadsUpdates: string[] = [];
  const leadsArgs: (string | number | null)[] = [];
  if (f.title !== undefined)         { leadsUpdates.push('title=?');         leadsArgs.push(f.title); }
  if (f.event_date !== undefined)    { leadsUpdates.push('event_date=?');    leadsArgs.push(f.event_date); }
  if (f.value !== undefined)         { leadsUpdates.push('value=?');         leadsArgs.push(f.value); }
  if (f.status !== undefined)        { leadsUpdates.push('status=?');        leadsArgs.push(f.status); }
  if (f.cliente_id !== undefined)    { leadsUpdates.push('cliente_id=?');    leadsArgs.push(f.cliente_id ?? null); }
  if (f.cliente_nome !== undefined)  { leadsUpdates.push('client_name=?');   leadsArgs.push(f.cliente_nome); }
  if (f.modalidade !== undefined)    { leadsUpdates.push('modalidade=?');    leadsArgs.push(f.modalidade); }
  if (f.tipo_comercial !== undefined){ leadsUpdates.push('tipo_comercial=?');leadsArgs.push(f.tipo_comercial); }
  if (f.servico_comercial !== undefined){ leadsUpdates.push('servico_comercial=?');leadsArgs.push(f.servico_comercial); }
  if (f.valor_contexto !== undefined){ leadsUpdates.push('valor_contexto=?');leadsArgs.push(f.valor_contexto); }
  if (f.autobudget_snapshot !== undefined){ leadsUpdates.push('autobudget_snapshot=?');leadsArgs.push(f.autobudget_snapshot); }
  if (f.local !== undefined)         { leadsUpdates.push('local=?');         leadsArgs.push(f.local); }
  if (f.contacto !== undefined)      { leadsUpdates.push('contacto=?');      leadsArgs.push(f.contacto); }
  if (f.notas !== undefined)         { leadsUpdates.push('notas=?');         leadsArgs.push(f.notas); }
  if (f.residencia_id !== undefined) { leadsUpdates.push('residencia_id=?'); leadsArgs.push(f.residencia_id ?? null); }
  if (f.valor_recebido !== undefined){ leadsUpdates.push('valor_recebido=?');leadsArgs.push(f.valor_recebido); }
  if (leadsUpdates.length > 0) {
    leadsArgs.push(event_id);
    await turso.execute({ sql: `UPDATE leads SET ${leadsUpdates.join(',')} WHERE event_id=?`, args: leadsArgs });
  }
}

function getEventIcon(title: string): string {
  const t = title.toLowerCase();
  if (t.includes('folga')) return '⛱️';
  if (t.includes('epic sana')) return '🎹🎤🎷';
  if (t.includes('terrazza') || t.includes('tribute') || t.includes('hyatt') || t.includes('art stay') || t.includes('erva') || t.includes('evolution')) return '🎤';
  if (t.includes('curso')) return '🪬';
  if (t.includes('roupa')) return '🥻';
  if (t.includes('sud hall')) return '🟢';
  return '🔵';
}


export async function setupDatabase() {
  try {
    await turso.executeMultiple(`
      CREATE TABLE IF NOT EXISTS clientes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nome TEXT NOT NULL,
        nif TEXT,
        email TEXT,
        telefone TEXT,
        notas TEXT,
        created_at TEXT DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS artistas_evento (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        evento_id INTEGER NOT NULL,
        evento_nome TEXT NOT NULL,
        evento_data TEXT NOT NULL,
        nome TEXT NOT NULL,
        tipo TEXT NOT NULL DEFAULT 'DJ',
        fee REAL NOT NULL DEFAULT 0,
        created_at TEXT DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS colaboradores (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nome TEXT NOT NULL,
        nome_artistico TEXT DEFAULT '',
        nome_pessoal TEXT DEFAULT '',
        contacto TEXT DEFAULT '',
        email TEXT DEFAULT '',
        iban TEXT DEFAULT '',
        skills TEXT DEFAULT '',
        notas TEXT DEFAULT '',
        ativo INTEGER DEFAULT 1,
        created_at TEXT DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS valores_funcoes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        funcao TEXT NOT NULL UNIQUE,
        custo_padrao REAL NOT NULL DEFAULT 0,
        valor_cliente_padrao REAL NOT NULL DEFAULT 0,
        notas TEXT DEFAULT '',
        ativo INTEGER DEFAULT 1,
        created_at TEXT DEFAULT (datetime('now'))
      );
    `);
    try { await turso.execute("ALTER TABLE artistas_evento ADD COLUMN colaborador_id INTEGER"); } catch { }

    await turso.execute(`
      CREATE TABLE IF NOT EXISTS artist_conflict_overrides (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        event_date TEXT NOT NULL,
        artist_key TEXT NOT NULL,
        artist_name TEXT DEFAULT '',
        note TEXT DEFAULT '',
        dismissed_by TEXT DEFAULT '',
        ativo INTEGER DEFAULT 1,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
      )
    `);
    try { await turso.execute("CREATE UNIQUE INDEX IF NOT EXISTS idx_artist_conflict_overrides_key ON artist_conflict_overrides(event_date, artist_key)"); } catch { }
    await ensureColaboradoresExtendedColumns();
    await ensureValoresFuncoesTable();
    await ensureValoresMasterTable();
    await ensureResidenciasAtivasTable();
    await ensureCommercialColumns();

    const agendaCols = [
      "billing_status TEXT DEFAULT 'Contacto'",
      "cliente_id INTEGER",
      "cliente_nome TEXT DEFAULT ''",
      "modalidade TEXT DEFAULT 'Fatura'",
      "tipo_comercial TEXT DEFAULT 'Evento'",
      "servico_comercial TEXT DEFAULT ''",
      "valor_contexto TEXT DEFAULT 'Cliente Final'",
      "autobudget_snapshot TEXT DEFAULT ''",
      "valor_recebido REAL DEFAULT 0",
      "origem_lead_id INTEGER",
      "venue TEXT DEFAULT ''",
      "contacto TEXT DEFAULT ''",
      "notas TEXT DEFAULT ''",
    ];
    for (const col of agendaCols) {
      try { await turso.execute(`ALTER TABLE agenda ADD COLUMN ${col}`); } catch { }
    }

    // Garantir tabela leads com todas as colunas necessárias
    try {
      await turso.execute(`CREATE TABLE IF NOT EXISTS leads (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL DEFAULT '',
        event_date TEXT DEFAULT '',
        value REAL DEFAULT 0,
        status TEXT DEFAULT 'Contacto',
        client_name TEXT DEFAULT '',
        local TEXT DEFAULT '',
        contacto TEXT DEFAULT '',
        notas TEXT DEFAULT '',
        cliente_id INTEGER,
        modalidade TEXT DEFAULT 'Fatura',
        tipo_comercial TEXT DEFAULT 'Evento',
        servico_comercial TEXT DEFAULT '',
        valor_contexto TEXT DEFAULT 'Cliente Final',
        autobudget_snapshot TEXT DEFAULT '',
        valor_recebido REAL DEFAULT 0,
        created_at TEXT DEFAULT (datetime('now'))
      )`);
    } catch { }
    const leadsCols = [
      "title TEXT NOT NULL DEFAULT ''",
      "event_date TEXT DEFAULT ''",
      "value REAL DEFAULT 0",
      "status TEXT DEFAULT 'Contacto'",
      "client_name TEXT DEFAULT ''",
      "local TEXT DEFAULT ''",
      "contacto TEXT DEFAULT ''",
      "notas TEXT DEFAULT ''",
      "cliente_id INTEGER",
      "modalidade TEXT DEFAULT 'Fatura'",
      "tipo_comercial TEXT DEFAULT 'Evento'",
      "servico_comercial TEXT DEFAULT ''",
      "valor_contexto TEXT DEFAULT 'Cliente Final'",
      "autobudget_snapshot TEXT DEFAULT ''",
      "valor_recebido REAL DEFAULT 0",
      "residencia_id INTEGER",
    ];
    for (const col of leadsCols) {
      try { await turso.execute(`ALTER TABLE leads ADD COLUMN ${col}`); } catch { }
    }

    // ── event_id: adicionar colunas e popular pares existentes ───────────────
    try { await turso.execute("ALTER TABLE agenda ADD COLUMN event_id TEXT DEFAULT ''"); } catch { }
    try { await turso.execute("ALTER TABLE leads  ADD COLUMN event_id TEXT DEFAULT ''"); } catch { }

    // Popular event_id para pares já ligados (origem_lead_id FK)
    // Para cada par agenda↔lead sem event_id, gerar um UUID partilhado
    const unlinkedPairs = await turso.execute(`
      SELECT a.id as agenda_id, a.origem_lead_id as lead_id
      FROM agenda a
      WHERE a.origem_lead_id IS NOT NULL
        AND (a.event_id IS NULL OR a.event_id = '')
    `);
    for (const row of unlinkedPairs.rows as any[]) {
      const eid = uuidv4();
      await turso.execute({ sql: "UPDATE agenda SET event_id=? WHERE id=?", args: [eid, row.agenda_id] });
      await turso.execute({ sql: "UPDATE leads  SET event_id=? WHERE id=?", args: [eid, row.lead_id] });
    }

    // Registos de agenda sem par e sem event_id → gerar event_id individual
    await turso.execute(`
      UPDATE agenda SET event_id = (
        lower(hex(randomblob(4))) || '-' ||
        lower(hex(randomblob(2))) || '-4' ||
        substr(lower(hex(randomblob(2))),2) || '-' ||
        substr('89ab', abs(random()) % 4 + 1, 1) ||
        substr(lower(hex(randomblob(2))),2) || '-' ||
        lower(hex(randomblob(6)))
      )
      WHERE event_id IS NULL OR event_id = ''
    `);
    // Registos de leads sem par e sem event_id → gerar event_id individual
    await turso.execute(`
      UPDATE leads SET event_id = (
        lower(hex(randomblob(4))) || '-' ||
        lower(hex(randomblob(2))) || '-4' ||
        substr(lower(hex(randomblob(2))),2) || '-' ||
        substr('89ab', abs(random()) % 4 + 1, 1) ||
        substr(lower(hex(randomblob(2))),2) || '-' ||
        lower(hex(randomblob(6)))
      )
      WHERE event_id IS NULL OR event_id = ''
    `);

    return { success: true };
  } catch (error) {
    console.error("Erro setup DB:", error);
    return { success: false };
  }
}

export async function loginUser(name: string) {
  try {
    const result = await turso.execute({ sql: "SELECT * FROM team WHERE name = ?", args: [name] });
    if (result.rows.length > 0) return { success: true, user: { ...result.rows[0] } };
    return { success: false, message: "Membro da equipa não encontrado." };
  } catch (error) {
    console.error("Erro auth:", error);
    return { success: false, message: "Erro de ligação ao sistema LLE." };
  }
}

import { unstable_noStore as noStore } from "next/cache";
// ^^^ adicionado para forçar sem cache
export async function getDashboardData(userName: string = 'Admin', clientTodayStr?: string) {
  noStore();
  try {
    // Recua 1 dia no servidor para agenda (garante eventos do dia actual)
    const serverDate = new Date();
    serverDate.setDate(serverDate.getDate() - 1);
    const todayStr = serverDate.toISOString().split("T")[0];

    // Para leads, usa a data local do browser (passada pelo cliente) ou hoje no servidor
    // Filtra directamente no SQL: data >= hoje E não Cancelado
    const leadsFromDate = clientTodayStr || new Date().toISOString().split("T")[0];
    const leadsRes = await turso.execute({
      sql: "SELECT * FROM leads WHERE event_date >= ? AND status != 'Cancelado' ORDER BY event_date ASC",
      args: [leadsFromDate]
    });

    let agendaSql = "SELECT * FROM agenda WHERE status != 'Cancelado' AND event_date >= ? ORDER BY event_date ASC LIMIT 200";
    // Tania e Soraya vêem o calendário completo (igual ao João/Admin)
    // Larissa mantém restrição anterior (só Public)
    if (userName === 'Larissa') agendaSql = "SELECT * FROM agenda WHERE status != 'Cancelado' AND event_date >= ? AND visibility = 'Public' ORDER BY event_date ASC LIMIT 200";

    const agendaAllRes = await turso.execute({ sql: agendaSql, args: [todayStr] });

    // Buscar todos os artistas (nome + tipo) para os eventos do período
    const artistasRes = await turso.execute({
      sql: "SELECT evento_id, nome, tipo FROM artistas_evento ORDER BY evento_id ASC, id ASC",
    });
    const artistasByEvento: Record<number, { nome: string; tipo: string }[]> = {};
    for (const r of artistasRes.rows) {
      const eid = Number(r.evento_id);
      if (!artistasByEvento[eid]) artistasByEvento[eid] = [];
      if (r.nome) artistasByEvento[eid].push({ nome: r.nome as string, tipo: (r.tipo as string) || '' });
    }

    // Normaliza qualquer formato de data para YYYY-MM-DD
    function normDate(raw: string): string {
      if (!raw) return '';
      const s = raw.trim();
      // DD/MM/YYYY → YYYY-MM-DD
      if (/^\d{2}\/\d{2}\/\d{4}$/.test(s)) {
        const [d, m, y] = s.split('/');
        return `${y}-${m}-${d}`;
      }
      // DD-MM-YYYY → YYYY-MM-DD
      if (/^\d{2}-\d{2}-\d{4}$/.test(s)) {
        const parts = s.split('-');
        if (parseInt(parts[0]) <= 31 && parseInt(parts[1]) <= 12) {
          return `${parts[2]}-${parts[1]}-${parts[0]}`;
        }
      }
      return s;
    }

    return {
      success: true,
      leads: leadsRes.rows.map((r: any) => ({
        ...r,
        title: r.title || r.project_name || r.event_name || '(sem título)',
        local: r.details ? extractField(r.details, 'Local') : (r.local || ''),
        contacto: r.details ? extractField(r.details, 'Contacto') : (r.contacto || ''),
        notas: r.details ? extractField(r.details, 'Notas') : (r.notas || ''),
        status_icon: r.status_icon || '🔵', value: r.value || 0,
        status: r.status || 'Contacto', // explícito para filtros no frontend
        event_date: normDate(r.event_date || ''),
        _raw_date: r.event_date || '',
      })),
      agendaAll: agendaAllRes.rows.map((r: any) => {
        // Título limpo — sem emoji artificial prefixado
        const eventTitle = (r.event_name as string) || '(sem título)';
        const cleanTitle = eventTitle.replace(/^\p{Emoji}[\p{Emoji}\u200d\s]*/u, '').trim();
        const artistas = artistasByEvento[Number(r.id)] || [];
        return { ...r, title: cleanTitle, hours: r.location || '', location: r.venue || '', staff: r.staff_needed || '', bill: r.client_cachet || 0, artists: r.artists || '', artistas };
      }),
    };
  } catch (error) {
    console.error("Erro Dashboard:", error);
    return { success: false, message: "Erro a carregar dados.", leads: [], agendaAll: [] };
  }
}

// ⚡ OTIMIZADO: Paginado com limite, sem SELECT * 
export async function getAgendaPaginated(userName: string = 'Admin', page: number = 1, pageSize: number = 50, filters?: { startDate?: string; endDate?: string; search?: string }) {
  noStore();
  try {
    const offset = (page - 1) * pageSize;
    
    // Build WHERE clause
    let whereClause = '';
    const args: any[] = [];
    
    if (userName === 'Larissa') {
      whereClause = "WHERE visibility = 'Public'";
    }
    
    if (filters?.startDate) {
      whereClause = whereClause ? whereClause + " AND event_date >= ?" : "WHERE event_date >= ?";
      args.push(filters.startDate);
    }
    
    if (filters?.endDate) {
      whereClause = whereClause ? whereClause + " AND event_date <= ?" : "WHERE event_date <= ?";
      args.push(filters.endDate);
    }
    
    if (filters?.search) {
      const search = `%${filters.search}%`;
      whereClause = whereClause ? whereClause + " AND (event_name LIKE ? OR cliente_nome LIKE ? OR venue LIKE ?)" : "WHERE (event_name LIKE ? OR cliente_nome LIKE ? OR venue LIKE ?)";
      args.push(search, search, search);
    }
    
    // Contagem total
    const countRes = await turso.execute({
      sql: `SELECT COUNT(*) as total FROM agenda ${whereClause}`,
      args,
    });
    const total = (countRes.rows[0] as any).total || 0;
    
    // Query de dados - apenas colunas necessárias
    const dataArgs = [...args, pageSize, offset];
    const sqlQuery = `
      SELECT id, event_name, event_date, location, staff_needed, client_cachet, status, visibility,
             billing_status, cliente_id, cliente_nome, modalidade, tipo_comercial, servico_comercial,
             valor_contexto, autobudget_snapshot, origem_lead_id, venue, contacto, notas, event_id, residencia_id
      FROM agenda
      ${whereClause}
      ORDER BY event_date ASC, id ASC
      LIMIT ? OFFSET ?
    `;
    
    const res = await turso.execute({ sql: sqlQuery, args: dataArgs });
    
    const data = res.rows.map((r: any) => ({
      ...r,
      id: r.id,
      title: r.event_name || '',
      time_range: r.location || '',
      tipo: r.staff_needed || '',
      bill: r.client_cachet || 0,
      cancelled: r.status === 'Cancelado' ? 1 : 0,
      billing_status: r.billing_status || '',
      cliente_id: r.cliente_id || null,
      cliente_nome: r.cliente_nome || '',
      modalidade: r.modalidade || 'Fatura',
      tipo_comercial: r.tipo_comercial || 'Evento',
      servico_comercial: r.servico_comercial || '',
      valor_contexto: r.valor_contexto || 'Cliente Final',
      autobudget_snapshot: r.autobudget_snapshot || '',
      origem_lead_id: r.origem_lead_id ? Number(r.origem_lead_id) : null,
      contacto: r.contacto || '',
      notas: r.notas || '',
      event_id: (r.event_id as string) || '',
      residencia_id: r.residencia_id == null ? null : Number(r.residencia_id),
    }));
    
    return {
      success: true,
      data,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  } catch (error) {
    console.error("Erro agenda paginada:", error);
    return { success: false, data: [], total: 0, page: 1, pageSize: 50, totalPages: 0 };
  }
}

// ⚡ OTIMIZADO: Apenas metadados de eventos (IDs, datas, títulos)
export async function getAgendaMetadata(userName: string = 'Admin') {
  noStore();
  try {
    let sqlQuery = "SELECT id, event_name, event_date, cliente_nome, origem_lead_id FROM agenda ORDER BY event_date ASC, id ASC";
    if (userName === 'Larissa') sqlQuery = "SELECT id, event_name, event_date, cliente_nome, origem_lead_id FROM agenda WHERE visibility = 'Public' ORDER BY event_date ASC, id ASC";

    const res = await turso.execute(sqlQuery);
    return {
      success: true,
      data: res.rows,
    };
  } catch (error) {
    console.error("Erro agenda metadata:", error);
    return { success: false, data: [] };
  }
}

// Mantém função original para compatibilidade (deprecated, usar getAgendaPaginated)
export async function getAllAgenda(userName: string = 'Admin', limit: number = 500) {
  noStore();
  try {
    let sqlQuery = "SELECT * FROM agenda ORDER BY event_date DESC, id DESC LIMIT ?";
    // Larissa mantém restrição anterior (só Public); Soraya e Tânia vêem tudo
    if (userName === 'Larissa') sqlQuery = "SELECT * FROM agenda WHERE visibility = 'Public' ORDER BY event_date DESC, id DESC LIMIT ?";

    const res = await turso.execute({ sql: sqlQuery, args: [limit] });
    return {
      success: true,
      data: res.rows.map((r: any) => {
        const eventTitle = r.event_name as string;
        // Guardar título limpo sem emoji automático
        const finalTitle = eventTitle;
        return {
          ...r, id: r.id, title: finalTitle, time_range: r.location || '', venue: r.venue || '',
          tipo: r.staff_needed || '', bill: r.client_cachet || 0,
          cancelled: r.status === 'Cancelado' ? 1 : 0,
          billing_status: r.billing_status || '', cliente_id: r.cliente_id || null,
          cliente_nome: r.cliente_nome || '', modalidade: r.modalidade || 'Fatura',
          tipo_comercial: r.tipo_comercial || 'Evento',
          servico_comercial: r.servico_comercial || '',
          valor_contexto: r.valor_contexto || 'Cliente Final',
          autobudget_snapshot: r.autobudget_snapshot || '',
          valor_recebido: Number(r.valor_recebido || 0),
          origem_lead_id: r.origem_lead_id ? Number(r.origem_lead_id) : null,
          contacto: r.contacto || '', notas: r.notas || '',
          event_id: (r.event_id as string) || '',
          residencia_id: r.residencia_id == null ? null : Number(r.residencia_id),
        };
      }),
    };
  } catch (error) {
    console.error("Erro agenda:", error);
    return { success: false, data: [] };
  }
}

export async function createAgendaEvent(data: {
  title: string; date: string; time: string; tipo: string; bill: number;
  billing_status?: string; cliente_id?: number | null; cliente_nome?: string; modalidade?: string;
  tipo_comercial?: string; servico_comercial?: string; valor_contexto?: string; autobudget_snapshot?: string;
  valor_recebido?: number;
  origem_lead_id?: number | null; venue?: string; contacto?: string; notas?: string; residencia_id?: number | null;
}) {
  try {
    await ensureCommercialColumns();
    // Se há origem_lead_id, partilhar o event_id da lead; caso contrário gerar novo
    let eventId = uuidv4();
    if (data.origem_lead_id) {
      const leadRow = await turso.execute({ sql: "SELECT event_id FROM leads WHERE id=?", args: [data.origem_lead_id] });
      const existingEid = (leadRow.rows[0] as any)?.event_id;
      if (existingEid) eventId = existingEid;
    }

    await turso.execute({
      sql: "INSERT INTO agenda (event_name, event_date, location, staff_needed, client_cachet, status, visibility, billing_status, cliente_id, cliente_nome, modalidade, tipo_comercial, servico_comercial, valor_contexto, autobudget_snapshot, valor_recebido, origem_lead_id, venue, contacto, notas, event_id, residencia_id) VALUES (?, ?, ?, ?, ?, 'Confirmado', 'Public', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      args: [data.title, data.date, data.time, data.tipo, data.bill, data.billing_status || 'Contacto', data.cliente_id ?? null, data.cliente_nome || '', data.modalidade || 'Fatura', data.tipo_comercial || 'Evento', data.servico_comercial || '', data.valor_contexto || 'Cliente Final', data.autobudget_snapshot || '', Number(data.valor_recebido || 0), data.origem_lead_id ?? null, data.venue || '', data.contacto || '', data.notas || '', eventId, data.residencia_id ?? null],
    });
    const last = await turso.execute("SELECT last_insert_rowid() as id");
    const newId = Number(last.rows[0].id);

    // Garantir que a lead também tem este event_id
    if (data.origem_lead_id) {
      await turso.execute({ sql: "UPDATE leads SET event_id=? WHERE id=?", args: [eventId, data.origem_lead_id] });
      // Migrar artistas da lead (guardados com evento_id negativo) para este evento
      await ensureArtistasColaboradorIdColumn();
      const leadArtistas = await turso.execute({
        sql: "SELECT nome, tipo, fee, colaborador_id FROM artistas_evento WHERE evento_id=?",
        args: [-data.origem_lead_id],
      });
      for (const a of leadArtistas.rows as any[]) {
        await turso.execute({
          sql: "INSERT INTO artistas_evento (evento_id, evento_nome, evento_data, colaborador_id, nome, tipo, fee) VALUES (?, ?, ?, ?, ?, ?, ?)",
          args: [newId, data.title, data.date, a.colaborador_id ?? null, a.nome, a.tipo, a.fee],
        });
      }
    }
    return { success: true, id: newId };
  } catch (error) {
    console.error("Erro criar evento:", error);
    return { success: false, message: "Erro ao criar evento.", id: null };
  }
}

export async function updateAgendaEvent(
  id: number,
  data: { title: string; date: string; time: string; tipo: string; bill: number; billing_status?: string; cliente_id?: number | null; cliente_nome?: string; modalidade?: string; tipo_comercial?: string; servico_comercial?: string; valor_contexto?: string; autobudget_snapshot?: string; valor_recebido?: number; venue?: string; contacto?: string; notas?: string; residencia_id?: number | null; }
) {
  try {
    await ensureCommercialColumns();
    await turso.execute({
      sql: "UPDATE agenda SET event_name=?, event_date=?, location=?, staff_needed=?, client_cachet=?, billing_status=?, cliente_id=?, cliente_nome=?, modalidade=?, tipo_comercial=?, servico_comercial=?, valor_contexto=?, autobudget_snapshot=?, valor_recebido=?, venue=?, contacto=?, notas=?, residencia_id=? WHERE id=?",
      args: [data.title, data.date, data.time, data.tipo, data.bill, data.billing_status || 'Contacto', data.cliente_id ?? null, data.cliente_nome || '', data.modalidade || 'Fatura', data.tipo_comercial || 'Evento', data.servico_comercial || '', data.valor_contexto || 'Cliente Final', data.autobudget_snapshot || '', Number(data.valor_recebido || 0), data.venue || '', data.contacto || '', data.notas || '', data.residencia_id ?? null, id],
    });

    // Obter event_id e origem_lead_id actuais
    const evRow = await turso.execute({ sql: "SELECT event_id, origem_lead_id, event_name, event_date FROM agenda WHERE id=?", args: [id] });
    const evData = evRow.rows[0] as any;
    let leadId = evData?.origem_lead_id ? Number(evData.origem_lead_id) : null;
    let eventId: string = evData?.event_id || '';

    // Auto-link: se ainda não tem FK, tentar encontrar lead com mesmo título+data
    if (!leadId) {
      const normTitle = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').trim();
      const match = await turso.execute({
        sql: "SELECT id, event_id FROM leads WHERE event_date=? AND LOWER(TRIM(title))=? AND status != 'Cancelado' LIMIT 1",
        args: [data.date, normTitle(data.title)],
      });
      if (match.rows.length > 0) {
        const matchRow = match.rows[0] as any;
        leadId = Number(matchRow.id);
        await turso.execute({ sql: "UPDATE agenda SET origem_lead_id=? WHERE id=?", args: [leadId, id] });
        // Partilhar event_id: usar o da lead se existir, senão usar o da agenda
        const leadEid = matchRow.event_id || '';
        if (leadEid && !eventId) {
          eventId = leadEid;
          await turso.execute({ sql: "UPDATE agenda SET event_id=? WHERE id=?", args: [eventId, id] });
        } else if (eventId && !leadEid) {
          await turso.execute({ sql: "UPDATE leads SET event_id=? WHERE id=?", args: [eventId, leadId] });
        }
      }
    }

    // Se não tem event_id ainda, gerar um
    if (!eventId) {
      eventId = uuidv4();
      await turso.execute({ sql: "UPDATE agenda SET event_id=? WHERE id=?", args: [eventId, id] });
    }

    // Propagar todos os campos para todos os registos com o mesmo event_id
    await propagateByEventId(eventId, {
      title: data.title, event_date: data.date, value: data.bill,
      status: data.billing_status || 'Contacto',
      cliente_id: data.cliente_id ?? null, cliente_nome: data.cliente_nome || '',
      modalidade: data.modalidade || 'Fatura',
      tipo_comercial: data.tipo_comercial || 'Evento',
      servico_comercial: data.servico_comercial || '',
      valor_contexto: data.valor_contexto || 'Cliente Final',
      autobudget_snapshot: data.autobudget_snapshot || '',
      valor_recebido: Number(data.valor_recebido || 0),
      local: data.venue || '', contacto: data.contacto || '', notas: data.notas || '',
      residencia_id: data.residencia_id ?? null,
    });

    // Fallback: se há leadId mas a lead ainda não tem event_id (dados antigos), sync directo por id
    if (leadId) {
      const leadCheck = await turso.execute({ sql: "SELECT event_id FROM leads WHERE id=?", args: [leadId] });
      const leadEid = (leadCheck.rows[0] as any)?.event_id || '';
      if (!leadEid || leadEid !== eventId) {
        // Dar o event_id correcto à lead e fazer sync directo
        await turso.execute({ sql: "UPDATE leads SET event_id=? WHERE id=?", args: [eventId, leadId] });
        await turso.execute({
          sql: "UPDATE leads SET title=?, event_date=?, value=?, status=?, cliente_id=?, client_name=?, modalidade=?, tipo_comercial=?, servico_comercial=?, valor_contexto=?, autobudget_snapshot=?, local=?, contacto=?, notas=?, residencia_id=? WHERE id=?",
          args: [data.title, data.date, data.bill, data.billing_status || 'Contacto', data.cliente_id ?? null, data.cliente_nome || '', data.modalidade || 'Fatura', data.tipo_comercial || 'Evento', data.servico_comercial || '', data.valor_contexto || 'Cliente Final', data.autobudget_snapshot || '', data.venue || '', data.contacto || '', data.notas || '', data.residencia_id ?? null, leadId],
        });
      }
    }

    return { success: true, leadId };
  } catch (error) {
    console.error("Erro editar evento:", error);
    return { success: false, message: "Erro ao editar evento.", leadId: null };
  }
}

export async function cancelAgendaEvent(id: number): Promise<{ success: boolean; message?: string }> {
  try {
    await turso.execute({ sql: "UPDATE agenda SET status='Cancelado', billing_status='Cancelado' WHERE id=?", args: [id] });
    // Propagar cancelamento para a lead ligada via event_id
    const row = await turso.execute({ sql: "SELECT event_id FROM agenda WHERE id=?", args: [id] });
    const eid = (row.rows[0] as any)?.event_id;
    if (eid) await turso.execute({ sql: "UPDATE leads SET status='Cancelado' WHERE event_id=?", args: [eid] });
    return { success: true };
  } catch (error) {
    console.error("Erro ao cancelar evento:", error);
    let msg = "Erro desconhecido.";
    if (error instanceof Error) msg = error.message;
    else if (typeof error === "string") msg = error;
    else { try { msg = JSON.stringify(error); } catch { msg = String(error); } }
    return { success: false, message: msg };
  }
}

export async function restoreAgendaEvent(id: number): Promise<{ success: boolean; message?: string }> {
  try {
    await turso.execute({ sql: "UPDATE agenda SET status='Confirmado', billing_status='Confirmado' WHERE id=?", args: [id] });
    // Propagar restauro para a lead ligada via event_id
    const row = await turso.execute({ sql: "SELECT event_id FROM agenda WHERE id=?", args: [id] });
    const eid = (row.rows[0] as any)?.event_id;
    if (eid) await turso.execute({ sql: "UPDATE leads SET status='Contacto' WHERE event_id=? AND status='Cancelado'", args: [eid] });
    return { success: true };
  } catch (error) {
    console.error("Erro ao repor evento:", error);
    return { success: false, message: error instanceof Error ? error.message : "Erro ao repor evento." };
  }
}

export async function deleteAgendaEvent(id: number) {
  try {
    await turso.execute({ sql: "DELETE FROM agenda WHERE id=?", args: [id] });
    await turso.execute({ sql: "DELETE FROM artistas_evento WHERE evento_id=?", args: [id] });
    return { success: true };
  } catch { return { success: false }; }
}

// ── ARTISTAS POR EVENTO ───────────────────────────────────────────────────────

type ArtistaPayload = { nome: string; tipo: string; fee: number; colaborador_id?: number | null };

async function ensureArtistasColaboradorIdColumn() {
  try { await turso.execute("ALTER TABLE artistas_evento ADD COLUMN colaborador_id INTEGER"); } catch { }
}

// ⚡ OTIMIZADO: Lazy-load artistas de um evento específico


// Mantém getAllArtistasAgenda para compatibilidade mas comentado como deprecated
export async function getAllArtistasAgenda(): Promise<{ success: boolean; data: Record<number, { id: number; nome: string; tipo: string; fee: number; colaborador_id: number | null }[]> }> {
  try {
    await ensureArtistasColaboradorIdColumn();
    const res = await turso.execute("SELECT id, evento_id, nome, tipo, fee, colaborador_id FROM artistas_evento ORDER BY evento_id ASC, id ASC");
    const map: Record<number, { id: number; nome: string; tipo: string; fee: number; colaborador_id: number | null }[]> = {};
    for (const r of res.rows as any[]) {
      const eid = Number(r.evento_id);
      if (!map[eid]) map[eid] = [];
      map[eid].push({ id: Number(r.id), nome: r.nome as string, tipo: r.tipo as string, fee: Number(r.fee), colaborador_id: r.colaborador_id == null ? null : Number(r.colaborador_id) });
    }
    return { success: true, data: map };
  } catch (error) {
    console.error("Erro getAllArtistasAgenda:", error);
    return { success: false, data: {} };
  }
}

// Sync artistas de um evento de agenda para o lado da lead (evento_id negativo)
export async function syncArtistasParaLead(leadId: number, eventoNome: string, eventoData: string, artistas: ArtistaPayload[]) {
  try {
    await ensureArtistasColaboradorIdColumn();
    await turso.execute({ sql: "DELETE FROM artistas_evento WHERE evento_id=?", args: [-leadId] });
    for (const a of artistas) {
      if (!a.nome.trim()) continue;
      await turso.execute({
        sql: "INSERT INTO artistas_evento (evento_id, evento_nome, evento_data, colaborador_id, nome, tipo, fee) VALUES (?, ?, ?, ?, ?, ?, ?)",
        args: [-leadId, eventoNome, eventoData, a.colaborador_id ?? null, a.nome.trim(), a.tipo, a.fee],
      });
    }
    return { success: true };
  } catch (error) {
    console.error("Erro sync artistas lead:", error);
    return { success: false };
  }
}

export async function getArtistasEvento(eventoId: number) {
  try {
    await ensureArtistasColaboradorIdColumn();
    const res = await turso.execute({
      sql: "SELECT * FROM artistas_evento WHERE evento_id=? ORDER BY id ASC",
      args: [eventoId],
    });
    return {
      success: true,
      data: res.rows.map((r: any) => ({
        id: Number(r.id), evento_id: Number(r.evento_id),
        evento_nome: r.evento_nome as string, evento_data: r.evento_data as string,
        colaborador_id: r.colaborador_id == null ? null : Number(r.colaborador_id),
        nome: r.nome as string, tipo: r.tipo as string, fee: Number(r.fee),
      }))
    };
  } catch (error) {
    console.error("Erro artistas evento:", error);
    return { success: false, data: [] };
  }
}

export async function syncArtistasEvento(eventoId: number, eventoNome: string, eventoData: string, artistas: ArtistaPayload[]) {
  try {
    await ensureArtistasColaboradorIdColumn();
    await turso.execute({ sql: "DELETE FROM artistas_evento WHERE evento_id=?", args: [eventoId] });
    for (const a of artistas) {
      if (!a.nome.trim()) continue;
      await turso.execute({
        sql: "INSERT INTO artistas_evento (evento_id, evento_nome, evento_data, colaborador_id, nome, tipo, fee) VALUES (?, ?, ?, ?, ?, ?, ?)",
        args: [eventoId, eventoNome, eventoData, a.colaborador_id ?? null, a.nome.trim(), a.tipo, a.fee],
      });
    }
    return { success: true };
  } catch (error) {
    console.error("Erro sync artistas:", error);
    return { success: false };
  }
}

// Sync artistas de uma lead para o evento de agenda ligado (por origem_lead_id)
export async function syncArtistasParaAgenda(leadId: number, eventoNome: string, eventoData: string, artistas: ArtistaPayload[]) {
  try {
    await ensureArtistasColaboradorIdColumn();
    const linked = await turso.execute({
      sql: "SELECT id FROM agenda WHERE origem_lead_id=?",
      args: [leadId],
    });
    if (!linked.rows.length) return { success: true }; // sem evento ligado, nada a fazer
    const agendaEventId = Number((linked.rows[0] as any).id);
    await turso.execute({ sql: "DELETE FROM artistas_evento WHERE evento_id=?", args: [agendaEventId] });
    for (const a of artistas) {
      if (!a.nome.trim()) continue;
      await turso.execute({
        sql: "INSERT INTO artistas_evento (evento_id, evento_nome, evento_data, colaborador_id, nome, tipo, fee) VALUES (?, ?, ?, ?, ?, ?, ?)",
        args: [agendaEventId, eventoNome, eventoData, a.colaborador_id ?? null, a.nome.trim(), a.tipo, a.fee],
      });
    }
    return { success: true };
  } catch (error) {
    console.error("Erro sync artistas agenda:", error);
    return { success: false };
  }
}



export async function getAllPagamentos(limit: number = 500) {
  try {
    const sql = "SELECT ae.*, a.status as evento_status, a.client_cachet as evento_cachet FROM artistas_evento ae LEFT JOIN agenda a ON ae.evento_id = a.id ORDER BY ae.evento_data DESC, ae.id DESC LIMIT ?";
    const res = await turso.execute({ sql, args: [limit] });
    const rows = res.rows as any[];
    const materialFinance = await getMaterialFinanceMapForEventIds(Array.from(new Set(rows.map((r: any) => Number(r.evento_id)).filter(Boolean))));
    return {
      success: true,
      data: rows.map((r: any) => ({
        id: Number(r.id), evento_id: Number(r.evento_id),
        evento_nome: r.evento_nome as string, evento_data: r.evento_data as string,
        colaborador_id: r.colaborador_id == null ? null : Number(r.colaborador_id),
        nome: r.nome as string, tipo: r.tipo as string, fee: Number(r.fee),
        evento_status: r.evento_status as string,
        evento_cachet: Number(r.evento_cachet) || 0,
        evento_material_custo: materialFinance[Number(r.evento_id)]?.material_cost || 0,
      })),
    };
  } catch (error) {
    console.error("Erro pagamentos:", error);
    return { success: false, data: [] };
  }
}

export async function updatePagamento(id: number, data: { nome: string; tipo: string; fee: number }) {
  try {
    await turso.execute({
      sql: "UPDATE artistas_evento SET nome=?, tipo=?, fee=? WHERE id=?",
      args: [data.nome, data.tipo, data.fee, id],
    });
    return { success: true };
  } catch { return { success: false }; }
}

export async function deletePagamento(id: number) {
  try {
    await turso.execute({ sql: "DELETE FROM artistas_evento WHERE id=?", args: [id] });
    return { success: true };
  } catch { return { success: false }; }
}

export async function addPagamento(data: { evento_id: number; evento_nome: string; evento_data: string; nome: string; tipo: string; fee: number }) {
  try {
    await turso.execute({
      sql: "INSERT INTO artistas_evento (evento_id, evento_nome, evento_data, nome, tipo, fee) VALUES (?, ?, ?, ?, ?, ?)",
      args: [data.evento_id, data.evento_nome, data.evento_data, data.nome, data.tipo, data.fee],
    });
    return { success: true };
  } catch { return { success: false }; }
}

// ── LEADS ─────────────────────────────────────────────────────────────────────

export async function getAllLeads(limit: number = 500) {
  noStore();
  try {
    const sql = "SELECT l.*, (SELECT a.id FROM agenda a WHERE a.origem_lead_id = l.id LIMIT 1) as agenda_event_id FROM leads l ORDER BY COALESCE(l.event_date, '9999-99-99') DESC, l.id DESC LIMIT ?";
    const res = await turso.execute({ sql, args: [limit] });
    return {
      success: true,
      data: res.rows.map((r: any) => ({
        ...r, id: r.id,
        title: r.title || r.project_name || r.event_name || '(sem título)',
        event_date: r.event_date || '', value: r.value || 0,
        status: r.status || 'Contacto', status_icon: r.status_icon || '',
        local: r.details ? extractField(r.details, 'Local') : (r.local || ''),
        contacto: r.details ? extractField(r.details, 'Contacto') : (r.contacto || ''),
        notas: r.details ? extractField(r.details, 'Notas') : (r.notas || ''),
        cancelled: r.status === 'Cancelado' ? 1 : 0,
        cliente_id: r.cliente_id || null, cliente_nome: (r.client_name as string) || '',
        modalidade: r.modalidade || 'Fatura',
        tipo_comercial: r.tipo_comercial || 'Evento',
        servico_comercial: r.servico_comercial || '',
        valor_contexto: r.valor_contexto || 'Cliente Final',
        autobudget_snapshot: r.autobudget_snapshot || '',
        valor_recebido: Number(r.valor_recebido || 0),
        agenda_event_id: r.agenda_event_id ? Number(r.agenda_event_id) : null,
        event_id: (r.event_id as string) || '',
        residencia_id: r.residencia_id == null ? null : Number(r.residencia_id),
      }))
    };
  } catch (error) {
    console.error("Erro leads:", error);
    return { success: false, data: [] };
  }
}

export async function createLead(data: {
  title: string; event_date: string; value: number; status: string;
  cliente_id?: number | null; cliente_nome?: string; modalidade?: string;
  tipo_comercial?: string; servico_comercial?: string; valor_contexto?: string; autobudget_snapshot?: string;
  local?: string; contacto?: string; notas?: string; residencia_id?: number | null;
  valor_recebido?: number;
}) {
  try {
    await ensureCommercialColumns();
    const eventId = uuidv4();
    await turso.execute({
      sql: "INSERT INTO leads (title, event_date, value, status, cliente_id, client_name, modalidade, tipo_comercial, servico_comercial, valor_contexto, autobudget_snapshot, valor_recebido, local, contacto, notas, event_id, residencia_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      args: [data.title, data.event_date, data.value, data.status, data.cliente_id ?? null, data.cliente_nome || '', data.modalidade || 'Fatura', data.tipo_comercial || 'Evento', data.servico_comercial || '', data.valor_contexto || 'Cliente Final', data.autobudget_snapshot || '', Number(data.valor_recebido || 0), data.local || '', data.contacto || '', data.notas || '', eventId, data.residencia_id ?? null],
    });
    const last = await turso.execute("SELECT last_insert_rowid() as id");
    return { success: true, id: Number(last.rows[0].id), event_id: eventId };
  } catch (error) {
    console.error("Erro criar lead:", error);
    return { success: false, message: "Erro ao criar lead." };
  }
}

export async function updateLead(
  id: number,
  data: { title: string; event_date: string; value: number; status: string; cliente_id?: number | null; cliente_nome?: string; modalidade?: string; tipo_comercial?: string; servico_comercial?: string; valor_contexto?: string; autobudget_snapshot?: string; valor_recebido?: number; local?: string; contacto?: string; notas?: string; residencia_id?: number | null; }
) {
  try {
    await ensureCommercialColumns();
    await turso.execute({
      sql: "UPDATE leads SET title=?, event_date=?, value=?, status=?, cliente_id=?, client_name=?, modalidade=?, tipo_comercial=?, servico_comercial=?, valor_contexto=?, autobudget_snapshot=?, valor_recebido=?, local=?, contacto=?, notas=?, residencia_id=? WHERE id=?",
      args: [data.title, data.event_date, data.value, data.status, data.cliente_id ?? null, data.cliente_nome || '', data.modalidade || 'Fatura', data.tipo_comercial || 'Evento', data.servico_comercial || '', data.valor_contexto || 'Cliente Final', data.autobudget_snapshot || '', Number(data.valor_recebido || 0), data.local || '', data.contacto || '', data.notas || '', data.residencia_id ?? null, id],
    });

    // Garantir que esta lead tem event_id
    const leadRow = await turso.execute({ sql: "SELECT event_id FROM leads WHERE id=?", args: [id] });
    let eventId: string = (leadRow.rows[0] as any)?.event_id || '';
    if (!eventId) {
      eventId = uuidv4();
      await turso.execute({ sql: "UPDATE leads SET event_id=? WHERE id=?", args: [eventId, id] });
    }

    // Propagar todos os campos via event_id (inclui agenda ligada)
    await propagateByEventId(eventId, {
      title: data.title, event_date: data.event_date, value: data.value,
      status: data.status, cliente_id: data.cliente_id ?? null,
      cliente_nome: data.cliente_nome || '', modalidade: data.modalidade || 'Fatura',
      tipo_comercial: data.tipo_comercial || 'Evento',
      servico_comercial: data.servico_comercial || '',
      valor_contexto: data.valor_contexto || 'Cliente Final',
      autobudget_snapshot: data.autobudget_snapshot || '',
      valor_recebido: Number(data.valor_recebido || 0),
      local: data.local || '', contacto: data.contacto || '', notas: data.notas || '',
      residencia_id: data.residencia_id ?? null,
    });

    // Fallback: sync directo para eventos de agenda ligados por origem_lead_id que ainda não têm event_id
    const linkedByFk = await turso.execute({
      sql: "SELECT id, event_id FROM agenda WHERE origem_lead_id=?",
      args: [id],
    });
    for (const row of linkedByFk.rows as any[]) {
      const agEid = (row as any).event_id || '';
      if (!agEid || agEid !== eventId) {
        await turso.execute({ sql: "UPDATE agenda SET event_id=? WHERE id=?", args: [eventId, (row as any).id] });
        await turso.execute({
          sql: "UPDATE agenda SET event_name=?, event_date=?, client_cachet=?, billing_status=?, cliente_id=?, cliente_nome=?, modalidade=?, tipo_comercial=?, servico_comercial=?, valor_contexto=?, autobudget_snapshot=?, venue=?, contacto=?, notas=?, residencia_id=? WHERE id=?",
          args: [data.title, data.event_date, data.value, data.status, data.cliente_id ?? null, data.cliente_nome || '', data.modalidade || 'Fatura', data.tipo_comercial || 'Evento', data.servico_comercial || '', data.valor_contexto || 'Cliente Final', data.autobudget_snapshot || '', data.local || '', data.contacto || '', data.notas || '', data.residencia_id ?? null, (row as any).id],
        });
      }
    }

    // Auto-link + sync para eventos antigos sem origem_lead_id (match por data+título)
    const normTitle = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').trim();
    const unlinked = await turso.execute({
      sql: "SELECT id, event_id FROM agenda WHERE (origem_lead_id IS NULL OR origem_lead_id != ?) AND event_date=? AND LOWER(TRIM(event_name))=?",
      args: [id, data.event_date, normTitle(data.title)],
    });
    for (const row of unlinked.rows as any[]) {
      // Ligar e partilhar event_id
      await turso.execute({
        sql: "UPDATE agenda SET origem_lead_id=?, event_id=?, event_name=?, client_cachet=?, billing_status=?, cliente_id=?, cliente_nome=?, modalidade=?, tipo_comercial=?, servico_comercial=?, valor_contexto=?, autobudget_snapshot=?, venue=?, contacto=?, notas=?, residencia_id=? WHERE id=?",
        args: [id, eventId, data.title, data.value, data.status, data.cliente_id ?? null, data.cliente_nome || '', data.modalidade || 'Fatura', data.tipo_comercial || 'Evento', data.servico_comercial || '', data.valor_contexto || 'Cliente Final', data.autobudget_snapshot || '', data.local || '', data.contacto || '', data.notas || '', data.residencia_id ?? null, row.id],
      });
    }

    // Sync artistas: lead (evento_id negativo) → evento de agenda ligado
    const linkedEv = await turso.execute({ sql: "SELECT id FROM agenda WHERE origem_lead_id=?", args: [id] });
    if (linkedEv.rows.length > 0) {
      const agendaEventId = Number((linkedEv.rows[0] as any).id);
      const leadArtistas = await turso.execute({ sql: "SELECT nome, tipo, fee FROM artistas_evento WHERE evento_id=?", args: [-id] });
      if (leadArtistas.rows.length > 0) {
        await turso.execute({ sql: "DELETE FROM artistas_evento WHERE evento_id=?", args: [agendaEventId] });
        for (const a of leadArtistas.rows as any[]) {
          await turso.execute({
            sql: "INSERT INTO artistas_evento (evento_id, evento_nome, evento_data, nome, tipo, fee) VALUES (?, ?, ?, ?, ?, ?)",
            args: [agendaEventId, data.title, data.event_date, a.nome, a.tipo, a.fee],
          });
        }
      }
    }

    return { success: true };
  } catch (error) {
    console.error("Erro editar lead:", JSON.stringify(error));
    return { success: false, message: String(error) };
  }
}

export async function cancelLead(id: number) {
  try {
    await turso.execute({ sql: "UPDATE leads SET status='Cancelado' WHERE id=?", args: [id] });
    // Propagar cancelamento para evento de agenda ligado via event_id
    const row = await turso.execute({ sql: "SELECT event_id FROM leads WHERE id=?", args: [id] });
    const eid = (row.rows[0] as any)?.event_id;
    if (eid) await turso.execute({ sql: "UPDATE agenda SET billing_status='Cancelado', status='Cancelado' WHERE event_id=?", args: [eid] });
    return { success: true };
  } catch { return { success: false }; }
}

export async function restoreLead(id: number) {
  try {
    await turso.execute({ sql: "UPDATE leads SET status='Contacto' WHERE id=?", args: [id] });
    // Propagar restauro para evento de agenda ligado via event_id
    const row = await turso.execute({ sql: "SELECT event_id FROM leads WHERE id=?", args: [id] });
    const eid = (row.rows[0] as any)?.event_id;
    if (eid) await turso.execute({ sql: "UPDATE agenda SET status='Confirmado', billing_status='Contacto' WHERE event_id=? AND status='Cancelado'", args: [eid] });
    return { success: true };
  } catch { return { success: false }; }
}

export async function deleteLead(id: number) {
  try {
    await turso.execute({ sql: "DELETE FROM leads WHERE id=?", args: [id] });
    return { success: true };
  } catch { return { success: false }; }
}

// ── CLIENTES ──────────────────────────────────────────────────────────────────

export async function getAllClientes() {
  noStore();
  try {
    // Ensure alias column exists
    try { await turso.execute("ALTER TABLE clientes ADD COLUMN alias TEXT DEFAULT ''"); } catch {}
    const res = await turso.execute("SELECT * FROM clientes ORDER BY nome ASC");
    return { success: true, data: res.rows.map((r: any) => ({ ...r })) };
  } catch (error) {
    console.error("Erro clientes:", error);
    return { success: false, data: [] };
  }
}

export async function createCliente(data: { nome: string; nif?: string; email?: string; telefone?: string; notas?: string; alias?: string }) {
  try {
    await turso.execute({
      sql: "INSERT INTO clientes (nome, nif, email, telefone, notas, alias) VALUES (?, ?, ?, ?, ?, ?)",
      args: [data.nome, data.nif || '', data.email || '', data.telefone || '', data.notas || '', data.alias || ''],
    });
    const last = await turso.execute("SELECT last_insert_rowid() as id");
    return { success: true, id: Number(last.rows[0].id) };
  } catch (error) {
    console.error("Erro criar cliente:", error);
    return { success: false, message: "Erro ao criar cliente." };
  }
}

export async function updateCliente(id: number, data: { nome: string; nif?: string; email?: string; telefone?: string; notas?: string; alias?: string }) {
  try {
    await turso.execute({
      sql: "UPDATE clientes SET nome=?, nif=?, email=?, telefone=?, notas=?, alias=? WHERE id=?",
      args: [data.nome, data.nif || '', data.email || '', data.telefone || '', data.notas || '', data.alias || '', id],
    });
    return { success: true };
  } catch { return { success: false }; }
}

export async function deleteCliente(id: number) {
  try {
    await turso.execute({ sql: "DELETE FROM clientes WHERE id=?", args: [id] });
    return { success: true };
  } catch { return { success: false }; }
}

// ── FATURAÇÃO ─────────────────────────────────────────────────────────────────

export async function getFaturacaoData() {
  try {
    const ESTADOS_FATURACAO = ['Confirmado', 'Em Adjudicação', 'Adjudicado', 'Faturado', 'Pago', 'Cancelado'];
    const placeholders = ESTADOS_FATURACAO.map(() => '?').join(',');
    const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

    const agendaRes = await turso.execute({
      sql: `SELECT id, event_name, event_date, client_cachet, billing_status, cliente_id, cliente_nome, status, modalidade, COALESCE(valor_recebido, 0) as valor_recebido, origem_lead_id
            FROM agenda
            WHERE billing_status IN (${placeholders})
              AND COALESCE(cliente_nome, '') != ''
              AND (event_date <= ? OR billing_status IN ('Faturado', 'Pago', 'Cancelado') OR COALESCE(valor_recebido, 0) > 0)
            ORDER BY event_date ASC`,
      args: [...ESTADOS_FATURACAO, today],
    });

    const leadsRes = await turso.execute({
      sql: `SELECT id, title, event_date, value, status, cliente_id, client_name, modalidade, COALESCE(valor_recebido, 0) as valor_recebido
            FROM leads
            WHERE status IN (${placeholders})
              AND COALESCE(client_name, '') != ''
              AND (event_date <= ? OR event_date IS NULL OR event_date = '' OR status IN ('Faturado', 'Pago', 'Cancelado') OR COALESCE(valor_recebido, 0) > 0)
            ORDER BY event_date ASC`,
      args: [...ESTADOS_FATURACAO, today],
    });

    const agendaItems = agendaRes.rows.map((r: any) => ({
      id: Number(r.id), origem: 'agenda' as const,
      descricao: r.event_name as string, data: (r.event_date as string) || '',
      valor: Number(r.client_cachet) || 0, billing_status: (r.billing_status as string) || 'Confirmado',
      cliente_id: r.cliente_id ? Number(r.cliente_id) : null, cliente_nome: (r.cliente_nome as string) || '',
      modalidade: (r.modalidade as string) || 'Fatura',
      valor_recebido: Number(r.valor_recebido) || 0,
      origem_lead_id: r.origem_lead_id ? Number(r.origem_lead_id) : null,
    }));

    // Deduplicação Lead → Agenda:
    // Critério primário: origem_lead_id (FK directa — imune a mudanças de título)
    // Critério fallback (leads antigas sem FK): data+título OU data+valor
    function normTitle(s: string) { return s.toLowerCase().replace(/\s+/g, ' ').trim(); }

    const agendaLinkedLeadIds = new Set(agendaItems.filter(i => i.origem_lead_id).map(i => i.origem_lead_id!));
    const agendaTitleKeys = new Set(agendaItems.map(i => `${i.data}||${normTitle(i.descricao)}`));

    // Agenda items com estado terminal (Pago/Faturado) por date+valor — para suprimir leads duplicadas
    const agendaTerminalDateVal = new Set(
      agendaItems
        .filter(i => i.billing_status === 'Pago' || i.billing_status === 'Faturado')
        .filter(i => i.valor > 0)
        .map(i => `${i.data}||${i.valor}`)
    );
    // Todos os agenda date+valor (para dedup geral, independente de estado)
    const agendaAllDateVal = new Set(
      agendaItems
        .filter(i => i.valor > 0)
        .map(i => `${i.data}||${i.valor}`)
    );

    const leadsItems = leadsRes.rows
      .map((r: any) => ({
        id: Number(r.id), origem: 'lead' as const,
        descricao: r.title as string, data: (r.event_date as string) || '',
        valor: Number(r.value) || 0, billing_status: (r.status as string) || 'Confirmado',
        cliente_id: r.cliente_id ? Number(r.cliente_id) : null, cliente_nome: (r.client_name as string) || '',
        modalidade: (r.modalidade as string) || 'Fatura',
        valor_recebido: Number(r.valor_recebido) || 0,
      }))
      .filter(l => {
        // Critério primário: lead já tem evento na agenda com origem_lead_id = l.id
        if (agendaLinkedLeadIds.has(l.id)) return false;
        // Fallback: Excluir lead se já existe evento de Agenda com mesmo título exacto na mesma data
        if (agendaTitleKeys.has(`${l.data}||${normTitle(l.descricao)}`)) return false;
        // Fallback: Excluir lead se já existe evento de Agenda com mesmo date+valor
        if (l.valor > 0 && agendaAllDateVal.has(`${l.data}||${l.valor}`)) return false;
        // Fallback: Excluir lead se evento correspondente na Agenda já está Pago ou Faturado
        if (l.valor > 0 && agendaTerminalDateVal.has(`${l.data}||${l.valor}`)) return false;
        return true;
      });

    const allItems = [...agendaItems, ...leadsItems];

    // Fetch clientes to resolve aliases and normalise grouping keys
    const clientesRes = await turso.execute("SELECT id, nome, alias FROM clientes ORDER BY nome ASC");
    const clientesMap: Record<number, { nome: string; alias: string }> = {};
    for (const c of clientesRes.rows as any[]) {
      clientesMap[Number(c.id)] = { nome: c.nome as string, alias: (c.alias as string) || '' };
    }

    // Group key: prefer cliente_id (immune to typos), fallback to trimmed name
    // Display key: alias if set, otherwise nome
    function groupKey(item: typeof allItems[number]): string {
      if (item.cliente_id) return `id:${item.cliente_id}`;
      return `nome:${item.cliente_nome.trim()}`;
    }
    function displayKey(item: typeof allItems[number]): string {
      if (item.cliente_id && clientesMap[item.cliente_id]) {
        const c = clientesMap[item.cliente_id];
        return c.alias?.trim() || c.nome;
      }
      return item.cliente_nome.trim();
    }

    const grouped: Record<string, typeof allItems> = {};
    const groupedDisplayKey: Record<string, string> = {};
    for (const item of allItems) {
      const key = groupKey(item);
      const display = displayKey(item);
      if (!grouped[key]) { grouped[key] = []; groupedDisplayKey[key] = display; }
      grouped[key].push(item);
    }

    // Re-key by display name for frontend compatibility
    const groupedByDisplay: Record<string, typeof allItems> = {};
    for (const [key, items] of Object.entries(grouped)) {
      const display = groupedDisplayKey[key];
      if (!groupedByDisplay[display]) groupedByDisplay[display] = [];
      groupedByDisplay[display].push(...items);
    }

    return { success: true, grouped: groupedByDisplay };
  } catch (error) {
    console.error("Erro faturação:", error);
    return { success: false, grouped: {} };
  }
}

// Helper: dado um agenda id, devolve o lead_id ligado (por FK ou por auto-link título+data)
async function resolveLinkedLeadId(agendaId: number): Promise<number | null> {
  const row = await turso.execute({ sql: "SELECT origem_lead_id, event_name, event_date FROM agenda WHERE id=?", args: [agendaId] });
  if (!row.rows.length) return null;
  const r = row.rows[0] as any;
  if (r.origem_lead_id) return Number(r.origem_lead_id);
  const normTitle = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').trim();
  const match = await turso.execute({
    sql: "SELECT id FROM leads WHERE event_date=? AND LOWER(TRIM(title))=? AND status != 'Cancelado' LIMIT 1",
    args: [r.event_date, normTitle(r.event_name || '')],
  });
  if (match.rows.length > 0) {
    const leadId = Number((match.rows[0] as any).id);
    await turso.execute({ sql: "UPDATE agenda SET origem_lead_id=? WHERE id=?", args: [leadId, agendaId] });
    return leadId;
  }
  return null;
}

export async function updateItemBillingStatus(origem: 'agenda' | 'lead', id: number, billing_status: string) {
  try {
    if (origem === 'agenda') {
      const current = await turso.execute({ sql: "SELECT event_id, client_cachet, COALESCE(valor_recebido,0) AS valor_recebido FROM agenda WHERE id=?", args: [id] });
      const row = current.rows[0] as any;
      const valorRecebido = billing_status === 'Pago' ? Number(row?.client_cachet || 0) : Number(row?.valor_recebido || 0);
      await turso.execute({ sql: "UPDATE agenda SET billing_status=?, valor_recebido=? WHERE id=?", args: [billing_status, valorRecebido, id] });
      const eid = row?.event_id;
      if (eid) await propagateByEventId(eid, { status: billing_status, valor_recebido: valorRecebido });
    } else {
      const current = await turso.execute({ sql: "SELECT event_id, value, COALESCE(valor_recebido,0) AS valor_recebido FROM leads WHERE id=?", args: [id] });
      const row = current.rows[0] as any;
      const valorRecebido = billing_status === 'Pago' ? Number(row?.value || 0) : Number(row?.valor_recebido || 0);
      await turso.execute({ sql: "UPDATE leads SET status=?, valor_recebido=? WHERE id=?", args: [billing_status, valorRecebido, id] });
      const eid = row?.event_id;
      if (eid) await propagateByEventId(eid, { status: billing_status, valor_recebido: valorRecebido });
    }
    return { success: true };
  } catch (error) {
    console.error("Erro atualizar billing status:", error);
    return { success: false };
  }
}

export async function updateValorRecebido(origem: 'agenda' | 'lead', id: number, valor: number) {
  try {
    if (origem === 'agenda') {
      await turso.execute({ sql: "UPDATE agenda SET valor_recebido=? WHERE id=?", args: [valor, id] });
      const row = await turso.execute({ sql: "SELECT event_id FROM agenda WHERE id=?", args: [id] });
      const eid = (row.rows[0] as any)?.event_id;
      if (eid) await propagateByEventId(eid, { valor_recebido: valor });
    } else {
      await turso.execute({ sql: "UPDATE leads SET valor_recebido=? WHERE id=?", args: [valor, id] });
      const row = await turso.execute({ sql: "SELECT event_id FROM leads WHERE id=?", args: [id] });
      const eid = (row.rows[0] as any)?.event_id;
      if (eid) await propagateByEventId(eid, { valor_recebido: valor });
    }
    return { success: true };
  } catch (error) {
    console.error("Erro atualizar valor recebido:", error);
    return { success: false };
  }
}

// ── COLABORADORES ─────────────────────────────────────────────────────────────

export async function setupColaboradores() {
  try {
    await turso.execute(`
      CREATE TABLE IF NOT EXISTS colaboradores (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nome TEXT NOT NULL,
        nome_artistico TEXT DEFAULT '',
        nome_pessoal TEXT DEFAULT '',
        contacto TEXT DEFAULT '',
        email TEXT DEFAULT '',
        iban TEXT DEFAULT '',
        skills TEXT DEFAULT '',
        notas TEXT DEFAULT '',
        ativo INTEGER DEFAULT 1,
        created_at TEXT DEFAULT (datetime('now'))
      )
    `);
    await ensureColaboradoresExtendedColumns();
    await normalizeExistingColaboradorSkills();
    // Adicionar coluna colaborador_id a artistas_evento se não existir
    try { await turso.execute("ALTER TABLE artistas_evento ADD COLUMN colaborador_id INTEGER"); } catch { }
    return { success: true };
  } catch (error) {
    console.error("Erro setup colaboradores:", error);
    return { success: false };
  }
}

export async function getAllColaboradores() {
  try {
    await ensureColaboradoresExtendedColumns();
    await normalizeExistingColaboradorSkills();
    const [res, profiles] = await Promise.all([
      turso.execute("SELECT * FROM colaboradores ORDER BY COALESCE(NULLIF(nome_artistico, ''), nome) ASC"),
      turso.execute(`SELECT colaborador_id, skill, valor, custo_interno, custo_evento,
                            valor_sud, valor_evento_residencia, valor_parceria, valor_cliente_final,
                            custo_sud, custo_evento_residencia, custo_parceria, custo_cliente_final, rating
                     FROM colaborador_skill_profiles ORDER BY skill ASC`),
    ]);
    const profileMap: Record<number, Record<string, {
      valor: number; custo_interno: number; custo_evento: number;
      valor_sud: number; valor_evento_residencia: number;
      valor_parceria: number; valor_cliente_final: number;
      custo_sud: number; custo_evento_residencia: number; custo_parceria: number; custo_cliente_final: number;
      rating: number;
    }>> = {};
    for (const r of profiles.rows as any[]) {
      const id = Number(r.colaborador_id);
      if (!profileMap[id]) profileMap[id] = {};
      const legacyValor = Number(r.valor || 0);
      const custoEvento = Number(r.custo_evento || r.custo_interno || legacyValor || 0);
      profileMap[id][String(r.skill || '')] = {
        valor: legacyValor,
        custo_interno: custoEvento,
        custo_evento: custoEvento,
        valor_sud: Number(r.valor_sud || r.custo_sud || 0),
        valor_evento_residencia: Number(r.valor_evento_residencia || r.custo_evento_residencia || 0),
        valor_parceria: Number(r.valor_parceria || r.custo_parceria || 0),
        valor_cliente_final: Number(r.valor_cliente_final || r.custo_cliente_final || 0),
        // aliases legados para versões antigas do frontend
        custo_sud: Number(r.custo_sud || r.valor_sud || 0),
        custo_evento_residencia: Number(r.custo_evento_residencia || r.valor_evento_residencia || 0),
        custo_parceria: Number(r.custo_parceria || r.valor_parceria || 0),
        custo_cliente_final: Number(r.custo_cliente_final || r.valor_cliente_final || 0),
        rating: Math.max(0, Math.min(5, Number(r.rating || 0))),
      };
    }
    return {
      success: true,
      data: res.rows.map((r: any) => ({
        id: Number(r.id),
        nome: ((r.nome_artistico as string) || (r.nome as string) || '') as string,
        nome_artistico: ((r.nome_artistico as string) || (r.nome as string) || '') as string,
        nome_pessoal: (r.nome_pessoal as string) || '',
        contacto: (r.contacto as string) || '',
        email: (r.email as string) || '',
        iban: (r.iban as string) || '',
        skills: (r.skills as string) || '',
        notas: (r.notas as string) || '',
        restricoes_alimentares: (r.restricoes_alimentares as string) || '',
        tamanho_cima: (r.tamanho_cima as string) || '',
        tamanho_baixo: (r.tamanho_baixo as string) || '',
        calcado: (r.calcado as string) || '',
        skill_profiles: profileMap[Number(r.id)] || {},
        ativo: r.ativo === 1 || r.ativo === true ? 1 : 0,
      }))
    };
  } catch (error) {
    console.error("Erro getAllColaboradores:", error);
    return { success: false, data: [] };
  }
}

type ColaboradorSkillProfileInput = Record<string, {
  valor?: number | string;
  custo_interno?: number | string; custo_evento?: number | string;
  valor_sud?: number | string; valor_evento_residencia?: number | string;
  valor_parceria?: number | string; valor_cliente_final?: number | string;
  // nomes legados aceites para não quebrar payloads antigos
  custo_sud?: number | string; custo_evento_residencia?: number | string;
  custo_parceria?: number | string; custo_cliente_final?: number | string;
  rating?: number | string;
}>;

async function saveColaboradorSkillProfiles(colaboradorId: number, skills: string, profiles?: ColaboradorSkillProfileInput) {
  await ensureColaboradoresExtendedColumns();
  const selected = normalizeColaboradorSkills((skills || '').split(',').map(s => s.trim()).filter(Boolean));
  if (selected.length === 0) {
    await turso.execute({ sql: "DELETE FROM colaborador_skill_profiles WHERE colaborador_id=?", args: [colaboradorId] });
    return;
  }
  const placeholders = selected.map(() => '?').join(',');
  await turso.execute({
    sql: `DELETE FROM colaborador_skill_profiles WHERE colaborador_id=? AND skill NOT IN (${placeholders})`,
    args: [colaboradorId, ...selected],
  });
  for (const skill of selected) {
    const p = profiles?.[skill] || {};
    const custoEvento = Math.max(0, Number(p.custo_evento ?? p.custo_interno ?? p.valor ?? 0) || 0);
    const valorSud = Math.max(0, Number(p.valor_sud ?? p.custo_sud ?? 0) || 0);
    const valorEventoResidencia = Math.max(0, Number(p.valor_evento_residencia ?? p.custo_evento_residencia ?? 0) || 0);
    const valorParceria = Math.max(0, Number(p.valor_parceria ?? p.custo_parceria ?? 0) || 0);
    const valorClienteFinal = Math.max(0, Number(p.valor_cliente_final ?? p.custo_cliente_final ?? 0) || 0);
    const rating = Math.max(0, Math.min(5, Math.round(Number(p.rating || 0) || 0)));
    await turso.execute({
      sql: `INSERT INTO colaborador_skill_profiles
            (colaborador_id, skill, valor, custo_interno, custo_evento,
             valor_sud, valor_evento_residencia, valor_parceria, valor_cliente_final,
             custo_sud, custo_evento_residencia, custo_parceria, custo_cliente_final, rating, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
            ON CONFLICT(colaborador_id, skill) DO UPDATE SET
              valor=excluded.valor,
              custo_interno=excluded.custo_interno,
              custo_evento=excluded.custo_evento,
              valor_sud=excluded.valor_sud,
              valor_evento_residencia=excluded.valor_evento_residencia,
              valor_parceria=excluded.valor_parceria,
              valor_cliente_final=excluded.valor_cliente_final,
              custo_sud=excluded.custo_sud,
              custo_evento_residencia=excluded.custo_evento_residencia,
              custo_parceria=excluded.custo_parceria,
              custo_cliente_final=excluded.custo_cliente_final,
              rating=excluded.rating, updated_at=datetime('now')`,
      args: [
        colaboradorId, skill,
        custoEvento, custoEvento, custoEvento,
        valorSud, valorEventoResidencia, valorParceria, valorClienteFinal,
        valorSud, valorEventoResidencia, valorParceria, valorClienteFinal,
        rating,
      ],
    });
  }
}

export async function createColaborador(data: {
  nome: string; nome_artistico?: string; nome_pessoal?: string; contacto?: string; email?: string; iban?: string;
  skills?: string; notas?: string; ativo?: number; restricoes_alimentares?: string; tamanho_cima?: string;
  tamanho_baixo?: string; calcado?: string; skill_profiles?: ColaboradorSkillProfileInput;
}) {
  try {
    await ensureColaboradoresExtendedColumns();
    const nomeArtistico = (data.nome_artistico || data.nome || '').trim();
    await turso.execute({
      sql: `INSERT INTO colaboradores
            (nome, nome_artistico, nome_pessoal, contacto, email, iban, skills, notas, ativo, restricoes_alimentares, tamanho_cima, tamanho_baixo, calcado)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        nomeArtistico, nomeArtistico, data.nome_pessoal || '', data.contacto || '', data.email || '', data.iban || '',
        normalizeColaboradorSkills((data.skills || '').split(',').map(s => s.trim()).filter(Boolean)).join(', '), data.notas || '', data.ativo ?? 1, data.restricoes_alimentares || '', data.tamanho_cima || '',
        data.tamanho_baixo || '', data.calcado || '',
      ],
    });
    const last = await turso.execute("SELECT last_insert_rowid() as id");
    const id = Number(last.rows[0].id);
    await saveColaboradorSkillProfiles(id, normalizeColaboradorSkills((data.skills || '').split(',').map(s => s.trim()).filter(Boolean)).join(', '), data.skill_profiles);
    return { success: true, id };
  } catch (error) {
    console.error("Erro criar colaborador:", error);
    return { success: false, message: "Erro ao criar colaborador." };
  }
}

export async function updateColaborador(id: number, data: {
  nome: string; nome_artistico?: string; nome_pessoal?: string; contacto?: string; email?: string; iban?: string;
  skills?: string; notas?: string; ativo?: number; restricoes_alimentares?: string; tamanho_cima?: string;
  tamanho_baixo?: string; calcado?: string; skill_profiles?: ColaboradorSkillProfileInput;
}) {
  try {
    await ensureColaboradoresExtendedColumns();
    const nomeArtistico = (data.nome_artistico || data.nome || '').trim();
    await turso.execute({
      sql: `UPDATE colaboradores SET nome=?, nome_artistico=?, nome_pessoal=?, contacto=?, email=?, iban=?, skills=?, notas=?, ativo=?,
            restricoes_alimentares=?, tamanho_cima=?, tamanho_baixo=?, calcado=? WHERE id=?`,
      args: [
        nomeArtistico, nomeArtistico, data.nome_pessoal || '', data.contacto || '', data.email || '', data.iban || '',
        normalizeColaboradorSkills((data.skills || '').split(',').map(s => s.trim()).filter(Boolean)).join(', '), data.notas || '', data.ativo ?? 1, data.restricoes_alimentares || '', data.tamanho_cima || '',
        data.tamanho_baixo || '', data.calcado || '', id,
      ],
    });
    await saveColaboradorSkillProfiles(id, normalizeColaboradorSkills((data.skills || '').split(',').map(s => s.trim()).filter(Boolean)).join(', '), data.skill_profiles);
    return { success: true };
  } catch (error) {
    console.error("Erro update colaborador:", error);
    return { success: false };
  }
}

export async function toggleColaboradorAtivo(id: number, ativo: number) {
  try {
    await turso.execute({ sql: "UPDATE colaboradores SET ativo=? WHERE id=?", args: [ativo, id] });
    return { success: true };
  } catch { return { success: false }; }
}


export async function deleteColaborador(id: number) {
  try {
    await setupColaboradores();
    const col = await turso.execute({ sql: "SELECT id, COALESCE(NULLIF(nome_artistico,''), nome) AS nome FROM colaboradores WHERE id=?", args: [id] });
    if (col.rows.length === 0) return { success: false, message: "Colaborador não encontrado." };
    const refs = await turso.execute({ sql: "SELECT COUNT(*) AS total FROM artistas_evento WHERE colaborador_id=?", args: [id] });
    const residenciaRefs = await turso.execute({ sql: "SELECT COUNT(*) AS total FROM residencias_ativas WHERE performer_padrao_id=?", args: [id] });
    const totalRefs = Number((refs.rows[0] as any)?.total || 0) + Number((residenciaRefs.rows[0] as any)?.total || 0);
    if (totalRefs > 0) {
      return { success: false, blocked: true, references: totalRefs, message: "Este colaborador tem histórico associado. Liga-o/funde-o com outro colaborador ou desativa-o para preservar o histórico." };
    }
    await turso.execute({ sql: "DELETE FROM colaborador_skill_profiles WHERE colaborador_id=?", args: [id] });
    await turso.execute({ sql: "DELETE FROM colaboradores WHERE id=?", args: [id] });
    return { success: true };
  } catch (error) {
    console.error("Erro eliminar colaborador:", error);
    return { success: false, message: "Erro ao retirar colaborador." };
  }
}

export async function mergeColaboradores(sourceId: number, targetId: number) {
  try {
    await setupColaboradores();
    if (!sourceId || !targetId || sourceId === targetId) return { success: false, message: "Escolhe dois colaboradores diferentes." };
    const res = await turso.execute({ sql: `SELECT * FROM colaboradores WHERE id IN (?, ?)`, args: [sourceId, targetId] });
    const rows = res.rows as any[];
    const source = rows.find(r => Number(r.id) === sourceId);
    const target = rows.find(r => Number(r.id) === targetId);
    if (!source || !target) return { success: false, message: "Colaborador não encontrado." };

    const sourceSkills = normalizeColaboradorSkills(String(source.skills || '').split(',').map(s => s.trim()).filter(Boolean));
    const targetSkills = normalizeColaboradorSkills(String(target.skills || '').split(',').map(s => s.trim()).filter(Boolean));
    const mergedSkills = normalizeColaboradorSkills([...targetSkills, ...sourceSkills]);

    const profileRes = await turso.execute({ sql: `SELECT * FROM colaborador_skill_profiles WHERE colaborador_id IN (?, ?)`, args: [sourceId, targetId] });
    const numericFields = ['valor','custo_interno','custo_evento','valor_sud','valor_evento_residencia','valor_parceria','valor_cliente_final','custo_sud','custo_evento_residencia','custo_parceria','custo_cliente_final','rating'];
    const targetProfiles = new Map<string, any>();
    const sourceProfiles = new Map<string, any>();
    for (const row of profileRes.rows as any[]) {
      const skill = normalizeColaboradorSkill(String(row.skill || ''));
      if (!skill) continue;
      (Number(row.colaborador_id) === targetId ? targetProfiles : sourceProfiles).set(skill, row);
    }

    // O colaborador escolhido para ficar é sempre a fonte principal. O duplicado
    // apenas preenche campos/valores que estejam vazios no destino.
    const mergedProfiles = new Map<string, any>();
    for (const skill of mergedSkills) {
      const tp = targetProfiles.get(skill) || {};
      const sp = sourceProfiles.get(skill) || {};
      const merged: Record<string, number> = {};
      for (const field of numericFields) {
        const targetValue = Number(tp[field] || 0);
        const sourceValue = Number(sp[field] || 0);
        merged[field] = targetValue > 0 ? targetValue : sourceValue;
      }
      mergedProfiles.set(skill, merged);
    }

    const pick = (field: string) => String(target[field] || '').trim() || String(source[field] || '').trim();
    const mergedNotes = [String(target.notas || '').trim(), String(source.notas || '').trim()]
      .filter(Boolean).filter((v, i, a) => a.indexOf(v) === i).join('\n');
    await turso.execute({
      sql: `UPDATE colaboradores SET nome=?, nome_artistico=?, nome_pessoal=?, contacto=?, email=?, iban=?, skills=?, notas=?, ativo=?,
            restricoes_alimentares=?, tamanho_cima=?, tamanho_baixo=?, calcado=? WHERE id=?`,
      args: [
        pick('nome_artistico') || pick('nome'), pick('nome_artistico') || pick('nome'), pick('nome_pessoal'), pick('contacto'), pick('email'), pick('iban'),
        mergedSkills.join(', '), mergedNotes, (Number(target.ativo) === 1 || Number(source.ativo) === 1) ? 1 : 0,
        pick('restricoes_alimentares'), pick('tamanho_cima'), pick('tamanho_baixo'), pick('calcado'), targetId,
      ],
    });

    await turso.execute({ sql: "DELETE FROM colaborador_skill_profiles WHERE colaborador_id=?", args: [targetId] });
    for (const [skill, p] of mergedProfiles.entries()) {
      await turso.execute({
        sql: `INSERT INTO colaborador_skill_profiles
              (colaborador_id, skill, valor, custo_interno, custo_evento,
               valor_sud, valor_evento_residencia, valor_parceria, valor_cliente_final,
               custo_sud, custo_evento_residencia, custo_parceria, custo_cliente_final, rating, updated_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
        args: [targetId, skill, p.valor, p.custo_interno, p.custo_evento, p.valor_sud, p.valor_evento_residencia,
               p.valor_parceria, p.valor_cliente_final, p.custo_sud, p.custo_evento_residencia, p.custo_parceria, p.custo_cliente_final, p.rating],
      });
    }

    const targetName = String(target.nome_artistico || target.nome || '').trim();
    const movedEvents = await turso.execute({ sql: "UPDATE artistas_evento SET colaborador_id=? WHERE colaborador_id=?", args: [targetId, sourceId] });
    try {
      await turso.execute({ sql: "UPDATE residencias_ativas SET performer_padrao_id=?, performer_padrao_nome=? WHERE performer_padrao_id=?", args: [targetId, targetName, sourceId] });
    } catch { }

    await turso.execute({ sql: "DELETE FROM colaborador_skill_profiles WHERE colaborador_id=?", args: [sourceId] });
    await turso.execute({ sql: "DELETE FROM colaboradores WHERE id=?", args: [sourceId] });
    return { success: true, movedEvents: Number(movedEvents.rowsAffected || 0), targetId };
  } catch (error) {
    console.error("Erro ligar/fundir colaboradores:", error);
    return { success: false, message: "Erro ao ligar colaboradores." };
  }
}

type ArtistaPorAssociar = {
  nome: string;
  tipos: string;
  total: number;
  primeira_data: string;
  ultima_data: string;
  fee_medio: number;
};

export async function getArtistasPorAssociar(): Promise<{ success: boolean; data: ArtistaPorAssociar[] }> {
  try {
    await setupColaboradores();
    await ensureArtistasAssociacaoIgnoradosTable();
    const res = await turso.execute(`
      SELECT
        TRIM(nome) as nome,
        GROUP_CONCAT(DISTINCT TRIM(tipo)) as tipos,
        COUNT(*) as total,
        MIN(evento_data) as primeira_data,
        MAX(evento_data) as ultima_data,
        AVG(fee) as fee_medio
      FROM artistas_evento
      WHERE TRIM(COALESCE(nome, '')) <> ''
        AND (colaborador_id IS NULL OR colaborador_id = 0)
        AND NOT EXISTS (
          SELECT 1 FROM artistas_associacao_ignorados ignored
          WHERE ignored.nome_key = LOWER(TRIM(artistas_evento.nome))
        )
      GROUP BY LOWER(TRIM(nome))
      ORDER BY total DESC, nome ASC
    `);
    return {
      success: true,
      data: res.rows.map((r: any) => ({
        nome: (r.nome as string) || '',
        tipos: (r.tipos as string) || '',
        total: Number(r.total || 0),
        primeira_data: (r.primeira_data as string) || '',
        ultima_data: (r.ultima_data as string) || '',
        fee_medio: Number(r.fee_medio || 0),
      })),
    };
  } catch (error) {
    console.error("Erro getArtistasPorAssociar:", error);
    return { success: false, data: [] };
  }
}

export async function ignorarArtistaPorAssociar(nome: string) {
  try {
    await ensureArtistasAssociacaoIgnoradosTable();
    const nomeLimpo = (nome || '').trim();
    if (!nomeLimpo) return { success: false, message: "Nome obrigatório." };
    await turso.execute({
      sql: "INSERT OR IGNORE INTO artistas_associacao_ignorados (nome_key, nome_original) VALUES (LOWER(TRIM(?)), ?)",
      args: [nomeLimpo, nomeLimpo],
    });
    return { success: true };
  } catch (error) {
    console.error("Erro ignorar artista por associar:", error);
    return { success: false };
  }
}

export async function associarArtistaNomeAColaborador(nome: string, colaboradorId: number) {
  try {
    await setupColaboradores();
    const col = await turso.execute({ sql: "SELECT id FROM colaboradores WHERE id=?", args: [colaboradorId] });
    if (col.rows.length === 0) return { success: false, updated: 0, message: "Colaborador não encontrado." };
    const res = await turso.execute({
      sql: `
        UPDATE artistas_evento
        SET colaborador_id=?
        WHERE TRIM(COALESCE(nome, '')) <> ''
          AND LOWER(TRIM(nome)) = LOWER(TRIM(?))
          AND (colaborador_id IS NULL OR colaborador_id = 0)
      `,
      args: [colaboradorId, nome],
    });
    return { success: true, updated: Number(res.rowsAffected || 0) };
  } catch (error) {
    console.error("Erro associar artista a colaborador:", error);
    return { success: false, updated: 0 };
  }
}

export async function criarColaboradorEAssociarArtista(nome: string, skill?: string) {
  try {
    const nomeLimpo = (nome || '').trim();
    if (!nomeLimpo) return { success: false, message: "Nome obrigatório." };
    const created = await createColaborador({
      nome: nomeLimpo,
      nome_artistico: nomeLimpo,
      nome_pessoal: '',
      skills: normalizeColaboradorSkill((skill || '').trim()),
      ativo: 1,
    });
    if (!created.success || !created.id) return { success: false, message: "Não foi possível criar colaborador." };
    const linked = await associarArtistaNomeAColaborador(nomeLimpo, created.id);
    return { success: true, id: created.id, updated: linked.updated || 0 };
  } catch (error) {
    console.error("Erro criar e associar colaborador:", error);
    return { success: false };
  }
}

// ── VALORES MASTER POR FUNÇÃO ────────────────────────────────────────────────

export async function setupValoresFuncoes() {
  try {
    await ensureValoresFuncoesTable();
    return { success: true };
  } catch (error) {
    console.error("Erro setup valores funções:", error);
    return { success: false };
  }
}

export async function getAllValoresFuncoes() {
  try {
    await ensureValoresFuncoesTable();
    await ensureValoresMasterTable();
    const master = await turso.execute(`
      SELECT * FROM valores_master
      WHERE ativo=1
      ORDER BY CASE WHEN contexto='Normal' THEN 0 ELSE 1 END, CASE WHEN cliente_nome='' THEN 0 ELSE 1 END, servico ASC, id ASC
    `);
    if (master.rows.length > 0) {
      const seen = new Set<string>();
      const data: { id: number; funcao: string; custo_padrao: number; valor_cliente_padrao: number; notas: string; ativo: number }[] = [];
      for (const r of master.rows as any[]) {
        if (!isGeneralValorMasterRow(r)) continue;
        const servico = ((r.servico as string) || '').trim();
        const key = servico.toLowerCase();
        if (!servico || seen.has(key)) continue;
        seen.add(key);
        data.push({
          id: Number(r.id),
          funcao: servico,
          custo_padrao: Number(r.custo_interno || 0),
          valor_cliente_padrao: Number(r.valor_cliente_final || r.valor_parceiro || 0),
          notas: [r.contexto, r.duracao_formato, r.cliente_nome].filter(Boolean).join(' · '),
          ativo: 1,
        });
      }
      return { success: true, data };
    }

    const res = await turso.execute("SELECT * FROM valores_funcoes ORDER BY funcao ASC");
    return {
      success: true,
      data: res.rows.map((r: any) => ({
        id: Number(r.id),
        funcao: (r.funcao as string) || '',
        custo_padrao: Number(r.custo_padrao || 0),
        valor_cliente_padrao: Number(r.valor_cliente_padrao || 0),
        notas: (r.notas as string) || '',
        ativo: r.ativo === 1 || r.ativo === true ? 1 : 0,
      })),
    };
  } catch (error) {
    console.error("Erro getAllValoresFuncoes:", error);
    return { success: false, data: [] };
  }
}

export async function createValorFuncao(data: {
  funcao: string; custo_padrao?: number; valor_cliente_padrao?: number; notas?: string; ativo?: number;
}) {
  try {
    await ensureValoresFuncoesTable();
    await turso.execute({
      sql: "INSERT INTO valores_funcoes (funcao, custo_padrao, valor_cliente_padrao, notas, ativo) VALUES (?, ?, ?, ?, ?)",
      args: [data.funcao.trim(), data.custo_padrao || 0, data.valor_cliente_padrao || 0, data.notas || '', data.ativo ?? 1],
    });
    const last = await turso.execute("SELECT last_insert_rowid() as id");
    return { success: true, id: Number(last.rows[0].id) };
  } catch (error) {
    console.error("Erro criar valor função:", error);
    return { success: false, message: "Erro ao criar valor. A função pode já existir." };
  }
}

export async function updateValorFuncao(id: number, data: {
  funcao: string; custo_padrao?: number; valor_cliente_padrao?: number; notas?: string; ativo?: number;
}) {
  try {
    await ensureValoresFuncoesTable();
    await turso.execute({
      sql: "UPDATE valores_funcoes SET funcao=?, custo_padrao=?, valor_cliente_padrao=?, notas=?, ativo=? WHERE id=?",
      args: [data.funcao.trim(), data.custo_padrao || 0, data.valor_cliente_padrao || 0, data.notas || '', data.ativo ?? 1, id],
    });
    return { success: true };
  } catch (error) {
    console.error("Erro update valor função:", error);
    return { success: false };
  }
}

export async function toggleValorFuncaoAtivo(id: number, ativo: number) {
  try {
    await ensureValoresFuncoesTable();
    await turso.execute({ sql: "UPDATE valores_funcoes SET ativo=? WHERE id=?", args: [ativo, id] });
    return { success: true };
  } catch { return { success: false }; }
}


// ── MASTER DE VALORES COMERCIAL ──────────────────────────────────────────────

export async function setupValoresMaster() {
  try {
    await ensureValoresMasterTable();
    return { success: true };
  } catch (error) {
    console.error("Erro setup valores master:", error);
    return { success: false };
  }
}

export async function getAllValoresMaster() {
  try {
    await ensureValoresMasterTable();
    const res = await turso.execute(`
      SELECT * FROM valores_master
      WHERE merged_into_id IS NULL
      ORDER BY ativo DESC, COALESCE(NULLIF(cliente_nome, ''), 'zzzz') ASC, servico ASC, contexto ASC, duracao_formato ASC, id ASC
    `);
    const general = (res.rows as any[]).filter(isGeneralValorMasterRow).map((r: any) => ({
      id: Number(r.id),
      servico: (r.servico as string) || '',
      duracao_formato: (r.duracao_formato as string) || '',
      contexto: (r.contexto as string) || 'Normal',
      cliente_nome: (r.cliente_nome as string) || '',
      custo_interno: Number(r.custo_interno || 0),
      valor_parceiro: Number(r.valor_parceiro || 0),
      valor_sud: Number(r.valor_sud || 0),
      valor_cliente_final: Number(r.valor_cliente_final || 0),
      notas: (r.notas as string) || '',
      ativo: r.ativo === 1 || r.ativo === true ? 1 : 0,
      source: 'valores',
    }));

    // Agenda/Leads recebem uma vista unificada, mas os preços continuam guardados no módulo Materiais.
    const [materialsResult, packsResult] = await Promise.all([getAllMateriais(), getAllMaterialPacks()]);
    const equipment = materialsResult.success ? (materialsResult.data as any[])
      .filter(row => row.ativo === 1 && isMaterialValueService(String(row.nome || '')))
      .map(row => ({
        id: -1000000 - Number(row.id), servico: row.nome || '', duracao_formato: row.duracao_formato || '', contexto: 'Normal', cliente_nome: '',
        custo_interno: Number(row.custo_interno || 0), valor_parceiro: Number(row.valor_parceiro || 0), valor_sud: Number(row.valor_sud || 0),
        valor_cliente_final: Number(row.valor_cliente_final || 0), notas: row.notas || 'Materiais · equipamento avulso', ativo: 1, source: 'materiais',
      })) : [];
    const packs = packsResult.success ? (packsResult.data as any[])
      .filter(row => row.ativo === 1 && isMaterialValueService(String(row.nome || '')))
      .map(row => ({
        id: -2000000 - Number(row.id), servico: row.nome || '', duracao_formato: row.duracao_formato || '', contexto: 'Normal', cliente_nome: '',
        custo_interno: Number(row.custo_interno || 0), valor_parceiro: Number(row.valor_parceiro || 0), valor_sud: Number(row.valor_sud || 0),
        valor_cliente_final: Number(row.valor_cliente_final || row.valor_referencia || 0), notas: row.descricao || 'Materiais · pack', ativo: 1, source: 'materiais',
      })) : [];

    return { success: true, data: [...general, ...packs, ...equipment] };
  } catch (error) {
    console.error("Erro getAllValoresMaster:", error);
    return { success: false, data: [] };
  }
}

async function queryValoresMasterTableFast() {
  const res = await turso.execute(`
    SELECT id, servico, duracao_formato, contexto, cliente_nome,
           custo_interno, valor_parceiro, valor_sud, valor_cliente_final,
           notas, ativo, merged_into_id
    FROM valores_master
    WHERE LOWER(TRIM(COALESCE(contexto, 'Normal'))) NOT IN ('sud', 'residência', 'residencia')
      AND merged_into_id IS NULL
    ORDER BY ativo DESC, servico ASC, duracao_formato ASC, id ASC
  `);
  return {
    success: true,
    data: (res.rows as any[]).filter(isGeneralValorMasterRow).map((r: any) => ({
      id: Number(r.id),
      servico: (r.servico as string) || '',
      duracao_formato: (r.duracao_formato as string) || '',
      contexto: (r.contexto as string) || 'Normal',
      cliente_nome: '',
      custo_interno: Number(r.custo_interno || 0),
      valor_parceiro: Number(r.valor_parceiro || 0),
      valor_sud: Number(r.valor_sud || 0),
      valor_cliente_final: Number(r.valor_cliente_final || 0),
      notas: (r.notas as string) || '',
      ativo: r.ativo === 1 || r.ativo === true ? 1 : 0,
    })),
  };
}

export async function getValoresMasterTable() {
  try {
    // Leitura normal sem DDL, PRAGMA ou migrações: importante em instâncias serverless frias.
    return await queryValoresMasterTableFast();
  } catch (firstError) {
    try {
      // Só prepara/migra a base quando a leitura direta revela esquema antigo ou inexistente.
      await ensureValoresMasterTable();
      return await queryValoresMasterTableFast();
    } catch (error) {
      console.error("Erro getValoresMasterTable:", error, firstError);
      return { success: false, data: [] };
    }
  }
}

export async function createValorMaster(data: {
  servico: string; duracao_formato?: string; contexto?: string; cliente_nome?: string;
  custo_interno?: number; valor_parceiro?: number; valor_sud?: number; valor_cliente_final?: number; notas?: string; ativo?: number;
}) {
  try {
    if (isMaterialValueService(data.servico)) return { success: false, message: "Os valores de material são geridos em Materiais." };
    await ensureValoresMasterTable();
    await turso.execute({
      sql: "INSERT INTO valores_master (servico, duracao_formato, contexto, cliente_nome, custo_interno, valor_parceiro, valor_sud, valor_cliente_final, notas, ativo) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      args: [data.servico.trim(), data.duracao_formato || '', data.contexto || 'Normal', data.cliente_nome || '', data.custo_interno || 0, data.valor_parceiro || 0, data.valor_sud || 0, data.valor_cliente_final || 0, data.notas || '', data.ativo ?? 1],
    });
    const last = await turso.execute("SELECT last_insert_rowid() as id");
    return { success: true, id: Number(last.rows[0].id) };
  } catch (error) {
    console.error("Erro criar valor master:", error);
    return { success: false, message: "Erro ao criar valor master." };
  }
}

export async function updateValorMaster(id: number, data: {
  servico: string; duracao_formato?: string; contexto?: string; cliente_nome?: string;
  custo_interno?: number; valor_parceiro?: number; valor_sud?: number; valor_cliente_final?: number; notas?: string; ativo?: number;
}) {
  try {
    if (isMaterialValueService(data.servico)) return { success: false, message: "Os valores de material são geridos em Materiais." };
    await ensureValoresMasterTable();
    await turso.execute({
      sql: "UPDATE valores_master SET servico=?, duracao_formato=?, contexto=?, cliente_nome=?, custo_interno=?, valor_parceiro=?, valor_sud=?, valor_cliente_final=?, notas=?, ativo=? WHERE id=?",
      args: [data.servico.trim(), data.duracao_formato || '', data.contexto || 'Normal', data.cliente_nome || '', data.custo_interno || 0, data.valor_parceiro || 0, data.valor_sud || 0, data.valor_cliente_final || 0, data.notas || '', data.ativo ?? 1, id],
    });
    return { success: true };
  } catch (error) {
    console.error("Erro update valor master:", error);
    return { success: false };
  }
}

export async function toggleValorMasterAtivo(id: number, ativo: number) {
  try {
    await ensureValoresMasterTable();
    await turso.execute({ sql: "UPDATE valores_master SET ativo=? WHERE id=?", args: [ativo, id] });
    return { success: true };
  } catch { return { success: false }; }
}


type ServicoPorCriarNaMaster = {
  servico: string;
  total: number;
  primeira_data: string;
  ultima_data: string;
  fee_medio: number;
};

export async function getServicosPorCriarNaMaster(): Promise<{ success: boolean; data: ServicoPorCriarNaMaster[] }> {
  try {
    await ensureValoresMasterTable();
    const res = await turso.execute(`
      SELECT
        TRIM(a.tipo) as servico,
        COUNT(*) as total,
        MIN(a.evento_data) as primeira_data,
        MAX(a.evento_data) as ultima_data,
        AVG(a.fee) as fee_medio
      FROM artistas_evento a
      WHERE TRIM(COALESCE(a.tipo, '')) <> ''
        AND NOT EXISTS (
          SELECT 1 FROM valores_master vm
          WHERE LOWER(TRIM(vm.servico)) = LOWER(TRIM(a.tipo))
        )
      GROUP BY LOWER(TRIM(a.tipo))
      ORDER BY total DESC, servico ASC
    `);
    return {
      success: true,
      data: (res.rows as any[]).filter((r: any) => !isMaterialValueService(String(r.servico || ''))).map((r: any) => ({
        servico: (r.servico as string) || '',
        total: Number(r.total || 0),
        primeira_data: (r.primeira_data as string) || '',
        ultima_data: (r.ultima_data as string) || '',
        fee_medio: Number(r.fee_medio || 0),
      })),
    };
  } catch (error) {
    console.error("Erro getServicosPorCriarNaMaster:", error);
    return { success: false, data: [] };
  }
}

export async function criarValorMasterAPartirServico(servico: string, custoInterno?: number) {
  try {
    await ensureValoresMasterTable();
    const nome = (servico || '').trim();
    if (!nome) return { success: false, message: "Serviço obrigatório." };
    if (isMaterialValueService(nome)) return { success: false, message: "Este valor deve ser criado em Materiais." };
    const exists = await turso.execute({
      sql: "SELECT id FROM valores_master WHERE LOWER(TRIM(servico)) = LOWER(TRIM(?)) LIMIT 1",
      args: [nome],
    });
    if (exists.rows.length > 0) return { success: true, id: Number((exists.rows[0] as any).id), alreadyExists: true };
    await turso.execute({
      sql: "INSERT INTO valores_master (servico, duracao_formato, contexto, cliente_nome, custo_interno, valor_parceiro, valor_cliente_final, notas, ativo) VALUES (?, '', 'Normal', '', ?, 0, 0, ?, 1)",
      args: [nome, Number(custoInterno || 0), 'Criado a partir dos serviços já usados em Agenda/Leads. Rever valores.'],
    });
    const last = await turso.execute("SELECT last_insert_rowid() as id");
    return { success: true, id: Number(last.rows[0].id), alreadyExists: false };
  } catch (error) {
    console.error("Erro criarValorMasterAPartirServico:", error);
    return { success: false };
  }
}

// ── RESIDÊNCIAS ATIVAS ───────────────────────────────────────────────────────

export async function setupResidenciasAtivas() {
  try {
    await ensureResidenciasAtivasTable();
    return { success: true };
  } catch (error) {
    console.error("Erro setup residências ativas:", error);
    return { success: false };
  }
}

export async function getAllResidenciasAtivas() {
  try {
    await ensureResidenciasAtivasTable();
    const res = await turso.execute(`
      SELECT * FROM residencias_ativas
      ORDER BY ativo DESC, cliente_nome ASC, local ASC, nome ASC, id ASC
    `);
    return {
      success: true,
      data: res.rows.map((r: any) => ({
        id: Number(r.id),
        nome: (r.nome as string) || '',
        cliente_id: r.cliente_id == null ? null : Number(r.cliente_id),
        cliente_nome: (r.cliente_nome as string) || '',
        local: (r.local as string) || '',
        servico: (r.servico as string) || 'DJ',
        duracao_formato: (r.duracao_formato as string) || '',
        custo_interno: Number(r.custo_interno || 0),
        custo_evento: Number(r.custo_evento || 0),
        valor_cliente: Number(r.valor_cliente || 0),
        valor_evento: Number(r.valor_evento || 0),
        performer_padrao_id: r.performer_padrao_id == null ? null : Number(r.performer_padrao_id),
        performer_padrao_nome: (r.performer_padrao_nome as string) || '',
        notas: (r.notas as string) || '',
        ativo: r.ativo === 1 || r.ativo === true ? 1 : 0,
      })),
    };
  } catch (error) {
    console.error("Erro getAllResidenciasAtivas:", error);
    return { success: false, data: [] };
  }
}

export async function createResidenciaAtiva(data: {
  nome: string; cliente_id?: number | null; cliente_nome?: string; local?: string; servico?: string; duracao_formato?: string;
  custo_interno?: number; custo_evento?: number; valor_cliente?: number; valor_evento?: number; performer_padrao_id?: number | null; performer_padrao_nome?: string; notas?: string; ativo?: number;
}) {
  try {
    await ensureResidenciasAtivasTable();
    await turso.execute({
      sql: "INSERT INTO residencias_ativas (nome, cliente_id, cliente_nome, local, servico, duracao_formato, custo_interno, custo_evento, valor_cliente, valor_evento, performer_padrao_id, performer_padrao_nome, notas, ativo) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      args: [data.nome.trim(), data.cliente_id ?? null, data.cliente_nome || '', data.local || '', data.servico || 'DJ', data.duracao_formato || '', data.custo_interno || 0, data.custo_evento || 0, data.valor_cliente || 0, data.valor_evento || 0, data.performer_padrao_id ?? null, data.performer_padrao_nome || '', data.notas || '', data.ativo ?? 1],
    });
    const last = await turso.execute("SELECT last_insert_rowid() as id");
    return { success: true, id: Number(last.rows[0].id) };
  } catch (error) {
    console.error("Erro criar residência ativa:", error);
    return { success: false, message: "Erro ao criar residência." };
  }
}

export async function updateResidenciaAtiva(id: number, data: {
  nome: string; cliente_id?: number | null; cliente_nome?: string; local?: string; servico?: string; duracao_formato?: string;
  custo_interno?: number; custo_evento?: number; valor_cliente?: number; valor_evento?: number; performer_padrao_id?: number | null; performer_padrao_nome?: string; notas?: string; ativo?: number;
}) {
  try {
    await ensureResidenciasAtivasTable();
    await turso.execute({
      sql: "UPDATE residencias_ativas SET nome=?, cliente_id=?, cliente_nome=?, local=?, servico=?, duracao_formato=?, custo_interno=?, custo_evento=?, valor_cliente=?, valor_evento=?, performer_padrao_id=?, performer_padrao_nome=?, notas=?, ativo=? WHERE id=?",
      args: [data.nome.trim(), data.cliente_id ?? null, data.cliente_nome || '', data.local || '', data.servico || 'DJ', data.duracao_formato || '', data.custo_interno || 0, data.custo_evento || 0, data.valor_cliente || 0, data.valor_evento || 0, data.performer_padrao_id ?? null, data.performer_padrao_nome || '', data.notas || '', data.ativo ?? 1, id],
    });
    return { success: true };
  } catch (error) {
    console.error("Erro update residência ativa:", error);
    return { success: false };
  }
}

export async function toggleResidenciaAtiva(id: number, ativo: number) {
  try {
    await ensureResidenciasAtivasTable();
    await turso.execute({ sql: "UPDATE residencias_ativas SET ativo=? WHERE id=?", args: [ativo, id] });
    return { success: true };
  } catch { return { success: false }; }
}

// ── SYNC INICIAL: agenda ganha, propaga para leads ────────────────────────────
// Chamado ao abrir Agenda ou Leads. Percorre todos os pares ligados e corrige
// qualquer diferença — agenda é a fonte de verdade neste sync inicial.
// Após esta passagem os dados ficam alinhados e o sync normal trata do resto.
export async function syncAllExistingData() {
  try {
    // Buscar todos os eventos de agenda que têm origem_lead_id
    const pairs = await turso.execute(`
      SELECT
        a.id            as agenda_id,
        a.event_id      as agenda_eid,
        a.origem_lead_id as lead_id,
        a.event_name    as a_title,
        a.event_date    as a_date,
        a.client_cachet as a_value,
        a.billing_status as a_status,
        a.cliente_id    as a_cliente_id,
        a.cliente_nome  as a_cliente_nome,
        a.modalidade    as a_modalidade,
        a.venue         as a_venue,
        a.contacto      as a_contacto,
        a.notas         as a_notas,
        l.event_id      as lead_eid,
        l.title         as l_title,
        l.event_date    as l_date,
        l.value         as l_value,
        l.status        as l_status,
        l.cliente_id    as l_cliente_id,
        l.client_name   as l_cliente_nome,
        l.modalidade    as l_modalidade,
        l.local         as l_venue,
        l.contacto      as l_contacto,
        l.notas         as l_notas
      FROM agenda a
      INNER JOIN leads l ON l.id = a.origem_lead_id
      WHERE a.origem_lead_id IS NOT NULL
    `);

    let synced = 0;

    for (const row of pairs.rows as any[]) {
      // Garantir event_id partilhado
      let eid: string = row.agenda_eid || row.lead_eid || '';
      if (!eid) {
        eid = uuidv4();
      }
      // Sempre actualizar event_id nos dois lados (idempotente se já igual)
      if (row.agenda_eid !== eid) {
        await turso.execute({ sql: "UPDATE agenda SET event_id=? WHERE id=?", args: [eid, row.agenda_id] });
      }
      if (row.lead_eid !== eid) {
        await turso.execute({ sql: "UPDATE leads SET event_id=? WHERE id=?", args: [eid, row.lead_id] });
      }

      // Verificar se há alguma diferença (agenda é fonte de verdade)
      const needsSync =
        row.a_title        !== row.l_title       ||
        row.a_date         !== row.l_date        ||
        String(row.a_value || 0) !== String(row.l_value || 0) ||
        (row.a_status      || '') !== (row.l_status      || '') ||
        (row.a_cliente_id  ?? null) != (row.l_cliente_id ?? null) ||
        (row.a_cliente_nome|| '') !== (row.l_cliente_nome|| '') ||
        (row.a_modalidade  || '') !== (row.l_modalidade  || '') ||
        (row.a_venue       || '') !== (row.l_venue       || '') ||
        (row.a_contacto    || '') !== (row.l_contacto    || '') ||
        (row.a_notas       || '') !== (row.l_notas       || '');

      if (needsSync) {
        await turso.execute({
          sql: `UPDATE leads SET
            title=?, event_date=?, value=?, status=?,
            cliente_id=?, client_name=?, modalidade=?,
            local=?, contacto=?, notas=?
            WHERE id=?`,
          args: [
            row.a_title, row.a_date, row.a_value, row.a_status,
            row.a_cliente_id ?? null, row.a_cliente_nome || '', row.a_modalidade || 'Fatura',
            row.a_venue || '', row.a_contacto || '', row.a_notas || '',
            row.lead_id,
          ],
        });
        synced++;
      }
    }

    // Registos sem par: garantir que têm event_id individual
    await turso.execute(`
      UPDATE agenda SET event_id = (
        lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' ||
        substr(lower(hex(randomblob(2))),2) || '-' ||
        substr('89ab', abs(random()) % 4 + 1, 1) ||
        substr(lower(hex(randomblob(2))),2) || '-' || lower(hex(randomblob(6)))
      ) WHERE event_id IS NULL OR event_id = ''
    `);
    await turso.execute(`
      UPDATE leads SET event_id = (
        lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' ||
        substr(lower(hex(randomblob(2))),2) || '-' ||
        substr('89ab', abs(random()) % 4 + 1, 1) ||
        substr(lower(hex(randomblob(2))),2) || '-' || lower(hex(randomblob(6)))
      ) WHERE event_id IS NULL OR event_id = ''
    `);

    return { success: true, synced, total: pairs.rows.length };
  } catch (error) {
    console.error("Erro syncAllExistingData:", error);
    return { success: false, synced: 0, total: 0 };
  }
}


// ═══════════════════════════════════════════════════════════════════════════
// ALERTAS DE TROCA — mesmo artista no mesmo dia
// ═══════════════════════════════════════════════════════════════════════════

function normalizeConflictArtistName(name: string): string {
  return (name || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

async function ensureArtistConflictOverrides() {
  await turso.execute(`
    CREATE TABLE IF NOT EXISTS artist_conflict_overrides (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      event_date TEXT NOT NULL,
      artist_key TEXT NOT NULL,
      artist_name TEXT DEFAULT '',
      note TEXT DEFAULT '',
      dismissed_by TEXT DEFAULT '',
      ativo INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    )
  `);
  try { await turso.execute("CREATE UNIQUE INDEX IF NOT EXISTS idx_artist_conflict_overrides_key ON artist_conflict_overrides(event_date, artist_key)"); } catch { }
}

export async function getArtistConflictOverrides() {
  noStore();
  try {
    await ensureArtistConflictOverrides();
    const res = await turso.execute("SELECT * FROM artist_conflict_overrides WHERE ativo=1 ORDER BY event_date ASC, artist_name ASC");
    return {
      success: true,
      data: res.rows.map((r: any) => ({
        id: Number(r.id),
        event_date: (r.event_date as string) || '',
        artist_key: (r.artist_key as string) || '',
        artist_name: (r.artist_name as string) || '',
        note: (r.note as string) || '',
        dismissed_by: (r.dismissed_by as string) || '',
      })),
    };
  } catch (error) {
    console.error("Erro getArtistConflictOverrides:", error);
    return { success: false, data: [] };
  }
}

export async function dismissArtistConflict(data: { event_date: string; artist_name: string; note?: string; dismissed_by?: string }) {
  try {
    await ensureArtistConflictOverrides();
    const artistKey = normalizeConflictArtistName(data.artist_name);
    if (!data.event_date || !artistKey) return { success: false, message: "Dados inválidos." };
    await turso.execute({
      sql: "DELETE FROM artist_conflict_overrides WHERE event_date=? AND artist_key=?",
      args: [data.event_date, artistKey],
    });
    await turso.execute({
      sql: `INSERT INTO artist_conflict_overrides
        (event_date, artist_key, artist_name, note, dismissed_by, ativo, updated_at)
        VALUES (?, ?, ?, ?, ?, 1, datetime('now'))`,
      args: [data.event_date, artistKey, data.artist_name || '', data.note || '', data.dismissed_by || ''],
    });
    return { success: true };
  } catch (error) {
    console.error("Erro dismissArtistConflict:", error);
    return { success: false, message: "Erro ao retirar alerta." };
  }
}

// ═══════════════════════════════════════════════════════════════════════════

type MaterialPackSeed = {
  nome: string;
  descricao: string;
  valor_referencia: number;
  duracao_formato?: string;
  custo_interno?: number;
  valor_parceiro?: number;
  valor_sud?: number;
  valor_cliente_final?: number;
  items: { material_nome: string; categoria: string; quantidade: number; notas?: string }[];
  servicos: { servico: string; duracao_formato?: string; contexto?: string; notas?: string }[];
};

const DEFAULT_MATERIAL_PACKS: MaterialPackSeed[] = [
  {
    nome: "DJ Basic",
    descricao: "Pack incluído quando vendemos DJ todo o dia ou formato DJ com AV básico.",
    valor_referencia: 680,
    duracao_formato: "1 PA + mesa + booth + DDJ-400 + 2 micros",
    custo_interno: 0, valor_parceiro: 370, valor_sud: 0, valor_cliente_final: 680,
    items: [
      { material_nome: '1 PA Mackie Thump 212 12"', categoria: "Som", quantidade: 1, notas: "1 PA = 2 colunas" },
      { material_nome: "Mixer Behringer Xenyx 1202SFX", categoria: "Som", quantidade: 1 },
      { material_nome: "DJ Booth LED (B/P)", categoria: "DJ / Cabine", quantidade: 1, notas: "Escolher branco ou preto na preparação" },
      { material_nome: "Controller Pioneer Rekordbox DJ DDJ-400", categoria: "DJ / Cabine", quantidade: 1 },
      { material_nome: "2 Microfones dual UHF s/ fios GLXD2", categoria: "Microfones", quantidade: 1 },
      { material_nome: "Cablagem completa XLR (3m, 6m, 10m, 20m)", categoria: "Som", quantidade: 1 },
    ],
    servicos: [
      { servico: "DJ todo o dia", duracao_formato: "evento", contexto: "Normal", notas: "Incluído/oferta no pacote DJ todo o dia" },
      { servico: "DJ todo o dia", duracao_formato: "evento", contexto: "Residência", notas: "Incluído/oferta no pacote DJ todo o dia" },
    ],
  },
  {
    nome: "AV Base",
    descricao: "Pack de AV básico para banda/voz com AVs incluídos.",
    valor_referencia: 500,
    duracao_formato: "PA + luz base",
    custo_interno: 175, valor_parceiro: 300, valor_sud: 0, valor_cliente_final: 500,
    items: [
      { material_nome: '1 PA Mackie Thump 212 12"', categoria: "Som", quantidade: 1, notas: "1 PA = 2 colunas" },
      { material_nome: "Mixer Behringer Xenyx 1202SFX", categoria: "Som", quantidade: 1 },
      { material_nome: "Shure SM58 s/ fios", categoria: "Microfones", quantidade: 1 },
      { material_nome: "Cablagem completa XLR (3m, 6m, 10m, 20m)", categoria: "Som", quantidade: 1 },
      { material_nome: "Par LED", categoria: "Luz", quantidade: 1 },
    ],
    servicos: [
      { servico: "AV Base", duracao_formato: "PA + luz base", contexto: "Normal", notas: "Pack AV básico" },
      { servico: "Annia Solo c/ AVs", duracao_formato: "até 1h30", contexto: "Priceless Band", notas: "AVs incluídos no formato" },
      { servico: "Banda Duo c/ AVs", duracao_formato: "até 1h30", contexto: "Priceless Band", notas: "AVs incluídos no formato" },
      { servico: "Banda Trio c/ AVs", duracao_formato: "até 1h30", contexto: "Priceless Band", notas: "AVs incluídos no formato" },
      { servico: "Banda quarteto c/ AVs", duracao_formato: "até 1h30", contexto: "Priceless Band", notas: "AVs incluídos no formato" },
      { servico: "Banda quinteto c/ AVs", duracao_formato: "até 1h30", contexto: "Priceless Band", notas: "AVs incluídos no formato" },
      { servico: "Banda quinteto + Cantor c/ AVs", duracao_formato: "até 1h30", contexto: "Priceless Band", notas: "AVs incluídos no formato" },
      { servico: "Banda quinteto + 2 BVs c/ AVs", duracao_formato: "até 1h30", contexto: "Priceless Band", notas: "AVs incluídos no formato" },
    ],
  },
];

async function ensureMaterialPacksTables() {
  await turso.execute(`
    CREATE TABLE IF NOT EXISTS material_packs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nome TEXT NOT NULL UNIQUE,
      descricao TEXT DEFAULT '',
      duracao_formato TEXT DEFAULT '',
      custo_interno REAL NOT NULL DEFAULT 0,
      valor_parceiro REAL NOT NULL DEFAULT 0,
      valor_sud REAL NOT NULL DEFAULT 0,
      valor_cliente_final REAL NOT NULL DEFAULT 0,
      valor_referencia REAL NOT NULL DEFAULT 0,
      ativo INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now'))
    )
  `);
  await turso.execute(`
    CREATE TABLE IF NOT EXISTS material_pack_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      pack_id INTEGER NOT NULL,
      material_nome TEXT NOT NULL,
      categoria TEXT DEFAULT '',
      quantidade INTEGER NOT NULL DEFAULT 1,
      notas TEXT DEFAULT '',
      ativo INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now'))
    )
  `);
  await turso.execute(`
    CREATE TABLE IF NOT EXISTS servico_material_packs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      servico TEXT NOT NULL,
      duracao_formato TEXT DEFAULT '',
      contexto TEXT DEFAULT 'Normal',
      pack_id INTEGER NOT NULL,
      incluido_sem_custo INTEGER DEFAULT 1,
      valor_referencia REAL NOT NULL DEFAULT 0,
      notas TEXT DEFAULT '',
      ativo INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now'))
    )
  `);
  await turso.execute(`
    CREATE TABLE IF NOT EXISTS material_pack_reservas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      evento_id INTEGER NOT NULL,
      pack_id INTEGER NOT NULL,
      pack_nome TEXT DEFAULT '',
      servico TEXT DEFAULT '',
      valor_referencia REAL NOT NULL DEFAULT 0,
      valor_cobrado REAL NOT NULL DEFAULT 0,
      desconto_oferta REAL NOT NULL DEFAULT 0,
      reservado_por TEXT DEFAULT '',
      encerrada_sem_fluxo INTEGER DEFAULT 0,
      encerrada_por TEXT DEFAULT '',
      encerrada_em TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now'))
    )
  `);
  for (const col of ["encerrada_sem_fluxo INTEGER DEFAULT 0", "encerrada_por TEXT DEFAULT ''", "encerrada_em TEXT DEFAULT ''"]) {
    try { await turso.execute(`ALTER TABLE material_pack_reservas ADD COLUMN ${col}`); } catch { }
  }
  try { await turso.execute("CREATE UNIQUE INDEX IF NOT EXISTS idx_material_pack_reserva_evento_pack ON material_pack_reservas(evento_id, pack_id)"); } catch { }
  const packValueCols = [
    "duracao_formato TEXT DEFAULT ''",
    "custo_interno REAL NOT NULL DEFAULT 0",
    "valor_parceiro REAL NOT NULL DEFAULT 0",
    "valor_sud REAL NOT NULL DEFAULT 0",
    "valor_cliente_final REAL NOT NULL DEFAULT 0",
  ];
  for (const col of packValueCols) {
    try { await turso.execute(`ALTER TABLE material_packs ADD COLUMN ${col}`); } catch { }
  }
}

async function getOrCreateMaterialByName(nome: string, categoria = "Outro") {
  await setupMateriais();
  const found = await turso.execute({
    sql: "SELECT * FROM materiais WHERE LOWER(TRIM(nome)) = LOWER(TRIM(?)) LIMIT 1",
    args: [nome],
  });
  if (found.rows.length > 0) return found.rows[0] as any;
  await turso.execute({
    sql: "INSERT INTO materiais (nome, categoria, quantidade_total, dono, local_habitual, notas, ativo) VALUES (?, ?, 1, 'LLE', 'Loja', 'Criado automaticamente por Pack de Material', 1)",
    args: [nome, categoria],
  });
  const inserted = await turso.execute({
    sql: "SELECT * FROM materiais WHERE LOWER(TRIM(nome)) = LOWER(TRIM(?)) LIMIT 1",
    args: [nome],
  });
  return inserted.rows[0] as any;
}

async function seedMaterialPacks() {
  const g = globalThis as typeof globalThis & {
    __lle_seed_material_packs_done?: boolean;
    __lle_seed_material_packs_promise?: Promise<void>;
  };
  if (g.__lle_seed_material_packs_done) return;
  if (g.__lle_seed_material_packs_promise) return g.__lle_seed_material_packs_promise;
  g.__lle_seed_material_packs_promise = (async () => {
  await ensureMaterialPacksTables();
  const avBaseExists = await turso.execute("SELECT id FROM material_packs WHERE LOWER(TRIM(nome))='av base' LIMIT 1");
  if (avBaseExists.rows.length === 0) {
    try { await turso.execute("UPDATE material_packs SET nome='AV Base' WHERE LOWER(TRIM(nome)) IN ('avs basic','av basic')"); } catch { }
  }
  for (const seed of DEFAULT_MATERIAL_PACKS) {
    const existing = await turso.execute({ sql: "SELECT id FROM material_packs WHERE LOWER(TRIM(nome)) = LOWER(TRIM(?)) LIMIT 1", args: [seed.nome] });
    let packId: number;
    if (existing.rows.length > 0) {
      packId = Number((existing.rows[0] as any).id);
      await turso.execute({
        sql: `UPDATE material_packs SET descricao=?, duracao_formato=CASE WHEN TRIM(COALESCE(duracao_formato,''))='' THEN ? ELSE duracao_formato END,
              custo_interno=CASE WHEN COALESCE(custo_interno,0)=0 THEN ? ELSE custo_interno END,
              valor_parceiro=CASE WHEN COALESCE(valor_parceiro,0)=0 THEN ? ELSE valor_parceiro END,
              valor_sud=CASE WHEN COALESCE(valor_sud,0)=0 THEN ? ELSE valor_sud END,
              valor_cliente_final=CASE WHEN COALESCE(valor_cliente_final,0)=0 THEN COALESCE(NULLIF(?,0), valor_referencia, 0) ELSE valor_cliente_final END,
              valor_referencia=CASE WHEN COALESCE(valor_referencia,0)=0 THEN COALESCE(NULLIF(?,0),0) ELSE valor_referencia END, ativo=1 WHERE id=?`,
        args: [seed.descricao, seed.duracao_formato || '', seed.custo_interno || 0, seed.valor_parceiro || 0, seed.valor_sud || 0, seed.valor_cliente_final || seed.valor_referencia || 0, seed.valor_cliente_final || seed.valor_referencia || 0, packId],
      });
    } else {
      await turso.execute({
        sql: "INSERT INTO material_packs (nome, descricao, duracao_formato, custo_interno, valor_parceiro, valor_sud, valor_cliente_final, valor_referencia, ativo) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)",
        args: [seed.nome, seed.descricao, seed.duracao_formato || '', seed.custo_interno || 0, seed.valor_parceiro || 0, seed.valor_sud || 0, seed.valor_cliente_final || seed.valor_referencia || 0, seed.valor_referencia],
      });
      const last = await turso.execute("SELECT last_insert_rowid() as id");
      packId = Number((last.rows[0] as any).id);
    }

    for (const item of seed.items) {
      await getOrCreateMaterialByName(item.material_nome, item.categoria);
      const existsItem = await turso.execute({
        sql: "SELECT id FROM material_pack_items WHERE pack_id=? AND LOWER(TRIM(material_nome))=LOWER(TRIM(?)) LIMIT 1",
        args: [packId, item.material_nome],
      });
      if (existsItem.rows.length > 0) {
        await turso.execute({
          sql: "UPDATE material_pack_items SET categoria=?, quantidade=?, notas=?, ativo=1 WHERE id=?",
          args: [item.categoria, item.quantidade, item.notas || '', Number((existsItem.rows[0] as any).id)],
        });
      } else {
        await turso.execute({
          sql: "INSERT INTO material_pack_items (pack_id, material_nome, categoria, quantidade, notas, ativo) VALUES (?, ?, ?, ?, ?, 1)",
          args: [packId, item.material_nome, item.categoria, item.quantidade, item.notas || ''],
        });
      }
    }

    for (const link of seed.servicos) {
      const existsLink = await turso.execute({
        sql: `SELECT id FROM servico_material_packs
              WHERE pack_id=? AND LOWER(TRIM(servico))=LOWER(TRIM(?))
                AND LOWER(TRIM(COALESCE(duracao_formato,'')))=LOWER(TRIM(?))
                AND LOWER(TRIM(COALESCE(contexto,'Normal')))=LOWER(TRIM(?)) LIMIT 1`,
        args: [packId, link.servico, link.duracao_formato || '', link.contexto || 'Normal'],
      });
      if (existsLink.rows.length > 0) {
        await turso.execute({
          sql: "UPDATE servico_material_packs SET valor_referencia=?, notas=?, incluido_sem_custo=1, ativo=1 WHERE id=?",
          args: [seed.valor_referencia, link.notas || '', Number((existsLink.rows[0] as any).id)],
        });
      } else {
        await turso.execute({
          sql: "INSERT INTO servico_material_packs (servico, duracao_formato, contexto, pack_id, incluido_sem_custo, valor_referencia, notas, ativo) VALUES (?, ?, ?, ?, 1, ?, ?, 1)",
          args: [link.servico, link.duracao_formato || '', link.contexto || 'Normal', packId, seed.valor_referencia, link.notas || ''],
        });
      }
    }
  }

  })();
  try {
    await g.__lle_seed_material_packs_promise;
    g.__lle_seed_material_packs_done = true;
  } catch (error) {
    g.__lle_seed_material_packs_promise = undefined;
    throw error;
  }
}


type MaterialValueSeed = {
  servico: string;
  duracao_formato: string;
  custo_interno: number;
  valor_parceiro: number;
  valor_sud: number;
  valor_cliente_final: number;
  notas: string;
};

function consolidatedMaterialValueSeeds(rows: any[] = DEFAULT_VALORES_MASTER): MaterialValueSeed[] {
  const grouped = new Map<string, MaterialValueSeed>();
  for (const row of rows) {
    const servico = String(row?.servico || '').trim();
    if (!isMaterialValueService(servico)) continue;
    const duracao = String(row?.duracao_formato || '').trim();
    const key = `${normalizeValorMasterKey(servico)}||${normalizeValorMasterKey(duracao)}`;
    const current = grouped.get(key) || {
      servico, duracao_formato: duracao, custo_interno: 0, valor_parceiro: 0,
      valor_sud: 0, valor_cliente_final: 0, notas: String(row?.notas || ''),
    };
    const kind = valorMasterContextKind(row);
    current.custo_interno ||= Number(row?.custo_interno || 0);
    if (kind === 'sud') current.valor_sud ||= Number(row?.valor_sud || row?.valor_cliente_final || row?.valor_parceiro || 0);
    else if (kind === 'partner') current.valor_parceiro ||= Number(row?.valor_parceiro || row?.valor_cliente_final || 0);
    else if (kind === 'final') current.valor_cliente_final ||= Number(row?.valor_cliente_final || row?.valor_parceiro || 0);
    else {
      current.valor_parceiro ||= Number(row?.valor_parceiro || 0);
      current.valor_sud ||= Number(row?.valor_sud || 0);
      current.valor_cliente_final ||= Number(row?.valor_cliente_final || 0);
    }
    if (!current.notas && row?.notas) current.notas = String(row.notas);
    grouped.set(key, current);
  }
  return [...grouped.values()];
}

async function upsertMaterialValueSeed(seed: MaterialValueSeed) {
  if (isMaterialEquipmentService(seed.servico)) {
    const material = await getOrCreateMaterialByName(seed.servico, 'Outro');
    await turso.execute({
      sql: `UPDATE materiais SET
        duracao_formato=CASE WHEN TRIM(COALESCE(duracao_formato,''))='' THEN ? ELSE duracao_formato END,
        custo_interno=CASE WHEN COALESCE(custo_interno,0)=0 THEN ? ELSE custo_interno END,
        valor_parceiro=CASE WHEN COALESCE(valor_parceiro,0)=0 THEN ? ELSE valor_parceiro END,
        valor_sud=CASE WHEN COALESCE(valor_sud,0)=0 THEN ? ELSE valor_sud END,
        valor_cliente_final=CASE WHEN COALESCE(valor_cliente_final,0)=0 THEN ? ELSE valor_cliente_final END,
        notas=CASE WHEN TRIM(COALESCE(notas,''))='' OR notas='Criado automaticamente por Pack de Material' THEN ? ELSE notas END,
        ativo=1 WHERE id=?`,
      args: [seed.duracao_formato, seed.custo_interno, seed.valor_parceiro, seed.valor_sud, seed.valor_cliente_final, seed.notas, Number(material.id)],
    });
    return;
  }

  await ensureMaterialPacksTables();
  const found = await turso.execute({ sql: "SELECT * FROM material_packs WHERE LOWER(TRIM(nome))=LOWER(TRIM(?)) LIMIT 1", args: [seed.servico] });
  if (found.rows.length > 0) {
    const id = Number((found.rows[0] as any).id);
    await turso.execute({
      sql: `UPDATE material_packs SET
        duracao_formato=CASE WHEN TRIM(COALESCE(duracao_formato,''))='' THEN ? ELSE duracao_formato END,
        custo_interno=CASE WHEN COALESCE(custo_interno,0)=0 THEN ? ELSE custo_interno END,
        valor_parceiro=CASE WHEN COALESCE(valor_parceiro,0)=0 THEN ? ELSE valor_parceiro END,
        valor_sud=CASE WHEN COALESCE(valor_sud,0)=0 THEN ? ELSE valor_sud END,
        valor_cliente_final=CASE WHEN COALESCE(valor_cliente_final,0)=0 THEN COALESCE(NULLIF(?,0),valor_referencia,0) ELSE valor_cliente_final END,
        valor_referencia=CASE WHEN COALESCE(valor_referencia,0)=0 THEN ? ELSE valor_referencia END,
        descricao=CASE WHEN TRIM(COALESCE(descricao,''))='' THEN ? ELSE descricao END,
        ativo=1 WHERE id=?`,
      args: [seed.duracao_formato, seed.custo_interno, seed.valor_parceiro, seed.valor_sud, seed.valor_cliente_final, seed.valor_cliente_final, seed.notas, id],
    });
  } else {
    await turso.execute({
      sql: `INSERT INTO material_packs
        (nome, descricao, duracao_formato, custo_interno, valor_parceiro, valor_sud, valor_cliente_final, valor_referencia, ativo)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)`,
      args: [seed.servico, seed.notas, seed.duracao_formato, seed.custo_interno, seed.valor_parceiro, seed.valor_sud, seed.valor_cliente_final, seed.valor_cliente_final],
    });
  }
}

async function migrateSeparatedModuleValues() {
  await ensureLleMetaTable();
  const migrationKey = 'valores_master_v4_modulos_20260715';
  if (await hasMigration(migrationKey)) return;

  await setupMateriais();
  await seedMaterialPacks();

  // Primeiro aproveita quaisquer valores antigos/manuais; depois completa apenas campos vazios com a tabela base.
  const oldRows = await turso.execute("SELECT * FROM valores_master ORDER BY ativo DESC, id ASC");
  for (const seed of consolidatedMaterialValueSeeds(oldRows.rows as any[])) await upsertMaterialValueSeed(seed);
  for (const seed of consolidatedMaterialValueSeeds()) await upsertMaterialValueSeed(seed);

  for (const row of oldRows.rows as any[]) {
    const contexto = normalizeValorMasterKey(row.contexto);
    const isResidence = contexto === 'residência' || contexto === 'residencia';
    if (!isMaterialValueService(String(row.servico || '')) && !isResidence) continue;
    const destination = isResidence ? 'Residências' : 'Materiais';
    await turso.execute({
      sql: `UPDATE valores_master SET ativo=0,
        notas=CASE WHEN INSTR(COALESCE(notas,''), ?) > 0 THEN notas ELSE TRIM(COALESCE(notas,'') || ?) END
        WHERE id=?`,
      args: [`Movido para ${destination}`, ` · Movido para ${destination}`, Number(row.id)],
    });
  }
  await markMigration(migrationKey);
}

export async function getAllMaterialPacks() {
  try {
    await setupMateriais();
    await seedMaterialPacks();
    const packs = await turso.execute("SELECT * FROM material_packs WHERE ativo=1 ORDER BY nome ASC");
    const items = await turso.execute("SELECT * FROM material_pack_items WHERE ativo=1 ORDER BY id ASC");
    const links = await turso.execute("SELECT smp.*, mp.nome as pack_nome FROM servico_material_packs smp LEFT JOIN material_packs mp ON smp.pack_id=mp.id WHERE smp.ativo=1 ORDER BY smp.servico ASC");
    return {
      success: true,
      data: packs.rows.map((p: any) => ({
        id: Number(p.id),
        nome: p.nome as string,
        descricao: (p.descricao as string) || '',
        duracao_formato: (p.duracao_formato as string) || '',
        custo_interno: Number(p.custo_interno) || 0,
        valor_parceiro: Number(p.valor_parceiro) || 0,
        valor_sud: Number(p.valor_sud) || 0,
        valor_cliente_final: Number(p.valor_cliente_final || p.valor_referencia) || 0,
        valor_referencia: Number(p.valor_referencia) || 0,
        ativo: p.ativo === 1 || p.ativo === true ? 1 : 0,
        items: items.rows.filter((i: any) => Number(i.pack_id) === Number(p.id)).map((i: any) => ({
          id: Number(i.id), pack_id: Number(i.pack_id), material_nome: i.material_nome as string,
          categoria: (i.categoria as string) || '', quantidade: Number(i.quantidade) || 1, notas: (i.notas as string) || '',
        })),
        links: links.rows.filter((l: any) => Number(l.pack_id) === Number(p.id)).map((l: any) => ({
          id: Number(l.id), servico: l.servico as string, duracao_formato: (l.duracao_formato as string) || '',
          contexto: (l.contexto as string) || 'Normal', notas: (l.notas as string) || '',
        })),
      })),
    };
  } catch (error) {
    console.error("Erro getAllMaterialPacks:", error);
    return { success: false, data: [] };
  }
}

export async function updateMaterialPackValues(id: number, data: {
  duracao_formato?: string; custo_interno?: number; valor_parceiro?: number; valor_sud?: number; valor_cliente_final?: number; descricao?: string;
}) {
  try {
    await setupMateriais();
    await ensureMaterialPacksTables();
    await turso.execute({
      sql: `UPDATE material_packs SET duracao_formato=?, custo_interno=?, valor_parceiro=?, valor_sud=?, valor_cliente_final=?,
            valor_referencia=?, descricao=CASE WHEN ?='' THEN descricao ELSE ? END WHERE id=?`,
      args: [data.duracao_formato || '', data.custo_interno || 0, data.valor_parceiro || 0, data.valor_sud || 0, data.valor_cliente_final || 0,
        data.valor_cliente_final || 0, data.descricao || '', data.descricao || '', id],
    });
    return { success: true };
  } catch (error) {
    console.error("Erro updateMaterialPackValues:", error);
    return { success: false };
  }
}

export async function getMaterialPackReservasEvento(eventoId: number) {
  try {
    await setupMateriais();
    await seedMaterialPacks();
    const res = await turso.execute({
      sql: "SELECT * FROM material_pack_reservas WHERE evento_id=? AND COALESCE(encerrada_sem_fluxo,0)=0 ORDER BY created_at ASC",
      args: [eventoId],
    });
    return { success: true, data: res.rows.map((r: any) => ({
      id: Number(r.id), evento_id: Number(r.evento_id), pack_id: Number(r.pack_id), pack_nome: (r.pack_nome as string) || '',
      servico: (r.servico as string) || '', valor_referencia: Number(r.valor_referencia) || 0,
      valor_cobrado: Number(r.valor_cobrado) || 0, desconto_oferta: Number(r.desconto_oferta) || 0,
      reservado_por: (r.reservado_por as string) || '', created_at: (r.created_at as string) || '',
    })) };
  } catch (error) {
    console.error("Erro getMaterialPackReservasEvento:", error);
    return { success: false, data: [] };
  }
}


function materialValorParaContexto(row: any, contexto?: string) {
  const ctx = String(contexto || 'Cliente Final').trim();
  if (ctx === 'SUD') return Number(row?.valor_sud || row?.valor_cliente_final || row?.valor_parceiro || 0);
  if (ctx === 'Parceiro' || ctx === 'Residência') return Number(row?.valor_parceiro || row?.valor_cliente_final || 0);
  return Number(row?.valor_cliente_final || row?.valor_parceiro || row?.valor_sud || 0);
}

async function ajustarFaturacaoEventoPorMaterial(eventoId: number, delta: number) {
  if (!eventoId || !Number.isFinite(delta) || Math.abs(delta) < 0.000001) {
    const current = await turso.execute({ sql: "SELECT client_cachet FROM agenda WHERE id=? LIMIT 1", args: [eventoId] });
    return Number((current.rows[0] as any)?.client_cachet || 0);
  }
  const current = await turso.execute({
    sql: "SELECT client_cachet, event_id, origem_lead_id FROM agenda WHERE id=? LIMIT 1",
    args: [eventoId],
  });
  if (!current.rows.length) return 0;
  const row = current.rows[0] as any;
  const novoValor = Math.round((Number(row.client_cachet || 0) + Number(delta || 0)) * 100) / 100;
  if (row.event_id) {
    await propagateByEventId(String(row.event_id), { value: novoValor });
  } else {
    await turso.execute({ sql: "UPDATE agenda SET client_cachet=? WHERE id=?", args: [novoValor, eventoId] });
    if (row.origem_lead_id) await turso.execute({ sql: "UPDATE leads SET value=? WHERE id=?", args: [novoValor, Number(row.origem_lead_id)] });
  }
  return novoValor;
}

async function valoresMaterialEvento(eventoId: number, materialId: number) {
  const res = await turso.execute({
    sql: `SELECT m.*, COALESCE(a.valor_contexto, 'Cliente Final') AS evento_contexto
          FROM materiais m
          LEFT JOIN agenda a ON a.id=?
          WHERE m.id=? LIMIT 1`,
    args: [eventoId, materialId],
  });
  if (!res.rows.length) return { custo: 0, valor: 0, contexto: 'Cliente Final' };
  const row = res.rows[0] as any;
  const contexto = String(row.evento_contexto || 'Cliente Final');
  return {
    custo: Number(row.custo_interno || 0),
    valor: materialValorParaContexto(row, contexto),
    contexto,
  };
}

export async function reservarMaterialEvento(data: {
  evento_id: number; material_id: number; material_nome: string; material_imagem?: string;
  quantidade: number; origem?: string; origem_detalhe?: string; notas?: string; reservado_por?: string;
}) {
  try {
    await setupMateriais();
    const qty = Math.max(1, Number(data.quantidade) || 1);
    const valores = await valoresMaterialEvento(data.evento_id, data.material_id);
    await turso.execute({
      sql: `INSERT INTO material_reservas
        (evento_id, material_id, material_nome, material_imagem, quantidade, origem, origem_detalhe, notas, reservado_por,
         custo_unitario, valor_unitario, valor_contexto, contabilizar, ativo)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 1)`,
      args: [
        data.evento_id, data.material_id, data.material_nome, data.material_imagem || '',
        qty, data.origem || 'Loja', data.origem_detalhe || '', data.notas || '', data.reservado_por || '',
        valores.custo, valores.valor, valores.contexto,
      ],
    });
    const last = await turso.execute("SELECT last_insert_rowid() as id");
    const newBill = await ajustarFaturacaoEventoPorMaterial(data.evento_id, valores.valor * qty);
    return { success: true, id: Number(last.rows[0].id), new_bill: newBill, material_revenue: valores.valor * qty, material_cost: valores.custo * qty };
  } catch (error) {
    console.error('Erro reservarMaterialEvento:', error);
    return { success: false, message: 'Erro ao reservar material.' };
  }
}

export async function updateReservaMaterialEvento(id: number, quantidade: number, source: 'manual' | 'legacy' = 'manual') {
  try {
    await setupMateriais();
    const qty = Math.max(1, Number(quantidade) || 1);
    const table = source === 'legacy' ? 'material_movimentos' : 'material_reservas';
    const activeClause = source === 'legacy' ? "AND COALESCE(saida_confirmada,1)=0" : "AND ativo=1";
    const rowRes = await turso.execute({ sql: `SELECT * FROM ${table} WHERE id=? ${activeClause} LIMIT 1`, args: [id] });
    if (!rowRes.rows.length) return { success: false };
    const row = rowRes.rows[0] as any;
    const oldQty = Math.max(1, Number(row.quantidade) || 1);
    let valorUnit = Number(row.valor_unitario || 0);
    let custoUnit = Number(row.custo_unitario || 0);
    if (Number(row.contabilizar || 0) === 1 && valorUnit === 0 && custoUnit === 0) {
      const fallback = await valoresMaterialEvento(Number(row.evento_id), Number(row.material_id));
      valorUnit = fallback.valor; custoUnit = fallback.custo;
    }
    await turso.execute({ sql: `UPDATE ${table} SET quantidade=? WHERE id=? ${activeClause}`, args: [qty, id] });
    const delta = Number(row.contabilizar || 0) === 1 ? valorUnit * (qty - oldQty) : 0;
    const newBill = row.evento_id ? await ajustarFaturacaoEventoPorMaterial(Number(row.evento_id), delta) : 0;
    return { success: true, new_bill: newBill, material_revenue_delta: delta, material_cost_delta: Number(row.contabilizar || 0) === 1 ? custoUnit * (qty - oldQty) : 0 };
  } catch (error) {
    console.error('Erro updateReservaMaterialEvento:', error);
    return { success: false };
  }
}

export async function deleteReservaMaterialEvento(id: number, source: 'manual' | 'legacy' = 'manual') {
  try {
    await setupMateriais();
    const table = source === 'legacy' ? 'material_movimentos' : 'material_reservas';
    const rowRes = await turso.execute({ sql: `SELECT * FROM ${table} WHERE id=? LIMIT 1`, args: [id] });
    const row = rowRes.rows[0] as any;
    let newBill = 0;
    if (row && Number(row.contabilizar || 0) === 1 && row.evento_id) {
      let valorUnit = Number(row.valor_unitario || 0);
      if (!valorUnit) valorUnit = (await valoresMaterialEvento(Number(row.evento_id), Number(row.material_id))).valor;
      newBill = await ajustarFaturacaoEventoPorMaterial(Number(row.evento_id), -valorUnit * Math.max(1, Number(row.quantidade) || 1));
    }
    if (source === 'legacy') {
      await turso.execute({ sql: "DELETE FROM material_movimentos WHERE id=? AND COALESCE(saida_confirmada, 1)=0", args: [id] });
    } else {
      await turso.execute({ sql: "UPDATE material_reservas SET ativo=0 WHERE id=?", args: [id] });
    }
    return { success: true, new_bill: newBill };
  } catch (error) {
    console.error('Erro deleteReservaMaterialEvento:', error);
    return { success: false };
  }
}

export async function retirarReservaOperacionalEvento(eventoId: number, retiradoPor = '') {
  try {
    await setupMateriais();
    const id = Number(eventoId) || 0;
    if (!id) return { success: false, message: 'Evento inválido.' };
    const actor = String(retiradoPor || '').trim();

    const [manualCountRes, legacyCountRes, packCountRes] = await Promise.all([
      turso.execute({ sql: "SELECT COUNT(*) AS total FROM material_reservas WHERE evento_id=? AND ativo=1 AND COALESCE(encerrada_sem_fluxo,0)=0", args: [id] }),
      turso.execute({ sql: "SELECT COUNT(*) AS total FROM material_movimentos WHERE evento_id=? AND COALESCE(saida_confirmada,1)=0", args: [id] }),
      turso.execute({ sql: "SELECT COUNT(*) AS total FROM material_pack_reservas WHERE evento_id=? AND COALESCE(encerrada_sem_fluxo,0)=0", args: [id] }),
    ]);

    await Promise.all([
      turso.execute({
        sql: `UPDATE material_reservas
              SET encerrada_sem_fluxo=1, encerrada_por=?, encerrada_em=datetime('now')
              WHERE evento_id=? AND ativo=1 AND COALESCE(encerrada_sem_fluxo,0)=0`,
        args: [actor, id],
      }),
      turso.execute({
        sql: `UPDATE material_movimentos
              SET saida_confirmada=2,
                  notas=TRIM(COALESCE(notas,'') || CASE WHEN COALESCE(notas,'')='' THEN '' ELSE ' · ' END || 'Reserva retirada sem fluxo' || CASE WHEN ?='' THEN '' ELSE ' por ' || ? END)
              WHERE evento_id=? AND COALESCE(saida_confirmada,1)=0`,
        args: [actor, actor, id],
      }),
      turso.execute({
        sql: `UPDATE material_pack_reservas
              SET encerrada_sem_fluxo=1, encerrada_por=?, encerrada_em=datetime('now')
              WHERE evento_id=? AND COALESCE(encerrada_sem_fluxo,0)=0`,
        args: [actor, id],
      }),
    ]);

    const manual = Number((manualCountRes.rows[0] as any)?.total || 0);
    const legacy = Number((legacyCountRes.rows[0] as any)?.total || 0);
    const packs = Number((packCountRes.rows[0] as any)?.total || 0);
    return { success: true, removed: manual + legacy + packs, manual, legacy, packs };
  } catch (error) {
    console.error('Erro retirarReservaOperacionalEvento:', error);
    return { success: false, message: 'Não foi possível retirar a reserva.' };
  }
}

export async function confirmarSaidaReservaEvento(data: {
  id: number; source: 'manual' | 'legacy'; quantidade?: number;
  origem?: string; origem_detalhe?: string; quem_levou?: string; responsavel?: string; notas?: string;
}) {
  try {
    await setupMateriais();
    if (data.source === 'legacy') {
      await turso.execute({
        sql: `UPDATE material_movimentos SET saida_confirmada=1, quantidade=COALESCE(?, quantidade),
              origem=COALESCE(NULLIF(?, ''), origem), origem_detalhe=?,
              quem_levou=COALESCE(NULLIF(?, ''), quem_levou), responsavel=COALESCE(NULLIF(?, ''), responsavel),
              notas=CASE WHEN ?='' THEN notas ELSE ? END, data_saida=datetime('now')
              WHERE id=? AND COALESCE(saida_confirmada, 1)=0`,
        args: [data.quantidade ? Math.max(1, Number(data.quantidade) || 1) : null, data.origem || '', data.origem_detalhe || '', data.quem_levou || '', data.responsavel || '', data.notas || '', data.notas || '', data.id],
      });
      return { success: true };
    }

    const res = await turso.execute({
      sql: `SELECT mr.*, COALESCE(m.dono, 'LLE') AS dono_material, COALESCE(a.event_name, '') AS evento_nome
            FROM material_reservas mr
            LEFT JOIN materiais m ON m.id=mr.material_id
            LEFT JOIN agenda a ON a.id=mr.evento_id
            WHERE mr.id=? AND mr.ativo=1 AND COALESCE(mr.encerrada_sem_fluxo,0)=0 LIMIT 1`,
      args: [data.id],
    });
    if (res.rows.length === 0) return { success: false, message: 'Reserva não encontrada.' };
    const r = res.rows[0] as any;
    await turso.execute({
      sql: `INSERT INTO material_movimentos
        (material_id, material_nome, material_imagem, quantidade, quantidade_devolvida, quantidade_consumida,
         origem, origem_detalhe, dono_material, quem_levou, evento, evento_id, responsavel, notas, data_saida, saida_confirmada,
         custo_unitario, valor_unitario, valor_contexto, contabilizar)
        VALUES (?, ?, ?, ?, 0, 0, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), 1, ?, ?, ?, ?)`,
      args: [
        Number(r.material_id), (r.material_nome as string) || '', (r.material_imagem as string) || '', data.quantidade ? Math.max(1, Number(data.quantidade) || 1) : (Number(r.quantidade) || 1),
        data.origem || (r.origem as string) || 'Loja', data.origem_detalhe || (r.origem_detalhe as string) || '',
        (r.dono_material as string) || 'LLE', data.quem_levou || data.responsavel || '',
        (r.evento_nome as string) || '', Number(r.evento_id), data.responsavel || '', data.notas || (r.notas as string) || '',
        Number(r.custo_unitario || 0), Number(r.valor_unitario || 0), (r.valor_contexto as string) || '', Number(r.contabilizar || 0),
      ],
    });
    await turso.execute({ sql: "UPDATE material_reservas SET ativo=0 WHERE id=?", args: [data.id] });
    return { success: true };
  } catch (error) {
    console.error('Erro confirmarSaidaReservaEvento:', error);
    return { success: false, message: 'Erro ao registar a saída.' };
  }
}

export async function getMateriaisReservadosResumoEvento(eventoId: number) {
  try {
    await setupMateriais();
    const [packsRes, manualRes, legacyRes, movimentosRes] = await Promise.all([
      turso.execute({
        sql: `
          SELECT i.material_nome, SUM(COALESCE(i.quantidade, 1)) AS quantidade,
                 COALESCE(MAX(m.id), 0) AS material_id, COALESCE(MAX(m.imagem), '') AS material_imagem,
                 GROUP_CONCAT(DISTINCT r.pack_nome) AS pack_nome
          FROM material_pack_reservas r
          JOIN material_pack_items i ON i.pack_id = r.pack_id AND i.ativo = 1
          LEFT JOIN materiais m ON LOWER(TRIM(m.nome)) = LOWER(TRIM(i.material_nome)) AND m.ativo=1
          WHERE r.evento_id = ? AND COALESCE(r.encerrada_sem_fluxo,0)=0
          GROUP BY i.material_nome
          ORDER BY i.material_nome ASC
        `,
        args: [eventoId],
      }),
      turso.execute({
        sql: `SELECT mr.id, mr.material_id, mr.material_nome,
                     COALESCE(NULLIF(mr.material_imagem,''), m.imagem, '') AS material_imagem,
                     mr.quantidade, mr.origem, mr.origem_detalhe, mr.notas, mr.reservado_por,
                     mr.custo_unitario, mr.valor_unitario, mr.valor_contexto, mr.contabilizar
              FROM material_reservas mr
              LEFT JOIN materiais m ON m.id=mr.material_id
              WHERE mr.evento_id=? AND mr.ativo=1 AND COALESCE(mr.encerrada_sem_fluxo,0)=0
              ORDER BY mr.created_at ASC, mr.id ASC`,
        args: [eventoId],
      }),
      turso.execute({
        sql: `SELECT mm.id, mm.material_id, mm.material_nome,
                     COALESCE(NULLIF(mm.material_imagem,''), m.imagem, '') AS material_imagem,
                     mm.quantidade, mm.origem, mm.origem_detalhe, mm.notas, mm.responsavel AS reservado_por,
                     mm.custo_unitario, mm.valor_unitario, mm.valor_contexto, mm.contabilizar
              FROM material_movimentos mm
              LEFT JOIN materiais m ON m.id=mm.material_id
              WHERE mm.evento_id=? AND COALESCE(mm.saida_confirmada,1)=0
                AND mm.quantidade > COALESCE(mm.quantidade_devolvida,0)+COALESCE(mm.quantidade_consumida,0)
              ORDER BY mm.id ASC`,
        args: [eventoId],
      }),
      turso.execute({
        sql: `SELECT mm.id, mm.material_id, mm.material_nome,
                     COALESCE(NULLIF(mm.material_imagem,''), m.imagem, '') AS material_imagem,
                     mm.quantidade, mm.quantidade_devolvida, mm.quantidade_consumida,
                     mm.estado_regresso, mm.data_volta, mm.notas, mm.origem, mm.origem_detalhe,
                     mm.quem_levou, mm.responsavel, mm.custo_unitario, mm.valor_unitario, mm.valor_contexto, mm.contabilizar
              FROM material_movimentos mm
              LEFT JOIN materiais m ON m.id=mm.material_id
              WHERE mm.evento_id=? AND COALESCE(mm.saida_confirmada,1)=1
                AND NOT (
                  COALESCE(mm.notas, '') LIKE 'Pack incluído/oferta:%'
                  AND EXISTS (
                    SELECT 1 FROM material_pack_reservas r
                    JOIN material_pack_items i ON i.pack_id=r.pack_id AND i.ativo=1
                    WHERE r.evento_id=mm.evento_id AND COALESCE(r.encerrada_sem_fluxo,0)=0
                      AND LOWER(TRIM(i.material_nome))=LOWER(TRIM(mm.material_nome))
                  )
                )
              ORDER BY mm.material_nome ASC, mm.id ASC`,
        args: [eventoId],
      }),
    ]);

    const movementRows = (movimentosRes.rows as any[]).map((r: any) => ({
      id: Number(r.id), source: 'movement', material_id: Number(r.material_id) || 0,
      material_nome: (r.material_nome as string) || '', material_imagem: (r.material_imagem as string) || '',
      quantidade: Number(r.quantidade) || 0, quantidade_devolvida: Number(r.quantidade_devolvida) || 0,
      quantidade_consumida: Number(r.quantidade_consumida) || 0, estado_regresso: (r.estado_regresso as string) || '',
      data_volta: (r.data_volta as string) || '', notas: (r.notas as string) || '',
      origem: (r.origem as string) || 'Loja', origem_detalhe: (r.origem_detalhe as string) || '',
      quem_levou: (r.quem_levou as string) || (r.responsavel as string) || '',
      custo_unitario: Number(r.custo_unitario) || 0, valor_unitario: Number(r.valor_unitario) || 0,
      valor_contexto: (r.valor_contexto as string) || '', contabilizar: Number(r.contabilizar) || 0,
      status: Number(r.quantidade_devolvida || 0) + Number(r.quantidade_consumida || 0) >= Number(r.quantidade || 0) ? 'devolvido' : 'fora',
    }));

    const outByName = new Map<string, number>();
    for (const row of movementRows) {
      const pending = Math.max(0, row.quantidade - row.quantidade_devolvida - row.quantidade_consumida);
      const key = normalizeValorMasterKey(row.material_nome);
      outByName.set(key, (outByName.get(key) || 0) + pending);
    }

    const manualRows = (manualRes.rows as any[]).map((r: any) => ({
      id: Number(r.id), source: 'manual', material_id: Number(r.material_id) || 0,
      material_nome: (r.material_nome as string) || '', material_imagem: (r.material_imagem as string) || '',
      quantidade: Number(r.quantidade) || 0, quantidade_devolvida: 0, quantidade_consumida: 0,
      estado_regresso: 'Reservado', data_volta: '', notas: (r.notas as string) || 'Reservado para este evento; ainda não saiu do local.',
      origem: (r.origem as string) || 'Loja', origem_detalhe: (r.origem_detalhe as string) || '',
      reservado_por: (r.reservado_por as string) || '',
      custo_unitario: Number(r.custo_unitario) || 0, valor_unitario: Number(r.valor_unitario) || 0,
      valor_contexto: (r.valor_contexto as string) || '', contabilizar: Number(r.contabilizar) || 0,
      status: 'reservado',
    }));
    const legacyRows = (legacyRes.rows as any[]).map((r: any) => ({
      id: Number(r.id), source: 'legacy', material_id: Number(r.material_id) || 0,
      material_nome: (r.material_nome as string) || '', material_imagem: (r.material_imagem as string) || '',
      quantidade: Number(r.quantidade) || 0, quantidade_devolvida: 0, quantidade_consumida: 0,
      estado_regresso: 'Reservado', data_volta: '', notas: (r.notas as string) || 'Reserva antiga corrigida; ainda não saiu do local.',
      origem: (r.origem as string) || 'Loja', origem_detalhe: (r.origem_detalhe as string) || '',
      reservado_por: (r.reservado_por as string) || '',
      custo_unitario: Number(r.custo_unitario) || 0, valor_unitario: Number(r.valor_unitario) || 0,
      valor_contexto: (r.valor_contexto as string) || '', contabilizar: Number(r.contabilizar) || 0,
      status: 'reservado',
    }));
    const legacyByName = new Map<string, number>();
    for (const row of legacyRows) {
      const key = normalizeValorMasterKey(row.material_nome);
      legacyByName.set(key, (legacyByName.get(key) || 0) + row.quantidade);
    }
    const packRows = (packsRes.rows as any[]).map((r: any) => {
      const name = (r.material_nome as string) || '';
      const key = normalizeValorMasterKey(name);
      const legacyQty = legacyByName.get(key) || 0;
      const quantity = Math.max(0, (Number(r.quantidade) || 0) - legacyQty);
      if (legacyQty > 0) legacyByName.set(key, Math.max(0, legacyQty - (Number(r.quantidade) || 0)));
      return {
        id: 0, source: 'pack', material_id: Number(r.material_id) || 0,
        material_nome: name, material_imagem: (r.material_imagem as string) || '',
        quantidade: quantity, quantidade_devolvida: 0, quantidade_consumida: 0,
        estado_regresso: 'Reservado', data_volta: '', notas: `Incluído em ${((r.pack_nome as string) || 'pack de material')}. Ainda não saiu do local.`,
        origem: 'Loja', origem_detalhe: '', reservado_por: '',
        custo_unitario: 0, valor_unitario: 0, valor_contexto: '', contabilizar: 0,
        status: 'reservado', pack_nome: (r.pack_nome as string) || '',
      };
    }).filter((row: any) => row.quantidade > 0);
    const reservations: any[] = [...manualRows, ...legacyRows, ...packRows];

    const reservationRows = reservations.map(row => {
      const key = normalizeValorMasterKey(row.material_nome);
      const alreadyOut = outByName.get(key) || 0;
      const deduct = Math.min(alreadyOut, row.quantidade);
      if (deduct > 0) outByName.set(key, alreadyOut - deduct);
      return { ...row, quantidade: Math.max(0, row.quantidade - deduct) };
    }).filter(row => row.quantidade > 0);

    return { success: true, data: [...reservationRows, ...movementRows] };
  } catch (error) {
    console.error('Erro getMateriaisReservadosResumoEvento:', error);
    return { success: false, data: [] };
  }
}

export async function reservarMaterialPacksParaEvento(data: {
  evento_id: number; evento_nome: string; pack_ids: number[]; servico?: string; reservado_por?: string;
}) {
  try {
    await setupMateriais();
    await seedMaterialPacks();
    let createdReservations = 0;
    let skippedPacks = 0;

    for (const rawPackId of Array.from(new Set((data.pack_ids || []).map(Number).filter(Boolean)))) {
      const packId = Number(rawPackId);
      const packRes = await turso.execute({ sql: "SELECT * FROM material_packs WHERE id=? AND ativo=1", args: [packId] });
      if (packRes.rows.length === 0) continue;
      const pack = packRes.rows[0] as any;
      const exists = await turso.execute({
        sql: "SELECT id, COALESCE(encerrada_sem_fluxo,0) AS encerrada_sem_fluxo FROM material_pack_reservas WHERE evento_id=? AND pack_id=? LIMIT 1",
        args: [data.evento_id, packId],
      });

      const valorReferencia = Number(pack.valor_referencia) || Number(pack.valor_cliente_final) || 0;
      if (exists.rows.length > 0) {
        const existing = exists.rows[0] as any;
        if (Number(existing.encerrada_sem_fluxo || 0) === 1) {
          await turso.execute({
            sql: `UPDATE material_pack_reservas
                  SET encerrada_sem_fluxo=0, encerrada_por='', encerrada_em='', pack_nome=?, servico=?, valor_referencia=?, valor_cobrado=0, desconto_oferta=?, reservado_por=?
                  WHERE id=?`,
            args: [pack.nome || '', data.servico || '', valorReferencia, valorReferencia, data.reservado_por || '', Number(existing.id)],
          });
          createdReservations++;
        } else {
          skippedPacks++;
        }
        continue;
      }

      await turso.execute({
        sql: "INSERT INTO material_pack_reservas (evento_id, pack_id, pack_nome, servico, valor_referencia, valor_cobrado, desconto_oferta, reservado_por, encerrada_sem_fluxo) VALUES (?, ?, ?, ?, ?, 0, ?, ?, 0)",
        args: [data.evento_id, packId, pack.nome || '', data.servico || '', valorReferencia, valorReferencia, data.reservado_por || ''],
      });
      createdReservations++;
    }

    // Reservar é apenas bloquear o material para a data do evento.
    // A saída física só é criada quando alguém carrega em “Registar saída”.
    return { success: true, createdReservations, createdMovements: 0, skippedPacks };
  } catch (error) {
    console.error("Erro reservarMaterialPacksParaEvento:", error);
    return { success: false, message: "Erro ao reservar packs de material.", createdReservations: 0, createdMovements: 0, skippedPacks: 0 };
  }
}

export async function getMaterialPackIdsLead(leadId: number) {
  try {
    await setupMateriais();
    await seedMaterialPacks();
    const res = await turso.execute({ sql: "SELECT pack_id FROM lead_material_packs WHERE lead_id=? AND ativo=1", args: [leadId] });
    return { success: true, data: res.rows.map((r: any) => Number(r.pack_id)).filter(Boolean) };
  } catch (error) {
    console.error("Erro getMaterialPackIdsLead:", error);
    return { success: false, data: [] };
  }
}

export async function syncMaterialPacksLead(leadId: number, packIds: number[]) {
  try {
    await setupMateriais();
    await seedMaterialPacks();
    await turso.execute({ sql: "DELETE FROM lead_material_packs WHERE lead_id=?", args: [leadId] });
    for (const packId of Array.from(new Set((packIds || []).map(Number).filter(Boolean)))) {
      await turso.execute({ sql: "INSERT INTO lead_material_packs (lead_id, pack_id, ativo) VALUES (?, ?, 1)", args: [leadId, packId] });
    }
    return { success: true };
  } catch (error) {
    console.error("Erro syncMaterialPacksLead:", error);
    return { success: false };
  }
}

export async function reservarMaterialPacksDaLeadParaEvento(leadId: number, eventoId: number, eventoNome: string, reservadoPor?: string) {
  try {
    const selected = await getMaterialPackIdsLead(leadId);
    if (!selected.success || selected.data.length === 0) return { success: true, createdMovements: 0, skippedPacks: 0 };
    return await reservarMaterialPacksParaEvento({ evento_id: eventoId, evento_nome: eventoNome, pack_ids: selected.data, servico: "Lead", reservado_por: reservadoPor || '' });
  } catch (error) {
    console.error("Erro reservarMaterialPacksDaLeadParaEvento:", error);
    return { success: false, createdMovements: 0, skippedPacks: 0 };
  }
}

// MATERIAIS — catálogo de equipamento + controlo de saídas/entradas
// ═══════════════════════════════════════════════════════════════════════════

export async function setupMateriais() {
  const g = globalThis as typeof globalThis & {
    __lle_setup_materiais_done?: boolean;
    __lle_setup_materiais_promise?: Promise<{ success: boolean }>;
  };
  if (g.__lle_setup_materiais_done) return { success: true };
  if (g.__lle_setup_materiais_promise) return g.__lle_setup_materiais_promise;
  g.__lle_setup_materiais_promise = (async () => {
  try {
    await turso.execute(`
      CREATE TABLE IF NOT EXISTS materiais (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nome TEXT NOT NULL,
        categoria TEXT DEFAULT '',
        imagem TEXT DEFAULT '',
        quantidade_total INTEGER NOT NULL DEFAULT 1,
        notas TEXT DEFAULT '',
        ativo INTEGER DEFAULT 1,
        created_at TEXT DEFAULT (datetime('now'))
      )
    `);
    await turso.execute(`
      CREATE TABLE IF NOT EXISTS material_movimentos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        material_id INTEGER NOT NULL,
        material_nome TEXT NOT NULL DEFAULT '',
        material_imagem TEXT DEFAULT '',
        quantidade INTEGER NOT NULL DEFAULT 1,
        quantidade_devolvida INTEGER NOT NULL DEFAULT 0,
        origem TEXT NOT NULL DEFAULT 'Loja',
        origem_detalhe TEXT DEFAULT '',
        evento TEXT DEFAULT '',
        responsavel TEXT DEFAULT '',
        notas TEXT DEFAULT '',
        data_saida TEXT DEFAULT (datetime('now')),
        data_volta TEXT,
        created_at TEXT DEFAULT (datetime('now'))
      )
    `);

    const materialCols = [
      "dono TEXT DEFAULT 'LLE'",
      "local_habitual TEXT DEFAULT 'Loja'",
      "consumivel INTEGER DEFAULT 0",
      "stock_minimo INTEGER DEFAULT 0",
      "precisa_comprar INTEGER DEFAULT 0",
      "motivo_compra TEXT DEFAULT ''",
      "quantidade_comprar INTEGER DEFAULT 0",
      "notas_compra TEXT DEFAULT ''",
      "duracao_formato TEXT DEFAULT ''",
      "custo_interno REAL NOT NULL DEFAULT 0",
      "valor_parceiro REAL NOT NULL DEFAULT 0",
      "valor_sud REAL NOT NULL DEFAULT 0",
      "valor_cliente_final REAL NOT NULL DEFAULT 0",
    ];
    for (const col of materialCols) {
      try { await turso.execute(`ALTER TABLE materiais ADD COLUMN ${col}`); } catch { }
    }

    const movimentoCols = [
      "evento_id INTEGER",
      "dono_material TEXT DEFAULT ''",
      "quem_levou TEXT DEFAULT ''",
      "estado_regresso TEXT DEFAULT ''",
      "quantidade_consumida INTEGER DEFAULT 0",
      "precisa_comprar INTEGER DEFAULT 0",
      "motivo_compra TEXT DEFAULT ''",
      "quantidade_comprar INTEGER DEFAULT 0",
      "quem_confirmou_regresso TEXT DEFAULT ''",
      "notas_regresso TEXT DEFAULT ''",
      "saida_confirmada INTEGER DEFAULT 1",
      "custo_unitario REAL NOT NULL DEFAULT 0",
      "valor_unitario REAL NOT NULL DEFAULT 0",
      "valor_contexto TEXT DEFAULT ''",
      "contabilizar INTEGER DEFAULT 0",
    ];
    for (const col of movimentoCols) {
      try { await turso.execute(`ALTER TABLE material_movimentos ADD COLUMN ${col}`); } catch { }
    }

    await ensureMaterialPacksTables();
    await turso.execute(`
      CREATE TABLE IF NOT EXISTS material_reservas (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        evento_id INTEGER NOT NULL,
        material_id INTEGER NOT NULL,
        material_nome TEXT NOT NULL DEFAULT '',
        material_imagem TEXT DEFAULT '',
        quantidade INTEGER NOT NULL DEFAULT 1,
        origem TEXT DEFAULT 'Loja',
        origem_detalhe TEXT DEFAULT '',
        notas TEXT DEFAULT '',
        reservado_por TEXT DEFAULT '',
        custo_unitario REAL NOT NULL DEFAULT 0,
        valor_unitario REAL NOT NULL DEFAULT 0,
        valor_contexto TEXT DEFAULT '',
        contabilizar INTEGER DEFAULT 0,
        ativo INTEGER DEFAULT 1,
        encerrada_sem_fluxo INTEGER DEFAULT 0,
        encerrada_por TEXT DEFAULT '',
        encerrada_em TEXT DEFAULT '',
        created_at TEXT DEFAULT (datetime('now'))
      )
    `);
    const reservaFinanceCols = [
      "custo_unitario REAL NOT NULL DEFAULT 0",
      "valor_unitario REAL NOT NULL DEFAULT 0",
      "valor_contexto TEXT DEFAULT ''",
      "contabilizar INTEGER DEFAULT 0",
      "encerrada_sem_fluxo INTEGER DEFAULT 0",
      "encerrada_por TEXT DEFAULT ''",
      "encerrada_em TEXT DEFAULT ''",
    ];
    for (const col of reservaFinanceCols) {
      try { await turso.execute(`ALTER TABLE material_reservas ADD COLUMN ${col}`); } catch { }
    }
    try { await turso.execute("CREATE INDEX IF NOT EXISTS idx_material_reservas_evento_ativo ON material_reservas(evento_id, ativo)"); } catch { }
    // Registos criados pela antiga ação “Reservar” na Agenda não tinham quem_levou.
    // Quando foram criados mais de 2 dias antes do evento, são reservas e não saídas físicas.
    try {
      await turso.execute(`
        UPDATE material_movimentos
        SET saida_confirmada = 0
        WHERE evento_id IS NOT NULL
          AND COALESCE(quem_levou, '') = ''
          AND data_volta IS NULL
          AND COALESCE(quantidade_devolvida, 0) = 0
          AND COALESCE(quantidade_consumida, 0) = 0
          AND EXISTS (
            SELECT 1 FROM agenda a
            WHERE a.id = material_movimentos.evento_id
              AND date(COALESCE(material_movimentos.data_saida, material_movimentos.created_at, 'now')) < date(a.event_date, '-2 day')
          )
      `);
    } catch { }
    await turso.execute(`
      CREATE TABLE IF NOT EXISTS lead_material_packs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        lead_id INTEGER NOT NULL,
        pack_id INTEGER NOT NULL,
        ativo INTEGER DEFAULT 1,
        created_at TEXT DEFAULT (datetime('now'))
      )
    `);
    try { await turso.execute("CREATE UNIQUE INDEX IF NOT EXISTS idx_lead_material_packs_lead_pack ON lead_material_packs(lead_id, pack_id)"); } catch { }
    return { success: true };
  } catch (error) {
    console.error("Erro setup materiais:", error);
    return { success: false };
  }

  })();
  const result = await g.__lle_setup_materiais_promise;
  if (result.success) g.__lle_setup_materiais_done = true;
  else g.__lle_setup_materiais_promise = undefined;
  return result;
}

// Lista leve de eventos da agenda para selecionar no picker de materiais
export async function getEventosParaMateriais() {
  try {
    const res = await turso.execute(
      "SELECT id, event_name, event_date, status FROM agenda WHERE status != 'Cancelado' ORDER BY event_date ASC"
    );
    return {
      success: true,
      data: res.rows.map((r: any) => ({
        id: Number(r.id),
        title: (r.event_name as string) || '',
        date: (r.event_date as string) || '',
      })),
    };
  } catch (error) {
    console.error("Erro getEventosParaMateriais:", error);
    return { success: false, data: [] };
  }
}

export async function getAllMateriais(limit: number = 500) {
  try {
    await setupMateriais();
    const sql = "SELECT * FROM materiais ORDER BY nome ASC LIMIT ?";
    const res = await turso.execute({ sql, args: [limit] });
    return {
      success: true,
      data: res.rows.map((r: any) => ({
        id: Number(r.id),
        nome: r.nome as string,
        categoria: (r.categoria as string) || '',
        imagem: (r.imagem as string) || '',
        quantidade_total: Number(r.quantidade_total) || 0,
        dono: (r.dono as string) || 'LLE',
        local_habitual: (r.local_habitual as string) || 'Loja',
        consumivel: r.consumivel === 1 || r.consumivel === true ? 1 : 0,
        stock_minimo: Number(r.stock_minimo) || 0,
        precisa_comprar: r.precisa_comprar === 1 || r.precisa_comprar === true ? 1 : 0,
        motivo_compra: (r.motivo_compra as string) || '',
        quantidade_comprar: Number(r.quantidade_comprar) || 0,
        notas_compra: (r.notas_compra as string) || '',
        duracao_formato: (r.duracao_formato as string) || '',
        custo_interno: Number(r.custo_interno) || 0,
        valor_parceiro: Number(r.valor_parceiro) || 0,
        valor_sud: Number(r.valor_sud) || 0,
        valor_cliente_final: Number(r.valor_cliente_final) || 0,
        notas: (r.notas as string) || '',
        ativo: r.ativo === 1 || r.ativo === true ? 1 : 0,
      })),
    };
  } catch (error) {
    console.error("Erro getAllMateriais:", error);
    return { success: false, data: [] };
  }
}

export async function getMaterialById(id: number) {
  const query = async () => {
    const res = await turso.execute({ sql: "SELECT * FROM materiais WHERE id=? LIMIT 1", args: [id] });
    if (res.rows.length === 0) return { success: false, data: null };
    const r = res.rows[0] as any;
    return {
      success: true,
      data: {
        id: Number(r.id), nome: (r.nome as string) || '', categoria: (r.categoria as string) || '',
        imagem: (r.imagem as string) || '', quantidade_total: Number(r.quantidade_total) || 0,
        dono: (r.dono as string) || 'LLE', local_habitual: (r.local_habitual as string) || 'Loja',
        consumivel: r.consumivel === 1 || r.consumivel === true ? 1 : 0, stock_minimo: Number(r.stock_minimo) || 0,
        precisa_comprar: r.precisa_comprar === 1 || r.precisa_comprar === true ? 1 : 0,
        motivo_compra: (r.motivo_compra as string) || '', quantidade_comprar: Number(r.quantidade_comprar) || 0,
        notas_compra: (r.notas_compra as string) || '', duracao_formato: (r.duracao_formato as string) || '',
        custo_interno: Number(r.custo_interno) || 0, valor_parceiro: Number(r.valor_parceiro) || 0,
        valor_sud: Number(r.valor_sud) || 0, valor_cliente_final: Number(r.valor_cliente_final) || 0,
        notas: (r.notas as string) || '', ativo: r.ativo === 1 || r.ativo === true ? 1 : 0,
      },
    };
  };
  try {
    return await query();
  } catch {
    try {
      await setupMateriais();
      return await query();
    } catch (error) {
      console.error('Erro getMaterialById:', error);
      return { success: false, data: null };
    }
  }
}

export async function createMaterial(data: {
  nome: string; categoria?: string; imagem?: string; quantidade_total?: number; notas?: string;
  dono?: string; local_habitual?: string; consumivel?: number; stock_minimo?: number;
  precisa_comprar?: number; motivo_compra?: string; quantidade_comprar?: number; notas_compra?: string;
  duracao_formato?: string; custo_interno?: number; valor_parceiro?: number; valor_sud?: number; valor_cliente_final?: number;
}) {
  try {
    await setupMateriais();
    await turso.execute({
      sql: `INSERT INTO materiais
        (nome, categoria, imagem, quantidade_total, dono, local_habitual, consumivel, stock_minimo, precisa_comprar, motivo_compra, quantidade_comprar, notas_compra, duracao_formato, custo_interno, valor_parceiro, valor_sud, valor_cliente_final, notas)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        data.nome, data.categoria || '', data.imagem || '', data.quantidade_total ?? 1,
        data.dono || 'LLE', data.local_habitual || 'Loja', data.consumivel ?? 0, data.stock_minimo ?? 0,
        data.precisa_comprar ?? 0, data.motivo_compra || '', data.quantidade_comprar ?? 0, data.notas_compra || '',
        data.duracao_formato || '', data.custo_interno || 0, data.valor_parceiro || 0, data.valor_sud || 0, data.valor_cliente_final || 0, data.notas || '',
      ],
    });
    const last = await turso.execute("SELECT last_insert_rowid() as id");
    return { success: true, id: Number(last.rows[0].id) };
  } catch (error) {
    console.error("Erro criar material:", error);
    return { success: false, message: "Erro ao criar material." };
  }
}

export async function updateMaterial(id: number, data: {
  nome: string; categoria?: string; imagem?: string; quantidade_total?: number; notas?: string;
  dono?: string; local_habitual?: string; consumivel?: number; stock_minimo?: number;
  precisa_comprar?: number; motivo_compra?: string; quantidade_comprar?: number; notas_compra?: string;
  duracao_formato?: string; custo_interno?: number; valor_parceiro?: number; valor_sud?: number; valor_cliente_final?: number;
}) {
  try {
    await setupMateriais();
    await turso.execute({
      sql: `UPDATE materiais SET
        nome=?, categoria=?, imagem=?, quantidade_total=?, dono=?, local_habitual=?, consumivel=?, stock_minimo=?,
        precisa_comprar=?, motivo_compra=?, quantidade_comprar=?, notas_compra=?, duracao_formato=?, custo_interno=?, valor_parceiro=?, valor_sud=?, valor_cliente_final=?, notas=?
        WHERE id=?`,
      args: [
        data.nome, data.categoria || '', data.imagem || '', data.quantidade_total ?? 1,
        data.dono || 'LLE', data.local_habitual || 'Loja', data.consumivel ?? 0, data.stock_minimo ?? 0,
        data.precisa_comprar ?? 0, data.motivo_compra || '', data.quantidade_comprar ?? 0, data.notas_compra || '',
        data.duracao_formato || '', data.custo_interno || 0, data.valor_parceiro || 0, data.valor_sud || 0, data.valor_cliente_final || 0, data.notas || '', id,
      ],
    });
    return { success: true };
  } catch (error) {
    console.error("Erro update material:", error);
    return { success: false };
  }
}

export async function updateMaterialCompraStatus(id: number, data: {
  precisa_comprar: number; motivo_compra?: string; quantidade_comprar?: number; notas_compra?: string;
}) {
  try {
    await setupMateriais();
    await turso.execute({
      sql: "UPDATE materiais SET precisa_comprar=?, motivo_compra=?, quantidade_comprar=?, notas_compra=? WHERE id=?",
      args: [data.precisa_comprar, data.motivo_compra || '', data.quantidade_comprar ?? 0, data.notas_compra || '', id],
    });
    return { success: true };
  } catch (error) {
    console.error("Erro updateMaterialCompraStatus:", error);
    return { success: false };
  }
}

export async function toggleMaterialAtivo(id: number, ativo: number) {
  try {
    await turso.execute({ sql: "UPDATE materiais SET ativo=? WHERE id=?", args: [ativo, id] });
    return { success: true };
  } catch { return { success: false }; }
}

export async function getMovimentosMateriais() {
  try {
    await setupMateriais();
    const res = await turso.execute(`
      SELECT mm.*
      FROM material_movimentos mm
      WHERE COALESCE(mm.saida_confirmada, 1)=1
        AND NOT (
          COALESCE(mm.notas, '') LIKE 'Pack incluído/oferta:%'
        AND mm.evento_id IS NOT NULL
        AND EXISTS (
          SELECT 1
          FROM material_pack_reservas r
          JOIN material_pack_items i ON i.pack_id = r.pack_id AND i.ativo = 1
          WHERE r.evento_id = mm.evento_id AND COALESCE(r.encerrada_sem_fluxo,0)=0
            AND LOWER(TRIM(i.material_nome)) = LOWER(TRIM(mm.material_nome))
        )
      )
      ORDER BY mm.data_saida DESC
    `);
    return {
      success: true,
      data: res.rows.map((r: any) => ({
        id: Number(r.id),
        material_id: Number(r.material_id),
        material_nome: (r.material_nome as string) || '',
        material_imagem: (r.material_imagem as string) || '',
        quantidade: Number(r.quantidade) || 0,
        quantidade_devolvida: Number(r.quantidade_devolvida) || 0,
        quantidade_consumida: Number(r.quantidade_consumida) || 0,
        origem: (r.origem as string) || 'Loja',
        origem_detalhe: (r.origem_detalhe as string) || '',
        dono_material: (r.dono_material as string) || '',
        quem_levou: (r.quem_levou as string) || (r.responsavel as string) || '',
        evento: (r.evento as string) || '',
        evento_id: r.evento_id !== null && r.evento_id !== undefined ? Number(r.evento_id) : null,
        responsavel: (r.responsavel as string) || '',
        notas: (r.notas as string) || '',
        estado_regresso: (r.estado_regresso as string) || '',
        precisa_comprar: r.precisa_comprar === 1 || r.precisa_comprar === true ? 1 : 0,
        motivo_compra: (r.motivo_compra as string) || '',
        quantidade_comprar: Number(r.quantidade_comprar) || 0,
        quem_confirmou_regresso: (r.quem_confirmou_regresso as string) || '',
        notas_regresso: (r.notas_regresso as string) || '',
        data_saida: (r.data_saida as string) || '',
        data_volta: (r.data_volta as string) || null,
      })),
    };
  } catch (error) {
    console.error("Erro getMovimentosMateriais:", error);
    return { success: false, data: [] };
  }
}

export async function registarSaidaMaterial(data: {
  material_id: number; material_nome: string; material_imagem?: string;
  quantidade: number; origem: string; origem_detalhe?: string;
  dono_material?: string; quem_levou?: string;
  evento?: string; evento_id?: number | null; responsavel?: string; notas?: string;
}) {
  try {
    await setupMateriais();
    await turso.execute({
      sql: `INSERT INTO material_movimentos
        (material_id, material_nome, material_imagem, quantidade, quantidade_devolvida, quantidade_consumida, origem, origem_detalhe, dono_material, quem_levou, evento, evento_id, responsavel, notas, data_saida, saida_confirmada)
        VALUES (?, ?, ?, ?, 0, 0, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), 1)`,
      args: [
        data.material_id, data.material_nome, data.material_imagem || '',
        data.quantidade, data.origem, data.origem_detalhe || '',
        data.dono_material || '', data.quem_levou || data.responsavel || '',
        data.evento || '', data.evento_id ?? null, data.responsavel || '', data.notas || '',
      ],
    });
    const last = await turso.execute("SELECT last_insert_rowid() as id");
    return { success: true, id: Number(last.rows[0].id) };
  } catch (error) {
    console.error("Erro registar saída material:", error);
    return { success: false, message: "Erro ao registar saída." };
  }
}

export async function registarVoltaMaterial(id: number, quantidade_devolvida: number, quantidade_total: number, detalhes?: {
  quantidade_consumida?: number;
  estado_regresso?: string;
  precisa_comprar?: number;
  motivo_compra?: string;
  quantidade_comprar?: number;
  quem_confirmou_regresso?: string;
  notas_regresso?: string;
}) {
  try {
    await setupMateriais();
    const quantidadeConsumida = Math.max(0, detalhes?.quantidade_consumida ?? 0);
    const fechado = quantidade_devolvida + quantidadeConsumida >= quantidade_total;
    await turso.execute({
      sql: `UPDATE material_movimentos SET
        quantidade_devolvida=?, quantidade_consumida=?, data_volta=?, estado_regresso=?, precisa_comprar=?, motivo_compra=?, quantidade_comprar=?, quem_confirmou_regresso=?, notas_regresso=?
        WHERE id=?`,
      args: [
        quantidade_devolvida,
        quantidadeConsumida,
        fechado ? new Date().toISOString().slice(0, 19).replace('T', ' ') : null,
        detalhes?.estado_regresso || (fechado ? 'OK' : 'Parcial'),
        detalhes?.precisa_comprar ?? 0,
        detalhes?.motivo_compra || '',
        detalhes?.quantidade_comprar ?? 0,
        detalhes?.quem_confirmou_regresso || '',
        detalhes?.notas_regresso || '',
        id,
      ],
    });

    if (detalhes?.precisa_comprar) {
      const row = await turso.execute({ sql: "SELECT material_id FROM material_movimentos WHERE id=?", args: [id] });
      const materialId = Number((row.rows[0] as any)?.material_id || 0);
      if (materialId) {
        await turso.execute({
          sql: "UPDATE materiais SET precisa_comprar=1, motivo_compra=?, quantidade_comprar=?, notas_compra=? WHERE id=?",
          args: [detalhes.motivo_compra || '', detalhes.quantidade_comprar ?? 0, detalhes.notas_regresso || '', materialId],
        });
      }
    }
    return { success: true };
  } catch (error) {
    console.error("Erro registar volta material:", error);
    return { success: false };
  }
}

export async function deleteMovimentoMaterial(id: number) {
  try {
    await setupMateriais();
    const rowRes = await turso.execute({ sql: "SELECT * FROM material_movimentos WHERE id=? LIMIT 1", args: [id] });
    const row = rowRes.rows[0] as any;
    let newBill = 0;
    if (row && Number(row.contabilizar || 0) === 1 && row.evento_id) {
      let valorUnit = Number(row.valor_unitario || 0);
      if (!valorUnit) valorUnit = (await valoresMaterialEvento(Number(row.evento_id), Number(row.material_id))).valor;
      newBill = await ajustarFaturacaoEventoPorMaterial(Number(row.evento_id), -valorUnit * Math.max(1, Number(row.quantidade) || 1));
    }
    await turso.execute({ sql: "DELETE FROM material_movimentos WHERE id=?", args: [id] });
    return { success: true, new_bill: newBill };
  } catch { return { success: false }; }
}


async function getMaterialFinanceMapForEventIds(eventIds: number[]) {
  const ids = Array.from(new Set(eventIds.map(Number).filter(Boolean)));
  const out: Record<number, { material_revenue: number; material_cost: number; material_count: number }> = {};
  if (!ids.length) return out;
  try {
    await setupMateriais();
    const placeholders = ids.map(() => '?').join(',');
    const [reservas, movimentos, presencas] = await Promise.all([
      turso.execute({
        sql: `SELECT evento_id,
                     COALESCE(SUM(quantidade * valor_unitario),0) AS receita,
                     COALESCE(SUM(quantidade * custo_unitario),0) AS custo
              FROM material_reservas
              WHERE ativo=1 AND contabilizar=1 AND evento_id IN (${placeholders})
              GROUP BY evento_id`,
        args: ids,
      }),
      turso.execute({
        sql: `SELECT evento_id,
                     COALESCE(SUM(quantidade * valor_unitario),0) AS receita,
                     COALESCE(SUM(quantidade * custo_unitario),0) AS custo
              FROM material_movimentos
              WHERE contabilizar=1 AND evento_id IN (${placeholders})
              GROUP BY evento_id`,
        args: ids,
      }),
      turso.execute({
        sql: `SELECT evento_id, 1 AS material_count
              FROM (
                SELECT evento_id FROM material_reservas
                WHERE ativo=1 AND COALESCE(encerrada_sem_fluxo,0)=0 AND evento_id IN (${placeholders})
                UNION
                SELECT r.evento_id FROM material_pack_reservas r
                JOIN material_pack_items i ON i.pack_id=r.pack_id AND i.ativo=1
                WHERE COALESCE(r.encerrada_sem_fluxo,0)=0 AND r.evento_id IN (${placeholders})
                UNION
                SELECT evento_id FROM material_movimentos
                WHERE COALESCE(saida_confirmada,1)=1 AND evento_id IN (${placeholders})
              ) x
              GROUP BY evento_id`,
        args: [...ids, ...ids, ...ids],
      }),
    ]);
    for (const id of ids) out[id] = { material_revenue: 0, material_cost: 0, material_count: 0 };
    for (const row of [...(reservas.rows as any[]), ...(movimentos.rows as any[])]) {
      const id = Number(row.evento_id) || 0;
      if (!id) continue;
      const cur = out[id] || { material_revenue: 0, material_cost: 0, material_count: 0 };
      cur.material_revenue += Number(row.receita || 0);
      cur.material_cost += Number(row.custo || 0);
      out[id] = cur;
    }
    for (const row of presencas.rows as any[]) {
      const id = Number(row.evento_id) || 0;
      if (!id) continue;
      const cur = out[id] || { material_revenue: 0, material_cost: 0, material_count: 0 };
      cur.material_count = Number(row.material_count || 0) > 0 ? 1 : 0;
      out[id] = cur;
    }
    return out;
  } catch (error) {
    console.error('Erro material finance map:', error);
    return out;
  }
}

// ── PAGE BUNDLES: carregamento por mês + lazy lookups ────────────────────────
// Datas antigas da app existem em formatos diferentes (YYYY-MM-DD e DD/MM/YYYY).
// Nunca filtrar diretamente com event_date >= YYYY-MM-DD sem normalizar primeiro.
function sqlDateExpr(column: string) {
  return `(CASE
    WHEN substr(${column},1,10) GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]' THEN substr(${column},1,10)
    WHEN substr(${column},1,10) GLOB '[0-9][0-9]/[0-9][0-9]/[0-9][0-9][0-9][0-9]' THEN substr(${column},7,4) || '-' || substr(${column},4,2) || '-' || substr(${column},1,2)
    ELSE ${column}
  END)`;
}

function monthBounds(ym?: string) {
  const now = new Date();
  const safe = /^\d{4}-\d{2}$/.test(ym || '') ? ym! : `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const [y, m] = safe.split('-').map(Number);
  const last = new Date(y, m, 0).getDate();
  return { ym: safe, y, m, mm: String(m).padStart(2, '0'), start: `${safe}-01`, end: `${safe}-${String(last).padStart(2, '0')}` };
}

function toIsoDateServer(value: unknown) {
  const v = String(value || '').trim();
  if (!v) return '';
  const iso = v.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (iso) return `${iso[1]}-${iso[2].padStart(2, '0')}-${iso[3].padStart(2, '0')}`;
  const pt = v.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (pt) return `${pt[3]}-${pt[2].padStart(2, '0')}-${pt[1].padStart(2, '0')}`;
  return v;
}

function monthKeyServer(value: unknown) {
  const iso = toIsoDateServer(value);
  return /^\d{4}-\d{2}/.test(iso) ? iso.slice(0, 7) : '';
}

function monthLikeArgs(ym: string) {
  const { y, m, mm } = monthBounds(ym);
  // Suporta datas novas YYYY-MM-DD e datas antigas DD/MM/YYYY ou D/M/YYYY.
  return [`${ym}%`, `%/${mm}/${y}%`, `%/${m}/${y}%`];
}

function normalizeAgendaRow(r: any) {
  return {
    ...r,
    id: Number(r.id),
    title: (r.event_name as string) || '',
    time_range: (r.location as string) || '',
    venue: (r.venue as string) || '',
    tipo: (r.staff_needed as string) || '',
    bill: Number(r.client_cachet) || 0,
    cancelled: r.status === 'Cancelado' ? 1 : 0,
    billing_status: (r.billing_status as string) || '',
    cliente_id: r.cliente_id || null,
    cliente_nome: (r.cliente_nome as string) || '',
    modalidade: (r.modalidade as string) || 'Fatura',
    tipo_comercial: (r.tipo_comercial as string) || 'Evento',
    servico_comercial: (r.servico_comercial as string) || '',
    valor_contexto: (r.valor_contexto as string) || 'Cliente Final',
    autobudget_snapshot: (r.autobudget_snapshot as string) || '',
    origem_lead_id: r.origem_lead_id ? Number(r.origem_lead_id) : null,
    contacto: (r.contacto as string) || '',
    notas: (r.notas as string) || '',
    event_id: (r.event_id as string) || '',
    residencia_id: r.residencia_id == null ? null : Number(r.residencia_id),
  };
}

function normalizeLeadRow(r: any) {
  return {
    ...r,
    id: Number(r.id),
    title: r.title || r.project_name || r.event_name || '(sem título)',
    event_date: (r.event_date as string) || '',
    value: Number(r.value) || 0,
    status: (r.status as string) || 'Contacto',
    status_icon: (r.status_icon as string) || '',
    local: r.details ? extractField(r.details as string, 'Local') : ((r.local as string) || ''),
    contacto: r.details ? extractField(r.details as string, 'Contacto') : ((r.contacto as string) || ''),
    notas: r.details ? extractField(r.details as string, 'Notas') : ((r.notas as string) || ''),
    cancelled: r.status === 'Cancelado' ? 1 : 0,
    cliente_id: r.cliente_id || null,
    cliente_nome: (r.client_name as string) || '',
    modalidade: (r.modalidade as string) || 'Fatura',
    tipo_comercial: (r.tipo_comercial as string) || 'Evento',
    servico_comercial: (r.servico_comercial as string) || '',
    valor_contexto: (r.valor_contexto as string) || 'Cliente Final',
    autobudget_snapshot: (r.autobudget_snapshot as string) || '',
    agenda_event_id: r.agenda_event_id ? Number(r.agenda_event_id) : null,
    event_id: (r.event_id as string) || '',
    residencia_id: r.residencia_id == null ? null : Number(r.residencia_id),
  };
}

async function getArtistasMapForEventoIds(eventoIds: number[]) {
  await ensureArtistasColaboradorIdColumn();
  const ids = Array.from(new Set(eventoIds.map(Number).filter(n => Number.isFinite(n) && n !== 0)));
  if (ids.length === 0) return { success: true, data: {} as Record<number, any[]> };
  const placeholders = ids.map(() => '?').join(',');
  const res = await turso.execute({
    sql: `SELECT id, evento_id, nome, tipo, fee, colaborador_id FROM artistas_evento WHERE evento_id IN (${placeholders}) ORDER BY evento_id ASC, id ASC`,
    args: ids,
  });
  const map: Record<number, { id: number; nome: string; tipo: string; fee: number; colaborador_id: number | null }[]> = {};
  for (const r of res.rows as any[]) {
    const eid = Number(r.evento_id);
    if (!map[eid]) map[eid] = [];
    map[eid].push({ id: Number(r.id), nome: r.nome as string, tipo: r.tipo as string, fee: Number(r.fee), colaborador_id: r.colaborador_id == null ? null : Number(r.colaborador_id) });
  }
  return { success: true, data: map };
}

export async function getAgendaMonthIndex() {
  noStore();
  try {
    // Não usar WHERE por mês aqui. É uma query leve só com datas e evita partir tabs por formatos antigos.
    const [agendaDates, leadDates] = await Promise.all([
      turso.execute("SELECT event_date FROM agenda WHERE event_date IS NOT NULL AND event_date <> ''"),
      turso.execute("SELECT event_date FROM leads WHERE event_date IS NOT NULL AND event_date <> ''"),
    ]);
    const months = Array.from(new Set([
      ...agendaDates.rows.map((r: any) => monthKeyServer(r.event_date)),
      ...leadDates.rows.map((r: any) => monthKeyServer(r.event_date)),
      monthBounds().ym,
    ].filter((m: any) => /^\d{4}-\d{2}$/.test(String(m || ''))))).sort();
    return { success: true, data: months };
  } catch (error) {
    console.error('Erro getAgendaMonthIndex:', error);
    return { success: false, data: [monthBounds().ym] };
  }
}

export async function getAgendaWhatsAppBundle(userName: string = 'Admin', startDate: string, endDate: string) {
  noStore();
  try {
    const start = toIsoDateServer(startDate);
    const end = toIsoDateServer(endDate);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(start) || !/^\d{4}-\d{2}-\d{2}$/.test(end)) {
      return { success: false, agenda: [], leads: [], artistas: {}, message: 'Intervalo de datas inválido.' };
    }
    if (end < start) {
      return { success: false, agenda: [], leads: [], artistas: {}, message: 'A data final não pode ser anterior à inicial.' };
    }

    const startYear = Number(start.slice(0, 4));
    const endYear = Number(end.slice(0, 4));
    const years = Array.from({ length: Math.max(0, endYear - startYear + 1) }, (_, index) => startYear + index);
    const agendaLegacyClause = years.length ? years.map(() => 'event_date LIKE ?').join(' OR ') : '0';
    const leadLegacyClause = years.length ? years.map(() => 'l.event_date LIKE ?').join(' OR ') : '0';
    const visibilityClause = userName === 'Larissa' ? "visibility = 'Public' AND " : '';

    const [agendaRes, leadsRes] = await Promise.all([
      turso.execute({
        sql: `SELECT * FROM agenda
              WHERE ${visibilityClause}(${sqlDateExpr('event_date')} BETWEEN ? AND ? OR ${agendaLegacyClause})
              ORDER BY ${sqlDateExpr('event_date')} ASC, id ASC`,
        args: [start, end, ...years.map(year => `%/${year}%`)],
      }),
      turso.execute({
        sql: `SELECT l.*, (SELECT a.id FROM agenda a WHERE a.origem_lead_id = l.id LIMIT 1) as agenda_event_id
              FROM leads l
              WHERE (${sqlDateExpr('l.event_date')} BETWEEN ? AND ? OR ${leadLegacyClause})
              ORDER BY ${sqlDateExpr('l.event_date')} ASC, l.id ASC`,
        args: [start, end, ...years.map(year => `%/${year}%`)],
      }),
    ]);

    const agendaData = agendaRes.rows
      .map(normalizeAgendaRow)
      .map((event: any) => ({ ...event, event_date: toIsoDateServer(event.event_date) }))
      .filter((event: any) => event.event_date >= start && event.event_date <= end);
    const leadsData = leadsRes.rows
      .map(normalizeLeadRow)
      .map((lead: any) => ({ ...lead, event_date: toIsoDateServer(lead.event_date) }))
      .filter((lead: any) => lead.event_date >= start && lead.event_date <= end);

    const artists = await getArtistasMapForEventoIds([
      ...agendaData.map((event: any) => Number(event.id)),
      ...leadsData.map((lead: any) => -Number(lead.id)),
    ]);

    return {
      success: true,
      agenda: agendaData,
      leads: leadsData,
      artistas: artists.success ? artists.data : {},
    };
  } catch (error) {
    console.error('Erro getAgendaWhatsAppBundle:', error);
    return { success: false, agenda: [], leads: [], artistas: {}, message: 'Não foi possível preparar a agenda para WhatsApp.' };
  }
}

export async function getAgendaPdfBundle(userName: string = 'Admin', startDate: string, endDate: string) {
  noStore();
  try {
    const start = toIsoDateServer(startDate);
    const end = toIsoDateServer(endDate);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(start) || !/^\d{4}-\d{2}-\d{2}$/.test(end)) {
      return { success: false, data: [], message: 'Intervalo de datas inválido.' };
    }
    if (end < start) return { success: false, data: [], message: 'A data final não pode ser anterior à inicial.' };

    const visibilityClause = userName === 'Larissa' ? "visibility = 'Public' AND " : '';
    const startYear = Number(start.slice(0, 4));
    const endYear = Number(end.slice(0, 4));
    const years = Array.from({ length: Math.max(0, endYear - startYear + 1) }, (_, index) => startYear + index);
    const legacyYearClause = years.length ? years.map(() => "event_date LIKE ?").join(" OR ") : "0";
    const agendaRes = await turso.execute({
      sql: `SELECT * FROM agenda
            WHERE ${visibilityClause}(${sqlDateExpr('event_date')} BETWEEN ? AND ? OR ${legacyYearClause})
            ORDER BY ${sqlDateExpr('event_date')} ASC, id ASC`,
      args: [start, end, ...years.map(year => `%/${year}%`)],
    });
    const agendaData = agendaRes.rows
      .map(normalizeAgendaRow)
      .map((event: any) => ({ ...event, event_date: toIsoDateServer(event.event_date) }))
      .filter((event: any) => event.event_date >= start && event.event_date <= end);

    const artists = await getArtistasMapForEventoIds(agendaData.map((event: any) => Number(event.id)));
    // Limitar concorrência: cada resumo executa quatro queries; evitar uma rajada excessiva
    // ao imprimir meses com muitos eventos no ambiente serverless da Vercel/Turso.
    const materialEntries: (readonly [number, any[]])[] = [];
    const materialConcurrency = 4;
    for (let index = 0; index < agendaData.length; index += materialConcurrency) {
      const batch = agendaData.slice(index, index + materialConcurrency);
      const batchEntries = await Promise.all(batch.map(async (event: any) => {
        const result = await getMateriaisReservadosResumoEvento(Number(event.id));
        return [Number(event.id), result.success ? result.data : []] as const;
      }));
      materialEntries.push(...batchEntries);
    }
    const materialsMap = Object.fromEntries(materialEntries);

    return {
      success: true,
      data: agendaData.map((event: any) => ({
        ...event,
        artistas: artists.success ? (artists.data[Number(event.id)] || []) : [],
        materiais: materialsMap[Number(event.id)] || [],
      })),
    };
  } catch (error) {
    console.error('Erro getAgendaPdfBundle:', error);
    return { success: false, data: [], message: 'Não foi possível preparar o relatório de eventos.' };
  }
}

export async function getAgendaPageBundle(userName: string = 'Admin', month?: string) {
  noStore();
  try {
    const { ym } = monthBounds(month);
    const likeArgs = monthLikeArgs(ym);
    const agendaMonthSql = `(event_date LIKE ? OR event_date LIKE ? OR event_date LIKE ?)`;
    const leadMonthSql = `(l.event_date LIKE ? OR l.event_date LIKE ? OR l.event_date LIKE ?)`;
    const agendaWhere = userName === 'Larissa'
      ? `WHERE visibility = 'Public' AND ${agendaMonthSql}`
      : `WHERE ${agendaMonthSql}`;

    // SELECT * evita crash se uma BD antiga ainda não tiver alguma coluna nova; normalizadores fazem fallback.
    const agendaRes = await turso.execute({
      sql: `SELECT * FROM agenda ${agendaWhere} ORDER BY event_date ASC, id ASC`,
      args: likeArgs,
    });
    const leadsRes = await turso.execute({
      sql: `SELECT l.*, (SELECT a.id FROM agenda a WHERE a.origem_lead_id = l.id LIMIT 1) as agenda_event_id
            FROM leads l
            WHERE ${leadMonthSql}
            ORDER BY COALESCE(l.event_date, '9999-99-99') ASC, l.id ASC`,
      args: likeArgs,
    });

    // Filtro final em JS para normalizar DD/MM/YYYY, D/M/YYYY, YYYY-MM-DD e datas com hora.
    const rawAgendaData = agendaRes.rows.map(normalizeAgendaRow).filter((r: any) => monthKeyServer(r.event_date) === ym);
    const rawLeadsData = leadsRes.rows.map(normalizeLeadRow).filter((r: any) => monthKeyServer(r.event_date) === ym);
    const materialFinance = await getMaterialFinanceMapForEventIds(rawAgendaData.map((e: any) => Number(e.id)));
    const agendaData = rawAgendaData.map((e: any) => ({ ...e, ...(materialFinance[Number(e.id)] || { material_revenue: 0, material_cost: 0, material_count: 0 }) }));
    const leadsData = rawLeadsData.map((l: any) => ({ ...l, ...(l.agenda_event_id ? (materialFinance[Number(l.agenda_event_id)] || { material_revenue: 0, material_cost: 0, material_count: 0 }) : { material_revenue: 0, material_cost: 0, material_count: 0 }) }));
    const artists = await getArtistasMapForEventoIds([...agendaData.map((e: any) => Number(e.id)), ...leadsData.map((l: any) => -Number(l.id))]);
    const [months, conflicts] = await Promise.all([getAgendaMonthIndex(), getArtistConflictOverrides()]);
    return {
      success: true,
      agenda: { success: true, data: agendaData },
      leads: { success: true, data: leadsData },
      artistas: artists,
      conflicts,
      months,
    };
  } catch (error) {
    console.error('Erro getAgendaPageBundle:', error);
    return { success: false };
  }
}

export async function getLeadsPageBundle(month?: string) {
  noStore();
  try {
    const { ym } = monthBounds(month);
    const likeArgs = monthLikeArgs(ym);
    const leadMonthSql = `(l.event_date LIKE ? OR l.event_date LIKE ? OR l.event_date LIKE ?)`;
    const agendaMonthSql = `(event_date LIKE ? OR event_date LIKE ? OR event_date LIKE ?)`;

    const leadsRes = await turso.execute({
      sql: `SELECT l.*, (SELECT a.id FROM agenda a WHERE a.origem_lead_id = l.id LIMIT 1) as agenda_event_id
            FROM leads l
            WHERE ${leadMonthSql}
            ORDER BY COALESCE(l.event_date, '9999-99-99') ASC, l.id ASC`,
      args: likeArgs,
    });
    const agendaRes = await turso.execute({
      sql: `SELECT * FROM agenda WHERE ${agendaMonthSql} ORDER BY event_date ASC, id ASC`,
      args: likeArgs,
    });

    const rawLeadsData = leadsRes.rows.map(normalizeLeadRow).filter((r: any) => monthKeyServer(r.event_date) === ym);
    const rawAgendaRows = agendaRes.rows.map(normalizeAgendaRow).filter((r: any) => monthKeyServer(r.event_date) === ym);
    const materialFinance = await getMaterialFinanceMapForEventIds(rawAgendaRows.map((e: any) => Number(e.id)));
    const leadsData = rawLeadsData.map((l: any) => ({ ...l, ...(l.agenda_event_id ? (materialFinance[Number(l.agenda_event_id)] || { material_revenue: 0, material_cost: 0, material_count: 0 }) : { material_revenue: 0, material_cost: 0, material_count: 0 }) }));
    const agendaData = rawAgendaRows.map((r: any) => ({
      id: Number(r.id), title: r.title || '', event_date: r.event_date || '', event_id: r.event_id || '', origem_lead_id: r.origem_lead_id ?? null, cancelled: r.cancelled || 0,
      ...(materialFinance[Number(r.id)] || { material_revenue: 0, material_cost: 0, material_count: 0 }),
    }));
    const artists = await getArtistasMapForEventoIds([...agendaData.map((e: any) => Number(e.id)), ...leadsData.map((l: any) => -Number(l.id))]);
    const [months, conflicts] = await Promise.all([getAgendaMonthIndex(), getArtistConflictOverrides()]);
    return {
      success: true,
      leads: { success: true, data: leadsData },
      agenda: { success: true, data: agendaData },
      artistas: artists,
      conflicts,
      months,
    };
  } catch (error) {
    console.error('Erro getLeadsPageBundle:', error);
    return { success: false };
  }
}

export async function getAgendaFormLookups() {
  try {
    const [clientes, colaboradores, valoresFuncoes, valoresMaster, residencias, packsComerciais] = await Promise.all([
      getAllClientes(),
      getAllColaboradores(),
      getAllValoresFuncoes(),
      getAllValoresMaster(),
      getAllResidenciasAtivas(),
      getAllPacksComerciais(),
    ]);
    return { success: true, clientes, colaboradores, valoresFuncoes, valoresMaster, residencias, packsComerciais };
  } catch (error) {
    console.error('Erro getAgendaFormLookups:', error);
    return { success: false };
  }
}

export async function getLeadsFormLookups() {
  try {
    const [clientes, colaboradores, valoresFuncoes, valoresMaster, residencias, packsComerciais] = await Promise.all([
      getAllClientes(),
      getAllColaboradores(),
      getAllValoresFuncoes(),
      getAllValoresMaster(),
      getAllResidenciasAtivas(),
      getAllPacksComerciais(),
    ]);
    return { success: true, clientes, colaboradores, valoresFuncoes, valoresMaster, residencias, packsComerciais };
  } catch (error) {
    console.error('Erro getLeadsFormLookups:', error);
    return { success: false };
  }
}

export async function getMaterialPackIdsForServico(servico: string, contexto: string = 'Normal') {
  try {
    if (!servico.trim()) return { success: true, data: [] as number[] };
    await seedMaterialPacks();
    const q = servico.trim().toLowerCase();
    const c = (contexto || 'Normal').trim().toLowerCase();
    const res = await turso.execute({
      sql: `SELECT DISTINCT pack_id FROM servico_material_packs
            WHERE ativo=1
              AND LOWER(TRIM(servico)) = ?
              AND (LOWER(TRIM(COALESCE(contexto,'Normal'))) = ? OR LOWER(TRIM(COALESCE(contexto,'Normal'))) = 'normal')`,
      args: [q, c],
    });
    return { success: true, data: res.rows.map((r: any) => Number(r.pack_id)).filter(Boolean) };
  } catch (error) {
    console.error('Erro getMaterialPackIdsForServico:', error);
    return { success: false, data: [] as number[] };
  }
}


function mapMovimentoMaterialRow(r: any, includeImage = true) {
  return {
    id: Number(r.id),
    material_id: Number(r.material_id),
    material_nome: (r.material_nome as string) || '',
    material_imagem: includeImage ? ((r.material_imagem as string) || '') : '',
    quantidade: Number(r.quantidade) || 0,
    quantidade_devolvida: Number(r.quantidade_devolvida) || 0,
    quantidade_consumida: Number(r.quantidade_consumida) || 0,
    origem: (r.origem as string) || 'Loja',
    origem_detalhe: (r.origem_detalhe as string) || '',
    dono_material: (r.dono_material as string) || '',
    quem_levou: (r.quem_levou as string) || (r.responsavel as string) || '',
    evento: (r.evento as string) || '',
    evento_id: r.evento_id !== null && r.evento_id !== undefined ? Number(r.evento_id) : null,
    responsavel: (r.responsavel as string) || '',
    notas: (r.notas as string) || '',
    estado_regresso: (r.estado_regresso as string) || '',
    precisa_comprar: r.precisa_comprar === 1 || r.precisa_comprar === true ? 1 : 0,
    motivo_compra: (r.motivo_compra as string) || '',
    quantidade_comprar: Number(r.quantidade_comprar) || 0,
    quem_confirmou_regresso: (r.quem_confirmou_regresso as string) || '',
    notas_regresso: (r.notas_regresso as string) || '',
    data_saida: (r.data_saida as string) || '',
    data_volta: (r.data_volta as string) || null,
  };
}

async function cleanupFutureAutoReservationMovements() {
  // Migração v2: versões anteriores criavam movimentos de “saída” automaticamente
  // quando um pack era apenas reservado. Estes movimentos nunca representaram uma
  // saída física e devem ser removidos, independentemente da data do evento.
  const g = globalThis as typeof globalThis & { __lle_reservas_sem_saida_v2_done?: boolean };
  if (g.__lle_reservas_sem_saida_v2_done) return;
  const migrationKey = 'materiais_reservas_sem_saida_v2_20260715';
  try {
    try {
      if (await hasMigration(migrationKey)) {
        g.__lle_reservas_sem_saida_v2_done = true;
        return;
      }
    } catch {
      await ensureLleMetaTable();
    }
    await turso.execute(`
      DELETE FROM material_movimentos
      WHERE data_volta IS NULL
        AND COALESCE(quantidade_devolvida, 0) = 0
        AND COALESCE(quantidade_consumida, 0) = 0
        AND COALESCE(notas, '') LIKE 'Pack incluído/oferta:%'
        AND evento_id IS NOT NULL
        AND EXISTS (
          SELECT 1
          FROM material_pack_reservas r
          JOIN material_pack_items i ON i.pack_id = r.pack_id AND i.ativo = 1
          WHERE r.evento_id = material_movimentos.evento_id AND COALESCE(r.encerrada_sem_fluxo,0)=0
            AND LOWER(TRIM(i.material_nome)) = LOWER(TRIM(material_movimentos.material_nome))
        )
    `);
    await markMigration(migrationKey);
    g.__lle_reservas_sem_saida_v2_done = true;
  } catch {
    // Em bases antigas as tabelas podem ainda não existir; o filtro de leitura abaixo
    // continua a impedir que estas reservas sejam apresentadas como material fora.
  }
}

async function queryMateriaisInitialBundleFast() {
  await cleanupFutureAutoReservationMovements();

  // Entrada rápida: operação atual + reservas. Catálogo, histórico, packs detalhados e valores continuam lazy.
  const [statsRes, openRes, packReservationsRes, manualReservationsRes, legacyReservationsRes] = await Promise.all([
    turso.execute(`
      SELECT COUNT(*) AS ativos, COALESCE(SUM(quantidade_total), 0) AS unidades
      FROM materiais WHERE ativo = 1
    `),
    turso.execute(`
      SELECT mm.id, mm.material_id, mm.material_nome,
             COALESCE(NULLIF(mm.material_imagem, ''), m.imagem, '') AS material_imagem,
             mm.quantidade, mm.quantidade_devolvida, mm.quantidade_consumida,
             mm.origem, mm.origem_detalhe, mm.dono_material, mm.quem_levou, mm.evento, mm.evento_id,
             mm.responsavel, mm.notas, mm.estado_regresso, mm.precisa_comprar, mm.motivo_compra,
             mm.quantidade_comprar, mm.quem_confirmou_regresso, mm.notas_regresso, mm.data_saida, mm.data_volta
      FROM material_movimentos mm
      LEFT JOIN materiais m ON m.id = mm.material_id
      WHERE COALESCE(mm.saida_confirmada, 1)=1
        AND mm.quantidade > COALESCE(mm.quantidade_devolvida, 0) + COALESCE(mm.quantidade_consumida, 0)
        AND NOT (
          COALESCE(mm.notas, '') LIKE 'Pack incluído/oferta:%'
          AND mm.evento_id IS NOT NULL
          AND EXISTS (
            SELECT 1 FROM material_pack_reservas r
            JOIN material_pack_items i ON i.pack_id = r.pack_id AND i.ativo = 1
            WHERE r.evento_id = mm.evento_id AND COALESCE(r.encerrada_sem_fluxo,0)=0
              AND LOWER(TRIM(i.material_nome)) = LOWER(TRIM(mm.material_nome))
          )
        )
      ORDER BY mm.data_saida DESC LIMIT 100
    `),
    turso.execute(`
      SELECT r.evento_id, COALESCE(a.event_name, r.servico, r.pack_nome, 'Evento') AS evento_nome,
             COALESCE(a.event_date, '') AS evento_data, GROUP_CONCAT(DISTINCT r.pack_nome) AS pack_nome,
             GROUP_CONCAT(DISTINCT r.reservado_por) AS reservado_por, i.material_nome,
             SUM(COALESCE(i.quantidade, 1)) AS quantidade, COALESCE(MAX(m.id), 0) AS material_id,
             COALESCE(MAX(m.imagem), '') AS material_imagem, COALESCE(MAX(m.local_habitual), 'Loja') AS local_habitual,
             COALESCE(MAX(m.dono), 'LLE') AS dono_material
      FROM material_pack_reservas r
      JOIN material_pack_items i ON i.pack_id = r.pack_id AND i.ativo = 1
      LEFT JOIN agenda a ON a.id = r.evento_id
      LEFT JOIN materiais m ON LOWER(TRIM(m.nome)) = LOWER(TRIM(i.material_nome)) AND m.ativo = 1
      WHERE COALESCE(r.encerrada_sem_fluxo,0)=0
        AND (a.status IS NULL OR a.status != 'Cancelado')
        AND (a.event_date IS NULL OR date(a.event_date) >= date('now', '-1 day'))
      GROUP BY r.evento_id, evento_nome, evento_data, i.material_nome
      ORDER BY CASE WHEN evento_data = '' THEN 1 ELSE 0 END, evento_data ASC, evento_nome ASC, i.material_nome ASC
    `),
    turso.execute(`
      SELECT mr.id AS reserva_id, mr.evento_id, COALESCE(a.event_name, 'Evento') AS evento_nome,
             COALESCE(a.event_date, '') AS evento_data, '' AS pack_nome, mr.reservado_por,
             mr.material_id, mr.material_nome, COALESCE(NULLIF(mr.material_imagem,''), m.imagem, '') AS material_imagem,
             mr.quantidade, COALESCE(m.local_habitual, mr.origem, 'Loja') AS local_habitual,
             COALESCE(m.dono, 'LLE') AS dono_material
      FROM material_reservas mr
      LEFT JOIN agenda a ON a.id=mr.evento_id
      LEFT JOIN materiais m ON m.id=mr.material_id
      WHERE mr.ativo=1 AND COALESCE(mr.encerrada_sem_fluxo,0)=0 AND (a.status IS NULL OR a.status!='Cancelado')
        AND (a.event_date IS NULL OR date(a.event_date) >= date('now','-1 day'))
      ORDER BY a.event_date ASC, mr.id ASC
    `),
    turso.execute(`
      SELECT mm.id AS reserva_id, mm.evento_id, COALESCE(a.event_name, mm.evento, 'Evento') AS evento_nome,
             COALESCE(a.event_date, '') AS evento_data, '' AS pack_nome, mm.responsavel AS reservado_por,
             mm.material_id, mm.material_nome, COALESCE(NULLIF(mm.material_imagem,''), m.imagem, '') AS material_imagem,
             mm.quantidade - COALESCE(mm.quantidade_devolvida,0) - COALESCE(mm.quantidade_consumida,0) AS quantidade,
             COALESCE(m.local_habitual, mm.origem, 'Loja') AS local_habitual, COALESCE(m.dono, mm.dono_material, 'LLE') AS dono_material
      FROM material_movimentos mm
      LEFT JOIN agenda a ON a.id=mm.evento_id
      LEFT JOIN materiais m ON m.id=mm.material_id
      WHERE COALESCE(mm.saida_confirmada,1)=0
        AND mm.quantidade > COALESCE(mm.quantidade_devolvida,0)+COALESCE(mm.quantidade_consumida,0)
        AND (a.status IS NULL OR a.status!='Cancelado')
      ORDER BY a.event_date ASC, mm.id ASC
    `),
  ]);

  const movimentos = (openRes.rows as any[]).map(row => mapMovimentoMaterialRow(row, true));
  const actualByEventMaterial = new Map<string, number>();
  for (const mov of movimentos) {
    if (!mov.evento_id) continue;
    const key = `${mov.evento_id}||${normalizeValorMasterKey(mov.material_nome)}`;
    const pending = Math.max(0, mov.quantidade - mov.quantidade_devolvida - mov.quantidade_consumida);
    actualByEventMaterial.set(key, (actualByEventMaterial.get(key) || 0) + pending);
  }

  const manualReservationRows = (manualReservationsRes.rows as any[]).map(row => ({ ...row, reserva_source: 'manual' }));
  const legacyReservationRows = (legacyReservationsRes.rows as any[]).map(row => ({ ...row, reserva_source: 'legacy' }));
  const legacyByEventMaterial = new Map<string, number>();
  for (const row of legacyReservationRows) {
    const key = `${Number(row.evento_id) || 0}||${normalizeValorMasterKey((row.material_nome as string) || '')}`;
    legacyByEventMaterial.set(key, (legacyByEventMaterial.get(key) || 0) + (Number(row.quantidade) || 0));
  }
  const packReservationRows = (packReservationsRes.rows as any[]).map(row => {
    const key = `${Number(row.evento_id) || 0}||${normalizeValorMasterKey((row.material_nome as string) || '')}`;
    const legacyQty = legacyByEventMaterial.get(key) || 0;
    const packQty = Number(row.quantidade) || 0;
    const quantity = Math.max(0, packQty - legacyQty);
    if (legacyQty > 0) legacyByEventMaterial.set(key, Math.max(0, legacyQty - packQty));
    return { ...row, quantidade: quantity, reserva_id: 0, reserva_source: 'pack' };
  }).filter(row => Number(row.quantidade) > 0);
  const rawReservations = [...manualReservationRows, ...legacyReservationRows, ...packReservationRows];

  const reservas = rawReservations.map((row: any) => {
    const eventId = Number(row.evento_id) || 0;
    const quantity = Number(row.quantidade) || 0;
    const key = `${eventId}||${normalizeValorMasterKey(row.material_nome)}`;
    const alreadyOut = actualByEventMaterial.get(key) || 0;
    const deduct = Math.min(alreadyOut, quantity);
    if (deduct > 0) actualByEventMaterial.set(key, alreadyOut - deduct);
    return {
      reserva_id: Number(row.reserva_id) || 0,
      reserva_source: row.reserva_source as 'manual' | 'legacy' | 'pack',
      evento_id: eventId, evento_nome: (row.evento_nome as string) || 'Evento', evento_data: (row.evento_data as string) || '',
      pack_nome: (row.pack_nome as string) || '', reservado_por: (row.reservado_por as string) || '',
      material_id: Number(row.material_id) || 0, material_nome: (row.material_nome as string) || '',
      material_imagem: (row.material_imagem as string) || '', quantidade: Math.max(0, quantity - deduct),
      local_habitual: (row.local_habitual as string) || 'Loja', dono_material: (row.dono_material as string) || 'LLE',
    };
  }).filter((row: any) => row.quantidade > 0);

  const statsRow = (statsRes.rows[0] as any) || {};
  const openUnits = movimentos.reduce((sum: number, mov: any) => sum + Math.max(0, mov.quantidade - mov.quantidade_devolvida - mov.quantidade_consumida), 0);
  const reservedUnits = reservas.reduce((sum: number, row: any) => sum + row.quantidade, 0);
  const activeMaterials = Number(statsRow.ativos) || 0;

  return {
    success: true, movimentos, reservas,
    stats: { activeMaterials, totalUnits: Number(statsRow.unidades) || 0, openRecords: movimentos.length, openUnits, reservedUnits, historyCount: 0, catalogCount: activeMaterials, valuesCount: 0 },
  };
}

export async function getMateriaisInitialBundle() {
  try {
    // Só traz a operação atual e contagens: sem catálogo completo, histórico, agenda inteira ou packs detalhados.
    return await queryMateriaisInitialBundleFast();
  } catch (firstError) {
    try {
      await setupMateriais();
      await seedMaterialPacks();
      return await queryMateriaisInitialBundleFast();
    } catch (error) {
      console.error('Erro getMateriaisInitialBundle:', error, firstError);
      return {
        success: false,
        movimentos: [],
        reservas: [],
        stats: { activeMaterials: 0, totalUnits: 0, openRecords: 0, openUnits: 0, reservedUnits: 0, historyCount: 0, catalogCount: 0, valuesCount: 0 },
      };
    }
  }
}

export async function getMateriaisTabData(tab: 'historico' | 'catalogo' | 'valores') {
  try {
    if (tab === 'historico') {
      const [res, countRes] = await Promise.all([
        turso.execute(`
          SELECT mm.id, mm.material_id, mm.material_nome,
                 COALESCE(NULLIF(mm.material_imagem, ''), m.imagem, '') AS material_imagem,
                 mm.quantidade, mm.quantidade_devolvida, mm.quantidade_consumida,
                 mm.origem, mm.origem_detalhe, mm.dono_material, mm.quem_levou, mm.evento, mm.evento_id,
                 mm.responsavel, mm.notas, mm.estado_regresso, mm.precisa_comprar, mm.motivo_compra,
                 mm.quantidade_comprar, mm.quem_confirmou_regresso, mm.notas_regresso, mm.data_saida, mm.data_volta
          FROM material_movimentos mm
          LEFT JOIN materiais m ON m.id = mm.material_id
          WHERE mm.quantidade <= COALESCE(mm.quantidade_devolvida, 0) + COALESCE(mm.quantidade_consumida, 0)
          ORDER BY COALESCE(mm.data_volta, mm.data_saida) DESC
          LIMIT 150
        `),
        turso.execute(`
          SELECT COUNT(*) AS total
          FROM material_movimentos
          WHERE quantidade <= COALESCE(quantidade_devolvida, 0) + COALESCE(quantidade_consumida, 0)
        `),
      ]);
      return {
        success: true,
        tab,
        movimentos: (res.rows as any[]).map(row => mapMovimentoMaterialRow(row, true)),
        historyCount: Number((countRes.rows[0] as any)?.total) || 0,
      };
    }

    if (tab === 'catalogo') {
      const materiais = await getAllMateriais();
      return { success: materiais.success, tab, materiais: materiais.data || [] };
    }

    const [materialsRes, packsRes] = await Promise.all([
      turso.execute(`
        SELECT id, nome, categoria, quantidade_total, dono, local_habitual, consumivel, stock_minimo,
               precisa_comprar, motivo_compra, quantidade_comprar, notas_compra, duracao_formato,
               custo_interno, valor_parceiro, valor_sud, valor_cliente_final, notas, ativo
        FROM materiais
        WHERE ativo = 1
        ORDER BY nome ASC
      `),
      turso.execute(`
        SELECT id, nome, descricao, duracao_formato, custo_interno, valor_parceiro, valor_sud,
               valor_cliente_final, valor_referencia, ativo
        FROM material_packs
        WHERE ativo = 1
        ORDER BY nome ASC
      `),
    ]);
    const materiais = (materialsRes.rows as any[]).map((r: any) => ({
      id: Number(r.id), nome: (r.nome as string) || '', categoria: (r.categoria as string) || '', imagem: '',
      quantidade_total: Number(r.quantidade_total) || 0, dono: (r.dono as string) || 'LLE',
      local_habitual: (r.local_habitual as string) || 'Loja', consumivel: r.consumivel === 1 || r.consumivel === true ? 1 : 0,
      stock_minimo: Number(r.stock_minimo) || 0, precisa_comprar: r.precisa_comprar === 1 || r.precisa_comprar === true ? 1 : 0,
      motivo_compra: (r.motivo_compra as string) || '', quantidade_comprar: Number(r.quantidade_comprar) || 0,
      notas_compra: (r.notas_compra as string) || '', duracao_formato: (r.duracao_formato as string) || '',
      custo_interno: Number(r.custo_interno) || 0, valor_parceiro: Number(r.valor_parceiro) || 0,
      valor_sud: Number(r.valor_sud) || 0, valor_cliente_final: Number(r.valor_cliente_final) || 0,
      notas: (r.notas as string) || '', ativo: 1,
    }));
    const packs = (packsRes.rows as any[]).map((p: any) => ({
      id: Number(p.id), nome: (p.nome as string) || '', descricao: (p.descricao as string) || '',
      duracao_formato: (p.duracao_formato as string) || '', custo_interno: Number(p.custo_interno) || 0,
      valor_parceiro: Number(p.valor_parceiro) || 0, valor_sud: Number(p.valor_sud) || 0,
      valor_cliente_final: Number(p.valor_cliente_final || p.valor_referencia) || 0,
      valor_referencia: Number(p.valor_referencia) || 0, ativo: 1, items: [],
    }));
    return { success: true, tab, materiais, packs };
  } catch (firstError) {
    try {
      await setupMateriais();
      await seedMaterialPacks();
      if (tab === 'catalogo') {
        const materiais = await getAllMateriais();
        return { success: materiais.success, tab, materiais: materiais.data || [] };
      }
      if (tab === 'historico') {
        const movimentos = await getMovimentosMateriais();
        return {
          success: movimentos.success,
          tab,
          movimentos: (movimentos.data || []).filter((m: any) => m.quantidade <= m.quantidade_devolvida + m.quantidade_consumida).slice(0, 150),
        };
      }
      const [materiais, packs] = await Promise.all([getAllMateriais(), getAllMaterialPacks()]);
      return { success: materiais.success && packs.success, tab, materiais: materiais.data || [], packs: packs.data || [] };
    } catch (error) {
      console.error('Erro getMateriaisTabData:', error, firstError);
      return { success: false, tab, materiais: [], packs: [], movimentos: [] };
    }
  }
}

export async function getMateriaisSaidaLookups() {
  try {
    const [materialsRes, eventsRes] = await Promise.all([
      turso.execute(`
        SELECT id, nome, categoria, quantidade_total, dono, local_habitual, consumivel, ativo
        FROM materiais
        WHERE ativo = 1
        ORDER BY nome ASC
      `),
      turso.execute(`
        SELECT id, event_name, event_date
        FROM agenda
        WHERE status != 'Cancelado'
          AND (event_date IS NULL OR date(event_date) >= date('now', '-30 day'))
        ORDER BY CASE WHEN event_date IS NULL OR event_date='' THEN 1 ELSE 0 END, event_date ASC
        LIMIT 250
      `),
    ]);
    return {
      success: true,
      materiais: (materialsRes.rows as any[]).map((r: any) => ({
        id: Number(r.id), nome: (r.nome as string) || '', categoria: (r.categoria as string) || '', imagem: '',
        quantidade_total: Number(r.quantidade_total) || 0, dono: (r.dono as string) || 'LLE',
        local_habitual: (r.local_habitual as string) || 'Loja', consumivel: r.consumivel === 1 || r.consumivel === true ? 1 : 0,
        stock_minimo: 0, precisa_comprar: 0, motivo_compra: '', quantidade_comprar: 0, notas_compra: '',
        duracao_formato: '', custo_interno: 0, valor_parceiro: 0, valor_sud: 0, valor_cliente_final: 0, notas: '', ativo: 1,
      })),
      eventos: (eventsRes.rows as any[]).map((r: any) => ({
        id: Number(r.id), title: (r.event_name as string) || '', date: (r.event_date as string) || '',
      })),
    };
  } catch (firstError) {
    try {
      await setupMateriais();
      const [materiais, eventos] = await Promise.all([getAllMateriais(), getEventosParaMateriais()]);
      return { success: materiais.success && eventos.success, materiais: materiais.data || [], eventos: eventos.data || [] };
    } catch (error) {
      console.error('Erro getMateriaisSaidaLookups:', error, firstError);
      return { success: false, materiais: [], eventos: [] };
    }
  }
}

export async function getPagamentosPageBundle() {
  try {
    const [pagamentos, colaboradores] = await Promise.all([getAllPagamentos(), getAllColaboradores()]);
    return { success: true, pagamentos, colaboradores };
  } catch (error) {
    console.error('Erro getPagamentosPageBundle:', error);
    return { success: false };
  }
}

export async function getFaturacaoPageBundle() {
  try {
    const [faturacao, clientes] = await Promise.all([getFaturacaoData(), getAllClientes()]);
    return { success: true, faturacao, clientes };
  } catch (error) {
    console.error('Erro getFaturacaoPageBundle:', error);
    return { success: false };
  }
}

export async function getMateriaisPageBundle() {
  try {
    // Garante que valores antigos de materiais são migrados para este módulo
    // mesmo quando Materiais é a primeira página aberta após o deploy.
    await ensureValoresMasterTable();
    const [materiais, movimentos, eventos, packs] = await Promise.all([getAllMateriais(), getMovimentosMateriais(), getEventosParaMateriais(), getAllMaterialPacks()]);
    return { success: true, materiais, movimentos, eventos, packs };
  } catch (error) {
    console.error('Erro getMateriaisPageBundle:', error);
    return { success: false };
  }
}
