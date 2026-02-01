# Render'ga joylash (tavsiya)

Quyidagicha qilsangiz bot Render'da ishlaydi:

1. Render'da **New + → Blueprint** tanlang.
2. Repo'ni ulang: `ugafforov/primaryclasses`.
3. Render `render.yaml` ni o'zi o'qiydi va **Background Worker** yaratadi.
4. Environment'ga token kiriting:
   - `TELEGRAM_BOT_TOKEN`
   - `SUPER_ADMIN_ID` (admin paneli uchun dastlabki Telegram ID)
   - `TZ=Asia/Tashkent`
5. Deploy tugagach bot avtomatik ishlay boshlaydi.

**Eslatma:** Bot **polling** ishlatadi, shuning uchun Render'da **Web Service emas**, **Background Worker** bo'lishi kerak.
