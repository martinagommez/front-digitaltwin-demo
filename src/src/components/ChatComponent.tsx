import { useState, useEffect, useRef } from 'react';
import { PluginMeta, PluginRequest } from '../models/requests/PluginApi';
import { FaFileAlt } from "react-icons/fa";
import { FiImage, FiFile, FiX, FiSend, FiSlash, FiChevronDown, FiChevronUp } from "react-icons/fi";
import Modal from 'react-modal';
import axios from 'axios';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkBreaks from 'remark-breaks';
import { useLanguageContext } from './LanguageContext';
import './styles.css';

interface Message {
    text: string;
    language: string;
    files: File[];
    images: string[];
    sender: 'user' | 'bot' | 'websocket';
    agent?: string;
}

interface ChatComponentProps {
    inputEnable: boolean;
    setInputEnable: React.Dispatch<React.SetStateAction<boolean>>;
    activedPlugin: PluginMeta | null;
    setActivedPlugin: React.Dispatch<React.SetStateAction<PluginMeta | null>>;
    selectedLanguage: string;
}

function ChatComponent({ inputEnable, setInputEnable, activedPlugin, setActivedPlugin, selectedLanguage }: ChatComponentProps) {
    const [inputText, setInputText] = useState<string>('');
    const [messages, setMessages] = useState<Message[]>([]);
    const [isUserAtBottom, setIsUserAtBottom] = useState<boolean>(true);
    const [socket, setSocket] = useState<WebSocket | null>(null);
    const [showWebSockets, setShowWebSockets] = useState<boolean>(true);
    const [connected, setConnected] = useState<boolean>(false);
    const [isLoading, setIsLoading] = useState<boolean>(false);
    // const [pluginRequestData, setPluginRequest] = useState<PluginRequest | null>(null);
    // const [activedPlugin, setActivedPlugin] = useState<PluginMeta | null>(null);
    const [sessionId, setSessionId] = useState<string>('');
    const [token, setToken] = useState<string>('');
    // const [setupApi, setSetupApi] = useState<string>('');
    const [isSessionExpired, setIsSessionExpired] = useState<boolean>(false);
    const [isEndChat, setIsEndChat] = useState<boolean>(false);
    const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
    const [uploadedImages, setUploadedImages] = useState<File[]>([]);
    const [imagePreviews, setImagePreviews] = useState<string[]>([]);
    const [isConfigLoaded, setIsConfigLoaded] = useState<boolean>(false); // Track config load state
    const fileInputRef = useRef<HTMLInputElement>(null);
    const imageInputRef = useRef<HTMLInputElement>(null);
    const messagesEndRef = useRef<HTMLDivElement | null>(null);
    const chatContainerRef = useRef<HTMLDivElement>(null);

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

    const isTypingRef = useRef(false);

    // Retorna mensagem do bot (primeira mensagem e respostas)
    const fetchMessage = async (formData: FormData) => {
        if (!activedPlugin || isTypingRef.current) return;
        isTypingRef.current = false;
        setInputEnable(false);
        setIsLoading(true);
        console.log("COMECEI O FETCH MESSAGE")
        const currTime = new Date().toLocaleTimeString();
        console.log(currTime)
        try {
            const url = activedPlugin.PluginHost.startsWith('https')
                ? activedPlugin.PluginHost
                : `https://${activedPlugin.PluginHost}`;
            // console.log("Payload being sent to backend:", formData);
            // for (const pair of formData.entries()) {
            //     console.log(pair[0], pair[1]);
            // }
            const response = await axios.post(url + "/message", formData, {
                headers: {
                    "Content-Type": "multipart/form-data",
                    'Access-Control-Allow-Origin': 'https://us-app-orch-us-1.azurewebsites.net/message'
                }, timeout: 10000000
            });
            console.log("Response from backend:", response.data);
            const apiResponse = response.data.response;
            setSessionId(response.data.session_id);
            setToken(response.data.token);
            // let currentMessage = '';
            // let index = 0;
    
    // ================================ ALTERNATIVE TO TYING METHOD ============================================
            const displayMessage = () => {
                console.log("Entered the display message")
                setMessages(prevMessages => [
                    ...prevMessages,
                    { text: apiResponse, language: selectedLanguage, files: [], images: [], sender: 'bot' },
                ]);
                setInputEnable(true);  // Re-enable input once the message is displayed.
                setIsLoading(false);

                // If the response indicates the end of the chat, set the end of chat state.
                if (response.data.end_chat === "END_CHAT") {
                    setIsEndChat(true);
                    return;
                }
            
                isTypingRef.current = false;  // Mark the typing effect as finished (if used elsewhere).
            
                // No need to resolve a promise here as we're no longer using a promise for typing effect.
            };
            
            // Immediately update the message and show it.
            // setMessages(prevMessages => [
            //     ...prevMessages,
            //     { text: '', language: selectedLanguage, files: [], images: [], sender: 'bot' },
            // ]);
            
            setInputEnable(false);  // Disable input while the message is being processed.
            displayMessage();  // Call to display the message without typing effect.

    // ================================ ALTERNATIVE TO TYING METHOD ============================================ //
    
            
    // ~================================================ ADDS TYPING TO THE RESPONSES. ~================================================
            // await new Promise<void>(resolve => {
            //     const typingEffect = () => {
            //         setIsLoading(false);
            //         setInputEnable(false);
            //         if (index < apiResponse.length) {
            //             currentMessage += apiResponse[index];
            //             setMessages(prevMessages => [
            //                 ...prevMessages.slice(0, -1),
            //                 { text: currentMessage, language: selectedLanguage, files: [], images: [], sender: 'bot' },
            //             ]);
            //             index++;
            //             setTimeout(typingEffect, 1);
            //             console.log("ESTOU NO TYPING EFFECT")
            //         } else {
            //             setInputEnable(true);
            //             if (response.data.end_chat === "END_CHAT") {
            //                 setIsEndChat(true);
            //                 return;
            //             }
            //             isTypingRef.current = false;
            //             console.log("ACABEI O TYPING EFFECT");
            //             resolve(); // This will resolve the promise when the typing effect is complete.
            //         }
            //     };
            //     // Append an empty message and start the typing effect.
            //     setMessages(prevMessages => [
            //         ...prevMessages,
            //         { text: '', language:selectedLanguage, files: [], images: [], sender: 'bot' },
            //     ]);
            //     setInputEnable(false);
            //     typingEffect();
            // });

    // ~================================================ ADDS TYPING TO THE RESPONSES. ~================================================

            // console.log("SAI DO TYPING EFFECT");
            if (response.data.authentication === "AUTHENTICATION_FAILED") {
                setIsSessionExpired(true);
                return;
            }
            if (response.data.session === "SESSION_EXPIRED") {
                setIsSessionExpired(true);
                return;
            }
            console.log("ACABEI O FETCH MESSAGE");
            const currTime = new Date().toLocaleTimeString();
            console.log(currTime)
            
        } catch (error) {
            const currTime = new Date().toLocaleTimeString();
            console.log(currTime)
            console.error("Error on Fetching Message:", error);
            setIsLoading(false);
        }
    };

    // Envio da mensagem
    const handleSend = async () => {
        if (!inputText.trim()) return;
        const formData = new FormData();
        formData.append("user_input", inputText || "");
        formData.append("timestamp", getFormattedTimestamp());
        formData.append("session_id", sessionId);
        formData.append("token", token);
        formData.append("language", selectedLanguage);
        console.log("the language being sent is : ",selectedLanguage)
        formData.append("body","")
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
            { text: inputText, language:selectedLanguage ,files: uploadedFiles, images: imagePreviews, sender: "user" },
        ]);
        console.log(formData)
        setInputText("");
        setUploadedFiles([]);
        setUploadedImages([]);
        setImagePreviews([]);
        setInputEnable(false);
        await fetchMessage(formData);
        console.log("Handle Send",formData);
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

    // Get language data and selected language from context
    const { languageData } = useLanguageContext();
    // localStorage.setItem('language', 'en');
    
    // Extract text values from JSON
    const expiredText = languageData?.expiredText?.[selectedLanguage] || "Session Expired";
    const expiredSubText = languageData?.expiredSubText?.[selectedLanguage] || "Update to begin new chat.";
    const endedText = languageData?.endedText?.[selectedLanguage] || "Session Ended";
    const endedSubText = languageData?.endedSubText?.[selectedLanguage] || "Update to begin new chat.";
    const updateButton = languageData?.updateButton?.[selectedLanguage] || "Update";
    const chatPlaceholder = languageData?.chatPlaceholder?.[selectedLanguage] || "Write your message...";


    //  Valores defualt para as features configuráveis pelo json
	const [featuresStates, setFeaturesStates] = useState({
		enableFiles: true,
        enableImages: true,
        enableExpiredNotification: false,
        enableExpiredPopup: true,
        enableEndedNotification: true,
        enableEndedPopup: false,
        displayAgents: true,
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
					});
				}
                // setSetupApi(data.setupApi || '');
                console.log('Language Data:', data);
			} catch (error) {
				console.error('Error fetching button states:', error);
			} finally {
				setIsConfigLoaded(true); // Mark as loaded
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

    const hasFetchedMessage = useRef(false);

    // Plugin ativo: append da mensagem ao formData e fetchMessage com esse formData
    useEffect(() => {
        if (activedPlugin && !hasFetchedMessage.current) {
            hasFetchedMessage.current = true;
            const formData = new FormData();
            formData.append("user_input", ""); // Empty text
            formData.append("body","");
            formData.append("language",selectedLanguage)
            console.log("selected language is:",selectedLanguage)
            formData.append("timestamp", getFormattedTimestamp())
            fetchMessage(formData);
            console.log(activedPlugin);
            console.log("Actived Plugin do useEffect do chatbot", formData);
        }
    }, [activedPlugin]);



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

    // useEffect(() => {
    //     const ws = new WebSocket("ws://127.0.0.1:8000/ws");
    //     ws.onopen = () => {
    //         console.log("Connected to WebSocket");
    //         setConnected(true);
    //     };
    //     ws.onmessage = (event) => {
    //         console.log("Message received:", event.data);
    //         setMessages((prevMessages) => [...prevMessages, event.data]);
    //     };
    //     ws.onclose = () => {
    //         console.log("WebSocket closed");
    //         setConnected(false);
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

    // IT IS HERE OMG - FIXED THE ISSUE 07/03/2025
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
    //                 files: [],
    //                 images: [],
    //             };
    //             setMessages((prev) => [...prev, simulatedMessage]);
    //             counter++;
    //         }
    //     }, 2000); // Simulates a message every 2 seconds
    //     return () => clearInterval(fakeWebSocket);
    // }, []);
    

    return (
        <div className="flex flex-col h-full bg-white dark:bg-neutral-800 rounded-lg">
            {/* Scroll-bar do chat */}
            <div 
                ref={chatContainerRef}
                className="flex-1 p-6 overflow-y-auto overflow-x-auto h-0 scroll-smooth
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
                {/* Display dos plugins */}
                {/* {messages.length === 0 && activedPlugin === null && (pluginRequestData?.NumberOfPlugins ?? 0) > 1 && pluginRequestData?.PluginList.map((plugin, index) => {
                    return (
                        <div key={index} className="flex flex-row justify-center items-center">
                            <button onClick={() => {setActivedPlugin(plugin); setInputEnable(true)}} className="border border-[var(--client-color)] text-[var(--client-color)] dark:border-[var(--client-color-dark)] dark:text-[var(--client-color-dark)] rounded-lg p-4 text-lg text-center mb-4 mx-auto w-1/2">
                                {plugin.PluginTitle}
                            </button>
                        </div>
                    )
                })} */}
                {/* WebSocket Messages Container */}
                {featuresStates.displayAgents && (
                    <div className="relative mb-4 w-full max-w-[725px] p-4 rounded-3xl bg-neutral-100 dark:bg-neutral-900 text-black dark:text-white">
                        {/* Connection Status */}
                        <p className="absolute top-4 left-4 text-sm pointer-events-none">
                            {connected ? "Connected ✅" : "Disconnected ❌"}
                        </p>

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
                            <div className="relative text-right text-sm pr-8 text-black dark:text-white">
                                Show Websockets
                            </div>
                        )}
                    </div>
                )}

                {/* Display non-websocket messages */}
                {messages.map((message, index) =>
                    message.sender !== "websocket" ? (
                        <div key={index} className={`mb-4 ${message.sender === 'user' ? 'text-right' : 'text-left'}`}>
                            <div
                                className={`inline-block pt-4 pr-4 pl-4 pb-2 rounded-3xl ${
                                    message.sender === "user"
                                        ? "bg-[var(--client-color)] dark:bg-[var(--client-color-dark)] text-white"
                                        : "bg-neutral-200 text-black dark:bg-neutral-900 dark:text-white"
                                }`}
                            >
                                <div className="markdown">
                                    <ReactMarkdown remarkPlugins={[remarkGfm, remarkBreaks]}>
                                        {message.text}
                                    </ReactMarkdown>
                                </div>

                                {/* Display sent images in chat area */}
                                {message.images && message.images.length > 0 && (
                                    <div>
                                        {message.images.map((image, i: number) => (
                                            <img
                                                key={i}
                                                src={image}
                                                alt={`Uploaded Image ${i}`}
                                                className="w-36 h-auto bg-white dark:bg-neutral-800 p-2 m-4 rounded-md"
                                            />
                                        ))}
                                    </div>
                                )}

                                {/* Display sent files in chat area */}
                                {message.files && message.files.length > 0 && (
                                    <div className="w-auto">
                                        {message.files.map((file: { name: string; size: number }, i: number) => (
                                            <div key={i} className="flex items-center space-x-2 w-auto bg-white dark:bg-neutral-800 p-2 m-4 rounded-md">
                                                <span className="text-sm text-black dark:text-white">{file.name}</span>
                                                <span className="text-xs text-neutral-800 dark:text-neutral-300">{file.size} bytes</span>
                                            </div>
                                        ))}
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
                                <div className="animate-pulse h-4 w-4 bg-neutral-300 rounded-full mr-2"></div>
                                <div className="animate-pulse h-4 w-4 bg-neutral-300 rounded-full mr-2"></div>
                                <div className="animate-pulse h-4 w-4 bg-neutral-300 rounded-full"></div>
                            </div>
                        </div>
                    </div>
                )}
                <div ref={messagesEndRef} />
            </div>
            <div className="p-4 h-auto bg-white dark:bg-neutral-800 rounded-lg">
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
                        <div className="relative flex">
                            {inputEnable ?
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
                                            dark:[&::-webkit-scrollbar-thumb]:hover:bg-neutral-900">
                                        {uploadedFiles.map((file, index) => (
                                            <div
                                                key={index}
                                                className="relative flex items-center justify-between h-28 w-60 p-2 mb-2"
                                            >
                                                <div className="flex flex-row items-center gap-2 h-full w-full p-2 rounded-xl text-white bg-white dark:bg-neutral-800">
                                                    <FaFileAlt className="text-6xl text-neutral-600 dark:text-white flex-shrink-0" />
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
                                        {imagePreviews.map((image, index) => (
                                            <div
                                                key={index}
                                                className="relative flex items-center justify-between h-28 w-28 p-2 mb-2 flex-shrink-0"
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
                                        onInput={(e) => {
                                            const target = e.target as HTMLTextAreaElement; // Explicitly cast to HTMLTextAreaElement
                                            target.style.height = "auto"; // Reset height to calculate new size
                                            target.style.height = `${target.scrollHeight}px`; // Adjust height based on content
                                        }}
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
                                                <button className={`rounded-full w-8 h-8 text-black dark:text-white hover:bg-neutral-300 dark:hover:bg-neutral-500`}
                                                    onClick={triggerFileInput}>
                                                    <FiFile className='w-8 h-5 text-2xl' />
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
                                                <button className='rounded-full w-8 h-8 text-black dark:text-white hover:bg-neutral-300 dark:hover:bg-neutral-500'
                                                    onClick={triggerImageInput}>
                                                    <FiImage className='w-8 h-5 text-2xl' />
                                                </button>
                                            )}
                                            
                                        </div>
                                        <div>
                                            {/* Send button */}
                                            <button className="rounded-full w-8 h-8 bg-black dark:bg-white text-white dark:text-black hover:bg-neutral-700 dark:hover:bg-neutral-300"
                                                onClick={handleSend}>
                                                    <FiSend className='w-7 h-5 rotate-45 m-0 rounded-full'/>
                                            </button>
                                        </div>
                                    </div>
                                </div>
                                :
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
                                                className={`rounded-full w-8 h-8 bg-black dark:bg-white text-white dark:text-black hover:bg-neutral-700 dark:hover:bg-neutral-300 
                                                    ${!inputEnable ? 'cursor-not-allowed' : ''}
                                                `}
                                                onClick={inputEnable ? triggerFileInput : undefined}
                                                disabled={!inputEnable}
                                            >
                                                <FiSlash className='w-6 mx-auto text-lg'/>
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            }
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
    );
}

export default ChatComponent;

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
