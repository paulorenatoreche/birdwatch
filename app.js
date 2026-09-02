import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc, collection, addDoc, getDocs, deleteDoc, updateDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { getStorage, ref, uploadString, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-storage.js";

// ==========================================
// 1. VARIÁVEIS GLOBAIS E FUNÇÕES ÚTEIS
// ==========================================
let map, cropper, currentCroppedDataUrl, currentLat, currentLng, currentCountry, currentState;
let profileChartInstance = null;
let editingBirdId = null;
window.userBirdsData = {};

function closeAllModals() {
    document.getElementById('species-modal').classList.add('hidden');
    document.getElementById('achievements-modal').classList.add('hidden');
    document.getElementById('profile-modal').classList.add('hidden');
    document.getElementById('add-bird-modal').classList.add('hidden');
    document.getElementById('welcome-modal').classList.add('hidden');
    document.getElementById('image-viewer-modal').classList.add('hidden');
}

function getShortCountryName(countryName) {
    if (!countryName) return "Unknown";
    const lower = countryName.toLowerCase();

    let isUSA = lower.includes("united states") || lower.includes("estados unidos") || lower.includes("usa") || lower.includes("e.e.u.u") || lower.includes("eeuu");
    let isBrazil = lower.includes("brasil") || lower.includes("brazil");

    if (isUSA) {
        if (window.currentLang === 'pt') return "EUA";
        if (window.currentLang === 'es') return "EEUU";
        return "USA";
    }
    if (isBrazil) {
        if (window.currentLang === 'pt' || window.currentLang === 'es') return "Brasil";
        return "Brazil";
    }

    return countryName;
}

// ==========================================
// 2. LÓGICA DE IDIOMAS E TRANSLATIONS (I18N)
// ==========================================
window.currentLang = localStorage.getItem('birdwatch_lang') || 'en';

function applyLanguage(lang) {
    window.currentLang = lang;
    localStorage.setItem('birdwatch_lang', lang);

    document.querySelectorAll('.lang-btn').forEach(btn => {
        btn.classList.toggle('active', btn.getAttribute('data-lang') === lang);
    });

    document.querySelectorAll('[data-i18n]').forEach(element => {
        const key = element.getAttribute('data-i18n');
        if (window.translations && window.translations[lang][key]) {
            if (element.tagName === "P" && key === "welcome_text") {
                element.innerHTML = window.translations[lang][key];
            } else {
                element.innerText = window.translations[lang][key];
            }
        }
    });

    document.querySelectorAll('[data-i18n-placeholder]').forEach(element => {
        const key = element.getAttribute('data-i18n-placeholder');
        if (window.translations && window.translations[lang][key]) {
            element.placeholder = window.translations[lang][key];
        }
    });

    if (!editingBirdId && document.getElementById('modal-title-bird')) {
        if (window.translations) document.getElementById('modal-title-bird').innerText = window.translations[lang].modal_record_title;
    }

    if (document.getElementById('species-modal') && !document.getElementById('species-modal').classList.contains('hidden')) {
        renderSpeciesList();
    }
}

document.querySelectorAll('.lang-btn').forEach(btn => {
    btn.addEventListener('click', (e) => applyLanguage(e.target.getAttribute('data-lang')));
});
setTimeout(() => { applyLanguage(window.currentLang); }, 100);

// ==========================================
// 3. CONFIGURAÇÃO DO FIREBASE
// ==========================================
const firebaseConfig = {
    apiKey: "AIzaSyCQZdI8k3D5Q5QAcLZWuo-XyiSPRS9nlOg",
    authDomain: "birdwatch-6079f.firebaseapp.com",
    projectId: "birdwatch-6079f",
    storageBucket: "birdwatch-6079f.firebasestorage.app",
    messagingSenderId: "908093112882",
    appId: "1:908093112882:web:34aa6837915200f99bf22b"
};
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);
const provider = new GoogleAuthProvider();

// ==========================================
// 4. MODAL DE BOAS-VINDAS E FECHAMENTO GLOBAL
// ==========================================
if (!localStorage.getItem('birdwatch_welcome')) {
    document.getElementById('welcome-modal').classList.remove('hidden');
}

const closeWelcome = () => {
    localStorage.setItem('birdwatch_welcome', 'true');
    document.getElementById('welcome-modal').classList.add('hidden');
};
document.getElementById('close-welcome-btn').addEventListener('click', closeWelcome);
document.getElementById('close-x-welcome').addEventListener('click', closeWelcome);

// Fechar os Modais ao clicar no fundo escurecido (fora do painel central)
const closeableModals = ['add-bird-modal', 'crop-modal', 'species-modal', 'achievements-modal', 'profile-modal', 'welcome-modal', 'image-viewer-modal'];
closeableModals.forEach(id => {
    const modal = document.getElementById(id);
    if (modal) {
        modal.addEventListener('click', (e) => {
            // e.target garante que o clique foi exatamente no background escuro (.modal/.overlay) e não no filho (.modal-content)
            if (e.target === modal) {
                if (id === 'add-bird-modal') {
                    resetAndCloseDataModal();
                } else if (id === 'welcome-modal') {
                    closeWelcome();
                } else {
                    modal.classList.add('hidden');
                }
            }
        });
    }
});

// ==========================================
// 5. LÓGICA DA PLAYLIST DE MÚSICA & OTIMIZAÇÃO iOS
// ==========================================
const playlist = [
    "music/ambient01.mp3", "music/ambient02.mp3", "music/ambient03.mp3",
    "music/ambient04.mp3", "music/ambient05.mp3", "music/ambient06.mp3",
    "music/ambient07.mp3", "music/ambient08.mp3", "music/ambient09.mp3",
    "music/ambient10.mp3"
];

let currentTrackIndex = 0;
let isMusicPlaying = false;
let audioFadeInterval;
const bgMusic = document.getElementById('bg-music');
const toggleMusicBtn = document.getElementById('toggle-music-btn');
const iconMusicOn = document.getElementById('icon-music-on');
const iconMusicOff = document.getElementById('icon-music-off');

function fadeAudio(audio, direction, duration = 1200) {
    return new Promise(resolve => {
        clearInterval(audioFadeInterval);
        let step = 50 / duration;

        if (direction === 'in') {
            audio.volume = 0;
            audio.play().catch(() => resolve());
        }

        audioFadeInterval = setInterval(() => {
            if (direction === 'in') {
                if (audio.volume < Math.max(0, 1 - step)) audio.volume += step;
                else { audio.volume = 1; clearInterval(audioFadeInterval); resolve(); }
            } else {
                if (audio.volume > step) audio.volume -= step;
                else { audio.volume = 0; clearInterval(audioFadeInterval); audio.pause(); resolve(); }
            }
        }, 50);
    });
}

function loadTrack(index) {
    bgMusic.src = playlist[index];
    bgMusic.load();
}

bgMusic.addEventListener('ended', () => {
    currentTrackIndex = (currentTrackIndex + 1) % playlist.length;
    loadTrack(currentTrackIndex);
    fadeAudio(bgMusic, 'in');
});

toggleMusicBtn.addEventListener('click', async (e) => {
    e.stopPropagation();
    if (!isMusicPlaying) {
        iconMusicOff.classList.add('hidden');
        iconMusicOn.classList.remove('hidden');
        isMusicPlaying = true;
        if (!bgMusic.src || bgMusic.src === window.location.href) loadTrack(currentTrackIndex);
        fadeAudio(bgMusic, 'in');
    } else {
        iconMusicOn.classList.add('hidden');
        iconMusicOff.classList.remove('hidden');
        isMusicPlaying = false;
        fadeAudio(bgMusic, 'out');
    }
});

const startMusicOnInteraction = () => {
    if (!isMusicPlaying) {
        if (!bgMusic.src || bgMusic.src === window.location.href) loadTrack(currentTrackIndex);

        iconMusicOff.classList.add('hidden');
        iconMusicOn.classList.remove('hidden');
        isMusicPlaying = true;

        fadeAudio(bgMusic, 'in').catch(err => console.log("Aguardando interação para tocar."));
    }

    document.removeEventListener('click', startMusicOnInteraction);
    document.removeEventListener('touchstart', startMusicOnInteraction);
};
document.addEventListener('click', startMusicOnInteraction);
document.addEventListener('touchstart', startMusicOnInteraction);

document.addEventListener("visibilitychange", () => {
    if (L.Browser.mobile) {
        if (document.hidden) {
            bgMusic.pause();
        } else {
            if (isMusicPlaying) {
                bgMusic.play().catch(err => console.log("Retomada bloqueada pelo navegador.", err));
            }
        }
    }
});

// ==========================================
// 6. AUTENTICAÇÃO E LOGIN
// ==========================================
const loginScreen = document.getElementById('login-screen');
const pendingScreen = document.getElementById('pending-screen');
const mainApp = document.getElementById('main-app');
const contextMenu = document.getElementById('map-context-menu');

document.getElementById('google-login-btn').addEventListener('click', () => {
    signInWithPopup(auth, provider).catch(error => {
        if (error.code === 'auth/unauthorized-domain') {
            alert("Erro de Segurança: O Firebase bloqueia requisições do endereço numérico 127.0.0.1. Por favor, troque o '127.0.0.1' por 'localhost' na barra de endereços do seu navegador e tente logar novamente.");
        } else {
            alert("Erro no login: " + error.message);
        }
    });
});

document.getElementById('logout-btn').addEventListener('click', () => signOut(auth));
document.getElementById('logout-pending-btn').addEventListener('click', () => signOut(auth));

document.getElementById('suggestions-btn').addEventListener('click', () => {
    window.location.href = "mailto:paulo.renato.reche@gmail.com?subject=birdWatch%20Suggestions";
});

onAuthStateChanged(auth, async (user) => {
    if (user) {
        const userRef = doc(db, "users", user.uid);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists() && userSnap.data().status === 'approved') {
            loginScreen.classList.add('hidden'); pendingScreen.classList.add('hidden'); mainApp.classList.remove('hidden');
            if (!map) iniciarMapa();
        } else if (!userSnap.exists()) {
            await setDoc(userRef, { name: user.displayName, email: user.email, status: 'pending' });
            loginScreen.classList.add('hidden'); pendingScreen.classList.remove('hidden');
        } else {
            loginScreen.classList.add('hidden'); pendingScreen.classList.remove('hidden');
        }
    } else {
        loginScreen.classList.remove('hidden'); pendingScreen.classList.add('hidden'); mainApp.classList.add('hidden');
    }
});
document.getElementById('toggle-sidebar-btn').addEventListener('click', () => document.getElementById('sidebar').classList.toggle('collapsed'));

// ==========================================
// 7. MAPA E REGISTROS PRINCIPAIS
// ==========================================
function iniciarRegistro(lat, lng) {
    currentLat = lat; currentLng = lng;
    const t = window.translations ? window.translations[window.currentLang] : { modal_record_title: "Record a Discovery", loading_loc: "Loading location...", unknown_loc: "Unknown", unknown_country: "Unknown" };

    if (!editingBirdId) {
        document.getElementById('modal-title-bird').innerText = t.modal_record_title;
        document.getElementById('update-loc-btn').style.display = 'none';
        document.getElementById('bird-location').value = t.loading_loc;
    }

    document.getElementById('add-bird-modal').classList.remove('hidden');

    fetch(`https://nominatim.openstreetmap.org/reverse?lat=${currentLat}&lon=${currentLng}&format=json`)
        .then(res => res.json())
        .then(data => {
            const locName = data.address.city || data.address.town || data.address.state || data.address.country || t.unknown_loc;
            currentCountry = data.address.country || t.unknown_country;
            currentState = data.address.state || "";
            document.getElementById('bird-location').value = `${locName}, ${getShortCountryName(currentCountry)}`;
        });
}

function iniciarMapa() {
    map = L.map('map', { zoomControl: false }).setView([-14.235, -51.925], 4);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);
    L.control.zoom({ position: 'topleft' }).addTo(map);

    L.Control.LocateMe = L.Control.extend({
        options: { position: 'topleft' },
        onAdd: function (map) {
            const btn = L.DomUtil.create('button', 'custom-leaflet-btn');
            const originalSVG = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><circle cx="12" cy="12" r="3"></circle></svg>`;
            const loadingSVG = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="animation: cozy-spin 1s linear infinite;"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>`;
            btn.innerHTML = originalSVG; btn.title = 'Find my location';

            btn.onclick = (e) => {
                e.stopPropagation(); btn.innerHTML = loadingSVG;
                map.locate({ setView: true, maxZoom: 14, enableHighAccuracy: true, timeout: 10000, maximumAge: 0 });
            };
            map.on('locationfound', () => { btn.innerHTML = originalSVG; });
            map.on('locationerror', (err) => { btn.innerHTML = originalSVG; alert(window.translations[window.currentLang].gps_error || "Please check GPS."); });
            return btn;
        }
    });
    map.addControl(new L.Control.LocateMe());

    L.Control.ZoomAll = L.Control.extend({
        options: { position: 'topleft' },
        onAdd: function (map) {
            const btn = L.DomUtil.create('button', 'custom-leaflet-btn');
            btn.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 3h6v6"/><path d="M9 21H3v-6"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/></svg>`;
            btn.title = 'Zoom to all discoveries';
            btn.onclick = (e) => { e.stopPropagation(); if (window.markerGroup && window.markerGroup.getLayers().length > 0) map.fitBounds(window.markerGroup.getBounds(), { padding: [50, 50] }); };
            return btn;
        }
    });
    map.addControl(new L.Control.ZoomAll());

    atualizarPinosNoMapa();

    let contextLat, contextLng;
    map.on('click', (e) => {
        if (window.isPickingLocation) {
            window.isPickingLocation = false;
            iniciarRegistro(e.latlng.lat, e.latlng.lng);
            return;
        }
        if (L.Browser.mobile) {
            iniciarRegistro(e.latlng.lat, e.latlng.lng);
        } else {
            contextMenu.classList.add('hidden');
        }
    });

    if (!L.Browser.mobile) {
        map.on('contextmenu', (e) => {
            if (window.isPickingLocation) return;
            contextLat = e.latlng.lat; contextLng = e.latlng.lng;
            contextMenu.style.left = e.containerPoint.x + 'px';
            contextMenu.style.top = e.containerPoint.y + 'px';
            contextMenu.classList.remove('hidden');
        });
        document.getElementById('add-record-btn').addEventListener('click', () => {
            contextMenu.classList.add('hidden');
            iniciarRegistro(contextLat, contextLng);
        });
    }

    document.getElementById('update-loc-btn').addEventListener('click', (e) => {
        e.preventDefault();
        document.getElementById('add-bird-modal').classList.add('hidden');
        window.isPickingLocation = true;
        const msg = window.translations[window.currentLang].click_map_loc || "Click anywhere on the map to set a new location.";
        alert(msg);
    });

    document.getElementById('nav-species').addEventListener('click', () => { closeAllModals(); abrirModalEspecies(); });
    document.getElementById('nav-achievements').addEventListener('click', () => { closeAllModals(); abrirModalConquistas(); });
    document.getElementById('nav-profile').addEventListener('click', () => { closeAllModals(); abrirModalPerfil(); });
    document.getElementById('nav-about').addEventListener('click', () => { closeAllModals(); document.getElementById('welcome-modal').classList.remove('hidden'); });

    document.getElementById('close-modal-btn').addEventListener('click', resetAndCloseDataModal);
    document.getElementById('close-x-add').addEventListener('click', resetAndCloseDataModal);
    document.getElementById('cancel-crop-btn').addEventListener('click', () => document.getElementById('crop-modal').classList.add('hidden'));
    document.getElementById('close-x-crop').addEventListener('click', () => document.getElementById('crop-modal').classList.add('hidden'));
    document.getElementById('close-species-btn').addEventListener('click', () => document.getElementById('species-modal').classList.add('hidden'));
    document.getElementById('close-x-species').addEventListener('click', () => document.getElementById('species-modal').classList.add('hidden'));
    document.getElementById('close-achievements-btn').addEventListener('click', () => document.getElementById('achievements-modal').classList.add('hidden'));
    document.getElementById('close-x-achievements').addEventListener('click', () => document.getElementById('achievements-modal').classList.add('hidden'));
    document.getElementById('close-profile-btn').addEventListener('click', () => document.getElementById('profile-modal').classList.add('hidden'));
    document.getElementById('close-x-profile').addEventListener('click', () => document.getElementById('profile-modal').classList.add('hidden'));

    document.getElementById('close-image-viewer').addEventListener('click', () => document.getElementById('image-viewer-modal').classList.add('hidden'));

    document.getElementById('bird-photo-input').addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const t = window.translations ? window.translations[window.currentLang] : { err_large_file: "File too large!" };
        if (file.size > 10 * 1024 * 1024) return alert(t.err_large_file);

        exifr.parse(file).then(exif => {
            if (exif && exif.DateTimeOriginal) {
                const d = new Date(exif.DateTimeOriginal);
                const year = d.getFullYear(); const month = String(d.getMonth() + 1).padStart(2, '0'); const day = String(d.getDate()).padStart(2, '0');
                document.getElementById('bird-date').value = `${year}-${month}-${day}`;
            }
        }).catch(() => console.log("No EXIF data found."));

        const reader = new FileReader();
        reader.onload = (event) => {
            document.getElementById('image-to-crop').src = event.target.result;
            document.getElementById('crop-modal').classList.remove('hidden');
            if (cropper) cropper.destroy();
            cropper = new Cropper(document.getElementById('image-to-crop'), { aspectRatio: 1, viewMode: 2 });
        };
        reader.readAsDataURL(file);
    });

    document.getElementById('confirm-crop-btn').addEventListener('click', () => {
        currentCroppedDataUrl = cropper.getCroppedCanvas({ width: 800, height: 800 }).toDataURL('image/jpeg', 0.8);
        document.getElementById('cropped-preview').src = currentCroppedDataUrl;
        document.getElementById('cropped-preview-container').classList.remove('hidden');
        document.getElementById('crop-modal').classList.add('hidden');
    });

    document.getElementById('save-bird-btn').addEventListener('click', async () => {
        const btn = document.getElementById('save-bird-btn');
        const t = window.translations ? window.translations[window.currentLang] : { btn_saving: "Saving...", btn_save: "Save Discovery", err_saving: "Error saving." };
        btn.innerText = t.btn_saving; btn.disabled = true;

        try {
            let photoUrl = "";
            if (editingBirdId && !currentCroppedDataUrl) {
                photoUrl = window.userBirdsData[editingBirdId].photoUrl;
            } else if (currentCroppedDataUrl) {
                const photoRef = ref(storage, `birds/${auth.currentUser.uid}_${Date.now()}.jpg`);
                await uploadString(photoRef, currentCroppedDataUrl, 'data_url');
                photoUrl = await getDownloadURL(photoRef);
            }

            const birdData = {
                userId: auth.currentUser.uid,
                lat: currentLat, lng: currentLng,
                location: document.getElementById('bird-location').value,
                country: currentCountry || t.unknown_country,
                state: currentState || "",
                date: document.getElementById('bird-date').value,
                equipment: document.getElementById('bird-equip').value,
                informalName: document.getElementById('bird-informal-name').value,
                scientificName: document.getElementById('bird-scientific-name').value,
                photoUrl: photoUrl,
                timestamp: Date.now()
            };

            if (editingBirdId) {
                await updateDoc(doc(db, "birds", editingBirdId), birdData);
            } else {
                await addDoc(collection(db, "birds"), birdData);
            }

            resetAndCloseDataModal();
            atualizarPinosNoMapa();
        } catch (error) {
            console.error(error); alert(t.err_saving);
        } finally {
            btn.innerText = t.btn_save; btn.disabled = false;
        }
    });

    document.getElementById('search-species').addEventListener('input', renderSpeciesList);
    document.getElementById('filter-country').addEventListener('change', renderSpeciesList);
}

function resetAndCloseDataModal() {
    document.getElementById('add-bird-modal').classList.add('hidden');
    document.getElementById('bird-photo-input').value = "";
    document.getElementById('bird-location').value = "";
    document.getElementById('bird-date').value = "";
    document.getElementById('bird-equip').value = "";
    document.getElementById('bird-informal-name').value = "";
    document.getElementById('bird-scientific-name').value = "";
    document.getElementById('cropped-preview-container').classList.add('hidden');
    document.getElementById('update-loc-btn').style.display = 'none';
    currentCroppedDataUrl = null; editingBirdId = null; window.isPickingLocation = false;
    if (window.translations) document.getElementById('modal-title-bird').innerText = window.translations[window.currentLang].modal_record_title;
}

async function atualizarPinosNoMapa() {
    if (!window.markerGroup) window.markerGroup = L.featureGroup().addTo(map);
    else window.markerGroup.clearLayers();

    const cozyPin = L.divIcon({
        className: 'clear-pin',
        html: `<svg width="34" height="34" viewBox="0 0 24 24" fill="#688a42" stroke="#5c4d42" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="filter: drop-shadow(2px 4px 4px rgba(0,0,0,0.25));"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3.5" fill="#f9f6f0"/></svg>`,
        iconSize: [34, 34], iconAnchor: [17, 34], popupAnchor: [0, -34]
    });

    const t = window.translations ? window.translations[window.currentLang] : { default_bird: "Bird" };
    const querySnapshot = await getDocs(collection(db, "birds"));
    const equipSet = new Set();
    const missingStateDocs = [];

    querySnapshot.forEach((docSnap) => {
        const data = docSnap.data();
        if (data.userId === auth.currentUser.uid) {
            if (data.equipment) equipSet.add(data.equipment);

            L.marker([data.lat, data.lng], { icon: cozyPin })
                .bindPopup(`<b>${data.informalName || t.default_bird}</b><br><img src="${data.photoUrl}" style="width:100px; border-radius:5px;">`)
                .addTo(window.markerGroup);

            const isBr = getShortCountryName(data.country) === 'Brasil' || getShortCountryName(data.country) === 'Brazil';
            if (isBr && !data.state) missingStateDocs.push({ id: docSnap.id, lat: data.lat, lng: data.lng });
        }
    });

    const equipDatalist = document.getElementById('equip-list');
    if (equipDatalist) {
        equipDatalist.innerHTML = '';
        equipSet.forEach(equip => { const opt = document.createElement('option'); opt.value = equip; equipDatalist.appendChild(opt); });
    }

    if (missingStateDocs.length > 0) {
        setTimeout(async () => {
            for (const item of missingStateDocs) {
                try {
                    const res = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${item.lat}&lon=${item.lng}&format=json`);
                    const revData = await res.json();
                    await updateDoc(doc(db, "birds", item.id), { state: revData.address.state || "Desconhecido" });
                    await new Promise(r => setTimeout(r, 1500));
                } catch (e) { }
            }
        }, 3000);
    }
}

async function abrirModalEspecies() {
    const list = document.getElementById('species-list');
    const t = window.translations ? window.translations[window.currentLang] : { loading: "Loading..." };
    list.innerHTML = t.loading;
    document.getElementById('species-modal').classList.remove('hidden');

    const querySnapshot = await getDocs(collection(db, "birds"));
    window.userBirdsData = {};
    const filterSelect = document.getElementById('filter-country');
    const countriesSet = new Set();

    querySnapshot.forEach((doc) => {
        const data = doc.data();
        if (data.userId === auth.currentUser.uid) {
            window.userBirdsData[doc.id] = data;
            if (data.country) countriesSet.add(getShortCountryName(data.country));
        }
    });

    filterSelect.innerHTML = `<option value="all">${t.filter_all}</option>`;
    countriesSet.forEach(c => filterSelect.innerHTML += `<option value="${c}">${c}</option>`);

    renderSpeciesList();
}

function renderSpeciesList() {
    const list = document.getElementById('species-list');
    const t = window.translations ? window.translations[window.currentLang] : { unknown_loc: "Unknown", btn_edit: "Edit", btn_delete: "Delete", btn_zoom: "Zoom to", no_species: "No species", confirm_delete: "Delete?", modal_edit_title: "Edit Discovery" };

    list.innerHTML = "";
    const searchVal = document.getElementById('search-species').value.toLowerCase();
    const filterCountry = document.getElementById('filter-country').value;

    let entries = Object.entries(window.userBirdsData);
    if (entries.length === 0) { list.innerHTML = `<p>${t.no_species}</p>`; return; }

    entries.forEach(([id, data]) => {
        const shortC = getShortCountryName(data.country);
        if (filterCountry !== 'all' && shortC !== filterCountry) return;
        if (searchVal && !(data.informalName || "").toLowerCase().includes(searchVal) && !(data.scientificName || "").toLowerCase().includes(searchVal)) return;

        list.innerHTML += `
            <div class="species-card">
                <img src="${data.photoUrl || ''}" alt="Bird" class="species-img-enlarge">
                <h3>${data.informalName || t.unknown_loc}</h3>
                <p><i>${data.scientificName || '-'}</i></p>
                <p>📍 ${data.location}</p>
                <p>📅 ${data.date}</p>
                <div class="card-actions">
                    <button class="card-action-btn edit-bird-btn" data-id="${id}">${t.btn_edit}</button>
                    <button class="card-action-btn delete-bird-btn" data-id="${id}">${t.btn_delete}</button>
                    <button class="card-action-btn zoom-to-btn" data-lat="${data.lat}" data-lng="${data.lng}">${t.btn_zoom}</button>
                </div>
            </div>
        `;
    });

    document.querySelectorAll('.zoom-to-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            closeAllModals();
            const lat = e.target.getAttribute('data-lat');
            const lng = e.target.getAttribute('data-lng');
            map.flyTo([lat, lng], 14, { duration: 1.5 });
        });
    });

    document.querySelectorAll('.species-img-enlarge').forEach(img => {
        img.addEventListener('click', (e) => {
            document.getElementById('viewer-img').src = e.target.src;
            document.getElementById('image-viewer-modal').classList.remove('hidden');
        });
    });

    document.querySelectorAll('.delete-bird-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            if (confirm(t.confirm_delete)) {
                const id = e.target.getAttribute('data-id');
                await deleteDoc(doc(db, "birds", id));
                delete window.userBirdsData[id];
                renderSpeciesList();
                atualizarPinosNoMapa();
            }
        });
    });

    document.querySelectorAll('.edit-bird-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const id = e.target.getAttribute('data-id');
            const bird = window.userBirdsData[id];

            editingBirdId = id; currentLat = bird.lat; currentLng = bird.lng;
            currentCountry = bird.country; currentState = bird.state || "";

            document.getElementById('modal-title-bird').innerText = t.modal_edit_title;
            document.getElementById('update-loc-btn').style.display = 'block';

            document.getElementById('bird-location').value = bird.location;
            document.getElementById('bird-date').value = bird.date;
            document.getElementById('bird-equip').value = bird.equipment || "";
            document.getElementById('bird-informal-name').value = bird.informalName || "";
            document.getElementById('bird-scientific-name').value = bird.scientificName || "";

            if (bird.photoUrl) {
                document.getElementById('cropped-preview').src = bird.photoUrl;
                document.getElementById('cropped-preview-container').classList.remove('hidden');
            } else {
                document.getElementById('cropped-preview-container').classList.add('hidden');
            }

            closeAllModals();
            document.getElementById('add-bird-modal').classList.remove('hidden');
        });
    });
}

async function abrirModalConquistas() {
    const list = document.getElementById('achievements-list');
    const t = window.translations ? window.translations[window.currentLang] : { loading: "Loading...", no_achievements: "No achievements", completed: "Completed" };

    list.innerHTML = t.loading;
    document.getElementById('achievements-modal').classList.remove('hidden');

    const querySnapshot = await getDocs(collection(db, "birds"));
    const countryCounts = {};

    querySnapshot.forEach((doc) => {
        const data = doc.data();
        if (data.userId === auth.currentUser.uid && data.country) {
            let regionKey = getShortCountryName(data.country);
            if (regionKey === 'Brasil' || regionKey === 'Brazil') {
                regionKey = data.state ? `Brasil - ${data.state}` : `Brasil (Processando...)`;
            }
            countryCounts[regionKey] = (countryCounts[regionKey] || 0) + 1;
        }
    });

    list.innerHTML = "";
    if (Object.keys(countryCounts).length === 0) { list.innerHTML = `<p>${t.no_achievements}</p>`; return; }

    const sortedAchievements = Object.entries(countryCounts).sort((a, b) => a[0].localeCompare(b[0], undefined, { sensitivity: 'base' }));

    for (const [country, count] of sortedAchievements) {
        let target = 10;
        let medal = "";

        if (count >= 50) {
            target = count;
            medal = "🥇";
        } else if (count >= 20) {
            target = 50;
            medal = "🥈";
        } else if (count >= 10) {
            target = 20;
            medal = "🥉";
        }

        const percentage = count >= 50 ? 100 : (count / target) * 100;
        const status = count >= 50 ? `${medal} 100% ✅` : (medal ? `${medal} ${count}/${target}` : `${count}/${target}`);

        list.innerHTML += `
            <div class="achievement-card">
                <div class="achievement-header">
                    <span>📍 ${country}</span>
                    <span>${status}</span>
                </div>
                <div class="progress-bar">
                    <div class="progress-fill" style="width: ${percentage}%;"></div>
                </div>
            </div>
        `;
    }
}

async function abrirModalPerfil() {
    document.getElementById('profile-modal').classList.remove('hidden');
    const t = window.translations ? window.translations[window.currentLang] : { chart_label: "Birds per Country" };

    const user = auth.currentUser;
    document.getElementById('profile-name').innerText = user.displayName || 'Explorer';
    document.getElementById('profile-email').innerText = user.email || '';

    const querySnapshot = await getDocs(collection(db, "birds"));
    let totalBirds = 0;
    const countryCounts = {};

    querySnapshot.forEach((doc) => {
        const data = doc.data();
        if (data.userId === user.uid) {
            totalBirds++;
            if (data.country) {
                let regionKey = getShortCountryName(data.country);
                if (regionKey === 'Brasil' || regionKey === 'Brazil') {
                    regionKey = data.state ? `Brasil - ${data.state}` : `Brasil (Processando...)`;
                }
                countryCounts[regionKey] = (countryCounts[regionKey] || 0) + 1;
            }
        }
    });

    const totalCountries = Object.keys(countryCounts).length;
    const conqueredCountries = Object.values(countryCounts).filter(count => count >= 10).length;

    document.getElementById('stat-total-birds').innerText = totalBirds;
    document.getElementById('stat-total-countries').innerText = totalCountries;
    document.getElementById('stat-conquered').innerText = conqueredCountries;

    if (profileChartInstance) profileChartInstance.destroy();

    const sortedCountries = Object.entries(countryCounts).sort((a, b) => b[1] - a[1]).slice(0, 5);
    const labels = sortedCountries.map(item => item[0]);
    const data = sortedCountries.map(item => item[1]);

    const ctx = document.getElementById('profileChart').getContext('2d');
    profileChartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{ label: t.chart_label, data: data, backgroundColor: '#688a42', borderRadius: 6 }]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                y: { beginAtZero: true, ticks: { stepSize: 1, color: '#5c4d42' } },
                x: { ticks: { color: '#5c4d42', font: { family: 'Nunito' } } }
            }
        }
    });
}
