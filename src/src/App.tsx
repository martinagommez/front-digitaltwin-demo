import AssistenteVirtual from "./components/AssistenteVirtual";
import { LanguageProvider } from './components/LanguageContext';
import { useEffect, useState  } from "react";

function App() {
	const [configTitle, setConfigTitle] = useState<string>('Home page');
	useEffect(() => {
		// Fetch the title from client json
		const fetchConfig = async () => {
			try {
				const response = await fetch('/client.config.json');
				const configData = await response.json();
				if (configData.title) {
					setConfigTitle(configData.tabText); // Update the state with the title from JSON
					document.title = configData.tabText; // Set the document title
				}
			} catch (error) {
				console.error("Error fetching config file:", error);
			}
		};
		fetchConfig();
	}, [configTitle]);
	return (
		<LanguageProvider>
			<AssistenteVirtual />
		</LanguageProvider>
	);
}

export default App
