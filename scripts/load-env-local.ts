import { config } from "dotenv";

// Módulo de efeito colateral: só carrega variáveis de `.env.local` no
// `process.env` (dev local; em produção as vars já vêm do ambiente do
// container, e este `config()` é um no-op inofensivo se o arquivo não
// existir). Precisa ser importado ANTES de "../db" nos scripts CLI que rodam
// fora do Next.js/Docker (ex.: scripts/export-tenant.ts).
//
// Por que um arquivo próprio, e não um `config()` inline no script que usa
// `db`: tanto em ESM nativo quanto no transform CJS que o `tsx` gera para
// este projeto (sem `"type":"module"` no package.json), TODOS os imports
// estáticos de um módulo são hoisted acima de qualquer código do próprio
// módulo — então um `config()` escrito ANTES de `import { db } from "../db"`
// no arquivo-fonte NÃO garante que ele rode antes da conexão ser aberta
// (confirmado via teste manual: sem esse arquivo, a conexão cai no usuário
// do SO em vez de usar `DATABASE_URL`). Um módulo próprio, sem outras
// dependências, importado como o PRIMEIRO import do arquivo, preserva a
// ordem relativa entre imports-irmãos — isso sim é garantido pela spec.
config({ path: ".env.local" });
