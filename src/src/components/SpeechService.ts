import * as sdk from "microsoft-cognitiveservices-speech-sdk";
// import { TextAnalyticsClient, AzureKeyCredential, DetectLanguageResult } from "@azure/ai-text-analytics";

interface ProcessConfig {
    cognitiveEndpoint: string;
    cognitiveKey: string;
    speechKey: string;
    speechRegion: string;
}

const loadConfig = async (): Promise<ProcessConfig> => {
    const response = await fetch("/client.config.json");
    if (!response.ok) {
        console.log("não resultou");
        throw new Error("Failed to load config");
    }
    console.log("Resposta",response);
    return response.json();
};

const normalizeText = (text: string): string => {
    return text
        .toLowerCase() // Convert everything to lowercase
        .replace(/(^|\.\s+)([a-z])/g, (match) => match.toUpperCase()) // Capitalize sentences
        .replace(/\s+/g, " ") // Remove extra spaces
        .trim(); // Remove leading/trailing spaces
};

// Function to remove filler words
const removeFillers = (text: string): string => {
    return text.replace(/\b(hum|uhm|mm|ahm|um|uh|err|ah)\b/gi, "").trim();
};

// Correct common misinterpretations
const corrections: { [key: string]: string } = {
    "Azure speed stack": "Azure Speech SDK",
    "chat pod": "chatbot",
    "re-cog nation": "recognition"
};

const correctMisheardWords = (text: string): string => {
    return text.replace(/\b(\w+)\b/gi, (word) => corrections[word.toLowerCase()] || word);
};

// Clean up transcription
const cleanUpTranscription = (text: string): string => {
    text = normalizeText(text);
    text = removeFillers(text);
    text = correctMisheardWords(text);
    return text;
};

// // Function to detect the language of a given text
// const detectLanguage = async (text: string): Promise<string> => {
//     const config = await loadConfig(); // Load config dynamically
//     const key = config.cognitiveKey;
//     const endpoint = config.cognitiveEndpoint;
//     const client = new TextAnalyticsClient(endpoint, new AzureKeyCredential(key));
//     try {
//         const results = await client.detectLanguage([{ id: "1", text }]); // Returns an array
//         const result: DetectLanguageResult = results[0]; // Ensure TypeScript knows the type
//         if (result.error) {
//             console.log("Language detection failed. Defaulting to 'en'.");
//             return "en";
//         }
//         console.log("Detected Language:", result);
//         return result.primaryLanguage.iso6391Name; // Example: 'en', 'pt', 'es'
//     } catch (error) {
//         console.log("Error detecting language:", error);
//         return "en"; // Fallback to English if language detection fails
//     }
// };

// Function to start speech recognition and language detection
export const startRealTimeSpeechRecognition = async (
    onTextUpdate: (text: string) => void,
    onStop: () => void
): Promise<sdk.SpeechRecognizer> => {
    const config = await loadConfig(); // Load config json dynamically
    console.log("Config key & region:", config.speechKey, config.speechRegion);
    const speechConfig = sdk.SpeechConfig.fromSubscription(config.speechKey, config.speechRegion);
    // let currentLanguage = "en"; // Default language

    // Retrieve the language selected by the user (stored in localStorage)
    try {
        localStorage.removeItem('language');
        const userLanguage = localStorage.getItem('language') || 'pt-PT';
        console.log("Type of userLanguage:", typeof userLanguage);
        console.log("Detected userLanguage:", userLanguage);
        speechConfig.speechRecognitionLanguage = userLanguage;
    } catch (error) {
        console.error("Error retrieving language from localStorage:", error);
        console.log("Falling back to default language: pt-PT");
    }

    const audioConfig = sdk.AudioConfig.fromDefaultMicrophoneInput();
    const recognizer = new sdk.SpeechRecognizer(speechConfig, audioConfig);

    const phraseListGrammar = sdk.PhraseListGrammar.fromRecognizer(recognizer);
    phraseListGrammar.addPhrase("AI chatbot");

    let finalText = ""; // Initialize a variable to store accumulated recognized text
    
    recognizer.recognized = async (
        sender: sdk.Recognizer,
        event: sdk.SpeechRecognitionEventArgs
    ) => {
        console.log("🔊 Starting recognition");
        if (event.result.reason === sdk.ResultReason.RecognizedSpeech) {
            finalText = event.result.text; // Update finalText with recognized speech
            const cleanedText = cleanUpTranscription(finalText); // Clean up the text
            onTextUpdate(cleanedText); // Update the input field with cleaned text
            console.log("🎵 Recognized speech:", finalText);
            console.log("🎵 Cleaned text:", cleanedText);
            // // Detect the language of the recognized text
            // const detectedLanguage = await detectLanguage(cleanedText);
            // console.log("Detected Language:", detectedLanguage);
            // // If the detected language is different, update the recognition language
            // if (detectedLanguage !== currentLanguage) {
            //     currentLanguage = detectedLanguage;
            //     console.log("Updating speech recognition language to:", currentLanguage);
            //     speechConfig.speechRecognitionLanguage = currentLanguage;
            // }
        }
    };

    recognizer.canceled = (
        sender: sdk.Recognizer, 
        event: sdk.SpeechRecognitionCanceledEventArgs
    ) => {
        console.error("Recognition canceled:", event.reason);
        recognizer.stopContinuousRecognitionAsync();
        onStop();
    };

    recognizer.sessionStopped = () => {
        console.log("✅ Recognition session stopped.");
        recognizer.stopContinuousRecognitionAsync();
        onStop();
    };

    await recognizer.startContinuousRecognitionAsync();
    return recognizer;
};

export const stopRealTimeSpeechRecognition = async (recognizer: sdk.SpeechRecognizer | null) => {
    if (recognizer) {
        console.log("🛑 Stopping recognition...");
        await new Promise<void>((resolve, reject) => {
            recognizer.stopContinuousRecognitionAsync(
                () => {
                    console.log("✅ Recognition stopped.");
                    recognizer.close();
                    resolve();
                },
                (error) => {
                    console.error("Error stopping recognition:", error);
                    reject(error);
                }
            );
        });
    } else {
        console.warn("Recognizer is null or not initialized.");
    }
};
