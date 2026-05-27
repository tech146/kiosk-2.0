# Reception Clean Starter

A clean Vite + React + TypeScript starter for the reception kiosk app.

## Start

```bash
npm install
npm run dev
```

Open the local URL printed by Vite.

## Tenant CSV

The tenant CSV is kept separate from the script at:

```text
public/Tenant.csv
```

To check it is loading, open:

```text
http://localhost:5173/Tenant.csv
```

The app is resilient to common tenant CSV headers such as Tenant Name, Business Name, Contact, Full Name, Email Address, Mobile, Phone, etc.
