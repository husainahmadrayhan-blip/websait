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

        // Y axis descending sort to read top to bottom cleanly
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

          // REGISTRATION OFFICE er nicher box-er text (jemon SWADESHI UNION PARISHAD) துல்லியভাবে capture করার জন্য
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
          // Direct fallback search for common union/parishad terms if label match fails
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

        if (birthPlace) {
          let bp = birthPlace.trim();
          document.getElementById('brBirthPlaceBn').value = bp;
          document.getElementById('brBirthPlaceEn').value = bp;
          document.getElementById('brAddressBn').value = bp;
          document.getElementById('brAddressEn').value = bp;
        }

        if (motherBn) document.getElementById('brMotherBn').value = motherBn.replace(/\s+/g, ' ').trim();
        if (motherNat) {
          document.getElementById('brMotherNatBn').value = motherNat.trim();
          document.getElementById('brMotherNatEn').value = motherNat.trim();
        }

        if (fatherBn) document.getElementById('brFatherBn').value = fatherBn.replace(/['"]/g, '').replace(/\s+/g, ' ').trim();
        if (fatherNat) {
          document.getElementById('brFatherNatBn').value = fatherNat.trim();
          document.getElementById('brFatherNatEn').value = fatherNat.trim();
        }

        setTimeout(() => { 
          loadingEl.style.display = 'none'; 
          alert('Janmo Nibondhon PDF theke shob tothyo shothik bhabe auto-fill kora hoyeche!');
        }, 400);

      } catch (err) {
        console.error("PDF Parse error:", err);
        loadingEl.style.display = 'none';
        alert('PDF theke data porte shomossha hoyeche.');
      }
    };
    fileReader.readAsArrayBuffer(file);

  } catch (err) {
    console.error("File error:", err);
    loadingEl.style.display = 'none';
  }
}

function handleBirthRegistrationSubmit(e) {
  e.preventDefault();
  const userBal = getUserBalance(loggedInUserEmail);
  if (userBal < 3) {
    alert('Apnar balance porjapto nei! Janmo nibondhon toiri korar jonno andaj 3 taka lagbe.');
    return;
  }

  updateUserBalance(loggedInUserEmail, -3);

  const birthRecord = {
    id: editingBirthRecordId ? editingBirthRecordId : Date.now(),
    userEmail: loggedInUserEmail,
    brNo: document.getElementById('brRegNo').value || '20175452452445',
    dob: document.getElementById('brDob').value || '',
    nameBn: document.getElementById('brNameBn').value || 'জন্ম নিবন্ধন',
    nameEn: document.getElementById('brNameEn').value || '',
    fatherBn: document.getElementById('brFatherBn').value || '',
    fatherEn: document.getElementById('brFatherEn').value || '',
    motherBn: document.getElementById('brMotherBn').value || '',
    motherEn: document.getElementById('brMotherEn').value || '',
    officeAddress: document.getElementById('brOfficeAddress').value || '',
    upazilaZila: document.getElementById('brUpazilaZila').value || '',
    gender: document.getElementById('brGender').value || 'Male',
    dateReg: document.getElementById('brDateReg').value || '',
    dateIssue: document.getElementById('brDateIssue').value || '',
    leftBarCode: document.getElementById('brLeftBarCode').value || 'QZIP',
    qrLink: document.getElementById('brQrLink').value || '',
    dobInWord: document.getElementById('brDobInWord').value || '',
    fatherNatBn: document.getElementById('brFatherNatBn').value || 'বাংলাদেশী',
    fatherNatEn: document.getElementById('brFatherNatEn').value || 'Bangladeshi',
    motherNatBn: document.getElementById('brMotherNatBn').value || 'বাংলাদেশী',
    motherNatEn: document.getElementById('brMotherNatEn').value || 'Bangladeshi',
    birthPlaceBn: document.getElementById('brBirthPlaceBn').value || '',
    birthPlaceEn: document.getElementById('brBirthPlaceEn').value || '',
    addressBn: document.getElementById('brAddressBn').value || '',
    addressEn: document.getElementById('brAddressEn').value || ''
  };

  let birthList = JSON.parse(localStorage.getItem('portal_birth_history') || '[]');
  if (editingBirthRecordId) {
    const idx = birthList.findIndex(b => b.id === editingBirthRecordId);
    if (idx !== -1) birthList[idx] = birthRecord;
    else birthList.unshift(birthRecord);
  } else {
    birthList.unshift(birthRecord);
  }
  localStorage.setItem('portal_birth_history', JSON.stringify(birthList));
  editingBirthRecordId = null;

  selectService('জন্ম নিবন্ধন হিস্টোরি');
  triggerBirthPrint(birthRecord);
}

function editBirthRecord(recordId) {
  let birthList = JSON.parse(localStorage.getItem('portal_birth_history') || '[]');
  const target = birthList.find(b => b.id === recordId);
  if (target) {
    editingBirthRecordId = recordId;
    selectService('জন্ম নিবন্ধন মেক', false);
    
    document.getElementById('brOfficeAddress').value = target.officeAddress || '';
    document.getElementById('brUpazilaZila').value = target.upazilaZila || '';
    document.getElementById('brRegNo').value = target.brNo || '';
    document.getElementById('brGender').value = target.gender || 'Male';
    document.getElementById('brDateReg').value = target.dateReg || '';
    document.getElementById('brDateIssue').value = target.dateIssue || '';
    document.getElementById('brLeftBarCode').value = target.leftBarCode || 'QZIP';
    document.getElementById('brQrLink').value = target.qrLink || '';
    document.getElementById('brDob').value = target.dob || '';
    document.getElementById('brDobInWord').value = target.dobInWord || '';
    document.getElementById('brNameBn').value = target.nameBn || '';
    document.getElementById('brNameEn').value = target.nameEn || '';
    document.getElementById('brFatherBn').value = target.fatherBn || '';
    document.getElementById('brFatherEn').value = target.fatherEn || '';
    document.getElementById('brFatherNatBn').value = target.fatherNatBn || 'বাংলাদেশী';
    document.getElementById('brFatherNatEn').value = target.fatherNatEn || 'Bangladeshi';
    document.getElementById('brMotherBn').value = target.motherBn || '';
    document.getElementById('brMotherEn').value = target.motherEn || '';
    document.getElementById('brMotherNatBn').value = target.motherNatBn || 'বাংলাদেশী';
    document.getElementById('brMotherNatEn').value = target.motherNatEn || 'Bangladeshi';
    document.getElementById('brBirthPlaceBn').value = target.birthPlaceBn || '';
    document.getElementById('brBirthPlaceEn').value = target.birthPlaceEn || '';
    document.getElementById('brAddressBn').value = target.addressBn || '';
    document.getElementById('brAddressEn').value = target.addressEn || '';

    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
}

function triggerBirthPrint(data) {
  document.body.classList.add('printing-birth');

  document.getElementById('out-brOfficeAddress').innerText = data.officeAddress || '';
  document.getElementById('out-brUpazilaZila').innerText = data.upazilaZila || '';
  document.getElementById('out-brRegNo').innerText = data.brNo || '';
  document.getElementById('out-brGender').innerText = data.gender || '';
  document.getElementById('out-brDateReg').innerText = data.dateReg || '';
  document.getElementById('out-brDateIssue').innerText = data.dateIssue || '';
  document.getElementById('out-brLeftBarCode').innerText = data.leftBarCode || '';

  document.getElementById('out-brDob').innerText = data.dob || '';
  document.getElementById('out-brDobInWord').innerText = data.dobInWord || '';

  document.getElementById('out-brNameBn').innerText = data.nameBn || '';
  document.getElementById('out-brNameEn').innerText = data.nameEn || '';

  document.getElementById('out-brFatherBn').innerText = data.fatherBn || '';
  document.getElementById('out-brFatherEn').innerText = data.fatherEn || '';
  document.getElementById('out-brFatherNatBn').innerText = data.fatherNatBn || 'বাংলাদেশী';
  document.getElementById('out-brFatherNatEn').innerText = data.fatherNatEn || 'Bangladeshi';

  document.getElementById('out-brMotherBn').innerText = data.motherBn || '';
  document.getElementById('out-brMotherEn').innerText = data.motherEn || '';
  document.getElementById('out-brMotherNatBn').innerText = data.motherNatBn || 'বাংলাদেশী';
  document.getElementById('out-brMotherNatEn').innerText = data.motherNatEn || 'Bangladeshi';

  document.getElementById('out-brBirthPlaceBn').innerText = data.birthPlaceBn || '';
  document.getElementById('out-brBirthPlaceEn').innerText = data.birthPlaceEn || '';

  document.getElementById('out-brAddressBn').innerText = data.addressBn || '';
  document.getElementById('out-brAddressEn').innerText = data.addressEn || '';

  const bgImg = new Image();
  bgImg.src = 'birth-bg.jpg';
  
  const doPrint = function() {
    window.print();
    setTimeout(() => { document.body.classList.remove('printing-birth'); }, 500);
  };

  bgImg.onload = function() { setTimeout(doPrint, 200); };
  bgImg.onerror = function() { setTimeout(doPrint, 200); };
}

function reprintBirthRecord(recordId) {
  let birthList = JSON.parse(localStorage.getItem('portal_birth_history') || '[]');
  const target = birthList.find(b => b.id === recordId);
  if (target) triggerBirthPrint(target);
}

function deleteBirthHistory(recordId) {
  if (confirm('Aapni ki shotti ei birth history delete korte chan?')) {
    let birthList = JSON.parse(localStorage.getItem('portal_birth_history') || '[]');
    birthList = birthList.filter(b => b.id !== recordId);
    localStorage.setItem('portal_birth_history', JSON.stringify(birthList));
    loadBirthHistory();
  }
}

function loadBirthHistory() {
  let birthList = JSON.parse(localStorage.getItem('portal_birth_history') || '[]');
  const tbody = document.getElementById('birthHistoryTable');
  if (!tbody) return;
  tbody.innerHTML = '';

  const userBirthHistory = birthList.filter(b => b.userEmail === loggedInUserEmail);

  if (userBirthHistory.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" style="color:#64748b; font-size:11px;">Kono birth registration history paoya jayni.</td></tr>';
    return;
  }

  userBirthHistory.forEach(b => {
    tbody.innerHTML += `
      <tr>
        <td style="text-align:left; padding:4px 3px;">
          <strong style="font-size:11px; display:block; line-height:1.2;">${b.nameBn}</strong>
        </td>
        <td style="padding:4px 3px; font-size:10px;">${b.brNo}</td>
        <td style="padding:4px 3px; font-size:10px;">${b.dob}</td>
        <td style="padding:4px 3px;">
          <div style="display:flex; gap:2px; justify-content:center; align-items:center;">
            <button class="action-btn-download" onclick="reprintBirthRecord(${b.id})" style="padding:3px 5px; font-size:10px;">Print</button>
            <button class="action-btn-edit" onclick="editBirthRecord(${b.id})" style="padding:3px 5px; font-size:10px;" title="Edit">✏️</button>
          </div>
        </td>
        <td style="padding:4px 3px;">
          <button class="btn-user-delete" onclick="deleteBirthHistory(${b.id})" style="padding:3px 5px; font-size:10px;">🗑️</button>
        </td>
      </tr>
    `;
  });
}

function compressScreenshotImage(file, callback) {
  const reader = new FileReader();
  reader.onload = function(event) {
    const img = new Image();
    img.onload = function() {
      const canvas = document.createElement('canvas');
      let width = img.width;
      let height = img.height;
      const MAX_SIZE = 800;
      if (width > height) {
        if (width > MAX_SIZE) { height *= MAX_SIZE / width; width = MAX_SIZE; }
      } else {
        if (height > MAX_SIZE) { width *= MAX_SIZE / height; height = MAX_SIZE; }
      }
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, width, height);
      callback(canvas.toDataURL('image/jpeg', 0.7));
    };
    img.src = event.target.result;
  };
  reader.readAsDataURL(file);
}

function handlePaymentSubmit(e) {
  e.preventDefault();
  const method = document.getElementById('payMethod').value;
  const senderNo = document.getElementById('paySenderNo').value.trim();
  const amount = parseFloat(document.getElementById('payAmount').value);
  const trxId = document.getElementById('payTrxId').value.trim();
  const screenshotInput = document.getElementById('payScreenshotFile');

  if (!senderNo || !amount || !trxId) {
    alert('Doya kore shob guli ghor shothik bhabe puron korun!');
    return;
  }

  if (!screenshotInput.files || !screenshotInput.files[0]) {
    alert('Doya kore payment er screenshot file upload korun!');
    return;
  }

  compressScreenshotImage(screenshotInput.files[0], function(screenshotBase64) {
    let payments = JSON.parse(localStorage.getItem('portal_payments_db') || '[]');
    const now = Date.now();
    const autoApproveTime = now + (5 * 60 * 1000);

    const newPayment = {
      id: Date.now(),
      userEmail: loggedInUserEmail,
      userId: loggedInUserId,
      method: method,
      senderNo: senderNo,
      amount: amount,
      trxId: trxId,
      screenshot: screenshotBase64,
      status: 'Pending',
      timestamp: now,
      autoApproveTime: autoApproveTime,
      balanceAdded: false
    };

    payments.unshift(newPayment);
    try {
      localStorage.setItem('portal_payments_db', JSON.stringify(payments));
    } catch (err) {
      payments = payments.slice(0, 15);
      localStorage.setItem('portal_payments_db', JSON.stringify(payments));
    }

    alert('Payment request shofolbhabe submit hoyeche!');
    document.getElementById('autoPaymentForm').reset();
    loadPaymentHistory();
  });
}

function loadPaymentHistory() {
  let payments = JSON.parse(localStorage.getItem('portal_payments_db') || '[]');
  const tbody = document.getElementById('paymentHistoryTable');
  if (!tbody) return;
  tbody.innerHTML = '';

  const userPayments = payments.filter(p => p.userEmail === loggedInUserEmail);
  if (userPayments.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" style="color:#64748b;">Kono payment history paoya jayni.</td></tr>';
    return;
  }

  const now = Date.now();
  let updatedList = false;

  userPayments.forEach(p => {
    if (p.status === 'Pending' && now >= p.autoApproveTime && !p.balanceAdded) {
      p.status = 'Approved (Auto)';
      p.balanceAdded = true;
      updateUserBalance(p.userEmail, p.amount);
      updatedList = true;
    }

    let statusHtml = '';
    if (p.status.includes('Approved')) {
      statusHtml = `<span style="color:#10b981; font-weight:bold;">Approved ✅</span>`;
    } else if (p.status === 'Rejected') {
      statusHtml = `<span style="color:#ef4444; font-weight:bold;">Rejected ❌</span>`;
    } else {
      const remTime = Math.max(0, Math.floor((p.autoApproveTime - now) / 1000));
      const mins = Math.floor(remTime / 60);
      const secs = remTime % 60;
      statusHtml = `<span style="color:#f97316; font-weight:bold;">Pending ⏱ (${mins}m ${secs}s)</span>`;
    }

    tbody.innerHTML += `
      <tr>
        <td><strong>${p.method}</strong><br><span style="font-size:11px; color:#64748b;">${p.senderNo}</span></td>
        <td><strong>${convertToBanglaDigits(p.amount)} ৳</strong></td>
        <td>${p.trxId}</td>
        <td>${statusHtml}</td>
        <td><button class="btn-user-delete" onclick="deletePaymentHistory(${p.id})">🗑️</button></td>
      </tr>
    `;
  });

  if (updatedList) localStorage.setItem('portal_payments_db', JSON.stringify(payments));
}

function deletePaymentHistory(id) {
  if (confirm('Aapni ki ei payment history record delete korte chan?')) {
    let payments = JSON.parse(localStorage.getItem('portal_payments_db') || '[]');
    payments = payments.filter(p => p.id !== id);
    localStorage.setItem('portal_payments_db', JSON.stringify(payments));
    loadPaymentHistory();
  }
}

function showRegister() {
  document.getElementById('loginBox').style.display = 'none';
  document.getElementById('registerBox').style.display = 'flex';
}

function showLogin() {
  document.getElementById('registerBox').style.display = 'none';
  document.getElementById('loginBox').style.display = 'flex';
}

function generateUniqueUserId() { return 'SB-' + Math.floor(1000 + Math.random() * 9000); }

function handleRegister(e) {
  e.preventDefault();
  const name = document.getElementById('regUser').value.trim();
  const email = document.getElementById('regEmail').value.trim().toLowerCase();
  const pass = document.getElementById('regPass').value.trim();
  if(!email || !pass || !name) return;

  let users = JSON.parse(localStorage.getItem('portal_users_db') || '{}');
  if(users[email]) { alert('Ei email diye already registration kora ache!'); return; }
  const generatedId = generateUniqueUserId();
  users[email] = { name: name, pass: pass, userId: generatedId, isBlocked: false };
  localStorage.setItem('portal_users_db', JSON.stringify(users));
  alert(`Registration shofol hoyeche!\nUser ID: ${generatedId}`);
  showLogin();
}

function handleLogin(e) {
  e.preventDefault();
  const inputVal = document.getElementById('loginEmail').value.trim().toLowerCase();
  const pass = document.getElementById('loginPass').value.trim();

  let users = JSON.parse(localStorage.getItem('portal_users_db') || '{}');
  let matchedEmail = null;
  let matchedUser = null;

  if (inputVal === 'user@gmail.com' && pass === '123456') {
    matchedEmail = 'user@gmail.com';
    matchedUser = users['user@gmail.com'] || { name: 'Demo User', userId: 'SB-1001', isBlocked: false };
  } else {
    for (let emailKey in users) {
      const uObj = users[emailKey];
      if ((emailKey === inputVal || (uObj.userId && uObj.userId.toLowerCase() === inputVal)) && uObj.pass === pass) {
        matchedEmail = emailKey;
        matchedUser = uObj;
        break;
      }
    }
  }

  if (matchedUser) {
    if (matchedUser.isBlocked === true) {
      alert('Aapnar account block kora hoyeche!');
      return;
    }

    loggedInUserEmail = matchedEmail;
    loggedInUserId = matchedUser.userId || 'SB-1001';
    localStorage.setItem('portal_active_session', JSON.stringify({ email: matchedEmail, userId: loggedInUserId }));
    localStorage.setItem('portal_active_service', 'হোম');

    resetAllFormData();
    renderDashboard();
  } else {
    alert('Bhul email / user ID ba password!');
  }
}

function handleLogout() {
  localStorage.removeItem('portal_active_session');
  localStorage.removeItem('portal_active_service');
  loggedInUserEmail = '';
  loggedInUserId = '';
  
  resetAllFormData();

  document.getElementById('mainContent').style.display = 'none';
  document.getElementById('topHeader').style.display = 'none';
  document.getElementById('loginBox').style.display = 'flex';
  document.getElementById('sidebarDrawer').classList.remove('active');
  document.getElementById('sidebarOverlay').classList.remove('active');
}

function previewPhoto(event) {
  const file = event.target.files[0];
  if (file) {
    const reader = new FileReader();
    reader.onload = function(e) { 
      tempUploadedPhoto = e.target.result;
      document.getElementById('out-photo').src = e.target.result; 
    }
    reader.readAsDataURL(file);
  }
}

function previewSign(event) {
  const file = event.target.files[0];
  if (file) {
    const readerObj = new FileReader();
    readerObj.onload = function(e) { 
      tempUploadedSign = e.target.result;
      document.getElementById('out-sign').src = e.target.result; 
    }
    readerObj.readAsDataURL(file);
  }
}

function previewScPhoto(event) {
  const file = event.target.files[0];
  if (file) {
    const reader = new FileReader();
    reader.onload = function(e) {
      document.getElementById('scPhotoPreview').src = e.target.result;
      tempUploadedPhoto = e.target.result;
      document.getElementById('out-photo').src = e.target.result;
    }
    reader.readAsDataURL(file);
  }
}

function previewScSign(event) {
  const file = event.target.files[0];
  if (file) {
    const reader = new FileReader();
    reader.onload = function(e) {
      const signPrev = document.getElementById('scSignPreview');
      signPrev.src = e.target.result;
      signPrev.style.display = 'block';
      document.getElementById('signPlaceholderText').style.display = 'none';
      tempUploadedSign = e.target.result;
      document.getElementById('out-sign').src = e.target.result;
    }
    reader.readAsDataURL(file);
  }
}

async function getDirectPdfImages(page) {
  const operatorList = await page.getOperatorList();
  const extractedImages = [];

  for (let j = 0; j < operatorList.fnArray.length; j++) {
    if (operatorList.fnArray[j] === pdfjsLib.OPS.paintImageXObject || operatorList.fnArray[j] === pdfjsLib.OPS.paintInlineImageXObject) {
      const imgName = operatorList.argsArray[j][0];
      let imgObj = null;
      try { imgObj = page.objs.get(imgName); } catch(err) {
        try { imgObj = page.commonObjs.get(imgName); } catch(e){}
      }

      if (imgObj && imgObj.width > 30 && imgObj.height > 20) {
        const canvas = document.createElement('canvas');
        canvas.width = imgObj.width;
        canvas.height = imgObj.height;
        const ctx = canvas.getContext('2d');
        
        let imgData = ctx.createImageData(imgObj.width, imgObj.height);
        if (imgObj.data.length === imgObj.width * imgObj.height * 4) {
          imgData.data.set(imgObj.data);
        } else if (imgObj.data.length === imgObj.width * imgObj.height * 3) {
          let jIdx = 0;
          for (let k = 0; k < imgObj.data.length; k += 3) {
            imgData.data[jIdx] = imgObj.data[k];
            imgData.data[jIdx+1] = imgObj.data[k+1];
            imgData.data[jIdx+2] = imgObj.data[k+2];
            imgData.data[jIdx+3] = 255;
            jIdx += 4;
          }
        } else {
          let jIdx = 0;
          for (let k = 0; k < imgObj.data.length; k++) {
            let val = imgObj.data[k];
            imgData.data[jIdx] = val;
            imgData.data[jIdx+1] = val;
            imgData.data[jIdx+2] = val;
            imgData.data[jIdx+3] = 255;
            jIdx += 4;
          }
        }
        ctx.putImageData(imgData, 0, 0);
        extractedImages.push({
          url: canvas.toDataURL('image/png'),
          width: imgObj.width,
          height: imgObj.height,
          ratio: imgObj.height / imgObj.width
        });
      }
    }
  }
  return extractedImages;
}

async function extractPhotoAndSignOnly(event) {
  const file = event.target.files[0];
  if (!file) return;

  const loadingEl = document.getElementById('loadingOverlay');
  document.getElementById('loadingText').innerText = "Chobi o shakkhor alada kora hocche...";
  loadingEl.style.display = 'flex';

  const fileReader = new FileReader();
  fileReader.onload = async function() {
    try {
      const typedarray = new Uint8Array(this.result);
      const pdf = await pdfjsLib.getDocument(typedarray).promise;

      let photoUrl = "", signUrl = "";
      const page = await pdf.getPage(1);
      const images = await getDirectPdfImages(page);
      if (images.length > 0) {
        let photoObj = images.find(img => img.ratio >= 1.05);
        let signObj = images.find(img => img.ratio < 1.05 || img !== photoObj);
        if (photoObj) photoUrl = photoObj.url;
        if (signObj) signUrl = signObj.url;
      }

      if (!photoUrl || !signUrl) {
        const viewport = page.getViewport({ scale: 2.0 });
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.height = viewport.height;
        canvas.width = viewport.width;

        await page.render({ canvasContext: context, viewport: viewport }).promise;

        if (!photoUrl) {
          const pCanvas = document.createElement('canvas');
          pCanvas.width = 180; pCanvas.height = 220;
          pCanvas.getContext('2d').drawImage(canvas, 30, 30, 220, 260, 0, 0, 180, 220);
          photoUrl = pCanvas.toDataURL('image/png');
        }

        if (!signUrl) {
          const sCanvas = document.createElement('canvas');
          sCanvas.width = 240; sCanvas.height = 120;
          sCanvas.getContext('2d').drawImage(canvas, 600, 30, 350, 200, 0, 0, 240, 120);
          signUrl = sCanvas.toDataURL('image/png');
        }
      }

      document.getElementById('extPhotoPreview').src = photoUrl;
      document.getElementById('btnDownloadPhoto').href = photoUrl;
      document.getElementById('extSignPreview').src = signUrl;
      document.getElementById('btnDownloadSign').href = signUrl;

      document.getElementById('extractResultArea').style.display = 'flex';
      setTimeout(() => { loadingEl.style.display = 'none'; }, 500);

    } catch (err) {
      console.error("Extraction error", err);
      loadingEl.style.display = 'none';
    }
  };
  fileReader.readAsArrayBuffer(file);
}

async function handlePdfAutoFill(event) {
  const file = event.target.files[0];
  if (!file) return;

  const loadingEl = document.getElementById('loadingOverlay');
  document.getElementById('loadingText').innerText = "Python server diye PDF processing hocche...";
  loadingEl.style.display = 'flex';

  try {
    if (!file.type.includes('pdf')) {
      const reader = new FileReader();
      reader.onload = function(e) {
        tempUploadedPhoto = e.target.result;
        document.getElementById('scPhotoPreview').src = e.target.result;
        document.getElementById('out-photo').src = e.target.result;
        loadingEl.style.display = 'none';
      };
      reader.readAsDataURL(file);
      return;
    }

    const formData = new FormData();
    formData.append('pdf', file);

    const response = await fetch('http://127.0.0.1:5000/parse-pdf', {
      method: 'POST',
      body: formData
    });

    if (!response.ok) throw new Error('Python backend response error');

    const data = await response.json();
    const fullText = data.full_text || "";
    let rawLines = fullText.split('\n').map(l => l.trim()).filter(l => l.length > 0);

    const fileReader = new FileReader();
    fileReader.onload = async function() {
      try {
        const typedarray = new Uint8Array(this.result);
        const pdf = await pdfjsLib.getDocument(typedarray).promise;
        const page1 = await pdf.getPage(1);
        let photoUrl = "", signUrl = "";

        const images = await getDirectPdfImages(page1);
        if (images.length > 0) {
          let photoObj = images.find(img => img.ratio >= 1.05);
          let signObj = images.find(img => img.ratio < 1.05 || img !== photoObj);
          if (photoObj) photoUrl = photoObj.url;
          if (signObj) signUrl = signObj.url;
        }

        if (!photoUrl || !signUrl) {
          const viewport = page1.getViewport({ scale: 2.0 });
          const canvas = document.createElement('canvas');
          const context = canvas.getContext('2d');
          canvas.height = viewport.height;
          canvas.width = viewport.width;

          await page1.render({ canvasContext: context, viewport: viewport }).promise;

          if (!photoUrl) {
            const pCanvas = document.createElement('canvas');
            pCanvas.width = 180; pCanvas.height = 220;
            pCanvas.getContext('2d').drawImage(canvas, 30, 30, 220, 260, 0, 0, 180, 220);
            photoUrl = pCanvas.toDataURL('image/png');
          }

          if (!signUrl) {
            const sCanvas = document.createElement('canvas');
            sCanvas.width = 240; sCanvas.height = 120;
            sCanvas.getContext('2d').drawImage(canvas, 600, 30, 350, 200, 0, 0, 240, 120);
            signUrl = sCanvas.toDataURL('image/png');
          }
        }

        if (photoUrl) {
          tempUploadedPhoto = photoUrl;
          document.getElementById('scPhotoPreview').src = photoUrl;
          document.getElementById('out-photo').src = photoUrl;
        }

        if (signUrl) {
          tempUploadedSign = signUrl;
          const signPrev = document.getElementById('scSignPreview');
          signPrev.src = signUrl;
          signPrev.style.display = 'block';
          document.getElementById('signPlaceholderText').style.display = 'none';
          tempUploadedSign = signUrl;
          document.getElementById('out-sign').src = signUrl;
        }
      } catch(imgErr) {
        console.error("Image extraction warning:", imgErr);
      }
    };
    fileReader.readAsArrayBuffer(file);

    let nidVal = "", pinVal = "", nameEnVal = "", nameBnVal = "", fatherVal = "", motherVal = "", spouseVal = "", dobVal = "", birthPlaceVal = "", bloodVal = "";
    let holdingVal = "", villageVal = "", mouzaVal = "", postVal = "", codeVal = "", upozilaVal = "", distVal = "";

    let nidMatch = fullText.match(/National\s*ID\s*[|:]?\s*(\d{10,17})/i);
    if (nidMatch) nidVal = nidMatch[1];

    let pinMatch = fullText.match(/Pin\s*[|:]?\s*(\d{13,18})/i);
    if (pinMatch) pinVal = pinMatch[1];

    let dobMatch = fullText.match(/Date\s*of\s*Birth\s*[|:]?\s*(\d{4}-\d{2}-\d{2})/i);
    if (dobMatch) dobVal = dobMatch[1];

    if (data.extracted_holding) {
      holdingVal = fixFontBreakage(data.extracted_holding);
    }

    for (let idx = 0; idx < rawLines.length; idx++) {
      let line = rawLines[idx];

      if (!nameBnVal && (line.includes("Name(Bangla)") || line.includes("Name Bangla") || line.includes("নাম(বাংলা)"))) {
        let val = line.replace(/Name\(Bangla\)|Name Bangla|নাম\(বাংলা\)\s*[-|:]/gi, '').trim();
        if ((!val || val === "|") && idx + 1 < rawLines.length) val = rawLines[idx + 1].replace(/^[|]/, '').trim();
        nameBnVal = fixFontBreakage(val);
      }

      if (!nameEnVal && (line.includes("Name(English)") || line.includes("Name English") || line.includes("নাম(ইংরেজি)"))) {
        let val = line.replace(/Name\(English\)|Name English|নাম\(ইংরেজি\)\s*[-|:]/gi, '').trim();
        if ((!val || val === "|") && idx + 1 < rawLines.length) val = rawLines[idx + 1].replace(/^[|]/, '').trim();
        nameEnVal = val.replace(/[^A-Za-z\s.-]/g, '').trim();
      }

      if (!fatherVal && (line.includes("Father Name") || line.includes("পিতার নাম"))) {
        let val = line.replace(/Father Name|পিতার নাম\s*[-|:]/gi, '').trim();
        if ((!val || val === "|") && idx + 1 < rawLines.length) val = rawLines[idx + 1].replace(/^[|]/, '').trim();
        fatherVal = fixFontBreakage(val);
      }

      if (!motherVal && (line.includes("Mother Name") || line.includes("মাতার নাম"))) {
        let val = line.replace(/Mother Name|মাতার নাম\s*[-|:]/gi, '').trim();
        if ((!val || val === "|") && idx + 1 < rawLines.length) val = rawLines[idx + 1].replace(/^[|]/, '').trim();
        motherVal = fixFontBreakage(val);
      }

      if (!spouseVal && (line.includes("Spouse Name") || line.includes("স্বামী বা স্ত্রীর নাম"))) {
        let val = line.replace(/Spouse Name|স্বামী বা স্ত্রীর নাম\s*[-|:]/gi, '').trim();
        if ((!val || val === "|") && idx + 1 < rawLines.length) val = rawLines[idx + 1].replace(/^[|]/, '').trim();
        if (val && !val.includes("Gender") && !val.includes("|")) {
          spouseVal = fixFontBreakage(val);
        }
      }

      if (!birthPlaceVal && (line.includes("Birth Place") || line.includes("Birthplace") || line.includes("জন্ম স্থান"))) {
        let val = line.replace(/Birth Place|Birthplace|জন্মস্থান\s*[-|:]/gi, '').trim();
        if ((!val || val === "|") && idx + 1 < rawLines.length) val = rawLines[idx + 1].replace(/^[|]/, '').trim();
        birthPlaceVal = fixFontBreakage(val);
      }

      if (!bloodVal && (line.includes("Blood Group") || line.includes("রক্তের গ্রুপ"))) {
        let val = line.replace(/Blood Group|রক্তের গ্রুপ\s*[-|:]/gi, '').trim();
        if ((!val || val === "|") && idx + 1 < rawLines.length) val = rawLines[idx + 1].replace(/^[|]/, '').trim();
        if (val && val !== "|") bloodVal = val.replace(/[^A-Za-z+-]/g, '').trim();
      }

      if (!holdingVal && (line.includes("Home/Holding") || line.includes("HomeHolding") || line.includes("হোল্ডিং"))) {
        let val = line.replace(/Home\s*\/?\s*Holding\s*(No|Num|Number)?|Holding|বাসা\s*\/?\s*হোল্ডিং|Home\/Holding/gi, '').replace(/^[-|:]/, '').trim();
        if (val && val !== '|' && !val.includes("Postal") && !val.includes("District")) {
          holdingVal = fixFontBreakage(val);
        } else {
          for (let k = 1; k <= 5; k++) {
            if (idx + k < rawLines.length) {
              let cand = rawLines[idx + k].replace(/^[|]/, '').trim();
              if (cand && cand !== '|' && !cand.includes("Postal") && !cand.includes("District") && !cand.includes("Union") && !cand.includes("Ward")) {
                holdingVal = fixFontBreakage(cand);
                break;
              }
            }
          }
        }
      }

      if (!villageVal && (line.includes("Village/Road") || line.includes("Village") || line.includes("গ্রাম/রাস্তা"))) {
        let val = line.replace(/Additional |Village\/Road|VillageRoad|Villages|গ্রাম\/রাস্তা\s*[-|:]/gi, '').trim();
        if ((!val || val === "|") && idx + 1 < rawLines.length) val = rawLines[idx + 1].replace(/^[|]/, '').trim();
        let cleaned = fixFontBreakage(val);
        if (cleaned && cleaned !== 'NA' && !cleaned.match(/^\d{4}$/)) villageVal = cleaned;
      }

      if (!mouzaVal && (line.includes("Mouza/Moholla") || line.includes("Mouza") || line.includes("মৌজা/মহল্লা"))) {
        let val = line.replace(/Additional |Mouza\/Moholla|Mouza|মৌজা\/মহল্লা\s*[-|:]/gi, '').trim();
        if ((!val || val === "|") && idx + 1 < rawLines.length) val = rawLines[idx + 1].replace(/^[|]/, '').trim();
        let cleaned = fixFontBreakage(val);
        if (cleaned && cleaned !== 'NA' && !cleaned.match(/^\d{4}$/)) mouzaVal = cleaned;
      }

      if (!postVal && (line.includes("Post Office") || line.includes("Post") || line.includes("ডাকঘর"))) {
        let val = line.replace(/Post Office|Posts|ডাকঘর\s*[-|:]/gi, '').trim();
        if ((!val || val === "|") && idx + 1 < rawLines.length) val = rawLines[idx + 1].replace(/^[|]/, '').trim();
        let cleaned = fixFontBreakage(val);
        if (cleaned && cleaned !== 'NA' && !cleaned.match(/^\d{4}$/)) postVal = cleaned;
      }

      if (!codeVal && (line.includes("Postal Code") || line.includes("পোস্ট কোড"))) {
        let m = line.match(/\b(3\d{3}|1\d{3}|2\d{3}|4\d{3}|5\d{3}|6\d{3}|7\d{3}|8\d{3})\b/);
        if (m) {
          codeVal = m[1];
        } else if (idx + 1 < rawLines.length) {
          let nextLine = rawLines[idx + 1].trim();
          let mNext = nextLine.match(/\b(3\d{3}|1\d{3}|2\d{3}|4\d{3}|5\d{3}|6\d{3}|7\d{3}|8\d{3})\b/);
          if (mNext) codeVal = mNext[1];
        }
      }

      if (!upozilaVal && (line.includes("Upozila") || line.includes("উপজেলা"))) {
        let val = line.replace(/Upozila|উপজেলা\s*[-|:]/gi, '').trim();
        if ((!val || val === "|") && idx + 1 < rawLines.length) val = rawLines[idx + 1].replace(/^[|]/, '').trim();
        upozilaVal = fixFontBreakage(val);
      }

      if (!distVal && (line.includes("District") || line.includes("জেলা"))) {
        let val = line.replace(/District|জেলা\s*[-|:]/gi, '').trim();
        if ((!val || val === "|") && idx + 1 < rawLines.length) val = rawLines[idx + 1].replace(/^[|]/, '').trim();
        distVal = fixFontBreakage(val);
      }
    }

    if (!codeVal) {
      let allCodes = fullText.match(/\b(3\d{3}|1\d{3}|2\d{3}|4\d{3}|5\d{3}|6\d{3}|7\d{3}|8\d{3})\b/g);
      if (allCodes && allCodes.length > 0) {
        let dobYear = dobVal ? dobVal.split('-')[0] : "";
        let validCode = allCodes.find(c => c !== dobYear);
        if (validCode) codeVal = validCode;
      }
    }

    document.getElementById('scNameBn').value = nameBnVal;
    document.getElementById('scNameEn').value = nameEnVal;
    document.getElementById('scIdNo').value = nidVal;
    document.getElementById('scPinNo').value = pinVal;
    document.getElementById('scFatherName').value = fatherVal;
    document.getElementById('scMotherName').value = motherVal;
    document.getElementById('scSpouseName').value = spouseVal;
    document.getElementById('scBirthPlace').value = birthPlaceVal;
    if (dobVal) document.getElementById('scDob').value = formatDateToDDMonYYYY(dobVal);
    if (bloodVal) document.getElementById('scBloodGroup').value = bloodVal;

    let formattedCodeVal = codeVal ? convertToBanglaDigits(codeVal) : '';
    let addressParts = [];

    let cleanHolding = holdingVal ? fixFontBreakage(holdingVal) : '';
    if (cleanHolding && cleanHolding !== 'NA' && cleanHolding !== 'N/A' && cleanHolding !== '-') {
      addressParts.push(`বাসা/হোল্ডিং: ${cleanHolding}`);
    } else {
      addressParts.push(`বাসা/হোল্ডিং: -`);
    }

    let cleanVillage = villageVal ? fixFontBreakage(villageVal) : '';
    if (cleanVillage && cleanVillage !== 'NA') addressParts.push(`গ্রাম/রাস্তা: ${cleanVillage}`);

    if (mouzaVal && mouzaVal !== 'NA' && mouzaVal !== villageVal) {
      addressParts.push(fixFontBreakage(mouzaVal));
    }

    let pStr = (postVal && postVal !== 'NA') ? fixFontBreakage(postVal) : '';
    let cStr = formattedCodeVal ? ` - ${formattedCodeVal}` : '';
    if (pStr || cStr) addressParts.push(`ডাকঘর: ${pStr}${cStr}`);

    if (upozilaVal) addressParts.push(fixFontBreakage(upozilaVal));
    if (distVal) addressParts.push(fixFontBreakage(distVal));

    document.getElementById('scAddress').value = addressParts.join(', ');

    setTimeout(() => { loadingEl.style.display = 'none'; }, 400);

  } catch (err) {
    console.error("Python Server PDF Parsing error:", err);
    alert('Python server theke data ante shomossha hoyeche.');
    loadingEl.style.display = 'none';
  }
}

function handleSignCopySubmit(e) {
  e.preventDefault();
  const userBal = getUserBalance(loggedInUserEmail);
  if (userBal < 2) {
    alert('Apnar balance porjapto nei! NID download korar jonno andaj 2 taka lagbe.');
    return;
  }

  const nidNo = document.getElementById('scIdNo').value;
  const dob = document.getElementById('scDob').value;
  const nameBn = document.getElementById('scNameBn').value;
  const nameEn = document.getElementById('scNameEn').value;
  const fatherName = document.getElementById('scFatherName').value;
  const motherName = document.getElementById('scMotherName').value;
  const birthPlace = document.getElementById('scBirthPlace').value;
  const issueDate = document.getElementById('scIssueDate').value;
  const bloodGroup = document.getElementById('scBloodGroup').value;
  const address = document.getElementById('scAddress').value;

  updateUserBalance(loggedInUserEmail, -2);

  const historyRecord = {
    id: editingManualRecordId ? editingManualRecordId : Date.now(),
    userEmail: loggedInUserEmail,
    nidNo: nidNo,
    oldNidNo: document.getElementById('scPinNo').value,
    dob: dob,
    nameBn: nameBn,
    nameEn: nameEn,
    fatherName: fatherName,
    motherName: motherName,
    birthPlace: birthPlace,
    issueDate: issueDate,
    bloodGroup: bloodGroup,
    address: address,
    photo: tempUploadedPhoto || document.getElementById('out-photo').src || '',
    sign: tempUploadedSign || document.getElementById('out-sign').src || ''
  };

  let historyList = JSON.parse(localStorage.getItem('portal_manual_history') || '[]');
  if (editingManualRecordId) {
    const index = historyList.findIndex(h => h.id === editingManualRecordId);
    if (index !== -1) historyList[index] = historyRecord;
    else historyList.unshift(historyRecord);
  } else {
    historyList.unshift(historyRecord);
  }
  localStorage.setItem('portal_manual_history', JSON.stringify(historyList));
  editingManualRecordId = null;

  selectService('এনআইডি হিস্টোরি');
  triggerNidPrint(historyRecord);
}

function generatePDF417Barcode(pinNo, nameEnText, dobText) {
  try {
    const barcodeData = `<pin>${pinNo || ''}</pin><name>${nameEnText || ''}</name><DOB>${dobText || ''}</DOB><FP></FP><F>Right Index</F><TYPE></TYPE><V>2.0</V>`;
    bwipjs.toCanvas('pdf417-barcode', { bcid: 'pdf417', text: barcodeData, scale: 3, height: 12, includetext: false });
  } catch (e) { console.error('Barcode error', e); }
}

function handleManualDirectDownload(e) {
  e.preventDefault();
  const nidNo = document.getElementById('nidNo').value;
  const oldNidNo = document.getElementById('oldNidNo').value;
  const dob = document.getElementById('dob').value;
  const nameBn = document.getElementById('nameBn').value;
  const nameEn = document.getElementById('nameEn').value;
  const fatherName = document.getElementById('fatherName').value;
  const motherName = document.getElementById('motherName').value;
  const birthPlace = document.getElementById('birthPlace').value;
  const issueDateRaw = document.getElementById('issueDate').value;
  const bloodGroup = document.getElementById('bloodGroup').value;
  const address = document.getElementById('address').value;

  const formattedIssueDate = convertToBanglaDigits(issueDateRaw);

  const historyRecord = {
    id: editingManualRecordId ? editingManualRecordId : Date.now(),
    userEmail: loggedInUserEmail,
    nidNo: nidNo,
    oldNidNo: oldNidNo,
    dob: dob,
    nameBn: nameBn,
    nameEn: nameEn,
    fatherName: fatherName,
    motherName: motherName,
    birthPlace: birthPlace,
    issueDate: formattedIssueDate,
    bloodGroup: bloodGroup,
    address: address,
    photo: tempUploadedPhoto || document.getElementById('out-photo').src || '',
    sign: tempUploadedSign || document.getElementById('out-sign').src || ''
  };

  let historyList = JSON.parse(localStorage.getItem('portal_manual_history') || '[]');
  if (editingManualRecordId) {
    const index = historyList.findIndex(h => h.id === editingManualRecordId);
    if (index !== -1) historyList[index] = historyRecord;
    else historyList.unshift(historyRecord);
  } else {
    historyList.unshift(historyRecord);
  }
  localStorage.setItem('portal_manual_history', JSON.stringify(historyList));
  editingManualRecordId = null;

  selectService('এনআইডি হিস্টোরি');
  triggerNidPrint(historyRecord);
}

function triggerNidPrint(data) {
  document.body.classList.add('printing-nid');

  document.getElementById('out-nameBn').innerText = data.nameBn;
  document.getElementById('out-nameEn').innerText = data.nameEn;
  document.getElementById('out-fatherName').innerText = data.fatherName;
  document.getElementById('out-motherName').innerText = data.motherName;
  document.getElementById('out-dob').innerText = data.dob;
  document.getElementById('out-nidNo').innerText = data.nidNo;
  document.getElementById('out-address').innerText = data.address;
  document.getElementById('out-bloodGroup').innerText = data.bloodGroup;
  document.getElementById('out-birthPlace').innerText = data.birthPlace;
  
  const issueDateEl = document.getElementById('out-issueDate');
  issueDateEl.innerText = data.issueDate;
  issueDateEl.style.setProperty('font-family', "'SolaimanLipi', 'Noto Serif Bengali', Arial, sans-serif", 'important');

  if(data.photo) document.getElementById('out-photo').src = data.photo;
  if(data.sign) {
    const outSign = document.getElementById('out-sign');
    outSign.src = data.sign;
  }

  generatePDF417Barcode(data.oldNidNo || data.nidNo, data.nameEn, data.dob);

  const bgImg = new Image();
  bgImg.src = 'nid-bg.jpg';

  const doPrint = function() {
    window.print();
    setTimeout(() => { document.body.classList.remove('printing-nid'); }, 500);
  };

  bgImg.onload = function() { setTimeout(doPrint, 200); };
  bgImg.onerror = function() { setTimeout(doPrint, 200); };
}

function reprintManualCard(recordId) {
  let historyList = JSON.parse(localStorage.getItem('portal_manual_history') || '[]');
  const target = historyList.find(h => h.id === recordId);
  if (target) triggerNidPrint(target);
}

function editManualCard(recordId) {
  let historyList = JSON.parse(localStorage.getItem('portal_manual_history') || '[]');
  const target = historyList.find(h => h.id === recordId);
  if (target) {
    editingManualRecordId = recordId;
    selectService('এনআইডি ম্যানুয়াল', false);
    document.getElementById('nidNo').value = target.nidNo || '';
    document.getElementById('oldNidNo').value = target.oldNidNo || '';
    document.getElementById('dob').value = target.dob || '';
    document.getElementById('nameBn').value = target.nameBn || '';
    document.getElementById('nameEn').value = target.nameEn || '';
    document.getElementById('fatherName').value = target.fatherName || '';
    document.getElementById('motherName').value = target.motherName || '';
    document.getElementById('birthPlace').value = target.birthPlace || '';
    document.getElementById('issueDate').value = target.issueDate || '';
    document.getElementById('bloodGroup').value = target.bloodGroup || '';
    document.getElementById('address').value = target.address || '';

    if (target.photo) {
      tempUploadedPhoto = target.photo;
      document.getElementById('out-photo').src = target.photo;
    }
    if (target.sign) {
      tempUploadedSign = target.sign;
      document.getElementById('out-sign').src = target.sign;
    }

    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
}

function deleteManualHistory(recordId) {
  if (confirm('Aapni ki ei manual history delete korte chan?')) {
    let historyList = JSON.parse(localStorage.getItem('portal_manual_history') || '[]');
    historyList = historyList.filter(h => h.id !== recordId);
    localStorage.setItem('portal_manual_history', JSON.stringify(historyList));
    loadManualHistory();
  }
}

function loadManualHistory() {
  let historyList = JSON.parse(localStorage.getItem('portal_manual_history') || '[]');
  const tbody = document.getElementById('manualHistoryTable');
  if (!tbody) return;
  tbody.innerHTML = '';

  const userHistory = historyList.filter(h => h.userEmail === loggedInUserEmail);
  if (userHistory.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" style="color:#64748b; font-size:11px;">Kono manual history paoya jayni.</td></tr>';
    return;
  }

  userHistory.forEach(h => {
    tbody.innerHTML += `
      <tr>
        <td style="text-align:left; padding:4px 3px;">
          <strong style="font-size:11px; display:block; line-height:1.2;">${h.nameBn}</strong>
          <span style="font-size:9px; color:#64748b; display:block; line-height:1.1;">${h.nameEn}</span>
        </td>
        <td style="padding:4px 3px; font-size:10px;">${h.nidNo}</td>
        <td style="padding:4px 3px; font-size:10px;">${h.dob}</td>
        <td style="padding:4px 3px;">
          <div style="display:flex; gap:2px; justify-content:center; align-items:center;">
            <button class="action-btn-download" onclick="reprintManualCard(${h.id})" style="padding:3px 5px; font-size:10px;">Print</button>
            <button class="action-btn-edit" onclick="editManualCard(${h.id})" style="padding:3px 5px; font-size:10px;" title="Edit">✏️</button>
          </div>
        </td>
        <td style="padding:4px 3px;">
          <button class="btn-user-delete" onclick="deleteManualHistory(${h.id})" style="padding:3px 5px; font-size:10px;">🗑️</button>
        </td>
      </tr>
    `;
  });
}

function handleServerCopyRequest(e) {
  e.preventDefault();
  const nidNo = document.getElementById('scNidNo').value;
  const dob = document.getElementById('reqDob').value;

  let reqList = JSON.parse(localStorage.getItem('portal_requests_db') || '[]');
  const newReq = {
    id: Date.now(),
    userEmail: loggedInUserEmail,
    userId: loggedInUserId,
    serviceName: 'সার্ভার কপি',
    nidNo: nidNo,
    dob: dob,
    nameEn: '', nameBn: '', fatherName: '', motherName: '', birthPlace: '', issueDate: '', bloodGroup: '', address: '',
    status: 'Pending', note: '', uploadedFile: null, deletedByUsers: [], timestamp: Date.now() + (5 * 60 * 1000)
  };

  reqList.unshift(newReq);
  localStorage.setItem('portal_requests_db', JSON.stringify(reqList));
  loadUserRequests();
  alert('Server copy abedon shofolbhabe submit hoyeche!');
  document.getElementById('serverCopyForm').reset();
}

function downloadAdminFile(reqId) {
  let reqList = JSON.parse(localStorage.getItem('portal_requests_db') || '[]');
  const targetReq = reqList.find(r => r.id === reqId);

  if (targetReq && targetReq.uploadedFile) {
    const fileData = targetReq.uploadedFile;
    const downloadLink = document.createElement('a');
    downloadLink.href = fileData;
    let fileName = `Server_Copy_${targetReq.nidNo || 'Document'}.pdf`;
    if (fileData.startsWith('data:image/png')) fileName = `Server_Copy_${targetReq.nidNo || 'Document'}.png`;
    
    downloadLink.download = fileName;
    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);
  } else {
    alert('Admin panel theke ekhono kono document/file upload kora hoyni!');
  }
}

function deleteUserRequest(reqId) {
  if (confirm('Aapni ki ei request list theke muche felte chan?')) {
    let reqList = JSON.parse(localStorage.getItem('portal_requests_db') || '[]');
    reqList = reqList.map(r => {
      if (r.id === reqId) {
        if (!r.deletedByUsers) r.deletedByUsers = [];
        if (!r.deletedByUsers.includes(loggedInUserEmail)) r.deletedByUsers.push(loggedInUserEmail);
      }
      return r;
    });
    localStorage.setItem('portal_requests_db', JSON.stringify(reqList));
    loadUserRequests();
  }
}

function loadUserRequests() {
  let reqList = JSON.parse(localStorage.getItem('portal_requests_db') || '[]');
  const tbody = document.getElementById('userRequestTable');
  tbody.innerHTML = '';

  const myRequests = reqList.filter(r => r.userEmail === loggedInUserEmail && (!r.deletedByUsers || !r.deletedByUsers.includes(loggedInUserEmail)));

  if (myRequests.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" style="color:#64748b;">Kono abedon paoya jayni.</td></tr>';
    return;
  }

  myRequests.forEach(r => {
    let actionHtml = '';
    let combinedStatusHtml = '';
    const now = Date.now();
    const diff = r.timestamp - now;

    if (r.status === 'Approved') {
      actionHtml = `<button class="action-btn-download" onclick="downloadAdminFile(${r.id})">Download</button>`;
      combinedStatusHtml = `<span style="color:#10b981; font-weight:bold;">Approved</span>`;
    } else if (r.status === 'Rejected') {
      actionHtml = `<span class="action-btn-cancelled">Cancelled</span>`;
      combinedStatusHtml = `<span style="color:#ef4444; font-weight:bold; display:block;">Cancelled</span><span style="color:#64748b; font-size:11px;">Note: ${r.note || 'N/A'}</span>`;
    } else {
      actionHtml = `<span class="action-btn-pending">Pending</span>`;
      if (diff > 0) {
        const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const secs = Math.floor((diff % (1000 * 60)) / 1000);
        combinedStatusHtml = `<span style="color:#f97316; font-weight:bold;">Pending</span><span style="font-size:11px; color:#475569;">⏱ ${mins}m ${secs}s baki</span>`;
      } else {
        combinedStatusHtml = `<span style="color:#f97316; font-weight:bold;">Pending</span><span style="font-size:11px; color:#ef4444;">⏱ Somoy shesh</span>`;
      }
    }

    tbody.innerHTML += `
      <tr>
        <td>${r.nidNo}</td>
        <td>${r.dob}</td>
        <td>${combinedStatusHtml}</td>
        <td>${actionHtml}</td>
        <td><button class="btn-user-delete" title="Delete" onclick="deleteUserRequest(${r.id})">🗑️</button></td>
      </tr>
    `;
  });
}

setInterval(() => {
  if(document.getElementById('serverCopyFormBox').classList.contains('active')) loadUserRequests();
  if(document.getElementById('autoPaymentFormBox').classList.contains('active')) loadPaymentHistory();
}, 1000);