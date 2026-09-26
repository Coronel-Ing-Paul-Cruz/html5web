#!/usr/bin/env node
/**
 * Gate de verificacion del proyecto HTML5.
 * Sin dependencias. Node 18+ (usa fetch global).
 *
 *   node scripts/verify.mjs
 *
 * Salida: exit 0 = pasa todas las comprobaciones, exit 1 = falla al menos una.
 *
 * Cubre lo que el validador W3C NO cubre (medido: W3C solo atrapa 3 de 10
 * modos de fallo comunes) y llama a W3C para la sintaxis.
 */

import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..");
// Permite pasar otro archivo para poder testear el gate a proposito:
//   node scripts/verify.mjs ruta/alternativa.html
const HTML = process.argv[2]
  ? resolve(process.cwd(), process.argv[2])
  : join(RAIZ, "index.html");

const SEMANTICAS = [
  "header", "nav", "main", "section", "article", "aside",
  "footer", "figure", "figcaption", "address", "blockquote", "time",
];

const fallos = [];
const avisos = [];
const ok = [];

const check = (condicion, mensajeExito, mensajeFallo) => {
  if (condicion) ok.push(mensajeExito);
  else fallos.push(mensajeFallo);
  return condicion;
};

// ---------------------------------------------------------------- lectura
let html;
try {
  html = await readFile(HTML, "utf8");
} catch {
  console.error(`No se pudo leer ${HTML}`);
  process.exitCode = 1;
  throw new Error("index.html no encontrado");
}

// ------------------------------------------------- 1. doctype
check(
  /^\s*<!DOCTYPE html>/i.test(html),
  "doctype HTML5 presente",
  "falta <!DOCTYPE html> al inicio del documento"
);

// ------------------------------------------------- 2. lang
const mLang = html.match(/<html\b[^>]*\blang\s*=\s*"([^"]*)"/i);
check(
  !!mLang && mLang[1].trim().length > 0,
  `idioma declarado: lang="${mLang ? mLang[1] : ""}"`,
  "falta <html lang=\"...\"> con valor no vacio (WAVE: language_missing)"
);

// ------------------------------------------------- 3. title
const mTitle = html.match(/<title>([\s\S]*?)<\/title>/i);
const titulo = mTitle ? mTitle[1].trim() : "";
check(
  titulo.length >= 10,
  `title con ${titulo.length} caracteres`,
  "falta <title> o tiene menos de 10 caracteres"
);

// ------------------------------------------------- 4. title != h1
const mH1 = html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i);
const h1 = mH1 ? mH1[1].replace(/<[^>]*>/g, "").trim() : "";
check(
  !!h1 && titulo.toLowerCase() !== h1.toLowerCase(),
  "title distinto del h1 (evita la alerta title_redundant de WAVE)",
  "<title> es identico al <h1> (WAVE: title_redundant, alerta amarilla)"
);

// ------------------------------------------------- 5. main
check(/<main[\s>]/i.test(html), "elemento <main> presente", "falta el elemento <main>");

// ------------------------------------------------- 6. exactamente un h1
const nH1 = (html.match(/<h1\b/gi) || []).length;
check(nH1 === 1, "exactamente un <h1>", `se esperaba 1 <h1> y hay ${nH1}`);

// ------------------------------------------------- 7. jerarquia sin saltos
const niveles = [...html.matchAll(/<h([1-6])\b/gi)].map((m) => Number(m[1]));
for (let i = 1; i < niveles.length; i++) {
  if (niveles[i] > niveles[i - 1] + 1) {
    fallos.push(`jerarquia rota: h${niveles[i - 1]} seguido de h${niveles[i]} (no se pueden saltar niveles)`);
  }
}
if (!fallos.some((f) => f.startsWith("jerarquia"))) {
  ok.push(`jerarquia de ${niveles.length} encabezados sin saltos`);
}

// ------------------------------------------------- 8. etiquetas semanticas
const usadas = SEMANTICAS.filter((t) =>
  new RegExp(`<${t}\\b`, "i").test(html)
);
check(
  usadas.length >= 3,
  `${usadas.length} etiquetas semanticas: ${usadas.join(", ")}`,
  `solo ${usadas.length} etiqueta(s) semantica(s); se requieren 3 (encontradas: ${usadas.join(", ") || "ninguna"})`
);

// ------------------------------------------------- 9. imagenes + alt
const imgs = [...html.matchAll(/<img\b[^>]*>/gi)].map((m) => m[0]);
check(imgs.length >= 3, `${imgs.length} imagenes`, `solo ${imgs.length} imagen(es); se requieren 3`);

const GENERICAS = ["foto", "imagen", "image", "picture", "grafico", " Untitled"];
for (const [i, tag] of imgs.entries()) {
  const mAlt = tag.match(/\balt\s*=\s*"([^"]*)"/i);
  if (!mAlt) {
    fallos.push(`imagen ${i + 1}: sin atributo alt`);
  } else if (mAlt[1].trim().length === 0) {
    fallos.push(`imagen ${i + 1}: alt="" vacio (WAVE: alt_spacer_missing)`);
  } else if (mAlt[1].trim().length < 15) {
    fallos.push(`imagen ${i + 1}: alt demasiado corto (${mAlt[1].trim().length} car., min 15): "${mAlt[1].trim()}"`);
  } else if (GENERICAS.includes(mAlt[1].trim().toLowerCase())) {
    fallos.push(`imagen ${i + 1}: alt perezoso "${mAlt[1].trim()}" — describe el contenido, no la existencia`);
  } else {
    ok.push(`imagen ${i + 1}: alt de ${mAlt[1].trim().length} caracteres`);
  }
}

// las rutas de imagen deben existir en disco
const { access } = await import("node:fs/promises");
for (const [i, tag] of imgs.entries()) {
  const mSrc = tag.match(/\bsrc\s*=\s*"([^"]*)"/i);
  if (!mSrc) { fallos.push(`imagen ${i + 1}: sin atributo src`); continue; }
  const src = mSrc[1];
  if (/^https?:\/\//i.test(src)) {
    fallos.push(`imagen ${i + 1}: src externo "${src}" — usa una imagen local en images/`);
    continue;
  }
  try {
    await access(join(RAIZ, src));
    ok.push(`imagen ${i + 1}: archivo existe en disco -> ${src}`);
  } catch {
    fallos.push(`imagen ${i + 1}: el archivo "${src}" no existe en disco (enlace roto)`);
  }
}

// ------------------------------------------------- 10. enlaces externos
const enlaces = [...html.matchAll(/<a\b[^>]*href\s*=\s*"(https?:\/\/[^"]+)"[^>]*>([\s\S]*?)<\/a>/gi)];
check(
  enlaces.length >= 1,
  `${enlaces.length} enlace(s) externo(s)`,
  "falta al menos un enlace a una fuente externa (http/https)"
);
for (const [, href, interior] of enlaces) {
  const texto = interior.replace(/<[^>]*>/g, "").trim();
  const palabras = texto.split(/\s+/).filter(Boolean).length;
  if (palabras === 0) {
    fallos.push(`enlace a ${href}: sin texto visible (WAVE: link_empty)`);
  } else if (palabras < 3) {
    fallos.push(`enlace a ${href}: texto visible demasiado corto (${palabras} palabra/s) — describe el destino`);
  } else {
    ok.push(`enlace externo: "${texto.slice(0, 60)}"`);
  }
}
if (/<a\b[^>]*target\s*=/i.test(html)) {
  avisos.push("hay <a target=...>; en este proyecto se-evita por simplicidad");
}

// ------------------------------------------------- 11. listas
const items = (html.match(/<li\b/gi) || []).length;
check(
  items >= 3,
  `${items} elementos <li> en las listas`,
  `solo ${items} <li>; se requieren al menos 3 items en una lista`
);

// ------------------------------------------------- 12. texto corrupto (todo el repo)
// Una pagina en español no deberia contener CJK, cirilico, arabigo, devanagari
// ni el caracter de reemplazo U+FFFD. Me ha pasado varias veces al escribir y es
// de lo que mas dificil de ver aSimple glance, asi que se comprueba en todo el
// repo y no solo en index.html.
const { readdir } = await import("node:fs/promises");
const BASURA = [
  [/\uFFFD/g, "caracter de reemplazo U+FFFD (texto corrupto)"],
  [/[\u3040-\u30ff\u4e00-\u9fff]/g, "caracteres CJK (japones/chino/coreano)"],
  [/[\u0400-\u04ff]/g, "caracteres cirilicos (ruso)"],
  [/[\u0600-\u06ff\u0750-\u077f]/g, "caracteres arabes"],
  [/[\u0980-\u09ff]/g, "caracteres devanagari"],
];
const EXT = new Set([".html", ".css", ".md", ".json", ".jsonc", ".mjs", ".txt", ".yml", ".xml"]);
const SALTAR = new Set([".git", "node_modules"]);
const escaneados = [];

async function escanear(dir, profundidad = 0) {
  if (profundidad > 4) return;
  let entradas;
  try {
    entradas = await readdir(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const e of entradas) {
    if (SALTAR.has(e.name)) continue;
    const ruta = join(dir, e.name);
    if (e.isDirectory()) {
      await escanear(ruta, profundidad + 1);
    } else if (EXT.has("." + e.name.split(".").pop().toLowerCase())) {
      let texto;
      try {
        texto = await readFile(ruta, "utf8");
      } catch {
        continue;
      }
      escaneados.push(e.name);
      for (const [re, etiqueta] of BASURA) {
        const idx = texto.search(re);
        if (idx >= 0) {
          const n = (texto.match(re) || []).length;
          const ctx = texto.slice(Math.max(0, idx - 45), idx + 45).replace(/\s+/g, " ");
          fallos.push(`${e.name}: ${etiqueta} (${n}) -> «…${ctx}…»`);
        }
      }
    }
  }
}
await escanear(RAIZ);
check(
  escaneados.length >= 4,
  `${escaneados.length} archivos de texto escaneados, sin texto corrupto`,
  `solo ${escaneados.length} archivo(s) escaneado(s); se esperaban al menos 4`
);

// ------------------------------------------------- 13. W3C Nu
let w3cOk = false;
try {
  const res = await fetch("https://validator.w3.org/nu/?out=json", {
    method: "POST",
    headers: { "content-type": "text/html; charset=utf-8" },
    body: html,
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const { messages = [] } = await res.json();
  const errores = messages.filter((m) => m.type === "error");
  const avisosW3C = messages.filter((m) => m.type !== "error");
  w3cOk = errores.length === 0;
  if (w3cOk) {
    ok.push(`W3C Nu: 0 errores (${avisosW3C.length} aviso(s), permitidos)`);
  } else {
    for (const e of errores) {
      fallos.push(`W3C linea ${e.lastLine}: ${e.message}`);
    }
  }
} catch (e) {
  fallos.push(`W3C Nu no se pudo ejecutar (${e.message}) — gate incompleto, no se puede declarar aprobado`);
}

// ---------------------------------------------------------------- salida
console.log("\n=== VERIFICACION ===\n");
for (const m of ok) console.log(`  [ok]   ${m}`);
for (const m of avisos) console.log(`  [nota] ${m}`);
if (fallos.length) {
  console.log("");
  for (const m of fallos) console.log(`  [FALLA] ${m}`);
}
console.log(`\n${fallos.length ? "x" : "v"}  ${fallos.length} fallo(s), ${ok.length} comprobacion(es) ok\n`);

// process.exitCode en vez de process.exit(): en Windows, cortar el proceso
// mientras el socket de fetch sigue cerrando hace fallar una aserción de libuv
// y devuelve un codigo de salida no-cero aunque todo haya pasado.
process.exitCode = fallos.length ? 1 : 0;
