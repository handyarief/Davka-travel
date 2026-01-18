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
    setupImageUploader('inpFileTransfer', 'inpTransferData', 'imgTransfer', 'previewTransfer');
    setupImageUploader('inpFileChat', 'inpChatData', 'imgChat', 'previewChat');
    setupHistoryUploader();
    
    // UX ENHANCEMENT: Inisialisasi Smooth Scroll & Enter Key
    enableSmoothInputUX();
}

// --- UX ENGINE: SMOOTH SCROLL & ENTER KEY NAVIGATION (UPDATED) ---
function enableSmoothInputUX() {
    // Ambil semua elemen input yang relevan
    const formElements = document.querySelectorAll('input, select, textarea');
    
    formElements.forEach((el, index) => {
        el.removeEventListener('focus', handleInputFocus);
        el.removeEventListener('click', handleInputFocus); // UPDATED: Tambah listener click
        el.removeEventListener('keydown', handleInputEnter);

        // Tambah listener baru
        el.addEventListener('focus', handleInputFocus);
        el.addEventListener('click', handleInputFocus); // UPDATED: Trigger saat diklik
        el.addEventListener('keydown', (e) => handleInputEnter(e, index, formElements));
    });
}

function handleInputFocus(e) {
    // Delay sedikit agar keyboard virtual muncul dulu
    setTimeout(() => {
        // UPDATED: Menggunakan block 'start' agar respect terhadap scroll-margin-top di CSS
        // Ini memastikan elemen naik ke atas keyboard (area aman)
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
                // Focus akan mentrigger handleInputFocus -> scroll otomatis
                return;
            }
            nextIndex++;
        }
        
        if (nextIndex >= allElements.length) {
            e.target.blur();
        }
    }
}

// FUNGSI: Ambil data dibatasi 50
async function fetchOrders() {
    const { data, error } = await supabase
        .from('orders')
        .select('*')
        .order('created_at', { ascending: false })
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

// FUNGSI: Realtime
function setupRealtime() {
    supabase.channel('public:orders')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, (payload) => {
            fetchOrdersBg(); 
        })
        .subscribe();
}

async function fetchOrdersBg() {
    const { data } = await supabase.from('orders').select('*').order('created_at', { ascending: false }).limit(50);
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

// --- FORM HANDLING ---
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

    try {
        let transferUrl = existingOrder ? existingOrder.transferScreenshot : null;
        let chatUrl = existingOrder ? existingOrder.chatScreenshot : null;

        if (transferBase64 && !transferBase64.startsWith('http')) {
            showToast("Upload Transfer...");
            transferUrl = await uploadToSupabaseStorage(transferBase64, `${orderId}_tf`);
        }
        if (chatBase64 && !chatBase64.startsWith('http')) {
            showToast("Upload Chat...");
            chatUrl = await uploadToSupabaseStorage(chatBase64, `${orderId}_chat`);
        }

        const newOrder = {
            id: orderId, 
            created_at: created_at,
            contactName: document.getElementById('inpContactName').value.toUpperCase(),
            contactPhone: document.getElementById('inpContactPhone').value,
            address: document.getElementById('inpAddress').value.toUpperCase(),
            passengers: getPassengersFromForm(), 
            origin: document.getElementById('inpOrigin').value.toUpperCase(),
            dest: document.getElementById('inpDest').value.toUpperCase(),
            date: document.getElementById('inpDate').value,
            warDate: document.getElementById('inpWarDate').value,
            train: document.getElementById('inpTrain').value.toUpperCase(),
            tripType: document.getElementById('inpTripType').value,
            returnDate: document.getElementById('inpReturnDate').value,
            returnWarDate: document.getElementById('inpReturnWarDate').value,
            returnTrain: document.getElementById('inpReturnTrain').value.toUpperCase(),
            paymentMethod: document.getElementById('inpPaymentMethod').value,
            price: parseFloat(document.getElementById('inpPrice').value),
            fee: parseFloat(document.getElementById('inpFee').value), 
            settlementMethod: existingOrder ? (existingOrder.settlementMethod || '-') : '-',
            transferScreenshot: transferUrl, 
            chatScreenshot: chatUrl,
            settlementProof: existingOrder ? existingOrder.settlementProof : null,
            kaiTicketFile: existingOrder ? existingOrder.kaiTicketFile : null,
            status: existingOrder ? existingOrder.status : 'pending'
        };

        if (existingOrder) {
            orders[editIndex] = newOrder;
        } else {
            orders.unshift(newOrder); 
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

// --- UI HELPERS ---

window.deleteOrder = async function(id) {
    if(confirm("Hapus pesanan ini Permanen?")) {
        toggleLoader(true);
        orders = orders.filter(o => o.id !== id);
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
    if (Array.isArray(data.passengers)) paxList = data.passengers;
    else if (data.name) paxList = [{name: data.name, nik: data.nik || '-'}];
    
    document.getElementById('inpPaxCount').value = paxList.length || 1;
    updatePassengerForms(); 
    
    setTimeout(() => {
        const nameInputs = document.querySelectorAll('.pax-name');
        const nikInputs = document.querySelectorAll('.pax-nik');
        paxList.forEach((p, i) => {
            if(nameInputs[i]) nameInputs[i].value = p.name;
            if(nikInputs[i]) nikInputs[i].value = p.nik;
        });
    }, 0);

    document.getElementById('inpOrigin').value = data.origin || '';
    document.getElementById('inpDest').value = data.dest || '';
    document.getElementById('inpDate').value = data.date || '';
    document.getElementById('inpWarDate').value = data.warDate || ''; 
    document.getElementById('inpTrain').value = data.train || '';
    document.getElementById('inpTripType').value = data.tripType || 'one_way';
    toggleTripType();
    
    if(data.tripType === 'round_trip') {
        document.getElementById('inpReturnDate').value = data.returnDate || '';
        document.getElementById('inpReturnWarDate').value = data.returnWarDate || '';
        document.getElementById('inpReturnTrain').value = data.returnTrain || '';
    }
    document.getElementById('inpPaymentMethod').value = data.paymentMethod || 'Tunai';
    document.getElementById('inpPrice').value = data.price || 0;
    
    const paxCount = paxList.length || 1;
    const pricePerPax = data.price > 0 ? (data.price / paxCount) : 0;
    document.getElementById('inpPricePerPax').value = Math.round(pricePerPax); 
    document.getElementById('inpFee').value = data.fee || 0;
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

// UPDATED: Scroll ke zona upload dengan block: 'start' agar tidak tertutup header
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
    document.getElementById('hintTransfer').classList.add('hidden');
    document.getElementById('hintChat').classList.add('hidden');
}

function setupImageUploader(inputId, hiddenDataId, imgId, containerId) {
    const fileInput = document.getElementById(inputId);
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
                     renderOrderList(document.getElementById('searchInput').value);
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
    if(type === 'round_trip') {
        fields.classList.remove('hidden'); fields.classList.add('fade-in');
        document.getElementById('inpReturnDate').required = true;
        document.getElementById('inpReturnTrain').required = true;
    } else {
        fields.classList.add('hidden'); fields.classList.remove('fade-in');
        document.getElementById('inpReturnDate').required = false;
        document.getElementById('inpReturnTrain').required = false;
    }
    setTimeout(enableSmoothInputUX, 200);
}
window.updatePassengerForms = function() {
    const count = parseInt(document.getElementById('inpPaxCount').value);
    const container = document.getElementById('passengerForms');
    const existingNames = document.querySelectorAll('.pax-name');
    const existingNiks = document.querySelectorAll('.pax-nik');
    let storedData = [];
    existingNames.forEach((el, i) => storedData.push({ name: el.value, nik: existingNiks[i] ? existingNiks[i].value : '' }));

    let html = '';
    for(let i = 1; i <= count; i++) {
        const valName = storedData[i-1] ? storedData[i-1].name : '';
        const valNik = storedData[i-1] ? storedData[i-1].nik : '';
        html += `<div class="passenger-item border border-white/10 rounded-xl p-3 bg-white/5 relative group hover:border-davka-orange/50 transition-colors">
                <div class="absolute -left-1 top-3 w-1 h-6 bg-davka-orange rounded-r"></div>
                <p class="text-[10px] font-bold text-davka-orange mb-2 uppercase tracking-wider pl-2">Penumpang ${i}</p>
                <div class="space-y-2 pl-2">
                    <input type="text" value="${valName}" class="pax-name w-full bg-davka-bg border border-davka-border rounded-lg p-2 text-sm text-white focus:border-davka-orange focus:outline-none placeholder-gray-600" placeholder="Nama Lengkap" autocapitalize="characters">
                    <input type="number" value="${valNik}" class="pax-nik w-full bg-davka-bg border border-davka-border rounded-lg p-2 text-sm text-white focus:border-davka-orange focus:outline-none placeholder-gray-600" placeholder="NIK">
                </div>
            </div>`;
    }
    container.innerHTML = html;
    calcTotalFromPax();
    
    setTimeout(enableSmoothInputUX, 100);
}
window.calcTotalFromPax = function() {
    const pricePerPax = parseFloat(document.getElementById('inpPricePerPax').value) || 0;
    const paxCount = parseInt(document.getElementById('inpPaxCount').value) || 1;
    if (pricePerPax > 0) {
        document.getElementById('inpPrice').value = pricePerPax * paxCount;
        calcRemaining(); 
    }
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
window.calcRemaining = function() {
    const price = parseFloat(document.getElementById('inpPrice').value) || 0;
    const dp = parseFloat(document.getElementById('inpFee').value) || 0;
    const remaining = price - dp;
    const field = document.getElementById('inpRemaining');
    field.value = formatRupiah(remaining);
    field.className = remaining <= 0 ? "bg-transparent text-right text-green-500 font-black text-lg outline-none w-40 cursor-default" : "bg-transparent text-right text-red-500 font-black text-lg outline-none w-40 cursor-default";
}
function getPassengersFromForm() {
    const paxNames = document.querySelectorAll('.pax-name');
    const paxNiks = document.querySelectorAll('.pax-nik');
    let paxList = [];
    paxNames.forEach((input, i) => paxList.push({ name: input.value.toUpperCase() || 'PASSENGER NAME', nik: paxNiks[i] ? paxNiks[i].value : '-' }));
    return paxList;
}

// Generate & Print
window.generateAndPreviewTicket = function() {
    const contactName = document.getElementById('inpContactName').value.toUpperCase();
    if(!contactName) { alert("Isi nama kontak!"); return; }
    toggleLoader(true);
    const data = {
        id: Date.now().toString().slice(-6),
        contactName, 
        contactPhone: document.getElementById('inpContactPhone').value || '-',
        address: document.getElementById('inpAddress').value.toUpperCase() || '-', 
        origin: document.getElementById('inpOrigin').value.toUpperCase(),
        dest: document.getElementById('inpDest').value.toUpperCase(),
        train: document.getElementById('inpTrain').value.toUpperCase(), 
        date: document.getElementById('inpDate').value,
        warDate: document.getElementById('inpWarDate').value,
        paymentMethod: document.getElementById('inpPaymentMethod').value,
        price: parseFloat(document.getElementById('inpPrice').value) || 0,
        fee: parseFloat(document.getElementById('inpFee').value) || 0, 
        tripType: document.getElementById('inpTripType').value,
        returnDate: document.getElementById('inpReturnDate').value,
        returnTrain: document.getElementById('inpReturnTrain').value.toUpperCase(),
        returnWarDate: document.getElementById('inpReturnWarDate').value,
        passengers: getPassengersFromForm() 
    };
    data.remaining = data.price - data.fee;
    renderTicketToDOM(data);
    showToast("RENDER TIKET...");
    setTimeout(() => { captureAndShowModal('ticket-render-area'); }, 800); 
}
window.printReceipt = function(orderId) {
    const order = orders.find(o => o.id === orderId);
    if (!order) return;
    toggleLoader(true);
    renderReceiptToDOM(order);
    showToast("RENDER STRUK...");
    setTimeout(() => { captureAndShowModal('receipt-render-area'); }, 800);
}
function renderReceiptToDOM(order) {
    const stampEl = document.getElementById('rec-stamp');
    if (order.status === 'success') stampEl.classList.add('visible'); else stampEl.classList.remove('visible');
    const now = new Date();
    document.getElementById('rec-date').innerText = now.toLocaleDateString('id-ID');
    document.getElementById('rec-time').innerText = now.toLocaleTimeString('id-ID', {hour:'2-digit', minute:'2-digit'});
    document.getElementById('rec-id').innerText = "#" + order.id.toString().slice(-6);
    document.getElementById('rec-full-name').innerText = (order.contactName || order.name || '').toUpperCase();
    document.getElementById('rec-phone').innerText = order.contactPhone || order.phone || '-';
    document.getElementById('rec-address').innerText = (order.address || '-').toUpperCase();
    let desc = `KA ${order.train.toUpperCase()} (${order.origin}-${order.dest})`;
    if(order.tripType === 'round_trip') desc = `PP ${order.train}/${order.returnTrain}`.toUpperCase();
    if(desc.length > 30) desc = desc.substring(0, 28) + '..';
    let paxCount = order.passengers ? order.passengers.length : (order.name ? 1 : 1);
    const pricePerPax = order.price > 0 ? Math.round(order.price / paxCount) : 0;
    document.getElementById('rec-items').innerHTML = `<tr><td colspan="2" class="pb-1 uppercase">${desc}</td></tr><tr><td class="pb-1">${paxCount} x ${formatNumber(pricePerPax)}</td><td class="text-right font-bold">${formatNumber(order.price)}</td></tr>`;
    document.getElementById('rec-total').innerText = formatRupiah(order.price);
    document.getElementById('rec-dp').innerText = formatRupiah(order.fee);
    document.getElementById('rec-settlement').innerText = formatRupiah(order.price - order.fee);
    document.getElementById('rec-method').innerText = (order.settlementMethod && order.settlementMethod !== '-') ? order.settlementMethod.toUpperCase() : order.paymentMethod.toUpperCase();
}
function renderTicketToDOM(data) {
    document.getElementById('ticket-id').innerText = "#" + data.id.toString().slice(-6);
    document.getElementById('ticket-issued-date').innerText = new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
    document.getElementById('ticket-contact-name').innerText = data.contactName.length > 25 ? data.contactName.substring(0,24) + "..." : data.contactName;
    document.getElementById('ticket-contact-phone').innerText = data.contactPhone;
    document.getElementById('ticket-address').innerText = data.address || '-'; 
    const formatDateIndo = (d) => d ? new Date(d).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) : '-';
    document.getElementById('ticket-train-depart').innerText = data.train;
    document.getElementById('ticket-origin').innerText = data.origin || 'ORG';
    document.getElementById('ticket-dest').innerText = data.dest || 'DST';
    document.getElementById('ticket-date-depart').innerText = formatDateIndo(data.date);
    document.getElementById('ticket-war-date-depart').innerText = formatDateIndo(data.warDate);
    const returnBox = document.getElementById('ticket-box-return');
    if(data.tripType === 'round_trip') {
        returnBox.classList.remove('hidden');
        document.getElementById('ticket-train-return').innerText = data.returnTrain;
        document.getElementById('ticket-return-origin').innerText = data.dest || 'DST';
        document.getElementById('ticket-return-dest').innerText = data.origin || 'ORG';
        document.getElementById('ticket-date-return').innerText = formatDateIndo(data.returnDate);
        document.getElementById('ticket-war-date-return').innerText = formatDateIndo(data.returnWarDate); 
    } else returnBox.classList.add('hidden');
    let paxHtml = '';
    const paxCount = data.passengers.length;
    document.getElementById('ticket-pax-count').innerText = `${paxCount} Penumpang`;
    const pricePerPax = data.price > 0 ? Math.round(data.price / paxCount) : 0;
    document.getElementById('ticket-val-price-per-pax').innerText = formatRupiah(pricePerPax);
    data.passengers.forEach((p, index) => {
        paxHtml += `<div class="flex items-center gap-3 border-b border-gray-100 pb-2 last:border-0 last:pb-0">
                <div class="w-6 h-6 rounded-full bg-[#f8fafc] border border-gray-200 flex items-center justify-center text-[9px] font-bold text-gray-500 shrink-0">${index + 1}</div>
                <div class="flex-1 min-w-0"><p class="text-xs font-black uppercase text-[#0b1c38] break-words leading-tight">${p.name}</p><p class="text-[9px] text-gray-400 font-mono tracking-wider">NIK: ${p.nik}</p></div>
            </div>`;
    });
    document.getElementById('ticket-pax-list-vertical').innerHTML = paxHtml;
    document.getElementById('ticket-val-method').innerText = data.paymentMethod;
    document.getElementById('ticket-val-total').innerText = formatRupiah(data.price); 
    document.getElementById('ticket-val-fee').innerText = formatRupiah(data.fee);     
    document.getElementById('ticket-val-remaining').innerText = formatRupiah(data.remaining);
}
function captureAndShowModal(elementId) {
    const el = document.getElementById(elementId);
    html2canvas(el, { scale: 3, useCORS: true, allowTaint: true, backgroundColor: "#ffffff" })
        .then(canvas => { showImageModal(canvas.toDataURL("image/jpeg", 0.90), true); toggleLoader(false); })
        .catch(err => { console.error("Render Error:", err); toggleLoader(false); alert("Gagal render gambar."); });
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
    }
    resetUploadZones(); 
}
window.searchOrders = function() { renderOrderList(document.getElementById('searchInput').value); }
function formatRupiah(num) { return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(num); }
function formatNumber(num) { return new Intl.NumberFormat('id-ID').format(num); }
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
        btn.href = src; btn.download = `Davka_IMG_${Date.now()}.jpg`; btn.target = "_blank";
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
    document.getElementById('inpTripType').value = 'one_way';
    document.getElementById('inpPricePerPax').value = '';
    toggleTripType(); clearImage('transfer'); clearImage('chat'); updatePassengerForms(); calcRemaining();
    resetUploadZones();
    enableSmoothInputUX();
}

// --- RENDER LIST SYSTEM (UPDATED) ---
window.renderOrderList = function(filterText = '') {
    const container = document.getElementById('ordersContainer');
    container.innerHTML = '';
    if(!orders) return;
    const filtered = orders.filter(o => {
        const name = o.contactName || o.name || '';
        return name.toLowerCase().includes(filterText.toLowerCase());
    });
    if(filtered.length === 0) { document.getElementById('emptyState').classList.remove('hidden'); return; } 
    else document.getElementById('emptyState').classList.add('hidden');

    filtered.forEach(order => {
        const remaining = (order.price || 0) - (order.fee || 0);
        let paxCount = order.passengers ? order.passengers.length : (order.name ? 1 : 1);
        const displayName = order.contactName || order.name || 'No Name'; 
        
        let statusBadge = ''; let statusColor = '';
        if(order.status === 'success') {
            statusBadge = `<span class="bg-green-500/20 text-green-400 border border-green-500/50 px-3 py-1 rounded-full text-[10px] font-bold tracking-wider whitespace-nowrap"><i class="fas fa-check-double mr-1"></i> LUNAS</span>`;
            statusColor = 'border-l-green-500';
        } else if (order.status === 'cancel') {
            statusBadge = `<span class="bg-red-500/20 text-red-400 border border-red-500/50 px-3 py-1 rounded-full text-[10px] font-bold tracking-wider whitespace-nowrap"><i class="fas fa-times mr-1"></i> BATAL</span>`;
            statusColor = 'border-l-red-500';
        } else {
            statusBadge = `<span class="bg-yellow-500/20 text-yellow-400 border border-yellow-500/50 px-3 py-1 rounded-full text-[10px] font-bold tracking-wider whitespace-nowrap"><i class="fas fa-clock mr-1"></i> PENDING</span>`;
            statusColor = 'border-l-yellow-500';
        }

        const dateDepart = order.date ? new Date(order.date).toLocaleDateString('id-ID', {day:'numeric', month:'short'}) : '-';
        const warDateDepart = order.warDate ? new Date(order.warDate).toLocaleDateString('id-ID', {day:'numeric', month:'short'}) : '-';
        
        // --- 2. UPDATE: VISUAL RUTE FUTURISTIK ---
        let routeHtml = '';
        if(order.tripType === 'round_trip') {
            const dateReturn = order.returnDate ? new Date(order.returnDate).toLocaleDateString('id-ID', {day:'numeric', month:'short'}) : '-';
            const warDateReturn = order.returnWarDate ? new Date(order.returnWarDate).toLocaleDateString('id-ID', {day:'numeric', month:'short'}) : '-';
            
            routeHtml = `
            <div class="mt-4 mb-2 space-y-3">
                <div class="relative bg-davka-bg/60 rounded-xl p-3 border border-white/5 overflow-hidden group-hover:border-davka-orange/30 transition-all">
                    <div class="absolute inset-0 bg-gradient-to-r from-davka-orange/5 to-transparent"></div>
                    <div class="relative z-10 flex items-center justify-between">
                        <div class="text-left min-w-0 flex-1">
                            <p class="text-[9px] text-davka-orange font-bold uppercase tracking-widest mb-0.5">Berangkat</p>
                            <h4 class="text-lg font-black text-white leading-none truncate">${order.origin}</h4>
                            <p class="text-[9px] text-gray-400 mt-1">${dateDepart}</p>
                        </div>
                        <div class="px-2 flex flex-col items-center justify-center">
                            <i class="fas fa-train text-davka-orange text-xs animate-pulse"></i>
                            <div class="h-px w-8 bg-davka-orange/50 mt-1"></div>
                        </div>
                        <div class="text-right min-w-0 flex-1">
                            <p class="text-[9px] text-gray-500 font-bold uppercase tracking-widest mb-0.5 text-right">Tujuan</p>
                            <h4 class="text-lg font-black text-white leading-none truncate">${order.dest}</h4>
                            <p class="text-[9px] text-white/60 mt-1 font-bold">War: ${warDateDepart}</p>
                        </div>
                    </div>
                    <div class="mt-2 pt-2 border-t border-white/5 flex justify-between items-center">
                         <span class="text-[9px] bg-davka-orange/20 text-davka-orange px-2 py-0.5 rounded text-center font-bold">${order.train}</span>
                    </div>
                </div>

                <div class="relative bg-davka-bg/60 rounded-xl p-3 border border-white/5 overflow-hidden group-hover:border-davka-accent/30 transition-all">
                    <div class="absolute inset-0 bg-gradient-to-r from-davka-accent/5 to-transparent"></div>
                    <div class="relative z-10 flex items-center justify-between">
                         <div class="text-left min-w-0 flex-1">
                            <p class="text-[9px] text-davka-accent font-bold uppercase tracking-widest mb-0.5">Pulang</p>
                            <h4 class="text-lg font-black text-white leading-none truncate">${order.dest}</h4>
                            <p class="text-[9px] text-gray-400 mt-1">${dateReturn}</p>
                        </div>
                        <div class="px-2 flex flex-col items-center justify-center">
                            <i class="fas fa-undo text-davka-accent text-xs"></i>
                            <div class="h-px w-8 bg-davka-accent/50 mt-1"></div>
                        </div>
                        <div class="text-right min-w-0 flex-1">
                            <p class="text-[9px] text-gray-500 font-bold uppercase tracking-widest mb-0.5 text-right">Asal</p>
                            <h4 class="text-lg font-black text-white leading-none truncate">${order.origin}</h4>
                            <p class="text-[9px] text-white/60 mt-1 font-bold">War: ${warDateReturn}</p>
                        </div>
                    </div>
                    <div class="mt-2 pt-2 border-t border-white/5 flex justify-between items-center">
                         <span class="text-[9px] bg-davka-accent/20 text-davka-accent px-2 py-0.5 rounded text-center font-bold">${order.returnTrain}</span>
                    </div>
                </div>
            </div>`;
        } else {
            // One Way Modern
            routeHtml = `
            <div class="relative bg-black/40 rounded-2xl p-4 border border-white/5 my-4 overflow-hidden shadow-inner">
                 <div class="absolute top-0 right-0 p-2 opacity-10"><i class="fas fa-ticket-alt text-4xl"></i></div>
                 <div class="flex justify-between items-center relative z-10">
                     <div class="text-left flex-1 min-w-0">
                         <div class="text-[10px] text-gray-500 font-bold tracking-widest mb-1">ASAL</div>
                         <div class="text-xl font-black text-white leading-none truncate">${order.origin}</div>
                         <div class="text-[10px] text-davka-orange font-bold mt-1 bg-davka-orange/10 inline-block px-1 rounded">${dateDepart}</div>
                     </div>
                     
                     <div class="flex-none px-3 flex flex-col items-center justify-center w-16">
                         <div class="w-full border-t-2 border-dashed border-gray-600 relative">
                            <i class="fas fa-plane transform rotate-45 absolute -top-2 left-1/2 -translate-x-1/2 bg-davka-bg px-1 text-[10px] text-gray-400"></i>
                         </div>
                         <div class="text-[8px] text-gray-500 mt-2 font-mono">ONE WAY</div>
                     </div>

                     <div class="text-right flex-1 min-w-0">
                         <div class="text-[10px] text-gray-500 font-bold tracking-widest mb-1">TUJUAN</div>
                         <div class="text-xl font-black text-white leading-none truncate">${order.dest}</div>
                         <div class="text-[10px] text-gray-400 mt-1 font-bold">War: ${warDateDepart}</div>
                     </div>
                 </div>
                 <div class="mt-3 pt-2 border-t border-white/5 flex justify-between items-center">
                    <span class="text-[10px] text-gray-500"><i class="fas fa-train mr-1"></i> ${order.train}</span>
                 </div>
            </div>`;
        }
        
        const settlementOptions = ["-", "Tunai", "Transfer CIMB Niaga", "Transfer Seabank", "Dana", "Gopay", "Ovo", "ShopeePay"];
        let optionsHtml = settlementOptions.map(opt => `<option value="${opt}" ${order.settlementMethod === opt ? 'selected' : ''}>${opt === '-' ? 'Belum Lunas' : opt}</option>`).join('');

        const card = document.createElement('div');
        card.className = `glass p-5 rounded-3xl border-l-4 ${statusColor} relative overflow-hidden group transition-all duration-300 hover:shadow-glow mb-4`;
        
        // --- 1. UPDATE: LAYOUT TAGIHAN TIDAK BERTABRAKAN (STACKED MODERN) ---
        const priceSection = `
        <div class="bg-gradient-to-br from-davka-surface to-black rounded-xl p-4 border border-white/10 mt-2 mb-4 relative overflow-hidden">
            <div class="absolute -right-6 -top-6 w-20 h-20 bg-davka-orange/5 blur-2xl rounded-full"></div>
            
            <div class="flex justify-between items-end border-b border-white/5 pb-3 mb-3 relative z-10">
                <span class="text-[10px] text-gray-400 font-bold tracking-widest uppercase">Total Tagihan</span>
                <span class="text-xl font-black text-white tracking-tight drop-shadow-md">${formatRupiah(order.price || 0)}</span>
            </div>

            <div class="flex items-center relative z-10">
                <div class="flex-1 pr-4 border-r border-white/10">
                    <div class="flex justify-between items-center mb-1">
                        <span class="text-[9px] text-davka-orange uppercase font-bold">Uang Muka (DP)</span>
                        <i class="fas fa-coins text-[10px] text-davka-orange/50"></i>
                    </div>
                    <p class="text-sm font-bold text-gray-200">${formatRupiah(order.fee || 0)}</p>
                </div>
                
                <div class="flex-1 pl-4">
                    <div class="flex justify-between items-center mb-1">
                        <span class="text-[9px] text-gray-400 uppercase font-bold">Sisa Pelunasan</span>
                         ${remaining <= 0 ? '<i class="fas fa-check-circle text-[10px] text-green-500"></i>' : '<i class="fas fa-exclamation-circle text-[10px] text-red-500"></i>'}
                    </div>
                    <p class="text-sm font-black ${remaining <= 0 ? 'text-green-400' : 'text-red-500'}">${formatRupiah(remaining)}</p>
                </div>
            </div>
        </div>`;

        card.innerHTML = `
            <div class="flex justify-between items-start">
                <div class="flex items-center gap-3 w-[70%]">
                    <div class="w-10 h-10 min-w-[2.5rem] rounded-full bg-gradient-to-br from-gray-700 to-black flex items-center justify-center border border-white/10 shadow-lg"><span class="font-bold text-white text-sm">${displayName.charAt(0).toUpperCase()}</span></div>
                    <div class="overflow-hidden"><h3 class="font-bold text-white text-sm leading-tight truncate">${displayName}</h3><p class="text-[10px] text-gray-400">${paxCount} Penumpang</p></div>
                </div>
                <div onclick="toggleStatus(${order.id})" class="cursor-pointer active:scale-95 transition-transform shrink-0">${statusBadge}</div>
            </div>
            
            ${routeHtml}
            ${priceSection}

            <div class="space-y-3 mb-4">
                <select onchange="updateSettlement(${order.id}, this.value)" class="w-full bg-davka-bg border border-white/10 rounded-lg text-[10px] text-white p-2 outline-none focus:border-davka-orange transition-colors cursor-pointer hover:bg-white/5">${optionsHtml}</select>
                <div class="grid grid-cols-2 gap-2">
                    ${renderUploadBtnHTML(order.id, 'settlement', order.settlementProof, 'Bukti Lunas')}
                    ${renderUploadBtnHTML(order.id, 'kai_ticket', order.kaiTicketFile, 'Tiket KAI')}
                </div>
            </div>
            <div class="glass p-1 rounded-2xl flex justify-between items-center text-center shadow-lg mt-4">
                <button onclick="editOrder(${order.id})" class="flex-1 py-3 hover:bg-white/5 rounded-xl transition-colors group"><p class="text-[10px] text-gray-400 font-bold uppercase mb-1 group-hover:text-white">Edit</p><i class="fas fa-edit text-lg text-blue-400 group-hover:scale-110 transition-transform"></i></button>
                <div class="w-px h-8 bg-white/10"></div>
                <button onclick="deleteOrder(${order.id})" class="flex-1 py-3 hover:bg-white/5 rounded-xl transition-colors group"><p class="text-[10px] text-gray-400 font-bold uppercase mb-1 group-hover:text-white">Hapus</p><i class="fas fa-trash text-lg text-red-500 group-hover:scale-110 transition-transform"></i></button>
                <div class="w-px h-8 bg-white/10"></div>
                <button onclick="printReceipt(${order.id})" class="flex-1 py-3 hover:bg-white/5 rounded-xl transition-colors group"><p class="text-[10px] text-gray-400 font-bold uppercase mb-1 group-hover:text-white">Cetak</p><i class="fas fa-print text-lg text-davka-orange group-hover:scale-110 transition-transform"></i></button>
            </div>`;
        container.appendChild(card);
    });
}
function renderUploadBtnHTML(id, type, file, label) {
    if(file) {
        return `<div class="relative h-20 w-full rounded-xl overflow-hidden border border-white/10 group cursor-pointer">
            <img src="${file}" class="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-all transform group-hover:scale-110" onclick="showImageModal(this.src, true); event.stopPropagation();">
            <div class="absolute inset-0 bg-black/40 flex items-center justify-center pointer-events-none"><p class="text-[9px] text-white font-bold drop-shadow-md text-center px-1">${label}</p></div>
            <button onclick="triggerHistoryUpload(${id}, '${type}')" class="absolute top-1 right-1 bg-black/60 text-white rounded-full w-6 h-6 flex items-center justify-center hover:bg-davka-orange transition-colors z-10"><i class="fas fa-pen text-[9px]"></i></button>
        </div>`;
    } else {
        return `<button onclick="triggerHistoryUpload(${id}, '${type}')" class="h-20 bg-white/5 border border-white/10 border-dashed text-gray-400 rounded-xl text-[10px] hover:bg-white/10 hover:border-davka-orange/50 hover:text-white transition-all flex flex-col items-center justify-center gap-2 group">
            <div class="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center group-hover:bg-davka-orange group-hover:text-white transition-colors"><i class="fas fa-cloud-upload-alt"></i></div><span>${label}</span>
        </button>`;
    }
}
function renderStats() {
    const now = new Date();
    const today = now.toISOString().split('T')[0];
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    let cToday=0, rev=0, p=0, s=0, c=0;
    
    if(orders) {
        orders.forEach(o => {
            if(o.status==='pending') p++; else if(o.status==='success') s++; else c++;
            let createdDate = o.created_at ? new Date(o.created_at) : new Date(o.id);
            let dateStr = createdDate.toISOString().split('T')[0];
            if(dateStr === today) cToday++;
            if(o.status === 'success' && createdDate.getMonth() === currentMonth && createdDate.getFullYear() === currentYear) rev += (o.fee || 0);
        });
    }
    document.getElementById('stat-today').innerText = cToday;
    document.getElementById('stat-revenue').innerText = formatRupiah(rev);
    document.getElementById('stat-pending').innerText = p;
    document.getElementById('stat-success').innerText = s;
    document.getElementById('stat-cancel').innerText = c;
}
