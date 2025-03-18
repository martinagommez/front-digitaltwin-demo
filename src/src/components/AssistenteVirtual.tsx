import { useState, useEffect, useRef } from 'react';
import { FaSun, FaMoon, FaLanguage } from 'react-icons/fa';
import { RiChatNewFill } from 'react-icons/ri';
import { PluginMeta, PluginRequest } from '../models/requests/PluginApi';
import axios from 'axios';
import { MdMenu } from 'react-icons/md';
import ChatComponent from './ChatComponent';
import FilesProcessing from './FilesProcessing';
import { fetchAndUpdateCSSVariables } from './cssUtils';

type Language = {
	code: string;
	label: string;
	flag: string;
}

function AssistenteVirtual() {
	const [inputEnable, setInputEnable] = useState<boolean>(true);
	const [pluginRequestData, setPluginRequest] = useState<PluginRequest | null>(null);
	const [activedPlugin, setActivedPlugin] = useState<PluginMeta | null>(null);
	const [setupApi, setSetupApi] = useState<string>('');
	const [darkMode, setDarkMode] = useState<boolean>(() => {
		const savedMode = localStorage.getItem('darkMode');
		return savedMode ? JSON.parse(savedMode).status : false;
	});
	const [showSidebar, setShowSidebar] = useState<boolean>(false); //Chat Component
	const [isSidebarOpen, setIsSidebarOpen] = useState(false); // FilesProcessing
	const [showLanguageDropdown, setShowLanguageDropdown] = useState<boolean>(false);
    const [language, setLanguage] = useState<string | null>(null); // No default language
    const [showLanguageSelection, setShowLanguageSelection] = useState<boolean>(true); // Start with language selection
	const [title, setTitle] = useState<string>('');
	const [tabText, setTabText] = useState<string>('');
	const [pluginsTitle, setPluginsTitle] = useState<string>('');
	const [logo, setLogo] = useState<string>('');
	const [availableLanguages, setAvailableLanguages] = useState<Language[]>([]); // Dynamic languages
	const [isConfigLoaded, setIsConfigLoaded] = useState<boolean>(false); // Track config load state
	const [buttonLabels, setButtonLabels] = useState({
		newChatButton: 'New Chat',
		lightModeButton: 'Light Mode',
		darkModeButton: 'Dark Mode',
		availableLanguagesTitle: 'Available Languages',
	});
	const [pluginType, setPluginType] = useState<string>('');
	const [featuresStates, setFeaturesStates] = useState({
		enableNewChat: true, // default values
		enableDarkMode: true,
		enableLanguages: true,
		pluginsTitleOption: true
	});
	const sidebarRef = useRef<HTMLDivElement>(null);
	const languageDropdownRef = useRef<HTMLDivElement>(null);

	// Reload da página para criar novo chat
	const createNewChat = async () => {
		if (inputEnable) {
			window.location.reload(); //Only allow reload if input is enabled
		}
	}

	// Switch entre dark mode e light mode
	const toggleDarkMode = () => {
		setDarkMode(prevMode => !prevMode);
	};

	// Display da sidebar
	const handleToggleSidebar = () => setShowSidebar(!showSidebar);

	// Atualizar linguagem selecionada nos botões (dropdown e sidebar)
	const handleLanguageChange = (lang: string) => {
		setLanguage((prevLanguage) => {
			if (lang !== prevLanguage) {
				localStorage.setItem('language', lang); // Save selected language to localStorage
				return lang; // Update language state
			}
			return prevLanguage; // No change if the same language is selected
		});
		setShowLanguageDropdown(false); // Close dropdown after selection
	};

	// Atualizar linguagem selecionada na seleção de línguas (pop-up inicial)
	const handleLanguageSelect = (lang: string) => {
		setLanguage(lang); // Set selected language
		localStorage.setItem('language', lang); // Save language to localStorage
		setShowLanguageSelection(false); // Hide language selection after choosing
	};

	// Fetch dos plugins
	const fetchPlugins = async () => {
		try {
			const response = await axios.get(setupApi, {
				headers: {
					mode: 'no-cors',
					'Content-Type': 'application/json',
					'Access-Control-Allow-Origin': '*',
				},
			});
			var plugins = response.data;
			console.log('Plugins', response);
			console.log(setupApi);
			setPluginRequest(response.data);
			if (plugins?.NumberOfPlugins === 1) {
				setActivedPlugin(plugins.PluginList[0]);
				setInputEnable(true);
				plugins.PluginList[0].PluginType = 'chatbot';
				setPluginType(plugins.PluginList[0].PluginType)
			};
		} catch (error) {
			console.error('Failed to fetch plugins:', error);
		}
	};

	// Fetch dos plugins
	useEffect(() => {
		if (!activedPlugin) {
			fetchPlugins();
		}
	}, [setupApi])

	// Update dos valores configuráveis no ficheiro json
	useEffect(() => {
		const updateAppConfig = async () => {
			try {
				const response = await fetch('/client.config.json');
				const data = await response.json();
				// Set general configuration
				if (data.enableFeatures) {
					setFeaturesStates({
						enableNewChat: data.enableFeatures.enableNewChat ?? true,
						enableDarkMode: data.enableFeatures.enableDarkMode ?? true,
						enableLanguages: data.enableFeatures.enableLanguages ?? true,
						pluginsTitleOption: data.enableFeatures.pluginsTitleOption ?? true,
					});
				}
				setSetupApi(data.setupApi || '');
				setInputEnable(data.inputEnable ?? true);
				setLogo(data.logo);
				if (data.languages) {
					setAvailableLanguages(data.languages);
				}
				// Handle browser language setting
				if (data.enableFeatures.preferenceLanguage && !data.enableFeatures.browserLanguage) {
					setShowLanguageSelection(false);
					setLanguage(data.preferedLanguage);
					console.log("ESTOU NO PREF", data.preferedLanguage)
				}
				else if (data.enableFeatures.browserLanguage && !data.enableFeatures.preferenceLanguage) {
					const browserLang = navigator.language.split('-')[0]; // Get browser language
					const matchedLanguage = data.languages?.find((lang: any) => lang.code === browserLang);
					console.log("Browser", browserLang)
					// Use browser language if match found
					if (matchedLanguage) {
						setLanguage(matchedLanguage.code);
						setShowLanguageSelection(false); // Skip language selection screen
					} else {
					  	setShowLanguageSelection(true); // Show language selection if no match found
					}
					console.log("ESTOU NO BROWSER", matchedLanguage.code)
				} else {
					const savedLanguage = localStorage.getItem('language');
					console.log("Saved", savedLanguage);
					if (savedLanguage) {
					  	setLanguage(savedLanguage); // Use saved language from localStorage
					} else {
					  	setShowLanguageSelection(true); // Show selection if no language is saved
					}
					console.log("ESTOU NO LOCAL", savedLanguage)
				}
			} catch (error) {
				console.error('Error fetching client configuration:', error);
			} finally {
				setIsConfigLoaded(true); // Mark configuration as loaded
			}
		};
		updateAppConfig();
	}, []);

	// Update dos valores configuráveis no ficheiro json
	useEffect(() => {
		const updatedAppConfig = async () => {
			try {
				const response = await fetch('/client.config.json');
				const data = await response.json();
				// Set the language-specific configuration
				if (language) {
					await fetchAndUpdateCSSVariables('/client.config.json', language);
					setTitle(data.title || 'Title');
					setTabText(data.tabText || 'Logo');
					setPluginsTitle(data.pluginsTitle || 'Plugins');
					setButtonLabels({
						newChatButton: data.newChatButton[language] || data.newChatButton['en'],
						darkModeButton: data.darkModeButton[language] || data.darkModeButton['en'],
						lightModeButton: data.lightModeButton[language] || data.lightModeButton['en'],
						availableLanguagesTitle: data.availableLanguagesTitle[language] || data.availableLanguagesTitle['en'],
					});
				}
				console.log("Selected", language);
			} catch (error) {
				console.error('Error fetching client configuration:', error);
			} finally {
				setIsConfigLoaded(true); // Mark configuration as loaded
			}
		};
		updatedAppConfig();
	}, [language]);

	// Alternar entre dark mode e light mode
	useEffect(() => {
		localStorage.setItem('darkMode', JSON.stringify({ status: darkMode }));
		if (darkMode) {
			document.documentElement.classList.add('dark');
			localStorage.setItem('theme','dark');
		} else {
			document.documentElement.classList.remove('dark');
			localStorage.setItem('theme','light');
		}
	}, [darkMode]);

	// Fechar sidebar quando há um click fora da área
	useEffect(() => {
		const handleClickOutside = (event: MouseEvent) => {
			if (sidebarRef.current && !sidebarRef.current.contains(event.target as Node)) {
				setShowSidebar(false);
			}
		};
		if (showSidebar) {
			document.addEventListener('mousedown', handleClickOutside);
		};
		return () => {
			document.removeEventListener('mousedown', handleClickOutside);
		};
	}, [showSidebar]);

	return (
		<div className="flex flex-col bg-neutral-100 dark:bg-neutral-950">
			{/* Header */}
			<header className="bg-white dark:bg-neutral-900 shadow-md p-4 h-20 md:h-24">
				<div className="flex items-center justify-between w-full gap-4">
					{/* Logo */}
					<div className="flex items-center min-w-0">
						<img 
							src={logo}
							alt={tabText}
							className="h-[var(--logo-mobile-width)] md:h-[var(--logo-width)] flex-shrink-0"
						/>
					</div>
					{/* Title */}
					<h1 className="absolute text-sm md:text-xl font-semibold text-[var(--client-color)] dark:text-[var(--client-color-dark)] text-center w-40 md:w-auto left-1/2 transform -translate-x-1/2">
						{title}
					</h1>
					{/* Render only after config is loaded */}
					{isConfigLoaded && (
						<div className="flex items-center gap-2 flex-shrink-0">
							<div className="hidden md:flex space-x-2">
								{/* Languages Button */}
								{featuresStates.enableLanguages && (
									<div className="relative group">
										<button
											className={`flex items-center justify-center w-10 h-10 dark:bg-[#414141] dark:hover:bg-[#2a2a2a] text-neutral-500 dark:text-neutral-200 rounded-lg shadow-md focus:outline-none
												${inputEnable ? 'bg-neutral-300 hover:bg-[#acabab]' : 'cursor-not-allowed bg-neutral-300 hover:bg-neutral-300 dark:hover:bg-[#414141]'}
												${(!inputEnable || showLanguageSelection) ? 'cursor-not-allowed bg-neutral-300 hover:bg-neutral-300 dark:hover:bg-[#414141]' : ''}
											`}
											onClick={() => {
												// Set a small delay to ensure dropdown shows correctly without flickering
												setTimeout(() => {
													setShowLanguageDropdown(prev => !prev);
												}, 150);
											}}
											disabled={!inputEnable || showLanguageSelection} // Disable when input is not enabled
										>
											<FaLanguage className="text-2xl" />
										</button>
									</div>
								)}
								{/* Language Buttons Dropdown */}
								{showLanguageDropdown && (
									<div
										className="z-50 absolute top-20 right-4 bg-white dark:bg-neutral-700 shadow-2xl rounded-lg p-2 flex flex-col space-y-2 overflow-auto max-h-96"
										ref={languageDropdownRef}
									>
										<div className='m-2 text-center dark:text-white'>
											{buttonLabels.availableLanguagesTitle}
										</div>
										{availableLanguages.map(({ code, label, flag }) => (
											<button
												key={code}
												className={`flex items-center w-full px-2 py-1 rounded-lg hover:bg-neutral-200 dark:hover:bg-neutral-600 
													${language === code ? 'bg-neutral-300 dark:bg-neutral-500' : 'bg-transparent'}
													rounded-full focus:outline-none`}
												onClick={() => handleLanguageChange(code)}
											>
												<img src={flag} alt={label} className="w-6 h-6 mr-2" />
												<span className="text-sm text-neutral-800 dark:text-white">{label}</span>
											</button>
										))}
									</div>
								)}
								{/* New Chat Button */}
								{featuresStates.enableNewChat && (
									<div className="relative group">
										<button
											className={`flex items-center justify-center w-10 h-10 dark:bg-[#414141] dark:hover:bg-[#2a2a2a] text-neutral-500 dark:text-neutral-200 rounded-lg shadow-md focus:outline-none
												${inputEnable ? 'bg-neutral-300 hover:bg-[#acabab]' : 'cursor-not-allowed hover:bg-neutral-300 dark:hover:bg-[#414141]'}
												${(!inputEnable || showLanguageSelection) ? 'cursor-not-allowed bg-neutral-300 hover:bg-neutral-300 dark:hover:bg-[#414141]' : 'bg-neutral-300 hover:bg-[#acabab]'}
											`}
											onClick={createNewChat}
											disabled={!inputEnable || showLanguageSelection} // Disable when input is not enabled
										>
											<RiChatNewFill className="text-2xl" />
										</button>
									</div>
								)}
								{/* Mode Toggle Button */}
								{featuresStates.enableDarkMode && (
									<div className="relative group">
										<button
											className="flex items-center justify-center w-10 h-10 bg-[#d0d0d0] dark:bg-[#414141] text-white rounded-full shadow-md hover:bg-[#acabab] dark:hover:bg-[#2a2a2a]"
											onClick={toggleDarkMode}
										>
											{darkMode ? (
												<FaSun className="text-yellow-500 w-5 h-5" />
											) : (
												<FaMoon className="text-neutral-500 w-5 h-5" />
											)}
										</button>
									</div>
								)}
							</div>
							{/* Sidebar Button */}
							{featuresStates.enableNewChat || featuresStates.enableDarkMode || featuresStates.enableLanguages ? (
								<button
									onClick={handleToggleSidebar}
									className={`md:hidden flex items-center justify-center w-10 h-10 bg-[#d0d0d0] dark:bg-[#414141] text-neutral-500 dark:text-neutral-200 
										${showLanguageSelection ? 'cursor-not-allowed opacity-50 pointer-events-none' : ''}
									rounded-lg shadow-md focus:outline-none`}
									disabled={showLanguageSelection}
								>
									<MdMenu className="text-2xl" />
								</button>
							) : null}
						</div>
					)}
				</div>
			</header>

			{/* Language Selection and Chat Box */}
			{isConfigLoaded && showLanguageSelection ? (
				<div className="flex-grow h-[calc(100vh-5rem)] md:h-[calc(100vh-6rem)] p-4 flex flex-col items-center justify-center border-2
					bg-neutral-100 dark:bg-neutral-900 border-neutral-400 dark:border-neutral-600">
					<h2 className="text-lg md:text-xl font-semibold text-neutral-900 dark:text-white">Welcome to our chat</h2>	
					<h2 className="text-lg md:text-xl font-semibold mb-8 text-neutral-900 dark:text-white">Choose your language to start</h2>
					<div className="flex flex-wrap items-center justify-center gap-4">
						{availableLanguages.map(({ code, label, flag }) => (
							<button
								key={code}
								onClick={() => handleLanguageSelect(code)}
								className={`flex items-center justify-center w-14 h-14 md:w-16 md:h-16 bg-white dark:bg-neutral-800 rounded-full shadow-lg hover:bg-neutral-300 dark:hover:bg-neutral-700`}
							>
								<img src={flag} alt={label} className="w-10 h-10 md:w-12 md:h-12" />
								<span className="sr-only">{label}</span>
							</button>
						))}
					</div>
				</div>
			) : (activedPlugin === null && (
				<div className="flex-grow h-[calc(100vh-5rem)] md:h-[calc(100vh-6rem)] p-4 flex flex-col items-center justify-center border-2
					bg-neutral-100 dark:bg-neutral-900 border-neutral-400 dark:border-neutral-600
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
					{featuresStates.pluginsTitleOption && (
						<h1 className="text-center mb-6 text-2xl font-bold text-neutral-800 dark:text-neutral-200">
							{pluginsTitle}
						</h1>
					)}
					{/* Display dos plugins */}
					{activedPlugin === null && (pluginRequestData?.NumberOfPlugins ?? 0) > 1 && (
						<div className="flex flex-col md:flex-row gap-4 justify-center items-center w-full">
							{pluginRequestData?.PluginList.map((plugin, index) => (
								<button
									key={index}
									onClick={() => {
										setActivedPlugin(plugin);
										setInputEnable(true);
										setPluginType(plugin.PluginType);
									}}
									className="border border-[var(--client-color)] text-[var(--client-color)] dark:border-[var(--client-color-dark)] dark:text-[var(--client-color-dark)] 
									rounded-lg p-4 text-sm md:text-lg text-center w-[calc(50%)] md:w-[calc(30%)] max-w-[300px] h-[70px] md:h-[100px] flex-shrink-0"
								>
									{plugin.PluginTitle}
								</button>
							))}
						</div>
					)}
				</div>
			))}

			{pluginType === 'files' && (	
				<div className={`flex-grow h-[calc(100vh-5rem)] md:h-[calc(100vh-6rem)] p-4 flex items-center justify-center 
					${!isSidebarOpen ? '' : 'w-full'}
					`}>
					<div className={`flex w-full h-full
						${isSidebarOpen ? 'justify-start' : 'justify-center'}
						`}>
						<div className={`bg-white dark:bg-neutral-800 shadow-lg text-center flex-grow top-0 overflow-hidden 
							${isSidebarOpen ? 'w-full' : 'max-w-4xl'}
							`}>
								<FilesProcessing 
									activedPlugin={activedPlugin} setActivedPlugin={setActivedPlugin} 
									isSidebarOpen={isSidebarOpen} setIsSidebarOpen={setIsSidebarOpen} 
									selectedLanguage={language || 'en'}
								/>
						</div>
					</div>
				</div>
			)}


			{pluginType === 'chatbot' && activedPlugin && (	
				<div className={`flex-grow h-[calc(100vh-5rem)] md:h-[calc(100vh-6rem)] p-4 flex items-center justify-center 
					${!showSidebar}
					`}>
					<div className={`flex w-full h-full 
						${showSidebar ? 'justify-start' : 'justify-center'}
						`}>
						<div className={`bg-white dark:bg-black shadow-lg w-full max-w-4xl text-center h-full flex flex-col
							${showSidebar ? 'w-[calc(100vw-12rem)]' : 'max-w-4xl w-full'}
							`}> 
							<ChatComponent 
								activedPlugin={activedPlugin} setActivedPlugin={setActivedPlugin} 
								inputEnable={inputEnable} setInputEnable={setInputEnable}
								selectedLanguage={language || 'en'}
							/>
						</div>
					</div>
				</div>
			)}

			{/* Sidebar */}
			{showSidebar && (
				<div className="md:hidden fixed inset-0 bg-black bg-opacity-50 z-40" />
			)}
			<div 
				ref={sidebarRef}
				className={`md:hidden fixed right-0 top-20 h-screen w-52 bg-white dark:bg-neutral-800 shadow-lg transform transition-transform duration-300 z-50 ${
					showSidebar ? 'translate-x-0' : 'translate-x-full'
				}`}
			>
				<div className="p-4 flex flex-col space-y-4">
					{/* New Chat Button */}
					{featuresStates.enableNewChat && (
						<button
							className={`flex items-center space-x-2 w-full h-16 px-4 py-2 ${
								inputEnable ? 'bg-[#d0d0d0] hover:bg-[#acabab]' : 'bg-neutral-300 cursor-not-allowed'
							} dark:bg-[#414141] text-neutral-500 dark:text-neutral-200 dark:hover:bg-[#2a2a2a] rounded-lg shadow-md focus:outline-none`}
							onClick={createNewChat}
							disabled={!inputEnable} // Disable when input is not enabled
						>
							<RiChatNewFill className="w-8 h-8" />
							<span>{buttonLabels.newChatButton}</span>
						</button>
					)}
					{/* Mode Toggle Button */}
					{featuresStates.enableDarkMode && (
						<button
							className="flex items-center space-x-2 w-full h-16 px-4 py-2 bg-[#d0d0d0] dark:bg-[#414141] text-neutral-500 dark:text-neutral-200 hover:bg-[#acabab] dark:hover:bg-[#2a2a2a] rounded-lg shadow-md"
							onClick={toggleDarkMode}
						>
							{darkMode ? (
								<FaSun className="text-yellow-500 w-6 h-6" />
							) : (
								<FaMoon className="text-neutral-500 w-6 h-6" />
							)}
							<span>{darkMode ? buttonLabels.lightModeButton : buttonLabels.darkModeButton}</span>
						</button>
					)}
				</div>
				{/* Language Buttons */}
				{featuresStates.enableLanguages && (
					<div className='border-t-2 border-gray-400 m-4 mt-1'>
						<div className='text-center dark:text-white m-3'>
							{buttonLabels.availableLanguagesTitle}
						</div>
						<div 
							className="left-4 items-center flex flex-wrap gap-3 p-2 overflow-y-auto" 
							style={{ width: '100%', maxHeight: 'calc(100vh - 320px)' }}
						>
							{availableLanguages.map(({ code, label, flag }) => (
								<button
									key={code}
									className={`flex items-center justify-center w-11 h-11 rounded-full focus:outline-none
										${language === code ? 'bg-neutral-500 dark:bg-neutral-300' : 'bg-none text-neutral-500'}
									`}
									onClick={() => handleLanguageChange(code)}
									disabled={!inputEnable}
								>
									<img src={flag} alt={label} className="w-9 h-9 rounded-full bg-neutral-600" />
									<span className="sr-only">{label}</span>
								</button>
							))}
						</div>
					</div>
				)}
			</div>
		</div>
	);
}

export default AssistenteVirtual;