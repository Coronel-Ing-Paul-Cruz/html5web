# Mercados que opero

Página estática sobre los tres mercados en los que opero — EUR/USD, XAU/USD y
S&P 500 — más una sección sobre gestión de riesgo y seguridad de la cuenta.

Está publicada en <https://coronel-ing-paul-cruz.github.io/html5web/>.

Es un ejercicio del curso *Introduction to HTML5*, así que el HTML es lo
importante: un `h1`, jerarquía de encabezados sin saltos, `header`/`nav`/`main`/
`section`/`article`/`figure`/`footer`, tres imágenes locales con su `alt`
descriptivo y cinco enlaces a fuentes institucionales. Todo el texto va en
`lang="es"`.

## Las fuentes

Los cinco enlaces apuntan al BCE, al World Gold Council, a la LBMA, a
Investor.gov y a la Reserva Federal. Eran todos previsibles, pero Investopedia
responde 402 y S&P Global responde 403 a clientes automáticos, y como WAVE valida
los enlaces desde servidores de EE. UU. eso podía aparecer como enlace roto en la
revisión. Las fuentes que acabou usando son las primarias de cada mercado y
responden 200 sin cabeceras especiales.

## Comprobar que no se rompió nada

Hay un script de comprobación en `scripts/verify.mjs`. Se ejecuta con Node, sin
instalar nada:

```bash
node scripts/verify.mjs
```

Devuelve 0 si todo bien y 1 si algo falla. Mira la rúbrica del curso, los errores
de WAVE que se pueden ver en el HTML sin renderizar, que cada imagen exista de
verdad en disco y que W3C Nu no devuelva errores. También acepta otra ruta para
probarlo contra un archivo distinto:

```bash
node scripts/verify.mjs otro.html
```

Lo escribí después de que se me colara una imagen con el `alt` puesto a «foto» y
no me enterara hasta que alguien lo señaló. Sale más rápido que comprobarlo a ojo
cada vez.

Dos cosas que el script no puede hacer, y conviene no olvidarlo: no mide el
contraste de color, porque eso hay que renderizarlo, y tampoco puede saber si un
`alt` describe de verdad la imagen o solo parece que sí. Los ratios de contraste
están calculados y anotados al principio de `css/styles.css`.

## Estructura

```
index.html          la página
css/styles.css      los estilos
images/             las tres fotos
scripts/verify.mjs  la comprobación
LICENCIAS.md        atribución de las fotos
```

Sin JavaScript, sin dependencias, sin fuentes externas: la página carga sin
ninguna petición aparte de la propia.

## Sobre las fotos

`images/nyse.jpg` es CC BY-SA 4.0, que obliga a dar crédito, así que el autor y
la licencia están en el pie de la página y en `LICENCIAS.md`. Las otras dos son
de dominio público. Bajadas a 1280 px de ancho para no cargar de más.
