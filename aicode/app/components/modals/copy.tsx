"use client";
import { CheckCircle, X } from "lucide-react";

interface CopyModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function CopyModal({ isOpen, onClose }: CopyModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 backdrop-blur-md flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl p-8 shadow-2xl max-w-md mx-4 transform animate-in fade-in zoom-in duration-300">
        <div className="text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-8 h-8 text-green-600" />
          </div>
          <h3 className="text-xl font-semibold text-gray-900 mb-2">
            Copied Successfully!
          </h3>
          <p className="text-gray-600 mb-6">
            The transcript has been copied to your clipboard
          </p>
          <button
            onClick={onClose}
            className="px-6 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors flex items-center space-x-2 mx-auto"
          >
            <X className="w-4 h-4" />
            <span>Close</span>
          </button>
        </div>
      </div>
    </div>
  );
}