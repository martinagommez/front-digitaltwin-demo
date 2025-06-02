import { useState, useEffect, useRef } from 'react';
import { FaFileAlt } from "react-icons/fa";
import { FiChevronDown, FiChevronUp } from "react-icons/fi";
import Modal from 'react-modal';
import axios from 'axios';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkBreaks from 'remark-breaks';

import { useLanguageContext } from './LanguageContext';
import './styles.css';
import { PluginMeta, PluginKeys } from '../models/requests/PluginApi';

interface Message {
    text: string;
    language: string;
    id: string;
    files?: File[];
    images: string[]; // user-uploaded images
    bot_image?: string[]; // backend-generated images
    sender: 'user' | 'bot' | 'debug' | 'websocket';
    agent?: string;
    orch_config_id: string|undefined;
    orch_config_key: string|undefined;
    formFields?: Record<string, string | string[]>;
    formFieldLabels?: Record<string, string>; 
    formFieldOptions?: Record<string, { label: string; value: string }[]>;
};

interface ChatComponentProps {
    inputEnable: boolean;
    setInputEnable: React.Dispatch<React.SetStateAction<boolean>>;
    debugMode: boolean;
    setDebugMode: React.Dispatch<React.SetStateAction<boolean>>; 
    isChatSidebarOpen: boolean;
    setIsChatSidebarOpen: (open: boolean) => void;
    activedPlugin: PluginMeta | null;
    setActivedPlugin: React.Dispatch<React.SetStateAction<PluginMeta | null>>;
    pluginKeys: PluginKeys | null;
    setPluginKeys: React.Dispatch<React.SetStateAction<PluginKeys | null>>;
    selectedLanguage: string;
    darkMode: boolean;
}

function ChatComponent({ 
    inputEnable, setInputEnable, 
    debugMode, 
    isChatSidebarOpen, 
    activedPlugin,
    pluginKeys,
    selectedLanguage, 

}: ChatComponentProps) {
    const [inputText, setInputText] = useState<string>('');
    const [messages, setMessages] = useState<Message[]>([]);
    const [isUserAtBottom, setIsUserAtBottom] = useState<boolean>(true);
    const [showWebSockets, setShowWebSockets] = useState<boolean>(true);
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [sessionId, setSessionId] = useState<string>('');
    const [token, setToken] = useState<string>('');
    const [isSessionExpired, setIsSessionExpired] = useState<boolean>(false);
    const [isEndChat, setIsEndChat] = useState<boolean>(false);
    const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
    const [uploadedImages, setUploadedImages] = useState<File[]>([]);
    const [imagePreviews, setImagePreviews] = useState<string[]>([]);
    const [isConfigLoaded, setIsConfigLoaded] = useState<boolean>(false);
    const messagesEndRef = useRef<HTMLDivElement | null>(null);
    const chatContainerRef = useRef<HTMLDivElement>(null);
    const textAreaRef = useRef<HTMLTextAreaElement | null>(null);
    
    // Get data from context
    const { languageData } = useLanguageContext();

    // Formatação TimeStamp
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

    // Retorna mensagem do bot (primeira mensagem e respostas)
    const fetchMessage = async (formData: FormData) => {
        if (!activedPlugin) return;
        setInputEnable(false);
        setIsLoading(true);
        try {
            const url = activedPlugin.PluginHost.startsWith('https')
                ? activedPlugin.PluginHost
                : `https://${activedPlugin.PluginHost}`;
            console.log("Payload being sent to backend:", formData);
            for (const pair of formData.entries()) {
                console.log("   ➤", pair[0], pair[1]);
            }
            const response = await axios.post(url + "/message", formData, {
                headers: {
                    "Content-Type": "multipart/form-data",
                    'Access-Control-Allow-Origin': '*' // WARNING -> THIS MUST HAVE THE URL/message OF THE ORCHESTRATOR. ELSE IT MIGHT BE PRONE TO ERRORS. Is dangerous in production if not tightly controlled.
                }, timeout: 10000000
            });
            console.log("Response from backend", response);
            const apiResponse = response.data.response;
            setSessionId(response.data.session_id);
            setToken(response.data.token);
            // setFormTemplate(exampleTemplate);
            setIsConfigLoaded(true);
            console.log("Form Template set from backend:", response.data.template_fields);
            // const data: ChatAppResponse = await response.data;
            // setAnswer(data);
            // console.log("Setting answer:", data);
            let currentMessage = '';
            let index = 0;
            const typingEffect = () => {
                setIsLoading(false);
                setInputEnable(false);
                if (index < apiResponse.length) {
                    // WITHOUT TYPING EFFECT: substitute bellow currentMessage = apiResponse
                    // currentMessage += apiResponse[index];
                    currentMessage = apiResponse;
                    // Check if image URL exists
                    const botImage = response.data.bot_image ? [response.data.bot_image] : [];
                    setMessages(prevMessages => [
                        ...prevMessages.slice(0, -1),
                        { 
                            text: currentMessage, 
                            language: selectedLanguage, 
                            id: messageId, 
                            files: [], 
                            images: [],
                            bot_image: botImage,
                            sender: 'bot',
                            orch_config_id: pluginKeys!.orch_config_id, 
                            orch_config_key: pluginKeys!.orch_config_key
                        },
                    ]);
                    // WITHOUT TYPING EFFECT: comment index and timeout bellow and uncomment setInputEnable
                    // index++;
                    // setTimeout(typingEffect, 0);
                    setInputEnable(true);
                } else {
                    setInputEnable(true);
                    if (response.data.end_chat === "END_CHAT") {
                        setIsEndChat(true);
                        return;
                    }
                }
            };
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
            console.log("messageId from fetch message", messageId);
            setInputEnable(false);
            typingEffect();
            if (response.data.authentication === "AUTHENTICATION_FAILED") {
                setIsSessionExpired(true);
                return;
            }
            if (response.data.session === "SESSION_EXPIRED") {
                setIsSessionExpired(true);
                return;
            }
            // Handle "showAllMessages" when debugMode is enabled
            if (debugMode && response.data.showAllMessages) {
                const debugMessages = response.data.showAllMessages.map((msg: string) => ({
                    text: msg,
                    files: [],
                    images: [],
                    sender: "debug",
                }));
                setMessages(prevMessages => [...prevMessages, ...debugMessages]);
            }
        } catch (error) {
            console.error("Error on Fetching Message:", error);
            setIsLoading(false);
        }
    };

    // Envio da mensagem
    const handleSend = async () => {
        const hasText = (inputText.trim()).length > 0;
        const hasAttachments = uploadedFiles.length > 0 || uploadedImages.length > 0;
        if (!hasText && !hasAttachments) return;
        const messageId = new Date().getTime().toString();
        const formData = new FormData();
        formData.append("user_input", inputText || "");
        formData.append("timestamp", getFormattedTimestamp());
        formData.append("messageId", messageId);
        formData.append("session_id", sessionId);
        formData.append("token", token);
        formData.append("language", selectedLanguage);
        formData.append("body", "")
        formData.append("orch_config_id", activedPlugin?.PluginKeys.orch_config_id || "")
        formData.append("orch_config_key", activedPlugin?.PluginKeys.orch_config_key || "")
        // Add files directly as File objects
        if(uploadedFiles.length>0){
            uploadedFiles.forEach((file) => formData.append("files", file));
        }
        // Add images as File objects (which is a Blob type)
        if(uploadedImages.length>0){
            uploadedImages.forEach((image) => formData.append("images", image));  // Appending the File object (image)
        }
        // Update chat messages
        setMessages((prevMessages) => [
            ...prevMessages,
            { 
                text: inputText, 
                language: selectedLanguage, 
                id: messageId, 
                files: uploadedFiles, 
                images: imagePreviews,
                sender: "user",
                orch_config_id: activedPlugin?.PluginKeys.orch_config_id,
                orch_config_key:activedPlugin?.PluginKeys.orch_config_key
            },
        ]);
        console.log(formData)
        setInputText("");
        setUploadedFiles([]);
        setUploadedImages([]);
        setImagePreviews([]);
        setInputEnable(false);
        await fetchMessage(formData);
        console.log("Handle Message Send", formData);
    };

    // Extract text values from JSON
    const expiredText = languageData?.expiredText?.[selectedLanguage] || languageData?.expiredText?.['en-US'];
    const expiredSubText = languageData?.expiredSubText?.[selectedLanguage] || languageData?.expiredSubText?.['en-US'];
    const endedText = languageData?.endedText?.[selectedLanguage] || languageData?.endedText?.['en-US'];
    const endedSubText = languageData?.endedSubText?.[selectedLanguage] || languageData?.endedSubText?.['en-US'];
    const updateButton = languageData?.updateButton?.[selectedLanguage] || languageData?.updateButton?.['en-US'];
    const chatPlaceholder = languageData?.chatPlaceholder?.[selectedLanguage] || languageData?.chatPlaceholder?.['en-US'];

    //  Valores defualt para as features configuráveis pelo json
	const [featuresStates, setFeaturesStates] = useState({
		enableFiles: true,
        enableImages: true,
        enableExpiredNotification: false,
        enableExpiredPopup: true,
        enableEndedNotification: true,
        enableEndedPopup: false,
        displayAgents: true,
        enableFeedback: true,
        enableAudio: true,
        enableCopy: true,
        enableAnalysis: false

	});

    // Update das features com os valores alterados no json
	useEffect(() => {
		const updateFeaturesStates = async () => {
			try {
				const response = await fetch('/client.config.json');
				const data = await response.json();
				if (data.enableFeatures) {
					setFeaturesStates({
                        enableFiles:  data.enableFeatures.enableFiles ?? true,
                        enableImages: data.enableFeatures.enableImages ?? true,
                        enableExpiredNotification: data.enableFeatures.enableExpiredNotification ?? false,
                        enableExpiredPopup: data.enableFeatures.enableExpiredPopup ?? true,
                        enableEndedNotification: data.enableFeatures.enableEndedNotification ?? true,
                        enableEndedPopup: data.enableFeatures.enableEndedPopup ?? false,
                        displayAgents: data.enableFeatures.displayAgents ?? true,
                        enableFeedback: data.enableFeatures.enableFeedback ?? true,
                        enableAudio: data.enableFeatures.enableAudio ?? true,
                        enableCopy: data.enableFeatures.enableCopy ?? true,
                        enableAnalysis: data.enableFeatures.enableAnalysis ?? false

					});
				}
                console.log('Language Data:', data);
			} catch (error) {
				console.error('Error fetching button states:', error);
			} finally {
				setIsConfigLoaded(true); // Mark as loaded
                console.log("Is config loaded:", isConfigLoaded)
			}
		};
		updateFeaturesStates();
	}, []);

    // Auto-scroll no campo de mensagens
    // Detect if the user is at the bottom
    useEffect(() => {
        const chatContainer = chatContainerRef.current;
        if (!chatContainer) return;
        const handleScroll = () => {
            const isAtBottom =
                chatContainer.scrollHeight - chatContainer.scrollTop <= chatContainer.clientHeight + 10;
            setIsUserAtBottom(isAtBottom);
        };
        chatContainer.addEventListener("scroll", handleScroll);
        return () => chatContainer.removeEventListener("scroll", handleScroll);
    }, []);

    // Auto-scroll only when user is at the bottom
    useEffect(() => {
        if (isUserAtBottom) {
            messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
        }
    }, [messages]);

    // Plugin ativo: append da mensagem ao formData e fetchMessage com esse formData
    useEffect(() => {
        const formData = new FormData();
        formData.append("user_input", ""); // Empty text
        formData.append("body","");
        formData.append("language",selectedLanguage);
        console.log("language first message", selectedLanguage);
        formData.append("timestamp", getFormattedTimestamp());
        formData.append("orch_config_id", activedPlugin?.PluginKeys.orch_config_id ?? "");
        formData.append("orch_config_key", activedPlugin?.PluginKeys.orch_config_key ?? "");
        fetchMessage(formData);
        console.log("Actived Plugin do useEffect do chatbot", formData);
        console.log("Session expired state at beginning", isSessionExpired);
        console.log("Chat ended state at beginning", isEndChat);
    }, []);

    // Desativar caixa de texto quando a sessão expira
    useEffect(() => {
        if (isSessionExpired) {
            setInputEnable(false); // Block the chat when the session expires
        }
    }, [isSessionExpired]);

    // Desativar caixa de texto quando a sessão termina
    useEffect(() => {
        if (isEndChat) {
            setInputEnable(false); // Block the chat when the chat ends
        }
    }, [isEndChat]);

    useEffect(() => {
        if (textAreaRef.current) {
            textAreaRef.current.style.height = "auto"; // Reset height to recalculate
            textAreaRef.current.style.height = `${textAreaRef.current.scrollHeight}px`; // Adjust height
        }
    }, [inputText]); // Runs every time inputText changes (including speech-to-text updates)

    useEffect(() => {
        if (inputEnable) {
            textAreaRef.current?.focus();
        }
    }, [inputEnable]);

    return (
        <div className="flex flex-col md:flex-row w-full h-full"> {/* Main flex container */}
            {/* Main UI */}
            <div className={`${isChatSidebarOpen ? "w-full h-1/2 md:w-2/3 md:h-full" : "w-full h-full"} flex flex-col bg-white dark:bg-neutral-800 rounded-lg`}>
                {/* Scroll-bar do chat */}
                <div 
                    ref={chatContainerRef}
                    className="flex-1 p-6 overflow-y-auto overflow-x-hidden scroll-smooth
                        [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar]:h-2
                        [&::-webkit-scrollbar-track]:rounded-full
                        [&::-webkit-scrollbar-track]:bg-[#d0d0d0]/20
                        dark:[&::-webkit-scrollbar-track]:bg-[#414141]/20
                        [&::-webkit-scrollbar-thumb]:rounded-full
                        [&::-webkit-scrollbar-thumb]:bg-[#d0d0d0]
                        dark:[&::-webkit-scrollbar-thumb]:bg-[#414141]
                        [&::-webkit-scrollbar-thumb]:hover:bg-[#acabab]
                        dark:[&::-webkit-scrollbar-thumb]:hover:bg-[#2a2a2a]"
                >
                    {/* WebSocket Messages Container */}
                    {featuresStates.displayAgents && (
                        <div className="relative mb-4 w-full max-w-[725px] p-4 rounded-3xl bg-neutral-100 dark:bg-neutral-900 text-black dark:text-white">

                            {/* Toggle Button */}
                            <button
                                onClick={() => setShowWebSockets((prev) => !prev)}
                                className="absolute top-2 right-2 p-2 z-10 text-black dark:text-white bg-transparent"
                            >
                                {showWebSockets ? <FiChevronUp className="w-6 h-6" /> : <FiChevronDown className="w-6 h-6" />}
                            </button>

                            {/* WebSocket Messages */}
                            {showWebSockets ? (
                                <div className="mt-10">
                                    {messages.map((message, index) => (
                                        message.sender === "websocket" && (
                                            <div key={index} className="flex flex-row items-center mb-2">
                                                <div className="font-bold pr-4">{message.agent}</div>
                                                <div className="bg-neutral-50 dark:bg-neutral-950 p-2 rounded-md">
                                                    <ReactMarkdown remarkPlugins={[remarkGfm, remarkBreaks]}>
                                                        {message.text}
                                                    </ReactMarkdown>
                                                </div>
                                            </div>
                                        )
                                    ))}
                                </div>
                            ) : (
                                <div className="relative text-left text-sm pr-8 text-black dark:text-white">
                                    Show agents' conversation
                                </div>
                            )}
                        </div>
                    )}

                    {/* Display non-websocket messages */}
                    {messages.map((message, index) =>
                        message.sender !== "websocket" ? (
                            <div key={index} className={`mb-4 ${message.sender === 'user' ? 'text-right' : 'text-left'}`}>
                                <div
                                    className={`relative inline-block pr-4 pl-4 pb-2 rounded-3xl ${
                                        message.sender === "user"
                                            ? "bg-[var(--client-color)] dark:bg-[var(--client-color-dark)] text-white pt-3 text-xs md:text-sm"
                                            : message.sender === "debug"
                                            ? "bg-yellow-200 dark:bg-yellow-800 text-black dark:text-white pt-10 text-xs md:text-sm"
                                            : "bg-neutral-200 text-black dark:bg-neutral-900 dark:text-white pt-10 text-xs md:text-sm"
                                    }`}
                                >
                                    {!(index === messages.length - 1 && !inputEnable) && (
                                        <div
                                            className={`absolute flex flex-row items-center justify-between p-1 top-3 right-3
                                                ${message.sender === 'user' ? 'hidden' : 'justify-end'}
                                                `}
                                        >
                                            {/* Copy Button */}
                                            {featuresStates.enableCopy && (
                                                <div>
                                                    <button
                                                        onClick={() => {console.log("📎 Copy - message.id onClick:", message.id); copyToClipboard(message.text, message.id)}}
                                                        className="w-6 h-6 text-black dark:text-white hover:text-neutral-700 dark:hover:text-neutral-300"
                                                    >
                                                        {copiedMessageId === message.id ? (
                                                            <FiCheck className="w-4 h-4" />
                                                        ) : (
                                                            <FiCopy className="w-4 h-4" />
                                                        )}
                                                    </button>
                                                </div>
                                            )}
                                            {/* Analysis Sidebar Button */}
                                            {featuresStates.enableAnalysis && (
                                                <div>
                                                    <button
                                                        onClick={() => handleAnalysis()}
                                                        className="w-6 h-6 text-black dark:text-white hover:text-neutral-700 dark:hover:text-neutral-300"
                                                    >
                                                        <FiSidebar className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            )}

                                        </div>
                                    )}

                                    {/* Message Text */}
                                    {message.formFields ? (
                                        <div className="text-left">
                                            {Object.entries(message.formFields).map(([key, value]) => {
                                                const label = message.formFieldLabels?.[key] || key;
                                                const options = message.formFieldOptions?.[key] || [];
                                                const renderValue = () => {
                                                    if (Array.isArray(value)) {
                                                        return value
                                                            .map((val) => options.find((opt) => opt.value === val)?.label || val)
                                                            .join(', ');
                                                    } else {
                                                        return options.find((opt) => opt.value === value)?.label || value;
                                                    }
                                                };
                                                return (
                                                    <div key={key} className="mb-1">
                                                    <span className="font-bold">{label}:</span>
                                                    <span className="whitespace-pre-wrap"> {renderValue()}</span>
                                                    </div>
                                                );
                                                })}
                                        </div>
                                        ) : (
                                            // Regular markdown-rendered message
                                            <div className="markdown">
                                                <ReactMarkdown remarkPlugins={[remarkGfm, remarkBreaks]}>
                                                    {message.text}
                                                </ReactMarkdown>
                                            </div>
                                    )}

                                    {/* Display bot-sent images in chat area*/}
                                    {message.bot_image && message.bot_image.length > 0 && (
                                        <div className="w-56 h-auto">
                                            {message.bot_image.map((bot_image, i: number) => (
                                                <div key={i} className="flex flex-col items-start bg-neutral-100 dark:bg-neutral-800 p-2 m-4">
                                                    <img
                                                        src={bot_image}
                                                        alt={`AI generated image ${i}`}
                                                        className="rounded-md border border-gray-300 dark:border-gray-700"
                                                    />
                                                    <span className="text-xs text-gray-500 mb-1">AI generated image</span>
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    {/* Display user-sent images in chat area */}
                                    {message.images && message.images.length > 0 && (
                                        <div className="w-56 h-auto">
                                            {message.images.map((image, i: number) => (
                                                <img
                                                    key={i}
                                                    src={image}
                                                    alt={`Uploaded Image ${i}`}
                                                    className="bg-white dark:bg-neutral-800 p-2 m-4 rounded-md"
                                                />
                                            ))}
                                        </div>
                                    )}

                                    {/* Display user-sent files in chat area */}
                                    {message.files && message.files.length > 0 && (
                                        <div className="w-64 h-auto">
                                            {message.files.map((file: { name: string; size: number }, i: number) => (
                                                <div key={i} className="flex flex-row items-center bg-white dark:bg-neutral-800 p-2 m-4 rounded-md">
                                                    <FaFileAlt className="text-3xl mr-2 text-neutral-600 dark:text-white flex-shrink-0" />
                                                    <div className="flex flex-col w-full text-left overflow-hidden">
                                                        <span className="text-sm text-black dark:text-white truncate w-full">{file.name}</span>
                                                        <span className="text-xs font-sans text-neutral-800 dark:text-neutral-300">{file.size} bytes</span>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    {/* Buttons for each message: Like, Dislike and Audio*/}
                                    {message.text && !(index === messages.length - 1 && !inputEnable) && (
                                        <div key={message.id} className={`flex ${message.sender === 'user' ? 'hidden' : 'justify-start'}`}>
                                            {/* Feedback buttons */}
                                            {featuresStates.enableFeedback && (
                                                <div className='flex'>
                                                    <button
                                                        onClick={() => handleFeedback(message.id, "like")}
                                                        className="flex items-center justify-center w-5 h-5 mr-1
                                                            text-black dark:text-white hover:text-neutral-700 dark:hover:text-neutral-300"
                                                    >
                                                        {messageFeedback[message.id] === "like" ? (
                                                            <AiFillLike className="w-5 h-5" />
                                                        ) : (
                                                            <AiOutlineLike className="w-5 h-5" />
                                                        )}
                                                    </button>
                                                    <button
                                                        onClick={() => handleFeedback(message.id, "dislike")}
                                                        className="flex items-center justify-center w-5 h-5 mr-2
                                                            text-black dark:text-white hover:text-neutral-700 dark:hover:text-neutral-300"
                                                    >
                                                        {messageFeedback[message.id] === "dislike" ? (
                                                            <AiFillDislike className="w-5 h-5" />
                                                        ) : (
                                                            <AiOutlineDislike className="w-5 h-5" />
                                                        )}
                                                    </button>
                                                </div>
                                            )}
                                            {/* Play audio button */}
                                            {featuresStates.enableAudio && (
                                                <div>
                                                    <button
                                                        title={playingMessageId === message.id ? audioPauseButton : audioPlayButton}
                                                        onClick={() => {console.log("🎵 Play/Pause - message.id onClick:", message.id); playChatbotResponse(message.text, message.id);}}
                                                        className="flex items-center justify-center rounded-full w-5 h-5 mb-2 
                                                            bg-black dark:bg-white text-neutral-200 dark:text-neutral-900 hover:bg-neutral-700 dark:hover:bg-neutral-300"
                                                    >
                                                        {playingMessageId === message.id ? (
                                                            <FaPause className="w-[10px] h-[10px] ml-[1px]" />
                                                        ) : (
                                                            <FaPlay className="w-[10px] h-[10px] ml-[1px]" />
                                                        )}
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>
                        ) : null
                    )}

                    {/* 3 dots loading massage box */}
                    {isLoading && (
                        <div className="mb-4 text-left">
                            <div className="inline-block p-4 rounded-3xl bg-neutral-200 text-black dark:bg-neutral-700 dark:text-white">
                                <div className="flex items-center">
                                    <div className="animate-pulse h-3 w-3 bg-neutral-300 rounded-full mr-2"></div>
                                    <div className="animate-pulse h-3 w-3 bg-neutral-300 rounded-full mr-2"></div>
                                    <div className="animate-pulse h-3 w-3 bg-neutral-300 rounded-full"></div>
                                </div>
                            </div>
                        </div>
                    )}
                    <div ref={messagesEndRef} />
                </div>

                <div className="p-4 h-auto w-full bg-white dark:bg-neutral-800 rounded-lg">
                    <div className="relative flex flex-col">

                        {/* Session Expired Notification */}
                        {isSessionExpired && featuresStates.enableExpiredNotification && (
                            <div className="flex justify-center items-center border border-[var(--client-color)] w-full bg-white text-black p-4 rounded-md text-center">
                                <div>
                                    <h2 className="md:text-lg text-base font-semibold mb-2">{expiredText}</h2>
                                    <p className="md:text-sm text-xs mb-2">{expiredSubText}</p>
                                    <button
                                        onClick={() => window.location.reload()}
                                        className="md:text-sm text-xs px-4 py-2 bg-[var(--client-color)] text-white rounded-lg"
                                    >
                                        {updateButton}
                                    </button>
                                </div>
                            </div>
                        )}
                        {/* Chat Ended Notification */}
                        {isEndChat && featuresStates.enableEndedNotification && (
                            <div className="flex justify-center items-center border border-[var(--client-color)] w-full bg-white text-black p-4 rounded-md text-center">
                                <div>
                                    <h2 className="md:text-lg text-base font-semibold mb-2">{endedText}</h2>
                                    <p className="md:text-sm text-xs mb-2">{endedSubText}</p>
                                    <button
                                        onClick={() => window.location.reload()}
                                        className="md:text-sm text-xs px-4 py-2 bg-[var(--client-color)] text-white rounded-lg"
                                    >
                                        {updateButton}
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* Input Area */}
                        {isConfigLoaded && (
                            <div className="relative w-full flex">
                                {inputEnable ? (
                                // When inputEnable is true
                                    <div className="relative w-full h-auto text-sm md:text-base rounded-3xl pr-2 pl-2 pt-3 resize-none overflow-auto bg-neutral-100 dark:bg-zinc-700 dark:text-white">
                                        <div className="flex flex-row overflow-x-auto scroll-smooth w-full
                                            [&::-webkit-scrollbar]:h-2
                                            [&::-webkit-scrollbar-track]:rounded-full
                                            [&::-webkit-scrollbar-track]:bg-neutral-400/40
                                            dark:[&::-webkit-scrollbar-track]:bg-neutral-800/40
                                            [&::-webkit-scrollbar-thumb]:rounded-full
                                            [&::-webkit-scrollbar-thumb]:bg-neutral-400
                                            dark:[&::-webkit-scrollbar-thumb]:bg-neutral-800
                                            [&::-webkit-scrollbar-thumb]:hover:bg-neutral-500
                                            dark:[&::-webkit-scrollbar-thumb]:hover:bg-neutral-900"
                                        >
                                        </div>
                                        {/* Text area */}
                                        <textarea
                                            ref={textAreaRef}
                                            className="w-full max-h-40 text-sm md:text-base bg-transparent border-none focus:outline-none focus:border-none resize-none overflow-auto p-2
                                                scroll-smooth
                                                [&::-webkit-scrollbar]:w-2
                                                [&::-webkit-scrollbar-track]:rounded-full
                                                [&::-webkit-scrollbar-track]:bg-[#d0d0d0]/20
                                                dark:[&::-webkit-scrollbar-track]:bg-[#414141]/20
                                                [&::-webkit-scrollbar-thumb]:rounded-full
                                                [&::-webkit-scrollbar-thumb]:bg-[#d0d0d0]
                                                dark:[&::-webkit-scrollbar-thumb]:bg-[#414141]
                                                [&::-webkit-scrollbar-thumb]:hover:bg-[#acabab]
                                                dark:[&::-webkit-scrollbar-thumb]:hover:bg-[#2a2a2a]"
                                            placeholder={chatPlaceholder}
                                            value={inputText}
                                            onChange={(e) => setInputText(e.target.value)}
                                            onKeyPress={(e) => {
                                                if (e.key === 'Enter' && !e.shiftKey) {
                                                    e.preventDefault(); // Prevents creating a new line
                                                    handleSend();
                                                }
                                            }}
                                            rows={1}
                                        />
                                    </div>
                                ) : (
                                    // When inputEnable is false
                                    <div className="w-full h-auto text-sm md:text-base rounded-3xl pr-2 pl-2 pt-3 resize-none overflow-auto bg-neutral-100 dark:bg-zinc-700 dark:text-white">
                                        {/* Text area */}
                                        <input
                                            type="text"
                                            className="w-full max-h-40 text-sm md:text-base bg-transparent border-none focus:outline-none focus:border-none resize-none overflow-auto p-2"
                                            placeholder={chatPlaceholder}
                                            value={""}
                                            disabled
                                        />
                                    </div>
                                )}
                            </div>
                        )}

                    </div>
                </div>

                {/* Modal pop-up for Session Expired */}
                <Modal
                    isOpen={isSessionExpired && featuresStates.enableExpiredPopup}
                    onRequestClose={() => window.location.reload()}
                    className="flex items-center justify-center h-screen"
                    overlayClassName="fixed inset-0 bg-black bg-opacity-50"
                >
                    <div className="bg-white p-6 rounded-lg shadow-md text-center">
                        <h2 className="text-xl font-semibold mb-4">{expiredText}</h2>
                        <p className="mb-4">{expiredSubText}</p>
                        <button
                            onClick={() => window.location.reload()}
                            className="px-4 py-2 bg-[var(--client-color)] text-white rounded-lg"
                            >
                            {updateButton}
                        </button>
                    </div>
                </Modal>
                {/* Modal pop-up for Session Ended */}
                <Modal
                    isOpen={isEndChat && featuresStates.enableEndedPopup}
                    onRequestClose={() => window.location.reload()}
                    className="flex items-center justify-center h-screen"
                    overlayClassName="fixed inset-0 bg-black bg-opacity-50"
                >
                    <div className="bg-white p-4 rounded-lg shadow-md text-center md:w-60 w-52 md:h-40 h-32">
                        <h2 className="text-xl font-semibold mb-4">{endedText}</h2>
                        <p className="mb-4">{endedSubText}</p>
                        <button
                            onClick={() => window.location.reload()}
                            className="px-4 py-2 bg-[var(--client-color)] text-white rounded-lg md:text-sm text-xs"
                            >
                            {updateButton}
                        </button>
                    </div>
                </Modal>

            </div>

        </div>
    );
}

export default ChatComponent;


// function stopSpeech(messageId: string) {
//     throw new Error('Function not implemented.');
// }
    //Pedido para verificar se a sessão ainda está válida
    // const checkBackendSessionStatus = async () => { 
    //     if (!activedPlugin) return;
    //     try {
    //         //session validation endpoint do backend
    //         activedPlugin.PluginHost = activedPlugin.PluginHost.startsWith("https") ? activedPlugin.PluginHost : activedPlugin.PluginHost.replace('http', 'https');
    //         const url = activedPlugin.PluginHost.startsWith('https') ? activedPlugin.PluginHost : `https://${activedPlugin.PluginHost}`;
    //         const body = {
    //             timestamp: getFormattedTimestamp(),
    //             language: "pt-PT",
    //             session_id: sessionId,
    //             token: token,
    //             user_input: "",
    //         }
    //         const response = await axios.post(url + "/session_validation",
    //             body, 
    //             {
    //             headers: {
    //                 "mode": "no-cors",
    //                 'Content-Type': 'application/json',
    //             }
    //         });
    //         console.log(response.data);
    //         if (response.data === "SESSION_EXPIRED") {
    //             setIsSessionExpired(true);
    //         }
    //     } catch (error) {
    //         console.error("Error on checking backend status:", error);
    //     }
    // };
    //Executa a função acima de x em x tempo
    // useEffect(() => {
    //     const intervalId = setInterval(() => {
    //         checkBackendSessionStatus();
    //     }, 10000); // every 60000 milliseconds = 1 minute
    //     return () => clearInterval(intervalId);
    // }, [activedPlugin]);

    
    // Handle sending audio messages
    // const handleSendAudio = async (audioBlob: Blob) => {
    //     const formData = new FormData();
    //     formData.append("audio", audioBlob);
    //     formData.append("session_id", sessionId);
    //     formData.append("token", token);
    //     // Send audio to backend for transcription
    //     try {
    //         const response = await fetch("https://your-backend.com/audio-to-text", {
    //             method: "POST",
    //             body: formData,
    //         });
    //         const data = await response.json();
    //         if (data.text) {
    //             setMessages([...messages, { text: data.text, id: '', sender: "user", files: [], images:[] }]);
    //             fetchMessage(data.text); // Process text as if the user had typed it
    //         }
    //     } catch (error) {
    //         console.error("Error sending audio:", error);
    //     }
    // };

    // // Play Chatbot Response
    // // Using Web Speech API (SpeechSynthesis) that enables text-to-speech
    // const playChatbotResponse = (chatbotResponse: string, messageId: string) => {
    //     if (!chatbotResponse) return;
    //     const speechSynthesis = window.speechSynthesis; //browser's built-in speech engine that processes and plays text as speech.
    //     // If the same message is playing, stop it
    //     if (playingMessageId === messageId) {
    //         speechSynthesis.cancel(); // Stop speech
    //         setPlayingMessageId(null);
    //         return;
    //     }
    //     speechSynthesis.cancel();
    //     // Otherwise, play the new message
    //     const utterance = new SpeechSynthesisUtterance(chatbotResponse);
    //     // Set the language based on the selectedLanguage
    //     utterance.lang = selectedLanguage || 'en'; // Default to 'en' if no language is selected
    //     utterance.onend = () => setPlayingMessageId(null); // Reset state when audio ends
    //     // Start speaking the response
    //     speechSynthesis.speak(utterance);
    //     setPlayingMessageId(messageId);
    // };

        // useEffect(() => {
    //     const ws = new WebSocket("ws://127.0.0.1:8000/ws");
    //     ws.onopen = () => {
    //         console.log("Connected to WebSocket");
    //     };
    //     ws.onmessage = (event) => {
    //         console.log("Message received:", event.data);
    //         setMessages((prevMessages) => [...prevMessages, event.data]);
    //     };
    //     ws.onclose = () => {
    //         console.log("WebSocket closed");
    //         setTimeout(() => {
    //             setSocket(new WebSocket("ws://127.0.0.1:8000/ws")); // Attempt reconnection
    //         }, 3000);
    //     };
    //     ws.onerror = (error) => {
    //         console.error("WebSocket error:", error);
    //         ws.close();
    //     };
    //     setSocket(ws);
    //     return () => {
    //         ws.close();
    //     };
    // }, []);

    // Websockets simulation
    // useEffect(() => {
    //     let counter = 0;
    //     const maxMessages = 6; // Set a limit to 6 messages from the agents
    //     const fakeWebSocket = setInterval(() => {
    //         if (counter >= maxMessages) {
    //             clearInterval(fakeWebSocket); // Stop after reaching the limit
    //         } else {
    //             const simulatedMessage: Message = {
    //                 sender: "websocket",
    //                 agent: `Agent ${counter % 3}`, // Simulating different agents
    //                 text: `Simulated message ${counter + 1} from Agent ${counter % 3}`,
    //                 id: '',
    //                 files: [],
    //                 images: [],
    //             };
    //             setMessages((prev) => [...prev, simulatedMessage]);
    //             counter++;
    //         }
    //     }, 2000); // Simulates a message every 2 seconds
    //     return () => clearInterval(fakeWebSocket);
    // }, []);