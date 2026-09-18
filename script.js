// --- KONFIGURASI SUPABASE (WAJIB DIISI ULANG) ---
const SUPABASE_URL = 'https://wdhfthzuihakjlygttcw.supabase.co'; 
const SUPABASE_KEY = 'sb_publishable_8U8NeSn4aOZiRzLRS3KmxA_oz84fUAL';

// Inisialisasi Client Supabase
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// Variable Global
let orders = []; 
let currentUploadOrderId = null; 
let currentUploadType = null;   
let loaderTimeout = null; 
let activeUploadZone = null;
let currentDetailOrder = null; 
let currentDetailTab = 'depart'; 

// Variabel Form Wizard
let currentStep = 1;
const totalSteps = 5;

// --- INIT SYSTEM ---
document.addEventListener('DOMContentLoaded', async () => {
    const splash = document.getElementById('splash-screen');
    const video = document.getElementById('intro-video');
    const skipBtn = document.getElementById('btn-skip-intro');
    
    initializeAppLogic();

    const enterApp = () => {
        if(splash) {
            splash.classList.add('splash-hidden'); 
            setTimeout(() => { splash.remove(); }, 1000); 
        }
    };

    const startLoaderSequence = () => {
        const loaderWrapper = document.getElementById('post-video-loader');
        const loaderFill = document.getElementById('post-video-fill');
        const videoOverlay = document.getElementById('video-overlay');

        if (loaderWrapper && loaderFill) {
            loaderWrapper.style.opacity = '1';
            if(videoOverlay) videoOverlay.style.opacity = '1';

            setTimeout(() => { loaderFill.style.width = '100%'; }, 100);
            setTimeout(() => { enterApp(); }, 4100); 
        } else {
            enterApp();
        }
    };

    if (video) {
        setTimeout(() => { if(skipBtn) skipBtn.classList.remove('hidden'); }, 1000);
        video.addEventListener('ended', startLoaderSequence);
        setTimeout(() => { if(document.getElementById('splash-screen')) enterApp(); }, 15000); 
    } else {
        enterApp();
    }
    
    if(skipBtn) {
        skipBtn.addEventListener('click', (e) => {
            e.preventDefault();
            if(video) video.pause(); 
            startLoaderSequence();
        });
    }

    document.addEventListener('click', (e) => {
        if (!e.target.closest('.upload-zone-base')) resetUploadZones();
    });
});

function initializeAppLogic() {
    updateDate();
    updateGreeting(); 
    updateWarTicketReminder(); 
    fetchOrders(); 
    setupRealtime(); 
    
    updatePassengerForms(); 
    
    setupImageUploader('inpFileTransfer', 'inpTransferData', 'imgTransfer', 'previewTransfer');
    setupImageUploader('inpFileChat', 'inpChatData', 'imgChat', 'previewChat');
    setupImageUploader('inpFileTransferReturn', 'inpTransferDataReturn', 'imgTransferReturn', 'previewTransferReturn');
    setupImageUploader('inpFileChatReturn', 'inpChatDataReturn', 'imgChatReturn', 'previewChatReturn');

    setupHistoryUploader();
    enableSmoothInputUX();
    setupKeyboardListener();

    window.history.replaceState({ view: 'dashboard' }, '', '#dashboard');
    window.addEventListener('popstate', (e) => {
        const modal = document.getElementById('imageModal');
        if (modal && !modal.classList.contains('hidden')) {
            modal.classList.add('hidden');
            return; 
        }
        
        if (e.state && e.state.view) {
            if (e.state.view === 'detail') {
                openDetailView(e.state.id, true);
            } else if (e.state.view !== 'modal') {
                navTo(e.state.view, true);
            }
        } else {
            navTo('dashboard', true);
        }
    });
}

function setupKeyboardListener() {
    const nav = document.querySelector('nav');
    if (!nav) return;
    
    document.addEventListener('focusin', (e) => {
        const targetTag = e.target.tagName ? e.target.tagName.toLowerCase() : '';
        if (targetTag === 'input' || targetTag === 'select' || targetTag === 'textarea') {
            nav.classList.add('nav-hidden-keyboard');
        }
    });

    document.addEventListener('focusout', (e) => {
        setTimeout(() => {
            const activeTag = document.activeElement && document.activeElement.tagName ? document.activeElement.tagName.toLowerCase() : '';
            if (activeTag !== 'input' && activeTag !== 'select' && activeTag !== 'textarea') {
                nav.classList.remove('nav-hidden-keyboard');
            }
        }, 100);
    });

    const initialHeight = window.innerHeight;
    window.addEventListener('resize', () => {
        if (window.innerHeight < initialHeight - 150) {
            nav.classList.add('nav-hidden-keyboard');
        } else {
            const activeTag = document.activeElement && document.activeElement.tagName ? document.activeElement.tagName.toLowerCase() : '';
            if (activeTag !== 'input' && activeTag !== 'select' && activeTag !== 'textarea') {
                nav.classList.remove('nav-hidden-keyboard');
            }
        }
    });
}

// --- FEATURE: TAB SYSTEM LOGIC (PERGI / PULANG) ---
window.switchTab = function(tabName) {
    const btnDepart = document.getElementById('tab-btn-depart');
    const btnReturn = document.getElementById('tab-btn-return');
    const contentDepart = document.getElementById('tab-content-depart');
    const contentReturn = document.getElementById('tab-content-return');

    currentDetailTab = tabName;

    const inactiveClass = "flex-1 py-2 text-[10px] font-bold uppercase rounded-lg transition-all text-gray-400 hover:text-white relative";
    const activeClass = "flex-1 py-2 text-[10px] font-bold uppercase rounded-lg transition-all bg-davka-orange text-white shadow-lg relative";

    btnDepart.className = inactiveClass;
    btnReturn.className = inactiveClass;
    
    contentDepart.classList.add('hidden');
    contentReturn.classList.add('hidden');

    if (tabName === 'depart') {
        btnDepart.className = activeClass;
        contentDepart.classList.remove('hidden');
        
        if(currentDetailOrder) {
            document.getElementById('detail-origin').innerText = currentDetailOrder.origin || 'ORG';
            document.getElementById('detail-dest').innerText = currentDetailOrder.dest || 'DES';
            
            const accent = document.getElementById('detail-card-accent');
            if(accent) accent.className = "absolute top-0 left-0 w-1 h-full bg-davka-orange transition-colors";
            
            const routeWrapper = document.getElementById('detail-route-wrapper');
            if(routeWrapper) routeWrapper.className = "w-9 h-9 rounded-full bg-davka-bg/80 border border-white/10 flex items-center justify-center shadow-neon backdrop-blur-sm transition-all";
            
            const routeIcon = document.getElementById('detail-route-icon');
            if(routeIcon) routeIcon.className = "fas fa-train text-davka-orange text-sm drop-shadow-md transition-all";
            
            renderDetailFinancials('depart');
        }
    } else {
        btnReturn.className = activeClass;
        contentReturn.classList.remove('hidden');

        if(currentDetailOrder && currentDetailOrder.tripType === 'round_trip') {
            const retOrg = currentDetailOrder.returnOrigin || currentDetailOrder.dest || 'ORG';
            const retDes = currentDetailOrder.returnDest || currentDetailOrder.origin || 'DES';
            
            document.getElementById('detail-origin').innerText = retOrg;
            document.getElementById('detail-dest').innerText = retDes;
            
            const accent = document.getElementById('detail-card-accent');
            if(accent) accent.className = "absolute top-0 left-0 w-1 h-full bg-blue-500 transition-colors";
            
            const routeWrapper = document.getElementById('detail-route-wrapper');
            if(routeWrapper) routeWrapper.className = "w-9 h-9 rounded-full bg-blue-900/30 border border-blue-500/30 flex items-center justify-center shadow-[0_0_15px_rgba(59,130,246,0.3)] backdrop-blur-sm transition-all";
            
            const routeIcon = document.getElementById('detail-route-icon');
            if(routeIcon) routeIcon.className = "fas fa-exchange-alt text-blue-400 text-sm drop-shadow-md transition-all"; 
            
            renderDetailFinancials('return');
        }
    }
}
// --- CORE: FUNGSI RENDER FINANSIAL DINAMIS ---
function renderDetailFinancials(mode) {
    if(!currentDetailOrder) return;
    const order = currentDetailOrder;

    let price = 0;
    let dp = 0;
    let remaining = 0;
    let method = '-';
    let label = '';
    let themeColor = '';
    let themeBorder = '';

    if(mode === 'depart') {
        price = order.price || 0;
        dp = (order.feeDepart !== undefined) ? order.feeDepart : (order.fee || 0);
        method = order.paymentMethod || 'Tunai';
        label = 'Pergi';
        themeColor = 'text-davka-orange';
        themeBorder = 'border-white/10';
    } else {
        price = order.returnPrice || 0;
        dp = order.feeReturn || 0;
        method = order.paymentMethodReturn || 'Tunai';
        label = 'Pulang';
        themeColor = 'text-blue-400';
        themeBorder = 'border-blue-500/30';
    }

    remaining = price - dp;
    if (order.status === 'success') remaining = 0;

    const html = `
    <div class="bg-davka-bg border ${themeBorder} rounded-xl p-3 mb-2 animate-scale-up">
        <div class="flex items-center gap-2 mb-2 border-b ${themeBorder} pb-2">
            <i class="fas ${mode === 'depart' ? 'fa-train' : 'fa-exchange-alt'} ${themeColor} text-xs"></i>
            <span class="text-[10px] font-bold text-gray-300 uppercase">Rincian ${label}</span>
        </div>
        <div class="flex justify-between items-center mb-1">
             <span class="text-[10px] text-gray-500">Harga Tiket</span>
             <span class="text-xs font-bold text-white">${formatRupiah(price)}</span>
        </div>
        <div class="flex justify-between items-center mb-1">
             <span class="text-[10px] text-gray-500">DP (Bayar Awal)</span>
             <span class="text-xs font-bold ${themeColor}">- ${formatRupiah(dp)}</span>
        </div>
        <div class="flex justify-between items-center border-t border-dashed border-white/10 pt-1 mt-1">
             <span class="text-[10px] text-gray-400 font-bold">Sisa Tagihan ${label}</span>
             <span class="text-xs font-black ${remaining <= 0 ? 'text-green-500' : 'text-red-500'}">${formatRupiah(remaining)}</span>
        </div>
        <div class="flex justify-between items-end mt-2">
            <p class="text-[9px] text-gray-600 italic">Via: ${method}</p>
            <div class="px-2 py-0.5 rounded ${remaining <= 0 ? 'bg-green-500/20 text-green-400 border border-green-500/30' : 'bg-red-500/20 text-red-400 border border-red-500/30'}">
                <p class="text-[8px] font-bold uppercase">${remaining <= 0 ? 'LUNAS' : 'BELUM LUNAS'}</p>
            </div>
        </div>
    </div>
    `;

    const costContainer = document.getElementById('detail-cost-breakdown');
    costContainer.innerHTML = html;
    costContainer.classList.remove('hidden');

    document.getElementById('detail-price').innerText = formatRupiah(price);
    
    const remEl = document.getElementById('detail-remaining');
    remEl.innerText = formatRupiah(remaining);
    remEl.className = remaining <= 0 ? "text-sm font-black text-green-500" : "text-sm font-black text-red-500";
}

window.switchUploadTab = function(tabName) {
    const btnDepart = document.getElementById('btn-upload-depart');
    const btnReturn = document.getElementById('btn-upload-return');
    const containerDepart = document.getElementById('uploadContainerDepart');
    const containerReturn = document.getElementById('uploadContainerReturn');

    const inactiveClass = "flex-1 py-3 text-[10px] font-bold uppercase rounded-lg transition-all text-gray-400 hover:text-white";
    const activeClass = "flex-1 py-3 text-[10px] font-bold uppercase rounded-lg transition-all bg-davka-orange text-white shadow-[0_4px_10px_rgba(255,84,0,0.3)]";

    if (tabName === 'depart') {
        btnDepart.className = activeClass;
        btnReturn.className = inactiveClass;
        containerDepart.classList.remove('hidden');
        containerReturn.classList.add('hidden');
    } else {
        btnDepart.className = inactiveClass;
        btnReturn.className = activeClass;
        containerDepart.classList.add('hidden');
        containerReturn.classList.remove('hidden');
    }
}
// --- MULTI-STEP WIZARD LOGIC ---
window.nextStep = function(step) {
    const stepElement = document.getElementById(`step-${step}`);
    const inputs = stepElement.querySelectorAll('input[required], select[required], textarea[required]');
    
    let isValid = true;
    inputs.forEach(input => {
        if (!input.checkValidity()) {
            input.reportValidity();
            isValid = false;
        }
    });

    if (!isValid) return;

    stepElement.classList.remove('fade-in');
    stepElement.classList.add('hidden');
    
    currentStep = step + 1;
    const nextStepElement = document.getElementById(`step-${currentStep}`);
    nextStepElement.classList.remove('hidden');
    nextStepElement.classList.add('fade-in');
    
    updateWizardProgress();
    window.scrollTo({ top: 0, behavior: 'smooth' });
};

window.prevStep = function(step) {
    const stepElement = document.getElementById(`step-${step}`);
    
    stepElement.classList.remove('fade-in');
    stepElement.classList.add('hidden');
    
    currentStep = step - 1;
    const prevStepElement = document.getElementById(`step-${currentStep}`);
    prevStepElement.classList.remove('hidden');
    prevStepElement.classList.add('fade-in');
    
    updateWizardProgress();
    window.scrollTo({ top: 0, behavior: 'smooth' });
};

function updateWizardProgress() {
    const progressPercentage = ((currentStep - 1) / (totalSteps - 1)) * 100;
    const wizardBar = document.getElementById('wizard-bar');
    if (wizardBar) wizardBar.style.width = `${progressPercentage}%`;
    
    const icons = ['fa-address-book', 'fa-train', 'fa-users', 'fa-file-upload', 'fa-wallet'];
    
    for (let i = 1; i <= totalSteps; i++) {
        const indicator = document.getElementById(`indicator-${i}`);
        if (!indicator) continue;
        
        if (i < currentStep) {
            indicator.className = 'step-indicator completed';
            indicator.innerHTML = `<i class="fas ${icons[i-1]}"></i>`;
        } else if (i === currentStep) {
            indicator.className = 'step-indicator active';
            indicator.innerHTML = `<i class="fas ${icons[i-1]}"></i>`;
        } else {
            indicator.className = 'step-indicator';
            indicator.innerHTML = `<i class="fas ${icons[i-1]}"></i>`;
        }
    }
}

// --- UX ENGINE: SMOOTH SCROLL & ENTER KEY NAVIGATION ---
function enableSmoothInputUX() {
    const formElements = document.querySelectorAll('input, select, textarea');
    
    formElements.forEach((el, index) => {
        el.removeEventListener('focus', handleInputFocus);
        el.removeEventListener('keydown', handleInputEnter);

        el.addEventListener('focus', handleInputFocus);
        el.addEventListener('keydown', (e) => handleInputEnter(e, index, formElements));
    });
}
function handleInputFocus(e) {
    setTimeout(() => {
        e.target.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
    }, 300);
}
function handleInputEnter(e, currentIndex, allElements) {
    if (e.key === 'Enter') {
        e.preventDefault(); 
        let nextIndex = currentIndex + 1;
        while (nextIndex < allElements.length) {
            const nextEl = allElements[nextIndex];
            if (nextEl.offsetParent !== null && !nextEl.disabled && !nextEl.readOnly) {
                nextEl.focus(); 
                return;
            }
            nextIndex++;
        }
        if (nextIndex >= allElements.length) e.target.blur();
    }
}
// --- TAB PENUMPANG SAMA / BEDA ---
window.togglePaxSame = function() {
    const isSame = document.getElementById('inpPaxSame').checked;
    const returnWrapper = document.getElementById('passengerFormsReturnWrapper');
    if (isSame) {
        returnWrapper.classList.add('hidden');
    } else {
        returnWrapper.classList.remove('hidden');
        
        const adultCount = parseInt(document.getElementById('inpPaxCount').value) || 1;
        const infantCount = parseInt(document.getElementById('inpInfantCount').value) || 0;
        if(document.getElementById('inpReturnPaxCount') && document.getElementById('inpReturnPaxCount').value === '1') {
            document.getElementById('inpReturnPaxCount').value = adultCount;
        }
        if(document.getElementById('inpReturnInfantCount') && document.getElementById('inpReturnInfantCount').value === '0') {
            document.getElementById('inpReturnInfantCount').value = infantCount;
        }
    }
    updatePassengerForms();
}
window.updatePassengerForms = function() {
    const adultCount = parseInt(document.getElementById('inpPaxCount').value) || 1;
    const infantCount = parseInt(document.getElementById('inpInfantCount').value) || 0;
    
    const returnAdultCount = document.getElementById('inpReturnPaxCount') ? (parseInt(document.getElementById('inpReturnPaxCount').value) || 1) : 1;
    const returnInfantCount = document.getElementById('inpReturnInfantCount') ? (parseInt(document.getElementById('inpReturnInfantCount').value) || 0) : 0;
    
    const containerDepart = document.getElementById('passengerFormsDepart');
    const containerReturn = document.getElementById('passengerFormsReturn'); 
    
    const isPP = document.getElementById('inpTripType').value === 'round_trip';
    const isSame = document.getElementById('inpPaxSame').checked;

    const extractStored = (containerId) => {
        let storedAdults = [];
        let storedInfants = [];
        document.querySelectorAll(`#${containerId} .passenger-item`).forEach(el => {
            const type = el.getAttribute('data-type');
            const name = el.querySelector('.pax-name').value;
            const nik = el.querySelector('.pax-nik').value;
            const dobInput = el.querySelector('.pax-dob');
            const dob = dobInput ? dobInput.value : '';
            if(type === 'infant') storedInfants.push({name, nik, dob});
            else storedAdults.push({name, nik, dob});
        });
        return { storedAdults, storedInfants };
    };

    const buildHtml = (storedAdults, storedInfants, directionStr) => {
        let html = '';
        const themeColorClass = directionStr === 'depart' ? 'davka-orange' : 'blue-500';
        const bgThemeClass = directionStr === 'depart' ? 'bg-white/5' : 'bg-blue-500/5';
        const borderThemeClass = directionStr === 'depart' ? 'border-white/10 hover:border-davka-orange/50' : 'border-blue-500/30 hover:border-blue-500/50';

        const currentAdultCount = directionStr === 'depart' ? adultCount : returnAdultCount;
        const currentInfantCount = directionStr === 'depart' ? infantCount : returnInfantCount;

        for(let i = 1; i <= currentAdultCount; i++) {
            const valName = storedAdults[i-1] ? storedAdults[i-1].name : '';
            const valNik = storedAdults[i-1] ? storedAdults[i-1].nik : '';
            const valDob = storedAdults[i-1] ? storedAdults[i-1].dob : ''; 
            
            html += `
            <div class="passenger-item border ${borderThemeClass} rounded-xl p-3 ${bgThemeClass} relative group transition-colors shadow-inner" data-type="adult" data-direction="${directionStr}">
                <div class="absolute -left-1 top-3 w-1 h-6 bg-${themeColorClass} rounded-r shadow-[0_0_10px_currentColor]"></div>
                <p class="text-[10px] font-bold text-${themeColorClass} mb-2 uppercase tracking-wider pl-2">
                    <i class="fas fa-user mr-1"></i> Dewasa ${i} ${directionStr === 'return' ? '(Pulang)' : ''}
                </p>
                <div class="space-y-2 pl-2">
                    <input type="text" value="${valName}" class="pax-name w-full bg-davka-bg border border-davka-border rounded-lg p-2 text-sm text-white focus:border-${themeColorClass} focus:outline-none placeholder-gray-600" placeholder="Nama Lengkap (Sesuai KTP)" autocapitalize="characters">
                    <div class="grid grid-cols-2 gap-2">
                        <input type="number" value="${valNik}" class="pax-nik w-full bg-davka-bg border border-davka-border rounded-lg p-2 text-sm text-white focus:border-${themeColorClass} focus:outline-none placeholder-gray-600" placeholder="NIK / Paspor">
                        <input type="text" onfocus="(this.type='date')" onblur="(this.type='text')" value="${valDob}" class="pax-dob w-full bg-davka-bg border border-davka-border rounded-lg p-2 text-sm text-white focus:border-${themeColorClass} focus:outline-none placeholder-gray-600" placeholder="Tanggal Lahir">
                    </div>
                </div>
            </div>`;
        }

        for(let i = 1; i <= currentInfantCount; i++) {
            const valName = storedInfants[i-1] ? storedInfants[i-1].name : '';
            const valNik = storedInfants[i-1] ? storedInfants[i-1].nik : '';
            const valDob = storedInfants[i-1] ? storedInfants[i-1].dob : ''; 
            
            html += `
            <div class="passenger-item border border-pink-500/30 rounded-xl p-3 bg-pink-500/5 relative group hover:border-pink-500 transition-colors shadow-inner" data-type="infant" data-direction="${directionStr}">
                <div class="absolute -left-1 top-3 w-1 h-6 bg-pink-500 rounded-r shadow-[0_0_10px_currentColor]"></div>
                <p class="text-[10px] font-bold text-pink-400 mb-2 uppercase tracking-wider pl-2">
                    <i class="fas fa-baby mr-1"></i> Bayi ${i} ${directionStr === 'return' ? '(Pulang)' : ''}
                </p>
                <div class="space-y-2 pl-2">
                    <input type="text" value="${valName}" class="pax-name w-full bg-davka-bg border border-davka-border rounded-lg p-2 text-sm text-white focus:border-pink-500 focus:outline-none placeholder-gray-600" placeholder="Nama Bayi" autocapitalize="characters">
                    <div class="grid grid-cols-2 gap-2">
                        <input type="number" value="${valNik}" class="pax-nik w-full bg-davka-bg border border-davka-border rounded-lg p-2 text-sm text-white focus:border-pink-500 focus:outline-none placeholder-gray-600" placeholder="NIK / KIA">
                        <input type="text" onfocus="(this.type='date')" onblur="(this.type='text')" value="${valDob}" class="pax-dob w-full bg-davka-bg border border-davka-border rounded-lg p-2 text-sm text-white focus:border-pink-500 focus:outline-none placeholder-gray-600" placeholder="Tanggal Lahir">
                    </div>
                </div>
            </div>`;
        }
        return html;
    };

    const departData = extractStored('passengerFormsDepart');
    containerDepart.innerHTML = buildHtml(departData.storedAdults, departData.storedInfants, 'depart');

    if(isPP && !isSame) {
        const returnData = extractStored('passengerFormsReturn');
        containerReturn.innerHTML = buildHtml(returnData.storedAdults, returnData.storedInfants, 'return');
    } else {
        containerReturn.innerHTML = '';
    }

    calcTotalFromPax();
    setTimeout(enableSmoothInputUX, 100);
}

window.getPassengersFromForm = function() {
    let paxList = [];
    const isPP = document.getElementById('inpTripType').value === 'round_trip';
    const isSame = document.getElementById('inpPaxSame').checked;
    
    const extract = (el, direction) => {
        const nameInput = el.querySelector('.pax-name');
        const nikInput = el.querySelector('.pax-nik');
        const dobInput = el.querySelector('.pax-dob'); 
        const type = el.getAttribute('data-type'); 
        
        return {
            name: nameInput.value.toUpperCase() || (type === 'infant' ? 'BAYI' : 'PENUMPANG'),
            nik: nikInput.value || '-',
            dob: dobInput ? dobInput.value : '', 
            type: type,
            direction: direction
        };
    };

    const departItems = document.querySelectorAll('#passengerFormsDepart .passenger-item');
    departItems.forEach(el => paxList.push(extract(el, 'depart')));
    
    if (isPP) {
        if (isSame) {
            departItems.forEach(el => paxList.push(extract(el, 'return')));
        } else {
            const returnItems = document.querySelectorAll('#passengerFormsReturn .passenger-item');
            returnItems.forEach(el => paxList.push(extract(el, 'return')));
        }
    }
    
    return paxList;
}
window.calcTotalFromPax = function() {
    const adultCount = parseInt(document.getElementById('inpPaxCount').value) || 1;
    
    const isSame = document.getElementById('inpPaxSame').checked;
    const returnAdultCount = isSame ? adultCount : (document.getElementById('inpReturnPaxCount') ? (parseInt(document.getElementById('inpReturnPaxCount').value) || 1) : adultCount);

    const pricePerPax = parseFloat(document.getElementById('inpPricePerPax').value) || 0;
    if (pricePerPax > 0) document.getElementById('inpPrice').value = pricePerPax * adultCount;

    const returnPricePerPax = parseFloat(document.getElementById('inpReturnPricePerPax').value) || 0;
    if (returnPricePerPax > 0) document.getElementById('inpReturnPrice').value = returnPricePerPax * returnAdultCount;

    calcRemaining(); 
}
window.calcRemaining = function() {
    const priceDepart = parseFloat(document.getElementById('inpPrice').value) || 0;
    const dpDepart = parseFloat(document.getElementById('inpFeeDepart').value) || 0;
    const remainingDepart = priceDepart - dpDepart;

    const fieldDepart = document.getElementById('inpRemainingDepart');
    fieldDepart.value = formatRupiah(remainingDepart);
    fieldDepart.className = remainingDepart <= 0 
        ? "bg-transparent text-right text-green-500 font-black text-lg outline-none w-40 cursor-default" 
        : "bg-transparent text-right text-red-500 font-black text-lg outline-none w-40 cursor-default";

    const priceReturn = parseFloat(document.getElementById('inpReturnPrice').value) || 0;
    const dpReturn = parseFloat(document.getElementById('inpFeeReturn').value) || 0;
    const remainingReturn = priceReturn - dpReturn;

    const fieldReturn = document.getElementById('inpRemainingReturn');
    if(fieldReturn) {
        fieldReturn.value = formatRupiah(remainingReturn);
        fieldReturn.className = remainingReturn <= 0 
            ? "bg-transparent text-right text-green-500 font-black text-lg outline-none w-40 cursor-default" 
            : "bg-transparent text-right text-red-500 font-black text-lg outline-none w-40 cursor-default";
    }
}

async function fetchOrders() {
    const { data, error } = await supabase
        .from('orders')
        .select('*')
        .order('created_at', { ascending: true }) 
        .limit(50); 

    if (error) {
        console.error("Error fetching:", error);
        return;
    }
    orders = data || [];
    renderStats();
    
    // REVISI: Panggilan tanpa fitur search
    if (!document.getElementById('page-list').classList.contains('hidden')) {
         renderOrderList();
    }
}

function setupRealtime() {
    supabase.channel('public:orders')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, (payload) => {
            fetchOrdersBg(); 
        }).subscribe();
}

async function fetchOrdersBg() {
    const { data } = await supabase.from('orders').select('*').order('created_at', { ascending: true }).limit(50);
    if(data) {
        orders = data;
        renderStats();
        // REVISI: Render otomatis tanpa filter search
        renderOrderList();
        
        if(currentDetailOrder && !document.getElementById('page-detail').classList.contains('hidden')) {
            const updatedOrder = orders.find(o => o.id === currentDetailOrder.id);
            if(updatedOrder) openDetailView(updatedOrder.id, true);
        }
    }
}

async function uploadToSupabaseStorage(base64Data, fileName) {
    if (!base64Data || base64Data.startsWith('http')) return base64Data; 
    try {
        const res = await fetch(base64Data);
        const blob = await res.blob();
        const cleanFileName = fileName.replace(/[^a-zA-Z0-9]/g, '_'); 
        const filePath = `uploads/${cleanFileName}.jpg`;

        const { data, error } = await supabase.storage.from('davka-files').upload(filePath, blob, { contentType: 'image/jpeg', upsert: true });
        if (error) throw error;
        const { data: publicData } = supabase.storage.from('davka-files').getPublicUrl(filePath);
        return publicData.publicUrl;
    } catch (err) {
        console.error("Upload Error:", err);
        return null; 
    }
}
const orderForm = document.getElementById('orderForm');

orderForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    toggleLoader(true); 
    
    const editIndex = parseInt(document.getElementById('editIndex').value);
    const existingOrder = editIndex !== -1 ? orders[editIndex] : null;
    
    const orderId = existingOrder ? existingOrder.id : Date.now();
    const created_at = existingOrder ? existingOrder.created_at : new Date().toISOString();

    let transferBase64 = document.getElementById('inpTransferData').value;
    let chatBase64 = document.getElementById('inpChatData').value;
    let transferReturnBase64 = document.getElementById('inpTransferDataReturn').value;
    let chatReturnBase64 = document.getElementById('inpChatDataReturn').value;

    try {
        let transferUrl = existingOrder ? existingOrder.transferScreenshot : null;
        let chatUrl = existingOrder ? existingOrder.chatScreenshot : null;
        let transferReturnUrl = existingOrder ? existingOrder.transferScreenshotReturn : null;
        let chatReturnUrl = existingOrder ? existingOrder.chatScreenshotReturn : null;

        if (transferBase64 && !transferBase64.startsWith('http')) {
            showToast("Upload Transfer Pergi...");
            transferUrl = await uploadToSupabaseStorage(transferBase64, `${orderId}_tf_depart`);
        }
        if (chatBase64 && !chatBase64.startsWith('http')) {
            showToast("Upload Chat Pergi...");
            chatUrl = await uploadToSupabaseStorage(chatBase64, `${orderId}_chat_depart`);
        }
        if (transferReturnBase64 && !transferReturnBase64.startsWith('http')) {
            showToast("Upload Transfer Pulang...");
            transferReturnUrl = await uploadToSupabaseStorage(transferReturnBase64, `${orderId}_tf_return`);
        }
        if (chatReturnBase64 && !chatReturnBase64.startsWith('http')) {
            showToast("Upload Chat Pulang...");
            chatReturnUrl = await uploadToSupabaseStorage(chatReturnBase64, `${orderId}_chat_return`);
        }

        const passengerData = getPassengersFromForm();
        const tripType = document.getElementById('inpTripType').value;
        const getValidDate = (val) => val ? val : null;

        const newOrder = {
            id: orderId, 
            created_at: created_at,
            contactName: document.getElementById('inpContactName').value.toUpperCase(),
            contactPhone: document.getElementById('inpContactPhone').value,
            address: document.getElementById('inpAddress').value.toUpperCase(),
            passengers: passengerData, 
            origin: document.getElementById('inpOrigin').value.toUpperCase(),
            dest: document.getElementById('inpDest').value.toUpperCase(),
            
            date: getValidDate(document.getElementById('inpDate').value),
            warDate: getValidDate(document.getElementById('inpWarDate').value),
            
            train: document.getElementById('inpTrain').value.toUpperCase(),
            tripType: tripType,
            
            returnOrigin: document.getElementById('inpReturnOrigin').value.toUpperCase(),
            returnDest: document.getElementById('inpReturnDest').value.toUpperCase(),
            
            returnDate: getValidDate(document.getElementById('inpReturnDate').value),
            returnWarDate: getValidDate(document.getElementById('inpReturnWarDate').value),
            
            returnTrain: document.getElementById('inpReturnTrain').value.toUpperCase(),
            
            paymentMethod: document.getElementById('inpPaymentMethod').value,
            paymentMethodReturn: document.getElementById('inpPaymentMethodReturn').value, 
            
            price: parseFloat(document.getElementById('inpPrice').value) || 0,
            feeDepart: parseFloat(document.getElementById('inpFeeDepart').value) || 0,
            
            returnPrice: parseFloat(document.getElementById('inpReturnPrice').value) || 0,
            feeReturn: parseFloat(document.getElementById('inpFeeReturn').value) || 0,
            fee: (parseFloat(document.getElementById('inpFeeDepart').value) || 0) + (parseFloat(document.getElementById('inpFeeReturn').value) || 0),
            
            settlementMethod: existingOrder ? (existingOrder.settlementMethod || '-') : '-',
            transferScreenshot: transferUrl, 
            chatScreenshot: chatUrl,
            transferScreenshotReturn: transferReturnUrl,
            chatScreenshotReturn: chatReturnUrl,
            settlementProof: existingOrder ? existingOrder.settlementProof : null,
            kaiTicketFile: existingOrder ? existingOrder.kaiTicketFile : null,
            kaiTicketFileReturn: existingOrder ? existingOrder.kaiTicketFileReturn : null,
            status: existingOrder ? existingOrder.status : 'pending'
        };

        const { error } = existingOrder 
            ? await supabase.from('orders').update(newOrder).eq('id', orderId)
            : await supabase.from('orders').insert([newOrder]);

        if(error) throw error;
        existingOrder ? (orders[editIndex] = newOrder) : orders.push(newOrder); 
        
        renderStats();
        // REVISI: Render order list tanpa fitur pencarian
        renderOrderList(); 
        showToast("Data Tersimpan!");
        resetForm();
        navTo('list'); 
    } catch (err) {
        console.error("Save Failed:", err);
        alert(`Gagal simpan: ${err.message || "Cek koneksi internet"}`);
    } finally { toggleLoader(false); }
});

window.deleteOrder = async function(id) {
    if(confirm("Hapus pesanan ini Permanen?")) {
        toggleLoader(true);
        orders = orders.filter(o => o.id !== id);
        
        if(!document.getElementById('page-detail').classList.contains('hidden')) closeDetailView();
        // REVISI: Render otomatis tanpa filter search
        renderOrderList();
        renderStats();
        showToast("Dihapus dari layar...");

        try {
            await supabase.from('orders').delete().eq('id', id);
            showToast("Terhapus dari server.");
        } catch (err) { alert("Gagal hapus server."); } 
        finally { toggleLoader(false); }
    }
}
window.toggleStatus = async function(id) {
    const index = orders.findIndex(o => o.id === id);
    if(index === -1) return;

    const current = orders[index].status;
    const next = current === 'pending' ? 'success' : (current === 'success' ? 'cancel' : 'pending');
    orders[index].status = next;
    
    // REVISI: Render otomatis tanpa filter search
    renderOrderList();
    if(!document.getElementById('page-detail').classList.contains('hidden')) openDetailView(id, true);
    renderStats();

    try { await supabase.from('orders').update({ status: next }).eq('id', id); } 
    catch(e) { console.error(e); }
}

// REVISI: MODIFIKASI FUNGSI navTo UNTUK MENDUKUNG HISTORY API & RESET WIZARD
window.navTo = function(pageId, fromPopState = false) {
    const currentPages = document.querySelectorAll('main > section:not(.hidden)');
    currentPages.forEach(page => { page.classList.add('fade-out'); page.classList.remove('fade-in'); });

    setTimeout(() => {
        document.querySelectorAll('main > section').forEach(el => { el.classList.add('hidden'); el.classList.remove('fade-out'); });
        const target = document.getElementById(`page-${pageId}`);
        if(target) { target.classList.remove('hidden'); target.classList.add('fade-in'); }

        document.querySelectorAll('nav button').forEach(el => el.classList.remove('active-nav'));
        if(pageId === 'dashboard') {
            const btn = document.getElementById('nav-dashboard');
            if(btn) btn.classList.add('active-nav');
        }
        if(pageId === 'list') {
            const btn = document.getElementById('nav-list');
            if(btn) btn.classList.add('active-nav');
            // REVISI: Panggilan tanpa input search
            renderOrderList(); 
        }
        if(pageId === 'input') {
            const btn = document.getElementById('nav-input');
            if(btn) btn.classList.add('active-nav');
            if(document.getElementById('editIndex').value === "-1") resetForm();
            
            // Force reset wizard to step 1 whenever entering input page
            currentStep = 1;
            document.querySelectorAll('.form-step').forEach(el => {
                el.classList.add('hidden');
                el.classList.remove('fade-in');
            });
            const firstStep = document.getElementById('step-1');
            if (firstStep) {
                firstStep.classList.remove('hidden');
                firstStep.classList.add('fade-in');
            }
            if (typeof updateWizardProgress === 'function') updateWizardProgress();
        }
        
        if (!fromPopState) {
            window.history.pushState({ view: pageId }, '', `#${pageId}`);
        }

        window.scrollTo({ top: 0, behavior: 'smooth' });
    }, 400); 
}
window.editOrder = function(id) {
    const index = orders.findIndex(o => o.id === id);
    if (index === -1) return;
    const data = orders[index];
    
    document.getElementById('editIndex').value = index;
    document.getElementById('inpContactName').value = data.contactName || data.name || '';
    document.getElementById('inpContactPhone').value = data.contactPhone || data.phone || '';
    document.getElementById('inpAddress').value = data.address || '';
    
    let paxList = Array.isArray(data.passengers) ? data.passengers : (data.name ? [{name: data.name, nik: data.nik || '-', dob: '', type: 'adult'}] : []);
    
    let departPax = paxList.filter(p => !p.direction || p.direction === 'depart');
    let returnPax = paxList.filter(p => p.direction === 'return');
    
    const isPP = data.tripType === 'round_trip';
    let isSame = true;
    
    if(isPP && returnPax.length > 0) {
        if(departPax.length !== returnPax.length) { isSame = false; }
        else {
            for(let i=0; i<departPax.length; i++) {
                if(departPax[i].name !== returnPax[i].name || departPax[i].nik !== returnPax[i].nik) {
                    isSame = false; break;
                }
            }
        }
    }
    document.getElementById('inpPaxSame').checked = isSame;

    const adults = departPax.filter(p => !p.type || p.type === 'adult'); 
    const infants = departPax.filter(p => p.type === 'infant');

    document.getElementById('inpPaxCount').value = adults.length || 1;
    document.getElementById('inpInfantCount').value = infants.length || 0;
    
    const retAdults = returnPax.filter(p => !p.type || p.type === 'adult');
    const retInfants = returnPax.filter(p => p.type === 'infant');
    
    if(document.getElementById('inpReturnPaxCount')) {
        document.getElementById('inpReturnPaxCount').value = retAdults.length || 1;
    }
    if(document.getElementById('inpReturnInfantCount')) {
        document.getElementById('inpReturnInfantCount').value = retInfants.length || 0;
    }
    
    document.getElementById('inpTripType').value = data.tripType || 'one_way';
    toggleTripType();
    
    setTimeout(() => {
        const populateContainer = (containerId, sourceArr, isAdult) => {
            let idx = 0;
            document.querySelectorAll(`#${containerId} .passenger-item[data-type="${isAdult ? 'adult' : 'infant'}"]`).forEach(el => {
                if(sourceArr[idx]) {
                    el.querySelector('.pax-name').value = sourceArr[idx].name;
                    el.querySelector('.pax-nik').value = sourceArr[idx].nik;
                    if(el.querySelector('.pax-dob')) el.querySelector('.pax-dob').value = sourceArr[idx].dob || '';
                    idx++;
                }
            });
        };

        populateContainer('passengerFormsDepart', adults, true);
        populateContainer('passengerFormsDepart', infants, false);

        if(!isSame && isPP) {
            populateContainer('passengerFormsReturn', retAdults, true);
            populateContainer('passengerFormsReturn', retInfants, false);
        }
    }, 50);

    document.getElementById('inpOrigin').value = data.origin || '';
    document.getElementById('inpDest').value = data.dest || '';
    document.getElementById('inpDate').value = data.date || '';
    document.getElementById('inpWarDate').value = data.warDate || ''; 
    document.getElementById('inpTrain').value = data.train || '';
    
    if(isPP) {
        document.getElementById('inpReturnOrigin').value = data.returnOrigin || '';
        document.getElementById('inpReturnDest').value = data.returnDest || '';
        document.getElementById('inpReturnDate').value = data.returnDate || '';
        document.getElementById('inpReturnWarDate').value = data.returnWarDate || '';
        document.getElementById('inpReturnTrain').value = data.returnTrain || '';
    }
    
    document.getElementById('inpPaymentMethod').value = data.paymentMethod || 'Tunai';
    document.getElementById('inpPaymentMethodReturn').value = data.paymentMethodReturn || 'Tunai';
    
    const adultCount = adults.length || 1;
    const retAdultCount = retAdults.length > 0 ? retAdults.length : adultCount;
    
    const priceDepart = data.price || 0;
    document.getElementById('inpPrice').value = priceDepart;
    document.getElementById('inpPricePerPax').value = priceDepart > 0 ? Math.round(priceDepart / adultCount) : 0;
    document.getElementById('inpFeeDepart').value = (data.feeDepart !== undefined) ? data.feeDepart : (data.fee || 0);
    
    const priceReturn = data.returnPrice || 0;
    document.getElementById('inpReturnPrice').value = priceReturn;
    document.getElementById('inpReturnPricePerPax').value = priceReturn > 0 ? Math.round(priceReturn / retAdultCount) : 0;
    document.getElementById('inpFeeReturn').value = data.feeReturn || 0;

    calcRemaining();

    const setPreview = (url, inpDataId, imgId, previewId) => {
        if(url) {
            document.getElementById(inpDataId).value = url;
            document.getElementById(imgId).src = url;
            document.getElementById(previewId).classList.remove('hidden');
        }
    };
    
    setPreview(data.transferScreenshot, 'inpTransferData', 'imgTransfer', 'previewTransfer');
    setPreview(data.chatScreenshot, 'inpChatData', 'imgChat', 'previewChat');
    setPreview(data.transferScreenshotReturn, 'inpTransferDataReturn', 'imgTransferReturn', 'previewTransferReturn');
    setPreview(data.chatScreenshotReturn, 'inpChatDataReturn', 'imgChatReturn', 'previewChatReturn');

    document.getElementById('btnSaveText').innerText = "UPDATE DATA";
    navTo('input');
}
window.updateSettlement = async function(id, newVal) {
    toggleLoader(true);
    const index = orders.findIndex(o => o.id === id);
    if(index !== -1) {
        const nextStatus = newVal === '-' ? 'pending' : 'success';
        orders[index].settlementMethod = newVal;
        orders[index].status = nextStatus;
        
        // REVISI: Render order list tanpa pencarian
        renderOrderList();
        if(!document.getElementById('page-detail').classList.contains('hidden')) openDetailView(id, true); 

        renderStats(); 
        try {
             await supabase.from('orders').update({ settlementMethod: newVal, status: nextStatus }).eq('id', id);
            showToast("Info Pelunasan Updated");
        } catch(e) { console.error(e); } finally { toggleLoader(false); }
    } else toggleLoader(false);
}

// --- FEATURE: SMART NOTIFICATION WAR TIKET H-45 CALCULATOR ---
function updateWarTicketReminder() {
    const todayEl = document.getElementById('notif-today-date');
    const todayTargetEl = document.getElementById('notif-today-target');
    const tomorrowDateEl = document.getElementById('notif-tomorrow-date');
    const tomorrowTargetEl = document.getElementById('notif-tomorrow-target');

    if (!todayEl || !todayTargetEl || !tomorrowDateEl || !tomorrowTargetEl) return;

    // Tanggal hari ini (mengikuti waktu sistem real-time)
    const today = new Date();
    
    // Tanggal besok
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);

    // Target keberangkatan untuk hari ini (Hari ini + 45 Hari)
    const targetToday = new Date(today);
    targetToday.setDate(today.getDate() + 45);

    // Target keberangkatan untuk besok (Besok + 45 Hari)
    const targetTomorrow = new Date(tomorrow);
    targetTomorrow.setDate(tomorrow.getDate() + 45);

    const options = { day: 'numeric', month: 'short', year: 'numeric' };

    todayEl.innerText = today.toLocaleDateString('id-ID', options).toUpperCase();
    todayTargetEl.innerText = targetToday.toLocaleDateString('id-ID', options).toUpperCase();

    tomorrowDateEl.innerText = tomorrow.toLocaleDateString('id-ID', options).toUpperCase();
    tomorrowTargetEl.innerText = targetTomorrow.toLocaleDateString('id-ID', options).toUpperCase();
}

// --- HELPER LAINNYA ---
function toggleLoader(show) {
    const loader = document.getElementById('global-loader');
    if (loaderTimeout) { clearTimeout(loaderTimeout); loaderTimeout = null; }
    if (show) {
        loader.classList.remove('hidden');
        loaderTimeout = setTimeout(() => { if (!loader.classList.contains('hidden')) toggleLoader(false); }, 15000); 
    } else loader.classList.add('hidden');
}

window.handleUploadZoneClick = function(zoneId, inputId) {
    const zone = document.getElementById(zoneId);
    const hint = document.getElementById(zoneId.replace('zone', 'hint')); 
    const input = document.getElementById(inputId);
    if (activeUploadZone === zoneId) {
        input.click(); setTimeout(resetUploadZones, 500);
    } else {
        resetUploadZones(); 
        activeUploadZone = zoneId;
        zone.classList.add('upload-zone-active');
        if(hint) hint.classList.remove('hidden');
        setTimeout(() => { zone.scrollIntoView({ behavior: "smooth", block: "start", inline: "nearest" }); }, 300);
    }
}

function resetUploadZones() {
    activeUploadZone = null;
    document.querySelectorAll('.upload-zone-base').forEach(el => el.classList.remove('upload-zone-active'));
    ['hintTransfer', 'hintChat', 'hintTransferReturn', 'hintChatReturn'].forEach(id => {
        const h = document.getElementById(id); if(h) h.classList.add('hidden');
    });
}

function setupImageUploader(inputId, hiddenDataId, imgId, containerId) {
    const fileInput = document.getElementById(inputId);
    if(!fileInput) return;
    
    fileInput.addEventListener('change', function(e) {
        toggleLoader(true);
        processFile(e.target.files[0], (dataUrl) => {
            document.getElementById(hiddenDataId).value = dataUrl;
            document.getElementById(imgId).src = dataUrl;
            document.getElementById(containerId).classList.remove('hidden');
            resetUploadZones();
            toggleLoader(false);
        });
    });
}

function processFile(file, callback) {
    if (!file) { toggleLoader(false); return; }
    const reader = new FileReader();
    reader.onload = function(event) {
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.onload = function() {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            const MAX_WIDTH = 600; 
            let width = img.width; let height = img.height;
            if (width > MAX_WIDTH) { height *= MAX_WIDTH / width; width = MAX_WIDTH; }
            canvas.width = width; canvas.height = height;
            ctx.drawImage(img, 0, 0, width, height);
            callback(canvas.toDataURL('image/jpeg', 0.6)); 
        }
        img.src = event.target.result;
    }
    reader.readAsDataURL(file);
}

function setupHistoryUploader() {
    const historyInput = document.getElementById('inpHistoryUpload');
    historyInput.addEventListener('change', function(e) {
        if (!currentUploadOrderId || !currentUploadType) return;
        const file = e.target.files[0];
        if (!file) return;
        showToast("Upload gambar...");
        toggleLoader(true);
        processFile(file, async (base64Data) => {
            try {
                const fileName = `${currentUploadOrderId}_${currentUploadType}_${Date.now()}`;
                const publicUrl = await uploadToSupabaseStorage(base64Data, fileName);
                const updateData = {};
                
                if (currentUploadType === 'settlement') updateData.settlementProof = publicUrl;
                else if (currentUploadType === 'kai_ticket_depart') updateData.kaiTicketFile = publicUrl;
                else if (currentUploadType === 'kai_ticket_return') updateData.kaiTicketFileReturn = publicUrl;

                await supabase.from('orders').update(updateData).eq('id', currentUploadOrderId);
                
                const idx = orders.findIndex(o => o.id === currentUploadOrderId);
                if(idx !== -1) {
                     if (currentUploadType === 'settlement') orders[idx].settlementProof = publicUrl;
                     else if (currentUploadType === 'kai_ticket_depart') orders[idx].kaiTicketFile = publicUrl;
                     else if (currentUploadType === 'kai_ticket_return') orders[idx].kaiTicketFileReturn = publicUrl;
                     
                     if(!document.getElementById('page-detail').classList.contains('hidden')) openDetailView(currentUploadOrderId, true);
                }
                showToast("Tersimpan!");
            } catch(e) { console.error(e); alert("Gagal simpan."); } 
            finally {
                currentUploadOrderId = null; currentUploadType = null;
                historyInput.value = ''; toggleLoader(false);
            }
        });
    });
}
window.toggleTripType = function() {
    const type = document.getElementById('inpTripType').value;
    const fields = document.getElementById('returnTripFields');
    const uploadTabContainer = document.getElementById('uploadTabContainer');
    const payReturnSection = document.getElementById('paymentReturnSection'); 
    const togglePax = document.getElementById('togglePaxReturnContainer');
    
    const inpRetDate = document.getElementById('inpReturnDate');
    const inpRetTrain = document.getElementById('inpReturnTrain');
    const inpRetOrg = document.getElementById('inpReturnOrigin');
    const inpRetDest = document.getElementById('inpReturnDest');

    if(type === 'round_trip') {
        fields.classList.remove('hidden'); fields.classList.add('fade-in');
        uploadTabContainer.classList.remove('hidden');
        payReturnSection.classList.remove('hidden'); 
        togglePax.classList.remove('hidden');
        
        inpRetDate.required = true;
        inpRetTrain.required = true;
        if(inpRetOrg) inpRetOrg.required = true;
        if(inpRetDest) inpRetDest.required = true;
        
        document.getElementById('lblUploadDepart').classList.remove('hidden');
        document.getElementById('labelTransfer').innerText = "Bukti Transfer (Pergi)";
        document.getElementById('labelChat').innerText = "Chat WA (Pergi)";
    } else {
        fields.classList.add('hidden'); fields.classList.remove('fade-in');
        uploadTabContainer.classList.add('hidden'); 
        payReturnSection.classList.add('hidden'); 
        togglePax.classList.add('hidden');
        
        switchUploadTab('depart');
        document.getElementById('inpPaxSame').checked = true;
        togglePaxSame();
        
        inpRetDate.required = false;
        inpRetTrain.required = false;
        if(inpRetOrg) inpRetOrg.required = false;
        if(inpRetDest) inpRetDest.required = false;

        document.getElementById('inpReturnPricePerPax').value = '';
        document.getElementById('inpReturnPrice').value = '';
        document.getElementById('inpFeeReturn').value = ''; 
        
        calcRemaining();

        document.getElementById('lblUploadDepart').classList.add('hidden');
        document.getElementById('labelTransfer').innerText = "Bukti Transfer";
        document.getElementById('labelChat').innerText = "Chat WA";
    }
    setTimeout(enableSmoothInputUX, 200);
}

window.calcH45 = function() {
    const dateVal = document.getElementById('inpDate').value;
    if(dateVal) {
        const d = new Date(dateVal); d.setDate(d.getDate() - 45);
        document.getElementById('inpWarDate').value = d.toISOString().split('T')[0];
    }
}
window.calcReturnH45 = function() {
    const dateVal = document.getElementById('inpReturnDate').value;
    if(dateVal) {
        const d = new Date(dateVal); d.setDate(d.getDate() - 45);
        document.getElementById('inpReturnWarDate').value = d.toISOString().split('T')[0];
    }
}
window.printReceipt = function(orderId) {
    const order = orders.find(o => o.id === orderId);
    if (!order) return;
    toggleLoader(true);
    renderReceiptToDOM(order);
    showToast("RENDER E-TIKET...");
    setTimeout(() => { captureAndShowModal('receipt-render-area'); }, 800);
}

function renderReceiptToDOM(order) {
    const sectionDepart = document.getElementById('rec-ticket-depart');
    const sectionReturn = document.getElementById('rec-ticket-return');
    
    sectionDepart.classList.add('hidden');
    sectionReturn.classList.add('hidden');

    let allPax = Array.isArray(order.passengers) ? order.passengers : (order.name ? [{name: order.name, nik: order.nik || '-', type: 'adult', direction: 'depart'}] : []);
    
    const departPax = allPax.filter(p => !p.direction || p.direction === 'depart');
    const returnPax = allPax.filter(p => p.direction === 'return');
    
    const buildPaxHtml = (paxArr) => {
        let html = '';
        let adults = 0; let infants = 0;
        
        paxArr.forEach(p => {
            if(p.type === 'infant') infants++; else adults++;
            const isInfant = p.type === 'infant';
            const paxTypeLabel = isInfant ? '<span class="text-[10px] bg-pink-500/20 border border-pink-500/30 px-2 py-0.5 rounded ml-2 text-pink-400 align-middle tracking-widest">BAYI</span>' : '';
            
            let dobDisplayReceipt = '';
            if (p.dob) {
                const dObj = new Date(p.dob);
                if(!isNaN(dObj)) {
                    const dobStr = dObj.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }).toUpperCase();
                    dobDisplayReceipt = `<div class="mt-2 pt-2 border-t border-dashed border-white/10 flex items-center gap-2"><i class="fas fa-calendar-alt text-davka-orange text-[12px] opacity-80"></i><span class="text-[12px] text-gray-400 uppercase tracking-widest">Lahir:</span><span class="text-[14px] text-white font-bold font-mono tracking-widest">${dobStr}</span></div>`;
                }
            }
            html += `<div class="flex flex-col bg-black/40 p-4 rounded-xl mb-3 border border-white/10 shadow-inner w-full"><p class="text-[18px] font-black text-white uppercase break-words leading-tight tracking-widest flex items-center">${p.name} ${paxTypeLabel}</p><p class="text-[18px] text-gray-200 font-bold font-mono mt-2 tracking-widest"><i class="fas fa-id-card text-gray-500 mr-2 text-[14px]"></i>ID: ${p.nik || '-'}</p>${dobDisplayReceipt}</div>`;
        });
        
        let countStr = `${adults} Dewasa`;
        if(infants > 0) countStr += `, ${infants} Bayi`;
        return { html, countStr };
    };

    const mainPaxName = departPax.length > 0 ? departPax[0].name : (order.contactName || 'PENUMPANG');
    const address = order.address || '-';

    if (currentDetailTab === 'return' && order.tripType === 'round_trip') {
        sectionReturn.classList.remove('hidden');
        
        document.getElementById('rec-return-origin-code').innerText = (order.returnOrigin || order.dest || 'ORG').toUpperCase();
        document.getElementById('rec-return-dest-code').innerText = (order.returnDest || order.origin || 'DES').toUpperCase();
        document.getElementById('rec-return-train-name').innerText = (order.returnTrain || 'KERETA').toUpperCase();
        
        document.getElementById('rec-return-date-depart').innerText = order.returnDate ? new Date(order.returnDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }).toUpperCase() : '-';
        document.getElementById('rec-return-war-date').innerText = order.returnWarDate ? new Date(order.returnWarDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }).toUpperCase() : '-';
        
        const stampElReturn = document.getElementById('rec-stamp-return');
        if (order.status === 'success') stampElReturn.classList.add('visible'); else stampElReturn.classList.remove('visible');

        const returnTotal = order.returnPrice || 0;
        const returnDp = order.feeReturn || 0;
        let returnRemaining = order.status === 'success' ? 0 : returnTotal - returnDp;

        document.getElementById('rec-price-total').innerText = formatRupiah(returnTotal);
        document.getElementById('rec-price-dp').innerText = formatRupiah(returnDp);
        const remEl = document.getElementById('rec-price-remaining');
        remEl.innerText = formatRupiah(returnRemaining);
        remEl.className = returnRemaining <= 0 ? "text-[32px] font-black text-green-400 font-mono glow-text-white drop-shadow-[0_0_10px_rgba(74,222,128,0.5)]" : "text-[32px] font-black text-[#0ea5e9] font-mono glow-text-white drop-shadow-[0_0_10px_rgba(14,165,233,0.5)]";

        document.getElementById('rec-id').innerText = "#" + order.id.toString().slice(-6) + "-R";
        document.getElementById('rec-return-contact-name').innerText = (order.contactName || mainPaxName).toUpperCase();
        document.getElementById('rec-return-contact-phone').innerText = order.contactPhone || '-';
        document.getElementById('rec-return-address').innerText = address.toUpperCase();
        document.getElementById('rec-return-payment-method').innerText = (order.paymentMethodReturn || order.paymentMethod || 'TUNAI').toUpperCase();
        
        const activeReturnPax = returnPax.length > 0 ? returnPax : departPax;
        const retRender = buildPaxHtml(activeReturnPax);
        document.getElementById('rec-return-pax-count').innerText = retRender.countStr;
        document.getElementById('rec-return-pax-list').innerHTML = retRender.html;

    } else {
        sectionDepart.classList.remove('hidden');
        document.getElementById('rec-origin-code').innerText = (order.origin || 'ORG').toUpperCase();
        document.getElementById('rec-dest-code').innerText = (order.dest || 'DES').toUpperCase();
        document.getElementById('rec-train-name').innerText = (order.train || 'KERETA').toUpperCase();

        document.getElementById('rec-date-depart').innerText = order.date ? new Date(order.date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }).toUpperCase() : '-';
        document.getElementById('rec-war-date').innerText = order.warDate ? new Date(order.warDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }).toUpperCase() : '-';
        
        const stampElDepart = document.getElementById('rec-stamp-depart');
        if (order.status === 'success') stampElDepart.classList.add('visible'); else stampElDepart.classList.remove('visible');

        const departTotal = order.price || 0;
        const departDp = (order.feeDepart !== undefined) ? order.feeDepart : (order.fee || 0);
        let departRemaining = order.status === 'success' ? 0 : departTotal - departDp;

        document.getElementById('rec-price-total').innerText = formatRupiah(departTotal);
        document.getElementById('rec-price-dp').innerText = formatRupiah(departDp);
        const remEl = document.getElementById('rec-price-remaining');
        remEl.innerText = formatRupiah(departRemaining);
        remEl.className = departRemaining <= 0 ? "text-[32px] font-black text-green-400 font-mono glow-text-white drop-shadow-[0_0_10px_rgba(74,222,128,0.5)]" : "text-[32px] font-black text-davka-orange font-mono glow-text-orange";

        document.getElementById('rec-id').innerText = "#" + order.id.toString().slice(-6);
        document.getElementById('rec-contact-name').innerText = (order.contactName || mainPaxName).toUpperCase();
        document.getElementById('rec-contact-phone').innerText = order.contactPhone || '-';
        document.getElementById('rec-address').innerText = address.toUpperCase();
        document.getElementById('rec-payment-method').innerText = (order.paymentMethod || 'TUNAI').toUpperCase();
        
        const depRender = buildPaxHtml(departPax);
        document.getElementById('rec-pax-count').innerText = depRender.countStr;
        document.getElementById('rec-pax-list').innerHTML = depRender.html;
    }
}

function captureAndShowModal(elementId) {
    const el = document.getElementById(elementId);
    html2canvas(el, { scale: 3, useCORS: true, allowTaint: true, backgroundColor: null, windowHeight: el.scrollHeight }) 
    .then(canvas => { 
        showImageModal(canvas.toDataURL("image/jpeg", 0.95), true); 
        toggleLoader(false); 
    })
    .catch(err => { console.error("Render Error:", err); toggleLoader(false); alert("Gagal render."); });
}
function renderUploadBtnHTML(id, type, file, label) {
    if(file) {
        return `<div class="relative w-full h-full rounded-lg overflow-hidden border border-white/10 group cursor-pointer bg-black/40">
            <img src="${file}" class="w-full h-full object-cover opacity-60 group-hover:opacity-100 transition-all" onclick="showImageModal(this.src, true); event.stopPropagation();">
            <div class="absolute inset-0 flex items-center justify-center pointer-events-none"><p class="text-[9px] text-white font-bold drop-shadow-md px-1 text-center leading-tight">${label}</p></div>
            <button onclick="triggerHistoryUpload(${id}, '${type}')" class="absolute top-1 right-1 bg-black/60 text-white rounded-full w-5 h-5 flex items-center justify-center hover:bg-davka-orange transition-colors z-10"><i class="fas fa-pen text-[8px]"></i></button>
        </div>`;
    } else {
        return `<button onclick="triggerHistoryUpload(${id}, '${type}')" class="w-full h-full bg-white/5 border border-white/10 border-dashed text-gray-500 rounded-lg text-[9px] hover:bg-white/10 hover:border-white/30 hover:text-gray-300 transition-all flex flex-col items-center justify-center gap-1 group">
            <i class="fas fa-upload text-xs mb-0.5"></i><span>${label}</span>
        </button>`;
    }
}

window.triggerHistoryUpload = function(orderId, type) {
    currentUploadOrderId = orderId; currentUploadType = type;
    document.getElementById('inpHistoryUpload').click();
}

window.clearImage = function(type) {
    const maps = {
        'transfer': ['inpFileTransfer', 'inpTransferData', 'imgTransfer', 'previewTransfer'],
        'chat': ['inpFileChat', 'inpChatData', 'imgChat', 'previewChat'],
        'transferReturn': ['inpFileTransferReturn', 'inpTransferDataReturn', 'imgTransferReturn', 'previewTransferReturn'],
        'chatReturn': ['inpFileChatReturn', 'inpChatDataReturn', 'imgChatReturn', 'previewChatReturn']
    };
    if(maps[type]) {
        document.getElementById(maps[type][0]).value = ''; document.getElementById(maps[type][1]).value = '';
        document.getElementById(maps[type][2]).src = ''; document.getElementById(maps[type][3]).classList.add('hidden');
    }
    resetUploadZones(); 
}

function formatRupiah(num) { return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(num); }
function updateDate() { document.getElementById('current-date').innerText = new Date().toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short' }); }
function updateGreeting() {
    const hour = new Date().getHours();
    let greeting = (hour >= 4 && hour < 11) ? 'Pagi' : (hour >= 11 && hour < 15) ? 'Siang' : (hour >= 15 && hour < 19) ? 'Sore' : 'Malam';
    const el = document.getElementById('txt-greeting-time'); if(el) el.innerText = `Selamat ${greeting}`;
}
window.showToast = function(msg) {
    const t = document.getElementById('toast');
    document.getElementById('toastMsg').innerText = msg;
    t.classList.remove('opacity-0', 'translate-y-[-20px]', 'pointer-events-none');
    setTimeout(() => t.classList.add('opacity-0', 'translate-y-[-20px]', 'pointer-events-none'), 3000);
}

window.showImageModal = function(src, dl=false) {
    document.getElementById('modalImg').src = src;
    const acts = document.getElementById('modalActions'); acts.innerHTML = '';
    if(dl) {
        const btn = document.createElement('a');
        btn.href = src; btn.download = `Davka_Ticket_${Date.now()}.jpg`; 
        btn.className = "bg-davka-orange text-white text-xs font-bold py-2 px-4 rounded-full shadow-lg flex items-center gap-2";
        btn.innerHTML = '<i class="fas fa-download"></i> Simpan ke Galeri';
        acts.appendChild(btn);
    }
    document.getElementById('imageModal').classList.remove('hidden');
    
    window.history.pushState({ view: 'modal' }, '', '#modal');
}

window.closeImageModal = function(fromPopState = false) { 
    document.getElementById('imageModal').classList.add('hidden'); 
    if(!fromPopState) {
        window.history.back(); 
    }
}

window.resetForm = function() {
    document.getElementById('orderForm').reset();
    document.getElementById('editIndex').value = "-1";
    document.getElementById('btnSaveText').innerText = "SIMPAN PESANAN";
    
    document.getElementById('inpPaxCount').value = "1";
    document.getElementById('inpInfantCount').value = "0"; 
    
    if (document.getElementById('inpReturnPaxCount')) document.getElementById('inpReturnPaxCount').value = "1";
    if (document.getElementById('inpReturnInfantCount')) document.getElementById('inpReturnInfantCount').value = "0";
    
    document.getElementById('inpTripType').value = 'one_way';
    
    document.getElementById('inpPricePerPax').value = '';
    if(document.getElementById('inpReturnPricePerPax')) document.getElementById('inpReturnPricePerPax').value = '';
    
    document.getElementById('inpRemainingDepart').value = 'Rp 0';
    if(document.getElementById('inpRemainingReturn')) document.getElementById('inpRemainingReturn').value = 'Rp 0';
    
    document.getElementById('inpPaymentMethod').value = 'Tunai';
    if(document.getElementById('inpPaymentMethodReturn')) document.getElementById('inpPaymentMethodReturn').value = 'Tunai';

    document.getElementById('inpPaxSame').checked = true;

    toggleTripType(); 
    clearImage('transfer'); clearImage('chat');
    clearImage('transferReturn'); clearImage('chatReturn');
    
    updatePassengerForms(); 
    calcRemaining();
    resetUploadZones();
    enableSmoothInputUX();

    currentStep = 1;
    document.querySelectorAll('.form-step').forEach(el => {
        el.classList.add('hidden');
        el.classList.remove('fade-in');
    });
    const step1 = document.getElementById('step-1');
    if (step1) {
        step1.classList.remove('hidden');
        step1.classList.add('fade-in');
    }
    if (typeof updateWizardProgress === 'function') updateWizardProgress();
}

window.openDetailView = function(orderId, fromPopState = false) {
    const order = orders.find(o => o.id === orderId);
    if (!order) return;

    currentDetailOrder = order;

    document.getElementById('page-list').classList.add('hidden', 'fade-out');
    document.getElementById('page-detail').classList.remove('hidden');
    document.getElementById('page-detail').classList.add('fade-in');
    
    if (!fromPopState) {
        window.history.pushState({ view: 'detail', id: orderId }, '', `#detail-${orderId}`);
    }
    
    window.scrollTo({ top: 0, behavior: 'smooth' });

    const displayName = (order.contactName || order.name || 'No Name').toUpperCase();
    document.getElementById('detail-contact-name').innerText = displayName;
    document.getElementById('detail-id').innerText = "#" + order.id.toString().slice(-6);
    
    const badge = document.getElementById('detail-status-badge');
    badge.className = "px-3 py-1 rounded-full text-[10px] font-bold uppercase border ";
    if (order.status === 'success') {
        badge.innerText = "LUNAS"; badge.classList.add('bg-green-500/10', 'border-green-500/30', 'text-green-400');
    } else if (order.status === 'cancel') {
        badge.innerText = "BATAL"; badge.classList.add('bg-red-500/10', 'border-red-500/30', 'text-red-400');
    } else {
        badge.innerText = "PENDING"; badge.classList.add('bg-orange-500/10', 'border-orange-500/30', 'text-orange-400');
    }

    document.getElementById('detail-train').innerText = order.train || '-';
    document.getElementById('detail-date').innerText = order.date ? new Date(order.date).toLocaleDateString('id-ID', {day: 'numeric', month: 'short', year: 'numeric'}) : '-';
    document.getElementById('detail-war-date').innerText = order.warDate ? new Date(order.warDate).toLocaleDateString('id-ID', {day: 'numeric', month: 'short'}) : '-';
    
    const renderProof = (url, label, isTransfer) => {
        if(url) {
            const overlayText = isTransfer ? "BUKTI TRANSFER" : "BUKTI CHAT WA";
            return `
            <div class="w-full h-full flex flex-col cursor-pointer hover:opacity-90 transition-opacity" onclick="showImageModal('${url}', true)">
                <div class="flex-1 w-full bg-white/5 overflow-hidden">
                    <img src="${url}" class="w-full h-full object-cover object-top">
                </div>
                <div class="h-8 bg-[#374151] flex items-center justify-center shrink-0 border-t border-white/10">
                    <p class="text-[9px] text-white font-bold tracking-widest uppercase">${overlayText}</p>
                </div>
            </div>`;
        } else {
            return `
            <div class="w-full h-full flex flex-col items-center justify-center text-gray-500 bg-[#1f2937]/30">
                <i class="fas fa-image mb-1 opacity-50 text-xs"></i>
                <span class="text-[8px] uppercase tracking-wider">${label}</span>
            </div>`;
        }
    };

    document.getElementById('detail-img-transfer-depart').innerHTML = renderProof(order.transferScreenshot, "Belum Upload TF", true);
    document.getElementById('detail-img-chat-depart').innerHTML = renderProof(order.chatScreenshot, "Belum Upload Chat", false);

    const tabContainer = document.getElementById('tab-container');
    const returnBadge = document.getElementById('badge-return-active');
    const returnDataContainer = document.getElementById('data-return-exist');
    const returnEmptyContainer = document.getElementById('data-return-empty');
    const containerProofReturn = document.getElementById('container-proof-return');
    
    const uploadTicketDepart = document.getElementById('detail-upload-ticket-depart');
    const uploadTicketReturn = document.getElementById('detail-upload-ticket-return');

    if (order.tripType === 'round_trip') {
        tabContainer.classList.remove('hidden');
        tabContainer.classList.add('flex');
        
        returnBadge.classList.remove('hidden');
        returnDataContainer.classList.remove('hidden');
        returnEmptyContainer.classList.add('hidden');
        containerProofReturn.classList.remove('hidden');

        document.getElementById('detail-return-train').innerText = order.returnTrain || '-';
        document.getElementById('detail-return-date').innerText = order.returnDate ? new Date(order.returnDate).toLocaleDateString('id-ID', {day: 'numeric', month: 'short', year: 'numeric'}) : '-';
        document.getElementById('detail-return-war-date').innerText = order.returnWarDate ? new Date(order.returnWarDate).toLocaleDateString('id-ID', {day: 'numeric', month: 'short'}) : '-';
        
        document.getElementById('detail-img-transfer-return').innerHTML = renderProof(order.transferScreenshotReturn, "Belum Upload TF", true);
        document.getElementById('detail-img-chat-return').innerHTML = renderProof(order.chatScreenshotReturn, "Belum Upload Chat", false);

        uploadTicketDepart.innerHTML = renderUploadBtnHTML(orderId, 'kai_ticket_depart', order.kaiTicketFile, 'E-Tiket Pergi');
        uploadTicketReturn.innerHTML = renderUploadBtnHTML(orderId, 'kai_ticket_return', order.kaiTicketFileReturn, 'E-Tiket Pulang');
    } else {
        tabContainer.classList.add('hidden');
        tabContainer.classList.remove('flex');
        
        returnBadge.classList.add('hidden');
        returnDataContainer.classList.add('hidden');
        returnEmptyContainer.classList.remove('hidden');
        containerProofReturn.classList.add('hidden');

        uploadTicketDepart.innerHTML = renderUploadBtnHTML(orderId, 'kai_ticket_depart', order.kaiTicketFile, 'E-Tiket KAI');
        uploadTicketReturn.innerHTML = '';
    }

    let allPax = Array.isArray(order.passengers) ? order.passengers : (order.name ? [{name: order.name, nik: order.nik || '-', dob: '', type: 'adult', direction: 'depart'}] : []);
    
    const buildPaxBlock = (paxArr) => {
        let h = '';
        paxArr.forEach(p => {
            const isInfant = p.type === 'infant';
            const iconColor = isInfant ? 'text-pink-400 bg-pink-500/10' : 'text-gray-300 bg-white/10';
            const icon = isInfant ? 'fa-baby' : 'fa-user';
            const label = isInfant ? '<span class="text-[8px] ml-2 px-1.5 py-0.5 rounded bg-pink-500/20 text-pink-400 border border-pink-500/30">BAYI</span>' : '';
            
            let dobBadge = '';
            if (p.dob) {
                const d = new Date(p.dob);
                const dobFormat = !isNaN(d) ? d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }).toUpperCase() : p.dob;
                dobBadge = `<span class="flex items-center gap-1 text-gray-300 text-xs font-bold whitespace-nowrap"><i class="fas fa-calendar-alt opacity-70"></i> ${dobFormat}</span>`;
            }

            h += `<div class="flex items-start gap-3 border-b border-white/5 pb-3 pt-1 last:border-0 last:pb-0"><div class="w-6 h-6 rounded-full ${iconColor} flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5"><i class="fas ${icon}"></i></div><div class="flex-1 min-w-0"><p class="text-xs font-bold text-white uppercase flex flex-wrap items-center gap-1">${p.name} ${label}</p><div class="flex flex-col gap-1 mt-1.5"><p class="text-xs text-gray-300 font-bold whitespace-nowrap">NIK: ${p.nik}</p>${dobBadge}</div></div></div>`;
        });
        return h;
    };

    const departPax = allPax.filter(p => !p.direction || p.direction === 'depart');
    const returnPax = allPax.filter(p => p.direction === 'return');
    
    document.getElementById('detail-pax-list').innerHTML = buildPaxBlock(departPax);
    
    const returnPaxContainer = document.getElementById('detail-pax-list-return-container');
    if (order.tripType === 'round_trip' && returnPax.length > 0) {
        returnPaxContainer.classList.remove('hidden');
        document.getElementById('detail-pax-list-return').innerHTML = buildPaxBlock(returnPax);
    } else {
        returnPaxContainer.classList.add('hidden');
    }

    document.getElementById('detail-cost-breakdown').innerHTML = '';
    switchTab('depart');

    const settlementOptions = ["-", "Tunai", "Transfer CIMB Niaga", "Transfer Seabank", "Dana", "Gopay", "Ovo", "ShopeePay"];
    const selectEl = document.getElementById('detail-settlement-select');
    selectEl.innerHTML = settlementOptions.map(opt => `<option value="${opt}" ${order.settlementMethod === opt ? 'selected' : ''}>${opt === '-' ? 'Belum Lunas' : opt}</option>`).join('');
    selectEl.onchange = function() { updateSettlement(orderId, this.value); };

    document.getElementById('detail-upload-settlement').innerHTML = renderUploadBtnHTML(orderId, 'settlement', order.settlementProof, 'Bukti Lunas');

    document.getElementById('btn-action-status').onclick = function() { toggleStatus(orderId); };
    document.getElementById('btn-action-edit').onclick = function() { editOrder(orderId); };
    document.getElementById('btn-action-print').onclick = function() { printReceipt(orderId); };
    document.getElementById('btn-action-delete').onclick = function() { deleteOrder(orderId); };
}

window.closeDetailView = function() {
    window.history.back();
}

// REVISI: Fungsi render diubah menjadi full 3D card layout dan argumen search filter dihapus
window.renderOrderList = function() {
    const container = document.getElementById('ordersContainer');
    container.innerHTML = '';
    
    if(!orders || orders.length === 0) { 
        document.getElementById('emptyState').classList.remove('hidden'); 
        return; 
    } 
    document.getElementById('emptyState').classList.add('hidden');
    
    const sortedOrders = [...orders].sort((a, b) => new Date(b.created_at || b.id) - new Date(a.created_at || a.id));

    sortedOrders.forEach((order, index) => {
        let statusColorClass = ''; 
        let indicatorColor = ''; 
        let glowClass = '';

        if (order.status === 'success') { 
            statusColorClass = 'bg-green-500/10 border-green-500/30 text-green-400'; 
            indicatorColor = 'bg-green-500'; 
            glowClass = 'hover-glow-success';
        } else if (order.status === 'cancel') { 
            statusColorClass = 'bg-red-500/10 border-red-500/30 text-red-400'; 
            indicatorColor = 'bg-red-500'; 
            glowClass = 'hover-glow-cancel';
        } else { 
            statusColorClass = 'bg-orange-500/10 border-orange-500/30 text-orange-400'; 
            indicatorColor = 'bg-orange-500'; 
            glowClass = 'hover-glow-pending';
        }

        const displayName = (order.contactName || order.name || 'No Name').toUpperCase();
        const displayNo = sortedOrders.length - index; 
        const dateStr = order.date ? new Date(order.date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) : '-';
        
        let routeHtml = `
            <div class="mt-2 inner-3d-element transform translate-z-10">
                <p class="text-[11px] text-gray-300 font-bold flex items-center">
                    <i class="fas fa-train text-davka-orange mr-1.5 text-[10px]"></i> ${order.origin || '?'} <i class="fas fa-chevron-right text-[8px] mx-1.5 opacity-50"></i> ${order.dest || '?'}
                </p>
                <p class="text-[10px] text-gray-500 pl-4 font-mono mt-0.5">${dateStr}</p>
            </div>
        `;

        if (order.tripType === 'round_trip') {
            const retDateStr = order.returnDate ? new Date(order.returnDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) : '-';
            const retOrg = order.returnOrigin || order.dest || '?';
            const retDest = order.returnDest || order.origin || '?';
            routeHtml += `
            <div class="mt-2 pt-2 border-t border-white/5 relative inner-3d-element transform translate-z-10">
                <div class="absolute left-1.5 top-2 w-0.5 h-full bg-blue-500/20"></div>
                <div class="flex justify-between items-start">
                    <div>
                        <p class="text-[11px] text-gray-300 font-bold flex items-center">
                            <i class="fas fa-exchange-alt text-blue-400 mr-1.5 text-[10px]"></i> ${retOrg} <i class="fas fa-chevron-right text-[8px] mx-1.5 opacity-50"></i> ${retDest}
                        </p>
                        <p class="text-[10px] text-gray-500 pl-4 font-mono mt-0.5">${retDateStr}</p>
                    </div>
                    <div class="px-2 py-1 rounded-md bg-black/40 border border-white/5 self-center mt-1">
                        <p class="text-[8px] ${statusColorClass.split(' ')[2]} font-bold uppercase tracking-wider">${order.status}</p>
                    </div>
                </div>
            </div>`;
        }

        const item = document.createElement('div');
        item.className = `list-card-3d preserve-3d rounded-2xl border ${statusColorClass.split(' ')[1]} ${statusColorClass.split(' ')[0]} mb-4 w-full bg-black/20 backdrop-blur-sm ${glowClass}`;
        item.onclick = function() { openDetailView(order.id); };

        item.innerHTML = `
        <div class="relative p-4 flex flex-col w-full overflow-hidden rounded-2xl">
            <div class="absolute left-0 top-0 bottom-0 w-1.5 ${indicatorColor} shadow-[0_0_10px_currentColor]"></div>
            
            <div class="flex items-start justify-between mb-1 pl-2">
                <div class="flex items-center gap-3 w-full">
                    <div class="w-8 h-8 rounded-xl bg-black/40 flex items-center justify-center font-mono text-sm font-black ${statusColorClass.split(' ')[2]} border border-white/10 shadow-inner inner-3d-element transform translate-z-20 shrink-0">
                        ${displayNo}
                    </div>
                    <div class="flex-1 min-w-0 inner-3d-element transform translate-z-20">
                        <h4 class="text-base font-black text-white truncate leading-tight tracking-wide drop-shadow-md">${displayName}</h4>
                    </div>
                    <div class="px-3 py-1 rounded-lg border border-white/10 bg-black/40 shadow-inner inner-3d-element transform translate-z-20 shrink-0">
                        <p class="text-[9px] ${statusColorClass.split(' ')[2]} font-black uppercase tracking-widest">${order.status}</p>
                    </div>
                </div>
            </div>
            
            <div class="pl-2 w-full">
                ${routeHtml}
            </div>
        </div>`;
        container.appendChild(item);
    });
}

function renderStats() {
    let totalOmset = 0; let totalTiketTerjual = 0;
    let paxPending = 0; let paxSukses = 0; let paxBatal = 0;

    if (orders) {
        orders.forEach(o => {
            let depCount = 0; let retCount = 0;
            if (Array.isArray(o.passengers)) {
                depCount = o.passengers.filter(p => !p.direction || p.direction === 'depart').length;
                retCount = o.passengers.filter(p => p.direction === 'return').length;
            } else if (o.name) { depCount = 1; }

            const paxCount = (o.tripType === 'round_trip' && retCount > 0) ? Math.max(depCount, retCount) : depCount;

            if (o.status === 'pending') paxPending += paxCount;
            else if (o.status === 'success') {
                paxSukses += paxCount;
                totalTiketTerjual += paxCount;
                totalOmset += (parseFloat(o.price) || 0) + (parseFloat(o.returnPrice) || 0);
            } 
            else if (o.status === 'cancel') paxBatal += paxCount;
        });
    }

    document.getElementById('stat-today').innerText = totalTiketTerjual;
    document.getElementById('stat-revenue').innerText = formatRupiah(totalOmset);
    document.getElementById('stat-pending').innerText = paxPending;
    document.getElementById('stat-success').innerText = paxSukses;
    document.getElementById('stat-cancel').innerText = paxBatal;
}
