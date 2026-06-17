(function() {
    if (window.tabFlowSwitcherInitialized) {
        return;
    }
    window.tabFlowSwitcherInitialized = true;

    let allTabs = [];
    let filteredTabs = [];
    let selectedIndex = 0;
    let isOpen = false;
    let wasCycled = false;
    let currentLang = 'en';
    let currentThemeColor = 'blue';
    let currentCustomColorValue = '#1a73e8';

    const switcherTranslations = {
        es: {
            placeholder: "Buscar pestaña por título o URL...",
            tips: "<span class=\"tabflow-tip-key\">←→ / Tab</span> Navegar &bull; <span class=\"tabflow-tip-key\">Enter</span> Seleccionar &bull; <span class=\"tabflow-tip-key\">Esc</span> Cerrar",
            noResults: "No se encontraron pestañas abiertas",
            closeBtnTitle: "Cerrar pestaña"
        },
        en: {
            placeholder: "Search tab by title or URL...",
            tips: "<span class=\"tabflow-tip-key\">←→ / Tab</span> Navigate &bull; <span class=\"tabflow-tip-key\">Enter</span> Select &bull; <span class=\"tabflow-tip-key\">Esc</span> Close",
            noResults: "No open tabs found",
            closeBtnTitle: "Close tab"
        }
    };

    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        if (message.action === 'ping') {
            sendResponse({ status: 'pong' });
        } else if (message.action === 'toggle_switcher') {
            allTabs = message.tabs || [];
            currentLang = message.language || 'en';
            currentThemeColor = message.themeColor || 'blue';
            currentCustomColorValue = message.customColorValue || '#1a73e8';
            toggleSwitcher();
            sendResponse({ status: 'success' });
        }
    });

    function toggleSwitcher() {
        if (isOpen) {
            cycleSelection();
        } else {
            openSwitcher();
        }
    }

    function openSwitcher() {
        isOpen = true;
        wasCycled = false;
        filteredTabs = [...allTabs];
        selectedIndex = allTabs.length > 1 ? 1 : 0;

        let overlay = document.getElementById('tabflow-switcher-overlay');
        if (!overlay) {
            overlay = createOverlayDOM();
            document.body.appendChild(overlay);
        } else {
            const searchInput = document.getElementById('tabflow-search-input');
            const tipsDiv = overlay.querySelector('.tabflow-tips');
            if (searchInput) {
                searchInput.placeholder = switcherTranslations[currentLang].placeholder;
            }
            if (tipsDiv) {
                tipsDiv.innerHTML = switcherTranslations[currentLang].tips;
            }
        }

        applyThemeColors(overlay, currentThemeColor, currentCustomColorValue);
        overlay.classList.remove('tabflow-hidden');

        document.addEventListener('keydown', handleKeyDown, true);
        document.addEventListener('keyup', handleKeyUp, true);

        const searchInput = document.getElementById('tabflow-search-input');
        searchInput.value = '';
        searchInput.focus();

        renderTabsList();

        setTimeout(() => {
            searchInput.value = '';
        }, 10);
    }

    function closeSwitcher() {
        isOpen = false;
        const overlay = document.getElementById('tabflow-switcher-overlay');
        if (overlay) {
            overlay.classList.add('tabflow-hidden');
        }
        document.removeEventListener('keydown', handleKeyDown, true);
        document.removeEventListener('keyup', handleKeyUp, true);
    }

    function cycleSelection() {
        if (filteredTabs.length === 0) return;
        wasCycled = true;
        selectedIndex = (selectedIndex + 1) % filteredTabs.length;
        renderTabsList();
        scrollToSelected();
    }

    function selectPrevious() {
        if (filteredTabs.length === 0) return;
        wasCycled = true;
        selectedIndex = (selectedIndex - 1 + filteredTabs.length) % filteredTabs.length;
        renderTabsList();
        scrollToSelected();
    }

    function selectNext() {
        if (filteredTabs.length === 0) return;
        wasCycled = true;
        selectedIndex = (selectedIndex + 1) % filteredTabs.length;
        renderTabsList();
        scrollToSelected();
    }

    function activateSelectedTab() {
        if (filteredTabs.length === 0 || selectedIndex < 0 || selectedIndex >= filteredTabs.length) return;
        const selectedTab = filteredTabs[selectedIndex];
        chrome.runtime.sendMessage({
            action: 'switch_to_tab',
            tabId: selectedTab.id
        });
        closeSwitcher();
    }

    function closeTab(tabId, event) {
        if (event) {
            event.stopPropagation();
            event.preventDefault();
        }
        chrome.runtime.sendMessage({
            action: 'close_tab',
            tabId: tabId
        });
        allTabs = allTabs.filter(t => t.id !== tabId);
        filteredTabs = filteredTabs.filter(t => t.id !== tabId);
        if (selectedIndex >= filteredTabs.length) {
            selectedIndex = Math.max(0, filteredTabs.length - 1);
        }
        if (filteredTabs.length === 0) {
            closeSwitcher();
        } else {
            renderTabsList();
            const searchInput = document.getElementById('tabflow-search-input');
            searchInput.focus();
        }
    }

    function handleKeyDown(e) {
        e.stopPropagation();
        if (e.key === 'Escape') {
            e.preventDefault();
            closeSwitcher();
        } else if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
            e.preventDefault();
            selectNext();
        } else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
            e.preventDefault();
            selectPrevious();
        } else if (e.key === 'Enter') {
            e.preventDefault();
            activateSelectedTab();
        } else if (e.key === 'Tab') {
            e.preventDefault();
            if (e.shiftKey) {
                selectPrevious();
            } else {
                selectNext();
            }
        }
    }

    function handleKeyUp(e) {
        e.stopPropagation();
        if (!isOpen) return;
        if ((e.key === 'Control' || e.key === 'Shift' || e.key === 'Alt' || e.key === 'Meta') && wasCycled) {
            e.preventDefault();
            activateSelectedTab();
        }
    }

    function createOverlayDOM() {
        const overlay = document.createElement('div');
        overlay.id = 'tabflow-switcher-overlay';
        overlay.className = 'tabflow-overlay tabflow-hidden';

        overlay.addEventListener('keydown', (e) => e.stopPropagation(), true);
        overlay.addEventListener('keyup', (e) => e.stopPropagation(), true);
        overlay.addEventListener('keypress', (e) => e.stopPropagation(), true);
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                closeSwitcher();
            }
        });

        const card = document.createElement('div');
        card.className = 'tabflow-switcher-card';

        const searchContainer = document.createElement('div');
        searchContainer.className = 'tabflow-search-container';
        searchContainer.innerHTML = `
            <svg class="tabflow-search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="11" cy="11" r="8"></circle>
                <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
            </svg>
            <input type="text" id="tabflow-search-input" placeholder="${switcherTranslations[currentLang].placeholder}" autocomplete="off" />
        `;

        const listContainer = document.createElement('div');
        listContainer.id = 'tabflow-list-container';
        listContainer.className = 'tabflow-list-container';

        const footer = document.createElement('div');
        footer.className = 'tabflow-footer';
        footer.innerHTML = `
            <div class="tabflow-tips">
                ${switcherTranslations[currentLang].tips}
            </div>
            <div class="tabflow-branding">For<span class="tabflow-branding-purple">mat</span></div>
        `;

        card.appendChild(searchContainer);
        card.appendChild(listContainer);
        card.appendChild(footer);
        overlay.appendChild(card);

        const searchInput = searchContainer.querySelector('#tabflow-search-input');
        searchInput.addEventListener('input', (e) => {
            const query = e.target.value.toLowerCase().trim();
            if (query === '') {
                filteredTabs = [...allTabs];
            } else {
                filteredTabs = allTabs.filter(tab =>
                    tab.title.toLowerCase().includes(query) ||
                    tab.url.toLowerCase().includes(query)
                );
            }
            selectedIndex = 0;
            renderTabsList();
        });

        return overlay;
    }

    function getGroupStyle(colorName, isDark) {
        const lightColors = {
            grey: { bg: '#f1f3f4', text: '#5f6368', border: '#dadce0' },
            blue: { bg: '#e8f0fe', text: '#1a73e8', border: '#aecbfa' },
            red: { bg: '#fce8e6', text: '#d93025', border: '#fad2cf' },
            yellow: { bg: '#fef7e0', text: '#b06000', border: '#feebc8' },
            green: { bg: '#e6f4ea', text: '#137333', border: '#c2e7c9' },
            pink: { bg: '#fce4ec', text: '#c2185b', border: '#f8bbd0' },
            purple: { bg: '#f3e5f5', text: '#7b1fa2', border: '#e1bee7' },
            cyan: { bg: '#e4f7fb', text: '#007b83', border: '#b2ebd5' },
            orange: { bg: '#ffebee', text: '#c05621', border: '#ffdad9' }
        };

        const darkColors = {
            grey: { bg: 'rgba(218, 220, 224, 0.15)', text: '#dadce0', border: 'rgba(218, 220, 224, 0.25)' },
            blue: { bg: 'rgba(138, 180, 248, 0.15)', text: '#8ab4f8', border: 'rgba(138, 180, 248, 0.25)' },
            red: { bg: 'rgba(242, 139, 130, 0.15)', text: '#f28b82', border: 'rgba(242, 139, 130, 0.25)' },
            yellow: { bg: 'rgba(253, 216, 53, 0.15)', text: '#fdd835', border: 'rgba(253, 216, 53, 0.25)' },
            green: { bg: 'rgba(129, 201, 149, 0.15)', text: '#81c795', border: 'rgba(129, 201, 149, 0.25)' },
            pink: { bg: 'rgba(255, 139, 203, 0.15)', text: '#ff8bcb', border: 'rgba(255, 139, 203, 0.25)' },
            purple: { bg: 'rgba(208, 188, 255, 0.15)', text: '#d0bcff', border: 'rgba(208, 188, 255, 0.25)' },
            cyan: { bg: 'rgba(120, 217, 236, 0.15)', text: '#78d9ec', border: 'rgba(120, 217, 236, 0.25)' },
            orange: { bg: 'rgba(255, 173, 71, 0.15)', text: '#ffad47', border: 'rgba(255, 173, 71, 0.25)' }
        };

        const palette = isDark ? darkColors : lightColors;
        return palette[colorName] || palette.grey;
    }

    function renderTabsList() {
        const listContainer = document.getElementById('tabflow-list-container');
        if (!listContainer) return;

        listContainer.innerHTML = '';

        if (filteredTabs.length === 0) {
            listContainer.innerHTML = `
                <div class="tabflow-no-results">
                    ${switcherTranslations[currentLang].noResults}
                </div>
            `;
            return;
        }

        filteredTabs.forEach((tab, index) => {
            const item = document.createElement('div');
            item.className = `tabflow-tab-item ${index === selectedIndex ? 'tabflow-active' : ''}`;

            item.addEventListener('click', () => {
                selectedIndex = index;
                activateSelectedTab();
            });

            const cardHeader = document.createElement('div');
            cardHeader.className = 'tabflow-card-header';

            const faviconImg = document.createElement('img');
            faviconImg.className = 'tabflow-favicon';
            faviconImg.src = tab.favIconUrl || 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="%2394a3b8" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="9" y1="3" x2="9" y2="21"></line></svg>';
            faviconImg.onerror = function() {
                this.src = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="%2394a3b8" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="9" y1="3" x2="9" y2="21"></line></svg>';
            };

            const title = document.createElement('div');
            title.className = 'tabflow-tab-title';
            title.textContent = tab.title;

            const closeBtn = document.createElement('button');
            closeBtn.className = 'tabflow-close-btn';
            closeBtn.title = switcherTranslations[currentLang].closeBtnTitle;
            closeBtn.innerHTML = `
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <line x1="18" y1="6" x2="6" y2="18"></line>
                    <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
            `;
            closeBtn.addEventListener('click', (e) => closeTab(tab.id, e));

            cardHeader.appendChild(faviconImg);
            cardHeader.appendChild(title);
            cardHeader.appendChild(closeBtn);

            const cardBody = document.createElement('div');
            cardBody.className = 'tabflow-card-body';

            const domain = cleanUrl(tab.url);
            const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;

            const previewCenter = document.createElement('div');
            previewCenter.className = 'tabflow-preview-center';

            const largeFavicon = document.createElement('img');
            largeFavicon.className = 'tabflow-large-favicon';
            largeFavicon.src = faviconImg.src;
            largeFavicon.onerror = function() {
                this.src = faviconImg.src;
            };

            const domainBadge = document.createElement('span');
            domainBadge.className = 'tabflow-domain-badge';
            domainBadge.textContent = domain.split('/')[0];

            previewCenter.appendChild(largeFavicon);
            previewCenter.appendChild(domainBadge);
            cardBody.appendChild(previewCenter);

            if (tab.groupTitle) {
                const groupBadge = document.createElement('div');
                groupBadge.className = 'tabflow-group-badge';
                groupBadge.textContent = tab.groupTitle;

                const style = getGroupStyle(tab.groupColor, isDark);
                groupBadge.style.backgroundColor = style.bg;
                groupBadge.style.color = style.text;
                groupBadge.style.borderColor = style.border;
                groupBadge.style.borderStyle = 'solid';
                groupBadge.style.borderWidth = '1px';

                cardBody.appendChild(groupBadge);
            }

            item.appendChild(cardHeader);
            item.appendChild(cardBody);
            listContainer.appendChild(item);
        });
    }

    function cleanUrl(rawUrl) {
        try {
            const urlObj = new URL(rawUrl);
            return urlObj.hostname + (urlObj.pathname.length > 1 ? urlObj.pathname : '');
        } catch (e) {
            return rawUrl;
        }
    }

    function scrollToSelected() {
        const listContainer = document.getElementById('tabflow-list-container');
        const selectedItem = listContainer.querySelector('.tabflow-active');
        if (!selectedItem) return;

        const containerWidth = listContainer.clientWidth;
        const itemWidth = selectedItem.clientWidth;
        const itemLeft = selectedItem.offsetLeft;

        if (itemLeft < listContainer.scrollLeft) {
            listContainer.scrollLeft = itemLeft - 16;
        } else if (itemLeft + itemWidth > listContainer.scrollLeft + containerWidth) {
            listContainer.scrollLeft = itemLeft + itemWidth - containerWidth + 16;
        }
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
        return { h: h * 360, s: s * 100, l: l * 100 };
    }

    function hslToHex(h, s, l) {
        h /= 360;
        s /= 100;
        l /= 100;
        let r, g, b;

        if (s === 0) {
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

    function applyThemeColors(element, themeColor, customColorVal) {
        const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        const mode = isDark ? 'dark' : 'light';

        const themeSeeds = {
            sage: { h: 88, s: 25, l: 45 },
            blue: { h: 214, s: 80, l: 50 },
            purple: { h: 258, s: 45, l: 48 },
            red: { h: 0, s: 75, l: 42 },
            yellow: { h: 43, s: 90, l: 52 }
        };

        let seed;
        if (themeColor === 'custom') {
            seed = hexToHsl(customColorVal);
        } else {
            seed = themeSeeds[themeColor] || themeSeeds.blue;
        }

        if (mode === 'light') {
            element.style.setProperty('--tf-bg-overlay', `hsla(${seed.h}, 20%, 97%, 0.65)`);
            element.style.setProperty('--tf-bg-card', `hsl(${seed.h}, 22%, 93%)`);
            element.style.setProperty('--tf-bg-card-elevated', `hsl(${seed.h}, 20%, 88%)`);
            element.style.setProperty('--tf-text-primary', `hsl(${seed.h}, 30%, 12%)`);
            element.style.setProperty('--tf-text-secondary', `hsl(${seed.h}, 16%, 32%)`);

            const primaryL = Math.min(60, seed.l);
            const accent = `hsl(${seed.h}, ${Math.max(40, seed.s)}%, ${primaryL}%)`;
            element.style.setProperty('--tf-accent', accent);
            element.style.setProperty('--tf-accent-hover', `hsl(${seed.h}, ${Math.max(40, seed.s)}%, ${Math.max(15, primaryL - 10)}%)`);
            element.style.setProperty('--tf-item-bg-active', accent);

            const textActive = seed.l > 60 || seed.h === 43 || (seed.h === 88 && seed.l > 45) ? '#191c17' : '#ffffff';
            element.style.setProperty('--tf-text-active', textActive);

            const textSecActive = seed.l > 60 || seed.h === 43 || (seed.h === 88 && seed.l > 45) ? `hsl(${seed.h}, 16%, 32%)` : `hsl(${seed.h}, 20%, 92%)`;
            element.style.setProperty('--tf-text-sec-active', textSecActive);

            element.style.setProperty('--tf-border', `hsl(${seed.h}, 15%, 83%)`);
            element.style.setProperty('--tf-item-bg-hover', `hsla(${seed.h}, 20%, 85%, 0.4)`);
            element.style.setProperty('--tf-danger', `#ba1a1a`);
        } else {
            element.style.setProperty('--tf-bg-overlay', `hsla(${seed.h}, 12%, 8%, 0.65)`);
            element.style.setProperty('--tf-bg-card', `hsl(${seed.h}, 14%, 13%)`);
            element.style.setProperty('--tf-bg-card-elevated', `hsl(${seed.h}, 14%, 18%)`);
            element.style.setProperty('--tf-text-primary', `hsl(${seed.h}, 15%, 90%)`);
            element.style.setProperty('--tf-text-secondary', `hsl(${seed.h}, 10%, 72%)`);

            const primaryL = 75;
            const accent = `hsl(${seed.h}, ${Math.min(75, seed.s)}%, ${primaryL}%)`;
            element.style.setProperty('--tf-accent', accent);
            element.style.setProperty('--tf-accent-hover', `hsl(${seed.h}, ${Math.min(75, seed.s)}%, 85%)`);
            element.style.setProperty('--tf-item-bg-active', accent);

            element.style.setProperty('--tf-text-active', `#1a1c18`);
            element.style.setProperty('--tf-text-sec-active', `#2f312c`);

            element.style.setProperty('--tf-border', `hsl(${seed.h}, 10%, 22%)`);
            element.style.setProperty('--tf-item-bg-hover', `hsla(${seed.h}, 15%, 20%, 0.4)`);
            element.style.setProperty('--tf-danger', `#ffb4ab`);
        }
    }
})();
