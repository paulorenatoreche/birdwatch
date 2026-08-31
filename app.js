import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

// COLOQUE SUAS CHAVES AQUI
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
const provider = new GoogleAuthProvider();

// Elementos da Tela
const loginScreen = document.getElementById('login-screen');
const pendingScreen = document.getElementById('pending-screen');
const mainApp = document.getElementById('main-app');

// Botões
document.getElementById('google-login-btn').addEventListener('click', () => signInWithPopup(auth, provider));
document.getElementById('logout-btn').addEventListener('click', () => signOut(auth));
document.getElementById('logout-pending-btn').addEventListener('click', () => signOut(auth));

// Vigilante de Login e Aprovação
onAuthStateChanged(auth, async (user) => {
    if (user) {
        // Usuário logou! Vamos olhar o Banco de Dados para ver o status dele
        const userRef = doc(db, "users", user.uid);
        const userSnap = await getDoc(userRef);

        if (userSnap.exists()) {
            const userData = userSnap.data();
            if (userData.status === 'approved') {
                // APROVADO! Mostra o app e inicia o mapa
                loginScreen.classList.add('hidden');
                pendingScreen.classList.add('hidden');
                mainApp.classList.remove('hidden');
                if (!window.mapInstance) iniciarMapa();
            } else {
                // PENDENTE! Mostra tela de espera
                loginScreen.classList.add('hidden');
                pendingScreen.classList.remove('hidden');
                mainApp.classList.add('hidden');
            }
        } else {
            // PRIMEIRA VEZ ENTRANDO! Cria o perfil dele como "pending"
            await setDoc(userRef, {
                name: user.displayName,
                email: user.email,
                status: 'pending' // <--- FICA TRAVADO AQUI
            });
            // Mostra tela de espera
            loginScreen.classList.add('hidden');
            pendingScreen.classList.remove('hidden');
            mainApp.classList.add('hidden');
        }
    } else {
        // NÃO LOGADO! Mostra só o login
        loginScreen.classList.remove('hidden');
        pendingScreen.classList.add('hidden');
        mainApp.classList.add('hidden');
    }
});

// Inicialização do Mapa (Só roda se aprovado)
function iniciarMapa() {
    const map = L.map('map').setView([-14.235, -51.925], 4);
    window.mapInstance = map;

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap'
    }).addTo(map);

    const greenIcon = new L.Icon({
        iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png',
        iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34]
    });

    const modal = document.getElementById('add-bird-modal');
    let currentLat, currentLng;

    map.on('click', (e) => {
        currentLat = e.latlng.lat;
        currentLng = e.latlng.lng;
        modal.classList.remove('hidden');
    });

    document.getElementById('close-modal-btn').addEventListener('click', () => modal.classList.add('hidden'));

    document.getElementById('save-bird-btn').addEventListener('click', () => {
        const name = document.getElementById('bird-informal-name').value;
        L.marker([currentLat, currentLng], {icon: greenIcon})
          .addTo(map)
          .bindPopup(`<b>${name || 'Bird'}</b><br>Great discovery!`)
          .openPopup();
        modal.classList.add('hidden');
    });
}
