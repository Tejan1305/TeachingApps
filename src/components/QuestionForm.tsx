"use client";
import { useState } from "react";

const QuestionForm = ({ onGenerate }: { onGenerate: (data: any) => void }) => {
    const [formData, setFormData] = useState({
        grade: "Grade 9",
        subject: "Math",
        assessmentType: "Multiple Choice Questions",
        topic: "",
        learningObjectives: "",
        difficulty: "Medium",
        numQuestions: 10,
    });

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    return (
        <div className="space-y-4">
            <label>Enter Topic</label>
            <input name="topic" placeholder="e.g. Algebra" value={formData.topic} onChange={handleChange} className="w-full p-2 border rounded" />

            <label>Learning Objectives</label>
            <input name="learningObjectives" placeholder="Enter a learning objective" value={formData.learningObjectives} onChange={handleChange} className="w-full p-2 border rounded" />

            <label>Number of Questions</label>
            <input type="number" name="numQuestions" value={formData.numQuestions} onChange={handleChange} className="w-full p-2 border rounded" />

            <button onClick={() => onGenerate(formData)} className="p-2 bg-red-500 text-white rounded w-full">Generate Assessment</button>
        </div>
    );
};

export default QuestionForm;