# Render'ga joylash (tavsiya)

Quyidagicha qilsangiz bot Render'da ishlaydi:

1. Render'da **New + → Blueprint** tanlang.
2. Repo'ni ulang: `ugafforov/primaryclasses`.
3. Render `render.yaml` ni o'zi o'qiydi va **Web Service** yaratadi (polling ishlaydi).
4. Environment'ga token kiriting:
   - `TELEGRAM_BOT_TOKEN`
   - `SUPER_ADMIN_ID` (admin paneli uchun dastlabki Telegram ID)
   - `TZ=Asia/Tashkent`
5. Deploy tugagach bot avtomatik ishlay boshlaydi.

## Tez va doimiy ishlash uchun

- Doimiy tez javob olish uchun Render'da **Starter (paid)** rejadan foydalaning.
- Free rejada web service 15 daqiqa inactivitydan keyin "sleep" holatiga tushishi mumkin.
- Web service ishlatayotgan bo'lsangiz, `healthCheckPath: /health` botni nazorat qilish uchun tayyor.

**Eslatma:** Bot **polling** ishlatadi. Web Service ham pollingni normal ishlatadi.
