# Sheba Computer Academy — ENV ছাড়াই কনফিগারেশন

## ফাইলগুলো
- app.py
- passenger_wsgi.py
- requirements.txt
- index.html
- admin.html
- script.js

## ENV ছাড়াই কী হবে
- FLASK_SECRET_KEY না থাকলে app.py অ্যাপ ফোল্ডারে `.flask_secret_key` ফাইল তৈরি করে এবং পরেরবার সেটিই ব্যবহার করে।
- COOKIE_SECURE না থাকলে HTTPS-এ secure session cookie চালু থাকে।
- Passenger entry point `application` হিসেবে সেট করা আছে।
- বিদ্যমান PDF parse route এবং HTML/JS ফাইল রাখা হয়েছে।

## সীমাবদ্ধতা — গুরুত্বপূর্ণ
- cPanel-এর `Unable to find app venv folder` ENV সমস্যা নয়। Virtualenv না থাকলে বা Python Selector ভুল path দেখালে এই ZIP একা সেটি ঠিক করতে পারবে না; hosting-এর Python app/venv ঠিক করতে হবে।
- বর্তমান দেওয়া `index.html`, `admin.html` ও `script.js`-এর লগইন/ব্যালান্স/পেমেন্ট/রিকোয়েস্ট অংশ সম্পূর্ণ server-side secure database-এ স্থানান্তর করা হয়নি। কিছু তথ্য browser localStorage-এ থাকে। তাই এগুলোকে নিরাপদ server-side authentication/payment system বলা যাবে না।
- ZIP-টি আগের ফাইলের ভিত্তিতে সাজানো; live server-এ প্রতিস্থাপনের আগে ব্যাকআপ নিন।
- `.flask_secret_key` তৈরি হলে সেটি মুছবেন না; মুছলে session invalid হতে পারে।
- Admin password বা secret key source code-এ লিখবেন না।

## আপলোড
1. বর্তমান app ফোল্ডারের ফাইল backup করুন।
2. নিশ্চিত করুন সঠিক application root কোনটি। Screenshot অনুযায়ী cPanel-এ `public_html/app` app registered; `public_html/websait` আলাদা registered app হিসেবে দেখা যায়নি।
3. ZIP extract করে ফাইলগুলো শুধু সঠিক application root-এ রাখুন।
4. `requirements.txt`-এ থাকা dependency install করার জন্য cPanel Python app-এর সঠিক virtualenv দরকার।
5. cPanel-এ app restart করুন।


## Render Deployment (নতুন)
- এই ZIP-এ Render Blueprint-এর জন্য render.yaml যোগ করা হয়েছে।
- GitHub repository-এর root-এ সব ফাইল আপলোড/commit করুন।
- Render-এ New > Blueprint থেকে repository নির্বাচন করুন; render.yaml root-এ থাকবে।
- Build command: pip install -r requirements.txt
- Start command: gunicorn app:app
- ফ্রি Render web service নিষ্ক্রিয় থাকলে sleep হতে পারে। স্থানীয় ফাইল-সিস্টেমে রাখা upload/secret ফাইল redeploy বা restart-এ স্থায়ী থাকবে ধরে নেবেন না; স্থায়ী storage দরকার হলে external storage/database লাগবে।
- এই ZIP deploy configuration যোগ করে; এটি client-side login/payment/localStorage-কে server-side secure করে না।
