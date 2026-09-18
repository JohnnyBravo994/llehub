# v30 — Dashboard sem eventos cancelados

- Dashboard passa a excluir eventos cancelados tanto no servidor como no cliente.
- Filtro de estado é normalizado (trim + lowercase) e cobre Cancelado/Cancelada/Cancelled/Canceled.
- Aplicado a “Hoje” e “Próximos dias”.
- Eventos cancelados continuam preservados na Agenda/histórico.
- Leads canceladas continuam excluídas e um evento cancelado já não impede uma lead equivalente de aparecer por causa da chave data+valor.
