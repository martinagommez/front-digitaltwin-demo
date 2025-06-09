import ReactDOM from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Function to update favicon dynamically
const updateFavicon = async () => {
    try {
        // Fetch the configuration JSON
        const response = await fetch('/client.config.json');
        const config = await response.json();

        // Extract the favicon URL from the JSON
        const faviconUrl = config.favicon || '';

        // Update the favicon in the document head
        const link = document.querySelector("link[rel~='icon']") as HTMLLinkElement;
        if (link) {
            link.href = faviconUrl; // Update the href dynamically
        } else {
            // If no <link> tag exists, create one
            const newLink = document.createElement('link');
            newLink.rel = 'icon';
            newLink.href = faviconUrl;
            document.head.appendChild(newLink);
        }
    } catch (error) {
        console.error('Failed to update favicon:', error);
    }
};

// Call the function to update the favicon
updateFavicon();

// Initialize the React application
const root = ReactDOM.createRoot(document.getElementById('root')!);
root.render(
    <App />
);
