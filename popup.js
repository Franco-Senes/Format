const translations = {
    es: {
        title: "Format - IA & Alt+Tab",
        statusReady: "Listo",
        statusLoading: "Organizando",
        organizeBtn: "Organizar con IA",
        analyzing: "Analizando pestañas con Gemini...",
        configTitle: "Configuración",
        lblLangSelect: "Idioma / Language",
        lblThemeColor: "Tema de Acento / Accent Theme",
        apiKeyLabel: "Gemini API Key",
        apiKeyHelp: "Obtén tu clave gratis en Google AI Studio.",
        lblAiInstructions: "Instrucciones de la IA (ej. idioma, estilo)",
        lblAiInstructionsHelp: "Añade reglas personalizadas para la agrupación (ej. traducir a otro idioma, emojis, etc.).",
        autoGroupLabel: "Agrupación Automática",
        autoGroupDesc: "Organiza pestañas en segundo plano",
        intervalLabel: "Frecuencia de Agrupación (minutos)",
        interval5: "Cada 5 minutes",
        interval15: "Cada 15 minutos",
        interval30: "Cada 30 minutos",
        interval60: "Cada hora",
        shortcutLabel: "Atajo Conmutador Alt+Tab:",
        changeShortcut: "Cambiar atajo",
        keySaved: "Configuración guardada",
        autoActive: "Agrupación automática activa",
        autoInactive: "Agrupación automática desactivada",
        intervalSet: "Intervalo fijado a {val} minutos",
        noKeyError: "Configura tu API Key primero",
        connectionError: "Error al conectar con la extensión",
        successMsg: "¡Pestañas organizadas!",
        errorMsg: "Error al organizar pestañas",
        unexpectedError: "Error inesperado",
        navHome: "Organizar",
        navSettings: "Ajustes"
    },
    en: {
        title: "Format - AI & Alt+Tab",
        statusReady: "Ready",
        statusLoading: "Organizing",
        organizeBtn: "Organize with AI",
        analyzing: "Analyzing tabs with Gemini...",
        configTitle: "Settings",
        lblLangSelect: "Idioma / Language",
        lblThemeColor: "Tema de Acento / Accent Theme",
        apiKeyLabel: "Gemini API Key",
        apiKeyHelp: "Get your free key in Google AI Studio.",
        lblAiInstructions: "AI Instructions (e.g. language, style)",
        lblAiInstructionsHelp: "Add custom rules for the AI grouping (e.g. translate to French, add emojis, etc.).",
        autoGroupLabel: "Auto-Grouping",
        autoGroupDesc: "Organize tabs in the background",
        intervalLabel: "Grouping Frequency (minutes)",
        interval5: "Every 5 minutes",
        interval15: "Every 15 minutes",
        interval30: "Every 30 minutes",
        interval60: "Every hour",
        shortcutLabel: "Alt+Tab Switcher Shortcut:",
        changeShortcut: "Configure Shortcuts",
        keySaved: "Settings saved",
        autoActive: "Auto-grouping active",
        autoInactive: "Auto-grouping inactive",
        intervalSet: "Interval set to {val} minutes",
        noKeyError: "Configure your API Key first",
        connectionError: "Error connecting to the extension",
        successMsg: "Tabs organized!",
        errorMsg: "Error organizing tabs",
        unexpectedError: "Unexpected error",
        navHome: "Organize",
        navSettings: "Settings"
    }
};

const themeSeeds = {
    sage: { h: 88, s: 25, l: 45 },
    blue: { h: 214, s: 80, l: 50 },
    purple: { h: 258, s: 45, l: 48 },
    red: { h: 0, s: 75, l: 42 },
    yellow: { h: 43, s: 90, l: 52 }
}

function hexToHsl(hex) {
    hex = hex.replace(/^#/, '');
    let r = parseInt(hex.substring(0, 2), 16) / 255;
    let g = parseInt(hex.substring(2, 4), 16) / 255;
    let b = parseInt(hex.substring(4, 6), 16) / 255;

    let max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h, s, l = (max + min) / 2;

    if (max === min) {
        h = s = 0;
    } else {
        let d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        switch (max) {
            case r: h = (g - b) / d + (g < b ? 6 : 0); break;
            case g: h = (b - r) / d + 2; break;
            case b: h = (r - g) / d + 4; break;
        }
        h /= 6;
    }
    return {h: h * 360, s: s * 100, l: l * 100};
}

function hsltoHex(h, s, l) {
    h /= 360;
    s /= 100;
    l /= 100;
    let r, g, b;

    if (s == 0) {
        r = g = b = l;
    } else {
        const hue2rgb = (p, q, t) => {
            if (t < 0) t += 1;
            if (t > 1) t -= 1;
            if (t < 1/6) return p + (q - p) * 6 * t;
            if (t < 1/2) return q;
            if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
            return p;
        };
        let q = l < 0.5 ? l * (1 + s) : l + s - l * s;
        let p = 2 * l - q;
        r = hue2rgb(p, q, h + 1/3);
        g = hue2rgb(p, q, h);
        b = hue2rgb(p, q, h - 1/3);
    }

    const toHex = x => {
        const val = Math.round(x * 255).toString(16);
        return val.length === 1 ? '0' + val : val;
    };
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

document.addEventListener("DOMContentLoaded", async () => {
    const navHomeBtn = document.getElementById('navHomeBtn');
    const navSettingsBtn = document.getElementById('navSettingsBtn');
    const tabHomePanel = document.getElementById('tabHomePanel');
    const tabSettingsPanel = document.getElementById('tabSettingsPanel');

    const langInput = document.getElementById('langInput');
    const apikeyInput = document.getElementById('apiKey');
    const toggleApiVisibilityBtn = document.getElementById('toggleApiVisibility');
    const aiInstructionsInput = document.getElementById('aiInstructions');
    const autoGroupToggle = document.getElementById('autoGroupingToggle');
    const intervalGroup = document.getElementById('intervalGroup');
    const intervalInput = document.getElementById('intervalInput');
    const groupBtn = document.getElementById('groupBtn');
    const loadingText = document.getElementById('LoadingText');
    const statusBadge = document.getElementById('statusBadge');
    const statusDot = statusBadge.querySelector('.status-dot');
    const statusText = statusBadge.querySelector('.status-text');
    const changeShortcutLink = document.getElementById('changeShortcutLink');
    const colorDots = document.querySelectorAll('.color-dot');
    const customColorBtn = document.getElementById('customColorBtn');
    const customColorPicker = document.getElementById('customColorPicker');

    const settings = await chrome.storage.local.get({
        geminiApiKey: '',
        autoGroupEnabled: false,
        autoGroupInterval: 15,
        language: 'en',
        themeColor: 'blue',
        customColorValue: '#1a73e8',
        aiInstructions: ''
    });

    const currentLang = settings.language;
    const currentTheme = settings.themeColor;

    langInput.value = currentLang;
    apikeyInput.value = settings.geminiApiKey;
    aiInstructionsInput.value = settings.aiInstructions || '';
    autoGroupToggle.checked = settings.autoGroupEnabled;
    intervalInput.value = settings.autoGroupInterval.toString();
    customColorPicker.value = settings.customColorValue;

    applyTranslations(currentLang);
    applyThemeColors(currentTheme, settings.customColorValue);

    colorDots.forEach(dot => {
        if (dot.dataset.color === currentTheme) {
            dot.classList.add('active');
            if (currentTheme === 'custom') {
                dot.style.background = settings.customColorValue;
            }
        } else {
            dot.classList.remove('active');
            if (dot.id === 'customColorBtn') {
                dot.style.background = 'linear-gradient(45deg, #ff0000, #ff7f00, #ffff00, #00ff00, #0000ff, #4b0082, #8b00ff)';
            }
        }
    });

    if (settings.autoGroupEnabled) {
        intervalGroup.classList.remove('hidden');
    } else {
        intervalGroup.classList.add('hidden');
    }

    navHomeBtn.addEventListener('click', () => {
        navHomeBtn.classList.add('active');
        navSettingsBtn.classList.remove('active');
        tabHomePanel.classList.remove('hidden');
        tabSettingsPanel.classList.add('hidden');
    });

    navSettingsBtn.addEventListener('click', () => {
        navSettingsBtn.classList.add('active');
        navHomeBtn.classList.remove('active');
        tabSettingsPanel.classList.remove('hidden');
        tabHomePanel.classList.add('hidden');
    });

    langInput.addEventListener('change', async () => {
        const newLang = langInput.value;
        await chrome.storage.local.set({ language: newLang });
        applyTranslations(newLang);
        showNotification(translations[newLang].keySaved, 'success');
    });

    colorDots.forEach(dot => {
        dot.addEventListener('click', async () => {
            const chosenColor = dot.dataset.color;

            if (chosenColor === 'custom') {
                customColorPicker.click();
                return;
            }
            colorDots.forEach(d => d.classList.remove('active'));
            dot.classList.add('active');
            customColorBtn.style.background = 'linear-gradient(45deg, #ff0000, #ff7f00, #ffff00, #00ff00, #0000ff, #4b0082, #8b00ff)';

            await chrome.storage.local.set({ themeColor: chosenColor });

            const activeSettings = await chrome.storage.local.get({ customColorValue: '#1a73e8' });
            applyThemeColors(chosenColor, activeSettings.customColorValue);
        });
    });

    customColorPicker.addEventListener('change', async (e) => {
        const customHex = e.target.value;

        await chrome.storage.local.set({
            themeColor: 'custom',
            customColorValue: customHex
        });

        colorDots.forEach(d => d.classList.remove('active'));
        customColorBtn.classList.add('active');
        customColorBtn.style.background = customHex;

        applyThemeColors('custom', customHex);
    });

    toggleApiVisibilityBtn.addEventListener('click', () => {
        if (apikeyInput.type === 'password') {
            apikeyInput.type = 'text';
        } else {
            apikeyInput.type = 'password';
        }
    });

    apikeyInput.addEventListener('change', async () => {
        const key = apikeyInput.value.trim();
        await chrome.storage.local.set({ geminiApiKey: key });
        showNotification(translations[langInput.value].keySaved, 'success');
    });

    aiInstructionsInput.addEventListener('change', async () => {
        const text = aiInstructionsInput.value.trim();
        await chrome.storage.local.set({ aiInstructions: text });
        showNotification(translations[langInput.value].keySaved, 'success');
    });

    autoGroupToggle.addEventListener('change', async () => {
        const isEnabled = autoGroupToggle.checked;
        const lang = langInput.value;

        if (isEnabled) {
            intervalGroup.classList.remove('hidden');
        } else {
            intervalGroup.classList.add('hidden');
        }

        await chrome.storage.local.set({ autoGroupEnabled: isEnabled });

        chrome.runtime.sendMessage({
            action: 'update_settings',
            settings: { autoGroupEnabled: isEnabled, autoGroupInterval: parseInt(intervalInput.value) }
        });

        showNotification(
            isEnabled ? translations[lang].autoActive : translations[lang].autoInactive,
            'success'
        );
    });

    intervalInput.addEventListener('change', async () => {
        const intervalVal = parseInt(intervalInput.value);
        const lang = langInput.value;
        await chrome.storage.local.set({ autoGroupInterval: intervalVal })

        chrome.runtime.sendMessage({
            action: 'update_settings',
            settings: { autoGroupEnabled: autoGroupToggle.checked, autoGroupInterval: intervalVal }
        });

        const msg = translations[lang].intervalSet.replace('{val}', intervalVal);
        showNotification(msg, 'success');
    });

    groupBtn.addEventListener('click', async () => {
        const apiKey = apikeyInput.value.trim();
        const lang = langInput.value;
        if (!apiKey) {
            showNotification(translations[lang].noKeyError, 'error');
            apikeyInput.focus();
            return;
        }
        setLoadingState(true);

        try {
            chrome.runtime.sendMessage({ action: 'group_tabs_now' }, (response) => {
                setLoadingState(false);
                if (chrome.runtime.lastError) {
                    console.error(chrome.runtime.lastError);
                    showNotification(translations[lang].connectionError, 'error');
                    return;
                }
                if (response && response.success) {
                    showNotification(translations[lang].successMsg, 'success');
                } else {
                    showNotification(response?.error || translations[lang].errorMsg, 'error');
                }
            });
        } catch (err) {
            console.error(err);
            setLoadingState(false);
            showNotification(translations[lang].unexpectedError, 'error');
        }
    });

    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', async () => {
        const currentSettings = await chrome.storage.local.get({ themeColor: 'blue', customColorValue: '#1a73e8' });
        applyThemeColors(currentSettings.themeColor, currentSettings.customColorValue);
    });

    function applyTranslations(lang) {
        const t = translations[lang] || translations['en'];

        document.getElementById('pageTitle').textContent = t.title;
        document.getElementById('lblLangSelect').textContent = t.lblLangSelect;
        document.getElementById('lblThemeColor').textContent = t.lblThemeColor;
        document.getElementById('lblApiKey').textContent = t.apiKeyLabel;
        document.getElementById('lblApiKeyHelp').textContent = t.apiKeyHelp;
        document.getElementById('lblAiInstructions').textContent = t.lblAiInstructions;
        document.getElementById('lblAiInstructionsHelp').textContent = t.lblAiInstructionsHelp;
        document.getElementById('lblAutoGroup').textContent = t.autoGroupLabel;
        document.getElementById('lblAutoGroupDesc').textContent = t.autoGroupDesc;
        document.getElementById('lblInterval').textContent = t.intervalLabel;
        document.getElementById('lblShortcut').textContent = t.shortcutLabel;
        document.getElementById('changeShortcutLink').textContent = t.changeShortcut;
        document.getElementById('btnGroupText').textContent = t.organizeBtn;
        document.getElementById('LoadingText').textContent = t.analyzing;

        document.getElementById('optInt5').textContent = t.interval5;
        document.getElementById('optInt15').textContent = t.interval15;
        document.getElementById('optInt30').textContent = t.interval30;
        document.getElementById('optInt60').textContent = t.interval60;

        document.getElementById('navLblHome').textContent = t.navHome;
        document.getElementById('navLblSettings').textContent = t.navSettings;

        if (statusText.textContent === 'Listo' || statusText.textContent === 'Ready') {
            statusText.textContent = t.statusReady;
        } else if (statusText.textContent === 'Organizando' || statusText.textContent === 'Organizing') {
            statusText.textContent = t.statusLoading;
        }
    }

    function applyThemeColors(themeColor, customColorVal) {
        const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        let seed;

        if (themeColor === 'custom') {
            seed = hexToHsl(customColorVal);
        } else {
            seed = themeSeeds[themeColor] || themeSeeds.blue;
        }

        const root = document.documentElement;

        if (!isDark) {
            root.style.setProperty('--bg-color', `hsl(${seed.h}, 20%, 97%)`);
            root.style.setProperty('--card-bg', `hsl(${seed.h}, 22%, 93%)`);
            root.style.setProperty('--input-bg', `hsl(${seed.h}, 18%, 87%)`);
            root.style.setProperty('--kbd-bg', `hsl(${seed.h}, 18%, 87%)`);
            root.style.setProperty('--border-color', `hsl(${seed.h}, 15%, 83%)`);

            root.style.setProperty('--text-primary', `hsl(${seed.h}, 30%, 12%)`);
            root.style.setProperty('--text-secondary', `hsl(${seed.h}, 16%, 32%)`);

            const primaryL = Math.min(60, seed.l);
            root.style.setProperty('--primary-color', `hsl(${seed.h}, ${Math.max(40, seed.s)}%, ${primaryL}%)`);
            root.style.setProperty('--primary-hover', `hsl(${seed.h}, ${Math.max(40, seed.s)}%, ${Math.max(15, primaryL - 10)}%)`);

            const textOnPrimary = seed.l > 60 || seed.h === 43 || (seed.h === 88 && seed.l > 45) ? '#191c17' : '#ffffff';
            root.style.setProperty('--text-on-primary', textOnPrimary);

            root.style.setProperty('--secondary-bg', `hsl(${seed.h}, 20%, 84%)`);
            root.style.setProperty('--text-on-secondary', `hsl(${seed.h}, 30%, 15%)`);

            root.style.setProperty('--toggle-track-on', `hsl(${seed.h}, ${Math.max(30, seed.s)}%, 75%)`);
            root.style.setProperty('--toggle-knob-on', `hsl(${seed.h}, ${Math.max(40, seed.s)}%, ${primaryL}%)`);
            root.style.setProperty('--toggle-track-off', `hsl(${seed.h}, 10%, 82%)`);
            root.style.setProperty('--toggle-knob-off', `hsl(${seed.h}, 10%, 96%)`);

            root.style.setProperty('--success-color', `#386a20`);
            root.style.setProperty('--error-color', `#ba1a1a`);
        } else {
            root.style.setProperty('--bg-color', `hsl(${seed.h}, 12%, 8%)`);
            root.style.setProperty('--card-bg', `hsl(${seed.h}, 14%, 13%)`);
            root.style.setProperty('--input-bg', `hsl(${seed.h}, 15%, 19%)`);
            root.style.setProperty('--kbd-bg', `hsl(${seed.h}, 15%, 19%)`);
            root.style.setProperty('--border-color', `hsl(${seed.h}, 10%, 22%)`);

            root.style.setProperty('--text-primary', `hsl(${seed.h}, 15%, 90%)`);
            root.style.setProperty('--text-secondary', `hsl(${seed.h}, 10%, 72%)`);

            const primaryL = 75;
            root.style.setProperty('--primary-color', `hsl(${seed.h}, ${Math.min(75, seed.s)}%, ${primaryL}%)`);
            root.style.setProperty('--primary-hover', `hsl(${seed.h}, ${Math.min(75, seed.s)}%, 85%)`);
            root.style.setProperty('--text-on-primary', `#1a1c18`);

            root.style.setProperty('--secondary-bg', `hsl(${seed.h}, 15%, 22%)`);
            root.style.setProperty('--text-on-secondary', `hsl(${seed.h}, 15%, 90%)`);

            root.style.setProperty('--toggle-track-on', `hsl(${seed.h}, 25%, 25%)`);
            root.style.setProperty('--toggle-knob-on', `hsl(${seed.h}, ${Math.min(75, seed.s)}%, ${primaryL}%)`);
            root.style.setProperty('--toggle-track-off', `hsl(${seed.h}, 10%, 25%)`);
            root.style.setProperty('--toggle-knob-off', `hsl(${seed.h}, 10%, 72%)`);

            root.style.setProperty('--success-color', `#b5cc95`);
            root.style.setProperty('--error-color', `#ffb4ab`);
        }
    }

    function setLoadingState(isLoading) {
        const lang = langInput.value;
        const t = translations[lang];
        if (isLoading) {
            groupBtn.disabled = true;
            groupBtn.style.opacity = '0.7';
            loadingText.classList.remove('hidden');
            statusDot.className = 'status-dot loading';
            statusText.textContent = t.statusLoading;
        } else {
            groupBtn.disabled = false;
            groupBtn.style.opacity = '1';
            loadingText.classList.add('hidden');
            statusDot.className = 'status-dot';
            statusText.textContent = t.statusReady;
        }
    }

    function showNotification(message, type) {
        const lang = langInput.value;
        statusText.textContent = message;
        statusDot.className = `status-dot ${type}`;

        setTimeout(() => {
            statusDot.className = 'status-dot';
            statusText.textContent = translations[lang].statusReady;
        }, 3000);
    }
});