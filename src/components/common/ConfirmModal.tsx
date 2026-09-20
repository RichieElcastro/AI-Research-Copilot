import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { Modal } from './Modal';

interface ConfirmModalProps {
  id?: string;
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  cascadeWarning?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  isDanger?: boolean;
  isLoading?: boolean;
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({
  id = 'confirm-dialog',
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  cascadeWarning,
  confirmLabel = 'Confirm Delete',
  cancelLabel = 'Cancel',
  isDanger = true,
  isLoading = false,
}) => {
  return (
    <Modal id={id} isOpen={isOpen} onClose={onClose} title={title} maxWidth="md">
      <div className="space-y-4">
        <div className="flex items-start gap-3">
          <div className="p-2.5 rounded-full bg-rose-50 border border-rose-100 text-rose-600 flex-shrink-0">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div className="space-y-2">
            <p className="text-sm text-slate-700 leading-relaxed">{message}</p>
            {cascadeWarning && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-900 leading-relaxed font-medium">
                ⚠️ Cascading Impact Notice: {cascadeWarning}
              </div>
            )}
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
          <button
            type="button"
            onClick={onClose}
            disabled={isLoading}
            className="px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isLoading}
            className={`px-4 py-2 text-xs font-semibold text-white rounded-lg transition-colors shadow-xs ${
              isDanger
                ? 'bg-rose-600 hover:bg-rose-700 focus:ring-2 focus:ring-rose-400'
                : 'bg-indigo-600 hover:bg-indigo-700 focus:ring-2 focus:ring-indigo-400'
            } ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            {isLoading ? 'Processing...' : confirmLabel}
          </button>
        </div>
      </div>
    </Modal>
  );
};
