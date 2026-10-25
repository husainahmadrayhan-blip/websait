
let loggedInUserEmail = '';
let loggedInUserId = '';
let tempUploadedPhoto = '';
let tempUploadedSign = '';
let editingManualRecordId = null;
let editingBirthRecordId = null;
let currentCaptchaCode = '';

if (window.pdfjsLib) {
  pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js';
}

function autoFitSignOrThumb(imgElement) {
  if (!imgElement || !imgElement.src || imgElement.src === window.location.href) return;
  const naturalWidth = imgElement.naturalWidth;
  const naturalHeight = imgElement.naturalHeight;

  if (naturalHeight > naturalWidth) {
    imgElement.style.transform = 'rotate(90deg)';
    imgElement.style.maxWidth = '42px';
    imgElement.style.maxHeight = '42px';
  } else {
    imgElement.style.transform = 'none';
    imgElement.style.maxWidth = '100%';
    imgElement.style.maxHeight = '100%';
  }
}

function loadNewCaptcha() {
  const chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  let code = '';
  for (let i = 0; i < 4; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  currentCaptchaCode = code;
  const displayEl = document.getElementById('captchaBoxDisplay');
  if (displayEl) displayEl.innerText = code;
}

function convertToBanglaDigits(str) {
  const banglaDigits = {'0':'০', '1':'১', '2':'২', '3':'৩', '4':'৪', '5':'৫', '6':'৬', '7':'৭', '8':'৮', '9':'৯'};
  return String(str).replace(/[0-9]/g, function(w) { return banglaDigits[w]; });
}

function formatDateToDDMonYYYY(dateStr) {
  if (!dateStr) return '';
  let day = '', month = '', year = '';
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  if (dateStr.includes('-')) {
    let parts = dateStr.split('-');
    if (parts[0].length === 4) {
      year = parts[0];
      month = parseInt(parts[1], 10);
      day = parts[2];
    } else {
      day = parts[0];
      month = parseInt(parts[1], 10);
      year = parts[2];
    }
  } else if (dateStr.includes('/')) {
    let parts = dateStr.split('/');
    day = parts[0];
    month = parseInt(parts[1], 10);
    year = parts[2];
  }

  if (day && month && year && month >= 1 && month <= 12) {
    day = String(day).padStart(2, '0');
    return `${day} ${months[month - 1]} ${year}`;
  }
  return dateStr;
}

function fixFontBreakage(text) {
  if (!text) return '';
  let str = text.replace(/VOTER FORM|Smart Card Info|VOTERFORMSmart Card|Permanent Address|Present Address|Union|Ward|City Corporation|Municipality|Division|District|Upozila|Mouza|Moholla|Ward For|Porishod|Home|Holding|Village|Road|Post Office|Postal Code|Regional Code|Additional|[A-Za-z]/gi, '');

  str = str.replace(/মোঃঃ/g, 'মোঃ');
  str = str.replace(/মোাঃঃ/g, 'মোঃ');
  str = str.replace(/মোাঃ/g, 'মোঃ');
  str = str.replace(/ঃঃ/g, 'ঃ');
  str = str.replace(/::/g, ':');
  str = str.replace(/া+/g, 'া');

  str = str.replace(/\s+/g, ' ').trim();
  return str.trim();
}

function getUserBalance(email) {
  let balances = JSON.parse(localStorage.getItem('portal_user_balances') || '{}');
  if (balances[email] === undefined) {
    balances[email] = 0;
    localStorage.setItem('portal_user_balances', JSON.stringify(balances));
  }
  return balances[email];
}

function updateUserBalance(email, amountToAdd) {
  let balances = JSON.parse(localStorage.getItem('portal_user_balances') || '{}');
  let currentBal = balances[email] || 0;
  balances[email] = currentBal + parseFloat(amountToAdd);
  localStorage.setItem('portal_user_balances', JSON.stringify(balances));
  updateBalanceUI();
}

function updateBalanceUI() {
  if(loggedInUserEmail) {
    const bal = getUserBalance(loggedInUserEmail);
    document.getElementById('userBalanceDisplay').innerText = `Balance: ${convertToBanglaDigits(bal)} Taka`;
  }
}

function loadAdminSettings() {
  let settings = JSON.parse(localStorage.getItem('portal_admin_settings') || '{}');
  const bkashNum = settings.bkash || '01712345678';
  const bkashEl = document.getElementById('adminBkashNo');
  if(bkashEl) bkashEl.innerText = bkashNum;
}

function autoSetTodayIssueDate() {
  const today = new Date();
  const dd = String(today.getDate()).padStart(2, '0');
  const mm = String(today.getMonth() + 1).padStart(2, '0');
  const yyyy = today.getFullYear();
  const banglaDateStr = convertToBanglaDigits(`${dd}/${mm}/${yyyy}`);
  
  const issueInput = document.getElementById('issueDate');
  if (issueInput) issueInput.value = banglaDateStr;
  const scIssueInput = document.getElementById('scIssueDate');
  if (scIssueInput) scIssueInput.value = banglaDateStr;
}

function resetAllFormData() {
  editingManualRecordId = null;
  editingBirthRecordId = null;
  const forms = ['scMainForm', 'nidForm', 'serverCopyForm', 'autoPaymentForm', 'birthRegForm'];
  forms.forEach(id => {
    const f = document.getElementById(id);
    if (f) f.reset();
  });

  const fileInputs = ['pdfFile', 'birthPdfFile', 'extractPdfFile', 'scPhotoFile', 'scSignFile', 'photoFile', 'signFile', 'payScreenshotFile'];
  fileInputs.forEach(id => {
    const inp = document.getElementById(id);
    if (inp) inp.value = '';
  });

  tempUploadedPhoto = '';
  tempUploadedSign = '';

  document.getElementById('scPhotoPreview').src = '';
  const scSignPrev = document.getElementById('scSignPreview');
  scSignPrev.src = '';
  scSignPrev.style.display = 'none';
  scSignPrev.style.transform = 'none';
  document.getElementById('signPlaceholderText').style.display = 'inline';

  document.getElementById('out-photo').src = '';
  const outSign = document.getElementById('out-sign');
  outSign.src = '';
  outSign.style.transform = 'none';

  document.getElementById('extPhotoPreview').src = '';
  document.getElementById('extSignPreview').src = '';
  document.getElementById('btnDownloadPhoto').href = '#';
  document.getElementById('btnDownloadSign').href = '#';
  document.getElementById('extractResultArea').style.display = 'none';

  loadNewCaptcha();
  autoSetTodayIssueDate();
}

window.addEventListener('DOMContentLoaded', () => {
  loadAdminSettings();
  loadNewCaptcha();
  const savedUser = JSON.parse(localStorage.getItem('portal_active_session'));
  if (savedUser && savedUser.email) {
    loggedInUserEmail = savedUser.email;
    loggedInUserId = savedUser.userId || 'SB-1001';
    renderDashboard();
  }
});

function renderDashboard() {
  document.getElementById('loginBox').style.display = 'none';
  document.getElementById('registerBox').style.display = 'none';
  document.getElementById('topHeader').style.display = 'flex';
  document.getElementById('mainContent').style.display = 'block';
  
  const userEl = document.getElementById('sidebarUserEmail');
  if(userEl) userEl.innerText = 'User: ' + loggedInUserEmail;
  
  updateBalanceUI();

  const savedService = localStorage.getItem('portal_active_service') || 'হোম';
  selectService(savedService, false);
  autoSetTodayIssueDate();
}

function toggleSidebar() {
  document.getElementById('sidebarDrawer').classList.toggle('active');
  document.getElementById('sidebarOverlay').classList.toggle('active');
}

function selectService(serviceName, resetForm = true) {
  localStorage.setItem('portal_active_service', serviceName);

  document.getElementById('topHeaderTitle').innerText = serviceName;
  document.getElementById('signCopyFormBox').classList.remove('active');
  document.getElementById('nidManualFormBox').classList.remove('active');
  document.getElementById('manualHistoryContainer').classList.remove('active');
  document.getElementById('serverCopyFormBox').classList.remove('active');
  document.getElementById('userTableContainer').classList.remove('active');
  document.getElementById('autoPaymentFormBox').classList.remove('active');
  document.getElementById('paymentHistoryContainer').classList.remove('active');
  document.getElementById('birthRegistrationFormBox').classList.remove('active');
  document.getElementById('birthHistoryContainer').classList.remove('active');

  if (resetForm) {
    resetAllFormData();
  }

  if (serviceName === 'হোম') {
    // Banner active
  } else if (serviceName === 'সাইন কপি টু এনআইডি') {
    document.getElementById('signCopyFormBox').classList.add('active');
  } else if (serviceName === 'জন্ম নিবন্ধন মেক') {
    document.getElementById('birthRegistrationFormBox').classList.add('active');
  } else if (serviceName === 'জন্ম নিবন্ধন হিস্টোরি') {
    document.getElementById('birthHistoryContainer').classList.add('active');
    loadBirthHistory();
  } else if (serviceName === 'সার্ভার কপি') {
    document.getElementById('serverCopyFormBox').classList.add('active');
    document.getElementById('userTableContainer').classList.add('active');
    loadUserRequests();
  } else if (serviceName === 'এনআইডি ম্যানুয়াল') {
    document.getElementById('nidManualFormBox').classList.add('active');
  } else if (serviceName === 'এনআইডি হিস্টোরি') {
    document.getElementById('manualHistoryContainer').classList.add('active');
    loadManualHistory();
  } else if (serviceName === 'অটো পেমেন্ট') {
    loadAdminSettings();
    document.getElementById('autoPaymentFormBox').classList.add('active');
    document.getElementById('paymentHistoryContainer').classList.add('active');
    loadPaymentHistory();
  }

  autoSetTodayIssueDate();

  const drawer = document.getElementById('sidebarDrawer');
  if (drawer.classList.contains('active')) {
    toggleSidebar();
  }
}

async function handleBirthPdfAutoFill(event) {
  const file = event.target.files[0];
  if (!file) return;

  const loadingEl = document.getElementById('loadingOverlay');
  document.getElementById('loadingText').innerText = "Birth PDF data processing...";
  loadingEl.style.display = 'flex';

  try {
    const fileReader = new FileReader();
    fileReader.onload = async function() {
      try {
        const typedarray = new Uint8Array(this.result);
        const pdf = await pdfjsLib.getDocument(typedarray).promise;
        const page = await pdf.getPage(1);
        const textContent = await page.getTextContent();
        
        let rawItems = textContent.items.map(item => ({
          text: item.str.trim(),
          x: item.transform ? item.transform[4] : 0,
          y: item.transform ? item.transform[5] : 0
        })).filter(i => i.text && i.text !== "|" && i.text !== "-");

        rawItems.sort((a, b) => b.y - a.y || a.x - b.x);

        let rawTexts = rawItems.map(i => i.text);
        let fullTextString = rawTexts.join(" ");
        console.log("PDF Raw Extraction:", rawTexts);

        let regDate = "", officeAddr = "", upazilaZila = "", issueDate = "", dob = "", regNo = "", sex = "";
        let nameBn = "", nameEn = "", birthPlace = "", motherBn = "", motherNat = "", fatherBn = "", fatherNat = "";

        let regNoMatch = fullTextString.match(/\b\d{17}\b/);
        if (regNoMatch) {
          regNo = regNoMatch[0];
        }

        let dateMatches = fullTextString.match(/\b\d{1,2}\s+[A-Za-z]+\s+\d{4}\b|\b\d{2}\/\d{2}\/\d{4}\b/g) || [];
        
        for (let i = 0; i < rawItems.length; i++) {
          let itemStr = rawItems[i].text.toUpperCase();

          if (itemStr.includes("REGISTRATION OFFICE") || itemStr.includes("REGISTER OFFICE")) {
            let foundOffice = "";
            for (let k = 1; k <= 4; k++) {
              if (rawItems[i+k]) {
                let txt = rawItems[i+k].text;
                let uTxt = txt.toUpperCase();
                if (!uTxt.includes("ISSUANCE") && !uTxt.includes("REGISTRATION DATE") && !uTxt.includes("DATE") && !uTxt.includes("SEX") && !uTxt.includes("BIRTH")) {
                  foundOffice = txt;
                  break;
                }
              }
            }
            if (foundOffice) {
              officeAddr = foundOffice;
              upazilaZila = foundOffice;
            }
          }

          if (itemStr.includes("REGISTRATION DATE") || itemStr.includes("DATE OF REGISTRATION")) {
            for (let k = 1; k <= 3; k++) {
              if (rawItems[i+k] && rawItems[i+k].text.match(/\d/)) {
                regDate = rawItems[i+k].text;
                break;
              }
            }
          }

          if (itemStr.includes("ISSUANCE DATE") || itemStr.includes("DATE OF ISSUANCE")) {
            for (let k = 1; k <= 3; k++) {
              if (rawItems[i+k] && rawItems[i+k].text.match(/\d/)) {
                issueDate = rawItems[i+k].text;
                break;
              }
            }
          }

          if (itemStr.includes("DATE OF BIRTH") && !itemStr.includes("WORD")) {
            for (let k = 1; k <= 3; k++) {
              if (rawItems[i+k] && rawItems[i+k].text.match(/\d/)) {
                dob = rawItems[i+k].text;
                break;
              }
            }
          }

          if (itemStr === "SEX" || itemStr === "GENDER" || itemStr.includes("SEX / GENDER")) {
            for (let k = 1; k <= 2; k++) {
              if (rawItems[i+k]) {
                let g = rawItems[i+k].text.toUpperCase();
                if (g.includes("MALE") || g.includes("FEMALE")) {
                  sex = g.includes("FEMALE") ? "Female" : "Male";
                  break;
                }
              }
            }
          }

          if (rawItems[i].text.includes("নিবন্ধিত") && rawItems[i].text.includes("নাম")) {
            let b1 = rawItems[i+1] ? rawItems[i+1].text : "";
            let b2 = rawItems[i+2] ? rawItems[i+2].text : "";
            nameBn = (!b2.toUpperCase().includes("REGISTERED")) ? (b1 + " " + b2) : b1;
          }

          if (itemStr.includes("REGISTERED") && itemStr.includes("NAME")) {
            let e1 = rawItems[i+1] ? rawItems[i+1].text : "";
            let e2 = rawItems[i+2] ? rawItems[i+2].text : "";
            nameEn = (!e2.toUpperCase().includes("BIRTH") && !e2.toUpperCase().includes("PLACE")) ? (e1 + " " + e2) : e1;
          }

          if (rawItems[i].text.includes("জন্মস্থান") || itemStr.includes("PLACE OF BIRTH")) {
            if (rawItems[i+1] && !rawItems[i+1].text.toUpperCase().includes("MOTHER")) {
              birthPlace = rawItems[i+1].text;
            }
          }

          if (rawItems[i].text.includes("মাতার নাম") || itemStr.includes("MOTHER'S NAME")) {
            let m1 = rawItems[i+1] ? rawItems[i+1].text : "";
            let m2 = rawItems[i+2] ? rawItems[i+2].text : "";
            motherBn = (!m2.toUpperCase().includes("MOTHER") && !m2.toUpperCase().includes("NATIONALITY")) ? (m1 + " " + m2) : m1;
          }

          if (itemStr.includes("MOTHER'S NATIONALITY") || (rawItems[i].text.includes("মাতার") && rawItems[i].text.includes("জাতীয়তা"))) {
            if (rawItems[i+1]) motherNat = rawItems[i+1].text;
          }

          if (rawItems[i].text.includes("পিতার নাম") || itemStr.includes("FATHER'S NAME")) {
            let f1 = rawItems[i+1] ? rawItems[i+1].text : "";
            let f2 = rawItems[i+2] ? rawItems[i+2].text : "";
            fatherBn = (!f2.toUpperCase().includes("FATHER") && !f2.toUpperCase().includes("NATIONALITY")) ? (f1 + " " + f2) : f1;
          }

          if (itemStr.includes("FATHER'S NATIONALITY") || (rawItems[i].text.includes("পিতার") && rawItems[i].text.includes("জাতীয়তা"))) {
            if (rawItems[i+1]) fatherNat = rawItems[i+1].text;
          }
        }

        if (!officeAddr) {
          let foundU = rawTexts.find(t => t.toUpperCase().includes("UNION") || t.toUpperCase().includes("PARISHAD") || t.toUpperCase().includes("MUNICIPALITY"));
          if (foundU) officeAddr = foundU;
        }

        if (!regDate && dateMatches[0]) regDate = dateMatches[0];
        if (!issueDate && dateMatches[1]) issueDate = dateMatches[1];
        if (!dob && dateMatches[2]) dob = dateMatches[2];

        if (regNo) document.getElementById('brRegNo').value = regNo.trim();
        if (officeAddr) {
          document.getElementById('brOfficeAddress').value = officeAddr.replace(/\s+/g, ' ').trim();
          document.getElementById('brUpazilaZila').value = officeAddr.replace(/\s+/g, ' ').trim();
        }
        if (regDate) document.getElementById('brDateReg').value = regDate.trim();
        if (issueDate) document.getElementById('brDateIssue').value = issueDate.trim();
        if (dob) document.getElementById('brDob').value = dob.trim();
        if (sex) document.getElementById('brGender').value = sex;

        if (nameBn) document.getElementById('brNameBn').value = nameBn.replace(/\s+/g, ' ').trim();
        if (nameEn) document.getElementById('brNameEn').value = nameEn.replace(/\s+/g, ' ').trim();
