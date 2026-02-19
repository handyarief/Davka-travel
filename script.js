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
let currentDetailOrder = null; // Menyimpan order yang sedang dibuka detailnya
let currentDetailTab = 'depart'; // Melacak tab aktif (depart/return) untuk logika Nota

// --- INIT SYSTEM ---
document.addEventListener('DOMContentLoaded', async () => {
    // Logic Video Intro & Loading Bar
    const splash = document.getElementById('splash-screen');
    const video = document.getElementById('intro-video');
    const skipBtn = document.getElementById('btn-skip-intro');
    
    // Langsung jalankan init logic di background
    initializeAppLogic();

    const enterApp = () => {
        if(splash) {
            splash.classList.add('splash-hidden'); 
            setTimeout(() => { splash.remove(); }, 1000); 
        }
    };

    // LOGIC: Jalankan loading bar 4 detik setelah video selesai
    const startLoaderSequence = () => {
        const loaderWrapper = document.getElementById('post-video-loader');
        const loaderFill = document.getElementById('post-video-fill');
        const videoOverlay = document.getElementById('video-overlay');

        if (loaderWrapper && loaderFill) {
            loaderWrapper.style.opacity = '1';
            if(videoOverlay) videoOverlay.style.opacity = '1';

            setTimeout(() => {
                loaderFill.style.width = '100%';
            }, 100);

            setTimeout(() => {
                enterApp();
            }, 4100); 
        } else {
            enterApp();
        }
    };

    if (video) {
        setTimeout(() => { if(skipBtn) skipBtn.classList.remove('hidden'); }, 1000);
        
        video.addEventListener('ended', startLoaderSequence);
        
        setTimeout(() => {
            if(document.getElementById('splash-screen')) enterApp();
        }, 15000); 
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
        if (!e.target.closest('.upload-zone-base')) {
            resetUploadZones();
        }
    });
});

function initializeAppLogic() {
    updateDate();
    updateGreeting(); 
    fetchOrders(); 
    setupRealtime(); 
    
    updatePassengerForms(); 
    
    // Setup Uploader Asli (Pergi)
    setupImageUploader('inpFileTransfer', 'inpTransferData', 'imgTransfer', 'previewTransfer');
    setupImageUploader('inpFileChat', 'inpChatData', 'imgChat', 'previewChat');
    
    // Setup Uploader Baru (Pulang)
    setupImageUploader('inpFileTransferReturn', 'inpTransferDataReturn', 'imgTransferReturn', 'previewTransferReturn');
    setupImageUploader('inpFileChatReturn', 'inpChatDataReturn', 'imgChatReturn', 'previewChatReturn');

    setupHistoryUploader();
    
    // UX ENHANCEMENT: Inisialisasi Smooth Scroll & Enter Key
    enableSmoothInputUX();
}

// --- FEATURE: TAB SYSTEM LOGIC (PERGI / PULANG) ---
window.switchTab = function(tabName) {
    const btnDepart = document.getElementById('tab-btn-depart');
    const btnReturn = document.getElementById('tab-btn-return');
    const contentDepart = document.getElementById('tab-content-depart');
    const contentReturn = document.getElementById('tab-content-return');

    // Update Global Tracker
    currentDetailTab = tabName;

    // Reset Styles (Inactive State)
    const inactiveClass = "flex-1 py-2 text-[10px] font-bold uppercase rounded-lg transition-all text-gray-400 hover:text-white relative";
    const activeClass = "flex-1 py-2 text-[10px] font-bold uppercase rounded-lg transition-all bg-davka-orange text-white shadow-lg relative";

    btnDepart.className = inactiveClass;
    btnReturn.className = inactiveClass;
    
    // Hide Content
    contentDepart.classList.add('hidden');
    contentReturn.classList.add('hidden');

    // Activate Requested Tab
    if (tabName === 'depart') {
        btnDepart.className = activeClass;
        contentDepart.classList.remove('hidden');
        
        // RESET HEADER: Tampilkan rute PERGI
        if(currentDetailOrder) {
            document.getElementById('detail-origin').innerText = currentDetailOrder.origin || 'ORG';
            document.getElementById('detail-dest').innerText = currentDetailOrder.dest || 'DES';
            document.getElementById('detail-route-icon').className = "fas fa-chevron-right text-davka-orange text-xl";
            
            // Render Finansial Khusus Pergi
            renderDetailFinancials('depart');
        }
    } else {
        btnReturn.className = activeClass;
        contentReturn.classList.remove('hidden');

        // UPDATE HEADER: Tampilkan rute PULANG (Swap Origin & Dest)
        if(currentDetailOrder && currentDetailOrder.tripType === 'round_trip') {
            const retOrg = currentDetailOrder.returnOrigin || currentDetailOrder.dest || 'ORG';
            const retDes = currentDetailOrder.returnDest || currentDetailOrder.origin || 'DES';
            
            document.getElementById('detail-origin').innerText = retOrg;
            document.getElementById('detail-dest').innerText = retDes;
            
            document.getElementById('detail-route-icon').className = "fas fa-chevron-right text-blue-500 text-xl"; 
            
            // Render Finansial Khusus Pulang
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

    // Tentukan data berdasarkan mode (Pergi/Pulang)
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

    // Jika status global 'success', sisa tagihan 0 (LUNAS)
    if (order.status === 'success') {
        remaining = 0;
    }

    // Render HTML Kartu Pembayaran
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

    // Inject ke DOM
    const costContainer = document.getElementById('detail-cost-breakdown');
    costContainer.innerHTML = html;
    costContainer.classList.remove('hidden');

    // Update Label Total Bawah (Hanya untuk tab yang aktif)
    document.getElementById('detail-price').innerText = formatRupiah(price);
    
    // Update Sisa Tagihan Bawah (Hanya untuk tab yang aktif)
    const remEl = document.getElementById('detail-remaining');
    remEl.innerText = formatRupiah(remaining);
    remEl.className = remaining <= 0 ? "text-sm font-black text-green-500" : "text-sm font-black text-red-500";
}

window.switchUploadTab = function(tabName) {
    const btnDepart = document.getElementById('btn-upload-depart');
    const btnReturn = document.getElementById('btn-upload-return');
    const containerDepart = document.getElementById('uploadContainerDepart');
    const containerReturn = document.getElementById('uploadContainerReturn');

    const inactiveClass = "flex-1 py-2 text-[10px] font-bold uppercase rounded-lg transition-all text-gray-400 hover:text-white";
    const activeClass = "flex-1 py-2 text-[10px] font-bold uppercase rounded-lg transition-all bg-davka-orange text-white shadow-lg";

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
// --- UX ENGINE: SMOOTH SCROLL & ENTER KEY NAVIGATION ---
function enableSmoothInputUX() {
    const formElements = document.querySelectorAll('input, select, textarea');
    
    formElements.forEach((el, index) => {
        el.removeEventListener('focus', handleInputFocus);
        el.removeEventListener('click', handleInputFocus); 
        el.removeEventListener('keydown', handleInputEnter);

        el.addEventListener('focus', handleInputFocus);
        el.addEventListener('click', handleInputFocus); 
        el.addEventListener('keydown', (e) => handleInputEnter(e, index, formElements));
    });
}

function handleInputFocus(e) {
    setTimeout(() => {
        e.target.scrollIntoView({ 
            behavior: 'smooth', 
            block: 'start', 
            inline: 'nearest' 
        });
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
        
        if (nextIndex >= allElements.length) {
            e.target.blur();
        }
    }
}
// --- LOGIC PENUMPANG (DEWASA & BAYI) ---
window.updatePassengerForms = function() {
    const adultCount = parseInt(document.getElementById('inpPaxCount').value) || 1;
    const infantCount = parseInt(document.getElementById('inpInfantCount').value) || 0;
    const container = document.getElementById('passengerForms'); 
    
    const existingItems = document.querySelectorAll('.passenger-item');
    let storedAdults = [];
    let storedInfants = [];

    existingItems.forEach(el => {
        const type = el.getAttribute('data-type');
        const name = el.querySelector('.pax-name').value;
        const nik = el.querySelector('.pax-nik').value;
        const dobInput = el.querySelector('.pax-dob');
        const dob = dobInput ? dobInput.value : '';

        if(type === 'infant') {
            storedInfants.push({name, nik, dob});
        } else {
            storedAdults.push({name, nik, dob});
        }
    });

    let html = '';

    for(let i = 1; i <= adultCount; i++) {
        const valName = storedAdults[i-1] ? storedAdults[i-1].name : '';
        const valNik = storedAdults[i-1] ? storedAdults[i-1].nik : '';
        const valDob = storedAdults[i-1] ? storedAdults[i-1].dob : ''; 
        
        html += `
        <div class="passenger-item border border-white/10 rounded-xl p-3 bg-white/5 relative group hover:border-davka-orange/50 transition-colors" data-type="adult">
            <div class="absolute -left-1 top-3 w-1 h-6 bg-davka-orange rounded-r"></div>
            <p class="text-[10px] font-bold text-davka-orange mb-2 uppercase tracking-wider pl-2">
                <i class="fas fa-user mr-1"></i> Dewasa ${i}
            </p>
            <div class="space-y-2 pl-2">
                <input type="text" value="${valName}" class="pax-name w-full bg-davka-bg border border-davka-border rounded-lg p-2 text-sm text-white focus:border-davka-orange focus:outline-none placeholder-gray-600" placeholder="Nama Lengkap (Sesuai KTP)" autocapitalize="characters">
                <div class="grid grid-cols-2 gap-2">
                    <input type="number" value="${valNik}" class="pax-nik w-full bg-davka-bg border border-davka-border rounded-lg p-2 text-sm text-white focus:border-davka-orange focus:outline-none placeholder-gray-600" placeholder="NIK / Paspor">
                    <input type="text" onfocus="(this.type='date')" onblur="(this.type='text')" value="${valDob}" class="pax-dob w-full bg-davka-bg border border-davka-border rounded-lg p-2 text-sm text-white focus:border-davka-orange focus:outline-none placeholder-gray-600" placeholder="Tanggal Lahir">
                </div>
            </div>
        </div>`;
    }

    for(let i = 1; i <= infantCount; i++) {
        const valName = storedInfants[i-1] ? storedInfants[i-1].name : '';
        const valNik = storedInfants[i-1] ? storedInfants[i-1].nik : '';
        const valDob = storedInfants[i-1] ? storedInfants[i-1].dob : ''; 
        
        html += `
        <div class="passenger-item border border-pink-500/30 rounded-xl p-3 bg-pink-500/5 relative group hover:border-pink-500 transition-colors" data-type="infant">
            <div class="absolute -left-1 top-3 w-1 h-6 bg-pink-500 rounded-r"></div>
            <p class="text-[10px] font-bold text-pink-400 mb-2 uppercase tracking-wider pl-2">
                <i class="fas fa-baby mr-1"></i> Bayi ${i}
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

    container.innerHTML = html;
    calcTotalFromPax();
    setTimeout(enableSmoothInputUX, 100);
}
window.getPassengersFromForm = function() {
    const items = document.querySelectorAll('.passenger-item');
    let paxList = [];
    
    items.forEach(el => {
        const nameInput = el.querySelector('.pax-name');
        const nikInput = el.querySelector('.pax-nik');
        const dobInput = el.querySelector('.pax-dob'); 
        const type = el.getAttribute('data-type'); 
        
        paxList.push({
            name: nameInput.value.toUpperCase() || (type === 'infant' ? 'BAYI' : 'PENUMPANG'),
            nik: nikInput.value || '-',
            dob: dobInput ? dobInput.value : '', 
            type: type 
        });
    });
    
    return paxList;
}

// --- CALCULATE TOTAL FROM PAX ---
window.calcTotalFromPax = function() {
    const adultCount = parseInt(document.getElementById('inpPaxCount').value) || 1;

    const pricePerPax = parseFloat(document.getElementById('inpPricePerPax').value) || 0;
    if (pricePerPax > 0) {
        document.getElementById('inpPrice').value = pricePerPax * adultCount;
    }

    const returnPricePerPax = parseFloat(document.getElementById('inpReturnPricePerPax').value) || 0;
    if (returnPricePerPax > 0) {
        document.getElementById('inpReturnPrice').value = returnPricePerPax * adultCount;
    }

    calcRemaining(); 
}
// --- CALCULATE REMAINING SEPARATED (PERGI & PULANG) ---
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
    fieldReturn.value = formatRupiah(remainingReturn);
    fieldReturn.className = remainingReturn <= 0 
        ? "bg-transparent text-right text-green-500 font-black text-lg outline-none w-40 cursor-default" 
        : "bg-transparent text-right text-red-500 font-black text-lg outline-none w-40 cursor-default";
}

// --- FETCH & REALTIME ---
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
    
    if (!document.getElementById('page-list').classList.contains('hidden')) {
         renderOrderList(document.getElementById('searchInput').value);
    }
}

function setupRealtime() {
    supabase.channel('public:orders')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, (payload) => {
            fetchOrdersBg(); 
        })
        .subscribe();
}

async function fetchOrdersBg() {
    const { data } = await supabase.from('orders')
        .select('*')
        .order('created_at', { ascending: true }) 
        .limit(50);
        
    if(data) {
        orders = data;
        renderStats();
        if (document.getElementById('searchInput').value === '') {
             renderOrderList('');
        }
        if(currentDetailOrder && !document.getElementById('page-detail').classList.contains('hidden')) {
            const updatedOrder = orders.find(o => o.id === currentDetailOrder.id);
            if(updatedOrder) openDetailView(updatedOrder.id);
        }
    }
}
// --- LOGIC UPLOAD & STORAGE ---
async function uploadToSupabaseStorage(base64Data, fileName) {
    if (!base64Data || base64Data.startsWith('http')) return base64Data; 

    try {
        const res = await fetch(base64Data);
        const blob = await res.blob();
        const cleanFileName = fileName.replace(/[^a-zA-Z0-9]/g, '_'); 
        const filePath = `uploads/${cleanFileName}.jpg`;

        const { data, error } = await supabase.storage
            .from('davka-files')
            .upload(filePath, blob, { contentType: 'image/jpeg', upsert: true });

        if (error) throw error;

        const { data: publicData } = supabase.storage
            .from('davka-files')
            .getPublicUrl(filePath);

        return publicData.publicUrl;
    } catch (err) {
        console.error("Upload Error:", err);
        return null; 
    }
}

// --- FORM HANDLING (SAVE & UPDATE) ---
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

        // SANITASI TANGGAL
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
            status: existingOrder ? existingOrder.status : 'pending'
        };

        const { error } = existingOrder 
            ? await supabase.from('orders').update(newOrder).eq('id', orderId)
            : await supabase.from('orders').insert([newOrder]);

        if(error) throw error;

        if (existingOrder) {
            orders[editIndex] = newOrder;
        } else {
            orders.push(newOrder); 
        }
        
        renderStats();
        document.getElementById('searchInput').value = ''; 
        renderOrderList(''); 
        
        showToast("Data Tersimpan!");
        resetForm();

    } catch (err) {
        console.error("Save Failed:", err);
        alert(`Gagal simpan ke server: ${err.message || "Cek koneksi internet Anda"}. Data belum dihapus dari form.`);
    } finally {
        toggleLoader(false); 
    }
});

window.deleteOrder = async function(id) {
    if(confirm("Hapus pesanan ini Permanen?")) {
        toggleLoader(true);
        orders = orders.filter(o => o.id !== id);
        
        const isDetailOpen = !document.getElementById('page-detail').classList.contains('hidden');
        if(isDetailOpen) closeDetailView();
        
        renderOrderList(document.getElementById('searchInput').value);
        renderStats();
        showToast("Dihapus dari layar...");

        try {
            await supabase.from('orders').delete().eq('id', id);
            showToast("Terhapus dari server.");
        } catch (err) {
            console.error(err);
            alert("Gagal hapus server.");
        } finally {
            toggleLoader(false);
        }
    }
}

window.toggleStatus = async function(id) {
    const index = orders.findIndex(o => o.id === id);
    if(index === -1) return;

    const current = orders[index].status;
    const next = current === 'pending' ? 'success' : (current === 'success' ? 'cancel' : 'pending');
    
    orders[index].status = next;
    
    renderOrderList(document.getElementById('searchInput').value);
    
    const isDetailOpen = !document.getElementById('page-detail').classList.contains('hidden');
    if(isDetailOpen) openDetailView(id);

    renderStats();

    try {
        await supabase.from('orders').update({ status: next }).eq('id', id);
    } catch(e) {
        console.error(e);
    }
}

window.navTo = function(pageId) {
    const currentPages = document.querySelectorAll('main > section:not(.hidden)');
    currentPages.forEach(page => { page.classList.add('fade-out'); page.classList.remove('fade-in'); });

    setTimeout(() => {
        document.querySelectorAll('main > section').forEach(el => {
            el.classList.add('hidden'); el.classList.remove('fade-out');
        });
        const target = document.getElementById(`page-${pageId}`);
        target.classList.remove('hidden'); target.classList.add('fade-in');

        document.querySelectorAll('nav button').forEach(el => el.classList.remove('active-nav'));
        if(pageId === 'dashboard') document.getElementById('nav-dashboard').classList.add('active-nav');
        if(pageId === 'list') {
            document.getElementById('nav-list').classList.add('active-nav');
            renderOrderList(document.getElementById('searchInput').value); 
        }
        if(pageId === 'input' && document.getElementById('editIndex').value === "-1") resetForm();
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
    
    let paxList = [];
    if (Array.isArray(data.passengers)) {
        paxList = data.passengers;
    } else if (data.name) {
        paxList = [{name: data.name, nik: data.nik || '-', dob: '', type: 'adult'}];
    }
    
    const adults = paxList.filter(p => !p.type || p.type === 'adult'); 
    const infants = paxList.filter(p => p.type === 'infant');

    document.getElementById('inpPaxCount').value = adults.length || 1;
    document.getElementById('inpInfantCount').value = infants.length || 0;
    
    updatePassengerForms(); 
    
    setTimeout(() => {
        const itemWrappers = document.querySelectorAll('.passenger-item');
        let adultIdx = 0;
        let infantIdx = 0;

        itemWrappers.forEach(el => {
            const type = el.getAttribute('data-type');
            const nameInput = el.querySelector('.pax-name');
            const nikInput = el.querySelector('.pax-nik');
            const dobInput = el.querySelector('.pax-dob');

            if (type === 'adult' && adults[adultIdx]) {
                nameInput.value = adults[adultIdx].name;
                nikInput.value = adults[adultIdx].nik;
                if(dobInput) dobInput.value = adults[adultIdx].dob || '';
                adultIdx++;
            } else if (type === 'infant' && infants[infantIdx]) {
                nameInput.value = infants[infantIdx].name;
                nikInput.value = infants[infantIdx].nik;
                if(dobInput) dobInput.value = infants[infantIdx].dob || '';
                infantIdx++;
            }
        });
    }, 50);

    document.getElementById('inpOrigin').value = data.origin || '';
    document.getElementById('inpDest').value = data.dest || '';
    document.getElementById('inpDate').value = data.date || '';
    document.getElementById('inpWarDate').value = data.warDate || ''; 
    document.getElementById('inpTrain').value = data.train || '';
    document.getElementById('inpTripType').value = data.tripType || 'one_way';
    
    toggleTripType();
    
    if(data.tripType === 'round_trip') {
        document.getElementById('inpReturnOrigin').value = data.returnOrigin || '';
        document.getElementById('inpReturnDest').value = data.returnDest || '';
        document.getElementById('inpReturnDate').value = data.returnDate || '';
        document.getElementById('inpReturnWarDate').value = data.returnWarDate || '';
        document.getElementById('inpReturnTrain').value = data.returnTrain || '';
    }
    
    document.getElementById('inpPaymentMethod').value = data.paymentMethod || 'Tunai';
    document.getElementById('inpPaymentMethodReturn').value = data.paymentMethodReturn || 'Tunai';
    
    const adultCount = adults.length || 1;
    
    const priceDepart = data.price || 0;
    document.getElementById('inpPrice').value = priceDepart;
    document.getElementById('inpPricePerPax').value = priceDepart > 0 ? Math.round(priceDepart / adultCount) : 0;
    
    const feeDepart = (data.feeDepart !== undefined) ? data.feeDepart : (data.fee || 0);
    document.getElementById('inpFeeDepart').value = feeDepart;
    
    const priceReturn = data.returnPrice || 0;
    document.getElementById('inpReturnPrice').value = priceReturn;
    document.getElementById('inpReturnPricePerPax').value = priceReturn > 0 ? Math.round(priceReturn / adultCount) : 0;
    
    const feeReturn = data.feeReturn || 0;
    document.getElementById('inpFeeReturn').value = feeReturn;

    calcRemaining();

    if(data.transferScreenshot) {
        document.getElementById('inpTransferData').value = data.transferScreenshot;
        document.getElementById('imgTransfer').src = data.transferScreenshot;
        document.getElementById('previewTransfer').classList.remove('hidden');
    }
    if(data.chatScreenshot) {
        document.getElementById('inpChatData').value = data.chatScreenshot;
        document.getElementById('imgChat').src = data.chatScreenshot;
        document.getElementById('previewChat').classList.remove('hidden');
    }
    if(data.transferScreenshotReturn) {
        document.getElementById('inpTransferDataReturn').value = data.transferScreenshotReturn;
        document.getElementById('imgTransferReturn').src = data.transferScreenshotReturn;
        document.getElementById('previewTransferReturn').classList.remove('hidden');
    }
    if(data.chatScreenshotReturn) {
        document.getElementById('inpChatDataReturn').value = data.chatScreenshotReturn;
        document.getElementById('imgChatReturn').src = data.chatScreenshotReturn;
        document.getElementById('previewChatReturn').classList.remove('hidden');
    }

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
        
        renderOrderList(document.getElementById('searchInput').value);
        
        const isDetailOpen = !document.getElementById('page-detail').classList.contains('hidden');
        if(isDetailOpen) openDetailView(id); 

        renderStats(); 
        try {
             await supabase.from('orders').update({ settlementMethod: newVal, status: nextStatus }).eq('id', id);
            showToast("Info Pelunasan Updated");
        } catch(e) { console.error(e); } finally { toggleLoader(false); }
    } else toggleLoader(false);
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
        
        setTimeout(() => { 
            zone.scrollIntoView({ behavior: "smooth", block: "start", inline: "nearest" }); 
        }, 300);
    }
}

function resetUploadZones() {
    activeUploadZone = null;
    document.querySelectorAll('.upload-zone-base').forEach(el => el.classList.remove('upload-zone-active'));
    const h1 = document.getElementById('hintTransfer'); if(h1) h1.classList.add('hidden');
    const h2 = document.getElementById('hintChat'); if(h2) h2.classList.add('hidden');
    const h3 = document.getElementById('hintTransferReturn'); if(h3) h3.classList.add('hidden');
    const h4 = document.getElementById('hintChatReturn'); if(h4) h4.classList.add('hidden');
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
                else if (currentUploadType === 'kai_ticket') updateData.kaiTicketFile = publicUrl;

                await supabase.from('orders').update(updateData).eq('id', currentUploadOrderId);
                
                const idx = orders.findIndex(o => o.id === currentUploadOrderId);
                if(idx !== -1) {
                     if (currentUploadType === 'settlement') orders[idx].settlementProof = publicUrl;
                     else orders[idx].kaiTicketFile = publicUrl;
                     
                     const isDetailOpen = !document.getElementById('page-detail').classList.contains('hidden');
                     if(isDetailOpen) openDetailView(currentUploadOrderId);
                }
                showToast("Tersimpan!");
            } catch(e) { console.error(e); alert("Gagal simpan."); } finally {
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
    
    const inpRetDate = document.getElementById('inpReturnDate');
    const inpRetTrain = document.getElementById('inpReturnTrain');
    const inpRetOrg = document.getElementById('inpReturnOrigin');
    const inpRetDest = document.getElementById('inpReturnDest');

    if(type === 'round_trip') {
        fields.classList.remove('hidden'); fields.classList.add('fade-in');
        uploadTabContainer.classList.remove('hidden');
        payReturnSection.classList.remove('hidden'); 
        
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
        
        switchUploadTab('depart');
        
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

// --- CORE: RENDER NOTA BERDASARKAN TAB AKTIF & DATA LENGKAP ---
function renderReceiptToDOM(order) {
    const sectionDepart = document.getElementById('rec-ticket-depart');
    const sectionReturn = document.getElementById('rec-ticket-return');
    
    const priceTotalEl = document.getElementById('rec-price-total');
    const priceDpEl = document.getElementById('rec-price-dp');
    const priceRemainingEl = document.getElementById('rec-price-remaining');
    
    // Reset Visibility
    sectionDepart.classList.add('hidden');
    sectionReturn.classList.add('hidden');

    // --- SHARED DATA (PENUMPANG) ---
    let paxList = Array.isArray(order.passengers) ? order.passengers : (order.name ? [{name: order.name, nik: order.nik || '-', type: 'adult'}] : []);
    const mainPaxName = paxList.length > 0 ? paxList[0].name : (order.contactName || 'PENUMPANG');
    
    const adults = paxList.filter(p => !p.type || p.type === 'adult').length;
    const infants = paxList.filter(p => p.type === 'infant').length;
    
    let paxCountStr = `${adults} Dewasa`;
    if(infants > 0) paxCountStr += `, ${infants} Bayi`;

    let paxHtml = '';
    paxList.forEach(p => {
        const isInfant = p.type === 'infant';
        const paxTypeLabel = isInfant ? '<span class="text-[8px] bg-white/20 px-1 rounded ml-1 text-pink-300 inline-block align-middle">BAYI</span>' : '';
        
        let dobStr = '';
        if (p.dob) {
            const dObj = new Date(p.dob);
            if(!isNaN(dObj)) {
                dobStr = dObj.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }).toUpperCase();
            }
        }
        
        // PERBAIKAN UX NOTA PENUMPANG: 
        const dobDisplayReceipt = dobStr ? `<span class="block text-[11px] text-davka-orange font-bold mt-1 text-right">TGL LAHIR: ${dobStr}</span>` : '';

        // FIX NIK SIMETRIS: Menggunakan fixed width w-[150px] shrink-0 agar sejajar lurus seperti tabel
        paxHtml += `
            <div class="flex justify-between items-start bg-white/5 p-2.5 rounded mb-1.5 gap-2 border border-white/5">
                <p class="text-[12px] font-bold text-white uppercase break-words flex-1 min-w-0 leading-tight mt-1 pr-2">${p.name} ${paxTypeLabel}</p>
                <div class="w-[150px] shrink-0 flex flex-col items-end">
                    <div class="w-full bg-white/10 px-2 py-1.5 rounded border border-white/10">
                        <p class="text-[11px] text-white font-bold text-center uppercase tracking-wide">ID: ${p.nik || '-'}</p>
                    </div>
                    ${dobDisplayReceipt}
                </div>
            </div>
        `;
    });

    const address = order.address || '-';

    // --- TAMPILKAN BERDASARKAN TAB YANG AKTIF ---
    if (currentDetailTab === 'return' && order.tripType === 'round_trip') {
        // === NOTA PULANG ===
        sectionReturn.classList.remove('hidden');
        
        const retOrg = (order.returnOrigin || order.dest || 'ORG').toUpperCase();
        const retDes = (order.returnDest || order.origin || 'DES').toUpperCase();
        
        document.getElementById('rec-return-origin-code').innerText = retOrg;
        document.getElementById('rec-return-dest-code').innerText = retDes;
        
        document.getElementById('rec-return-train-name').innerText = (order.returnTrain || 'KERETA').toUpperCase();
        
        const retDateObj = new Date(order.returnDate);
        const retDateStr = order.returnDate ? retDateObj.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) : '-';
        document.getElementById('rec-return-date-depart').innerText = retDateStr.toUpperCase();

        const retWarDateObj = new Date(order.returnWarDate);
        const retWarDateStr = order.returnWarDate ? retWarDateObj.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) : '-';
        document.getElementById('rec-return-war-date').innerText = retWarDateStr.toUpperCase();
        
        const stampElReturn = document.getElementById('rec-stamp-return');
        if (order.status === 'success') stampElReturn.classList.add('visible');
        else stampElReturn.classList.remove('visible');

        const returnTotal = order.returnPrice || 0;
        const returnDp = order.feeReturn || 0;
        let returnRemaining = returnTotal - returnDp;
        if(order.status === 'success') returnRemaining = 0;

        priceTotalEl.innerText = formatRupiah(returnTotal);
        priceDpEl.innerText = formatRupiah(returnDp);
        priceRemainingEl.innerText = formatRupiah(returnRemaining);
        priceRemainingEl.className = returnRemaining <= 0 ? "text-[22px] font-black text-green-500" : "text-[22px] font-black text-red-500";

        document.getElementById('rec-id').innerText = "#" + order.id.toString().slice(-6) + "-R";

        document.getElementById('rec-return-contact-name').innerText = (order.contactName || mainPaxName).toUpperCase();
        
        const phoneElReturn = document.getElementById('rec-return-contact-phone');
        phoneElReturn.innerText = order.contactPhone || '-';
        phoneElReturn.className = "text-[12px] font-bold text-white tracking-widest font-mono mt-0.5 mb-2"; 
        
        document.getElementById('rec-return-address').innerText = address.toUpperCase();
        
        document.getElementById('rec-return-payment-method').innerText = (order.paymentMethodReturn || order.paymentMethod || 'TUNAI').toUpperCase();
        document.getElementById('rec-return-pax-count').innerText = paxCountStr;
        document.getElementById('rec-return-pax-list').innerHTML = paxHtml;

    } else {
        // === NOTA PERGI ===
        sectionDepart.classList.remove('hidden');

        const origin = (order.origin || 'ORG').toUpperCase();
        const dest = (order.dest || 'DES').toUpperCase();

        document.getElementById('rec-origin-code').innerText = origin;
        document.getElementById('rec-dest-code').innerText = dest;
        
        document.getElementById('rec-train-name').innerText = (order.train || 'KERETA').toUpperCase();

        const dateObj = new Date(order.date);
        const dateStr = order.date ? dateObj.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) : '-';
        document.getElementById('rec-date-depart').innerText = dateStr.toUpperCase();

        const warDateObj = new Date(order.warDate);
        const warDateStr = order.warDate ? warDateObj.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) : '-';
        document.getElementById('rec-war-date').innerText = warDateStr.toUpperCase();
        
        const stampElDepart = document.getElementById('rec-stamp-depart');
        if (order.status === 'success') stampElDepart.classList.add('visible');
        else stampElDepart.classList.remove('visible');

        const departTotal = order.price || 0;
        const departDp = (order.feeDepart !== undefined) ? order.feeDepart : (order.fee || 0);
        let departRemaining = departTotal - departDp;
        if(order.status === 'success') departRemaining = 0;

        priceTotalEl.innerText = formatRupiah(departTotal);
        priceDpEl.innerText = formatRupiah(departDp);
        priceRemainingEl.innerText = formatRupiah(departRemaining);
        priceRemainingEl.className = departRemaining <= 0 ? "text-[22px] font-black text-green-500" : "text-[22px] font-black text-red-500";

        document.getElementById('rec-id').innerText = "#" + order.id.toString().slice(-6);

        document.getElementById('rec-contact-name').innerText = (order.contactName || mainPaxName).toUpperCase();
        
        const phoneElDepart = document.getElementById('rec-contact-phone');
        phoneElDepart.innerText = order.contactPhone || '-';
        phoneElDepart.className = "text-[12px] font-bold text-white tracking-widest font-mono mt-0.5 mb-2";
        
        document.getElementById('rec-address').innerText = address.toUpperCase();
        
        document.getElementById('rec-payment-method').innerText = (order.paymentMethod || 'TUNAI').toUpperCase();
        document.getElementById('rec-pax-count').innerText = paxCountStr;
        document.getElementById('rec-pax-list').innerHTML = paxHtml;
    }
}
function captureAndShowModal(elementId) {
    const el = document.getElementById(elementId);
    html2canvas(el, { 
        scale: 3, 
        useCORS: true, 
        allowTaint: true, 
        backgroundColor: null,
        windowHeight: el.scrollHeight 
    }) 
    .then(canvas => { 
        showImageModal(canvas.toDataURL("image/jpeg", 0.95), true); 
        toggleLoader(false); 
    })
    .catch(err => { 
        console.error("Render Error:", err); 
        toggleLoader(false); 
        alert("Gagal render gambar."); 
    });
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
    if(type === 'transfer') {
        document.getElementById('inpFileTransfer').value = ''; document.getElementById('inpTransferData').value = '';
        document.getElementById('imgTransfer').src = ''; document.getElementById('previewTransfer').classList.add('hidden');
    } else if (type === 'chat') {
        document.getElementById('inpFileChat').value = ''; document.getElementById('inpChatData').value = '';
        document.getElementById('imgChat').src = ''; document.getElementById('previewChat').classList.add('hidden');
    } else if (type === 'transferReturn') {
        document.getElementById('inpFileTransferReturn').value = ''; document.getElementById('inpTransferDataReturn').value = '';
        document.getElementById('imgTransferReturn').src = ''; document.getElementById('previewTransferReturn').classList.add('hidden');
    } else if (type === 'chatReturn') {
        document.getElementById('inpFileChatReturn').value = ''; document.getElementById('inpChatDataReturn').value = '';
        document.getElementById('imgChatReturn').src = ''; document.getElementById('previewChatReturn').classList.add('hidden');
    }
    resetUploadZones(); 
}

window.searchOrders = function() { renderOrderList(document.getElementById('searchInput').value); }
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
}
window.closeImageModal = function() { document.getElementById('imageModal').classList.add('hidden'); }

window.resetForm = function() {
    document.getElementById('orderForm').reset();
    document.getElementById('editIndex').value = "-1";
    document.getElementById('btnSaveText').innerText = "SIMPAN PESANAN";
    document.getElementById('inpPaxCount').value = "1";
    document.getElementById('inpInfantCount').value = "0"; 
    document.getElementById('inpTripType').value = 'one_way';
    
    document.getElementById('inpPricePerPax').value = '';
    if(document.getElementById('inpReturnPricePerPax')) document.getElementById('inpReturnPricePerPax').value = '';
    
    document.getElementById('inpRemainingDepart').value = 'Rp 0';
    if(document.getElementById('inpRemainingReturn')) document.getElementById('inpRemainingReturn').value = 'Rp 0';
    
    document.getElementById('inpPaymentMethod').value = 'Tunai';
    if(document.getElementById('inpPaymentMethodReturn')) document.getElementById('inpPaymentMethodReturn').value = 'Tunai';

    toggleTripType(); 
    clearImage('transfer'); clearImage('chat');
    clearImage('transferReturn'); clearImage('chatReturn');
    
    updatePassengerForms(); 
    calcRemaining();
    resetUploadZones();
    enableSmoothInputUX();
}
window.openDetailView = function(orderId) {
    const order = orders.find(o => o.id === orderId);
    if (!order) return;

    currentDetailOrder = order;

    document.getElementById('page-list').classList.add('hidden', 'fade-out');
    document.getElementById('page-detail').classList.remove('hidden');
    document.getElementById('page-detail').classList.add('fade-in');
    
    window.scrollTo({ top: 0, behavior: 'smooth' });

    const displayName = (order.contactName || order.name || 'No Name').toUpperCase();
    document.getElementById('detail-contact-name').innerText = displayName;
    document.getElementById('detail-id').innerText = "#" + order.id.toString().slice(-6);
    
    const badge = document.getElementById('detail-status-badge');
    badge.className = "px-3 py-1 rounded-full text-[10px] font-bold uppercase border ";
    if (order.status === 'success') {
        badge.innerText = "LUNAS";
        badge.classList.add('bg-green-500/10', 'border-green-500/30', 'text-green-400');
    } else if (order.status === 'cancel') {
        badge.innerText = "BATAL";
        badge.classList.add('bg-red-500/10', 'border-red-500/30', 'text-red-400');
    } else {
        badge.innerText = "PENDING";
        badge.classList.add('bg-orange-500/10', 'border-orange-500/30', 'text-orange-400');
    }

    document.getElementById('detail-train').innerText = order.train || '-';
    document.getElementById('detail-date').innerText = order.date ? new Date(order.date).toLocaleDateString('id-ID', {day: 'numeric', month: 'short', year: 'numeric'}) : '-';
    document.getElementById('detail-war-date').innerText = order.warDate ? new Date(order.warDate).toLocaleDateString('id-ID', {day: 'numeric', month: 'short'}) : '-';
    
    const renderProof = (url, label) => url ? 
        `<img src="${url}" class="w-full h-full object-cover rounded-lg cursor-pointer hover:opacity-80 transition-opacity" onclick="showImageModal(this.src, true)">` : 
        `<div class="text-gray-600 text-[9px] text-center flex flex-col items-center justify-center h-full"><i class="fas fa-times-circle text-xs mb-1"></i>${label}</div>`;

    document.getElementById('detail-img-transfer-depart').innerHTML = renderProof(order.transferScreenshot, "No TF Pergi");
    document.getElementById('detail-img-chat-depart').innerHTML = renderProof(order.chatScreenshot, "No Chat Pergi");

    const returnBadge = document.getElementById('badge-return-active');
    const returnDataContainer = document.getElementById('data-return-exist');
    const returnEmptyContainer = document.getElementById('data-return-empty');
    const containerProofReturn = document.getElementById('container-proof-return');

    if (order.tripType === 'round_trip') {
        returnBadge.classList.remove('hidden');
        returnDataContainer.classList.remove('hidden');
        returnEmptyContainer.classList.add('hidden');
        containerProofReturn.classList.remove('hidden');

        document.getElementById('detail-return-train').innerText = order.returnTrain || '-';
        document.getElementById('detail-return-date').innerText = order.returnDate ? new Date(order.returnDate).toLocaleDateString('id-ID', {day: 'numeric', month: 'short', year: 'numeric'}) : '-';
        document.getElementById('detail-return-war-date').innerText = order.returnWarDate ? new Date(order.returnWarDate).toLocaleDateString('id-ID', {day: 'numeric', month: 'short'}) : '-';
        
        document.getElementById('detail-img-transfer-return').innerHTML = renderProof(order.transferScreenshotReturn, "No TF Pulang");
        document.getElementById('detail-img-chat-return').innerHTML = renderProof(order.chatScreenshotReturn, "No Chat Pulang");

    } else {
        returnBadge.classList.add('hidden');
        returnDataContainer.classList.add('hidden');
        returnEmptyContainer.classList.remove('hidden');
        containerProofReturn.classList.add('hidden');
    }

    let paxListHtml = '';
    let paxArray = Array.isArray(order.passengers) ? order.passengers : (order.name ? [{name: order.name, nik: order.nik || '-', dob: '', type: 'adult'}] : []);
    
    paxArray.forEach((p, idx) => {
        const isInfant = p.type === 'infant';
        const iconColor = isInfant ? 'text-pink-400 bg-pink-500/10' : 'text-gray-300 bg-white/10';
        const icon = isInfant ? 'fa-baby' : 'fa-user';
        const label = isInfant ? '<span class="text-[8px] ml-2 px-1.5 py-0.5 rounded bg-pink-500/20 text-pink-400 border border-pink-500/30">BAYI</span>' : '';
        
        // UX FIX 1: Warna Tanggal Lahir diselaraskan (gray-300)
        let dobBadge = '';
        if (p.dob) {
            const d = new Date(p.dob);
            const dobFormat = !isNaN(d) ? d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }).toUpperCase() : p.dob;
            dobBadge = `<span class="flex items-center gap-1 text-gray-300 text-xs font-bold whitespace-nowrap"><i class="fas fa-calendar-alt opacity-70"></i> ${dobFormat}</span>`;
        }

        // UX FIX 2 & 3: Hapus class 'font-mono' pada NIK & ubah container NIK + Tgl Lahir jadi flex-col (bertumpuk)
        paxListHtml += `
            <div class="flex items-start gap-3 border-b border-white/5 pb-3 pt-1 last:border-0 last:pb-0">
                <div class="w-6 h-6 rounded-full ${iconColor} flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">
                    <i class="fas ${icon}"></i>
                </div>
                <div class="flex-1 min-w-0">
                    <p class="text-xs font-bold text-white uppercase flex flex-wrap items-center gap-1">${p.name} ${label}</p>
                    <div class="flex flex-col gap-1 mt-1.5">
                        <p class="text-xs text-gray-300 font-bold whitespace-nowrap">NIK: ${p.nik}</p>
                        ${dobBadge}
                    </div>
                </div>
            </div>
        `;
    });
    document.getElementById('detail-pax-list').innerHTML = paxListHtml;

    document.getElementById('detail-cost-breakdown').innerHTML = '';
    
    switchTab('depart');

    const settlementOptions = ["-", "Tunai", "Transfer CIMB Niaga", "Transfer Seabank", "Dana", "Gopay", "Ovo", "ShopeePay"];
    const selectEl = document.getElementById('detail-settlement-select');
    selectEl.innerHTML = settlementOptions.map(opt => `<option value="${opt}" ${order.settlementMethod === opt ? 'selected' : ''}>${opt === '-' ? 'Belum Lunas' : opt}</option>`).join('');
    selectEl.onchange = function() { updateSettlement(orderId, this.value); };

    document.getElementById('detail-upload-settlement').innerHTML = renderUploadBtnHTML(orderId, 'settlement', order.settlementProof, 'Bukti Lunas');
    document.getElementById('detail-upload-ticket').innerHTML = renderUploadBtnHTML(orderId, 'kai_ticket', order.kaiTicketFile, 'E-Ticket KAI');

    document.getElementById('btn-action-status').onclick = function() { toggleStatus(orderId); };
    document.getElementById('btn-action-edit').onclick = function() { editOrder(orderId); };
    document.getElementById('btn-action-print').onclick = function() { printReceipt(orderId); };
    document.getElementById('btn-action-delete').onclick = function() { deleteOrder(orderId); };
}

window.closeDetailView = function() {
    document.getElementById('page-detail').classList.add('hidden', 'fade-out');
    document.getElementById('page-detail').classList.remove('fade-in');
    document.getElementById('page-list').classList.remove('hidden');
    document.getElementById('page-list').classList.add('fade-in');
    
    currentDetailOrder = null;
    renderOrderList(document.getElementById('searchInput').value);
}

window.renderOrderList = function(filterText = '') {
    const container = document.getElementById('ordersContainer');
    container.innerHTML = '';
    if(!orders) return;
    
    const sortedOrders = [...orders].sort((a, b) => {
        return new Date(a.created_at || a.id) - new Date(b.created_at || b.id);
    });
    
    const filtered = sortedOrders.filter(o => {
        const name = o.contactName || o.name || '';
        return name.toLowerCase().includes(filterText.toLowerCase());
    });

    if(filtered.length === 0) { 
        document.getElementById('emptyState').classList.remove('hidden'); 
        return; 
    } else {
        document.getElementById('emptyState').classList.add('hidden');
    }

    filtered.forEach((order, index) => {
        let statusColorClass = '';
        let indicatorColor = '';
        
        if (order.status === 'success') {
            statusColorClass = 'bg-green-500/10 border-green-500/30 text-green-400';
            indicatorColor = 'bg-green-500';
        } else if (order.status === 'cancel') {
            statusColorClass = 'bg-red-500/10 border-red-500/30 text-red-400';
            indicatorColor = 'bg-red-500';
        } else {
            statusColorClass = 'bg-orange-500/10 border-orange-500/30 text-orange-400';
            indicatorColor = 'bg-orange-500';
        }

        const displayName = (order.contactName || order.name || 'No Name').toUpperCase();
        const displayNo = index + 1; 

        const dateObj = new Date(order.date);
        const dateStr = order.date ? dateObj.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) : '-';
        
        let routeHtml = `
            <div class="mt-1">
                <p class="text-[10px] text-gray-300 font-bold flex items-center">
                    <i class="fas fa-train text-davka-orange mr-1.5 text-[10px]"></i> 
                    ${order.origin || '?'} 
                    <i class="fas fa-chevron-right text-[8px] mx-1 opacity-50"></i> 
                    ${order.dest || '?'}
                </p>
                <p class="text-[10px] text-gray-500 pl-4 font-mono">${dateStr}</p>
            </div>
        `;

        if (order.tripType === 'round_trip') {
            const retDateObj = new Date(order.returnDate);
            const retDateStr = order.returnDate ? retDateObj.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) : '-';
            
            const retOrg = order.returnOrigin || order.dest || '?';
            const retDest = order.returnDest || order.origin || '?';

            routeHtml += `
            <div class="mt-1 pt-1 border-t border-white/5 relative">
                <div class="absolute left-1.5 top-2 w-0.5 h-full bg-blue-500/20"></div>
                <div class="flex justify-between items-start">
                    <div>
                        <p class="text-[10px] text-gray-300 font-bold flex items-center">
                            <i class="fas fa-exchange-alt text-blue-400 mr-1.5 text-[10px]"></i> 
                            ${retOrg} 
                            <i class="fas fa-chevron-right text-[8px] mx-1 opacity-50"></i> 
                            ${retDest}
                        </p>
                        <p class="text-[10px] text-gray-500 pl-4 font-mono">${retDateStr}</p>
                    </div>
                    
                    <div class="px-1.5 py-0.5 rounded bg-black/20 border border-white/5 self-center mt-1">
                        <p class="text-[8px] ${statusColorClass.split(' ')[2]} font-bold uppercase tracking-wide">
                            ${order.status}
                        </p>
                    </div>
                </div>
            </div>`;
        }

        const item = document.createElement('div');
        item.className = `rounded-xl border ${statusColorClass.split(' ')[1]} ${statusColorClass.split(' ')[0]} overflow-hidden mb-2 transition-all duration-300 active:scale-95`;
        item.onclick = function() { openDetailView(order.id); };

        const mainRow = `
        <div class="flex items-start justify-between p-3 cursor-pointer select-none relative">
            <div class="absolute left-0 top-0 bottom-0 w-1 ${indicatorColor}"></div>
            
            <div class="flex items-start gap-3 pl-2 overflow-hidden flex-1">
                <div class="w-7 h-7 rounded-lg bg-black/20 flex items-center justify-center font-mono text-xs font-bold ${statusColorClass.split(' ')[2]} shrink-0 border border-white/5 mt-0.5">
                    ${displayNo}
                </div>
                
                <div class="min-w-0 flex-1">
                    <div class="flex justify-between items-start">
                        <h4 class="text-sm font-bold text-white truncate leading-tight">${displayName}</h4>
                        <div class="px-2 py-0.5 rounded border border-white/10 bg-black/20">
                            <p class="text-[9px] ${statusColorClass.split(' ')[2]} font-bold uppercase tracking-wide">
                                ${order.status}
                            </p>
                        </div>
                    </div>
                    
                    ${routeHtml}
                </div>
            </div>
            
            <div class="pl-2 flex items-center self-center">
                <i class="fas fa-chevron-right text-white/30 text-xs"></i>
            </div>
        </div>`;

        item.innerHTML = mainRow;
        container.appendChild(item);
    });
}

function renderStats() {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    let ticketCountMonth = 0; 
    let revenueMonth = 0;     
    let p=0, s=0, c=0; 
    
    if(orders) {
        orders.forEach(o => {
            if(o.status==='pending') p++; 
            else if(o.status==='success') s++; 
            else c++;

            let createdDate = o.created_at ? new Date(o.created_at) : new Date(o.id);
            const isCurrentMonth = createdDate.getMonth() === currentMonth && createdDate.getFullYear() === currentYear;

            if(o.status === 'success' && isCurrentMonth) {
                let paxCount = 1; 
                if(Array.isArray(o.passengers)) {
                    const adultsOnly = o.passengers.filter(pass => !pass.type || pass.type === 'adult');
                    paxCount = adultsOnly.length;
                } else if(o.name) {
                    paxCount = 1; 
                }
                ticketCountMonth += paxCount;
                
                const totalOrderPrice = (parseFloat(o.price) || 0) + (parseFloat(o.returnPrice) || 0);
                revenueMonth += totalOrderPrice;
            }
        });
    }

    document.getElementById('stat-today').innerText = ticketCountMonth;
    document.getElementById('stat-revenue').innerText = formatRupiah(revenueMonth);
    document.getElementById('stat-pending').innerText = p;
    document.getElementById('stat-success').innerText = s;
    document.getElementById('stat-cancel').innerText = c;
}
