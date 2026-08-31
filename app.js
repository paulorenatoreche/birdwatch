import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc, collection, addDoc, getDocs } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { getStorage, ref, uploadString, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-storage.js";

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

let map, cropper, currentCroppedDataUrl, currentLat, currentLng, currentCountry;
let profileChartInstance = null;

const loginScreen = document.getElementById('login-screen');
const pendingScreen = document.getElementById('pending-screen');
const mainApp = document.getElementById('main-app');
const contextMenu = document.getElementById('map-context-menu');

document.getElementById('google-login-btn').addEventListener('click', () => signInWithPopup(auth, provider));
document.getElementById('logout-btn').addEventListener('click', () => signOut(auth));
document.getElementById('logout-pending-btn').addEventListener('click', () => signOut(auth));

onAuthStateChanged(auth, async (user) => {
    if (user) {
        const userRef = doc(db, "users", user.uid);
        const userSnap = await getDoc(userRef);

        if (userSnap.exists() && userSnap.data().status === 'approved') {
            loginScreen.classList.add('hidden');
            pendingScreen.classList.add('hidden');
            mainApp.classList.remove('hidden');
            if (!map) iniciarMapa();
        } else if (!userSnap.exists()) {
            await setDoc(userRef, { name: user.displayName, email: user.email, status: 'pending' });
            loginScreen.classList.add('hidden');
            pendingScreen.classList.remove('hidden');
        } else {
            loginScreen.classList.add('hidden');
            pendingScreen.classList.remove('hidden');
        }
    } else {
        loginScreen.classList.remove('hidden');
        pendingScreen.classList.add('hidden');
        mainApp.classList.add('hidden');
    }
});

document.getElementById('toggle-sidebar-btn').addEventListener('click', () => {
    document.getElementById('sidebar').classList.toggle('collapsed');
});

// FUNÇÃO CENTRAL DE REGISTRO
function iniciarRegistro(lat, lng) {
    currentLat = lat;
    currentLng = lng;
    
    document.getElementById('bird-location').value = "Loading location...";
    document.getElementById('add-bird-modal').classList.remove('hidden');
    
    fetch(`https://nominatim.openstreetmap.org/reverse?lat=${currentLat}&lon=${currentLng}&format=json`)
        .then(res => res.json())
        .then(data => {
            const locName = data.address.city || data.address.town || data.address.state || data.address.country || "Unknown Location";
            currentCountry = data.address.country || "Unknown Country";
            document.getElementById('bird-location').value = `${locName}, ${currentCountry}`;
        });
}

function iniciarMapa() {
    map = L.map('map').setView([-14.235, -51.925], 4);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);

    const greenIcon = new L.Icon({
        iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png',
        iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34]
    });

    carregarAvesNoMapa(greenIcon);

    // DETECÇÃO DE CELULAR VS COMPUTADOR
    let contextLat, contextLng;
    
    if (L.Browser.mobile) {
        // Se for celular, clique simples no mapa já abre o registro
        map.on('click', (e) => {
            iniciarRegistro(e.latlng.lat, e.latlng.lng);
        });
    } else {
        // Se for computador, mantém o botão direito (contextmenu)
        map.on('contextmenu', (e) => {
            contextLat = e.latlng.lat;
            contextLng = e.latlng.lng;
            
            contextMenu.style.left = e.containerPoint.x + 'px';
            contextMenu.style.top = e.containerPoint.y + 'px';
            contextMenu.classList.remove('hidden');
        });

        map.on('click', () => contextMenu.classList.add('hidden'));

        document.getElementById('add-record-btn').addEventListener('click', () => {
            contextMenu.classList.add('hidden');
            iniciarRegistro(contextLat, contextLng);
        });
    }

    // Menus e Modais
    document.getElementById('nav-db').addEventListener('click', () => window.open('https://avibase.bsc-eoc.org/', '_blank'));
    document.getElementById('nav-species').addEventListener('click', abrirModalEspecies);
    document.getElementById('nav-achievements').addEventListener('click', abrirModalConquistas);
    document.getElementById('close-modal-btn').addEventListener('click', resetAndCloseDataModal);
    document.getElementById('cancel-crop-btn').addEventListener('click', () => document.getElementById('crop-modal').classList.add('hidden'));
    document.getElementById('close-species-btn').addEventListener('click', () => document.getElementById('species-modal').classList.add('hidden'));
    document.getElementById('close-achievements-btn').addEventListener('click', () => document.getElementById('achievements-modal').classList.add('hidden'));
    document.getElementById('nav-profile').addEventListener('click', abrirModalPerfil);
    document.getElementById('close-profile-btn').addEventListener('click', () => document.getElementById('profile-modal').classList.add('hidden'));

    // Lógica de Foto
    document.getElementById('bird-photo-input').addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        if (file.size > 10 * 1024 * 1024) return alert("File is larger than 10MB!");

        exifr.parse(file).then(exif => {
            if (exif && exif.DateTimeOriginal) document.getElementById('bird-date').value = exif.DateTimeOriginal.toLocaleString();
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

    // Salvar no BD
    document.getElementById('save-bird-btn').addEventListener('click', async () => {
        const btn = document.getElementById('save-bird-btn');
        btn.innerText = "Saving...";
        btn.disabled = true;

        try {
            let photoUrl = "";
            if (currentCroppedDataUrl) {
                const photoRef = ref(storage, `birds/${auth.currentUser.uid}_${Date.now()}.jpg`);
                await uploadString(photoRef, currentCroppedDataUrl, 'data_url');
                photoUrl = await getDownloadURL(photoRef);
            }

            const birdData = {
                userId: auth.currentUser.uid,
                lat: currentLat,
                lng: currentLng,
                location: document.getElementById('bird-location').value,
                country: currentCountry || "Unknown",
                date: document.getElementById('bird-date').value,
                equipment: document.getElementById('bird-equip').value,
                informalName: document.getElementById('bird-informal-name').value,
                scientificName: document.getElementById('bird-scientific-name').value,
                photoUrl: photoUrl,
                timestamp: Date.now()
            };

            await addDoc(collection(db, "birds"), birdData);

            L.marker([currentLat, currentLng], {icon: greenIcon})
              .addTo(map)
              .bindPopup(`<b>${birdData.informalName || 'Bird'}</b><br><img src="${photoUrl}" style="width:100px; border-radius:5px;"><br>${birdData.location}`)
              .openPopup();

            resetAndCloseDataModal();
        } catch (error) {
            console.error(error);
            alert("Error saving data.");
        } finally {
            btn.innerText = "Save Discovery";
            btn.disabled = false;
        }
    });
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
    currentCroppedDataUrl = null;
}

async function carregarAvesNoMapa(icon) {
    const querySnapshot = await getDocs(collection(db, "birds"));
    querySnapshot.forEach((doc) => {
        const data = doc.data();
        if (data.userId === auth.currentUser.uid) {
            L.marker([data.lat, data.lng], {icon: icon})
              .addTo(map)
              .bindPopup(`<b>${data.informalName || 'Bird'}</b><br><img src="${data.photoUrl}" style="width:100px; border-radius:5px;">`);
        }
    });
}

async function abrirModalEspecies() {
    const list = document.getElementById('species-list');
    list.innerHTML = "Loading...";
    document.getElementById('species-modal').classList.remove('hidden');

    const querySnapshot = await getDocs(collection(db, "birds"));
    list.innerHTML = "";
    querySnapshot.forEach((doc) => {
        const data = doc.data();
        if (data.userId === auth.currentUser.uid) {
            list.innerHTML += `
                <div class="species-card">
                    <img src="${data.photoUrl || ''}" alt="Bird">
                    <h3>${data.informalName || 'Unknown'}</h3>
                    <p><i>${data.scientificName || '-'}</i></p>
                    <p>📍 ${data.location}</p>
                    <p>📅 ${data.date}</p>
                </div>
            `;
        }
    });
    if (list.innerHTML === "") list.innerHTML = "<p>No species found yet. Start exploring!</p>";
}

async function abrirModalConquistas() {
    const list = document.getElementById('achievements-list');
    list.innerHTML = "Loading...";
    document.getElementById('achievements-modal').classList.remove('hidden');

    const querySnapshot = await getDocs(collection(db, "birds"));
    const countryCounts = {};
    
    querySnapshot.forEach((doc) => {
        const data = doc.data();
        if (data.userId === auth.currentUser.uid && data.country) {
            countryCounts[data.country] = (countryCounts[data.country] || 0) + 1;
        }
    });

    list.innerHTML = "";
    if (Object.keys(countryCounts).length === 0) {
        list.innerHTML = "<p>No achievements yet. Add your first record!</p>";
        return;
    }

    for (const [country, count] of Object.entries(countryCounts)) {
        const progress = Math.min(count, 10);
        const percentage = (progress / 10) * 100;
        const status = progress >= 10 ? "✅ Completed" : `${progress}/10`;
        
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
    
    // Preenche dados básicos do Google
    const user = auth.currentUser;
    document.getElementById('profile-name').innerText = user.displayName || 'Explorer';
    document.getElementById('profile-email').innerText = user.email || '';

    // Lê o banco de dados
    const querySnapshot = await getDocs(collection(db, "birds"));
    let totalBirds = 0;
    const countryCounts = {};
    
    querySnapshot.forEach((doc) => {
        const data = doc.data();
        if (data.userId === user.uid) {
            totalBirds++;
            if (data.country) {
                countryCounts[data.country] = (countryCounts[data.country] || 0) + 1;
            }
        }
    });

    // Cálculos Nerds
    const totalCountries = Object.keys(countryCounts).length;
    const conqueredCountries = Object.values(countryCounts).filter(count => count >= 10).length;

    // Atualiza os Big Numbers na tela
    document.getElementById('stat-total-birds').innerText = totalBirds;
    document.getElementById('stat-total-countries').innerText = totalCountries;
    document.getElementById('stat-conquered').innerText = conqueredCountries;

    // Destrói o gráfico antigo se houver, para não sobrepor
    if (profileChartInstance) {
        profileChartInstance.destroy();
    }

    // Prepara dados do Gráfico: Top 5 Países com mais pássaros
    const sortedCountries = Object.entries(countryCounts).sort((a, b) => b[1] - a[1]).slice(0, 5);
    const labels = sortedCountries.map(item => item[0]);
    const data = sortedCountries.map(item => item[1]);

    // Desenha o gráfico
    const ctx = document.getElementById('profileChart').getContext('2d');
    profileChartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Birds per Country',
                data: data,
                backgroundColor: '#688a42',
                borderRadius: 6
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false }
            },
            scales: {
                y: { beginAtZero: true, ticks: { stepSize: 1, color: '#5c4d42' } },
                x: { ticks: { color: '#5c4d42', font: { family: 'Nunito' } } }
            }
        }
    });
}
