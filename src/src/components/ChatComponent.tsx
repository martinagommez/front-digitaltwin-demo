import { useState, useEffect, useRef } from 'react';
import { useDebounce } from 'use-debounce';
import * as sdk from "microsoft-cognitiveservices-speech-sdk";
import { FaFileAlt, FaPause, FaPlay } from "react-icons/fa";
import { FiImage, FiFile, FiX, FiSend, FiSlash, FiChevronDown, FiChevronUp, FiCheck, FiCopy, FiSidebar } from "react-icons/fi";
import { AiOutlineLike, AiOutlineDislike, AiFillLike, AiFillDislike } from "react-icons/ai";
import Modal from 'react-modal';
import axios from 'axios';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkBreaks from 'remark-breaks';

import { useLanguageContext } from './LanguageContext';
import AudioProcessing from './AudioProcessing';
import AnalysisComponent from './AnalysisComponent';
import './styles.css';
import { ChatAppResponse } from '../api/models';
import { PluginMeta, PluginKeys } from '../models/requests/PluginApi';

interface Message {
    text: string;
    language: string;
    id: string;
    files?: File[];
    images?: string[];
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
    autoAudioPlay: boolean;
}

type FormField = {
    label: string;
    type: string; // 'text', 'textarea', etc.
    name: string;
    placeholder?: string;
    options?: { label: string; value: string }[]; 
};

type Template = {
    title?: string;
    fields?: (FormField | { title: string; fields: FormField[] })[]; // handle single fields and grouped fields
};

function ChatComponent({ 
    inputEnable, setInputEnable, 
    debugMode, setDebugMode, 
    isChatSidebarOpen, setIsChatSidebarOpen, 
    activedPlugin, setActivedPlugin,
    pluginKeys,
    selectedLanguage, 
    darkMode, 
    autoAudioPlay 
}: ChatComponentProps) {
    const [inputText, setInputText] = useState<string>('');
    const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);
    const [messageFeedback, setMessageFeedback] = useState<{ [id: string]: "like" | "dislike" | null }>({});
	const [feedbackApi, setFeedbackApi] = useState<string>('');
    const [messages, setMessages] = useState<Message[]>([]);
    const [playingMessageId, setPlayingMessageId] = useState<string | null>(null);
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
    const [answer, setAnswer] = useState<ChatAppResponse | null>(null);
    const [formTemplate, setFormTemplate] = useState<Template | null>(null);
    const [formValues, setFormValues] = useState<Record<string, string | string[]>>({});
    const [formError, setFormError] = useState<boolean>(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const imageInputRef = useRef<HTMLInputElement>(null);
    const messagesEndRef = useRef<HTMLDivElement | null>(null);
    const chatContainerRef = useRef<HTMLDivElement>(null);
    const textAreaRef = useRef<HTMLTextAreaElement | null>(null);
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const currentPlayingMessageIdRef = useRef<string | null>(null);
    const lastPlayedMessageRef = useRef<string | null>(null);
    const isPlayingRef = useRef<boolean>(false);
    
    const exampleAnswer: ChatAppResponse = {
        context: {
            thoughts: [
                { title: "Data Extractor", description: "Pulled latest quarterly data from investor presentation and financial report.", props: {deployment: "chat-4o-mini", model:"gpt-4o-mini"} },
                { title: "Summary Agent", description: "Identified top 5 KPIs to highlight in the response based on financial impact and relevance.", props: {deployment: "chat-4o-mini", model:"gpt-4o-mini"} },
                { title: "Risk Analyst", description: "Detected potential concerns in regulatory changes and debt levels; suggested flagging them subtly." },
                { title: "Clarity Optimizer", description: "Rephrased financial jargon to make it accessible to non-expert users while preserving accuracy." },
                { title: "Narrative Builder", description: "Assembled a coherent summary starting with financial highlights, followed by ESG and innovation efforts." },
                { title: "Validation Agent", description: "Cross-checked figures against the original PDF to ensure consistency." },
                { title: "Tone Manager", description: "Ensured the message maintains a professional and neutral tone appropriate for executive reporting." },
                { title: "Final Compiler", description: "Compiled the final message for delivery, ready for rendering in chat interface." }
            ],
            support: [
                "https://www.edp.com/sites/default/files/2024-05/EDP%20-%201Q24%20Results%20Presentation.pdf",
                "Content 1: The company finalized the acquisition of a 400MW solar portfolio in the U.S. Electricity distributed increased by 2.3%, mostly due to higher demand in Brazil.Digitalization initiatives reduced OPEX by 5% compared to the previous quarter. Stakeholder engagement efforts increased, with over 20 ESG-focused investor meetings in Q1. The number of customers with green energy contracts grew by 12% quarter over quarter.Regulatory changes in Iberia could impact hydroelectric margins in Q2.",
                "Content 2: Electricity distributed increased by 2.3%, mostly due to higher demand in Brazil.",
                "Content 3: Digitalization initiatives reduced OPEX by 5% compared to the previous quarter.",
                "Content 4: Stakeholder engagement efforts increased, with over 20 ESG-focused investor meetings in Q1. The number of customers with green energy contracts grew by 12% quarter over quarter.",
                "Content 5: The number of customers with green energy contracts grew by 12% quarter over quarter. Regulatory changes in Iberia could impact hydroelectric margins in Q2. Hybrid bond issuance in March secured €750 million at favorable terms. The first offshore wind turbine was successfully installed at the Moray West project. Employee satisfaction scores rose by 7% following remote work policy updates. The solar self-consumption segment grew by 19%, especially in southern markets."
            ],
            citations: [
                "https://www.edp.com/sites/default/files/2024-05/Relat%C3%B3rio%20Intercalar%201%C2%BATrimestre%202024.pdf", 
                "https://www.edp.com/sites/default/files/2024-05/EDP%20-%201Q24%20Results%20Presentation.pdf"
            ]
        }
    };

    useEffect(() => {
        console.log("Setting answer:", exampleAnswer);
        setAnswer(exampleAnswer);
    }, []); // Runs only once when component mounts setAnswer(exampleAnswer);

    // Get data from context
    const { speechKey, speechRegion, voices, languageData } = useLanguageContext();

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
            const botImage = response.data.bot_image ? [response.data.bot_image] : [];
            setSessionId(response.data.session_id);
            setToken(response.data.token);
            setFormTemplate(response.data.template_fields);
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
                    // Without typping effect: substitute bellow currentMessage = apiResponse
                    currentMessage += apiResponse[index];
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
                    // Without typing effect: comment index and timeout bellow
                    index++;
                    setTimeout(typingEffect, 0);
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

    useEffect(() => {
        console.log("Form Template set (effect):", formTemplate);
        console.log("Is Config Loaded (effect):", isConfigLoaded);
    }, [formTemplate, isConfigLoaded]);

    const handleFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormValues(prev => ({ ...prev, [name]: value }));
    };

    const handleFormSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formTemplate || !formTemplate.fields) {
            console.error("Form template or its fields are undefined");
            return;
        }
        const allFields = formTemplate.fields.flatMap(field =>
            'fields' in field ? field.fields : [field]
        );
        // Build name-to-label mapping
        const fieldLabels = Object.fromEntries(
            allFields.map(f => [f.name, f.label || f.name])
        );
        const fieldOptions = Object.fromEntries(
            allFields.map(f => [f.name, f.options || []])
        );
        // Check for missing required fields
        const missingFields = allFields.filter(f => {
            const value = formValues[f.name];
            if (Array.isArray(value)) {
                return value.length === 0; // multiselect: no option selected
            }
            return !value?.trim(); // string: empty or whitespace only
        });
        if (missingFields.length > 0) {
            setFormError(true);
            return;
        }
        setFormError(false);
        console.log("Submitted form data:", formValues);
        // Push it into the messages state as a user message
        setMessages(prevMessages => [
            ...prevMessages,
            {
                text: "",
                sender: 'user',
                id: new Date().getTime().toString(),
                language: selectedLanguage,
                files: [],
                images: [],
                orch_config_id: pluginKeys!.orch_config_id,
                orch_config_key: pluginKeys!.orch_config_key,
                formFields: formValues,
                formFieldLabels: fieldLabels,
                formFieldOptions: fieldOptions
            }
        ]);
        // Reset the form
        setFormTemplate(null);
        setIsConfigLoaded(false);
        setFormValues({});
        const messageId = new Date().getTime().toString();
        const formData = new FormData();
        // Add keys expected by fetchMessage
        formData.append("user_input", inputText || "");
        formData.append("timestamp", getFormattedTimestamp());
        formData.append("messageId", messageId);
        formData.append("session_id", sessionId);
        formData.append("token", token);
        formData.append("language", selectedLanguage);
        formData.append("body", "")
        formData.append("orch_config_id", pluginKeys!.orch_config_id);
        formData.append("orch_config_key", pluginKeys!.orch_config_key);
        // Create structured array of { name, answer } and send as one field
        const formattedTemplateFields = Object.entries(formValues).map(([name, answer]) => ({
            [name]:answer
        }));
        formData.append("template_fields", JSON.stringify(formattedTemplateFields));
        await fetchMessage(formData);
        console.log("Handle Form Send", formData);
    };

    // Envio da mensagem
    const handleSend = async () => {
        if (!inputText.trim()) return;
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

    const copyToClipboard = async (messageText: string, messageId: string) => {
        try {
            await navigator.clipboard.writeText(messageText);
            setCopiedMessageId(messageId);
            setTimeout(() => setCopiedMessageId(null), 1500);  // Reset after 1.5s
        } catch (error) {
            console.error("Failed to copy:", error);
        }
    };

    const sendFeedbackToBackend = async (messageId: string, feedback: "like" | "dislike" | null) => {
        try {
            await fetch(feedbackApi, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ messageId, feedback }),
            });
        } catch (error) {
            console.error("Error sending feedback:", error);
        }
    };

    const handleFeedback = (messageId: string, type: "like" | "dislike") => {
        setMessageFeedback(prev => {
            const current = prev[messageId];
            let updatedType: "like" | "dislike" | null;
            if (current === type) {
                updatedType = null; // Deselect if already selected
            } else {
                updatedType = type; // Set the new type
            }
            // Send to backend
            sendFeedbackToBackend(messageId, updatedType);
            return { ...prev, [messageId]: updatedType };
        });
    };

    const handleAnalysis = async () => {
        setIsChatSidebarOpen(true);
    };

    const closeSidebar = () => {
        setIsChatSidebarOpen(false);
    };

    const [debouncedMessages] = useDebounce(messages, 500);
    useEffect(() => {
        if (!autoAudioPlay) return;
        if (debouncedMessages.length === 0) return;
        const lastMessage = debouncedMessages[debouncedMessages.length - 1];
        // Ensure the bot message is new & no duplicate playback
        if (
            lastMessage.sender === "bot" &&
            lastMessage.text.trim() !== "" &&
            lastPlayedMessageRef.current !== lastMessage.id &&
            !isPlayingRef.current
        ) {
            lastPlayedMessageRef.current = lastMessage.id;
            isPlayingRef.current = true;
            playChatbotResponse(lastMessage.text, lastMessage.id).finally(() => {
                isPlayingRef.current = false;
            });
        }
    }, [debouncedMessages, autoAudioPlay]);

    // Function to get the correct Azure voice for the selected language
    const getAzureVoice = (language: string) => {
        console.log( "🗣️ getAzureVoice", language)
        return voices[language] || "en-US-JennyNeural"; // Default to English if not found
    };

    // Synthesizes text to audio using Azure Speech Services. Returns a Promise that resolves with a blob URL of the audio.
    const synthesizeTextToAudio = (text: string): Promise<string> => {
        return new Promise((resolve, reject) => {
            try {
                // Create speech configuration with your subscription key and region.
                const speechConfig = sdk.SpeechConfig.fromSubscription(speechKey, speechRegion);
                speechConfig.speechSynthesisVoiceName = getAzureVoice(selectedLanguage);
                // Instead of playing directly, we use a push stream to capture audio data.
                const pushStream = sdk.AudioOutputStream.createPullStream();
                const audioConfig = sdk.AudioConfig.fromStreamOutput(pushStream);
                const synthesizer = new sdk.SpeechSynthesizer(speechConfig, audioConfig);
                synthesizer.speakTextAsync(
                    text,
                    (result) => {
                        if (result.reason === sdk.ResultReason.SynthesizingAudioCompleted) {
                            // result.audioData is a Uint8Array containing the WAV audio.
                            const audioData = result.audioData;
                            // Create a Blob from the audio data.
                            const blob = new Blob([audioData], { type: "audio/wav" });
                            const audioUrl = URL.createObjectURL(blob);
                            synthesizer.close();
                            resolve(audioUrl);
                        } else {
                            synthesizer.close();
                            reject(new Error(result.errorDetails || "Synthesis error"));
                        }
                    },
                    (error) => {
                        synthesizer.close();
                        reject(error);
                    }
                );
            } catch (error) {
                reject(error);
            }
        });
    };

    // Play Chatbot Response
    // Using Azure Speech Services that enables text-to-speech
    // Implementations: Play changes the button to pause. Clicking pause stops playback. Clicking a new message stops any current audio. When audio ends, button resets.
    const playChatbotResponse = async (chatbotResponse: string, messageId: string) => {
        if (!chatbotResponse || !speechKey || !speechRegion) return;
        // If this message is already playing, then pause/stop it.
        if (currentPlayingMessageIdRef.current === messageId) {
            if (audioRef.current) {
                audioRef.current.pause();
                audioRef.current.currentTime = 0; // reset playback
                console.log("🛑 Stoping audio.")
            }
            currentPlayingMessageIdRef.current = null;
            setPlayingMessageId(null);
            return;
        }
        // If another message is playing, stop it immediately.
        if (currentPlayingMessageIdRef.current && audioRef.current) {
            audioRef.current.pause();
            audioRef.current.currentTime = 0;
            currentPlayingMessageIdRef.current = null;
            setPlayingMessageId(null);
            console.log("🛑 Stoping message to change audios.")
            console.log("🔄 Switching")
        }
        // Mark this message as currently playing.
        currentPlayingMessageIdRef.current = messageId;
        setPlayingMessageId(messageId);
        console.log("🔊 Audio playing.")
        try {
            // Get the audio URL from Azure Speech Services.
            const audioUrl = await synthesizeTextToAudio(chatbotResponse);
            const audio = new Audio(audioUrl);
            audioRef.current = audio;
            // When audio ends, reset the playing state.
            audio.onended = () => {
                currentPlayingMessageIdRef.current = null;
                setPlayingMessageId(null);
                console.log("✅ Audio ended.")
            };
            // Start playback.
            await audio.play().catch((err) => {
                console.log("❌ Audio play error:", err);
                currentPlayingMessageIdRef.current = null;
                setPlayingMessageId(null);
            });
        } catch (error) {
            console.log("❌ Error synthesizing audio;", error) 
            currentPlayingMessageIdRef.current = null;
            setPlayingMessageId(null);
        }
    };

    //Seleção de ficheiros
    const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
        const files = event.target.files;
        if (files) {
            const fileArray = Array.from(files).filter(
                (file) => file.type !== "image/jpeg" && file.type !== "image/png"
            );
            setUploadedFiles((prevFiles) => [...prevFiles, ...fileArray]);
        }
    };

    //Seleção de imagens
    const handleImageSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
        const files = event.target.files;
        if (files) {
            const previews: string[] = [];
            const imageArray = Array.from(files).filter(
                (file) => file.type === "image/jpeg" || file.type === "image/png"
            );
            setUploadedImages((prevImages) => [...prevImages, ...imageArray]);
            // Generate unique previews
            imageArray.forEach((file) => {
                const reader = new FileReader();
                reader.onload = () => {
                    if (reader.result) {
                        previews.push(reader.result as string);
                        setImagePreviews((prevPreviews) => {
                            //Deduplication
                            const uniquePreviews = [...prevPreviews, ...previews].filter(
                                (preview, index, self) => self.indexOf(preview) === index
                            );
                            return uniquePreviews;
                        });
                    }
                };
                reader.readAsDataURL(file);
            });            
        }
    };

    //Remover ficheiros selecionados antes do envio
    const removeFile = (index: number) => {
        setUploadedFiles((prevFiles) =>
            prevFiles.filter((_, i) => i !== index)
        );
    };

    //Remover imagens selecionadas antes do envio
    const removeImage = (index: number) => {
        setUploadedImages((prevImages) => prevImages.filter((_, i) => i !== index));
        setImagePreviews((prevPreviews) => prevPreviews.filter((_, i) => i !== index));
    };

    const triggerFileInput = () => fileInputRef.current?.click();
    const triggerImageInput = () => imageInputRef.current?.click();

    // Extract text values from JSON
    const expiredText = languageData?.expiredText?.[selectedLanguage] || languageData?.expiredText?.['en-US'];
    const expiredSubText = languageData?.expiredSubText?.[selectedLanguage] || languageData?.expiredSubText?.['en-US'];
    const endedText = languageData?.endedText?.[selectedLanguage] || languageData?.endedText?.['en-US'];
    const endedSubText = languageData?.endedSubText?.[selectedLanguage] || languageData?.endedSubText?.['en-US'];
    const updateButton = languageData?.updateButton?.[selectedLanguage] || languageData?.updateButton?.['en-US'];
    const chatPlaceholder = languageData?.chatPlaceholder?.[selectedLanguage] || languageData?.chatPlaceholder?.['en-US'];
    const uploadFilesButton = languageData?.uploadFilesButton?.[selectedLanguage] || languageData?.uploadFilesButton?.['en-US'];
    const uploadImagesButton = languageData?.uploadImagesButton?.[selectedLanguage] || languageData?.uploadImagesButton?.['en-US'];
    const audioPlayButton = languageData?.audioPlayButton?.[selectedLanguage] || languageData?.audioPlayButton?.['en-US'];
    const audioPauseButton = languageData?.audioPauseButton?.[selectedLanguage] || languageData?.audioPauseButton?.['en-US'];
    const analysisTitle = languageData?.analysisTitle?.[selectedLanguage] || languageData?.analysisTitle?.['en-US'];    
    const loadingForm = languageData?.loadingForm?.[selectedLanguage] || languageData?.loadingForm?.['en-US'];
    const submitForm = languageData?.submitForm?.[selectedLanguage] || languageData?.submitForm?.['en-US'];
    const submitFormError = languageData?.submitFormError?.[selectedLanguage] || languageData?.submitFormError?.['en-US'];

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
                setFeedbackApi(data.feedbackApi || '');
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
                                            ? "bg-[var(--client-color)] dark:bg-[var(--client-color-dark)] text-white pt-4 text-xs md:text-sm"
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

                                    {/* Display sent images in chat area */}
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

                                    {/* Display sent files in chat area */}
                                    {message.files && message.files.length > 0 && (
                                        <div className="w-64 h-auto">
                                            {message.files.map((file: { name: string; size: number }, i: number) => (
                                                <div key={i} className="flex flex-row items-center bg-white dark:bg-neutral-800 p-2 m-4 rounded-md">
                                                    <FaFileAlt className="text-4xl text-neutral-600 dark:text-white flex-shrink-0" />
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
                                            {featuresStates.enableFeedback && (
                                                <div>
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
                        {isConfigLoaded && (!formTemplate?.fields || formTemplate.fields?.length === 0) && (
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
                                            {/* Selected files */}
                                            {uploadedFiles.map((file, index) => (
                                                <div
                                                    key={index}
                                                    className="relative flex items-center justify-between h-24 w-56 md:h-28 md:w-60 p-2 mb-2"
                                                >
                                                    <div className="flex flex-row items-center gap-2 h-full w-full p-2 rounded-xl text-white bg-white dark:bg-neutral-800">
                                                        <FaFileAlt className="text-4xl md:text-5xl text-neutral-600 dark:text-white flex-shrink-0" />
                                                        <div className="flex flex-col w-full text-left overflow-hidden">
                                                            <span className="text-sm font-bold text-black dark:text-white truncate w-full">{file.name}</span>
                                                            <span className="text-xs text-neutral-800 dark:text-neutral-300">{file.size} bytes</span>
                                                        </div>
                                                    </div>
                                                    {/* Remove File button */}
                                                    <button
                                                        onClick={() => removeFile(index)}
                                                        className="absolute top-0 right-0 text-xl text-red-900 hover:text-red-950 bg-red-200 dark:bg-white rounded-full border-4 border-neutral-100 dark:border-neutral-700 mt-0 mr-0"
                                                    >
                                                        <FiX />
                                                    </button>
                                                </div>
                                            ))}
                                            {/* Selected images */}
                                            {imagePreviews.map((image, index) => (
                                                <div
                                                    key={index}
                                                    className="relative flex items-center justify-between h-24 w-24 md:h-28 md:w-28 p-2 mb-2 flex-shrink-0"
                                                >
                                                    <img
                                                        src={image}
                                                        alt={`Uploaded ${index}`}
                                                        className="h-full w-full object-cover rounded-xl flex-shrink-0"
                                                    />
                                                    {/* Remove Image button */}
                                                    <button
                                                        onClick={() => removeImage(index)}
                                                        className="absolute top-0 right-0 text-xl text-red-900 hover:text-red-950 bg-red-200 dark:bg-white rounded-full border-4 border-neutral-100 dark:border-neutral-700 mt-0 mr-0"
                                                    >
                                                        <FiX />
                                                    </button>
                                                </div>
                                            ))}
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
                                        <div className="flex flex-row items-center justify-between p-1">
                                            <div className="m-0">
                                                {/* File input and button */}
                                                <input type='file'
                                                    ref={fileInputRef}
                                                    onChange={handleFileSelect}
                                                    multiple
                                                    className='hidden'
                                                    accept='.pdf,.doc,.docx' />
                                                {featuresStates.enableFiles && (
                                                    <button 
                                                        title={uploadFilesButton}
                                                        className={`rounded-full w-8 h-8 text-black dark:text-white hover:bg-neutral-300 dark:hover:bg-neutral-500`}
                                                        onClick={triggerFileInput}>
                                                        <FiFile className='w-8 h-5' />
                                                    </button>
                                                )}
                                                {/* Image input and button */}
                                                <input type='file'
                                                    ref={imageInputRef}
                                                    onChange={handleImageSelect}
                                                    multiple
                                                    className='hidden'
                                                    accept='.jpg,.jpeg,.png' />
                                                {featuresStates.enableImages && (
                                                    <button
                                                        title={uploadImagesButton}
                                                        className='rounded-full w-8 h-8 text-black dark:text-white hover:bg-neutral-300 dark:hover:bg-neutral-500'
                                                        onClick={triggerImageInput}>
                                                        <FiImage className='w-8 h-5 text-2xl' />
                                                    </button>
                                                )}
                                            </div>
                                            <div className='flex felx-row gap-2 mb-1 mr-0'>
                                                {/* Audio Processing Component */}
                                                <AudioProcessing
                                                    inputText={inputText} setInputText={setInputText}
                                                    setPlayingMessageId={setPlayingMessageId}
                                                    darkMode={darkMode}
                                                    selectedLanguage={selectedLanguage}
                                                />
                                                {/* Send button */}
                                                <button 
                                                    className="rounded-full w-7 h-7 md:w-8 md:h-8 bg-black dark:bg-white text-white dark:text-black hover:bg-neutral-700 dark:hover:bg-neutral-300"
                                                    onClick={handleSend}>
                                                    <FiSend className='w-6 h-4 md:w-7 md:h-5 rotate-45 m-0 rounded-full'/>
                                                </button>
                                            </div>
                                        </div>
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
                                        <div className="flex flex-row items-center justify-between mt-[6px] p-1">
                                            <div className="m-0">
                                                {/* File button */}
                                                {featuresStates.enableFiles && (
                                                    <button 
                                                        className={`rounded-full w-8 h-8 text-black dark:text-white
                                                            ${!inputEnable ? 'cursor-not-allowed' : ''}
                                                        `}
                                                        onClick={inputEnable ? triggerFileInput : undefined}
                                                        disabled={!inputEnable}
                                                    >
                                                        <FiFile className='w-8 h-5 text-2xl' />
                                                    </button>
                                                )}
                                                {/* Image button */}
                                                {featuresStates.enableImages && (
                                                    <button 
                                                        className={`rounded-full w-8 h-8 text-black dark:text-white
                                                            ${!inputEnable ? 'cursor-not-allowed' : ''}
                                                        `}
                                                        onClick={inputEnable ? triggerFileInput : undefined}
                                                        disabled={!inputEnable}
                                                    >
                                                        <FiImage className='w-8 h-5 text-2xl' />
                                                    </button>
                                                )}
                                            </div>
                                            <div>
                                                {/* Send button */}
                                                <button 
                                                    className={`rounded-full w-7 h-7 md:w-8 md:h-8 mr-0 bg-black dark:bg-white text-white dark:text-black hover:bg-neutral-700 dark:hover:bg-neutral-300 
                                                        ${!inputEnable ? 'cursor-not-allowed' : ''}
                                                    `}
                                                    onClick={inputEnable ? triggerFileInput : undefined}
                                                    disabled={!inputEnable}
                                                >
                                                    <FiSlash className='flex items-center justify-center w-5 md:w-6 mx-auto text-lg'/>
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Template Form Area */}
                        {formTemplate?.fields && formTemplate.fields.length > 0 && inputEnable && (
                            <div className="relative w-full flex">
                                <div className="relative w-full h-auto text-sm md:text-base p-2 resize-none overflow-auto bg-neutral-100 dark:bg-neutral-700 dark:text-white">
                                    <div className="w-full max-h-80 text-sm md:text-base bg-transparent border-none focus:outline-none focus:border-none resize-none overflow-auto p-2
                                                scroll-smooth
                                                [&::-webkit-scrollbar]:w-2
                                                [&::-webkit-scrollbar-track]:rounded-full
                                                [&::-webkit-scrollbar-track]:bg-[#d0d0d0]/20
                                                dark:[&::-webkit-scrollbar-track]:bg-[#414141]/20
                                                [&::-webkit-scrollbar-thumb]:rounded-full
                                                [&::-webkit-scrollbar-thumb]:bg-[#d0d0d0]
                                                dark:[&::-webkit-scrollbar-thumb]:bg-[#414141]
                                                [&::-webkit-scrollbar-thumb]:hover:bg-[#acabab]
                                                dark:[&::-webkit-scrollbar-thumb]:hover:bg-[#2a2a2a]">
                                        <form className="space-y-4 p-4 bg-transparent max-w-4xl mx-auto">
                                            <h2 className="text-lg font-bold mb-4">{formTemplate.title}</h2>
                                            {/* MAIN FIELDS AND NESTED GROUPS */}
                                            <div className="grid grid-cols-2 gap-4">
                                                {formTemplate?.fields?.map((field, index) =>
                                                    'fields' in field ? (
                                                        // NESTED GROUP: full width header + subfields in one row
                                                        <div key={index} className="col-span-2 space-y-4">
                                                            <h3 className="font-semibold text-base">{field.title}</h3>
                                                            {/* Subfields in one row, spaced evenly */}
                                                            <div className="grid grid-cols-[repeat(auto-fit,minmax(150px,1fr))] gap-4">
                                                                {field.fields.map((subField, subIndex) => (
                                                                    <div key={subIndex} className="flex flex-col">
                                                                        <label htmlFor={subField.name} className="mb-1 font-medium">
                                                                            {subField.label}
                                                                        </label>
                                                                        {subField.type === 'textarea' ? (
                                                                            <textarea
                                                                                required
                                                                                id={subField.name}
                                                                                name={subField.name}
                                                                                placeholder={subField.placeholder}
                                                                                className="p-2 text-sm bg-white dark:bg-neutral-800 text-black dark:text-white border rounded"
                                                                                onChange={handleFormChange}
                                                                                value={formValues[subField.name] || ""}
                                                                            />
                                                                        ) : subField.type === 'select' ? (
                                                                            <select
                                                                                id={subField.name}
                                                                                name={subField.name}
                                                                                className="p-2 text-sm bg-white dark:bg-neutral-800 text-black dark:text-white border rounded"
                                                                                onChange={handleFormChange}
                                                                                value={formValues[subField.name] || ''}
                                                                            >
                                                                                <option value="">Select an option</option>
                                                                                {subField.options?.map((opt) => (
                                                                                    <option key={opt.value} value={opt.value}>
                                                                                        {opt.label}
                                                                                    </option>
                                                                                ))}
                                                                            </select>
                                                                        ) : subField.type === 'multiselect' ? (
                                                                            <div id={subField.name} className="flex flex-col gap-2">
                                                                                {subField.options?.map((opt) => (
                                                                                    <label key={opt.value} className="inline-flex items-center gap-2 text-sm text-black dark:text-white">
                                                                                        <input
                                                                                            type="checkbox"
                                                                                            name={subField.name}
                                                                                            value={opt.value}
                                                                                            checked={
                                                                                                Array.isArray(formValues[subField.name]) &&
                                                                                                (formValues[subField.name] as string[]).includes(opt.value)
                                                                                            }
                                                                                            onChange={(e) => {
                                                                                                const isChecked = e.target.checked;
                                                                                                setFormValues((prev) => {
                                                                                                    const current = Array.isArray(prev[subField.name]) ? (prev[subField.name] as string[]) : [];
                                                                                                    const updated = isChecked
                                                                                                        ? [...current, opt.value]
                                                                                                        : current.filter((val: string) => val !== opt.value);
                                                                                                    return {
                                                                                                        ...prev,
                                                                                                        [subField.name]: updated,
                                                                                                    };
                                                                                                });
                                                                                            }}
                                                                                            className="p-2 border rounded bg-white dark:bg-neutral-800"
                                                                                        />
                                                                                        {opt.label}
                                                                                    </label>
                                                                                ))}
                                                                            </div>
                                                                        ) : (
                                                                            <input
                                                                                required
                                                                                id={subField.name}
                                                                                type={subField.type}
                                                                                name={subField.name}
                                                                                placeholder={subField.placeholder}
                                                                                className="p-2 text-sm bg-white dark:bg-neutral-800 text-black dark:text-white border rounded"
                                                                                onChange={handleFormChange}
                                                                                value={formValues[subField.name] || ""}
                                                                            />
                                                                        )}
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        // SINGLE FIELD, each takes half the width of grid cols-2
                                                        <div key={index} className="flex flex-col">
                                                            <label htmlFor={field.name} className="mb-1 font-medium">
                                                                {field.label}
                                                            </label>
                                                            {/* Same input types as above */}
                                                            {field.type === 'textarea' ? (
                                                                <textarea
                                                                    required
                                                                    id={field.name}
                                                                    name={field.name}
                                                                    placeholder={field.placeholder}
                                                                    className="p-2 text-sm bg-white dark:bg-neutral-800 text-black dark:text-white border rounded"
                                                                    onChange={handleFormChange}
                                                                    value={formValues[field.name] || ""}
                                                                />
                                                            ) : field.type === 'select' ? (
                                                                <select
                                                                    id={field.name}
                                                                    name={field.name}
                                                                    className="p-2 text-sm bg-white dark:bg-neutral-800 text-black dark:text-white border rounded"
                                                                    onChange={handleFormChange}
                                                                    value={formValues[field.name] || ""}
                                                                >
                                                                    <option value="">Select an option</option>
                                                                    {field.options?.map(opt => (
                                                                        <option key={opt.value} value={opt.value}>
                                                                            {opt.label}
                                                                        </option>
                                                                    ))}
                                                                </select>
                                                            ) : field.type === 'multiselect' ? (
                                                                <div id={field.name} className="flex flex-col gap-2">
                                                                    {field.options?.map((opt) => (
                                                                        <label key={opt.value} className="inline-flex items-center gap-2 text-sm text-black dark:text-white">
                                                                            <input
                                                                                type="checkbox"
                                                                                name={field.name}
                                                                                value={opt.value}
                                                                                checked={Array.isArray(formValues[field.name]) && (formValues[field.name] as string[]).includes(opt.value)}
                                                                                onChange={(e) => {
                                                                                    const isChecked = e.target.checked;
                                                                                    setFormValues((prev) => {
                                                                                        const current = Array.isArray(prev[field.name])
                                                                                            ? (prev[field.name] as string[])
                                                                                            : [];
                                                                                        const updated = isChecked
                                                                                            ? [...current, opt.value]
                                                                                            : current.filter((val: string) => val !== opt.value);
                                                                                        return {
                                                                                            ...prev,
                                                                                            [field.name]: updated,
                                                                                        };
                                                                                    });
                                                                                }}
                                                                                className="p-2 border rounded bg-white dark:bg-neutral-800"
                                                                            />
                                                                            {opt.label}
                                                                        </label>
                                                                    ))}
                                                                </div>
                                                            ) : (
                                                                <input
                                                                    required
                                                                    id={field.name}
                                                                    type={field.type}
                                                                    name={field.name}
                                                                    placeholder={field.placeholder}
                                                                    className="p-2 text-sm bg-white dark:bg-neutral-800 text-black dark:text-white border rounded"
                                                                    onChange={handleFormChange}
                                                                    value={formValues[field.name] || ""}
                                                                />
                                                            )}
                                                        </div>
                                                    )
                                                )}
                                            </div>
                                            {/* ERROR MESSAGE + BUTTON - NOT AFFECTED BY GRID */}
                                            <div className="flex flex-col items-center justify-center pt-4 space-y-2">
                                                {formError && (
                                                    <p className="text-base text-red-700 dark:text-red-500 font-serif">
                                                        ❌ {submitFormError}
                                                    </p>
                                                )}
                                                <button
                                                    type="submit"
                                                    onClick={handleFormSubmit}
                                                    className="px-4 py-2 text-sm bg-black dark:bg-white text-white dark:text-black rounded-full hover:bg-neutral-800 dark:hover:bg-neutral-100"
                                                >
                                                    {submitForm}
                                                </button>
                                            </div>
                                        </form>
                                    </div>
                                </div>
                            </div>
                        )}
                        {formTemplate?.fields && formTemplate.fields.length > 0 && !inputEnable && (
                            <div className="flex flex-col items-center justify-center py-4">
                                <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-b-2 border-gray-500 dark:border-gray-400 mr-2"></div>
                                <span className="w-full p-4 text-center italic text-gray-500 dark:text-gray-400">{loadingForm}</span>
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

            {/* Sidebar */}
            {isChatSidebarOpen && (
                <div className="md:w-1/2 md:h-full w-full h-1/2 bg-white dark:bg-neutral-800 border-t md:border-l shadow-lg p-4 flex flex-col">
                    <div className="flex flex-row justify-between items-center w-full">
                        <h2 className="flex flex-row items-center md:text-lg text-base font-bold text-neutral-800 dark:text-white p-0">
                            <FiSidebar className="mr-2" /> {analysisTitle}
                        </h2>
                        <button onClick={closeSidebar} className="self-end text-neutral-600 dark:text-neutral-300 text-2xl">
                            <FiX />
                        </button>
                    </div>
                    {answer && (
                        <div className="mt-4 flex-1 w-full overflow-auto">
                            <AnalysisComponent 
                                answer={answer} 
                                selectedLanguage={selectedLanguage}
                            />
                        </div>
                    )}
                </div>
            )}
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