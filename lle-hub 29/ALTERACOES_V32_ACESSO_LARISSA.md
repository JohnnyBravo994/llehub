# LLE Hub v32 — Larissa: Agenda + Leads

## Alterações (pontuais)

- `app/page.tsx`: início de sessão de utilizadores não-administradores entra diretamente na Agenda, em vez de passar pelo Dashboard bloqueado.
- `app/DesktopNav.tsx`: o perfil `limited_novalues` tem explicitamente os atalhos Agenda e Leads.
- `app/MobTabBar.tsx`: no telemóvel, o perfil `limited_novalues` apresenta apenas Agenda e Leads, sem atalhos para Faturação ou Colaboradores (aos quais não tem acesso).

## Mantido

- O perfil da Larissa continua a ser `limited_novalues`.
- Restrições financeiras e de edição de valores preservadas.
- Visibilidade da Agenda restringida a eventos públicos, como na versão anterior.
- Os acessos dos restantes utilizadores, os dados e o design mantêm-se.

**Nota:** A edição/criação de Leads permanece indisponível para esse perfil, como já estava na v31. A alteração pedida foi interpretada como permissão para consultar a secção Leads sem atribuição de novas permissões de escrita.
