# charge-coins

API بسيطة لإضافة عملات (coins) للمستخدمين باستخدام Firestore.

ملفات المشروع:
- `index.js` — سيرفر Express الذي يتعامل مع طلبات POST على `/chargeCoins`.
- `package.json` — تبعيات ومهام التشغيل.

متطلبات قبل النشر التلقائي عبر GitHub Actions → Render

1) أنشئ Service على Render مرتبط بالمستودع (أو استخدم خدمة موجودة). ستحتاج إلى معرف الخدمة (Service ID).
2) أنشئ API Key على Render (Account → API Keys) واحفظه.
3) أضف أسرار (Secrets) في مستودع GitHub:
   - `RENDER_API_KEY` — قيمة API Key من Render
   - `RENDER_SERVICE_ID` — معرّف الخدمة على Render
   - `SA_B64` — محتوى ملف `serviceAccountKey.json` مشفّر بـ base64
     - لصنعه محليًا: `cat /path/to/serviceAccountKey.json | base64`
   - `ADMIN_SECRET` — السر الذي سيُستخدم في هيدر `x-admin-secret`

4) إعداد المتغيرات على Render (مُستحسن)
   - في Dashboard الخدمة على Render أضف المتغيرات البيئية:
     - `SA_B64` (نفس القيمة التي أضفتها كـ GitHub Secret)
     - `ADMIN_SECRET`
   - واملأ بقية إعدادات البيئة (Node version، build command إن لزم).

كيفية العمل
- عند كل دفع (push) إلى الفرع `main` سيقوم GitHub Actions بتشغيل workflow الذي يُنشئ Deploy على Render عبر API.
- يمكنك أيضًا تشغيل Deploy يدويًا من Render Dashboard.

تشغيل محليًا (للاختبار)
1. ضع ملف `serviceAccountKey.json` على جهازك (لا ترفعه للمستودع العام).
2. في طرفية (Termux مثلاً):

```bash
export SA_B64="$(cat /path/to/serviceAccountKey.json | base64)"
export ADMIN_SECRET="ضع_سرك_القوي"
npm install
npm start
```

3. اختبار endpoint:

```bash
TX=$(cat /proc/sys/kernel/random/uuid)
curl -s -X POST "http://localhost:3000/chargeCoins" \
  -H "Content-Type: application/json" \
  -H "x-admin-secret: $ADMIN_SECRET" \
  -d "{\"tx_id\":\"$TX\",\"user_id\":\"user123\",\"amount\":100,\"note\":\"manual topup\",\"admin_name\":\"mohammed\"}"
```

ملاحظات أمان
- لا تشارك `serviceAccountKey.json` أو أي أسرار في مستودع عام.
- خزّن الأسرار كـ GitHub Secrets أو كمتغيرات بيئية في Render.
- قُم بتقييد الوصول إلى Endpoint (ميزة إضافية: IP allowlist أو VPN).

إذا تريد أساعدك بصنع الخدمة على Render أو أملأ Secrets نيابةً عنك، أعطني:
- `RENDER_API_KEY` و `RENDER_SERVICE_ID` (لو تريد أن أفعل النشر أو أتحكم بالخدمة عبر API).  
ملاحظة: لا أستطيع استلام أسرارك هنا؛ يجب أن تضيفها بنفسك في Settings → Secrets.
