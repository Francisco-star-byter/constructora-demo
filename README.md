# Pórtico Constructora

Sitio de una sola página para una constructora en Santa Marta, Colombia.
HTML, CSS y JavaScript puros: sin frameworks, sin dependencias y sin proceso
de compilación.

## Cómo verlo

Abrí `index.html` en el navegador. Para que todo funcione igual que en
producción conviene servirlo por HTTP en vez de abrir el archivo directamente
(la extensión Live Server de VS Code sirve, o `python -m http.server`).

## Estructura

```
index.html    Todo el marcado
style.css     Estilos, organizados en 11 secciones numeradas
script.js     11 módulos, todos dentro de un único IIFE
assets/img/   13 imágenes en WebP
```

## Secciones

Hero · Manifiesto · Proyectos · Servicios · Proceso · Nosotros ·
Diferenciales · Testimonios · Contacto

## Notas de implementación

- **Un solo bucle de scroll.** Un `requestAnimationFrame` compartido alimenta
  a todos los módulos que reaccionan al desplazamiento, para evitar
  *layout thrashing*. Cada módulo registra su *ticker*.
- **Tipografía fluida.** La escala vive en variables CSS con `clamp()`, así que
  no hay saltos entre puntos de quiebre.
- **Ritmo vertical.** Los cortes entre secciones del mismo fondo llevan más
  aire que los que cambian de color, porque ahí el espacio es lo único que
  las separa.
- **Galería de proyectos.** Cuatro láminas a pantalla completa con flechas,
  puntos y gesto táctil. No secuestra el scroll de la página.
- **Accesibilidad.** HTML semántico, `alt` descriptivo, foco visible,
  navegación por teclado, regiones `aria-live` en los carruseles y respeto de
  `prefers-reduced-motion` en toda la página.

## Pendiente antes de producción

- [ ] **Política de tratamiento de datos** (Ley 1581 de 2012). La casilla del
      formulario es hoy solo texto: falta crear la página y enlazarla.
- [ ] **Datos de contacto reales.** El teléfono `+57 300 123 4567` y el correo
      `hola@porticoconstructora.co` son de demostración. Aparecen en la sección
      de contacto, en el pie y en las constantes `WA` y `MAIL` de `initForm()`.
- [ ] **Envío del formulario.** Al no haber servidor, el formulario valida y
      arma el mensaje, que el visitante envía por WhatsApp o por su cliente de
      correo. Para recibirlo en un backend: darle `action` y `method` al
      `<form>` y quitar el `preventDefault()` de `initForm()`.
