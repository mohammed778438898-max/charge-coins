#!/usr/bin/env bash
set -euo pipefail

REPO="mohammed778438898-max/charge-coins"

echo "تحقّق: gh auth status"
if ! gh auth status >/dev/null 2>&1; then
  echo "خطأ: لم يتم تسجيل دخول gh. شغّل: gh auth login"
  exit 1
fi

read -p "مسار serviceAccountKey.json (مثال: ./serviceAccountKey.json): " SA_PATH
if [ ! -f "$SA_PATH" ]; then
  echo "خطأ: الملف غير موجود: $SA_PATH"
  exit 1
fi

read -p "ضع RENDER_API_KEY (أمّا اترك فارغ لو ستستخدم Render UI مباشرة): " RENDER_API_KEY_INPUT
read -p "ضع RENDER_SERVICE_ID (أمّا اترك فارغ لو ستستخدم Render UI مباشرة): " RENDER_SERVICE_ID_INPUT

# 1) توليد ADMIN_SECRET آمن
if command -v openssl >/dev/null 2>&1; then
  ADMIN_SECRET="$(openssl rand -base64 32)"
else
  ADMIN_SECRET="$(node -e "console.log(require('crypto').randomBytes(32).toString('base64'))")"
fi

echo "تم توليد ADMIN_SECRET (سيتم رفعه كـ GitHub Secret). لا تشارك هذه القيمة في مكان عام."
echo "ADMIN_SECRET (preview): ${ADMIN_SECRET:0:8}... (len=${#ADMIN_SECRET})"

# 2) صنع SA_B64
if command -v base64 >/dev/null 2>&1; then
  SA_B64="$(base64 < "$SA_PATH" | tr -d '\n')"
else
  echo "خطأ: أمر base64 غير متوفر."
  exit 1
fi
echo "SA_B64 تم إنشاؤه (طوله ${#SA_B64} بايت)."

# 3) رفع الأسرار إلى GitHub باستخدام gh
echo "أرفع الأسرار إلى $REPO ..."
gh secret set ADMIN_SECRET --repo "$REPO" --body "$ADMIN_SECRET"
gh secret set SA_B64 --repo "$REPO" --body "$SA_B64"

if [ -n "$RENDER_API_KEY_INPUT" ]; then
  gh secret set RENDER_API_KEY --repo "$REPO" --body "$RENDER_API_KEY_INPUT"
fi
if [ -n "$RENDER_SERVICE_ID_INPUT" ]; then
  gh secret set RENDER_SERVICE_ID --repo "$REPO" --body "$RENDER_SERVICE_ID_INPUT"
fi

echo "الأسرار أضيفت. تحقق بالقائمة:"
gh secret list --repo "$REPO"

# 4) تشغيل الـ workflow (اختياري)
echo
echo "هل تريد تشغيل workflow الآن؟ اختر:"
echo "1) تشغيل gh workflow run"
echo "2) عمل commit فارغ و push"
echo "3) لا الآن"
read -p "اختر 1/2/3: " CHOICE

if [ "$CHOICE" = "1" ]; then
  echo "تشغيل workflow deploy.yml ..."
  gh workflow run deploy.yml --repo "$REPO" --ref main
  echo "تم إرسال تشغيل workflow. راقب النتيجة عبر: gh run list --repo $REPO"
elif [ "$CHOICE" = "2" ]; then
  echo "عمل commit فارغ ودفعه لفرع main..."
  tmpdir="$(mktemp -d)"
  git clone "https://github.com/$REPO.git" "$tmpdir"
  cd "$tmpdir"
  git commit --allow-empty -m "Trigger Render deploy (empty commit)"
  git push origin main
  echo "تم دفع الـ commit الفارغ."
  cd -
  rm -rf "$tmpdir"
else
  echo "تخطي تشغيل الـ workflow الآن."
fi

echo "انتهى. لو احتجت أراجع اللوجات أو أصلح خطأ أرسل لي ناتج: gh run list --repo $REPO ثم gh run view <run-id> --log"
