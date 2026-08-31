// Aplica a linguagem inicial
applyTranslations(currentLanguage);

// Inicializa o Mapa (Focado no Brasil como exemplo, mas você pode mudar as coordenadas)
const map = L.map('map').setView([-14.235, -51.925], 4); 

// Adiciona o visual do mapa (Usando OpenStreetMap que é gratuito)
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap contributors'
}).addTo(map);

// Ícone Verde para as conquistas
const greenIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

// Lógica de Clique no Mapa
const modal = document.getElementById('add-bird-modal');
const closeModalBtn = document.getElementById('close-modal-btn');
const locationInput = document.getElementById('bird-location');
let currentClickLat = 0;
let currentClickLng = 0;

map.on('click', function(e) {
    currentClickLat = e.latlng.lat;
    currentClickLng = e.latlng.lng;
    
    // Abre a janela
    modal.classList.remove('hidden');
    // Preenche as coordenadas provisoriamente (no futuro usaremos uma API para pegar o nome da cidade)
    locationInput.value = `Lat: ${currentClickLat.toFixed(2)}, Lng: ${currentClickLng.toFixed(2)}`;
});

closeModalBtn.addEventListener('click', () => {
    modal.classList.add('hidden');
});

// Lógica de Salvar (Simulação antes de integrar o Banco de Dados)
document.getElementById('save-bird-btn').addEventListener('click', () => {
    const informalName = document.getElementById('bird-informal-name').value;
    
    // Adiciona o marcador verde no mapa!
    L.marker([currentClickLat, currentClickLng], {icon: greenIcon})
      .addTo(map)
      .bindPopup(`<b>${informalName || 'Bird'}</b><br>Great discovery!`)
      .openPopup();
      
    modal.classList.add('hidden');
});