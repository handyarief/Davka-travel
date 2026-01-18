// --- KONFIGURASI SUPABASE (WAJIB DIISI) ---
// Tempel Project URL dan Anon Key Anda di dalam tanda kutip di bawah ini
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
    // Logic Video Intro 
    const splash = document.getElementById('splash-screen');
    const video = document.getElementById('intro-video');
    const skipBtn = document.getElementById('btn-skip-intro');
    const overlay = document.getElementById('video-overlay');
    const loaderWrapper = document.getElementById('post-video-loader');
    const loaderFill = document.getElementById('post-video-fill');

    let isSequenceStarted = false;

    const enterApp = () => {
        if(overlay) overlay.classList.remove('opacity-0'); 
        splash.classList.add('splash-hidden'); 
        setTimeout(() => { splash.remove(); }, 1500); 
        initializeAppLogic(); 
    };

    const startLoadingPhase = () => {
        if(isSequenceStarted) return;
        isSequenceStarted = true;
        if(video) video.pause();
        if(skipBtn) skipBtn.classList.add('hidden');
        if(loaderWrapper && loaderFill) {
            loaderWrapper.style.opacity = '1';
            setTimeout(() => { loaderFill.style.width = '100%'; }, 100);
            setTimeout(() => { enterApp(); }, 1500); // Dipercepat sedikit agar UX lebih snappy
        } else {
            enterApp();
        }
    };

    if (video) {
        setTimeout(() => { if(skipBtn && !isSequenceStarted) skipBtn.classList.remove('hidden'); }, 1500);
        video.addEventListener('ended', startLoadingPhase);
        video.play().catch(e => {
            console.warn("Autoplay blocked:", e);
            if(skipBtn) skipBtn.innerText = "START SYSTEM";
        });
    } else {
        setTimeout(startLoadingPhase, 1000);
    }
    if(skipBtn) {
        skipBtn.addEventListener('click', () => startLoadingPhase());
    }
    setTimeout(() => { if(!isSequenceStarted) startLoadingPhase(); }, 15000);

    document.addEventListener('click', (e) => {
        if (!e.target.closest('.upload-zone-base')) {
            resetUploadZones();
        }
    });
});

function initializeAppLogic() {
    updateDate();
    updateGreeting(); 
    
    // 1. FETCH DATA AWAL
    fetchOrders();

    // 2. SETUP REALTIME LISTENER (Supabase Magic)
    const channel = supabase
        .channel('public:orders')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, (payload) => {
            console.log('Realtime update received:', payload);
            fetchOrders(); // Refresh data otomatis saat ada perubahan di DB
        })
        .subscribe();

    updatePassengerForms(); // Init awal form
    setupImageUploader('inpFileTransfer', 'inpTransferData', 'imgTransfer', 'previewTransfer');
    setupImageUploader('inpFileChat', 'inpChatData', 'imgChat', 'previewChat');
    setupHistoryUploader();
}

async function fetchOrders() {
    const { data, error } = await supabase
        .from('orders')
        .select('*')
        .order('created_at', { ascending: false });

    if (error) {
        console.error("Error fetching orders:", error);
        return;
    }

    orders = data || [];
    renderStats();
    
    // Render ulang list jika sedang dibuka
    const listSection = document.getElementById('page-list');
    const container = document.getElementById('ordersContainer');
    if (!listSection.classList.contains('hidden') || container.innerHTML === '') {
         renderOrderList(document.getElementById('searchInput').value);
    }
}

// --- LOGIC UPLOAD ---
window.handleUploadZoneClick = function(zoneId, inputId) {
    const zone = document.getElementById(zoneId);
    const hint = document.getElementById(zoneId.replace('zone', 'hint')); 
    const input = document.getElementById(inputId);

    if (activeUploadZone === zoneId) {
        input.click();
        setTimeout(resetUploadZones, 500);
    } else {
        resetUploadZones(); 
        activeUploadZone = zoneId;
        zone.classList.add('upload-zone-active');
        if(hint) hint.classList.remove('hidden');

        // Auto scroll to center agar user nyaman saat upload
        setTimeout(() => {
            zone.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" });
        }, 300);
    }
}

function resetUploadZones() {
    activeUploadZone = null;
    document.querySelectorAll('.upload-zone-base').forEach(el => {
        el.classList.remove('upload-zone-active');
    });
    document.getElementById('hintTransfer').classList.add('hidden');
    document.getElementById('hintChat').classList.add('hidden');
}

// --- HELPER: UPLOAD BASE64 KE SUPABASE STORAGE ---
async function uploadToSupabaseStorage(base64Data, fileName) {
    if (!base64Data || base64Data.startsWith('http')) return base64Data; // Skip jika kosong atau sudah URL

    try {
        // Convert Base64 ke Blob
        const res = await fetch(base64Data);
        const blob = await res.blob();
        const filePath = `uploads/${fileName}.jpg`;

        // Upload ke Bucket 'davka-files'
        const { data, error } = await supabase.storage
            .from('davka-files')
            .upload(filePath, blob, {
                contentType: 'image/jpeg',
                upsert: true
            });

        if (error) throw error;

        // Ambil Public URL
        const { data: publicData } = supabase.storage
            .from('davka-files')
            .getPublicUrl(filePath);

        return publicData.publicUrl;
    } catch (err) {
        console.error("Upload Error:", err);
        throw new Error("Gagal upload gambar ke server.");
    }
}

const orderForm = document.getElementById('orderForm');

orderForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    toggleLoader(true); 
    
    const editIndex = parseInt(document.getElementById('editIndex').value);
    const existingOrder = editIndex !== -1 ? orders[editIndex] : null;
    
    // Gunakan ID lama jika edit, atau buat ID baru (timestamp)
    const orderId = existingOrder ? existingOrder.id : Date.now();
    const timestamp = new Date().toISOString();

    let transferBase64 = document.getElementById('inpTransferData').value;
    let chatBase64 = document.getElementById('inpChatData').value;

    try {
        // 1. Upload Gambar Dulu (jika ada perubahan)
        let transferUrl = existingOrder ? existingOrder.transferScreenshot : null;
        let chatUrl = existingOrder ? existingOrder.chatScreenshot : null;

        if (transferBase64 && !transferBase64.startsWith('http')) {
            showToast("Mengupload Bukti Transfer...");
            transferUrl = await uploadToSupabaseStorage(transferBase64, `${orderId}_transfer_${Date.now()}`);
        }
        if (chatBase64 && !chatBase64.startsWith('http')) {
            showToast("Mengupload Bukti Chat...");
            chatUrl = await uploadToSupabaseStorage(chatBase64, `${orderId}_chat_${Date.now()}`);
        }

        // 2. Siapkan Object Data
        const newOrder = {
            id: orderId, 
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
            // created_at otomatis diisi Supabase untuk data baru
        };

        // 3. Simpan ke Database
        if (existingOrder) {
            // Update
            const { error } = await supabase
                .from('orders')
                .update(newOrder)
                .eq('id', orderId);
            if(error) throw error;
            showToast("Data Updated!");
        } else {
            // Insert
            const { error } = await supabase
                .from('orders')
                .insert([newOrder]);
            if(error) throw error;
            showToast("Pesanan Tersimpan!");
        }

        resetForm(); 
    } catch (err) {
        console.error("Save Failed:", err);
        alert("Gagal menyimpan: " + err.message);
    } finally {
        toggleLoader(false); 
    }
});

// --- UI UTILS ---
function toggleLoader(show) {
    const loader = document.getElementById('global-loader');
    if (loaderTimeout) { clearTimeout(loaderTimeout); loaderTimeout = null; }
    if (show) {
        loader.classList.remove('hidden');
        loaderTimeout = setTimeout(() => {
            if (!loader.classList.contains('hidden')) {
                toggleLoader(false);
                // alert("Koneksi lambat, tapi data sedang diproses di background.");
            }
        }, 30000); // 30 detik timeout untuk upload gambar
    } else {
        loader.classList.add('hidden');
    }
}

window.navTo = function(pageId) {
    const currentPages = document.querySelectorAll('main > section:not(.hidden)');
    currentPages.forEach(page => { page.classList.add('fade-out'); page.classList.remove('fade-in'); });

    setTimeout(() => {
        document.querySelectorAll('main > section').forEach(el => {
            el.classList.add('hidden');
            el.classList.remove('fade-out');
        });
        const target = document.getElementById(`page-${pageId}`);
        target.classList.remove('hidden');
        target.classList.add('fade-in');

        document.querySelectorAll('nav button').forEach(el => el.classList.remove('active-nav'));
        if(pageId === 'dashboard') document.getElementById('nav-dashboard').classList.add('active-nav');
        if(pageId === 'list') {
            document.getElementById('nav-list').classList.add('active-nav');
            renderOrderList(document.getElementById('searchInput').value); 
        }
        if(pageId === 'input') {
            if(document.getElementById('editIndex').value === "-1") resetForm();
        }
        // Smooth scroll reset
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }, 400); 
}

window.deleteOrder = async function(id) {
    if(confirm("Hapus pesanan ini Permanen?")) {
        toggleLoader(true);
        try {
            const { error } = await supabase
                .from('orders')
                .delete()
                .eq('id', id);

            if(error) throw error;
            showToast("Pesanan dihapus");
            // fetchOrders() dipanggil otomatis oleh Realtime Listener
        } catch (err) {
            console.error(err);
            alert("Gagal menghapus data.");
        } finally {
            toggleLoader(false);
        }
    }
}

window.editOrder = function(id) {
    const index = orders.findIndex(o => o.id === id);
    if (index === -1) return;
    const data = orders[index];
    
    document.getElementById('editIndex').value = index;
    document.getElementById('inpContactName').value = data.contactName || data.name || '';
    document.getElementById('inpContactPhone').value = data.contactPhone || data.phone || '';
    document.getElementById('inpAddress').value = data.address || '';
    
    // Handle Penumpang (Support format lama & baru)
    let paxList = [];
    if (Array.isArray(data.passengers)) {
        paxList = data.passengers;
    } else if (data.name) {
         paxList = [{name: data.name, nik: data.nik || '-'}];
    }
    
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
        const img = document.getElementById('imgTransfer');
        img.src = data.transferScreenshot;
        document.getElementById('previewTransfer').classList.remove('hidden');
    }
    if(data.chatScreenshot) {
        document.getElementById('inpChatData').value = data.chatScreenshot;
        const img = document.getElementById('imgChat');
        img.src = data.chatScreenshot;
        document.getElementById('previewChat').classList.remove('hidden');
    }

    document.getElementById('btnSaveText').innerText = "UPDATE DATA";
    navTo('input');
}

window.toggleStatus = async function(id) {
    toggleLoader(true);
    const index = orders.findIndex(o => o.id === id);
    if(index === -1) { toggleLoader(false); return; }

    const current = orders[index].status;
    const next = current === 'pending' ? 'success' : (current === 'success' ? 'cancel' : 'pending');
    
    try {
        const { error } = await supabase
            .from('orders')
            .update({ status: next })
            .eq('id', id);

        if(error) throw error;
        // Tidak perlu manual update array, realtime listener akan menangani
    } catch(e) {
        console.error(e);
        alert("Gagal update status");
    } finally {
        toggleLoader(false);
    }
}

window.updateSettlement = async function(id, newVal) {
    toggleLoader(true);
    const index = orders.findIndex(o => o.id === id);
    if(index !== -1) {
        const nextStatus = newVal === '-' ? 'pending' : 'success';
        try {
             const { error } = await supabase
                .from('orders')
                .update({ settlementMethod: newVal, status: nextStatus })
                .eq('id', id);

            if(error) throw error;
            showToast("Info Pelunasan Updated");
        } catch(e) {
            console.error(e);
            alert("Gagal update pelunasan");
        } finally {
            toggleLoader(false);
        }
    } else {
        toggleLoader(false);
    }
}

function setupHistoryUploader() {
    const historyInput = document.getElementById('inpHistoryUpload');
    
    historyInput.addEventListener('change', function(e) {
        if (!currentUploadOrderId || !currentUploadType) return;
        const file = e.target.files[0];
        if (!file) return;

        showToast("Mengupload gambar...");
        toggleLoader(true);

        processFile(file, async (base64Data) => {
            try {
                // Upload ke Storage
                const fileName = `${currentUploadOrderId}_${currentUploadType}_${Date.now()}`;
                const publicUrl = await uploadToSupabaseStorage(base64Data, fileName);

                // Update Database Record
                const updateData = {};
                if (currentUploadType === 'settlement') updateData.settlementProof = publicUrl;
                else if (currentUploadType === 'kai_ticket') updateData.kaiTicketFile = publicUrl;

                const { error } = await supabase
                    .from('orders')
                    .update(updateData)
                    .eq('id', currentUploadOrderId);

                if(error) throw error;
                showToast("Tersimpan!");
            } catch(e) {
                console.error(e);
                alert("Gagal simpan: " + e.message);
            } finally {
                currentUploadOrderId = null;
                currentUploadType = null;
                historyInput.value = ''; 
                toggleLoader(false);
            }
        });
    });
}

function setupFocusMode() {
    const rawInputs = document.querySelectorAll('input:not([type="hidden"]):not([type="file"]), textarea, select');
    const inputs = Array.from(rawInputs).filter(el => !el.closest('.hidden'));

    const header = document.querySelector('header');
    const nav = document.querySelector('nav');

    inputs.forEach((el, index) => {
        // Hapus listener lama biar ga numpuk
        if(el._fnFocus) {
             el.removeEventListener('focus', el._fnFocus);
             el.removeEventListener('blur', el._fnBlur);
             el.removeEventListener('keydown', el._fnKey);
        }

        el._fnFocus = () => {
            if(header) header.classList.add('opacity-0', '-translate-y-full', 'absolute');
            if(nav) nav.classList.add('translate-y-[200%]', 'opacity-0');
            
            setTimeout(() => { 
                el.scrollIntoView({behavior: "smooth", block: "center", inline: "nearest"}); 
            }, 400);
        };

        el._fnBlur = () => {
            setTimeout(() => {
                const activeTag = document.activeElement.tagName;
                if (activeTag === 'INPUT' || activeTag === 'TEXTAREA' || activeTag === 'SELECT') return;
                
                if(header) header.classList.remove('opacity-0', '-translate-y-full', 'absolute');
                if(nav) nav.classList.remove('translate-y-[200%]', 'opacity-0');
            }, 100);
        };

        el._fnKey = (e) => {
            if (e.key === 'Enter') {
                // Jangan prevent default kalo textarea
                if(el.tagName === 'TEXTAREA') return;
                
                e.preventDefault(); 
                const nextInput = inputs[index + 1];
                if (nextInput) {
                    nextInput.focus(); 
                } else {
                    el.blur(); 
                }
            }
        };

        el.addEventListener('focus', el._fnFocus);
        el.addEventListener('blur', el._fnBlur);
        el.addEventListener('keydown', el._fnKey);
    });
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
            const MAX_WIDTH = 800; // Sedikit dinaikkan untuk kualitas tiket
            let width = img.width;
            let height = img.height;
            if (width > MAX_WIDTH) {
                height *= MAX_WIDTH / width;
                width = MAX_WIDTH;
            }
            canvas.width = width;
            canvas.height = height;
            ctx.drawImage(img, 0, 0, width, height);
            callback(canvas.toDataURL('image/jpeg', 0.7)); // Kompresi 0.7
        }
        img.src = event.target.result;
    }
    reader.readAsDataURL(file);
}

window.toggleTripType = function() {
    const type = document.getElementById('inpTripType').value;
    const fields = document.getElementById('returnTripFields');
    const returnDate = document.getElementById('inpReturnDate');
    const returnTrain = document.getElementById('inpReturnTrain');
    if(type === 'round_trip') {
        fields.classList.remove('hidden');
        fields.classList.add('fade-in');
        returnDate.required = true;
        returnTrain.required = true;
    } else {
        fields.classList.add('hidden');
        fields.classList.remove('fade-in');
        returnDate.required = false;
        returnTrain.required = false;
        returnDate.value = '';
        returnTrain.value = '';
        document.getElementById('inpReturnWarDate').value = ''; 
    }
    setTimeout(setupFocusMode, 100); 
}

window.updatePassengerForms = function() {
    const count = parseInt(document.getElementById('inpPaxCount').value);
    const container = document.getElementById('passengerForms');
    const existingNames = document.querySelectorAll('.pax-name');
    const existingNiks = document.querySelectorAll('.pax-nik');
    let storedData = [];
    existingNames.forEach((el, i) => {
        storedData.push({ name: el.value, nik: existingNiks[i] ? existingNiks[i].value : '' });
    });

    let html = '';
    for(let i = 1; i <= count; i++) {
        const valName = storedData[i-1] ? storedData[i-1].name : '';
        const valNik = storedData[i-1] ? storedData[i-1].nik : '';
        html += `
            <div class="passenger-item border border-white/10 rounded-xl p-3 bg-white/5 relative group hover:border-davka-orange/50 transition-colors">
                <div class="absolute -left-1 top-3 w-1 h-6 bg-davka-orange rounded-r"></div>
                <p class="text-[10px] font-bold text-davka-orange mb-2 uppercase tracking-wider pl-2">Penumpang ${i}</p>
                <div class="space-y-2 pl-2">
                    <input type="text" value="${valName}" class="pax-name w-full bg-davka-bg border border-davka-border rounded-lg p-2 text-sm text-white focus:border-davka-orange focus:outline-none placeholder-gray-600" placeholder="Nama Lengkap (Sesuai KTP)" autocapitalize="characters">
                    <input type="number" value="${valNik}" class="pax-nik w-full bg-davka-bg border border-davka-border rounded-lg p-2 text-sm text-white focus:border-davka-orange focus:outline-none placeholder-gray-600" placeholder="NIK (16 Digit)">
                </div>
            </div>`;
    }
    container.innerHTML = html;
    
    calcTotalFromPax();

    setTimeout(setupFocusMode, 100);
}

window.calcTotalFromPax = function() {
    const pricePerPax = parseFloat(document.getElementById('inpPricePerPax').value) || 0;
    const paxCount = parseInt(document.getElementById('inpPaxCount').value) || 1;
    
    if (pricePerPax > 0) {
        const total = pricePerPax * paxCount;
        document.getElementById('inpPrice').value = total;
        calcRemaining(); 
    }
}

window.calcH45 = function() {
    const dateVal = document.getElementById('inpDate').value;
    if(dateVal) {
        const departDate = new Date(dateVal);
        departDate.setDate(departDate.getDate() - 45);
        document.getElementById('inpWarDate').value = departDate.toISOString().split('T')[0];
    } else document.getElementById('inpWarDate').value = "";
}
window.calcReturnH45 = function() {
    const dateVal = document.getElementById('inpReturnDate').value;
    if(dateVal) {
        const returnDate = new Date(dateVal);
        returnDate.setDate(returnDate.getDate() - 45);
        document.getElementById('inpReturnWarDate').value = returnDate.toISOString().split('T')[0];
    } else document.getElementById('inpReturnWarDate').value = "";
}
window.calcRemaining = function() {
    const price = parseFloat(document.getElementById('inpPrice').value) || 0;
    const dp = parseFloat(document.getElementById('inpFee').value) || 0;
    const remaining = price - dp;
    const field = document.getElementById('inpRemaining');
    field.value = formatRupiah(remaining);
    if(remaining <= 0) {
        field.classList.remove('text-red-500'); field.classList.add('text-green-500');
    } else {
        field.classList.remove('text-green-500'); field.classList.add('text-red-500');
    }
}

function getPassengersFromForm() {
    const paxNames = document.querySelectorAll('.pax-name');
    const paxNiks = document.querySelectorAll('.pax-nik');
    let paxList = [];
    paxNames.forEach((input, i) => {
        paxList.push({ 
            name: input.value.toUpperCase() || 'PASSENGER NAME', 
            nik: paxNiks[i] ? paxNiks[i].value : '-' 
        });
    });
    return paxList;
}

window.generateAndPreviewTicket = function() {
    const contactName = document.getElementById('inpContactName').value.toUpperCase();
    if(!contactName) { alert("Isi nama kontak dulu!"); return; }
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
    showToast("TUNGGU CETAK DATA");
    setTimeout(() => { captureAndShowModal('ticket-render-area'); }, 800); 
}

window.printReceipt = function(orderId) {
    const order = orders.find(o => o.id === orderId);
    if (!order) return;
    toggleLoader(true);
    renderReceiptToDOM(order);
    showToast("Mencetak Struk...");
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

    // Handle penumpang array vs object
    let paxCount = 1;
    if(order.passengers) paxCount = order.passengers.length;
    else if(order.name) paxCount = 1;

    const pricePerPax = order.price > 0 ? Math.round(order.price / paxCount) : 0;
    const tbody = document.getElementById('rec-items');
    tbody.innerHTML = `<tr><td colspan="2" class="pb-1 uppercase">${desc}</td></tr>
                 <tr><td class="pb-1">${paxCount} x ${formatNumber(pricePerPax)}</td><td class="text-right font-bold">${formatNumber(order.price)}</td></tr>`;

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
        paxHtml += `
            <div class="flex items-center gap-3 border-b border-gray-100 pb-2 last:border-0 last:pb-0">
                <div class="w-6 h-6 rounded-full bg-[#f8fafc] border border-gray-200 flex items-center justify-center text-[9px] font-bold text-gray-500 shrink-0">${index + 1}</div>
                <div class="flex-1 min-w-0">
                    <p class="text-xs font-black uppercase text-[#0b1c38] break-words leading-tight">${p.name}</p>
                    <p class="text-[9px] text-gray-400 font-mono tracking-wider">NIK: ${p.nik}</p>
                </div>
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
        .then(canvas => {
            showImageModal(canvas.toDataURL("image/jpeg", 0.90), true); 
            toggleLoader(false);
        })
        .catch(err => { 
            console.error("Render Error:", err); 
            toggleLoader(false); 
            alert("Gagal render gambar."); 
        });
}

window.triggerHistoryUpload = function(orderId, type) {
    currentUploadOrderId = orderId;
    currentUploadType = type;
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
    // Clear new input
    document.getElementById('inpPricePerPax').value = '';
    
    toggleTripType(); clearImage('transfer'); clearImage('chat'); updatePassengerForms(); calcRemaining();
    resetUploadZones();
}

window.renderOrderList = function(filterText = '') {
    const container = document.getElementById('ordersContainer');
    container.innerHTML = '';
    
    // Safety check jika orders belum terload
    if(!orders) return;

    const filtered = orders.filter(o => {
        const name = o.contactName || o.name || '';
        return name.toLowerCase().includes(filterText.toLowerCase());
    });

    if(filtered.length === 0) {
        document.getElementById('emptyState').classList.remove('hidden'); return;
    } else document.getElementById('emptyState').classList.add('hidden');

    filtered.forEach(order => {
        const remaining = (order.price || 0) - (order.fee || 0);
        let paxCount = 1;
        if(order.passengers) paxCount = order.passengers.length;
        else if(order.name) paxCount = 1;

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
        
        let routeHtml = '';
        if(order.tripType === 'round_trip') {
            const dateReturn = order.returnDate ? new Date(order.returnDate).toLocaleDateString('id-ID', {day:'numeric', month:'short'}) : '-';
            const warDateReturn = order.returnWarDate ? new Date(order.returnWarDate).toLocaleDateString('id-ID', {day:'numeric', month:'short'}) : '-';
            routeHtml = `
                <div class="space-y-2 my-3">
                    <div class="bg-white/5 p-3 rounded-xl border border-white/5 relative overflow-hidden">
                       <div class="absolute left-0 top-0 bottom-0 w-1 bg-davka-orange"></div>
                       <div class="flex justify-between mb-1 pl-2">
                            <span class="text-[9px] text-davka-orange font-bold uppercase tracking-wider">Keberangkatan</span> 
                            <div class="text-right"><span class="text-[9px] text-gray-400 block">${dateDepart}</span><span class="text-[10px] text-davka-orange font-bold">Beli Tiket: ${warDateDepart}</span></div>
                       </div>
                       <div class="flex justify-between items-center pl-2">
                           <h4 class="text-sm font-bold text-white">${order.origin}</h4><i class="fas fa-arrow-right text-xs text-gray-500"></i><h4 class="text-sm font-bold text-white">${order.dest}</h4>
                       </div>
                       <p class="text-[10px] text-gray-400 mt-1 pl-2"><i class="fas fa-train mr-1"></i> ${order.train}</p>
                    </div>
                    <div class="bg-white/5 p-3 rounded-xl border border-white/5 relative overflow-hidden">
                       <div class="absolute left-0 top-0 bottom-0 w-1 bg-davka-accent"></div>
                       <div class="flex justify-between mb-1 pl-2">
                            <span class="text-[9px] text-davka-accent font-bold uppercase tracking-wider">Kepulangan</span> 
                            <div class="text-right"><span class="text-[9px] text-gray-400 block">${dateReturn}</span><span class="text-[10px] text-davka-accent font-bold">Beli Tiket: ${warDateReturn}</span></div>
                       </div>
                       <div class="flex justify-between items-center pl-2">
                           <h4 class="text-sm font-bold text-white">${order.dest}</h4> <i class="fas fa-arrow-right text-xs text-gray-500"></i><h4 class="text-sm font-bold text-white">${order.origin}</h4>
                       </div>
                       <p class="text-[10px] text-gray-400 mt-1 pl-2"><i class="fas fa-train mr-1"></i> ${order.returnTrain}</p>
                    </div>
                </div>`;
        } else {
            routeHtml = `
                <div class="flex items-center gap-3 my-3 bg-white/5 p-3 rounded-xl border border-white/5">
                    <div class="text-center flex-1"><h4 class="text-xl font-black text-white truncate">${order.origin}</h4><p class="text-[9px] text-gray-400 mt-1">Asal</p></div>
                    <div class="flex-none flex flex-col items-center w-20"><i class="fas fa-arrow-right text-davka-orange text-xs mb-1"></i><p class="text-[9px] text-white font-bold">${dateDepart}</p><p class="text-[10px] text-davka-orange font-bold mt-0.5">Beli Tiket: ${warDateDepart}</p></div>
                    <div class="text-center flex-1"><h4 class="text-xl font-black text-white truncate">${order.dest}</h4><p class="text-[9px] text-gray-400 mt-1">Tujuan</p></div>
                </div>`;
        }

        const settlementOptions = ["-", "Tunai", "Transfer CIMB Niaga", "Transfer Seabank", "Dana", "Gopay", "Ovo", "ShopeePay"];
        let optionsHtml = settlementOptions.map(opt => `<option value="${opt}" ${order.settlementMethod === opt ? 'selected' : ''}>${opt === '-' ? 'Belum Lunas' : opt}</option>`).join('');

        const card = document.createElement('div');
        card.className = `glass p-5 rounded-3xl border-l-4 ${statusColor} relative overflow-hidden group transition-all duration-300 hover:shadow-glow`;
        card.innerHTML = `
            <div class="flex justify-between items-start">
                <div class="flex items-center gap-3 w-[70%]">
                    <div class="w-10 h-10 min-w-[2.5rem] rounded-full bg-gradient-to-br from-gray-700 to-black flex items-center justify-center border border-white/10 shadow-lg"><span class="font-bold text-white text-sm">${displayName.charAt(0).toUpperCase()}</span></div>
                    <div class="overflow-hidden"><h3 class="font-bold text-white text-sm leading-tight truncate">${displayName}</h3><p class="text-[10px] text-gray-400">${paxCount} Penumpang</p></div>
                </div>
                <div onclick="toggleStatus(${order.id})" class="cursor-pointer active:scale-95 transition-transform shrink-0">${statusBadge}</div>
            </div>
            ${routeHtml}
            <div class="bg-black/20 rounded-xl p-3 border border-white/5 grid grid-cols-3 gap-2 items-center mb-3">
                <div class="text-left"><p class="text-[9px] text-gray-400 uppercase">Tagihan</p><p class="text-sm font-bold text-white">${formatRupiah(order.price || 0)}</p></div>
                <div class="text-center border-l border-r border-white/10"><p class="text-[9px] text-davka-orange uppercase font-bold">DP</p><p class="text-sm font-bold text-davka-orange">${formatRupiah(order.fee || 0)}</p></div>
                <div class="text-right"><p class="text-[9px] text-gray-400 uppercase">Sisa</p><p class="text-sm font-bold ${remaining <= 0 ? 'text-green-400' : 'text-red-400'}">${formatRupiah(remaining)}</p></div>
            </div>
            <div class="space-y-3 mb-4">
                <select onchange="updateSettlement(${order.id}, this.value)" class="w-full bg-davka-bg border border-white/10 rounded-lg text-[10px] text-white p-2 outline-none focus:border-davka-orange">${optionsHtml}</select>
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
    // Gunakan tanggal lokal untuk perbandingan yang akurat
    const now = new Date();
    const today = now.toISOString().split('T')[0];
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    let cToday=0, rev=0, p=0, s=0, c=0;
    
    if(orders) {
        orders.forEach(o => {
            // Hitung Status
            if(o.status==='pending') p++; 
            else if(o.status==='success') s++; 
            else c++;

            // Parsing tanggal created_at (dari Supabase formatnya ISO String)
            let createdDate = new Date(o.created_at || o.id); // Fallback ke ID jika created_at null (data lama)
            let dateStr = createdDate.toISOString().split('T')[0];

            // Hitung Hari Ini
            if(dateStr === today) cToday++;

            // Hitung Revenue Bulan Ini (Hanya Status Success)
            if(o.status === 'success' && createdDate.getMonth() === currentMonth && createdDate.getFullYear() === currentYear) {
                rev += (o.fee || 0);
            }
        });
    }
    
    document.getElementById('stat-today').innerText = cToday;
    document.getElementById('stat-revenue').innerText = formatRupiah(rev);
    document.getElementById('stat-pending').innerText = p;
    document.getElementById('stat-success').innerText = s;
    document.getElementById('stat-cancel').innerText = c;
}
