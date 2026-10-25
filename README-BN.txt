Sheba Computer Academy — Premium Dark + Render deployment

ফাইলসমূহ: index.html, home.html, admin.html, app.py, style.css, script.js, nid-bg.jpg, birth-bg.jpg, requirements.txt, render.yaml।

যা করা হয়েছে:
- মূল HTML/JS ও PDF parsing route রেখে Premium Dark styling যোগ।
- মূল ZIP-এ অনুপস্থিত style.css এবং পূর্ণ script.js, home.html ও ব্যবহৃত image assets অন্তর্ভুক্ত।
- Render Blueprint (render.yaml), gunicorn, /health endpoint যোগ।
- Flask session secret-এর local fallback ও upload size limit যোগ।

Render deploy:
1. ZIP extract করুন।
2. সব ফাইল GitHub repository-এর root/main branch-এ upload/commit করুন।
3. Render > New > Blueprint থেকে repository নির্বাচন করে deploy করুন।

গুরুত্বপূর্ণ সীমাবদ্ধতা:
- এই আপডেট বর্তমান UI/JS ফিচারগুলো সংরক্ষণ করার চেষ্টা করে; লাইভ পরিবেশে সব ফিচার পরীক্ষা করা হয়নি।
- বর্তমান client-side login/balance/payment/request আচরণকে সম্পূর্ণ server-side secure auth/payment system হিসেবে গণ্য করবেন না। production-এ database-backed authentication ও payment verification আলাদাভাবে প্রয়োজন।
- Render Free-এর local filesystem স্থায়ী ফাইল স্টোরেজ নয়; গুরুত্বপূর্ণ PDF/upload স্থায়ী রাখতে external persistent storage লাগবে।
- Production-এর জন্য Render Environment-এ শক্তিশালী FLASK_SECRET_KEY সেট করা সুপারিশ করা হচ্ছে।
- PDF parsing text-based PDF-এ কাজ করে; scanned PDF-এর জন্য OCR আলাদা দরকার।
