import React, { useState, useEffect, useRef } from "react";
import * as sdk from "microsoft-cognitiveservices-speech-sdk";
import { IoMic, IoMicOffOutline } from "react-icons/io5";
import { startRealTimeSpeechRecognition, stopRealTimeSpeechRecognition } from "./SpeechService";
import { useLanguageContext } from "./LanguageContext";

interface AudioProcessingProps {
    inputText: string;
    setInputText: React.Dispatch<React.SetStateAction<string>>;
    setPlayingMessageId: (id: string | null) => void;
    darkMode: boolean;
    selectedLanguage: string;
}

const AudioProcessing: React.FC<AudioProcessingProps> = ({ inputText, setInputText, setPlayingMessageId, darkMode, selectedLanguage }) => {
    const [recognizer, setRecognizer] = useState<sdk.SpeechRecognizer | null>(null);
    const [isRecording, setIsRecording] = useState<boolean>(false);
    const recognizerRef = useRef<sdk.SpeechRecognizer | null>(null);
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const synthesizerRef = useRef<sdk.SpeechSynthesizer | null>(null);
    
    const { languageData } = useLanguageContext();
    const audioRecordingButton = languageData?.audioRecordingButton?.[selectedLanguage] || "Start Audio Recording";

    useEffect(() => {
        // Cleanup when component unmounts or when recording stops
        return () => {
            if (recognizer) {
                stopRealTimeSpeechRecognition(recognizer);
            }
        };
    }, [recognizer]);

    const toggleRecording = async () => {
        if (isRecording) {
            // Stop the current recording
            stopRealTimeSpeechRecognition(recognizerRef.current);
            recognizerRef.current = null;
            setIsRecording(false);
        } else {
            if (synthesizerRef.current) {
                synthesizerRef.current.speakTextAsync(""); // Stop playback when recording starts
                setPlayingMessageId(null);
            }
            // Wait for the speech recognizer to be initialized
            const speechRecognizer = await startRealTimeSpeechRecognition(
                (text: string) => {
                    setInputText(prevText => (prevText === "" ? text : `${prevText} ${text}`));
                },
                () => {
                    setIsRecording(false);
                }
            );
            // Now assign the recognized instance
            recognizerRef.current = speechRecognizer;
            setIsRecording(true);
        }
    };

    useEffect(() => {
        if (!isRecording) return;
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)(); //webkitAudioContext fallback for Safari
        // Determine colors based on user's dark mode preference:
        const waveLineColor = darkMode ? "black" : "white"; // Waveform line color
        const canvasBgColor = darkMode ? "white" : "black";   // Canvas background color
        // Set the canvas element's CSS background immediately for instant change.
        canvas.style.backgroundColor = canvasBgColor;
        //Asking for microphone permission and start capturing audio.
        navigator.mediaDevices.getUserMedia({ audio: true }).then(stream => {
            const source = audioContext.createMediaStreamSource(stream); //audio source from microphone stream
            const analyser = audioContext.createAnalyser(); //analyser mode to process audio
            analyser.fftSize = 512; //smoothness of wave form
            source.connect(analyser);
            const bufferLength = analyser.frequencyBinCount; //number of frequency bins
            const dataArray = new Uint8Array(bufferLength); //store frequency data
            const draw = () => {
                requestAnimationFrame(draw); //infinite animation loop
                analyser.getByteFrequencyData(dataArray); //reads audio frequency data
                // Clear the canvas with the desired background color
                ctx.fillStyle = canvasBgColor;
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                //Loop Through Data & Draw
                ctx.beginPath();
                let sliceWidth = canvas.width / bufferLength;
                let x = 0;
                for (let i = 0; i < bufferLength; i++) {
                    let v = dataArray[i] / 255;
                    let y = (v * canvas.height) / 2 + canvas.height / 2; // Center the wave
                    if (i === 0) ctx.moveTo(x, y);
                    else ctx.lineTo(x, y);
                    x += sliceWidth;
                }
                ctx.strokeStyle = waveLineColor;
                ctx.lineWidth = 2;
                ctx.stroke(); //draw the line on the canvas
            };
            draw();
        });
        //Stop the audio context when recording stops or component unmounts.
        return () => {
            audioContext.close(); 
        };
    }, [isRecording, darkMode]);

    return (
        <div className="flex gap-2">
            {/* Record Button */}
            <div className={`flex items-center transition-all duration-300 overflow-hidden
                    ${isRecording ? "w-36 rounded-3xl" : "w-7 md:w-8 rounded-full"} 
                    h-7 md:h-8 bg-black dark:bg-white text-white dark:text-black`}
            >
                {/* Mic Button */}
                <button
                    title={audioRecordingButton}
                    onClick={toggleRecording}
                    className="flex items-center justify-center w-7 h-7 md:w-8 md:h-8 rounded-full 
                        bg-black dark:bg-white text-white dark:text-black hover:bg-neutral-700 dark:hover:bg-neutral-300"
                >
                    {isRecording ? <IoMicOffOutline className="w-5 h-5" /> : <IoMic className="w-5 h-5" />}
                </button>
                {/* Waveform */}
                {isRecording && (
                    <div className="flex items-center h-7 md:h-8 w-20">
                        <canvas ref={canvasRef} width="100" height="16"/>
                    </div>
                )}
            </div>
        </div>
    );
};

export default AudioProcessing;
