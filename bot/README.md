# Bot de WhatsApp → GastosApp

Conecta el WhatsApp personal de Nadia y Elias como "dispositivo vinculado" (igual que WhatsApp Web).
Cada persona se envía a sí misma una **nota de voz** en su chat de **Mensajes guardados**
(chat con tu propio número) y el bot la transcribe (Gemini, tier gratis), la interpreta
y la **anota solo en Firestore** (la misma base que usa la app). Después confirma por WhatsApp:

```
✅ Gasto anotado: $5.000 · Supermercado · elias
```

- Funciona con tu número personal; el celu sigue andando normal.
- **Regla de captura (única)**: solo audios que el número vinculado se envía a **sí mismo**
  (Mensajes guardados). Nada más: ni textos, ni audios a otros chats o grupos, y los mensajes
  de otras personas se ignoran por completo.
- Es gratis (Gemini free tier + Firebase free + Oracle free tier).

## Requisitos

1. **Node 20+** (en la Virtual Machine de Oracle o en tu PC para probar).
2. Una **cuenta de servicio** de Firebase (`service-account.json`).
3. Una **clave de API de Gemini** (gratis): https://aistudio.google.com/apikey

## Configuración

```bash
cd bot
npm install
cp .env.example .env        # poné tu GEMINI_API_KEY
cp config.example.json config.json
```

En **config.json** hay un arreglo `devices` (uno por WhatsApp vinculado).
Cada entrada tiene:

| campo | descripción |
|---|---|
| `id` | nombre corto del usuario (`elias`, `nadia`) — es el `userId` con que se anota en Firestore |
| `number` | número de WhatsApp con código de país, sin "+" ni espacios (ej. `5491155551234`) |
| `authDir` | carpeta donde se guarda la sesión de ese dispositivo (`auth_info_elias`, `auth_info_nadia`) |

Cada dispositivo usa su **propio número** de WhatsApp real (el bot lo valida al conectar:
si el QR escaneado no coincide con el `number` configurado, no procesa mensajes).

### Cuenta de servicio de Firebase
1. Consola de Firebase → tu proyecto → ⚙️ → Configuración del proyecto → Cuentas de servicio.
2. "Generar nueva clave privada" → te descarga un `archivo.json`.
3. Guardalo como `bot/service-account.json`.

## Primer arranque (vinculación del QR)

```bash
node index.js
```

Para cada dispositivo sin sesión aparece un **QR** (en la terminal y en
`http://localhost:3000`). Escanealo desde el celular de ese número:
**WhatsApp → Ajustes → Dispositivos vinculados → Vincular un dispositivo**.

La sesión de cada dispositivo queda guardada en su `authDir` (p. ej. `bot/auth_info_elias/`)
para no pedir el QR de nuevo.

## Despliegue 24/7 en Oracle Cloud (gratis)

1. Creá una instancia **Always Free** (VM.Standard.A1.Flex, ARM) con **Ubuntu 22.04**.
   - Simple "Amarillo/A1" → "Siempre gratis" → micro ARM con 4 OCPU y 24 GB RAM.
2. Conectate por SSH y corré:

```bash
sudo apt update && sudo apt install -y nodejs npm git
sudo npm install -g pm2
```

3. Subí la carpeta `bot/` (sin `node_modules`, sin `auth_info*`, sin `service-account.json`):
```bash
rsync -avz -e ssh ./bot ubuntu@<ip-de-la-vm>:~/bot
# y después copiar service-account.json + config.json (o editarlos en la VM)
```

4. En la VM:
```bash
cd ~/bot
npm install
node index.js        # escaneá el QR de cada dispositivo UNA vez
# una vez vinculados, detené con Ctrl+C y arrancala con PM2:
pm2 start ecosystem.config.js
pm2 save
pm2 startup         # para que arranque sola al reiniciar la VM
```

> ⚡ **Importante**: copiá y respaldá cada `auth_info_<id>/` del primer QR. Si se pierde,
> hay que volver a escanear.

## Uso diario

Abrí el chat **Mensajes guardados** de tu número (el chat con vos mismo) y mandá una
nota de voz, por ejemplo:
- "gasté quince mil en supermercado"
- "recibí 100 dólares por freelance"
- "aporté 50 mil a la jubilación"
- "ayer invertí 200 dólares en futuro de nuestro hijo"

El bot entiende pesos argentinos ("dos kilos" = $2000), dólares, "ayer", etc.
Si no entiende el monto, pregunta en vez de anotar.

## Estructura

```
bot/
├── index.js              # una sesión Baileys por dispositivo + regla de captura
├── config.json           # devices (nº de WhatsApp → usuario), gitignored
├── config.example.json
├── .env.example          # GEMINI_API_KEY
├── ecosystem.config.js   # PM2
├── lib/
│   ├── firestore.js      # lectura categorías/objetivos + escritura (replica app)
│   ├── gemini.js         # transcripción + parseo a JSON
│   └── dolar.js          # dólar blue (dolarapi.com)
└── service-account.json  # (gitignored, NO subir al repo)
```

## Riesgos

- **API no oficial**: con solo 2 usuarios y sin spam el riesgo de baneo es bajo.
- **Dependencia de la VM**: PM2 revive el proceso si se cae; `pm2 startup` lo levanta al bootear.