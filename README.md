# Telegram Bot (Node.js)

Minimal Telegram bot skeleton using `telegraf`.

## Setup

1. Install dependencies:

```bash
npm install
```

2. Set your bot token as an environment variable:

```bash
export TELEGRAM_BOT_TOKEN="YOUR_TOKEN_HERE"
export SUPER_ADMIN_ID="YOUR_TELEGRAM_ID"
export TZ="Asia/Tashkent"
```

3. Run the bot:

```bash
npm start
```

## Bot imkoniyatlari

- Rol tanlash: sinf rahbari, fan o'qituvchi, rahbariyat
- Sinf rahbari uchun: sinf hisobot, haftaning yulduzi, muammoli o‘quvchilar, sinf natijasi
- Fan o‘qituvchi uchun: fan hisobot, qo‘llangan metod
- Rahbariyat uchun: umumiy statistika, reyting, hisobotlar
- Kunlik hisobotlar: sinf/fan o‘qituvchilar uchun (21:00 gacha topshiriladi)

## Notes

- Uses long polling via `telegraf`.
- Ma'lumotlar Firestore'ga saqlanadi (classReports, stars, problemStudents, subjectReports, methods).
- Keep your token safe; do not commit it to the repository.
- For Render deploys, also set `SUPER_ADMIN_ID` so you can access the admin panel on first launch.
- Timezone is set to `Asia/Tashkent` for local date/time operations.
