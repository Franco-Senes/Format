let tabHistory = [];

chrome.runtime.onStartup.addListener(initializeTabHistory);
chrome.runtime.onInstalled.addListener(async () => {
    initializeTabHistory();
    const settings = await chrome.storage.local.get(['geminiApiKey', 'autoGroupEnabled', 'autoGroupInterval', 'language', 'themeColor']);
    if (settings.autoGroupEnabled == undefined) {
        await chrome.storage.local.set({ autoGroupEnabled: false });
    }
    if (settings.language === undefined) {
        await chrome.storage.local.set({ language: 'en' });
    }
    if (settings.themeColor === undefined) {
        await chrome.storage.local.set({ themeColor: 'sage' });
    }
    setupAlarms();
});

function initializeTabHistory() {
    chrome.tabs.query({}, (tabs) => {

    });
}

chrome.tabs.onActivated.addListener((activeInfo) => {
   updateHistory(activeInfo.tabId);
});

chrome.tabs.onRemoved.addListener((tabId) => {
    tabHistory = tabHistory.filter(id => id !== tabId);
});

chrome.tabs.onCreated.addListener((tab) => {
   updateHistory(tab.id);
});

function updateHistory(tabId) {
    tabHistory = tabHistory.filter(id => id !== tabId);
    tabHistory.unshift(tabId);
}

async function ensureScriptInjected(tabId){
    try {
        // Try sending a ping to see if content script is already there
        await chrome.tabs.sendMessage(tabId, { action: 'ping' });
        return true;
    } catch (err) {

        console.log(`injecting change window script ${tabId}...`);
        try {
            await chrome.scripting.executeScript({
                target: { tabId: tabId },
                files: ['switcher.js']
            });
            await chrome.scripting.insertCSS({
                target: { tabId: tabId },
                files: ['switcher.css']
            });
            return true;
        } catch (injectErr) {
            console.error('error injecting change window script:', injectErr);
            return false;
        }
    }
}

chrome.commands.onCommand.addListener(async (command) => {
    if (command === 'toggle-tab-switcher') {
        const activeTabs = await chrome.tabs.query({ active: true, currentWindow: true });
        if (activeTabs.length === 0) return;
        const activeTab = activeTabs[0];

        // Get all tabs in current window
        const windowTabs = await chrome.tabs.query({ currentWindow: true });
        // filter websites where it can be injected
        const validWindowTabs = windowTabs.filter(tab =>
            tab.url &&
            !tab.url.startsWith('chrome://') &&
            !tab.url.startsWith('edge://') &&
            !tab.url.startsWith('about:') &&
            !tab.url.startsWith('https://chromewebstore.google.com')
        );

        const isCurrentTabValid = validWindowTabs.some(t => t.id === activeTab.id);
        if (!isCurrentTabValid) {
            console.log('cant not inject to system windows');
            return;
        }

        validWindowTabs.sort((a, b) => {
            const idxA = tabHistory.indexOf(a.id);
            const idxB = tabHistory.indexOf(b.id);
            if (idxA !== -1 && idxB !== -1) return idxA - idxB;
            if (idxA !== -1) return -1;
            if (idxB !== -1) return 1;
            return a.index - b.index;
        });

        let groupMap = {};
        try {
            const groups = await chrome.tabGroups.query({ windowId: activeTab.windowId });
            groups.forEach(g => {
                groupMap[g.id] = {
                  title: g.title,
                  color: g.color
                };
            });
        } catch (e) {
            console.error('error fetching tab groups:', e)
        }

        const formattedTabs = validWindowTabs.map(tab => ({
            id: tab.id,
            title: tab.title || 'Nueva pestaña',
            url: tab.url,
            favIconUrl: tab.favIconUrl || '',
            active: tab.active,
            groupId: tab.groupId,
            groupTitle: groupMap[tab.groupId]?.title || '',
            groupColor: groupMap[tab.groupId]?.color || ''
        }));
        chrome.tabs.sendMessage(activeTab.id, {
            action: 'toggle_switcher',
            tabs: formattedTabs,
            language: settings.language,
            themeColor: settings.themeColor,
            customColorValue: settings.customColorValue,
        });
      }
    });

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'switch_to_tab') {
        chrome.tabs.update(message.tabId, { active: true });
        if (message.windowId) {
            chrome.windows.update(message.windowId, { focused: true });
        }
        sendResponse({ success: true });
    }
    else if (message.action === 'close_tab') {
        chrome.tabs.remove(message.tabId);
        sendResponse({ success: true });
    }
    else if (message.action === 'group_tabs_now') {
        groupTabsWithAI()
            .then(() => sendResponse({ success: true }))
            .catch((err) => sendResponse({ success: false, error: err.message }));
        return true;
    }
    else if (message.action === 'update_settings') {
        setupAlarms();
        sendResponse({ success: true });
    }
});


chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === 'auto_group_tabs') {
        console.log('executing tabs grouping');
        groupTabsWithAI().catch(err => console.error('error on the automatic grouping:', err));
    }
});


async function setupAlarms() {
    const settings = await chrome.storage.local.get({
        autoGroupEnabled: false,
        autoGroupInterval: 15
    });

    await chrome.alarms.clear('auto_group_tabs');

    if (settings.autoGroupEnabled) {
        chrome.alarms.create('auto_group_tabs', {
            periodInMinutes: settings.autoGroupInterval
        });
        console.log(`automatic tabs agrouping alarm: ${settings.autoGroupInterval} minutes.`);
    } else {
        console.log('agrupation alarm disabled.');
    }
}


async function groupTabsWithAI() {
    const settings = await chrome.storage.local.get({
        geminiApiKey: '',
        language: 'en',
        aiInstructions: ''
    });

    const apiKey = settings.geminiApiKey;
    if (!apiKey) {
        throw new Error(settings.language === 'es' ? 'API Key de Gemini no configurada.' : 'Gemini API Key is not configured.');
    }


    let targetWindow = await chrome.windows.getLastFocused();


    if (!targetWindow || targetWindow.type !== 'normal') {
        const allWindows = await chrome.windows.getAll();
        const normalWindows = allWindows.filter(w => w.type === 'normal');
        if (normalWindows.length === 0) {
            throw new Error(settings.language === 'es' ? 'No se encontró una ventana normal activa.' : 'No active normal window found.');
        }

        targetWindow = normalWindows.find(w => w.focused) || normalWindows[0];
    }


    const tabs = await chrome.tabs.query({ windowId: targetWindow.id, pinned: false });
    if (tabs.length < 3) {
        console.log('way to little tabs to group atleast need 3');
        return;
    }


    const tabList = tabs.map(t => ({
        id: t.id,
        title: t.title,
        url: t.url
    }));

    let systemInstruction = '';
    if (settings.language === 'es') {
        systemInstruction = `Actúas como un organizador de pestañas del navegador. Tu tarea es analizar y agrupar las pestañas en grupos coherentes.
CRITICAL: Debes generar los nombres de los grupos únicamente en ESPAÑOL. Aunque los títulos o URLs de las pestañas estén en inglés u otros idiomas, traduce la categoría al español y escríbela en español. No uses inglés ni mezcles idiomas bajo ninguna circunstancia.`;
        if (settings.aiInstructions) {
            systemInstruction += `\nCRITICAL: Debes cumplir estrictamente con estas instrucciones adicionales del usuario:\n- ${settings.aiInstructions}`;
        }
    } else {
        systemInstruction = `You act as a browser tab organizer. Your task is to analyze and group tabs into coherent groups.
CRITICAL: You must generate the group names in ENGLISH ONLY. Even if the tab titles or URLs are in Spanish, French, or any other language, translate the category name and write it in English. Do not output Spanish group names under any circumstance.`;
        if (settings.aiInstructions) {
            systemInstruction += `\nCRITICAL: You MUST strictly follow these additional user instructions:\n- ${settings.aiInstructions}`;
        }
    }

    let prompt = '';

    if (settings.language === 'es') {
        prompt = `Analiza la siguiente lista de pestañas abiertas (con sus ID, títulos y URL) y agrúpalas en categorías lógicas y coherentes (entre 3 y 6 grupos máximo).
Las pestañas que no encajen en ningún grupo claro déjalas fuera (no crees grupos de una sola pestaña).

Para cada grupo, elige:
1. Un nombre corto y descriptivo en español (máximo 2 palabras).
2. Un color para el grupo en Chrome. DEBES elegir únicamente de esta lista de colores válidos de Chrome: "grey", "blue", "red", "yellow", "green", "pink", "purple", "cyan", "orange".

Devuelve ÚNICAMENTE un array JSON válido con la siguiente estructura:
[
  {
    "name": "Nombre Grupo",
    "color": "blue",
    "tabIds": [123, 456]
  }
]

Lista de pestañas:
${JSON.stringify(tabList, null, 2)}`;
    } else {
        prompt = `Analyze the following list of open tabs (with their IDs, titles, and URLs) and group them into logical and coherent categories (between 3 and 6 groups maximum).
Tabs that do not fit into any clear group should be left out (do not create groups of a single tab).

For each group, choose:
1. A short and descriptive name in English (maximum 2 words).
2. A color for the Chrome group. You MUST choose only from this list of valid Chrome colors: "grey", "blue", "red", "yellow", "green", "pink", "purple", "cyan", "orange".

Return ONLY a valid JSON array with the following structure:
[
  {
    "name": "Group Name",
    "color": "blue",
    "tabIds": [123, 456]
  }
]

List of tabs:
${JSON.stringify(tabList, null, 2)}`;
    }

    try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                systemInstruction: {
                    parts: [{
                        text: systemInstruction
                    }]
                },
                contents: [{
                    parts: [{
                        text: prompt
                    }]
                }],
                generationConfig: {
                    responseMimeType: 'application/json'
                }
            })
        });

        if (!response.ok) {
            const errData = await response.json();
            throw new Error(errData?.error?.message || 'Error on gemini api');
        }

        const data = await response.json();
        const responseText = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!responseText) {
            throw new Error('empty gemini response');
        }

        const groups = JSON.parse(responseText);

        const validTabIds = tabs.map(t => t.id);


        let groupedAny = false;
        let lastError = null;


        for (const group of groups) {

            const validColors = ["grey", "blue", "red", "yellow", "green", "pink", "purple", "cyan", "orange"];
            const color = validColors.includes(group.color) ? group.color : 'grey';


            const tabIds = group.tabIds
                .map(id => Number(id))
                .filter(id => !isNaN(id) && validTabIds.includes(id));


            if (tabIds.length === 0) {
                console.warn(`[Format] no valid tabs on the group "${group.name}". skipping.`);
                continue;
            }

            try {

                const groupId = await chrome.tabs.group({ tabIds: tabIds });

                await chrome.tabGroups.update(groupId, {
                    title: group.name,
                    color: color
                });
                groupedAny = true;
                console.log(`[Format AI] group created succesfully: "${group.name}" with group ID: ${groupId}`);
            } catch (groupErr) {
                console.error(`[Format AI] error creating group "${group.name}":`, groupErr);
                lastError = groupErr;
            }
        }

        if (!groupedAny && lastError) {
            throw new Error((settings.language === 'es' ? 'Error al agrupar: ' : 'Error grouping: ') + lastError.message);
        }
    } catch (err) {
        console.error('Error in group TabsWithAI:', err);
        throw err;
    }
}
