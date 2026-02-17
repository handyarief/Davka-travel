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

// --- NEW FEATURE: TAB SYSTEM LOGIC (PERGI / PULANG) ---
window.switchTab = function(tabName) {
    const btnDepart = document.getElementById('tab-btn-depart');
    const btnReturn = document.getElementById('tab-btn-return');
    const contentDepart = document.getElementById('tab-content-depart');
    const contentReturn = document.getElementById('tab-content-return');

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
    } else {
        btnReturn.className = activeClass;
        contentReturn.classList.remove('hidden');
    }
}

// --- NEW FEATURE: UPLOAD TAB SYSTEM (INPUT FORM) ---
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
// --- UPDATE LOGIC PENUMPANG (DEWASA & BAYI) ---
window.updatePassengerForms = function() {
    const adultCount = parseInt(document.getElementById('inpPaxCount').value) || 1;
    const infantCount = parseInt(document.getElementById('inpInfantCount').value) || 0;
    const container = document.getElementById('passengerForms'); 
    
    // Simpan data lama agar tidak hilang saat resize (Termasuk DOB)
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

    // Render Input Dewasa
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
                    <input type="text" onfocus="(this.type='date')" onblur="(this.type='text')" value="${valDob}" class="pax-dob w-full bg-davka-bg border border-davka-border rounded-lg p-2 text-sm text-white focus:border-davka-orange focus:outline-none placeholder-gray-600" placeholder="Tgl Lahir">
                </div>
            </div>
        </div>`;
    }

    // Render Input Bayi
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
                    <input type="text" onfocus="(this.type='date')" onblur="(this.type='text')" value="${valDob}" class="pax-dob w-full bg-davka-bg border border-davka-border rounded-lg p-2 text-sm text-white focus:border-pink-500 focus:outline-none placeholder-gray-600" placeholder="Tgl Lahir">
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

// --- FORM HANDLING (SAVE & UPDATE) - MODIFIED FOR SEPARATE PP ---
const orderForm = document.getElementById('orderForm');

orderForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    toggleLoader(true); 
    
    const editIndex = parseInt(document.getElementById('editIndex').value);
    const existingOrder = editIndex !== -1 ? orders[editIndex] : null;
    
    const orderId = existingOrder ? existingOrder.id : Date.now();
    const created_at = existingOrder ? existingOrder.created_at : new Date().toISOString();

    // Data Upload Pergi
    let transferBase64 = document.getElementById('inpTransferData').value;
    let chatBase64 = document.getElementById('inpChatData').value;
    
    // Data Upload Pulang (New)
    let transferReturnBase64 = document.getElementById('inpTransferDataReturn').value;
    let chatReturnBase64 = document.getElementById('inpChatDataReturn').value;

    try {
        let transferUrl = existingOrder ? existingOrder.transferScreenshot : null;
        let chatUrl = existingOrder ? existingOrder.chatScreenshot : null;
        
        let transferReturnUrl = existingOrder ? existingOrder.transferScreenshotReturn : null;
        let chatReturnUrl = existingOrder ? existingOrder.chatScreenshotReturn : null;

        // Upload Logic Pergi
        if (transferBase64 && !transferBase64.startsWith('http')) {
            showToast("Upload Transfer Pergi...");
            transferUrl = await uploadToSupabaseStorage(transferBase64, `${orderId}_tf_depart`);
        }
        if (chatBase64 && !chatBase64.startsWith('http')) {
            showToast("Upload Chat Pergi...");
            chatUrl = await uploadToSupabaseStorage(chatBase64, `${orderId}_chat_depart`);
        }
        
        // Upload Logic Pulang (New)
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

        // UPDATED: Save Logic untuk memisahkan harga
        const newOrder = {
            id: orderId, 
            created_at: created_at,
            contactName: document.getElementById('inpContactName').value.toUpperCase(),
            contactPhone: document.getElementById('inpContactPhone').value,
            address: document.getElementById('inpAddress').value.toUpperCase(),
            passengers: passengerData, 
            origin: document.getElementById('inpOrigin').value.toUpperCase(),
            dest: document.getElementById('inpDest').value.toUpperCase(),
            date: document.getElementById('inpDate').value,
            warDate: document.getElementById('inpWarDate').value,
            train: document.getElementById('inpTrain').value.toUpperCase(),
            tripType: tripType,
            
            // Return Fields
            returnOrigin: document.getElementById('inpReturnOrigin').value.toUpperCase(),
            returnDest: document.getElementById('inpReturnDest').value.toUpperCase(),
            returnDate: document.getElementById('inpReturnDate').value,
            returnWarDate: document.getElementById('inpReturnWarDate').value,
            returnTrain: document.getElementById('inpReturnTrain').value.toUpperCase(),
            
            paymentMethod: document.getElementById('inpPaymentMethod').value,
            
            // Financials (UPDATED)
            price: parseFloat(document.getElementById('inpPrice').value) || 0, // Harga Pergi
            returnPrice: parseFloat(document.getElementById('inpReturnPrice').value) || 0, // Harga Pulang (Sekarang tersimpan)
            fee: parseFloat(document.getElementById('inpFee').value) || 0, // DP
            
            settlementMethod: existingOrder ? (existingOrder.settlementMethod || '-') : '-',
            
            // Proof Files Pergi
            transferScreenshot: transferUrl, 
            chatScreenshot: chatUrl,
            
            // Proof Files Pulang (New)
            transferScreenshotReturn: transferReturnUrl,
            chatScreenshotReturn: chatReturnUrl,

            settlementProof: existingOrder ? existingOrder.settlementProof : null,
            kaiTicketFile: existingOrder ? existingOrder.kaiTicketFile : null,
            status: existingOrder ? existingOrder.status : 'pending'
        };

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

        const { error } = existingOrder 
            ? await supabase.from('orders').update(newOrder).eq('id', orderId)
            : await supabase.from('orders').insert([newOrder]);

        if(error) throw error;

    } catch (err) {
        console.error("Save Failed:", err);
        alert("Gagal simpan ke server, tapi data lokal aman sementara. Cek koneksi!");
    } finally {
        toggleLoader(false); 
    }
});
// --- UI ACTIONS & NAVIGATION ---

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
// --- EDIT ORDER LOGIC (UPDATED FOR PP SPLIT) ---
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
    
    // Financials Calculation for Edit Mode (PISAH LOGIC)
    const adultCount = adults.length || 1;
    
    // Pergi
    document.getElementById('inpPrice').value = data.price || 0;
    const pricePerPax = data.price > 0 ? (data.price / adultCount) : 0;
    document.getElementById('inpPricePerPax').value = Math.round(pricePerPax); 
    
    // Pulang (New)
    document.getElementById('inpReturnPrice').value = data.returnPrice || 0;
    const returnPricePerPax = (data.returnPrice > 0) ? (data.returnPrice / adultCount) : 0;
    document.getElementById('inpReturnPricePerPax').value = Math.round(returnPricePerPax);

    document.getElementById('inpFee').value = data.fee || 0;
    calcRemaining();

    // Load Bukti Pergi
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
    
    // Load Bukti Pulang (New)
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
    // Reset hints pergi
    const h1 = document.getElementById('hintTransfer'); if(h1) h1.classList.add('hidden');
    const h2 = document.getElementById('hintChat'); if(h2) h2.classList.add('hidden');
    // Reset hints pulang
    const h3 = document.getElementById('hintTransferReturn'); if(h3) h3.classList.add('hidden');
    const h4 = document.getElementById('hintChatReturn'); if(h4) h4.classList.add('hidden');
}

function setupImageUploader(inputId, hiddenDataId, imgId, containerId) {
    const fileInput = document.getElementById(inputId);
    if(!fileInput) return; // Guard clause
    
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

// --- UPDATED: TOGGLE TRIP TYPE (Handling Payment Section) ---
window.toggleTripType = function() {
    const type = document.getElementById('inpTripType').value;
    const fields = document.getElementById('returnTripFields');
    const uploadTabContainer = document.getElementById('uploadTabContainer');
    const payReturnSection = document.getElementById('paymentReturnSection'); // Section Pembayaran Pulang
    
    // Elements for Validation
    const inpRetDate = document.getElementById('inpReturnDate');
    const inpRetTrain = document.getElementById('inpReturnTrain');
    const inpRetOrg = document.getElementById('inpReturnOrigin');
    const inpRetDest = document.getElementById('inpReturnDest');

    if(type === 'round_trip') {
        fields.classList.remove('hidden'); fields.classList.add('fade-in');
        uploadTabContainer.classList.remove('hidden');
        payReturnSection.classList.remove('hidden'); // Show Payment Pulang
        
        inpRetDate.required = true;
        inpRetTrain.required = true;
        if(inpRetOrg) inpRetOrg.required = true;
        if(inpRetDest) inpRetDest.required = true;
        
        // Label update
        document.getElementById('lblUploadDepart').classList.remove('hidden');
        document.getElementById('labelTransfer').innerText = "Bukti Transfer (Pergi)";
        document.getElementById('labelChat').innerText = "Chat WA (Pergi)";
        
    } else {
        fields.classList.add('hidden'); fields.classList.remove('fade-in');
        uploadTabContainer.classList.add('hidden'); 
        payReturnSection.classList.add('hidden'); // Hide Payment Pulang
        
        // Reset view to Depart tab just in case
        switchUploadTab('depart');
        
        inpRetDate.required = false;
        inpRetTrain.required = false;
        if(inpRetOrg) inpRetOrg.required = false;
        if(inpRetDest) inpRetDest.required = false;

        // Reset values pulang jika switch ke one way
        document.getElementById('inpReturnPricePerPax').value = '';
        document.getElementById('inpReturnPrice').value = '';
        calcRemaining();

        // Label reset
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

// --- UPDATED: CALCULATE TOTAL FROM PAX (SEPARATED) ---
window.calcTotalFromPax = function() {
    const adultCount = parseInt(document.getElementById('inpPaxCount').value) || 1;

    // Kalkulasi Harga Pergi
    const pricePerPax = parseFloat(document.getElementById('inpPricePerPax').value) || 0;
    if (pricePerPax > 0) {
        document.getElementById('inpPrice').value = pricePerPax * adultCount;
    }

    // Kalkulasi Harga Pulang
    const returnPricePerPax = parseFloat(document.getElementById('inpReturnPricePerPax').value) || 0;
    if (returnPricePerPax > 0) {
        document.getElementById('inpReturnPrice').value = returnPricePerPax * adultCount;
    }

    calcRemaining(); 
}

// --- UPDATED: CALCULATE REMAINING (TOTAL = PERGI + PULANG) ---
window.calcRemaining = function() {
    const priceDepart = parseFloat(document.getElementById('inpPrice').value) || 0;
    const priceReturn = parseFloat(document.getElementById('inpReturnPrice').value) || 0;
    const dp = parseFloat(document.getElementById('inpFee').value) || 0;
    
    const total = priceDepart + priceReturn;
    const remaining = total - dp;
    
    const field = document.getElementById('inpRemaining');
    field.value = formatRupiah(remaining);
    field.className = remaining <= 0 ? "bg-transparent text-right text-green-500 font-black text-lg outline-none w-40 cursor-default" : "bg-transparent text-right text-red-500 font-black text-lg outline-none w-40 cursor-default";
}
window.generateAndPreviewTicket = function() {
    const contactName = document.getElementById('inpContactName').value.toUpperCase();
    if(!contactName) { alert("Isi nama kontak!"); return; }
    toggleLoader(true);
}

// === NEW FEATURE: MODERN BOARDING PASS RECEIPT ===
window.printReceipt = function(orderId) {
    const order = orders.find(o => o.id === orderId);
    if (!order) return;
    toggleLoader(true);
    
    renderReceiptToDOM(order);
    
    showToast("RENDER E-TICKET...");
    setTimeout(() => { captureAndShowModal('receipt-render-area'); }, 800);
}

function renderReceiptToDOM(order) {
    const stampElDepart = document.getElementById('rec-stamp-depart');
    const stampElReturn = document.getElementById('rec-stamp-return');
    
    const isPaid = order.status === 'success';
    
    if (isPaid) {
        stampElDepart.classList.add('visible');
        if(stampElReturn) stampElReturn.classList.add('visible');
    } else {
        stampElDepart.classList.remove('visible');
        if(stampElReturn) stampElReturn.classList.remove('visible');
    }

    const origin = (order.origin || 'ORG').toUpperCase();
    const dest = (order.dest || 'DES').toUpperCase();
    
    document.getElementById('rec-origin-code').innerText = origin;
    document.getElementById('rec-dest-code').innerText = dest;
    document.getElementById('rec-train-name').innerText = (order.train || 'TRAIN').toUpperCase();

    const dateObj = new Date(order.date);
    const dateStr = order.date ? dateObj.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '-';
    document.getElementById('rec-date-depart').innerText = dateStr.toUpperCase();

    const returnSection = document.getElementById('rec-ticket-return');
    if (order.tripType === 'round_trip') {
        returnSection.classList.remove('hidden');
        
        const retOrg = (order.returnOrigin || dest).toUpperCase();
        const retDes = (order.returnDest || origin).toUpperCase();
        
        document.getElementById('rec-return-origin-code').innerText = retOrg;
        document.getElementById('rec-return-dest-code').innerText = retDes;
        document.getElementById('rec-return-train-name').innerText = (order.returnTrain || 'TRAIN').toUpperCase();
        
        const retDateObj = new Date(order.returnDate);
        const retDateStr = order.returnDate ? retDateObj.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '-';
        document.getElementById('rec-return-date-depart').innerText = retDateStr.toUpperCase();
    } else {
        returnSection.classList.add('hidden');
    }

    let paxList = Array.isArray(order.passengers) ? order.passengers : (order.name ? [{name: order.name, type: 'adult'}] : []);
    const mainPaxName = paxList.length > 0 ? paxList[0].name : (order.contactName || 'PASSENGER');
    document.getElementById('rec-pax-name').innerText = mainPaxName.toUpperCase();

    const adults = paxList.filter(p => !p.type || p.type === 'adult').length;
    const infants = paxList.filter(p => p.type === 'infant').length;
    let paxCountStr = `${adults} Adult`;
    if(adults > 1) paxCountStr += 's';
    if(infants > 0) paxCountStr += `, ${infants} Infant`;
    
    document.getElementById('rec-pax-count').innerText = paxCountStr;

    document.getElementById('rec-id').innerText = "#" + order.id.toString().slice(-6);
    
    // Total includes return price
    const total = (order.price || 0) + (order.returnPrice || 0);
    document.getElementById('rec-price-total').innerText = formatRupiah(total);
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
    
    // Reset Price fields
    document.getElementById('inpPricePerPax').value = '';
    if(document.getElementById('inpReturnPricePerPax')) document.getElementById('inpReturnPricePerPax').value = '';
    
    toggleTripType(); 
    
    // Clear images pergi
    clearImage('transfer'); clearImage('chat');
    // Clear images pulang
    clearImage('transferReturn'); clearImage('chatReturn');
    
    updatePassengerForms(); 
    calcRemaining();
    resetUploadZones();
    enableSmoothInputUX();
}

window.openDetailView = function(orderId) {
    const order = orders.find(o => o.id === orderId);
    if (!order) return;

    document.getElementById('page-list').classList.add('hidden', 'fade-out');
    document.getElementById('page-detail').classList.remove('hidden');
    document.getElementById('page-detail').classList.add('fade-in');
    
    window.scrollTo({ top: 0, behavior: 'smooth' });

    switchTab('depart');

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

    document.getElementById('detail-origin').innerText = order.origin || 'ORG';
    document.getElementById('detail-dest').innerText = order.dest || 'DST';
    
    const iconEl = document.getElementById('detail-route-icon');
    if (order.tripType === 'round_trip') {
        iconEl.className = "fas fa-exchange-alt text-blue-400 text-xl";
    } else {
        iconEl.className = "fas fa-arrow-right text-davka-orange text-xl";
    }

    // Detail Pergi
    document.getElementById('detail-train').innerText = order.train || '-';
    document.getElementById('detail-date').innerText = order.date ? new Date(order.date).toLocaleDateString('id-ID', {day: 'numeric', month: 'short', year: 'numeric'}) : '-';
    document.getElementById('detail-war-date').innerText = order.warDate ? new Date(order.warDate).toLocaleDateString('id-ID', {day: 'numeric', month: 'short'}) : '-';
    
    // Render Bukti Pergi (Static Display)
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

        const retOrg = order.returnOrigin || order.dest || 'ORG';
        const retDes = order.returnDest || order.origin || 'DES';
        document.getElementById('detail-return-origin').innerText = retOrg;
        document.getElementById('detail-return-dest').innerText = retDes;

        document.getElementById('detail-return-train').innerText = order.returnTrain || '-';
        document.getElementById('detail-return-date').innerText = order.returnDate ? new Date(order.returnDate).toLocaleDateString('id-ID', {day: 'numeric', month: 'short', year: 'numeric'}) : '-';
        document.getElementById('detail-return-war-date').innerText = order.returnWarDate ? new Date(order.returnWarDate).toLocaleDateString('id-ID', {day: 'numeric', month: 'short'}) : '-';
        
        // Render Bukti Pulang
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
        const dobDisplay = p.dob ? `<span class="ml-2 text-davka-orange">| LHR: ${p.dob}</span>` : '';

        paxListHtml += `
            <div class="flex items-center gap-3 border-b border-white/5 pb-2 last:border-0 last:pb-0">
                <div class="w-6 h-6 rounded-full ${iconColor} flex items-center justify-center text-[10px] font-bold shrink-0">
                    <i class="fas ${icon}"></i>
                </div>
                <div>
                    <p class="text-xs font-bold text-white uppercase flex items-center">${p.name} ${label}</p>
                    <p class="text-[9px] text-gray-500 font-mono">NIK: ${p.nik} ${dobDisplay}</p>
                </div>
            </div>
        `;
    });
    document.getElementById('detail-pax-list').innerHTML = paxListHtml;

    // --- REVISI TOTAL: PEMISAHAN HARGA DI DETAIL VIEW ---
    // Logic: Menampilkan dua blok terpisah (Card Pergi & Card Pulang)
    
    const pDepart = order.price || 0;
    const pReturn = order.returnPrice || 0;
    const dp = order.fee || 0;
    const total = pDepart + pReturn;
    const remaining = total - dp;
    
    let costHTML = '';

    // CARD 1: BIAYA PERGI
    costHTML += `
    <div class="bg-davka-bg border border-white/10 rounded-xl p-3 mb-2">
        <div class="flex items-center gap-2 mb-2 border-b border-white/5 pb-2">
            <i class="fas fa-train text-davka-orange text-xs"></i>
            <span class="text-[10px] font-bold text-gray-300 uppercase">Biaya Pergi</span>
        </div>
        <div class="flex justify-between items-center">
             <span class="text-[10px] text-gray-500">Harga Tiket</span>
             <span class="text-xs font-bold text-white">${formatRupiah(pDepart)}</span>
        </div>
    </div>
    `;

    // CARD 2: BIAYA PULANG (JIKA ADA)
    if(order.tripType === 'round_trip') {
        costHTML += `
        <div class="bg-davka-bg border border-blue-500/30 rounded-xl p-3 mb-2">
            <div class="flex items-center gap-2 mb-2 border-b border-blue-500/20 pb-2">
                <i class="fas fa-exchange-alt text-blue-400 text-xs"></i>
                <span class="text-[10px] font-bold text-gray-300 uppercase">Biaya Pulang</span>
            </div>
            <div class="flex justify-between items-center">
                 <span class="text-[10px] text-gray-500">Harga Tiket</span>
                 <span class="text-xs font-bold text-white">${formatRupiah(pReturn)}</span>
            </div>
        </div>
        `;
    }

    // CARD 3: PEMBAYARAN & SISA
    costHTML += `
    <div class="bg-davka-bg border border-white/10 rounded-xl p-3 mt-1">
        <div class="flex justify-between items-center mb-1">
             <span class="text-[10px] text-gray-500 uppercase font-bold">Total DP (Bayar Awal)</span>
             <span class="text-xs font-bold text-davka-orange">- ${formatRupiah(dp)}</span>
        </div>
    </div>
    `;
    
    const costContainer = document.getElementById('detail-cost-breakdown');
    costContainer.innerHTML = costHTML;
    costContainer.classList.remove('hidden');

    document.getElementById('detail-price').innerText = formatRupiah(total);
    const remEl = document.getElementById('detail-remaining');
    remEl.innerText = formatRupiah(remaining);
    remEl.className = remaining <= 0 ? "text-sm font-black text-green-500" : "text-sm font-black text-red-500";

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
    renderOrderList(document.getElementById('searchInput').value);
}

// === REVISI TOTAL: RENDER LIST PESANAN (PEMISAHAN HARGA) ===
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

        const dateDepart = order.date ? new Date(order.date).toLocaleDateString('id-ID', {day:'numeric', month:'short'}) : '-';
        const displayName = (order.contactName || order.name || 'No Name').toUpperCase();
        const displayNo = index + 1; 

        let routeIcon = '<i class="fas fa-arrow-right text-[9px] mx-1 opacity-50"></i>'; 
        if (order.tripType === 'round_trip') {
            routeIcon = '<i class="fas fa-exchange-alt text-[9px] mx-1 text-blue-400"></i>';
        }

        const routeInfo = `${order.origin || '?'} ${routeIcon} ${order.dest || '?'}`;

        // LOGIC HARGA TERPISAH DI LIST
        const pDepart = order.price || 0;
        const pReturn = order.returnPrice || 0;
        
        let priceDisplayHTML = `<div class="text-right">
             <p class="text-[9px] text-gray-500 font-bold uppercase">Pergi</p>
             <p class="text-[10px] font-bold text-white">${formatRupiah(pDepart)}</p>
        </div>`;

        if(order.tripType === 'round_trip') {
            priceDisplayHTML += `<div class="text-right mt-1 pt-1 border-t border-white/5">
                 <p class="text-[9px] text-blue-400 font-bold uppercase">Pulang</p>
                 <p class="text-[10px] font-bold text-white">${formatRupiah(pReturn)}</p>
            </div>`;
        }

        const item = document.createElement('div');
        item.className = `rounded-xl border ${statusColorClass.split(' ')[1]} ${statusColorClass.split(' ')[0]} overflow-hidden mb-2 transition-all duration-300 active:scale-95`;
        
        item.onclick = function() { openDetailView(order.id); };

        const mainRow = `
        <div class="flex items-center justify-between p-3 cursor-pointer select-none relative">
            <div class="absolute left-0 top-0 bottom-0 w-1 ${indicatorColor}"></div>
            <div class="flex items-center gap-3 pl-2 overflow-hidden flex-1">
                <div class="w-7 h-7 rounded-lg bg-black/20 flex items-center justify-center font-mono text-xs font-bold ${statusColorClass.split(' ')[2]} shrink-0 border border-white/5">
                    ${displayNo}
                </div>
                <div class="min-w-0 flex-1">
                    <div class="flex items-baseline gap-2">
                         <h4 class="text-xs font-bold text-white truncate leading-tight">${displayName}</h4>
                    </div>
                    <p class="text-[10px] text-gray-400 truncate mt-0.5 font-medium flex items-center">
                        ${routeInfo}
                    </p>
                     <p class="text-[9px] ${statusColorClass.split(' ')[2]} mt-1 font-bold uppercase tracking-wide opacity-80 border border-current px-1 rounded inline-block">
                        ${order.status}
                    </p>
                </div>
            </div>
            
            <div class="flex flex-col items-end gap-1 shrink-0 pl-2 border-l border-white/5 ml-1">
                 ${priceDisplayHTML}
            </div>
            <div class="pl-2">
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
                
                // Revenue includes return price
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
