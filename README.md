# Domain Search CLI

Consulta disponibilidad y precios de dominios desde la terminal con Cloudflare y Bun. Sin dependencias externas.

- Combina varios nombres con extensiones como `.com`, `.mx`, `.com.mx` y `.dev`.
- Muestra precio de registro, renovación y moneda.
- Busca sugerencias y exporta resultados como JSON.
- Divide consultas grandes en lotes de 20, con hasta tres consultas simultáneas.
- Solo implementa búsqueda y consulta. No incluye operaciones de compra.

## Empezar

Necesitas [Bun](https://bun.sh/) 1.4.2 o posterior y una cuenta de Cloudflare con acceso a Registrar API.

```bash
git clone https://github.com/robertovillegas/domain-search-cli.git
cd domain-search-cli
cp .env.example .env
chmod 600 .env
bash setup-env.sh
bun run domains minombre --tlds com,mx,dev
```

No necesitas instalar dependencias.

El asistente pide tu Account ID y API token; oculta el token y guarda el `.env` con permisos privados. No sobrescribe otras variables del archivo.

## Credenciales de Cloudflare

1. En el [panel de Cloudflare](https://dash.cloudflare.com/), selecciona tu cuenta, abre la búsqueda con Cmd/Ctrl+K y elige **Copy account ID**.
2. Ve a **Manage Account → API Tokens** y crea un token personalizado.
3. Selecciona **Registrar Domains → Read**, limitado a la cuenta que consultarás. Este permiso funcionó para búsqueda y consulta en las pruebas de este CLI.
4. Guarda los valores con `bash setup-env.sh`.

La guía general de la beta menciona permisos de escritura porque incluye el flujo de registro. Este CLI solo usa los endpoints de búsqueda y consulta. Si la API rechaza el acceso, revisa permisos y disponibilidad de la beta en tu cuenta; no necesitas habilitar compras para usar este proyecto.

También puedes proporcionar `ACCOUNT_ID` y `CLOUDFLARE_API_TOKEN` como variables de entorno: tienen prioridad sobre el `.env`. El `.env` se carga desde la carpeta del proyecto, incluso cuando ejecutas el CLI desde otro directorio. Nunca publiques tus credenciales.

## Uso

```bash
# Combinar cada nombre con cada extensión
bun run domains cafe cafeteria --tlds com,mx,com.mx,dev

# Consultar dominios completos
bun run domains check example.com example.dev

# Buscar sugerencias a partir de una frase
bun run domains search "cafeteria" --limit 10

# Solo disponibles, con salida para scripts
bun run domains cafe --tlds com,dev --available --json

# Ayuda
bun run domains --help
```

También puedes ejecutar el archivo directamente:

```bash
bun /ruta/domain-search-cli/domains.js cafe --tlds com,dev
```

| Opción | Función |
| --- | --- |
| `--tlds`, `-t` | Extensiones separadas por comas; combina nombres en `check`. |
| `--available` | Muestra solo dominios registrables en Cloudflare. |
| `--json` | Devuelve un arreglo JSON sin texto adicional en stdout. |
| `--limit` | Sugerencias por búsqueda, de 1 a 50; por defecto 20. |
| `--help`, `-h` | Muestra ayuda. |

Sin comando se usa `check`. Los errores se escriben en stderr y terminan con código 1; una consulta exitosa termina con código 0, incluso si todos los dominios están ocupados.

## Alcance de los resultados

`search` devuelve sugerencias basadas en caché. Confirma los finalistas con `check`, que consulta disponibilidad y precios actuales.

Una extensión no soportada por Cloudflare o por su API no significa que el dominio esté ocupado. El CLI distingue esos motivos. Los resultados se limitan a lo que ofrece Cloudflare Registrar y no comparan precios entre registradores.

Los precios se muestran en la moneda que devuelve Cloudflare, sin conversión a MXN. Pueden cambiar. Este CLI no registra, renueva ni transfiere dominios.

## Desarrollo

```bash
bun test
```

Las pruebas no usan credenciales ni consultan servicios externos.

Documentación: [Cloudflare Registrar API](https://developers.cloudflare.com/registrar/registrar-api/).

## Licencia

MIT, ver [LICENSE](LICENSE).
