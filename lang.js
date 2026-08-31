const translations = {
    en: {
        menu_map: "Main Map",
        menu_species: "Found Species",
        menu_db: "Global Database",
        menu_settings: "Settings",
        menu_account: "My Account",
        gami_progress: "Regional Progress",
        gami_text: "You found 5% of birds here. 20 species left!",
        modal_title: "Record a Bird",
        modal_informal: "Bird Name (e.g. Robin)",
        modal_scientific: "Scientific Name",
        modal_equip: "Equipment used",
        modal_save: "Save Discovery",
        modal_cancel: "Cancel"
    },
    pt: {
        menu_map: "Mapa Principal",
        menu_species: "Espécies Encontradas",
        menu_db: "Banco Global",
        menu_settings: "Configurações",
        menu_account: "Minha Conta",
        gami_progress: "Progresso Regional",
        gami_text: "Você encontrou 5% das aves aqui. Faltam 20 espécies!",
        modal_title: "Registrar Pássaro",
        modal_informal: "Nome do Pássaro (ex: Sabiá)",
        modal_scientific: "Nome Científico",
        modal_equip: "Equipamento (ex: Nikon D3500)",
        modal_save: "Salvar Descoberta",
        modal_cancel: "Cancelar"
    },
    es: {
        menu_map: "Mapa Principal",
        menu_species: "Especies Encontradas",
        menu_db: "Base Global",
        menu_settings: "Ajustes",
        menu_account: "Mi Cuenta",
        gami_progress: "Progreso Regional",
        gami_text: "Has encontrado el 5% de las aves. ¡Faltan 20!",
        modal_title: "Registrar Ave",
        modal_informal: "Nombre del Ave",
        modal_scientific: "Nombre Científico",
        modal_equip: "Equipo utilizado",
        modal_save: "Guardar Descubrimiento",
        modal_cancel: "Cancelar"
    }
};

// Começaremos em inglês, conforme solicitado
let currentLanguage = 'en'; 

function applyTranslations(lang) {
    document.querySelectorAll('[data-i18n]').forEach(element => {
        const key = element.getAttribute('data-i18n');
        if (translations[lang][key]) {
            element.textContent = translations[lang][key];
        }
    });

    document.querySelectorAll('[data-i18n-placeholder]').forEach(element => {
        const key = element.getAttribute('data-i18n-placeholder');
        if (translations[lang][key]) {
            element.placeholder = translations[lang][key];
        }
    });
}