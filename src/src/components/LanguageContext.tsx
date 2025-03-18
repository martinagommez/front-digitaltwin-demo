import React, { createContext, useState, useEffect, useContext } from 'react';

type LanguageContextType = {
    language: string;
    setLanguage: (lang: string) => void;
    languageData: Record<string, any>;
};

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [language, setLanguage] = useState('en'); // Default language
    const [languageData, setLanguageData] = useState<Record<string, any>>({});

    useEffect(() => {
        const fetchLanguageData = async () => {
            try {
                const response = await fetch('/client.config.json');
                const data = await response.json();
                setLanguageData(data);
            } catch (error) {
                console.error('Failed to fetch language data:', error);
            }
        };
        fetchLanguageData();
    }, []);

    return (
        <LanguageContext.Provider value={{ language, setLanguage, languageData }}>
            {children}
        </LanguageContext.Provider>
    );
};

export const useLanguageContext = () => {
    const context = useContext(LanguageContext);
    if (!context) {
        throw new Error('useLanguageContext must be used within a LanguageProvider');
    }
    return context;
};
