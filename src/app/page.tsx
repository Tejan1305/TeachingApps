"use client";
import { useState, useEffect } from "react";
import { createClient } from "@supabase/supabase-js";
import { jsPDF } from "jspdf";

const supabaseUrl = 'https://xvqasgmxfuxpykpubyaj.supabase.co';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

const AssessmentGenerator = () => {
    const [documentText, setDocumentText] = useState("");
    const [grade, setGrade] = useState("Grade 9");
    const [subject, setSubject] = useState("Math");
    const [assessmentType, setAssessmentType] = useState("Multiple Choice Questions");
    const [topic, setTopic] = useState("");
    const [learningObjectives, setLearningObjectives] = useState("");
    const [difficulty, setDifficulty] = useState("Medium");
    const [numQuestions, setNumQuestions] = useState(10);
    const [newlyGeneratedQuestions, setNewlyGeneratedQuestions] = useState<string[]>([]);
    const [viewingPreviousQuestions, setViewingPreviousQuestions] = useState<string[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [previousQuestions, setPreviousQuestions] = useState<any[]>([]);
    const [visibleQuestionId, setVisibleQuestionId] = useState<string | null>(null);

    // Fetch previous questions from Supabase
    useEffect(() => {
        const fetchPreviousQuestions = async () => {
            const { data, error } = await supabase
                .from("questions")
                .select("*")
                .order("created_at", { ascending: false });

            if (error) console.error("Error fetching questions:", error);
            else setPreviousQuestions(data || []);
        };

        fetchPreviousQuestions();
    }, []);

    const toggleQuestions = (id: string, questionsList: any) => {
        let parsedQuestions = questionsList;

        // If questionsList is a string, parse it into an array
        if (typeof questionsList === "string") {
            try {
                parsedQuestions = JSON.parse(questionsList);
            } catch (error) {
                console.error("Error parsing questions:", error);
                parsedQuestions = [];
            }
        }

        // Ensure it's an array before setting state
        if (!Array.isArray(parsedQuestions)) {
            console.error("Questions are not an array:", parsedQuestions);
            parsedQuestions = [];
        }

        if (visibleQuestionId === id) {
            setViewingPreviousQuestions([]); // Hide questions
            setVisibleQuestionId(null);
        } else {
            setViewingPreviousQuestions(parsedQuestions); // Show selected questions
            setVisibleQuestionId(id);
        }
    };

    // Handle file upload
    const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            setDocumentText(e.target?.result as string);
        };
        reader.readAsText(file);
    };

    // Auto-save questions to Supabase
    const saveQuestionsToDatabase = async (questionsToSave: string[]) => {
        if (!questionsToSave.length) return;
        
        try {
            const { data, error } = await supabase
                .from("questions")
                .insert({
                    topic: topic || "Untitled Topic",
                    grade,
                    subject,
                    assessment_type: assessmentType,
                    difficulty,
                    learning_objectives: learningObjectives,
                    generated_questions: questionsToSave,
                    created_at: new Date().toISOString()
                });
                
            if (error) throw error;
            
            // Refresh questions list
            const { data: updatedData, error: fetchError } = await supabase
                .from("questions")
                .select("*")
                .order("created_at", { ascending: false });
                
            if (fetchError) throw fetchError;
            setPreviousQuestions(updatedData || []);
            
        } catch (err) {
            console.error("Error auto-saving questions:", err);
            setError("Failed to auto-save questions. You can still download them as PDF.");
        }
    };

    // Handle generating questions
    const handleGenerate = async () => {
        setLoading(true);
        setError("");
        setNewlyGeneratedQuestions([]);

        try {
            const response = await fetch("/api/generate-questions", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    documentText,
                    grade,
                    subject,
                    assessmentType,
                    topic,
                    learningObjectives,
                    difficulty,
                    numQuestions,
                }),
            });

            const data = await response.json();

            if (!data.success) {
                throw new Error(data.error || "Failed to generate questions.");
            }

            // Process the questions to remove any unnecessary message
            let questionsArray = Array.isArray(data.questions)
                ? data.questions
                : data.questions.split("\n").filter((q: string) => q.trim() !== "");
                
            // Remove any prefix explanatory message if it exists
            if (questionsArray.length > 0 && 
                (questionsArray[0].includes("I must note") || 
                 questionsArray[0].includes("appears to be corrupted") ||
                 questionsArray[0].includes("Here are"))) {
                questionsArray = questionsArray.slice(1);
            }
            
            // Clean up any numbering issues
            questionsArray = questionsArray.filter((q: string) => 
                q.trim() !== "" && 
                !q.match(/^Here are \d+ multiple-choice questions/) &&
                !q.includes("I can still generate")
            );

            setNewlyGeneratedQuestions(questionsArray);
            
            // Auto-save the questions to the database
            await saveQuestionsToDatabase(questionsArray);
            
        } catch (err) {
            setError(err instanceof Error ? err.message : "An unexpected error occurred.");
        } finally {
            setLoading(false);
        }
    };

    // Save questions to PDF
    const handleSaveToPDF = () => {
        if (!newlyGeneratedQuestions.length) return;
        
        const doc = new jsPDF();
        
        // Add title
        doc.setFontSize(18);
        doc.setTextColor(220, 20, 60); // Rose color
        doc.text(`${topic || 'Assessment'} - ${difficulty} Difficulty`, 20, 20);
        
        // Add metadata
        doc.setFontSize(12);
        doc.setTextColor(0, 0, 0);
        doc.text(`Grade: ${grade}`, 20, 30);
        doc.text(`Subject: ${subject}`, 20, 37);
        doc.text(`Type: ${assessmentType}`, 20, 44);
        if (learningObjectives) {
            doc.text(`Learning Objectives: ${learningObjectives}`, 20, 51);
        }
        
        // Add questions
        doc.setFontSize(12);
        let yPosition = 60;
        
        newlyGeneratedQuestions.forEach((question, index) => {
            // Check if we need a new page
            if (yPosition > 270) {
                doc.addPage();
                yPosition = 20;
            }
            
            // Split long questions into multiple lines
            const splitText = doc.splitTextToSize(question, 170);
            doc.text(splitText, 20, yPosition);
            yPosition += 10 * splitText.length;
        });
        
        // Save the PDF
        doc.save(`${topic || 'assessment'}_${new Date().toISOString().slice(0, 10)}.pdf`);
    };

    // Handle deleting a previous question set
    const handleDelete = async (id: string) => {
        await supabase.from("questions").delete().eq("id", id);
        setPreviousQuestions(prev => prev.filter(q => q.id !== id));
        if (visibleQuestionId === id) {
            setViewingPreviousQuestions([]); // Hide questions if deleted
            setVisibleQuestionId(null);
        }
    };

    return (
        <div className="max-w-4xl mx-auto p-8 bg-gray-50 min-h-screen">
            {/* Header Section */}
            <div className="mb-8 text-center">
                <h1 className="text-3xl font-bold text-rose-500 mb-2">Assessment Generator</h1>
                <p className="text-gray-600 text-lg">
                    Create interactive assessments for students with customizable options
                </p>
            </div>

            {/* Main Content Card */}
            <div className="bg-white rounded-lg shadow-md p-6 mb-8">
                {/* File Upload */}
                <div className="mb-6">
                    <h2 className="text-xl font-semibold text-gray-800 mb-3">Document Upload</h2>
                    <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-rose-500 transition-colors">
                        <input 
                            type="file" 
                            id="file-upload" 
                            className="hidden" 
                            onChange={handleFileUpload} 
                        />
                        <label 
                            htmlFor="file-upload" 
                            className="cursor-pointer flex flex-col items-center"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-gray-400 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                            </svg>
                            <span className="text-gray-600 font-medium">Click to select a document</span>
                            <span className="text-gray-500 text-sm mt-1">or drag and drop file here</span>
                        </label>
                        {documentText && (
                            <div className="mt-3 text-sm text-green-600">
                                Document loaded successfully!
                            </div>
                        )}
                    </div>
                </div>

                {/* Assessment Options */}
                <div className="mb-6">
                    <h2 className="text-xl font-semibold text-gray-800 mb-3">Assessment Options</h2>
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                        <div className="bg-gray-50 p-4 rounded-lg">
                            <label className="block text-gray-700 font-medium mb-2">Grade Level</label>
                            <select 
                                className="w-full border border-gray-300 rounded-lg p-2 focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-transparent" 
                                value={grade} 
                                onChange={(e) => setGrade(e.target.value)}
                            >
                                <option>Grade 9</option>
                                <option>Grade 10</option>
                            </select>
                        </div>
                        <div className="bg-gray-50 p-4 rounded-lg">
                            <label className="block text-gray-700 font-medium mb-2">Subject</label>
                            <select 
                                className="w-full border border-gray-300 rounded-lg p-2 focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-transparent" 
                                value={subject} 
                                onChange={(e) => setSubject(e.target.value)}
                            >
                                <option>Math</option>
                                <option>Science</option>
                            </select>
                        </div>
                        <div className="bg-gray-50 p-4 rounded-lg">
                            <label className="block text-gray-700 font-medium mb-2">Assessment Type</label>
                            <select 
                                className="w-full border border-gray-300 rounded-lg p-2 focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-transparent" 
                                value={assessmentType} 
                                onChange={(e) => setAssessmentType(e.target.value)}
                            >
                                <option>Multiple Choice Questions</option>
                                <option>Descriptive</option>
                                <option>Fill In The Blanks</option>
                            </select>
                        </div>
                    </div>

                    {/* Topic Input */}
                    <div className="mb-4 bg-gray-50 p-4 rounded-lg">
                        <label className="block text-gray-700 font-medium mb-2">Topic</label>
                        <input 
                            type="text" 
                            className="w-full border border-gray-300 rounded-lg p-2 focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-transparent" 
                            placeholder="e.g., Algebra, World War II, Solar System" 
                            value={topic} 
                            onChange={(e) => setTopic(e.target.value)} 
                        />
                    </div>

                    {/* Learning Objectives */}
                    <div className="mb-4 bg-gray-50 p-4 rounded-lg">
                        <label className="block text-gray-700 font-medium mb-2">Learning Objectives</label>
                        <div className="flex items-center">
                            <input 
                                type="text" 
                                className="flex-grow border border-gray-300 rounded-lg rounded-r-none p-2 focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-transparent" 
                                placeholder="Enter a learning objective" 
                                value={learningObjectives} 
                                onChange={(e) => setLearningObjectives(e.target.value)} 
                            />
                            <button className="bg-rose-600 hover:bg-rose-700 text-white p-2 rounded-lg rounded-l-none transition-colors">
                                Add
                            </button>
                        </div>
                    </div>

                    {/* Difficulty Level */}
                    <div className="mb-4 bg-gray-50 p-4 rounded-lg">
                        <label className="block text-gray-700 font-medium mb-2">Difficulty Level</label>
                        <div className="flex gap-2">
                            {['Easy', 'Medium', 'Hard'].map(level => (
                                <button 
                                    key={level} 
                                    className={`flex-1 py-2 px-4 rounded-lg transition-colors ${
                                        difficulty === level 
                                            ? 'bg-rose-600 text-white' 
                                            : 'bg-gray-200 hover:bg-gray-300 text-gray-700'
                                    }`} 
                                    onClick={() => setDifficulty(level)}
                                >
                                    {level}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Number of Questions */}
                    <div className="mb-4 bg-gray-50 p-4 rounded-lg">
                        <label className="block text-gray-700 font-medium mb-2">Number of Questions</label>
                        <input 
                            type="number" 
                            className="w-full border border-gray-300 rounded-lg p-2 focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-transparent" 
                            value={numQuestions} 
                            onChange={(e) => setNumQuestions(Number(e.target.value))} 
                            min="1"
                            max="50"
                        />
                    </div>
                </div>

                {/* Generate Button */}
                <button 
                    className={`w-full py-3 px-4 rounded-lg text-white font-medium text-lg transition-colors ${
                        loading 
                            ? 'bg-gray-500 cursor-not-allowed' 
                            : 'bg-rose-600 hover:bg-rose-700'
                    }`} 
                    onClick={handleGenerate} 
                    disabled={loading}
                >
                    {loading ? (
                        <div className="flex items-center justify-center">
                            <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            Generating Questions...
                        </div>
                    ) : (
                        "Generate Assessment"
                    )}
                </button>

                {/* Display Error Message */}
                {error && (
                    <div className="mt-4 p-3 bg-red-100 border border-red-300 text-red-800 rounded-lg">
                        <p>{error}</p>
                    </div>
                )}
            </div>

            {/* Generated Questions Section - Only show for newly generated questions */}
            {Array.isArray(newlyGeneratedQuestions) && newlyGeneratedQuestions.length > 0 && (
                <div className="bg-white rounded-lg shadow-md p-6 mb-8">
                    <h2 className="text-3xl font-bold text-rose-500 mb-4 flex items-center">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 mr-2 text-rose-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                        </svg>
                        Generated Questions
                    </h2>
                    <div className="space-y-3">
                        {newlyGeneratedQuestions.map((q, index) => (
                            <div key={index} className="p-4 bg-gray-50 rounded-lg border-l-4 border-rose-500">
                                <p className="text-gray-800">{q}</p>
                            </div>
                        ))}
                    </div>
                    <div className="mt-4 flex justify-end space-x-3">
                        <button 
                            className="bg-blue-500 hover:bg-blue-600 text-white py-2 px-4 rounded-lg flex items-center transition-colors"
                            onClick={handleSaveToPDF}
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                            </svg>
                            Download as PDF
                        </button>
                    </div>
                </div>
            )}

            {/* Previous Questions Section */}
            <div className="bg-white rounded-lg shadow-md p-6">
                <h2 className="text-3xl font-bold text-rose-500 mb-4 flex items-center">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 mr-2 text-rose-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Previous Generated Questions
                </h2>

                {previousQuestions.length === 0 ? (
                    <div className="p-8 text-center text-gray-500 bg-gray-50 rounded-lg">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mx-auto mb-3 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                        </svg>
                        <p>No previous questions found. Generate your first assessment!</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 gap-4">
                        {previousQuestions.map(({ id, topic, generated_questions, created_at }) => {
                            // Format date if available
                            const formattedDate = created_at ? new Date(created_at).toLocaleDateString() : '';
                            
                            return (
                                <div key={id} className="border border-gray-200 rounded-lg overflow-hidden">
                                    {/* Card Header */}
                                    <div className="bg-gray-50 p-4 border-b border-gray-200">
                                        <div className="flex justify-between items-center">
                                            <div>
                                                <h3 className="font-semibold text-lg text-gray-800">{topic || "Untitled Topic"}</h3>
                                                {formattedDate && (
                                                    <p className="text-sm text-gray-500">Created on {formattedDate}</p>
                                                )}
                                            </div>
                                            <div className="flex gap-2">
                                                <button
                                                    className="inline-flex items-center py-1.5 px-3 rounded-md bg-blue-100 text-blue-700 hover:bg-blue-200 transition-colors text-sm font-medium"
                                                    onClick={() => toggleQuestions(id, generated_questions)}
                                                >
                                                    {visibleQuestionId === id ? (
                                                        <>
                                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                                            </svg>
                                                            Hide
                                                        </>
                                                    ) : (
                                                        <>
                                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                                            </svg>
                                                            View
                                                        </>
                                                    )}
                                                </button>
                                                <button
                                                    className="inline-flex items-center py-1.5 px-3 rounded-md bg-rose-100 text-rose-700 hover:bg-rose-200 transition-colors text-sm font-medium"
                                                    onClick={() => handleDelete(id)}
                                                >
                                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                    </svg>
                                                    Delete
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                    
                                    {/* Questions Display - Only show when this topic is selected */}
                                    {visibleQuestionId === id && Array.isArray(viewingPreviousQuestions) && viewingPreviousQuestions.length > 0 && (
                                        <div className="p-4 divide-y divide-gray-200">
                                            {viewingPreviousQuestions.map((q: string, index: number) => (
                                                <div key={index} className="py-3">
                                                    <p>{q}</p>
                                                </div>
                                            ))}
                                            <div className="pt-4 flex justify-end">
                                                <button 
                                                    className="bg-blue-500 hover:bg-blue-600 text-white py-1.5 px-3 rounded-lg flex items-center transition-colors text-sm"
                                                    onClick={() => {
                                                        const doc = new jsPDF();
                                                        doc.setFontSize(18);
                                                        doc.text(`${topic || 'Saved Assessment'}`, 20, 20);
                                                        
                                                        let yPosition = 40;
                                                        viewingPreviousQuestions.forEach((q, idx) => {
                                                            if (yPosition > 270) {
                                                                doc.addPage();
                                                                yPosition = 20;
                                                            }
                                                            const splitText = doc.splitTextToSize(q, 170);
                                                            doc.text(splitText, 20, yPosition);
                                                            yPosition += 10 * splitText.length;
                                                        });
                                                        
                                                        doc.save(`${topic || 'saved_assessment'}.pdf`);
                                                    }}
                                                >
                                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                                                    </svg>
                                                    Download as PDF
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
};

export default AssessmentGenerator;