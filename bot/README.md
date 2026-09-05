# Bot de WhatsApp → GastosApp

Conecta el WhatsApp personal de Nadia y Elias como "dispositivo vinculado" (igual que WhatsApp Web).
Cuando alguien manda un **audio** (o un texto) con un gasto, ingreso o inversión, el bot lo transcribe
(Gemini, tier gratis), lo interpreta y lo **anota solo en Firestore** (la misma base que usa la app).
Después confirma por WhatsApp:

```
✅ Gasto anotado: $5.000 · Supermercado · nadia
```

- Funciona con tu número personal; el celu sigue andando normal.
- Solo responde a los 2 números configurados. Nadie más puede disparar nada.
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

En **config.json** reemplazá los números por los de WhatsApp de cada uno
(con código de país, sin "+" ni espacios; ej. `"5491155551234": "nadia"`).

### Cuenta de servicio de Firebase
1. Consola de Firebase → tu proyecto → ⚙️ → Configuración del proyecto → Cuentas de servicio.
2. "Generar nueva clave privada" → te descarga un `archivo.json`.
3. Guardalo como `bot/service-account.json`.

## Primer arranque (vinculación del QR)

```bash
node index.js
```

En la terminal aparece un **QR**. Escanealo desde el celular:
**WhatsApp → Ajustes → Dispositivos vinculados → Vincular un dispositivo**.

La sesión queda guardada en `bot/auth_info/` para no pedir el QR de nuevo.

## Despliegue 24/7 en Oracle Cloud (gratis)

1. Creá una instancia **Always Free** (VM.Standard.A1.Flex, ARM) con **Ubuntu 22.04**.
   - Simple "Amarillo/A1" → "Siempre gratis" → micro ARM con 4 OCPU y 24 GB RAM.
2. Conectate por SSH y corré:

```bash
sudo apt update && sudo apt install -y nodejs npm git
sudo npm install -g pm2
```

3. Subí la carpeta `bot/` (sin `node_modules`, sin `auth_info`, sin `service-account.json`):
```bash
rsync -avz -e ssh ./bot ubuntu@<ip-de-la-vm>:~/bot
# y después copiar service-account.json + config.json (o editarlos en la VM)
```

4. En la VM:
```bash
cd ~/bot
npm install
node index.js        # escaneá el QR UNA vez
# una vez vinculado, detené con Ctrl+C y arrancala con PM2:
pm2 start ecosystem.config.js
pm2 save
pm2 startup         # para que arranque sola al reiniciar la VM
```

> ⚡ **Importante**: copiá y respaldá `auth_info/` del primer QR. Si se pierde,
> hay que volver a escanear.

## Uso diario

Mandá un audio o texto desde WhatsApp, por ejemplo:
- "gasté quince mil en supermercado"
- "recibí 100 dólares por freelance"
- "aporté 50 mil a la jubilación"
- "ayer invertí 200 dólares en futuro de nuestro hijo"

El bot entiende pesos argentinos ("dos kilos" = $2000), dólares, "ayer", etc.
Si no entiende el monto, pregunta en vez de anotar.

## Estructura

```
bot/
├── index.js              # conexión Baileys + manejo de mensajes
├── config.json           # nros de WhatsApp → usuario (gitignored)
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