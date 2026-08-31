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

let map, cropper, currentCroppedDataUrl, currentLat, currentLng;

// UI Elements
const loginScreen = document.getElementById('login-screen');
const pendingScreen = document.getElementById('pending-screen');
const mainApp = document.getElementById('main-app');

// Auth
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

function iniciarMapa() {
    map = L.map('map').setView([-14.235, -51.925], 4);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);

    const greenIcon = new L.Icon({
        iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png',
        iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34]
    });

    // Carregar aves existentes no mapa
    carregarAvesNoMapa(greenIcon);

    const modal = document.getElementById('add-bird-modal');

    map.on('click', (e) => {
        currentLat = e.latlng.lat;
        currentLng = e.latlng.lng;
        
        // Reverse Geocoding para pegar cidade/país
        fetch(`https://nominatim.openstreetmap.org/reverse?lat=${currentLat}&lon=${currentLng}&format=json`)
            .then(res => res.json())
            .then(data => {
                const locName = data.address.city || data.address.town || data.address.state || data.address.country || "Unknown Location";
                const country = data.address.country || "World";
                document.getElementById('bird-location').value = locName;
                
                // Gamification update
                const fakeTotal = country === "Brazil" ? 1919 : 10000; 
                document.getElementById('gami-region').innerText = `Progress in ${country}`;
                document.getElementById('gami-text').innerText = `Total mapped based on regional DB.`;
            });

        modal.classList.remove('hidden');
    });

    // Fechar modais
    document.getElementById('close-modal-btn').addEventListener('click', () => resetAndCloseDataModal());
    document.getElementById('cancel-crop-btn').addEventListener('click', () => document.getElementById('crop-modal').classList.add('hidden'));
    document.getElementById('close-species-btn').addEventListener('click', () => document.getElementById('species-modal').classList.add('hidden'));

    // Botões do Menu Lateral
    document.getElementById('nav-db').addEventListener('click', () => window.open('https://avibase.bsc-eoc.org/', '_blank'));
    document.getElementById('nav-species').addEventListener('click', abrirModalEspecies);

    // Lógica de Foto (EXIF e Crop)
    document.getElementById('bird-photo-input').addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        
        if (file.size > 10 * 1024 * 1024) {
            alert("File is larger than 10MB!");
            return;
        }

        // Tenta ler EXIF para Data/Hora
        exifr.parse(file).then(exif => {
            if (exif && exif.DateTimeOriginal) {
                document.getElementById('bird-date').value = exif.DateTimeOriginal.toLocaleString();
            }
        }).catch(err => console.log("No EXIF data found."));

        // Abre Crop Modal
        const reader = new FileReader();
        reader.onload = (event) => {
            document.getElementById('image-to-crop').src = event.target.result;
            document.getElementById('crop-modal').classList.remove('hidden');
            
            if (cropper) cropper.destroy();
            cropper = new Cropper(document.getElementById('image-to-crop'), {
                aspectRatio: 1, // Quadrado
                viewMode: 2
            });
        };
        reader.readAsDataURL(file);
    });

    // Confirmar Crop
    document.getElementById('confirm-crop-btn').addEventListener('click', () => {
        currentCroppedDataUrl = cropper.getCroppedCanvas({ width: 800, height: 800 }).toDataURL('image/jpeg', 0.8);
        document.getElementById('cropped-preview').src = currentCroppedDataUrl;
        document.getElementById('cropped-preview-container').classList.remove('hidden');
        document.getElementById('crop-modal').classList.add('hidden');
    });

    // Salvar no Banco de Dados
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
    let count = 0;
    querySnapshot.forEach((doc) => {
        const data = doc.data();
        if (data.userId === auth.currentUser.uid) {
            count++;
            L.marker([data.lat, data.lng], {icon: icon})
              .addTo(map)
              .bindPopup(`<b>${data.informalName || 'Bird'}</b><br><img src="${data.photoUrl}" style="width:100px; border-radius:5px;">`);
        }
    });
    // Atualiza gamificação inicial
    document.getElementById('gami-bar').style.width = `${Math.min((count / 1000) * 100, 100)}%`;
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
