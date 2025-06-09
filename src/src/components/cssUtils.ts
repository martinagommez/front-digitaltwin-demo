import { log } from './log';

export const updateCSSVariables = (variables: Record<string, any>, language: string) => {
    const root = document.documentElement;
    for (const [key, value] of Object.entries(variables)) {
        // Use the language value from JSON or fallback to English
        const languageValue = value[language] || value['en']; // Default to English if no translation is found
        const cssVariableName = `--${key.replace(/([A-Z])/g, '-$1').toLowerCase()}`; // Convert camelCase to kebab-case
        // Update the CSS variable
        root.style.setProperty(cssVariableName, languageValue);
    }
};

export const fetchAndUpdateCSSVariables = async (url: string, language: string) => {
    try {
        const response = await fetch(url); // Fetch JSON from the public folder
        const data = await response.json();
        log('Fetched JSON', data);
        // Apply the CSS variables from the fetched data
        updateCSSVariables(data, language);
		const root = document.documentElement;
		root.style.setProperty('--client-color', data.clientColor);
		root.style.setProperty('--client-color-dark', data.clientColorDark);
        root.style.setProperty('--logo-width', data.logoWidth);
        root.style.setProperty('--logo-mobile-width', data.logoMobileWidth);
    } catch (error) {
        console.error('Error fetching JSON data:', error);
    }
};
