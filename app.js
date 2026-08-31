import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc, collection, addDoc, getDocs, deleteDoc, updateDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
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
let editingBirdId = null; 

// Welcome Modal Lógica
if (!localStorage.getItem('birdwatch_welcome')) {
    document.getElementById('welcome-modal').classList.remove('hidden');
}

const closeWelcome = () => {
    localStorage.setItem('birdwatch_welcome', 'true');
    document.getElementById('welcome-modal').classList.add('hidden');
};
document.getElementById('close-welcome-btn').addEventListener('click', closeWelcome);
document.getElementById('close-x-welcome').addEventListener('click', closeWelcome);

// ==========================================
// LÓGICA DA PLAYLIST E AUTOPLAY 
// ==========================================
// Lembre-se de colocar aqui o nome exato dos seus arquivos MP3 na pasta music
const playlist = [
    "music/ambient01.mp3",
    "music/ambient02.mp3",
    "music/ambient03.mp3",
    "music/ambient04.mp3",
    "music/ambient05.mp3",
    "music/ambient06.mp3",
    "music/ambient07.mp3"
];

let currentTrackIndex = 0;
let isMusicPlaying = false;
const bgMusic = document.getElementById('bg-music');
const toggleMusicBtn = document.getElementById('toggle-music-btn');
const iconMusicOn = document.getElementById('icon-music-on');
const iconMusicOff = document.getElementById('icon-music-off');

function loadTrack(index) {
    bgMusic.src = playlist[index];
    bgMusic.load();
}

bgMusic.addEventListener('ended', () => {
    currentTrackIndex++;
    if (currentTrackIndex >= playlist.length) {
        currentTrackIndex = 0;
    }
    loadTrack(currentTrackIndex);
    bgMusic.play();
});

// Ação de Ligar/Desligar manualmente no Botão
toggleMusicBtn.addEventListener('click', (e) => {
    e.stopPropagation(); // Evita conflitos com o clique global
    if (bgMusic.paused) {
        if (!bgMusic.src || bgMusic.src === window.location.href) {
            loadTrack(currentTrackIndex);
        }
        bgMusic.play().then(() => {
            iconMusicOff.classList.add('hidden');
            iconMusicOn.classList.remove('hidden');
            isMusicPlaying = true;
        }).catch(err => console.log("Áudio bloqueado.", err));
    } else {
        bgMusic.pause();
        iconMusicOn.classList.add('hidden');
        iconMusicOff.classList.remove('hidden');
        isMusicPlaying = false;
    }
});

// Truque para iniciar a música no primeiro clique em qualquer lugar da tela
const startMusicOnInteraction = () => {
    if (!isMusicPlaying) {
        if (!bgMusic.src || bgMusic.src === window.location.href) {
            loadTrack(currentTrackIndex);
        }
        bgMusic.play().then(() => {
            iconMusicOff.classList.add('hidden');
            iconMusicOn.classList.remove('hidden');
            isMusicPlaying = true;
        }).catch(err => console.log("Aguardando interação para tocar."));
    }
    // Remove este evento para não sobrecarregar o site depois da primeira vez
    document.removeEventListener('click', startMusicOnInteraction);
};
document.addEventListener('click', startMusicOnInteraction);
// ==========================================

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

function iniciarRegistro(lat, lng) {
    currentLat = lat;
    currentLng = lng;
    
    document.getElementById('modal-title-bird').innerText = "Record a Discovery";
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

    atualizarPinosNoMapa();

    let contextLat, contextLng;
    
    if (L.Browser.mobile) {
        map.on('click', (e) => { iniciarRegistro(e.latlng.lat, e.latlng.lng); });
    } else {
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
    document.getElementById('nav-profile').addEventListener('click', abrirModalPerfil);
    document.getElementById('nav-about').addEventListener('click', () => document.getElementById('welcome-modal').classList.remove('hidden'));
    
    // Botões originais e X
    document.getElementById('close-modal-btn').addEventListener('click', resetAndCloseDataModal);
    document.getElementById('cancel-crop-btn').addEventListener('click', () => document.getElementById('crop-modal').classList.add('hidden'));
    document.getElementById('close-species-btn').addEventListener('click', () => document.getElementById('species-modal').classList.add('hidden'));
    document.getElementById('close-achievements-btn').addEventListener('click', () => document.getElementById('achievements-modal').classList.add('hidden'));
    document.getElementById('close-profile-btn').addEventListener('click', () => document.getElementById('profile-modal').classList.add('hidden'));

    document.getElementById('close-x-add').addEventListener('click', resetAndCloseDataModal);
    document.getElementById('close-x-crop').addEventListener('click', () => document.getElementById('crop-modal').classList.add('hidden'));
    document.getElementById('close-x-species').addEventListener('click', () => document.getElementById('species-modal').classList.add('hidden'));
    document.getElementById('close-x-achievements').addEventListener('click', () => document.getElementById('achievements-modal').classList.add('hidden'));
    document.getElementById('close-x-profile').addEventListener('click', () => document.getElementById('profile-modal').classList.add('hidden'));

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
            
            if (editingBirdId && !currentCroppedDataUrl) {
                photoUrl = window.userBirdsData[editingBirdId].photoUrl;
            } else if (currentCroppedDataUrl) {
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

            if (editingBirdId) {
                await updateDoc(doc(db, "birds", editingBirdId), birdData);
            } else {
                await addDoc(collection(db, "birds"), birdData);
            }

            resetAndCloseDataModal();
            atualizarPinosNoMapa();
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
    editingBirdId = null;
    document.getElementById('modal-title-bird').innerText = "Record a Discovery";
}

async function atualizarPinosNoMapa() {
    map.eachLayer((layer) => {
        if (layer instanceof L.Marker) {
            layer.remove();
        }
    });

    const greenIcon = new L.Icon({
        iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png',
        iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34]
    });

    const querySnapshot = await getDocs(collection(db, "birds"));
    querySnapshot.forEach((doc) => {
        const data = doc.data();
        if (data.userId === auth.currentUser.uid) {
            L.marker([data.lat, data.lng], {icon: greenIcon})
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
    window.userBirdsData = {};

    querySnapshot.forEach((doc) => {
        const data = doc.data();
        if (data.userId === auth.currentUser.uid) {
            window.userBirdsData[doc.id] = data;
            list.innerHTML += `
                <div class="species-card">
                    <img src="${data.photoUrl || ''}" alt="Bird">
                    <h3>${data.informalName || 'Unknown'}</h3>
                    <p><i>${data.scientificName || '-'}</i></p>
                    <p>📍 ${data.location}</p>
                    <p>📅 ${data.date}</p>
                    <div class="card-actions">
                        <button class="card-action-btn edit-bird-btn" data-id="${doc.id}">✏️ Edit</button>
                        <button class="card-action-btn delete-bird-btn" data-id="${doc.id}">🗑️ Delete</button>
                    </div>
                </div>
            `;
        }
    });

    if (list.innerHTML === "") {
        list.innerHTML = "<p>No species found yet. Start exploring!</p>";
    } else {
        document.querySelectorAll('.delete-bird-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                if(confirm("Are you sure you want to delete this discovery?")) {
                    const id = e.target.getAttribute('data-id');
                    await deleteDoc(doc(db, "birds", id));
                    abrirModalEspecies();
                    atualizarPinosNoMapa();
                }
            });
        });

        document.querySelectorAll('.edit-bird-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = e.target.getAttribute('data-id');
                const bird = window.userBirdsData[id];
                
                editingBirdId = id;
                currentLat = bird.lat;
                currentLng = bird.lng;
                currentCountry = bird.country;

                document.getElementById('modal-title-bird').innerText = "Edit Discovery";
                document.getElementById('bird-location').value = bird.location;
                document.getElementById('bird-date').value = bird.date;
                document.getElementById('bird-equip').value = bird.equipment;
                document.getElementById('bird-informal-name').value = bird.informalName;
                document.getElementById('bird-scientific-name').value = bird.scientificName;
                
                document.getElementById('species-modal').classList.add('hidden');
                document.getElementById('add-bird-modal').classList.remove('hidden');
            });
        });
    }
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
                countryCounts[data.country] = (countryCounts[data.country] || 0) + 1;
            }
        }
    });

    const totalCountries = Object.keys(countryCounts).length;
    const conqueredCountries = Object.values(countryCounts).filter(count => count >= 10).length;

    document.getElementById('stat-total-birds').innerText = totalBirds;
    document.getElementById('stat-total-countries').innerText = totalCountries;
    document.getElementById('stat-conquered').innerText = conqueredCountries;

    if (profileChartInstance) {
        profileChartInstance.destroy();
    }

    const sortedCountries = Object.entries(countryCounts).sort((a, b) => b[1] - a[1]).slice(0, 5);
    const labels = sortedCountries.map(item => item[0]);
    const data = sortedCountries.map(item => item[1]);

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
