import React, { useState, useRef } from "react";
import axios from "axios";
import { PluginMeta, PluginKeys } from '../models/requests/PluginApi';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkBreaks from 'remark-breaks';
import { FaSearch, FaSearchPlus } from "react-icons/fa";
import { FiLoader } from "react-icons/fi";

import './styles.css';
import { useLanguageContext } from './LanguageContext';

interface Message {
    text: string;
    language: string;
    id: string;
    files?: File[];
    images?: string[]; // user-uploaded images
    bot_image?: string[]; // backend-generated images
    sender: 'user' | 'bot' | 'debug' | 'websocket';
    agent?: string;
    orch_config_id: string|undefined;
    orch_config_key: string|undefined;
    formFields?: Record<string, string | string[]>;
    formFieldLabels?: Record<string, string>; 
    formFieldOptions?: Record<string, { label: string; value: string }[]>;
};

interface SearchComponentProps {
    activedPlugin: PluginMeta | null;
    setActivedPlugin: React.Dispatch<React.SetStateAction<PluginMeta | null>>;
    pluginKeys: PluginKeys | null;
    setPluginKeys: React.Dispatch<React.SetStateAction<PluginKeys | null>>;
    selectedLanguage: string;
}

function SearchComponent({activedPlugin, pluginKeys, selectedLanguage }: SearchComponentProps) {
	const [loading, setLoading] = useState<boolean>(false);
    const [loadingMessage, setLoadingMessage] = useState<string>("");
    const [messages, setMessages] = useState<Message[]>([]);
    const [inputEnable, setInputEnable] = useState<boolean>(true);
    const [sessionId, setSessionId] = useState<string>('');
    const [token, setToken] = useState<string>('');
    const [searchTerm, setSearchTerm] = useState<string>("");
    const [selectedTopic, setSelectedTopic] = useState<string>("");
    const [topicSelection, setTopicSelection] = useState<boolean>(false);
    const [topics, setTopics] = useState<string[]>([]);
    const [output, setOutput] = useState("");
    const inputRef = useRef<HTMLTextAreaElement>(null);

    function getFormattedTimestamp() {
        const date = new Date();
        const year = date.getFullYear();    
        const month = String(date.getMonth() + 1).padStart(2, '0');    
        const day = String(date.getDate()).padStart(2, '0');    
        const hours = String(date.getHours()).padStart(2, '0');    
        const minutes = String(date.getMinutes()).padStart(2, '0');    
        const seconds = String(date.getSeconds()).padStart(2, '0');    
        return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}`;
    }

    const handleSend = async () => {
        if (!searchTerm) return;
        setSelectedTopic("");
        setTopicSelection(false);
        const messageId = new Date().getTime().toString();
        // Create FormData object
        const formData = new FormData();
        formData.append("user_input", searchTerm || "");
        formData.append("timestamp", getFormattedTimestamp());
        formData.append("messageId", messageId);
        formData.append("session_id", sessionId);
        formData.append("token", token);
        formData.append("language", selectedLanguage);
        formData.append("body", "")
        formData.append("orch_config_id", pluginKeys?.orch_config_id || "");
        formData.append("orch_config_key", pluginKeys?.orch_config_key || "");
        console.log("FormData being sent:", formData);
        setSearchTerm("");
        console.log("Vou agora fazer o search", searchTerm, topicSelection);
        await handleSearch(formData, searchTerm);
    };
    
    const handleTopics = async (topic: string) => {
        if(!activedPlugin) return;
        setInputEnable(false);
        setOutput("");
        setTopicSelection(true);
        setLoading(true);
        setLoadingMessage(`${loadingSearch} "${topic}"`);
        const messageId = new Date().getTime().toString();
        const formData = new FormData();
        formData.append("user_input", topic);
        formData.append("timestamp", getFormattedTimestamp());
        formData.append("messageId", messageId);
        formData.append("session_id", sessionId);
        formData.append("token", token);
        formData.append("language", selectedLanguage);
        formData.append("body", "")
        formData.append("orch_config_id", pluginKeys?.orch_config_id || "");
        formData.append("orch_config_key", pluginKeys?.orch_config_key || "");
        setSelectedTopic(topic);
        console.log("Vou agora fazer o search", selectedTopic, topicSelection);
        await handleSearch(formData, topic);
    };

    const handleSearch = async (formData: FormData, overrideTerm?: string) => {
        console.log("Entrei agora no search");
        const termToUse = topicSelection ? overrideTerm : overrideTerm || searchTerm;
        if (topicSelection) {
            console.log("Tópico", overrideTerm);
        } else {
            console.log("Não há tópicos");
        }
        if (!activedPlugin) return;
        setLoading(true);
        setInputEnable(false);
        setOutput(""); // Clear previous output
        setTopics([]); // Reset topics
        setLoadingMessage(`${loadingSearch} "${termToUse}"`);
        inputRef.current?.blur();
        try {
            const url = activedPlugin.PluginHost.startsWith('https')
                ? activedPlugin.PluginHost
                : `https://${activedPlugin.PluginHost}`;
            console.log("Payload being sent to backend:", formData);
            for (const pair of formData.entries()) {
                console.log("  ➤", pair[0], pair[1]);
            }
            const response = await axios.post(url + "/message", formData, {
                headers: {
                    "Content-Type": "multipart/form-data",
                    'Access-Control-Allow-Origin': '*' // WARNING -> THIS MUST HAVE THE URL/message OF THE ORCHESTRATOR. ELSE IT MIGHT BE PRONE TO ERRORS. Is dangerous in production if not tightly controlled.
                }, timeout: 10000000
            });
            console.log("Response from backend", response);
            setSessionId(response.data.session_id);
            setToken(response.data.token);
            response.data.topics = "";
            // response.data.topics = (["Science", "Technology", "Health", "Education", "Sports"]);
            if (response.data.topics && response.data.topics.length > 0) {
                // User must select a topic to continue
                setTopics(response.data.topics);
            } else {
                // Output
                setOutput(`${noOutput} "${termToUse}"`);
            }
            // SET MESSAGES ONLY FOR TESTING - START MESSAGE
            const messageId = new Date().getTime().toString();
            setMessages(prevMessages => [
                ...prevMessages,
                { 
                    text: '', 
                    language: selectedLanguage, 
                    id: messageId, 
                    files: [], 
                    images: [], 
                    bot_image: [],
                    sender: 'bot',
                    orch_config_id: pluginKeys!.orch_config_id, 
                    orch_config_key: pluginKeys!.orch_config_key
                },
            ]);
        } catch (error) {
            setOutput("An error occurred while searching.");
            console.error(error);
        } finally {
            setSearchTerm("");
            setInputEnable(true);
            setLoading(false);
        }
    };

    const handleClear = async () => {
        if (inputEnable) {
			window.location.reload(); //Only allow reload if input is enabled
		}
    };

    // Get data from context
    const { languageData } = useLanguageContext();
    // Extract text values from JSON
    const searchPlaceholder = languageData?.searchPlaceholder?.[selectedLanguage] || languageData?.searchPlaceholder?.['en-US'];
    const outputPlaceholder = languageData?.outputPlaceholder?.[selectedLanguage] || languageData?.outputPlaceholder?.['en-US'];
    const noOutput = languageData?.noOutput?.[selectedLanguage] || languageData?.noOutput?.['en-US'];
    const searchButton = languageData?.searchButton?.[selectedLanguage] || languageData?.searchButton?.['en-US'];
    const newSearchButton = languageData?.newSearchButton?.[selectedLanguage] || languageData?.newSearchButton?.['en-US'];
    const loadingSearch = languageData?.loadingSearch?.[selectedLanguage] || languageData?.loadingSearch?.['en-US'];

    return (
        <div className="w-full mx-auto p-4 space-y-4">
            {/* Search Bar and Plus Button */}
            <div className="flex items-center gap-2">
                <div className="relative flex flex-row w-full h-auto text-sm md:text-base rounded-3xl pr-2 pl-2 pt-3 resize-none overflow-auto overflow-y-hidden
                                bg-neutral-100 dark:bg-neutral-700 "
                >
                    <textarea
                        ref={inputRef}
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                                e.preventDefault(); // Prevent newline from being added
                                handleSend(); // Call search function
                            }
                        }}
                        placeholder={searchPlaceholder}
                        className="h-auto w-full pt-2 px-4 focus:outline-none focus:ring-0 rounded-xl resize-none overflow-x-auto overflow-y-hidden whitespace-nowrap flex items-center
                            text-sm md:text-base scroll-smooth bg-transparent text-black dark:text-white
                            [&::-webkit-scrollbar]:h-2
                            [&::-webkit-scrollbar-track]:rounded-full
                            [&::-webkit-scrollbar-track]:bg-[#d0d0d0]/20
                            dark:[&::-webkit-scrollbar-track]:bg-[#414141]/20
                            [&::-webkit-scrollbar-thumb]:rounded-full
                            [&::-webkit-scrollbar-thumb]:bg-[#d0d0d0]
                            dark:[&::-webkit-scrollbar-thumb]:bg-[#414141]
                            [&::-webkit-scrollbar-thumb]:hover:bg-[#acabab]
                            dark:[&::-webkit-scrollbar-thumb]:hover:bg-[#2a2a2a]"
                    />
                    <button
                        onClick={() => handleSend()}
                        title={searchButton}
                        disabled={!inputEnable}
                        className={`rounded-full items-center justify-center w-7 h-7 pt-3 bg-transparent 
                                text-neutral-500 dark:text-neutral-200 hover:text-neutral-600 dark:hover:text-neutral-400
                                ${inputEnable ? '' : 'cursor-not-allowed'}
                            `}
                    >
                        <FaSearch className='w-auto h-5'/>
                    </button>
                </div>
                <button
                    onClick={handleClear}
                    title={newSearchButton}
                    disabled={!inputEnable}
                    className={`flex items-center justify-center w-14 h-14 rounded-full shadow-md focus:outline-none 
                            bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-700 dark:hover:bg-neutral-800 text-neutral-500 dark:text-neutral-200
                            ${inputEnable ? '' : 'cursor-not-allowed'}
                    `}
                >
                    <FaSearchPlus className="w-7 h-7" />
                </button>
            </div>

            {loading ? (
                <div className="flex flex-col fixed inset-0 items-center text-center justify-center z-50">
                    <FiLoader className="animate-spin spin-slow text-4xl text-neutral-800 dark:text-neutral-100 mb-4" />
                    <p className="text-lg font-semibold">{loadingMessage}</p>
                </div>
            ):(
                <>
                    {/* Topic Buttons */}
                    <div className="flex gap-2 overflow-x-auto pl-4 pb-2">
                        {topics.map((topic) => (
                            <button
                                key={topic}
                                onClick={() => handleTopics(topic)}
                                disabled={!inputEnable}
                                className="px-4 py-2 text-sm rounded-full whitespace-nowrap text-black dark:text-white bg-neutral-200 dark:bg-neutral-700 hover:bg-neutral-300 dark:hover:bg-neutral-700"
                            >
                                {topic}
                            </button>
                        ))}
                    </div>
                    {/* Output Box */}
                    <div
                        className="w-full h-[calc(100vh-18rem)] text-left text-sm md:text-base bg-transparent border-none focus:outline-none focus:border-none resize-none overflow-auto p-2
                                scroll-smooth text-black dark:text-white
                                [&::-webkit-scrollbar]:w-2
                                [&::-webkit-scrollbar-track]:rounded-full
                                [&::-webkit-scrollbar-track]:bg-[#d0d0d0]/20
                                dark:[&::-webkit-scrollbar-track]:bg-[#414141]/20
                                [&::-webkit-scrollbar-thumb]:rounded-full
                                [&::-webkit-scrollbar-thumb]:bg-[#d0d0d0]
                                dark:[&::-webkit-scrollbar-thumb]:bg-[#414141]
                                [&::-webkit-scrollbar-thumb]:hover:bg-[#acabab]
                                dark:[&::-webkit-scrollbar-thumb]:hover:bg-[#2a2a2a]"
                    >
                        <div className="markdown">
                            <ReactMarkdown remarkPlugins={[remarkGfm, remarkBreaks]}>
                                {output}
                            </ReactMarkdown>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
};

export default SearchComponent;
