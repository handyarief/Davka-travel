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
    const next = current === 'pending' ? 'success' : 'pending';
    
    orders[index].status = next;
    renderOrderList(document.getElementById('searchInput').value);
    renderStats();
    
    try {
        await supabase.from('orders').update({ status: next }).eq('id', id);
    } catch(e) {
        console.error(e);
    }
}

// --- MISSING LOGIC IMPLEMENTATIONS ---

function renderOrderList(search = '') {
    const listContainer = document.getElementById('list-container');
    if (!listContainer) return;
    
    listContainer.innerHTML = '';
    
    const filtered = orders.filter(o => 
        o.contactName.toLowerCase().includes(search.toLowerCase()) || 
        o.id.toString().includes(search)
    );

    filtered.forEach((o, idx) => {
        const globalIdx = orders.findIndex(order => order.id === o.id);
        const card = document.createElement('div');
        card.className = 'glass p-4 rounded-2xl border-l-4 ' + (o.status === 'success' ? 'border-green-500' : 'border-davka-orange');
        
        card.innerHTML = `
            <div class="flex justify-between items-start mb-2">
                <div>
                    <h3 class="font-bold text-white text-lg">${o.contactName}</h3>
                    <p class="text-[10px] text-gray-400 font-mono">ID: ${o.id}</p>
                </div>
                <div class="text-right">
                    <span class="px-2 py-1 rounded text-[10px] font-bold ${o.status === 'success' ? 'bg-green-500/20 text-green-400' : 'bg-davka-orange/20 text-davka-orange'} uppercase">
                        ${o.status}
                    </span>
                </div>
            </div>
            <div class="grid grid-cols-2 gap-2 text-xs text-gray-300 mb-3">
                <div><i class="fas fa-train w-4 text-center"></i> ${o.train}</div>
                <div><i class="fas fa-calendar w-4 text-center"></i> ${o.date}</div>
                <div><i class="fas fa-route w-4 text-center"></i> ${o.origin} -> ${o.dest}</div>
                <div><i class="fas fa-users w-4 text-center"></i> ${o.passengers.length} Pax</div>
            </div>
            <div class="flex gap-2 mt-2 pt-2 border-t border-white/5 overflow-x-auto no-scrollbar">
                <button onclick="editOrder(${globalIdx})" class="flex-1 bg-white/5 hover:bg-white/10 py-2 rounded-lg text-[10px] font-bold text-white transition-colors"><i class="fas fa-edit mr-1"></i> EDIT</button>
                <button onclick="renderTicket(${o.id})" class="flex-1 bg-blue-500/20 hover:bg-blue-500/30 py-2 rounded-lg text-[10px] font-bold text-blue-400 transition-colors"><i class="fas fa-ticket-alt mr-1"></i> TIKET</button>
                <button onclick="toggleStatus(${o.id})" class="w-10 bg-white/5 hover:bg-white/10 rounded-lg flex items-center justify-center text-white"><i class="fas fa-check-circle"></i></button>
                <button onclick="deleteOrder(${o.id})" class="w-10 bg-red-500/20 hover:bg-red-500/30 rounded-lg flex items-center justify-center text-red-400"><i class="fas fa-trash"></i></button>
            </div>
        `;
        listContainer.appendChild(card);
    });
}

// FIX: Update renderTicket untuk menampilkan NIK
window.renderTicket = async function(id) {
    const order = orders.find(o => o.id === id);
    if (!order) return;

    toggleLoader(true);
    
    try {
        const area = document.getElementById('ticket-render-area');
        
        let passHTML = '';
        order.passengers.forEach(p => {
            // PERBAIKAN: Menambahkan baris NIK agar terlihat di tiket
            passHTML += `
            <div class="border-b border-gray-300 border-dashed pb-2 mb-2 last:border-0">
                <div class="flex justify-between font-bold text-sm text-slate-800">
                    <span class="uppercase">${p.name}</span>
                    <span>${p.seat || 'Any'}</span>
                </div>
                <div class="flex justify-between text-[10px] text-slate-500 mt-1">
                    <span class="font-mono">NIK: ${p.nik || '-'}</span>
                    <span class="uppercase">${p.type}</span>
                </div>
            </div>`;
        });

        // Template Tiket Clean & Putih untuk Print
        area.innerHTML = `
            <div class="w-full h-full bg-white text-slate-800 p-6 relative overflow-hidden">
                <div class="flex justify-between items-center border-b-2 border-slate-800 pb-4 mb-4">
                    <div>
                        <h1 class="font-serif text-2xl font-bold tracking-widest text-slate-900">DAVKA</h1>
                        <p class="text-[10px] tracking-[0.3em] uppercase text-slate-500">Luxury Travel Service</p>
                    </div>
                    <div class="text-right">
                        <h2 class="font-bold text-lg text-davka-orange">E-TICKET</h2>
                        <p class="font-mono text-xs text-slate-400">#${order.id.toString().substr(-6)}</p>
                    </div>
                </div>

                <div class="grid grid-cols-2 gap-4 mb-6 text-xs font-mono border-b border-gray-200 pb-6">
                    <div>
                        <p class="text-slate-400 text-[10px]">KERETA / NO</p>
                        <p class="font-bold text-sm uppercase">${order.train}</p>
                    </div>
                    <div>
                        <p class="text-slate-400 text-[10px]">TANGGAL</p>
                        <p class="font-bold text-sm">${order.date}</p>
                    </div>
                    <div>
                        <p class="text-slate-400 text-[10px]">ASAL</p>
                        <p class="font-bold text-sm uppercase">${order.origin}</p>
                    </div>
                    <div>
                        <p class="text-slate-400 text-[10px]">TUJUAN</p>
                        <p class="font-bold text-sm uppercase">${order.dest}</p>
                    </div>
                </div>

                <div class="bg-slate-50 rounded-lg p-4 mb-4 border border-slate-100">
                    <h3 class="text-[10px] font-bold text-slate-400 mb-3 uppercase tracking-wider">Detail Penumpang</h3>
                    ${passHTML}
                </div>

                <div class="text-center mt-8 opacity-50">
                    <p class="text-[8px] uppercase tracking-widest text-slate-400">Valid Travel Document</p>
                    <div class="w-32 h-1 bg-slate-200 mx-auto mt-2 rounded-full"></div>
                </div>
                
                <div class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 rounded-full border-4 border-slate-100 opacity-20 pointer-events-none z-0"></div>
            </div>
        `;

        await new Promise(r => setTimeout(r, 500)); // Tunggu render
        
        const canvas = await html2canvas(area, { scale: 2, useCORS: true });
        const imgUrl = canvas.toDataURL('image/jpeg', 0.9);
        
        // Download Trigger
        const link = document.createElement('a');
        link.download = `TIKET-${order.contactName}-${order.id}.jpg`;
        link.href = imgUrl;
        link.click();
        
        showToast("Tiket berhasil didownload!");

    } catch (e) {
        console.error(e);
        showToast("Gagal generate tiket");
    } finally {
        toggleLoader(false);
    }
}

// Helpers Form Penumpang
function updatePassengerForms() {
    const count = parseInt(document.getElementById('inpPaxCount').value) || 1;
    const container = document.getElementById('passengers-container');
    container.innerHTML = '';

    for(let i=0; i<count; i++) {
        const row = document.createElement('div');
        row.className = 'passenger-row grid grid-cols-12 gap-2 mb-3 items-end animate-slide-up';
        row.style.animationDelay = `${i*0.1}s`;
        
        row.innerHTML = `
            <div class="col-span-1 flex items-center justify-center pb-3">
                <span class="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center text-[10px] font-bold">${i+1}</span>
            </div>
            <div class="col-span-11 space-y-2">
                <div class="grid grid-cols-2 gap-2">
                    <input type="text" placeholder="Nama Lengkap" class="inp-pax-name w-full bg-davka-surface border border-white/10 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-davka-orange transition-colors uppercase">
                    <input type="text" placeholder="NIK / ID" class="inp-pax-nik w-full bg-davka-surface border border-white/10 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-davka-orange transition-colors"> 
                </div>
                <div class="grid grid-cols-2 gap-2">
                    <select class="inp-pax-type w-full bg-davka-surface border border-white/10 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-davka-orange">
                        <option value="Dewasa">Dewasa</option>
                        <option value="Anak">Anak</option>
                        <option value="Bayi">Bayi</option>
                    </select>
                    <input type="text" placeholder="Kursi (Opsional)" class="inp-pax-seat w-full bg-davka-surface border border-white/10 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-davka-orange transition-colors uppercase">
                </div>
            </div>
        `;
        container.appendChild(row);
    }
}

function getPassengersFromForm() {
    const rows = document.querySelectorAll('.passenger-row');
    return Array.from(rows).map(row => ({
        name: row.querySelector('.inp-pax-name').value.toUpperCase(),
        nik: row.querySelector('.inp-pax-nik').value, // Pastikan NIK diambil
        type: row.querySelector('.inp-pax-type').value,
        seat: row.querySelector('.inp-pax-seat').value.toUpperCase()
    }));
}

// Helpers Lainnya (Boilerplate)
function updateDate() {
    const now = new Date();
    const opts = { weekday: 'short', day: 'numeric', month: 'short' };
    document.getElementById('current-date').innerText = now.toLocaleDateString('id-ID', opts);
}

function updateGreeting() {
    const h = new Date().getHours();
    let t = 'Pagi';
    if(h >= 11) t = 'Siang';
    if(h >= 15) t = 'Sore';
    if(h >= 18) t = 'Malam';
    document.getElementById('txt-greeting-time').innerText = `Selamat ${t},`;
}

function toggleLoader(show) {
    const l = document.getElementById('global-loader');
    if(show) l.classList.remove('hidden'); else l.classList.add('hidden');
}

function showToast(msg) {
    // Simple toast logic, create element if not exists
    let t = document.getElementById('toast');
    if(!t) {
        t = document.createElement('div');
        t.id = 'toast';
        t.className = 'fixed top-4 left-1/2 -translate-x-1/2 bg-white/90 text-black px-6 py-2 rounded-full text-xs font-bold shadow-xl z-[9999] transition-all duration-300 opacity-0 translate-y-[-20px]';
        document.body.appendChild(t);
    }
    t.innerText = msg;
    t.classList.remove('opacity-0', 'translate-y-[-20px]');
    setTimeout(() => {
        t.classList.add('opacity-0', 'translate-y-[-20px]');
    }, 3000);
}

function resetForm() {
    document.getElementById('orderForm').reset();
    document.getElementById('editIndex').value = '-1';
    document.getElementById('previewTransfer').innerHTML = '';
    document.getElementById('previewChat').innerHTML = '';
    document.getElementById('inpTransferData').value = '';
    document.getElementById('inpChatData').value = '';
    updatePassengerForms();
}

function resetUploadZones() {
    // Reset visual upload zones
}

function setupImageUploader(inputId, dataId, imgId, previewId) {
    const input = document.getElementById(inputId);
    if(!input) return;
    
    input.addEventListener('change', function() {
        if(this.files && this.files[0]) {
            const reader = new FileReader();
            reader.onload = function(e) {
                document.getElementById(dataId).value = e.target.result;
                const p = document.getElementById(previewId);
                p.innerHTML = `<img src="${e.target.result}" class="w-full h-full object-cover rounded-xl">`;
            };
            reader.readAsDataURL(this.files[0]);
        }
    });
}

function setupHistoryUploader() {
    // Placeholder for history uploader logic if needed
}

window.editOrder = function(index) {
    const o = orders[index];
    document.getElementById('editIndex').value = index;
    
    document.getElementById('inpContactName').value = o.contactName;
    document.getElementById('inpContactPhone').value = o.contactPhone;
    document.getElementById('inpAddress').value = o.address;
    document.getElementById('inpOrigin').value = o.origin;
    document.getElementById('inpDest').value = o.dest;
    document.getElementById('inpDate').value = o.date;
    document.getElementById('inpTrain').value = o.train;
    document.getElementById('inpPrice').value = o.price;
    document.getElementById('inpFee').value = o.fee || 0;
    document.getElementById('inpPaxCount').value = o.passengers.length;
    
    updatePassengerForms();
    
    // Fill passenger data after inputs generated
    setTimeout(() => {
        const rows = document.querySelectorAll('.passenger-row');
        o.passengers.forEach((p, i) => {
            if(rows[i]) {
                rows[i].querySelector('.inp-pax-name').value = p.name;
                rows[i].querySelector('.inp-pax-nik').value = p.nik || '';
                rows[i].querySelector('.inp-pax-seat').value = p.seat || '';
                rows[i].querySelector('.inp-pax-type').value = p.type || 'Dewasa';
            }
        });
    }, 100);

    showToast("Mode Edit Aktif");
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
    // Asumsi elemen ID ada di HTML dashboard
    const elToday = document.getElementById('stat-today');
    if(elToday) elToday.innerText = cToday;
}
