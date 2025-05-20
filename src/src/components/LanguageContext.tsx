import React, { createContext, useState, useEffect, useContext } from "react";

type LanguageContextType = {
    language: string;
    setLanguage: (lang: string) => void;
    languageData: Record<string, any>;
    speechKey: string;
    speechRegion: string;
    voices: Record<string, string>;
};

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [language, setLanguage] = useState(localStorage.getItem("language") || "en");
    const [languageData, setLanguageData] = useState<Record<string, any>>({});
    const [speechKey, setSpeechKey] = useState<string>("");
    const [speechRegion, setSpeechRegion] = useState<string>("");
    const [voices, setVoices] = useState<Record<string, string>>({});

    useEffect(() => {
        const fetchLanguageData = async () => {
            try {
                const response = await fetch("/config.json");
                const data = await response.json();
                const clientResponse = await fetch("/client.config.json");
                const clientData = await clientResponse.json();
                setLanguageData(data);
                setSpeechKey(clientData.speechKey || "");
                setSpeechRegion(clientData.speechRegion || "");
                setVoices(clientData.voices || {}); // Load voices dynamically
            } catch (error) {
                console.error("Failed to fetch language data:", error);
            }
        };
        fetchLanguageData();
    }, []);

    useEffect(() => {
        localStorage.setItem("language", language);
    }, [language]);

    return (
        <LanguageContext.Provider value={{ language, setLanguage, languageData, speechKey, speechRegion, voices }}>
            {children}
        </LanguageContext.Provider>
    );
};

export const useLanguageContext = () => {
    const context = useContext(LanguageContext);
    if (!context) {
        throw new Error("useLanguageContext must be used within a LanguageProvider");
    }
    return context;
};
